import { WorkerManager } from './WorkerManager';
import { LogFormatter } from './LogFormatter';
import { LogBuffer } from './LogBuffer';
import { LogValidators } from './LogValidators';
import { LoggerMetrics } from './LoggerMetrics';
import { CircuitBreaker } from '../CircuitBreaker/CircuitBreaker';
import { RateLimiter } from '../RateLimiter/RateLimiter';

/**
 * Core logging functionality that coordinates log processing, formatting, and buffering.
 * @example
 * const logger = new LoggerCore({ bufferSize: 200 });
 * await logger.info('User logged in', { userId: '123' });
 */
export class LoggerCore {
    #initializationPromise = null;

    /**
     * @param {Object} options - Configuration options
     * @param {number} [options.bufferSize=100] - Maximum number of logs to buffer
     * @param {number} [options.workerTimeout=30000] - Worker operation timeout in ms
     * @param {number} [options.retryAttempts=3] - Number of retry attempts for failed operations
     * @param {Object} [options.circuitBreaker] - Circuit breaker options
     * @param {Object} [options.rateLimiter] - Rate limiter options
     */
    constructor(options = {}) {
        this.validLogLevels = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);
        this.options = this.validateOptions(options);
        this.formatter = new LogFormatter();
        this.buffer = new LogBuffer(options.bufferSize);
        this.validators = new LogValidators();
        this.workerManager = new WorkerManager();
        this.metrics = new LoggerMetrics();
        this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
        this.rateLimiter = new RateLimiter(options.rateLimiter);
        
        // Initialize managers
        this.#initializationPromise = this.initializeManagers();
    }

    validateOptions(options) {
        const defaults = {
            bufferSize: 100,
            workerTimeout: 30000,
            retryAttempts: 3
        };
        
        if (options.bufferSize !== undefined) {
            if (!Number.isInteger(options.bufferSize) || options.bufferSize <= 0) {
                throw new Error('bufferSize must be a positive integer');
            }
        }
        if (options.workerTimeout !== undefined) {
            if (!Number.isInteger(options.workerTimeout) || options.workerTimeout < 1000) {
                throw new Error('workerTimeout must be an integer >= 1000ms');
            }
        }
        if (options.retryAttempts !== undefined) {
            if (!Number.isInteger(options.retryAttempts) || options.retryAttempts < 0) {
                throw new Error('retryAttempts must be a non-negative integer');
            }
        }
        
        return { ...defaults, ...options };
    }

    async initializeManagers() {
        const controller = new AbortController();
        const signal = controller.signal;
        
        try {
            await Promise.race([
                this._initializeWithRetry(signal),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        controller.abort();
                        reject(new Error('Initialization timeout'));
                    }, this.options.workerTimeout)
                )
            ]);
        } finally {
            controller.abort();
        }
    }

    async _initializeWithRetry(signal) {
        const maxRetries = 3;
        const timeout = 30000;
        let attempts = 0;

        const initAttempt = async () => {
            try {
                await Promise.race([
                    this.workerManager.initialize(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Initialization timeout')), timeout)
                    )
                ]);
                this.buffer.onFlush(batch => this.workerManager.processBatch(batch));
                this.isInitialized = true;
                return true;
            } catch (error) {
                attempts++;
                if (attempts >= maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.min(attempts, 5)));
                return false;
            }
        };

        while (attempts < maxRetries && !signal.aborted) {
            if (await initAttempt()) break;
        }

        if (!this.isInitialized) {
            await this.cleanup();
        }
    }

    async cleanup() {
        const cleanupPromises = [];
        if (this.buffer) {
            cleanupPromises.push(this.buffer.dispose().catch(console.error));
        }
        if (this.workerManager) {
            cleanupPromises.push(this.workerManager.dispose().catch(console.error));
        }
        await Promise.allSettled(cleanupPromises);
    }

    #validateContext(context) {
        // Añadir límite de tamaño
        const maxContextSize = 1024 * 1024; // 1MB
        if (new TextEncoder().encode(JSON.stringify(context)).length > maxContextSize) {
            throw new Error('Context size exceeds maximum allowed size');
        }

        if (context === null || typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be a non-null object');
        }
        // Validar profundidad máxima y circular references
        const seen = new WeakSet();
        const validateObject = (obj, depth = 0) => {
            if (depth > 10) throw new Error('Context object too deep');
            if (seen.has(obj)) throw new Error('Circular reference detected in context');
            seen.add(obj);
            for (const value of Object.values(obj)) {
                if (typeof value === 'object' && value !== null) {
                    validateObject(value, depth + 1);
                }
            }
        };
        validateObject(context);

        // Añadir validación de tipos de datos permitidos
        const validateValue = (value) => {
            if (value === undefined) {
                throw new Error('Context values cannot be undefined');
            }
            // Añadir validación para null
            if (value === null) {
                throw new Error('Context values cannot be null');
            }
            const type = typeof value;
            if (!['string', 'number', 'boolean', 'object'].includes(type)) {
                throw new Error(`Invalid value type in context: ${type}`);
            }
            if (value instanceof Date) {
                return true;
            }
            if (value instanceof Error) {
                return true;
            }
        };

        Object.values(context).forEach(validateValue);
    }

    /**
     * Logs a message with the specified level and context.
     * @param {('DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL')} level - Log level
     * @param {string} message - Log message
     * @param {Object} [context={}] - Additional context data
     * @throws {Error} If the log level is invalid or logger is not initialized
     */
    async log(level, message, context = {}) {
        const logPromise = Promise.race([
            this._innerLog(level, message, context),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Log operation timeout')), this.options.workerTimeout)
            )
        ]);

        try {
            await logPromise;
        } catch (error) {
            console.error('Logging failed:', error);
            throw error;
        }
    }

    async _innerLog(level, message, context) {
        const timeoutId = setTimeout(() => {
            throw new Error('Log operation timeout');
        }, this.options.workerTimeout);

        try {
            await this.rateLimiter.checkLimit();
            
            const start = performance.now();
            try {
                await this.circuitBreaker.execute(async () => {
                    await this.#initializationPromise;

                    if (!message && message !== '') {
                        throw new Error('Message is required');
                    }

                    if (this.workerManager.worker && !this.workerManager.worker.active) {
                        await this.initializeManagers();
                    }

                    // Validar tamaño del mensaje
                    if (message.length > 10000) {
                        throw new Error('Message too long (max 10000 characters)');
                    }

                    // Validar tipos estrictamente
                    if (Object.prototype.toString.call(context) !== '[object Object]') {
                        throw new Error('Context must be a plain object');
                    }

                    this.#validateContext(context);

                    if (!this.validLogLevels.has(level)) {
                        throw new Error(`Invalid log level: ${level}`);
                    }

                    if (typeof message !== 'string') {
                        throw new Error('Message must be a string');
                    }

                    if (typeof context !== 'object' || Array.isArray(context)) {
                        throw new Error('Context must be an object');
                    }

                    if (!this.workerManager.isInitialized) {
                        throw new Error('Logger not initialized');
                    }

                    try {
                        const logEntry = this.formatter.format(level, message, context);
                        if (this.validators.validateLogEntry(logEntry)) {
                            try {
                                await this.buffer.add(logEntry);
                            } catch (error) {
                                if (error.message === 'Buffer full and flush failed') {
                                    console.warn('Log buffer full, message dropped:', logEntry);
                                    return;
                                }
                                throw error;
                            }
                        }
                    } catch (error) {
                        console.error('Logging failed:', error);
                    }
                });
                
                const end = performance.now();
                this.metrics.trackLogEntry(end - start);
            } catch (error) {
                this.metrics.failedLogs++;
                throw error;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Public API methods
    async flush() {
        await this.buffer.flush();
    }

    async dispose() {
        try {
            if (this.#initializationPromise) {
                await Promise.race([
                    this.#initializationPromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Dispose timeout')), 5000)
                    )
                ]);
            }
            await this.buffer.flush();
        } catch (error) {
            console.error('Error during disposal:', error);
        } finally {
            await this.cleanup();
        }
    }

    // Convenience methods
    debug(message, context) { 
        if (typeof message !== 'string') {
            throw new Error('Message must be a string');
        }
        if (typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be an object');
        }
        return this.log('DEBUG', message, context); 
    }
    info(message, context) { 
        if (typeof message !== 'string') {
            throw new Error('Message must be a string');
        }
        if (typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be an object');
        }
        return this.log('INFO', message, context); 
    }
    warn(message, context) { 
        if (typeof message !== 'string') {
            throw new Error('Message must be a string');
        }
        if (typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be an object');
        }
        return this.log('WARN', message, context); 
    }
    error(message, context) { 
        if (typeof message !== 'string') {
            throw new Error('Message must be a string');
        }
        if (typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be an object');
        }
        return this.log('ERROR', message, context); 
    }
    fatal(message, context) { 
        if (typeof message !== 'string') {
            throw new Error('Message must be a string');
        }
        if (typeof context !== 'object' || Array.isArray(context)) {
            throw new Error('Context must be an object');
        }
        return this.log('FATAL', message, context); 
    }
}
