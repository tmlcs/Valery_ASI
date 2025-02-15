import { Mutex } from '../Mutex/Mutex';
import { Validation } from '../Validation/Validation';

export class LoggerMetrics {
    #metrics;
    #mutex;
    #disposed = false;

    constructor() {
        this.#metrics = {
            totalLogs: 0,
            failedLogs: 0,
            avgProcessingTime: 0,
            bufferUtilization: 0,
            compressionRatio: 0,
            lastCleanup: Date.now()
        };
        this.#mutex = new Mutex({ timeout: 5000 });
    }

    async trackLogEntry(processingTime, size = 0, compressedSize = 0) {
        if (this.#disposed) {
            throw new Error('LoggerMetrics has been disposed');
        }

        Validation.validatePositiveNumber(processingTime, 'processingTime');
        Validation.validateNonNegativeInteger(size, 'size');
        Validation.validateNonNegativeInteger(compressedSize, 'compressedSize');

        if (processingTime > Number.MAX_SAFE_INTEGER) {
            throw new Error('Processing time exceeds maximum safe value');
        }

        if (compressedSize > size) {
            throw new Error('Compressed size cannot be larger than original size');
        }

        let lock = null;
        try {
            lock = await this.#mutex.acquire();

            // Prevenir overflow
            if (this.#metrics.totalLogs >= Number.MAX_SAFE_INTEGER - 1) {
                await this.#resetMetrics();
            }

            // Actualizar métricas
            this.#metrics.totalLogs++;
            const oldTotal = this.#metrics.avgProcessingTime * (this.#metrics.totalLogs - 1);
            this.#metrics.avgProcessingTime = (oldTotal + processingTime) / this.#metrics.totalLogs;
            
            if (size > 0) {
                this.#metrics.compressionRatio = (size - compressedSize) / size;
            }

            await this.#cleanupIfNeeded();
        } finally {
            if (lock) {
                lock.release();
            }
        }
    }

    async #resetMetrics() {
        this.#metrics = {
            totalLogs: 0,
            failedLogs: 0,
            avgProcessingTime: 0,
            bufferUtilization: 0,
            compressionRatio: 0,
            lastCleanup: Date.now()
        };
    }

    async #cleanupIfNeeded() {
        const now = Date.now();
        if (now - this.#metrics.lastCleanup > 3600000) {
            this.#metrics.lastCleanup = now;
            if (this.#metrics.totalLogs > Number.MAX_SAFE_INTEGER - 1000) {
                await this.#resetMetrics();
            }
        }
    }

    getMetrics() {
        if (this.#disposed) {
            throw new Error('LoggerMetrics has been disposed');
        }
        return { ...this.#metrics };
    }

    dispose() {
        this.#disposed = true;
        this.#mutex = null;
        this.#metrics = null;
    }
}
