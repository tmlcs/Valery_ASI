
import { Validation } from '../Validation/Validation';

export class CircuitBreaker {
    #state = 'CLOSED';
    #fn;
    #failureThreshold;
    #failureCount = 0;
    #lastFailureTime = null;
    #recoveryTimeout;
    #operationTimeout;
    #recoveryTimer = null;
    #operationTimer = null;
    #disposed = false;

    constructor(fn, options = {}) {
        Validation.validateFunction(fn, 'fn');
        
        const opts = {
            failureThreshold: 3,
            recoveryTimeout: 5000,
            operationTimeout: 10000,
            ...options
        };

        Validation.validateObject(opts, 'options');
        Validation.validatePositiveInteger(opts.failureThreshold, 'options.failureThreshold');
        Validation.validateTimeoutValue(opts.recoveryTimeout, 'options.recoveryTimeout');
        Validation.validateTimeoutValue(opts.operationTimeout, 'options.operationTimeout');

        this.#fn = fn;
        this.#failureThreshold = opts.failureThreshold;
        this.#recoveryTimeout = opts.recoveryTimeout;
        this.#operationTimeout = opts.operationTimeout;
    }

    async execute(...args) {
        if (this.#disposed) {
            throw new Error('Circuit breaker has been disposed');
        }

        switch (this.#state) {
            case 'OPEN':
                if (Date.now() - this.#lastFailureTime >= this.#recoveryTimeout) {
                    this.#state = 'HALF_OPEN';
                } else {
                    throw new Error('Circuit breaker is OPEN');
                }
                break;
            case 'DISPOSED':
                throw new Error('Circuit breaker has been disposed');
        }

        try {
            // Implementar timeout de operación usando Promise.race
            const timeoutPromise = new Promise((_, reject) => {
                this.#operationTimer = setTimeout(() => {
                    reject(new Error('Operation timeout'));
                }, this.#operationTimeout);
            });

            const result = await Promise.race([
                this.#fn(...args),
                timeoutPromise
            ]);

            // Limpiar el timer de operación
            if (this.#operationTimer) {
                clearTimeout(this.#operationTimer);
                this.#operationTimer = null;
            }

            // Resetear estado después de una ejecución exitosa
            if (this.#state === 'HALF_OPEN') {
                this.#state = 'CLOSED';
            }
            this.#failureCount = 0;
            this.#lastFailureTime = null;

            return result;

        } catch (error) {
            // Limpiar el timer de operación en caso de error
            if (this.#operationTimer) {
                clearTimeout(this.#operationTimer);
                this.#operationTimer = null;
            }

            this.#failureCount++;
            this.#lastFailureTime = Date.now();

            if (this.#failureCount >= this.#failureThreshold) {
                this.#state = 'OPEN';
                this.#scheduleRecovery();
            }

            throw error;
        }
    }

    #scheduleRecovery() {
        if (this.#recoveryTimer) {
            clearTimeout(this.#recoveryTimer);
        }

        this.#recoveryTimer = setTimeout(() => {
            if (!this.#disposed && this.#state === 'OPEN') {
                this.#state = 'HALF_OPEN';
            }
        }, this.#recoveryTimeout);
    }

    dispose() {
        this.#disposed = true;
        this.#state = 'DISPOSED';
        
        if (this.#recoveryTimer) {
            clearTimeout(this.#recoveryTimer);
            this.#recoveryTimer = null;
        }
        
        if (this.#operationTimer) {
            clearTimeout(this.#operationTimer);
            this.#operationTimer = null;
        }

        this.#fn = null;
    }

    getState() {
        return this.#state;
    }

    getStats() {
        return {
            state: this.#state,
            failureCount: this.#failureCount,
            lastFailureTime: this.#lastFailureTime,
            isDisposed: this.#disposed
        };
    }

    // Métodos para testing
    forceOpen() {
        if (!this.#disposed) {
            this.#state = 'OPEN';
            this.#lastFailureTime = Date.now();
        }
    }

    forceHalfOpen() {
        if (!this.#disposed) {
            this.#state = 'HALF_OPEN';
        }
    }

    get state() {
        return this.#state;
    }
}

export default CircuitBreaker;
