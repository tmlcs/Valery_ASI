import { jest } from '@jest/globals';
import { WorkerManager } from '../WorkerManager';

describe('WorkerManager', () => {
    let workerManager;

    // Mock TextEncoder if not available
    global.TextEncoder = global.TextEncoder || class {
        encode(str) {
            return {
                length: str.length
            };
        }
    };

    beforeAll(() => {
        if (typeof global.TextEncoder === 'undefined') {
            global.TextEncoder = class {
                encode(str) {
                    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
                }
            };
        }
        // Mejorado MockWorker con todas las funciones necesarias
        global.Worker = class MockWorker {
            constructor() {
                this.listeners = {};
                this.active = true;
            }
            addEventListener(type, callback) {
                if (!this.listeners[type]) {
                    this.listeners[type] = [];
                }
                this.listeners[type].push(callback);
            }
            removeEventListener(type, callback) {
                if (this.listeners[type]) {
                    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
                }
            }
            postMessage(data) {
                if (!this.active) return;
                
                if (data.type === 'test') {
                    this.dispatchEvent('message', { data: { type: 'test', success: true } });
                } else if (data.type === 'process') {
                    setTimeout(() => {
                        this.dispatchEvent('message', { 
                            data: { 
                                operationId: data.operationId,
                                result: 'processed'
                            } 
                        });
                    }, 10);
                }
            }
            terminate() {
                this.active = false;
                this.listeners = {};
            }
            dispatchEvent(type, event) {
                if (this.listeners[type]) {
                    this.listeners[type].forEach(cb => cb(event));
                }
            }
        };

        // Setup jest timers
        jest.useFakeTimers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        workerManager = new WorkerManager();
        
        // Asegurar que el worker existe y guardar postMessage original
        if (workerManager.worker) {
            workerManager._originalPostMessage = workerManager.worker.postMessage.bind(workerManager.worker);
        }
        
        // Llevar registro de todos los listeners añadidos
        workerManager._testListeners = new Set();
        const originalAddEventListener = workerManager.worker?.addEventListener.bind(workerManager.worker);
        if (originalAddEventListener) {
            workerManager.worker.addEventListener = (type, callback) => {
                workerManager._testListeners.add({ type, callback });
                originalAddEventListener(type, callback);
            };
        }
    });

    afterEach(async () => {
        try {
            // Limpiar todos los listeners registrados
            if (workerManager._testListeners) {
                workerManager._testListeners.forEach(({ type, callback }) => {
                    workerManager.worker?.removeEventListener(type, callback);
                });
                workerManager._testListeners.clear();
            }

            // Cleanup del WorkerManager
            if (workerManager) {
                // Asegurar que cualquier operación pendiente se complete o falle
                const cleanupTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Cleanup timeout')), 1000)
                );

                await Promise.race([
                    workerManager.dispose().catch(error => {
                        console.error('Error during dispose:', error);
                        throw error;
                    }),
                    cleanupTimeout
                ]).catch(async error => {
                    console.error('Cleanup error:', error);
                    // Forzar limpieza en caso de error
                    if (workerManager.worker) {
                        workerManager.worker.terminate();
                        workerManager.worker = null;
                    }
                });
            }

            // Restaurar mocks y funciones originales
            if (workerManager._originalPostMessage && workerManager.worker) {
                workerManager.worker.postMessage = workerManager._originalPostMessage;
            }

            // Limpiar timers y mocks
            jest.clearAllMocks();
            jest.clearAllTimers();
        } catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        } finally {
            workerManager = null;
        }
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    test('initialization succeeds', async () => {
        await expect(workerManager.initialize()).resolves.toBeUndefined();
        expect(workerManager.isInitialized).toBe(true);
    });

    test('processBatch handles valid data', async () => {
        await workerManager.initialize();
        const batch = [{ level: 'INFO', message: 'test' }];
        
        const promise = workerManager.processBatch(batch);
        jest.advanceTimersByTime(100);
        
        await expect(promise).resolves.toBe('processed');
    });

    test('handles worker timeout', async () => {
        await workerManager.initialize();
        const batch = [{ level: 'INFO', message: 'test' }];
        
        // Sobrescribir postMessage para simular timeout
        workerManager.worker.postMessage = () => {};
        
        const promise = workerManager.processBatch(batch);
        jest.advanceTimersByTime(31000);
        
        await expect(promise).rejects.toThrow('Operation timeout');
    });

    test('handles invalid message format', async () => {
        await workerManager.initialize();
        const event = new MessageEvent('messageerror', {
            data: 'invalid data'
        });
        workerManager.handleMessageError(event);
        expect(workerManager.isInitialized).toBe(true);
    });

    test('handles worker termination', async () => {
        await workerManager.initialize();
        workerManager.worker.terminate();
        const batch = [{ level: 'INFO', message: 'test' }];
        await expect(workerManager.processBatch(batch)).rejects.toThrow('Worker not initialized');
    });

    test('handles retry logic correctly', async () => {
        await workerManager.initialize();
        
        let attempts = 0;
        const originalPostMessage = workerManager._originalPostMessage;
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        try {
            workerManager.worker.postMessage = function(data) {
                attempts++;
                if (attempts < 3) {
                    this.dispatchEvent('error', new Error('Simulated failure'));
                } else {
                    originalPostMessage.call(this, data);
                }
            };

            const batch = [{ level: 'INFO', message: 'test' }];
            jest.advanceTimersByTime(100);
            
            await expect(workerManager.processBatch(batch)).resolves.toBe('processed');
            expect(attempts).toBe(3);
            expect(errorSpy).toHaveBeenCalledTimes(2);
        } finally {
            errorSpy.mockRestore();
            if (workerManager.worker) {
                workerManager.worker.postMessage = originalPostMessage;
            }
        }
    });

    test('handles worker error events', async () => {
        await workerManager.initialize();
        const errorEvent = new ErrorEvent('error', { error: new Error('Test error') });
        
        // Capturar errores no manejados
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        try {
            workerManager.worker.dispatchEvent('error', errorEvent);
            expect(workerManager.isInitialized).toBe(true);
            expect(errorSpy).toHaveBeenCalled();
        } finally {
            errorSpy.mockRestore();
        }
    });

    test('handles network errors', async () => {
        await workerManager.initialize();
        workerManager.worker.postMessage = () => {
            throw new Error('Network error');
        };
        await expect(workerManager.processBatch([{}])).rejects.toThrow('Network error');
    });

    test('handles messages without operationId gracefully', async () => {
        await workerManager.initialize();
        const message = { data: { type: 'test', result: 'success' } };
        workerManager.handleWorkerMessage(message);
        // Should not throw and should log debug message
    });

    test('handles worker cleanup with pending operations', async () => {
        await workerManager.initialize();
        const batch = [{ level: 'INFO', message: 'test' }];
        
        const processPromise = workerManager.processBatch(batch);
        const disposePromise = workerManager.dispose();
        
        try {
            await expect(Promise.all([processPromise, disposePromise])).resolves.toBeDefined();
        } catch (error) {
            // Asegurar limpieza incluso si la prueba falla
            await workerManager.dispose().catch(console.error);
            throw error;
        }
    });

    // Additional error case tests
    test('handles worker error during initialization', async () => {
        workerManager.worker.postMessage = () => {
            throw new Error('Initialization error');
        };
        await expect(workerManager.initialize()).rejects.toThrow('Initialization error');
    });

    test('handles worker termination during operation', async () => {
        await workerManager.initialize();
        const batch = [{ level: 'INFO', message: 'test' }];
        
        const processPromise = workerManager.processBatch(batch);
        workerManager.worker.terminate();
        
        await expect(processPromise).rejects.toThrow();
    });

    test('handles invalid worker messages', async () => {
        await workerManager.initialize();
        const invalidMessage = { data: null };
        workerManager.handleWorkerMessage(invalidMessage);
        expect(workerManager.isInitialized).toBe(true);
    });

    // Stress tests
    test('handles multiple concurrent operations', async () => {
        await workerManager.initialize();
        const operations = Array.from({ length: 100 }, (_, i) => ({
            level: 'INFO',
            message: `test ${i}`
        }));
        
        const results = await Promise.allSettled(
            operations.map(op => workerManager.processBatch([op]))
        );
        
        const successful = results.filter(r => r.status === 'fulfilled');
        expect(successful.length).toBeGreaterThan(0);
    });

    test('handles rapid worker recreation', async () => {
        const initPromises = Array.from({ length: 10 }, async () => {
            const manager = new WorkerManager();
            await manager.initialize();
            await manager.dispose();
        });

        await expect(Promise.all(initPromises)).resolves.toBeDefined();
    });

    // Race condition tests
    test('handles concurrent initialization attempts', async () => {
        const initPromises = Array.from({ length: 5 }, () => 
            workerManager.initialize()
        );
        
        await expect(Promise.all(initPromises)).resolves.toBeDefined();
        expect(workerManager.isInitialized).toBe(true);
    });

    test('handles initialization during processing', async () => {
        await workerManager.initialize();
        const batch = [{ level: 'INFO', message: 'test' }];
        
        const processPromise = workerManager.processBatch(batch);
        const reinitPromise = workerManager.initialize();
        
        await expect(Promise.all([processPromise, reinitPromise])).resolves.toBeDefined();
    });

    test('handles concurrent disposal attempts', async () => {
        await workerManager.initialize();
        const disposePromises = Array.from({ length: 5 }, () => 
            workerManager.dispose()
        );
        
        await expect(Promise.all(disposePromises)).resolves.toBeDefined();
        expect(workerManager.worker).toBeNull();
    });

    test('handles stress with large batches', async () => {
        await workerManager.initialize();
        const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
            level: 'INFO',
            message: `test ${i}`,
            timestamp: Date.now(),
            context: { id: i }
        }));

        const chunks = [];
        for (let i = 0; i < largeBatch.length; i += 100) {
            chunks.push(largeBatch.slice(i, i + 100));
        }

        const results = await Promise.allSettled(
            chunks.map(chunk => workerManager.processBatch(chunk))
        );

        const failures = results.filter(r => r.status === 'rejected');
        expect(failures.length).toBe(0);
    });

    test('handles worker crash and recovery', async () => {
        await workerManager.initialize();
        const errorEvent = new ErrorEvent('error', { error: new Error('Worker crashed') });
        
        // Simulate worker crash
        workerManager.worker.dispatchEvent('error', errorEvent);
        
        // Attempt operation after crash
        const batch = [{ level: 'INFO', message: 'test' }];
        const processPromise = workerManager.processBatch(batch);
        
        await expect(processPromise).resolves.toBe('processed');
    });
});
