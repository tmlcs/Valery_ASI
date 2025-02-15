const CLEANUP_TIMEOUT = 5000; // 5 seconds timeout
const INDIVIDUAL_TASK_TIMEOUT = 2000; // 2 seconds timeout for individual tasks
const MAX_RETRY_ATTEMPTS = 3; // Máximo número de intentos
const BASE_RETRY_DELAY = 1000; // Delay base para retry (1 segundo)

const withTimeout = (promise, timeoutMs, taskName) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${taskName} timeout exceeded`)), timeoutMs)
        )
    ]).catch(error => {
        throw new Error(`${taskName} failed: ${error.message}`);
    });
};

// Agregar función de retry con backoff exponencial
const retryOperation = async (operation, maxAttempts = MAX_RETRY_ATTEMPTS) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt === maxAttempts) break;
            
            // Calcular delay con backoff exponencial y jitter
            const delay = Math.min(
                BASE_RETRY_DELAY * Math.pow(2, attempt - 1) + Math.random() * 1000,
                5000 // máximo 5 segundos
            );
            
            console.warn(`Cleanup attempt ${attempt} failed, retrying in ${delay}ms:`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`All ${maxAttempts} retry attempts failed: ${lastError.message}`);
};

const cleanup = async () => {
    try {
        await Promise.race([
            Promise.all([
                cleanupEventListeners(),
                cleanupMediaElements(),
                cleanupTimeouts(),
                cleanupDropdowns()
            ]),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Global cleanup timeout')), 
                CLEANUP_TIMEOUT)
            )
        ]);
    } catch (error) {
        console.error('Cleanup failed:', error);
        // Intentar limpieza forzada
        forcedCleanup();
    }
};

// Helper functions for cleanup
const cleanupEventListeners = async () => {
    const cleanupTimeout = 2000;
    const errors = [];
    
    try {
        return await retryOperation(async () => {
            return Promise.race([
                Promise.all([...eventListenerRegistry].map(async ([element, listeners]) => {
                    try {
                        return await retryOperation(async () => {
                            return Promise.race([
                                Promise.all(listeners.map(({ type, fn }) => {
                                    try {
                                        element.removeEventListener(type, fn);
                                        return Promise.resolve();
                                    } catch (e) {
                                        errors.push(e);
                                        console.warn(`Failed to remove ${type} listener:`, e);
                                        return Promise.reject(e);
                                    }
                                })),
                                new Promise((_, reject) => 
                                    setTimeout(() => {
                                        const error = new Error('Individual cleanup timeout');
                                        errors.push(error);
                                        reject(error);
                                    }, cleanupTimeout)
                                )
                            ]);
                        });
                    } catch (error) {
                        errors.push(error);
                        console.error('Error cleaning up element listeners:', error);
                        // Continuar con otros elementos incluso si uno falla
                        return Promise.resolve();
                    }
                })),
                new Promise((_, reject) => 
                    setTimeout(() => {
                        const error = new Error('Total cleanup timeout');
                        errors.push(error);
                        reject(error);
                    }, CLEANUP_TIMEOUT)
                )
            ]);
        });
    } catch (error) {
        console.error('Event listener cleanup failed:', {
            mainError: error,
            allErrors: errors
        });
        // Intentar limpieza forzada de los listeners restantes
        try {
            eventListenerRegistry.forEach(([element, listeners]) => {
                listeners.forEach(({ type, fn }) => {
                    try {
                        element.removeEventListener(type, fn);
                    } catch (e) {
                        console.warn('Forced cleanup failed for listener:', e);
                    }
                });
            });
        } catch (e) {
            console.error('Forced cleanup failed:', e);
        }
        // Re-lanzar el error original con contexto
        throw new Error(`Event listener cleanup failed: ${error.message} (${errors.length} total errors)`);
    } finally {
        // Limpiar el registro incluso si hay errores
        eventListenerRegistry.clear();
    }
};

const cleanupMediaElements = async () => {
    const mediaElements = document.querySelectorAll('video, audio');
    // Falta validar que mediaElements no sea null/empty
    if (!mediaElements || mediaElements.length === 0) {
        console.warn('No media elements found for cleanup');
        return;
    }
    
    return await retryOperation(async () => {
        return Promise.race([
            Promise.all([...mediaElements].map(async (media) => {
                try {
                    if (!media.isConnected) return;
                    
                    await retryOperation(async () => {
                        const cleanup = new Promise((resolve) => {
                            media.addEventListener('emptied', resolve, { once: true });
                            setTimeout(resolve, 1000); // Fallback timeout
                        });
                        
                        media.pause();
                        media.src = '';
                        media.load();
                        
                        await cleanup;
                    });
                } catch (e) {
                    console.warn('Media cleanup error:', e);
                }
            })),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Media cleanup timeout')), 
                INDIVIDUAL_TASK_TIMEOUT)
            )
        ]);
    });
};

const cleanupTimeouts = () => {
    timeoutRegistry.forEach(id => clearTimeout(id));
    timeoutRegistry.clear();
};

const cleanupDropdowns = async () => {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    return await retryOperation(async () => {
        return Promise.race([
            Promise.all([...dropdowns].map(async (dropdown) => {
                try {
                    const instance = Dropdown.getInstance(dropdown);
                    if (instance) {
                        await retryOperation(() => instance.destroy());
                    }
                } catch (error) {
                    console.warn('Error cleaning up dropdown:', error);
                }
            })),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Dropdown cleanup timeout')), 
                INDIVIDUAL_TASK_TIMEOUT)
            )
        ]);
    });
};

// Agregar verificación de memory leaks
const checkMemoryLeaks = () => {
    const heapUsed = process?.memoryUsage?.()?.heapUsed;
    if (heapUsed && heapUsed > 100 * 1024 * 1024) { // 100MB
        console.warn('Possible memory leak detected');
        return true;
    }
    return false;
};

export { cleanup, cleanupEventListeners, cleanupMediaElements, cleanupTimeouts, cleanupDropdowns };