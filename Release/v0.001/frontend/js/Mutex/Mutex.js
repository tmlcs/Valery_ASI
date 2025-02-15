import { Validation } from '../Validation/Validation';

export class Mutex {
    #locked = false;
    #queue = [];
    #disposed = false;
    #timeoutMs;
    #lockTime = null;
    #owner = null;
    #lockId = 0;
    #currentLockId = null;
    #activeTimeouts = new Map();

    constructor(options = {}) {
        const opts = Object.assign({ timeout: 30000 }, options);
        Validation.validateObject(opts, 'options');
        Validation.validateTimeoutValue(opts.timeout, 'options.timeout');
        this.#timeoutMs = opts.timeout;
    }

    async acquire(owner = null) {
        if (this.#disposed) {
            throw new Error('Mutex has been disposed');
        }

        return new Promise((resolve, reject) => {
            const lockId = ++this.#lockId;
            const enqueuedAt = Date.now();

            const cleanup = () => {
                this.#clearTimeout(lockId);
                this.#activeTimeouts.delete(lockId);
            };

            const timeoutId = setTimeout(() => {
                this.#handleTimeout(lockId);
            }, this.#timeoutMs);

            this.#activeTimeouts.set(lockId, timeoutId);

            const queueItem = {
                resolve: () => {
                    if (this.#disposed) {
                        cleanup();
                        reject(new Error('Mutex has been disposed'));
                        return;
                    }
                    cleanup();
                    this.#locked = true;
                    this.#lockTime = Date.now();
                    this.#owner = owner;
                    this.#currentLockId = lockId;
                    resolve({
                        release: () => this.#release(lockId),
                        isLocked: () => this.isLocked(),
                        getLockTime: () => this.#lockTime,
                        getLockId: () => lockId
                    });
                },
                reject: (error) => {
                    cleanup();
                    reject(error);
                },
                owner,
                lockId,
                enqueuedAt
            };

            if (!this.#locked && this.#queue.length === 0) {
                queueItem.resolve();
            } else {
                this.#queue.push(queueItem);
                this.#cleanExpiredQueueItems();
            }
        });
    }

    #handleTimeout(lockId) {
        const index = this.#queue.findIndex(x => x.lockId === lockId);
        if (index !== -1) {
            const item = this.#queue.splice(index, 1)[0];
            this.#activeTimeouts.delete(lockId);
            
            // Usar Promise.resolve para garantizar ejecución asíncrona
            Promise.resolve().then(() => {
                item.reject(new Error('Mutex acquisition timeout'));
                this.#processNextInQueue();
            });
        }
    }

    #clearTimeout(lockId) {
        const timeoutId = this.#activeTimeouts.get(lockId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.#activeTimeouts.delete(lockId);
        }
    }

    #cleanExpiredQueueItems() {
        const now = Date.now();
        const expired = [];
        
        // Identificar elementos expirados de manera más eficiente
        this.#queue = this.#queue.filter((item, index) => {
            const isExpired = (now - item.enqueuedAt) >= this.#timeoutMs;
            if (isExpired) {
                this.#clearTimeout(item.lockId);
                item.reject(new Error('Mutex acquisition timeout'));
                return false;
            }
            return true;
        });
    }

    #processNextInQueue() {
        if (this.#disposed || this.#locked) return;

        while (this.#queue.length > 0 && !this.#locked) {
            const nextItem = this.#queue.shift();
            if (nextItem) {
                nextItem.resolve();
                break;
            }
        }
    }

    #release(lockId) {
        if (this.#disposed) {
            throw new Error('Mutex has been disposed');
        }

        if (!this.#locked) {
            throw new Error('Mutex is not locked');
        }

        if (!lockId || lockId !== this.#currentLockId) {
            throw new Error('Invalid lock release attempt');
        }

        const previousOwner = this.#owner;
        this.#locked = false;
        this.#lockTime = null;
        this.#owner = null;
        this.#currentLockId = null;
        
        // Notificar cambio de estado antes de procesar siguiente
        this.#notifyStateChange(previousOwner);
        
        setImmediate(() => this.#processNextInQueue());
    }

    // El método público release debe aceptar un lockId
    release(lockId) {
        if (!this.#locked) {
            throw new Error('Mutex is not locked');
        }
        this.#release(lockId);
    }

    isLocked() {
        return this.#locked;
    }

    getQueueLength() {
        return this.#queue.length;
    }

    getLockDuration() {
        if (!this.#lockTime) return 0;
        return Date.now() - this.#lockTime;
    }

    async withLock(callback) {
        const lock = await this.acquire();
        try {
            return await callback();
        } finally {
            lock.release();
        }
    }

    dispose() {
        if (this.#disposed) {
            return;
        }
        
        this.#disposed = true;
        this.#locked = false;
        this.#lockTime = null;
        this.#owner = null;
        
        // Limpiar todos los timeouts activos
        for (const [lockId, timeoutId] of this.#activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this.#activeTimeouts.clear();
        
        // Rechazar todas las promesas pendientes
        while (this.#queue.length > 0) {
            const item = this.#queue.shift();
            item.reject(new Error('Mutex has been disposed'));
        }
    }

    static async all(mutexes) {
        const releases = await Promise.all(
            mutexes.map(mutex => mutex.acquire())
        );
        return {
            release: () => releases.forEach(r => r.release())
        };
    }

    static async race(mutexes) {
        if (!Array.isArray(mutexes) || mutexes.length === 0) {
            throw new Error('Invalid mutex array');
        }
        
        try {
            return await Promise.race(
                mutexes.map(mutex => mutex.acquire())
            );
        } catch (error) {
            throw new Error('Failed to acquire any mutex: ' + error.message);
        }
    }

    // Nuevos métodos de inspección
    getOwner() {
        return this.#owner;
    }

    getLockId() {
        return this.#lockId;
    }

    getQueueInfo() {
        // Ensure timeouts don't interfere with queue info retrieval
        this.#cleanExpiredQueueItems();
        return this.#queue.map(({ owner, lockId, enqueuedAt }) => ({
            owner,
            lockId,
            enqueuedAt,
            waitTime: Date.now() - enqueuedAt
        }));
    }

    getState() {
        return {
            isLocked: this.#locked,
            lockDuration: this.getLockDuration(),
            owner: this.#owner,
            lockId: this.#lockId,
            queueLength: this.#queue.length,
            isDisposed: this.#disposed
        };
    }

    isDisposed() {
        return this.#disposed;
    }

    // Nuevo método para notificar cambios de estado
    #notifyStateChange(previousOwner) {
    }
}
