import { jest } from '@jest/globals';
import { Mutex } from '../Mutex';

describe('Mutex', () => {
    let mutex;

    beforeEach(() => {
        mutex = new Mutex({ timeout: 1000 });
    });

    afterEach(() => {
        if (mutex && !mutex.isDisposed()) {
            mutex.dispose();
        }
    });

    test('initializes in unlocked state', () => {
        expect(mutex.isLocked()).toBe(false);
        expect(mutex.getQueueLength()).toBe(0);
    });

    test('acquires and releases lock correctly', async () => {
        const lock = await mutex.acquire();
        expect(mutex.isLocked()).toBe(true);
        
        lock.release();
        expect(mutex.isLocked()).toBe(false);
    });

    test('handles timeout correctly', async () => {
        const testMutex = new Mutex({ timeout: 2000 });
        const lock1 = await testMutex.acquire();
        
        await expect(testMutex.acquire()).rejects.toThrow('Mutex acquisition timeout');
        
        lock1.release(lock1.getLockId());
        testMutex.dispose();
    }, 3000);

    test('maintains FIFO order', async () => {
        // Crear un mutex con timeout más largo para este test específico
        const testMutex = new Mutex({ timeout: 5000 });
        const order = [];
        
        // Adquirir el primer lock
        const lock1 = await testMutex.acquire();
        
        // Crear las promesas de adquisición subsecuentes
        const promise2 = testMutex.acquire().then(lock => {
            order.push(2);
            lock.release();
        });
        
        const promise3 = testMutex.acquire().then(lock => {
            order.push(3);
            lock.release();
        });
        
        // Asegurar que las promesas están en cola
        await new Promise(resolve => setTimeout(resolve, 100));
        
        order.push(1);
        lock1.release();
        
        // Esperar a que todas las operaciones se completen
        await Promise.all([promise2, promise3]);
        
        expect(order).toEqual([1, 2, 3]);
    }, 6000); // Aumentar el timeout del test

    test('withLock executes and releases correctly', async () => {
        const result = await mutex.withLock(async () => {
            expect(mutex.isLocked()).toBe(true);
            return 'test';
        });
        
        expect(result).toBe('test');
        expect(mutex.isLocked()).toBe(false);
    });

    test('handles errors in withLock', async () => {
        await expect(mutex.withLock(async () => {
            throw new Error('Test error');
        })).rejects.toThrow('Test error');
        
        expect(mutex.isLocked()).toBe(false);
    });

    test('static all acquires multiple locks', async () => {
        const mutex1 = new Mutex();
        const mutex2 = new Mutex();
        
        const release = await Mutex.all([mutex1, mutex2]);
        
        expect(mutex1.isLocked()).toBe(true);
        expect(mutex2.isLocked()).toBe(true);
        
        release.release();
        
        expect(mutex1.isLocked()).toBe(false);
        expect(mutex2.isLocked()).toBe(false);
    });

    test('static race acquires first available lock', async () => {
        const mutex1 = new Mutex();
        const mutex2 = new Mutex();
        
        const lock1 = await mutex1.acquire();
        const release = await Mutex.race([mutex1, mutex2]);
        
        expect(mutex2.isLocked()).toBe(true);
        
        release.release();
        lock1.release();
    });

    // Nuevos tests después del último test existente
    
    test('constructor validates timeout parameter', () => {
        expect(() => new Mutex({ timeout: -1 })).toThrow('options.timeout must be an integer >= 100ms');
        expect(() => new Mutex({ timeout: 1000 })).not.toThrow();
    });

    test('acquire rejects when mutex is disposed', async () => {
        mutex.dispose();
        await expect(mutex.acquire()).rejects.toThrow('Mutex has been disposed');
    });

    test('release throws when mutex is not locked', () => {
        expect(() => mutex.release()).toThrow('Mutex is not locked');
    });

    test('release throws when mutex is disposed', async () => {
        const lock = await mutex.acquire();
        mutex.dispose();
        expect(() => lock.release()).toThrow('Mutex has been disposed');
    });

    test('dispose can be called multiple times', () => {
        mutex.dispose();
        expect(() => mutex.dispose()).not.toThrow();
    });

    test('getLockDuration returns 0 when not locked', () => {
        expect(mutex.getLockDuration()).toBe(0);
    });

    test('getLockDuration returns positive number when locked', async () => {
        const lock = await mutex.acquire();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(mutex.getLockDuration()).toBeGreaterThan(0);
        lock.release();
    });

    test('static race throws when all mutexes fail', async () => {
        const mutex1 = new Mutex({ timeout: 100 });
        const mutex2 = new Mutex({ timeout: 100 });
        
        // Lock both mutexes
        await mutex1.acquire();
        await mutex2.acquire();
        
        // Try to race for already locked mutexes
        await expect(Mutex.race([mutex1, mutex2])).rejects.toThrow('Failed to acquire any mutex');
    });

    test('acquire throws with invalid timeout', () => {
        expect(() => new Mutex({ timeout: -1 })).toThrow('options.timeout must be an integer >= 100ms');
        expect(() => new Mutex({ timeout: 99 })).toThrow('options.timeout must be an integer >= 100ms');
    });

    test('static race throws with invalid input', async () => {
        await expect(Mutex.race([])).rejects.toThrow('Invalid mutex array');
        await expect(Mutex.race(null)).rejects.toThrow('Invalid mutex array');
    });

    // Agregar después del último test
    test('handles queue cleanup on timeout', async () => {
        const testMutex = new Mutex({ timeout: 100 });
        const lock1 = await testMutex.acquire();
        
        // Intentar adquirir cuando ya está bloqueado
        const acquirePromise = testMutex.acquire();
        
        // Esperar a que el timeout ocurra
        await expect(acquirePromise).rejects.toThrow('Mutex acquisition timeout');
        
        // Verificar que la cola se limpió
        expect(testMutex.getQueueLength()).toBe(0);
        
        lock1.release();
    });

    test('queue management works correctly', async () => {
        const testMutex = new Mutex({ timeout: 5000 }); // Incrementar timeout
        const lock1 = await testMutex.acquire();
        
        // Agregar múltiples solicitudes a la cola
        const promise1 = testMutex.acquire().then(lock => {
            return new Promise(resolve => {
                setTimeout(() => {
                    lock.release();
                    resolve();
                }, 100);
            });
        });
        
        const promise2 = testMutex.acquire().then(lock => {
            return new Promise(resolve => {
                setTimeout(() => {
                    lock.release();
                    resolve();
                }, 100);
            });
        });
        
        expect(testMutex.getQueueLength()).toBe(2);
        
        // Liberar el lock inicial
        lock1.release();
        
        // Esperar a que se completen todas las operaciones
        await Promise.all([promise1, promise2]);
        
        // Verificar que la cola está vacía al final
        expect(testMutex.getQueueLength()).toBe(0);
    }, 10000); // Incrementar el timeout del test

    test('tracks lock owner correctly', async () => {
        const owner = { id: 'test-owner' };
        const lock = await mutex.acquire(owner);
        
        expect(mutex.getOwner()).toBe(owner);
        expect(mutex.isLocked()).toBe(true);
        
        lock.release();
        expect(mutex.getOwner()).toBeNull();
    });

    test('prevents unauthorized release', async () => {
        const mutex = new Mutex({ timeout: 5000 }); // Aumentar timeout
        const lock = await mutex.acquire('owner1');
        
        // Intentar liberar con un ID incorrecto
        expect(() => mutex.release(999999)).toThrow('Invalid lock release attempt');
        
        // La liberación correcta debe funcionar
        expect(() => lock.release()).not.toThrow();
        expect(mutex.isLocked()).toBe(false);
    }, 6000);

    test('provides detailed queue information', async () => {
        const mutex = new Mutex({ timeout: 5000 }); // Aumentar timeout
        
        // Acquire initial lock
        const lock1 = await mutex.acquire('owner1');
        
        // Create pending acquire requests without awaiting them
        const acquire2Promise = mutex.acquire('owner2');
        const acquire3Promise = mutex.acquire('owner3');
        
        // Give time for queue to populate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check queue info
        const queueInfo = mutex.getQueueInfo();
        expect(queueInfo.length).toBe(2);
        expect(queueInfo[0].owner).toBe('owner2');
        expect(queueInfo[1].owner).toBe('owner3');
        
        // Release first lock and resolve pending promises
        lock1.release();
        const [lock2, lock3] = await Promise.all([acquire2Promise, acquire3Promise]);
        
        lock2.release();
        lock3.release();
        
        // Final verification
        expect(mutex.getQueueLength()).toBe(0);
        expect(mutex.isLocked()).toBe(false);
    }, 6000); // Increase test timeout

    test('provides complete mutex state', async () => {
        const lock = await mutex.acquire('owner1');
        
        const state = mutex.getState();
        expect(state).toEqual(expect.objectContaining({
            isLocked: true,
            owner: 'owner1',
            lockId: expect.any(Number),
            queueLength: 0,
            isDisposed: false
        }));
        
        lock.release();
    });

    test('lock ids increment correctly', async () => {
        const lock1 = await mutex.acquire();
        const id1 = mutex.getLockId();
        lock1.release();
        
        const lock2 = await mutex.acquire();
        const id2 = mutex.getLockId();
        
        expect(id2).toBeGreaterThan(id1);
        lock2.release();
    });

    test('should handle invalid lock release', async () => {
        const mutex = new Mutex();
        const lockId1 = await mutex.acquire();
        
        expect(() => mutex.release(lockId1 + 999)).toThrow('Invalid lock release attempt');
    });

    test('handles concurrent acquisitions correctly', async () => {
        const mutex = new Mutex({ timeout: 5000 });
        const results = [];
        
        const promises = Array(10).fill().map(async (_, i) => {
            const lock = await mutex.acquire(`owner${i}`);
            results.push(i);
            await new Promise(r => setTimeout(r, 50));
            lock.release(lock.getLockId());
        });
        
        await Promise.all(promises);
        
        expect(results.length).toBe(10);
        expect(new Set(results).size).toBe(10);
        mutex.dispose();
    }, 10000);

    test('cleanup after dispose is complete', async () => {
        const mutex = new Mutex();
        const lock = await mutex.acquire();
        
        mutex.dispose();
        
        expect(mutex.isLocked()).toBe(false);
        expect(mutex.getQueueLength()).toBe(0);
        expect(mutex.getOwner()).toBeNull();
        expect(() => lock.release()).toThrow('Mutex has been disposed');
    });

    test('handles high concurrency load', async () => {
        const mutex = new Mutex({ timeout: 5000 });
        const iterations = 100;
        const results = [];
        const errors = [];

        const promises = Array(iterations).fill().map(async (_, i) => {
            try {
                const lock = await mutex.acquire(`owner${i}`);
                results.push(i);
                await new Promise(r => setTimeout(r, Math.random() * 10));
                lock.release();
            } catch (e) {
                errors.push(e);
            }
        });

        await Promise.all(promises);

        expect(errors.length).toBe(0);
        expect(results.length).toBe(iterations);
        expect(new Set(results).size).toBe(iterations);
        expect(mutex.isLocked()).toBe(false);
        expect(mutex.getQueueLength()).toBe(0);
    }, 10000);

    test('handles rapid acquire/release cycles', async () => {
        const mutex = new Mutex({ timeout: 5000 });
        const cycles = 50;
        let successCount = 0;

        for (let i = 0; i < cycles; i++) {
            const lock = await mutex.acquire();
            expect(mutex.isLocked()).toBe(true);
            lock.release();
            expect(mutex.isLocked()).toBe(false);
            successCount++;
        }

        expect(successCount).toBe(cycles);
        expect(mutex.getQueueLength()).toBe(0);
    }, 10000);

    test('maintains queue order under stress', async () => {
        const mutex = new Mutex({ timeout: 5000 });
        const orderCheck = [];
        const lock1 = await mutex.acquire('first');
        
        // Crear múltiples solicitudes concurrentes
        const promises = Array(5).fill().map((_, i) => 
            mutex.acquire(`concurrent${i}`).then(lock => {
                orderCheck.push(i);
                return lock;
            })
        );

        // Dar tiempo para que se encolen todas las solicitudes
        await new Promise(r => setTimeout(r, 100));
        
        // Liberar el lock inicial
        lock1.release();
        
        // Esperar y liberar los locks en orden
        const locks = await Promise.all(promises);
        for (const lock of locks) {
            await new Promise(r => setTimeout(r, 10));
            lock.release();
        }

        // Verificar que el orden se mantuvo
        expect(orderCheck).toEqual([0,1,2,3,4]);
    }, 10000);
});
