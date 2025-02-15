export class WorkerManager {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
        this.pendingOperations = new Set();
        this.operationTimeouts = new Map();
        this.responseHandlers = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000;

        try {
            this.validateEnvironment();
        } catch (error) {
            throw new Error(`Worker environment validation failed: ${error.message}`);
        }
    }

    validateEnvironment() {
        if (typeof Worker === 'undefined') {
            throw new Error('Web Workers are not supported in this environment');
        }
    }

    /**
     * Initializes the Web Worker and sets up message handlers.
     * @throws {Error} If worker initialization fails
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initializationInProgress) {
            return this._initializationInProgress;
        }

        this._initializationInProgress = (async () => {
            if (this.isInitialized) return;

            try {
                await this.#initializeWorker();
                await this.#testWorker();
                this.isInitialized = true;
            } catch (error) {
                await this.#cleanup();
                throw new Error(`Worker initialization failed: ${error.message}`);
            } finally {
                this._initializationInProgress = null;
            }
        })();

        return this._initializationInProgress;
    }

    /**
     * Processes a batch of log entries using the Web Worker.
     * @param {Array} batch - Array of log entries to process
     * @returns {Promise<any>} Result from the worker processing
     * @throws {Error} If WorkerManager is not initialized or processing fails
     */
    async processBatch(batch) {
        if (!batch || !Array.isArray(batch)) {
            throw new Error('Invalid batch format: must be an array');
        }

        if (!this.isInitialized || !this.worker) {
            throw new Error('WorkerManager not initialized or worker not available');
        }

        // Validar tamaño del batch
        const batchSize = new TextEncoder().encode(JSON.stringify(batch)).length;
        if (batchSize > 10 * 1024 * 1024) { // 10MB límite
            throw new Error('Batch size too large');
        }

        const operationId = Date.now();
        this.pendingOperations.add(operationId);

        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                return await this.#processWithTimeout(batch, operationId);
            } catch (error) {
                attempts++;
                if (attempts === this.maxRetries) throw error;
                await new Promise(r => setTimeout(r, this.retryDelay * attempts));
            }
        }
    }

    async #processWithTimeout(batch, operationId) {
        const cleanup = () => {
            this.pendingOperations.delete(operationId);
            this.#clearOperationTimeout(operationId);
            this.responseHandlers.delete(operationId);
        };

        try {
            this.#setOperationTimeout(operationId);
            this.worker.postMessage({
                type: 'process',
                data: batch,
                operationId
            });

            return new Promise((resolve, reject) => {
                this.responseHandlers.set(operationId, {
                    resolve: (result) => {
                        cleanup();
                        resolve(result);
                    },
                    reject: (error) => {
                        cleanup();
                        reject(error);
                    }
                });
            });
        } catch (error) {
            cleanup();
            throw error;
        }
    }

    /**
     * Cleans up resources and terminates the worker.
     * Should be called when the WorkerManager is no longer needed.
     */
    dispose() {
        this.#clearAllTimeouts();
        if (this.worker) {
            this.worker.postMessage({ type: 'shutdown' });
            this.worker.terminate();
            this.worker = null;
        }
        this.isInitialized = false;
        this.pendingOperations.clear();
        this.responseHandlers.clear();
        this.operationTimeouts.clear();
    }

    handleWorkerMessage(event) {
        const { operationId, result, error } = event.data;
        const handler = this.pendingOperations.get(operationId);
        
        if (!handler) {
            console.warn(`Received response for unknown operation: ${operationId}`, {
                knownOperations: Array.from(this.pendingOperations.keys())
            });
            return;
        }

        this.pendingOperations.delete(operationId);
        
        if (error) {
            handler.reject(new Error(error));
        } else {
            handler.resolve(result);
        }
    }

    handleMessageError(event) {
        const errorInfo = {
            type: event.type,
            timestamp: new Date().toISOString(),
            workerState: this.isInitialized ? 'initialized' : 'uninitialized'
        };
        console.error('Worker message error:', errorInfo);
        this.handleWorkerError(new Error('Invalid message format'));
    }

    handleMessageError(event) {
        console.error('Worker message error:', event);
        this.handleWorkerError(new Error('Invalid message format'));
    }

    handleOperationTimeout(operationId) {
        const handler = this.responseHandlers.get(operationId);
        if (handler) {
            handler.reject(new Error('Operation timeout'));
            this.responseHandlers.delete(operationId);
            this.pendingOperations.delete(operationId);
        }
    }

    // Private methods
    async #initializeWorker() {
        this.worker = new Worker('/js/logWorker.js');
        this.#attachEventListeners();
    }

    async #cleanup() {
        this.#detachEventListeners();
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.isInitialized = false;
    }

    #attachEventListeners() {
        this.messageHandler = this.handleWorkerMessage.bind(this);
        this.errorHandler = this.handleWorkerError.bind(this);
        this.messageErrorHandler = this.handleMessageError.bind(this);
        this.worker.addEventListener('message', this.messageHandler);
        this.worker.addEventListener('error', this.errorHandler);
        this.worker.addEventListener('messageerror', this.messageErrorHandler);
    }

    #detachEventListeners() {
        if (this.worker && this.messageHandler && this.errorHandler) {
            this.worker.removeEventListener('message', this.messageHandler);
            this.worker.removeEventListener('error', this.errorHandler);
            this.worker.removeEventListener('messageerror', this.messageErrorHandler);
        }
    }

    #testWorker() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Worker test timeout')), 5000);
            
            const errorHandler = (error) => {
                cleanup();
                reject(error);
            };

            const handler = (e) => {
                if (e.data.type === 'test') {
                    if (e.data.success) {
                        cleanup();
                        resolve();
                    } else {
                        cleanup();
                        reject(new Error('Worker test failed'));
                    }
                }
            };

            const cleanup = () => {
                clearTimeout(timeout);
                this.worker.removeEventListener('message', handler);
                this.worker.removeEventListener('error', errorHandler);
            };

            this.worker.addEventListener('message', handler);
            this.worker.addEventListener('error', errorHandler);
            this.worker.postMessage({ type: 'test' });
        });
    }

    #setOperationTimeout(operationId) {
        const timeout = setTimeout(() => {
            this.handleOperationTimeout(operationId);
        }, 30000);
        this.operationTimeouts.set(operationId, timeout);
    }

    #clearOperationTimeout(operationId) {
        const timeout = this.operationTimeouts.get(operationId);
        if (timeout) {
            clearTimeout(timeout);
            this.operationTimeouts.delete(operationId);
        }
    }

    #clearAllTimeouts() {
        for (const timeout of this.operationTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.operationTimeouts.clear();
    }
}
