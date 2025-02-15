import { Validation } from '../Validation/Validation';

export class RateLimiter {
    #requests;
    #maxRequests;
    #timeWindow;
    #cleanup;
    #lock = Promise.resolve();

    constructor(maxRequestsOrOptions, timeWindow) {
        // Agregar límite máximo de array
        const MAX_ARRAY_SIZE = 10000;

        // Definir constantes
        const MAX_REQUESTS_LIMIT = 10000;
        const MIN_TIME_WINDOW = 100;
        const MAX_TIME_WINDOW = 3600000; // 1 hora

        // Validación del constructor
        if (typeof maxRequestsOrOptions === 'number') {
            Validation.validatePositiveInteger(maxRequestsOrOptions, 'maxRequests');
            if (maxRequestsOrOptions > MAX_REQUESTS_LIMIT) {
                throw new Error(`maxRequests cannot exceed ${MAX_REQUESTS_LIMIT}`);
            }
            
            if (timeWindow !== undefined) {
                Validation.validateTimeoutValue(timeWindow, 'timeWindow', MIN_TIME_WINDOW, MAX_TIME_WINDOW);
            }
            
            this.#maxRequests = maxRequestsOrOptions;
            this.#timeWindow = timeWindow || 1000;
        } else {
            const options = maxRequestsOrOptions || {};
            Validation.validateObject(options, 'options');
            
            const maxRequests = options.maxRequests || 100;
            Validation.validatePositiveInteger(maxRequests, 'options.maxRequests');
            if (maxRequests > MAX_REQUESTS_LIMIT) {
                throw new Error(`maxRequests cannot exceed ${MAX_REQUESTS_LIMIT}`);
            }
            
            if (options.timeWindow !== undefined) {
                Validation.validateTimeoutValue(options.timeWindow, 'options.timeWindow', MIN_TIME_WINDOW, MAX_TIME_WINDOW);
            }
            
            this.#maxRequests = maxRequests;
            this.#timeWindow = options.timeWindow || 1000;
        }
        
        this.#requests = [];
        this.#cleanup = setInterval(() => this.#cleanupOldRequests(), Math.min(this.#timeWindow, 1000));

        if (this.#requests.length >= MAX_ARRAY_SIZE) {
            this.#cleanupOldRequests();
        }
    }

    async checkLimit() {
        if (!this.#cleanup) {
            throw new Error('RateLimiter has been disposed');
        }
        
        this.#cleanupOldRequests();
        
        if (this.#requests.length >= this.#maxRequests) {
            throw new Error('Rate limit exceeded');
        }
        
        this.#requests.push(Date.now());
        return true;
    }

    async tryAcquire() {
        if (!this.#cleanup) {
            throw new Error('RateLimiter has been disposed');
        }

        // Optimizar la limpieza
        this.#cleanupOldRequests();

        // Verificar límite después de la limpieza
        if (this.#requests.length >= this.#maxRequests) {
            const oldestRequest = this.#requests[0];
            const now = Date.now();
            if (now - oldestRequest < this.#timeWindow) {
                return false;
            }
            // Si el tiempo ha pasado, limpiamos y continuamos
            this.#requests = this.#requests.filter(time => now - time < this.#timeWindow);
        }

        this.#requests.push(Date.now());
        return true;
    }

    // Mejora en limpieza de solicitudes
    #cleanupOldRequests() {
        if (!this.#cleanup) return;
        
        const now = Date.now();
        const cutoff = now - this.#timeWindow;
        
        // Optimización: usar findIndex para mejor rendimiento
        const validIndex = this.#requests.findIndex(time => time > cutoff);
        
        if (validIndex === -1) {
            this.#requests = [];
        } else if (validIndex > 0) {
            this.#requests = this.#requests.slice(validIndex);
        }
    }

    dispose() {
        if (this.#cleanup) {
            clearInterval(this.#cleanup);
            this.#cleanup = null;
        }
        this.#requests = [];
    }

    // Añadir método para monitoreo
    getStats() {
        return {
            currentRequests: this.#requests.length,
            maxRequests: this.#maxRequests,
            timeWindow: this.#timeWindow,
            isDisposed: !this.#cleanup
        };
    }
}
