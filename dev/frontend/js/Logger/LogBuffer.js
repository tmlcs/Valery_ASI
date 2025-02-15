import pako from 'pako';

/**
 * Manages buffering of log entries with automatic flushing capabilities.
 * Implements retry logic and overflow protection.
 * @example
 * const buffer = new LogBuffer({ maxSize: 100, flushInterval: 5000 });
 * buffer.onFlush(async (batch) => console.log('Flushing:', batch));
 */
export class LogBuffer {
    #isFlusing = false;
    #flushPromise = null;

    /**
     * @param {Object} options - Buffer configuration
     * @param {number} [options.maxSize=100] - Maximum number of entries to store
     * @param {number} [options.flushInterval=5000] - Auto-flush interval in ms
     * @param {number} [options.retryAttempts=3] - Number of retry attempts
     * @param {number} [options.retryDelay=1000] - Delay between retries in ms
     * @param {number} [options.maxEntrySize=1048576] - Maximum size of a single log entry in bytes
     * @param {number} [options.maxTotalSize=52428800] - Maximum total buffer size in bytes
     * @param {boolean} [options.compression=true] - Enable or disable log entry compression
     */
    constructor(options = {}) {
        // Agregar validaciones
        if (options.maxTotalSize && options.maxTotalSize < options.maxEntrySize) {
            throw new Error('maxTotalSize must be greater than maxEntrySize');
        }

        if (options.maxEntrySize && options.maxEntrySize <= 0) {
            throw new Error('maxEntrySize must be positive');
        }

        this.validateOptions(options);
        this.buffer = [];
        this.flushHandlers = new Set();
        this.flushTimeout = null;
        this.options = {
            maxSize: options.maxSize || 100,
            flushInterval: options.flushInterval || 5000
        };
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.maxEntrySize = options.maxEntrySize || 1024 * 1024; // 1MB límite por entrada
        this.totalBufferSize = 0;
        this.maxTotalSize = options.maxTotalSize || 50 * 1024 * 1024; // 50MB límite total
        this.compressionEnabled = options.compression ?? true;
        this.priorityQueue = new PriorityQueue();
        this.maxEntriesPerFlush = options.maxEntriesPerFlush || 1000;
        this.maxRetries = options.maxRetries || 3;
        this.mutex = new Mutex(options.mutexTimeout || 5000);
    }

    validateOptions(options) {
        if (options.maxSize && options.maxSize <= 0) {
            throw new Error('maxSize must be positive');
        }
        if (options.flushInterval && options.flushInterval < 1000) {
            throw new Error('flushInterval must be at least 1000ms');
        }
    }

    /**
     * Adds a log entry to the buffer.
     * Triggers flush if buffer is full or scheduled.
     * @param {Object} logEntry - Log entry to add
     * @throws {Error} If buffer is full and flush fails
     */
    async add(logEntry) {
        const addMutex = await this.#getMutex();
        try {
            const entrySize = this.#calculateEntrySize(logEntry);
            
            // Limpiar entradas antiguas si es necesario
            while (this.totalBufferSize + entrySize > this.maxTotalSize && this.buffer.length > 0) {
                const oldestEntry = this.buffer.shift();
                this.totalBufferSize -= this.#calculateEntrySize(oldestEntry);
            }

            if (this.totalBufferSize + entrySize > this.maxTotalSize) {
                throw new Error('Entry too large even after cleanup');
            }

            if (!logEntry || typeof logEntry !== 'object') {
                throw new Error('Invalid log entry');
            }

            if (entrySize > this.maxEntrySize) {
                throw new Error(`Log entry size (${entrySize}) exceeds maximum allowed size (${this.maxEntrySize})`);
            }

            if (this.totalBufferSize + entrySize > this.maxTotalSize) {
                await this.flush();
                if (this.totalBufferSize + entrySize > this.maxTotalSize) {
                    throw new Error('Total buffer size limit exceeded');
                }
            }

            // Esperar si hay un flush en progreso
            if (this.#flushPromise) {
                await this.#flushPromise;
            }

            // Sanitizar entrada para evitar referencias circulares
            const safeEntry = JSON.parse(JSON.stringify(logEntry));

            // Limitar tamaño del buffer temporal durante flush
            if (this.#isFlusing && this.buffer.length >= this.options.maxSize) {
                throw new Error('Buffer full during flush operation');
            }

            if (this.buffer.length >= this.options.maxSize) {
                await this.flush();
                if (this.buffer.length >= this.options.maxSize) {
                    throw new Error('Buffer full and flush failed');
                }
            }

            if (this.compressionEnabled) {
                logEntry = await this.#compressEntry(logEntry);
            }

            this.buffer.push(safeEntry);
            this.totalBufferSize += entrySize;
            
            if (this.buffer.length >= this.options.maxSize) {
                await this.flush();
            } else if (!this.flushTimeout) {
                this._scheduleFlush();
            }
        } finally {
            addMutex.release();
        }
    }

    async flush() {
        if (this.#isFlusing) {
            return this.#flushPromise;
        }

        const mutex = await this.#getMutex();
        try {
            this.#isFlusing = true;
            const batchToFlush = await Promise.all(
                this.buffer.map(entry => this.#decompressEntry(entry))
            );
            const currentSize = this.totalBufferSize;
            
            // Crear nuevo buffer para entradas durante flush
            this.buffer = [];
            this.totalBufferSize = 0;

            try {
                await Promise.all(
                    Array.from(this.flushHandlers).map(handler => 
                        this.#executeWithRetry(() => handler(batchToFlush))
                    )
                );
            } catch (error) {
                // Restaurar estado en caso de error
                this.buffer = [...batchToFlush, ...this.buffer];
                this.totalBufferSize = currentSize;
                throw error;
            }
        } finally {
            this.#isFlusing = false;
            this.#flushPromise = null;
            mutex.release();
        }
    }

    async #executeWithRetry(operation, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === attempts - 1) throw error;
                await new Promise(r => setTimeout(r, this.retryDelay * (i + 1)));
            }
        }
    }

    /**
     * Registers a handler function for flush operations.
     * @param {Function} handler - Async function to handle batch processing
     * @returns {Function} Cleanup function to remove the handler
     */
    onFlush(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Flush handler must be a function');
        }
        this.flushHandlers.add(handler);
        return () => this.flushHandlers.delete(handler);
    }

    async dispose() {
        try {
            await this.flush();
        } catch (error) {
            console.error('Error during buffer disposal:', error);
        } finally {
            this._clearFlushTimeout();
            this.flushHandlers.clear();
            this.buffer = [];
            this.totalBufferSize = 0;
            if (this.mutex) {
                this.mutex.dispose();
                this.mutex = null;
            }
        }
    }

    _scheduleFlush() {
        this._clearFlushTimeout();
        this.flushTimeout = setTimeout(() => this.flush(), this.options.flushInterval);
    }

    _clearFlushTimeout() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
    }

    async #compressEntry(entry) {
        if (!this.compressionEnabled) return entry;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let worker = null;

        try {
            worker = new Worker(new URL('./compression.worker.js', import.meta.url));
            const result = await new Promise((resolve, reject) => {
                worker.onmessage = (e) => resolve(e.data);
                worker.onerror = (e) => reject(e.error);
                worker.postMessage({ entry });
            });
            return result;
        } catch (error) {
            console.error('Compression failed:', error);
            return entry;
        } finally {
            clearTimeout(timeoutId);
            if (worker) worker.terminate();
        }
    }

    async #decompressEntry(entry) {
        if (!entry || !entry.compressed) return entry;
        
        try {
            const compressedData = Buffer.from(entry.data, 'base64');
            const decompressed = pako.ungzip(compressedData);
            const text = new TextDecoder().decode(decompressed);
            return JSON.parse(text);
        } catch (error) {
            console.error('Decompression failed:', error);
            return entry;
        }
    }

    #safeStringify(obj, seen = new WeakSet()) {
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            return value;
        });
    }

    // Agregar método para verificar estado
    isDisposed() {
        return this.buffer === null;
    }

    #getMutex() {
        if (!this._mutex) {
            this._mutex = new Mutex();
        }
        return this._mutex.acquire();
    }

    #calculateEntrySize(entry) {
        try {
            if (entry.compressed) {
                // Para entradas comprimidas, usar el tamaño de los datos en base64
                return entry.data.length;
            }
            return new TextEncoder().encode(this.#safeStringify(entry)).length;
        } catch (error) {
            console.warn('Error calculating entry size:', error);
            return 0;
        }
    }
}

class Mutex {
    constructor(timeoutMs = 5000) {
        this._queue = [];
        this._locked = false;
        this._timeoutMs = timeoutMs; // 5 segundos timeout por defecto
    }

    async acquire() {
        const ticket = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this._queue.findIndex(x => x.reject === reject);
                if (index !== -1) this._queue.splice(index, 1);
                reject(new Error('Mutex acquisition timeout'));
            }, this._timeoutMs);

            this._queue.push({ resolve, reject, timeout });
        });

        if (!this._locked) {
            this._locked = true;
            const next = this._queue.shift();
            if (next) {
                clearTimeout(next.timeout);
                next.resolve();
            }
        }

        await ticket;
        return this;
    }

    release() {
        this._locked = false;
        const next = this._queue.shift();
        if (next) {
            clearTimeout(next.timeout);
            this._locked = true;
            next.resolve();
        }
    }

    dispose() {
        this._queue = [];
        this._locked = false;
    }
}
