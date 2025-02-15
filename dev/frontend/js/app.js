import { 
    CONFIG,
    requiredElements,
    optionalElements,
} from './config.js';

import { logger } from './logger.js';
import { DOMCache, BatchDOM, VirtualDOM, EventDelegate } from './dom.js';

import { 
    ValidationError, 
    NetworkError, 
    ServerError, 
    errorHandler,
    ErrorBoundary,
    RetryPolicy
} from './errors.js';
import { 
    cleanup,
    cleanupEventListeners,
    cleanupMediaElements,
    cleanupTimeouts,
    cleanupDropdowns
 } from './cleanup.js';	
 
import { initTabs } from './tabs.js';
import { Logger } from './logger.js';
import SplashCursor from './SplashCursor';

<SplashCursor />;

// Función mejorada para obtener elementos del DOM
const getElements = () => {
    if (!requiredElements || !optionalElements) {
        throw new Error('Configuration objects are not defined');
    }

    const elements = {};
    let missingElements = [];
    let missingOptionals = [];
    
    // Validar elementos requeridos
    for (const [key, id] of Object.entries(requiredElements)) {
        if (!id) {
            throw new Error(`Missing ID for required element: ${key}`);
        }
        if (typeof id !== 'string') {
            throw new TypeError(`ID inválido para elemento requerido ${key}`);
        }
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
            continue;
        }
        if (!(element instanceof HTMLElement)) {
            throw new TypeError(`Element with ID "${id}" is not a valid HTML element`);
        }
        elements[key] = element;
    }

    if (missingElements.length > 0) {
        throw new Error(`Elementos requeridos no encontrados: ${missingElements.join(', ')}`);
    }

    // Validar y registrar elementos opcionales
    for (const [key, id] of Object.entries(optionalElements)) {
        if (!id) {
            logger.warn(`Missing ID for optional element: ${key}`);
            continue;
        }
        if (typeof id !== 'string') {
            logger.warn(`Invalid ID type for optional element: ${key}`);
            continue;
        }
        const element = document.getElementById(id);
        if (element) {
            if (!(element instanceof HTMLElement)) {
                logger.warn(`Optional element with ID "${id}" is not a valid HTML element`);
                elements[key] = null;
                continue;
            }
            elements[key] = element;
        } else {
            missingOptionals.push(id);
            elements[key] = null;
        }
    }

    // Registrar elementos opcionales faltantes
    if (missingOptionals.length > 0) {
        logger.warn('Elementos opcionales no encontrados', { 
            missing: missingOptionals,
            total: Object.keys(optionalElements).length 
        });
    }

    // Validar que tenemos al menos los elementos mínimos necesarios
    const totalElements = Object.values(elements).filter(Boolean).length;
    const requiredCount = Object.keys(requiredElements).length;
    
    if (totalElements < requiredCount) {
        throw new Error('No se encontraron suficientes elementos requeridos');
    }

    // Validar que los elementos críticos estén presentes y sean del tipo correcto
    const criticalElements = ['form', 'input', 'responseContainer'];
    for (const elementKey of criticalElements) {
        const element = elements[elementKey];
        if (!element) {
            throw new Error(`Critical element missing: ${elementKey}`);
        }
        // Validaciones específicas por tipo de elemento
        switch (elementKey) {
            case 'form':
                if (!(element instanceof HTMLFormElement)) {
                    throw new TypeError('form debe ser un elemento HTMLFormElement');
                }
                break;
            case 'input':
                if (!(element instanceof HTMLInputElement) && 
                    !(element instanceof HTMLTextAreaElement)) {
                    throw new TypeError('input debe ser un elemento HTMLInputElement o HTMLTextAreaElement');
                }
                break;
            case 'responseContainer':
                if (!(element instanceof HTMLElement)) {
                    throw new TypeError('responseContainer debe ser un elemento HTMLElement');
                }
                break;
        }
    }

    return elements;
};

// Crear objeto elements usando la nueva función
let elements;
try {
    elements = getElements();
} catch (error) {
    console.error('Error inicializando la aplicación:', error);
    document.body.innerHTML = `<div class="error">Error fatal: ${error.message}</div>`;
    throw error;
}

// Event listener tracking
const eventListenerRegistry = new WeakMap();

const registerEventListener = (element, type, fn) => {
    if (!eventListenerRegistry.has(element)) {
        eventListenerRegistry.set(element, []);
    }
    eventListenerRegistry.get(element).push({ type, fn });
    element.addEventListener(type, fn);
};

// Timeout tracking
const timeoutRegistry = new Set();

const safeSetTimeout = (fn, delay) => {
    const timeoutId = setTimeout(() => {
        timeoutRegistry.delete(timeoutId);
        fn();
    }, delay);
    timeoutRegistry.add(timeoutId);
    return timeoutId;
};

// Response type validation
const responseSchema = {
    sentiment: {
        label: 'string',
        score: 'number',
        details: { rating: 'number' }
    },
    emotion: {
        label: 'string',
        score: 'number'
    },
    topic: {
        details: {
            all_labels: 'array',
            all_scores: 'array'
        }
    }
};

const validateResponse = (response, schema) => {
    // Validar parámetros
    if (!schema || typeof schema !== 'object') {
        throw new TypeError('schema debe ser un objeto');
    }
    if (response !== null && typeof response !== 'object') {
        return false;
    }
    
    return Object.entries(schema).every(([key, spec]) => {
        if (!response[key]) return true; // Optional fields
        
        if (typeof spec === 'string') {
            if (!['string', 'number', 'boolean', 'array'].includes(spec)) {
                throw new TypeError(`Tipo de esquema no válido: ${spec}`);
            }
            return typeof response[key] === spec ||
                   (spec === 'array' && Array.isArray(response[key]));
        }
        
        return validateResponse(response[key], spec);
    });
};

// Exponential backoff implementation
const exponentialBackoff = (retryCount) => {
    if (!Number.isInteger(retryCount) || retryCount < 0) {
        throw new TypeError('retryCount debe ser un número entero no negativo');
    }
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return delay + Math.random() * 1000; // Add jitter
};

const utils = {
    showLoading: () => {
        elements.loading.style.display = 'flex';
        elements.responseContainer.style.display = 'none'; 
        elements.error.style.display = 'none';
    },
    
    hideLoading: () => {
        elements.loading.style.display = 'none';
    },
    
    showError: (message) => {
        elements.error.textContent = message;
        elements.error.style.display = 'block';
        elements.responseContainer.style.display = 'none'; 
    },
    
    formatConfidenceBar: (score) => {
        if (typeof score !== 'number' || isNaN(score)) {
            throw new TypeError('El score debe ser un número válido');
        }
        if (score < 0 || score > 1) {
            throw new RangeError('El score debe estar entre 0 y 1');
        }
        const percentage = (score * 100).toFixed(1);
        return `
            <div class="confidence-bar">
                <div class="confidence-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div style="text-align: right">${percentage}%</div>
        `;
    },

    renderResults: (response) => {
        const container = DOMCache.get('#responseText');
        if (!container) return;

        BatchDOM.schedule(container, fragment => {
            try {
                let html = '';
                
                // Validar que response sea un objeto válido
                if (!response || typeof response !== 'object') {
                    throw new Error('Invalid response format');
                }
                
                // Validar y renderizar sentimiento
                if (response.sentiment && response.sentiment.label) {
                    const sentimentEmoji = {
                        "very negative": "😡",
                        "negative": "😕",
                        "neutral": "😐",
                        "positive": "😊",
                        "very positive": "😄"
                    };

                    const rating = response.sentiment.details?.rating || 0;
                    
                    html += `
                        <div class="result-card">
                            <h3>Análisis de Sentimiento ${sentimentEmoji[response.sentiment.label] || '🤔'}</h3>
                            <p><strong>${response.sentiment.label.toUpperCase()}</strong></p>
                            ${utils.formatConfidenceBar(response.sentiment.score)}
                            <p>Rating: ${'⭐'.repeat(Math.min(5, Math.max(0, rating)))}</p>
                        </div>
                    `;
                }
                
                // Validar y renderizar emoción
                if (response.emotion && response.emotion.label) {
                    const emotionEmoji = {
                        "joy": "😊", "sadness": "😢", "anger": "😠",
                        "fear": "😨", "surprise": "😮", "love": "❤️",
                        "neutral": "😐"
                    };

                    html += `
                        <div class="result-card">
                            <h3>Emoción Detectada ${emotionEmoji[response.emotion.label] || '🔍'}</h3>
                            <p><strong>${response.emotion.label.toUpperCase()}</strong></p>
                            ${utils.formatConfidenceBar(response.emotion.score)}
                        </div>
                    `;
                }
                
                // Validar y renderizar tema
                if (response.topic && response.topic.details) {
                    const topicsList = response.topic.details.all_labels
                        .map((topic, i) => {
                            const score = response.topic.details.all_scores[i];
                            if (!topic || typeof score !== 'number') return '';
                            return `
                                <div>
                                    <p>${topic.toUpperCase()}</p>
                                    ${utils.formatConfidenceBar(score)}
                                </div>
                            `;
                        })
                        .filter(item => item !== '')  // Eliminar elementos vacíos
                        .join('');
                        
                    if (topicsList) {
                        html += `
                            <div class="result-card">
                                <h3>Clasificación de Tema</h3>
                                <div class="topics-list">${topicsList}</div>
                            </div>
                        `;
                    }
                }
                
                if (!html) {
                    throw new Error('No valid data to display');
                }

                const template = document.createElement('template');
                template.innerHTML = html;
                fragment.appendChild(template.content);
                utils.updateUIState(CONFIG.LOADING_STATES.SUCCESS);
            } catch (error) {
                console.error('Error rendering results:', error);
                utils.showError(CONFIG.ERROR_MESSAGES.SERVER);
            }
        });
    },

    validateInput: (text) => {
        if (typeof text !== 'string') {
            throw new TypeError('El texto debe ser una cadena de caracteres');
        }
        if (!text) {
            throw new Error('Por favor, ingresa un texto para analizar.');
        }
        if (text.length > CONFIG.VALIDATION.MAX_LENGTH) {
            throw new Error(`El texto no debe exceder los ${CONFIG.VALIDATION.MAX_LENGTH} caracteres.`);
        }
    },

    handleNetworkError: (error) => {
        if (!navigator.onLine) {
            return 'Sin conexión a Internet. Por favor, verifica tu conexión.';
        }
        if (error.name === 'AbortError') {
            return 'La solicitud ha excedido el tiempo de espera. Por favor, intenta de nuevo.';
        }
        if (error.message === 'Failed to fetch') {
            return 'No se pudo conectar con el servidor. Por favor, verifica que el servidor esté funcionando.';
        }
        return error.message || 'Error al procesar el texto. Por favor, intenta de nuevo.';
    },

    delay: (ms) => {
        if (!Number.isInteger(ms) || ms < 0) {
            throw new TypeError('ms debe ser un número entero no negativo');
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async fetchWithRetry(url, options) {
        const endpoint = url.split('/').pop(); // Get the last part of the URL
        
        try {
            switch(endpoint) {
                case 'health':
                    return await apiService.checkHealth();
                case 'send_message':
                case 'process':
                    return await apiService.processQuery(
                        JSON.parse(options.body).message || JSON.parse(options.body).query
                    );
                case 'detect-objects':
                    return await apiService.detectObjects(JSON.parse(options.body).image);
                case 'analyze':
                    return await apiService.analyzeMedicalText(JSON.parse(options.body).text);
                case 'detect-threats':
                    return await apiService.detectThreats(JSON.parse(options.body).data);
                case 'analyze-risk':
                    return await apiService.analyzeFinancialRisk(JSON.parse(options.body).text);
                case 'upload':
                    return await apiService.uploadFile(options.body.get('file'));
                case 'result':
                    return await apiService.processData(JSON.parse(options.body).data);
                default:
                    throw new Error(`Unknown endpoint: ${endpoint}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new NetworkError('Request timeout');
            }
            throw error;
        }
    },

    async ensureServerConnection() {
        return RequestManager.execute(
            async () => {
                for (let i = 0; i < 3; i++) {
                    if (await this.checkServerHealth()) {
                        return true;
                    }
                    await this.delay(1000);
                }
                throw new NetworkError('Failed to establish server connection');
            },
            { timeout: 10000 }
        );
    },

    updateServerStatus: (status) => {
        if (typeof status !== 'string') {
            throw new TypeError('status debe ser una cadena');
        }
        if (!Object.values(CONFIG.CONNECTION_STATUS).includes(status)) {
            throw new TypeError('Estado de servidor inválido');
        }
        if (!elements.serverStatus) return;
        
        const statusMessages = {
            [CONFIG.CONNECTION_STATUS.CONNECTED]: 'Servidor conectado',
            [CONFIG.CONNECTION_STATUS.DISCONNECTED]: 'Servidor desconectado',
            [CONFIG.CONNECTION_STATUS.CHECKING]: 'Verificando conexión...'
        };
        
        elements.serverStatus.textContent = statusMessages[status] || 'Estado desconocido';
        elements.serverStatus.className = `server-status ${status}`;
    },

    // Mejorar el health check con timeout y mejor manejo de errores
    checkServerHealth: async () => {
        let timeoutId;
        try {
            logger.debug('Checking server health');
            utils.updateServerStatus(CONFIG.CONNECTION_STATUS.CHECKING);
            
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await Promise.race([
                    fetch(CONFIG.HEALTH_CHECK_ENDPOINT, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: controller.signal
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    )
                ]);

                // If we get a 404, consider the server connected but health endpoint not implemented
                if (response.status === 404) {
                    utils.updateServerStatus(CONFIG.CONNECTION_STATUS.CONNECTED);
                    logger.info('Server connected (health check endpoint not found)');
                    return true;
                }
                
                if (!response.ok) {
                    throw new ServerError('Server health check failed', response.status);
                }

                const data = await response.json();
                utils.updateServerStatus(CONFIG.CONNECTION_STATUS.CONNECTED);
                logger.info('Server health check successful');
                return true;

            } catch (error) {
                if (error.name === 'AbortError' || !navigator.onLine) {
                    throw new NetworkError('Network error during health check');
                }
                throw error;
            }

        } catch (error) {
            logger.error('Server health check failed', { error: error.message });
            utils.updateServerStatus(CONFIG.CONNECTION_STATUS.DISCONNECTED);
            console.error('Health check error:', error);
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    // Agregar control de intervalos
    healthCheckInterval: null,

    startServerHealthCheck: () => {
        utils.checkServerHealth();
        utils.healthCheckInterval = setInterval(utils.checkServerHealth, CONFIG.HEALTH_CHECK_INTERVAL);
    },

    stopServerHealthCheck: () => {
        if (utils.healthCheckInterval) {
            clearInterval(utils.healthCheckInterval);
            utils.healthCheckInterval = null;
        }
    },

    updateUIState: (state) => {
        if (typeof state !== 'string') {
            throw new TypeError('state debe ser una cadena');
        }
        if (!Object.values(CONFIG.LOADING_STATES).includes(state)) {
            throw new TypeError('Estado de UI inválido');
        }
        if (!elements.responseContainer) {
            console.error('Response container element not found');
            return;
        }
        
        // Validar que el estado sea válido
        if (!Object.values(CONFIG.LOADING_STATES).includes(state)) {
            console.error('Invalid UI state:', state);
            state = CONFIG.LOADING_STATES.IDLE;
        }
        
        elements.responseContainer.classList.remove(
            CONFIG.LOADING_STATES.LOADING,
            CONFIG.LOADING_STATES.SUCCESS,
            CONFIG.LOADING_STATES.ERROR,
            CONFIG.LOADING_STATES.IDLE
        );
        
        elements.responseContainer.classList.add(state);
        
        const displayStates = {
            [CONFIG.LOADING_STATES.LOADING]: {
                loading: 'flex',
                error: 'none',
                responseContainer: 'none',   
                responseText: 'none'
            },
            [CONFIG.LOADING_STATES.SUCCESS]: {
                loading: 'none',
                error: 'none',
                responseContainer: 'block',   
                responseText: 'block'
            },
            [CONFIG.LOADING_STATES.ERROR]: {
                loading: 'none',
                error: 'block',
                responseContainer: 'none',   
                responseText: 'none'
            },
            [CONFIG.LOADING_STATES.IDLE]: {
                loading: 'none',
                error: 'none',
                responseContainer: 'none',   
                responseText: 'none'
            }
        };

        const currentState = displayStates[state] || displayStates[CONFIG.LOADING_STATES.IDLE];
        for (const [elementKey, display] of Object.entries(currentState)) {
            if (elements[elementKey]) {
                elements[elementKey].style.display = display;
            }
        }
    },

    handlePartialResponse(response) {
        if (!response || typeof response !== 'object') {
            throw new TypeError('response debe ser un objeto');
        }
        const validSections = [];
        
        if (validateResponse({ sentiment: response.sentiment }, responseSchema)) {
            validSections.push('sentiment');
        }
        if (validateResponse({ emotion: response.emotion }, responseSchema)) {
            validSections.push('emotion');
        }
        if (validateResponse({ topic: response.topic }, responseSchema)) {
            validSections.push('topic');
        }
        
        if (validSections.length === 0) {
            throw new Error('No valid data in response');
        }
        
        return validSections;
    }
};

// Add request manager for better promise handling
const RequestManager = {
    activeRequests: new Set(),
    
    workerEnabled: true,
    fallbackMode: false,

    initWorker() {
        // Skip if already in fallback mode
        if (this.fallbackMode) {
            return;
        }

        try {
            // Check Web Workers support
            if (typeof Worker === 'undefined') {
                throw new Error('Web Workers not supported');
            }
    
            const workerPath = new URL('./logWorker.js', document.baseURI).href;
            const worker = new Worker(workerPath);
    
            worker.onerror = (error) => {
                console.warn('Worker initialization failed:', error);
                this.enableFallbackMode();
            };

            // Test worker with a simple message
            worker.postMessage({ type: 'test' });
            
            return worker;

        } catch (error) {
            console.warn('Worker setup failed:', error);
            this.enableFallbackMode();
            return null;
        }
    },

    enableFallbackMode() {
        if (!this.fallbackMode) {
            this.fallbackMode = true;
            this.workerEnabled = false;
            console.info('Worker is disabled, using synchronous processing');
            logger.warn('Switched to synchronous processing mode', {
                reason: 'Worker initialization failed'
            });
        }
    },

    async execute(promise, options = {}) {
        // Use synchronous processing if in fallback mode
        if (this.fallbackMode) {
            return this.executeSync(promise, options);
        }

        if (typeof promise !== 'function') {
            throw new TypeError('promise debe ser una función');
        }
        if (options !== null && typeof options !== 'object') {
            throw new TypeError('options debe ser un objeto o null');
        }

        const { timeout = CONFIG.TIMEOUT, retry = true } = options;
        
        if (!Number.isInteger(timeout) || timeout <= 0) {
            throw new TypeError('timeout debe ser un número entero positivo');
        }
        if (typeof retry !== 'boolean') {
            throw new TypeError('retry debe ser un booleano');
        }

        const controller = new AbortController();
        
        try {
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            this.activeRequests.add(controller);
            
            const result = await Promise.race([
                promise({ signal: controller.signal }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new NetworkError('Request timeout')), timeout)
                )
            ]);
            
            clearTimeout(timeoutId);
            return result;
            
        } catch (error) {
            if (retry && this.shouldRetry(error)) {
                return this.retryWithBackoff(promise, options);
            }
            throw error;
            
        } finally {
            this.activeRequests.delete(controller);
        }
    },

    async executeSync(promise, options = {}) {
        try {
            const { timeout = CONFIG.TIMEOUT } = options;
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeout)
            );

            const result = await Promise.race([
                promise({}),
                timeoutPromise
            ]);

            return result;
        } catch (error) {
            if (this.shouldRetry(error) && options.retry !== false) {
                return this.retryWithBackoff(promise, options);
            }
            throw error;
        }
    },

    shouldRetry(error) {
        return error instanceof NetworkError || 
               (error instanceof ServerError && error.statusCode >= 500);
    },

    async retryWithBackoff(promise, options, attempt = 1) {
        if (typeof promise !== 'function') {
            throw new TypeError('promise debe ser una función');
        }
        if (options !== null && typeof options !== 'object') {
            throw new TypeError('options debe ser un objeto o null');
        }
        if (!Number.isInteger(attempt) || attempt < 1) {
            throw new TypeError('attempt debe ser un número entero positivo');
        }

        const maxAttempts = CONFIG.MAX_RETRIES;
        const delay = exponentialBackoff(attempt);
        
        try {
            await utils.delay(delay);
            return await this.execute(promise, { ...options, retry: false });
        } catch (error) {
            if (attempt < maxAttempts) {
                return this.retryWithBackoff(promise, options, attempt + 1);
            }
            throw error;
        }
    },

    cancelAll() {
        this.activeRequests.forEach(controller => controller.abort());
        this.activeRequests.clear();
    }
};

// Create error boundary instance
const appErrorBoundary = new ErrorBoundary('app-root', `
    <div class="error-boundary">
        <h2>Algo salió mal</h2>
        <p>Estamos trabajando para solucionarlo. Por favor, intenta recargar la página.</p>
        <button onclick="window.location.reload()">Recargar página</button>
    </div>
`);

// Agregar debounce para handleSubmit
function debounce(func, wait) {
    if (typeof func !== 'function') {
        throw new TypeError('func debe ser una función');
    }
    if (!Number.isInteger(wait) || wait <= 0) {
        throw new TypeError('wait debe ser un número entero positivo');
    }

    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const handleSubmit = debounce(async (event) => {
    event.preventDefault();
    const query = elements.input.value.trim();
    
    try {
        // Cancelar peticiones previas
        RequestManager.cancelAll();

        // Validate input before making request
        utils.validateInput(query);
        
        // Ensure server is available
        await utils.ensureServerConnection();
        
        utils.updateUIState(CONFIG.LOADING_STATES.LOADING);
        
        const data = await utils.fetchWithRetry(CONFIG.API_URL, {
            ...CONFIG.FETCH_OPTIONS,
            method: 'POST',
            body: JSON.stringify({ message: query })
        });

        utils.renderResults(data.response);
        utils.updateUIState(CONFIG.LOADING_STATES.SUCCESS);

    } catch (error) {
        const errorContext = { component: 'SubmitForm', query };

        if (error instanceof ValidationError) {
            utils.showError(error.message);
        } else if (error instanceof NetworkError) {
            utils.showError(CONFIG.ERROR_MESSAGES.NETWORK);
            // Auto-retry when back online
            if (!navigator.onLine) {
                handleOnline(new Event('submit'));
            }
        } else if (error instanceof ServerError) {
            utils.showError(CONFIG.ERROR_MESSAGES.SERVER);
            // Schedule health check
            safeSetTimeout(() => utils.checkServerHealth(), 5000);
        } else {
            utils.showError(CONFIG.ERROR_MESSAGES.UNKNOWN);
        }

        appErrorBoundary.captureError(error, errorContext);
        utils.updateUIState(CONFIG.LOADING_STATES.ERROR);
        logger.error('Submit error', { error, ...errorContext });
    }
}, 300);

// Mejorar manejo de validación en handleInput
const handleInput = (event) => {
    if (!event.target?.value) return;
    if (event.type !== 'input') return;
    
    const value = event.target.value;
    const maxLength = CONFIG.VALIDATION.MAX_LENGTH;

    // Validaciones más estrictas por tipo de caracter
    const validations = [
        {
            pattern: /[<>{}[\]\\]/g,
            message: 'Caracteres especiales < > { } [ ] \\ no están permitidos'
        },
        {
            pattern: /['"`;]/g,
            message: 'Caracteres de código \' " ` ; no están permitidos'
        },
        {
            pattern: /[\u0000-\u001F\u007F-\u009F]/g,
            message: 'Caracteres de control no están permitidos'
        },
        {
            pattern: /[^\p{L}\p{N}\s.,!?()@#$%&*_+-]/gu,
            message: 'Solo se permiten letras, números y puntuación básica'
        }
    ];

    let cleanValue = value;
    let hasInvalidChars = false;

    // Aplicar cada validación y limpiar el texto
    for (const validation of validations) {
        if (validation.pattern.test(cleanValue)) {
            hasInvalidChars = true;
            utils.showError(validation.message);
            cleanValue = cleanValue.replace(validation.pattern, '');
        }
    }

    // Normalizar espacios múltiples y saltos de línea
    cleanValue = cleanValue
        .replace(/\s+/g, ' ')           // Convertir espacios múltiples en uno solo
        .replace(/[\r\n]+/g, '\n')      // Normalizar saltos de línea
        .trim();                        // Eliminar espacios al inicio y final

    // Actualizar valor si hubo cambios
    if (hasInvalidChars) {
        event.target.value = cleanValue;
        return;
    }
    
    // Validar longitud después de limpieza
    if (cleanValue.length > maxLength) {
        event.target.value = cleanValue.substring(0, maxLength);
        utils.showError(`El texto no debe exceder los ${maxLength} caracteres.`);
    }

    // Validar cantidad de saltos de línea
    const lineBreaks = (cleanValue.match(/\n/g) || []).length;
    if (lineBreaks > 10) {
        event.target.value = cleanValue.replace(/\n/g, ' ');
        utils.showError('Demasiados saltos de línea. Se han convertido a espacios.');
    }
};

const handleExampleClick = () => {
    elements.input.value = CONFIG.EXAMPLE_TEXT;
};

const handleClearClick = () => {
    elements.input.value = '';
    elements.responseContainer.style.display = 'none';
    elements.error.style.display = 'none';
    utils.updateUIState(CONFIG.LOADING_STATES.IDLE);
};

// Move these handlers before the DOMContentLoaded event listener
const handleNavClick = (event, target) => {
    if (!target || !target.dataset.tab) return;
    
    const tabId = target.dataset.tab;
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    
    // Cleanup old listeners before removing active classes
    contents.forEach(content => {
        const listeners = tabListeners.get(content);
        if (listeners) {
            listeners.forEach(({type, fn}) => content.removeEventListener(type, fn));
            tabListeners.delete(content);
        }
    });
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    target.classList.add('active');
    const content = document.getElementById(`${tabId}Tab`);
    if (content) {
        content.classList.add('active');
        // Register new content listeners if needed
        const contentListeners = setupTabContentListeners(content);
        if (contentListeners.length > 0) {
            tabListeners.set(content, contentListeners);
        }
    }
};

const handleDropdownClick = (event, target) => {
    const action = target.dataset.action;
    if (!action) return;
    
    // Handle dropdown actions
    switch (action) {
        case 'new-analysis':
            document.getElementById('queryForm')?.reset();
            break;
        case 'history':
            // Handle history action
            break;
        case 'settings':
            // Handle settings action
            break;
    }
};

// Setup tab content listeners helper
const setupTabContentListeners = (content) => {
    const listeners = [];
    // Add any tab-specific listeners here
    return listeners;
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        logger.info('Application initializing');
        elements = getElements();

        // Initialize event delegation for nav and dropdowns
        EventDelegate.on('click', '.nav-item', handleNavClick);
        EventDelegate.on('click', '.dropdown-item', handleDropdownClick);
        
        await utils.ensureServerConnection();
        
        // Register event handlers
        const handlers = {
            'submit': { element: 'form', handler: handleSubmit },
            'input': { element: 'input', handler: handleInput },
            'exampleClick': { 
                type: 'click',
                element: 'exampleButton', 
                handler: handleExampleClick,
                optional: true 
            },
            'clearClick': { 
                type: 'click',
                element: 'clearButton', 
                handler: handleClearClick,
                optional: true 
            }
        };

        // Modificar el registro de eventos
        Object.entries(handlers).forEach(([key, config]) => {
            const element = elements[config.element];
            if (element || !config.optional) {
                registerEventListener(element, config.type || key, config.handler);
            }
        });

        // Start monitoring
        utils.startServerHealthCheck();
        
        // Register cleanup
        registerEventListener(window, 'unload', () => {
            RequestManager.cancelAll();
            cleanup();
            // Falta limpiar todos los event listeners registrados
            eventListenerRegistry.forEach((listeners, element) => {
                listeners.forEach(({ type, fn }) => {
                    element.removeEventListener(type, fn);
                });
            });
        });

        // Check if running in fallback mode
        if (RequestManager.fallbackMode) {
            logger.info('Application running in synchronous processing mode');
            // Optionally show a message to the user
            utils.showMessage('Running in compatibility mode', 'warning');
        }

        utils.updateUIState(CONFIG.LOADING_STATES.IDLE);

        // Validar inicialización de tabs
        try {
            // Verificar que existan los elementos necesarios para los tabs
            const tabElements = document.querySelectorAll('.nav-item, .tab-content');
            if (!tabElements.length) {
                throw new Error('No tab elements found in DOM');
            }

            const cleanupTabs = initTabs();
            if (typeof cleanupTabs !== 'function') {
                throw new Error('initTabs did not return cleanup function');
            }

            // Registrar la función de limpieza para cuando se desmonte la app
            registerEventListener(window, 'unload', cleanupTabs);
            logger.info('Tabs initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize tabs', { error });
            // No bloquear la inicialización de la app si fallan los tabs
            // pero registrar el error y notificar al usuario
            utils.showError('Algunas funciones de navegación pueden no estar disponibles');
            appErrorBoundary.captureError(error, { 
                component: 'Tabs',
                critical: false
            });
        }
        
        logger.info('Application initialized successfully');

    } catch (error) {
        logger.fatal('Application initialization failed', { error });
        utils.showError(CONFIG.ERROR_MESSAGES.SERVER);
        throw error;
    }
});

// Update global error handlers con mejor manejo de errores
window.addEventListener('error', (event) => {
    try {
        // Prevenir comportamiento por defecto si podemos manejar el error
        if (event.error && appErrorBoundary) {
            event.preventDefault();
        }

        // Validar datos del evento
        const errorInfo = {
            message: event.error?.message || 'Unknown error',
            filename: event.filename || 'unknown file',
            lineNo: event.lineno || 0,
            colNo: event.colno || 0,
            stack: event.error?.stack || '',
            type: 'global'
        };

        // Registrar con el logger
        logger.error('Global error occurred', errorInfo);

        // Capturar con error boundary
        if (appErrorBoundary) {
            appErrorBoundary.captureError(event.error || new Error(errorInfo.message), {
                ...errorInfo,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        }

        // Mostrar error al usuario si es crítico
        if (event.error instanceof TypeError || event.error instanceof ReferenceError) {
            utils.showError(CONFIG.ERROR_MESSAGES.UNKNOWN);
            utils.updateUIState(CONFIG.LOADING_STATES.ERROR);
        }

    } catch (handlerError) {
        // Error en el error handler - último recurso
        console.error('Error in global error handler:', handlerError);
        
        // Intentar registrar con un nuevo logger si el original falló
        try {
            const fallbackLogger = new Logger({ prefix: '[Fallback] ' });
            fallbackLogger.error('Error handler failed', { 
                originalError: event.error,
                handlerError
            });
        } catch (e) {
            // Si todo falla, al menos intentar registrar en consola
            console.error('Complete failure in error handling:', e);
        }
    }
}, { capture: true }); // Usar capture para asegurar que recibimos todos los errores

window.addEventListener('unhandledrejection', (event) => {
    try {
        // Prevenir comportamiento por defecto si podemos manejar
        if (event.reason && appErrorBoundary) {
            event.preventDefault();
        }

        // Extraer información útil de la promesa rechazada
        const reason = event.reason;
        const errorInfo = {
            message: reason?.message || reason?.toString() || 'Unknown rejection reason',
            stack: reason?.stack || '',
            type: 'unhandledRejection',
            timestamp: Date.now(),
            promiseState: 'rejected'
        };

        // Si es un error de red, intentar incluir detalles adicionales
        if (reason instanceof NetworkError) {
            errorInfo.networkDetails = {
                online: navigator.onLine,
                type: navigator.connection?.type,
                url: reason.context?.url
            };
        }

        // Registrar con el logger
        logger.error('Unhandled promise rejection', errorInfo);

        // Capturar con error boundary
        if (appErrorBoundary) {
            appErrorBoundary.captureError(
                reason instanceof Error ? reason : new Error(errorInfo.message),
                errorInfo
            );
        }

        // Mostrar error al usuario si es crítico
        if (reason instanceof NetworkError || reason instanceof ServerError) {
            utils.showError(CONFIG.ERROR_MESSAGES.NETWORK);
            utils.updateUIState(CONFIG.LOADING_STATES.ERROR);
            
            // Programar un retry del health check
            if (reason instanceof ServerError) {
                safeSetTimeout(() => utils.checkServerHealth(), 5000);
            }
        }

    } catch (handlerError) {
        // Error en el rejection handler - último recurso
        console.error('Error in unhandledrejection handler:', handlerError);
        
        try {
            const fallbackLogger = new Logger({ prefix: '[Fallback] ' });
            fallbackLogger.error('Rejection handler failed', {
                originalRejection: event.reason,
                handlerError
            });
        } catch (e) {
            console.error('Complete failure in rejection handling:', e);
        }
    }
}, { capture: true }); // Usar capture para asegurar que recibimos todas las rejections

// Mejorar limpieza de timeouts
const clearTimeouts = () => {
    timeoutRegistry.forEach(id => {
        try {
            clearTimeout(id);
        } catch (e) {
            console.error('Error clearing timeout:', e);
        }
    });
    timeoutRegistry.clear();
};

window.addEventListener('beforeunload', clearTimeouts);

// Agregar función faltante
const handleOnline = (event) => {
    if (navigator.onLine && event?.type === 'submit') {
        handleSubmit(event);
    }
};

// Agregar función faltante
utils.showMessage = (message, type = 'info') => {
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    setTimeout(() => messageElement.remove(), 5000);
};
