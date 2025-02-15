const validateUrl = (url) => {
    // Validar que la URL sea una cadena
    if (typeof url !== 'string') {
        throw new TypeError('URL debe ser una cadena');
    }

    // Validar URL relativa
    if (url.startsWith('/')) {
        // Expresión regular más estricta para rutas relativas:
        // - Debe comenzar con /
        // - Puede contener letras, números, guiones, guiones bajos
        // - Puede contener segmentos separados por /
        // - No permite .. para navegación hacia arriba
        // - No permite múltiples slashes consecutivos
        // - No permite espacios ni caracteres especiales
        const validRelativePathRegex = /^\/(?!.*\/\/)(?!.*\.\.)(?!.*\s)[a-zA-Z0-9\-_\/]*[a-zA-Z0-9\-_]$/;
        
        if (!validRelativePathRegex.test(url)) {
            throw new Error(`URL relativa inválida: ${url}. Debe contener solo letras, números, guiones y guiones bajos`);
        }
        return true;
    }

    // Validar URL absoluta con reglas más estrictas
    try {
        const urlObj = new URL(url);

        // Validar protocolo
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error(`Protocolo no permitido: ${urlObj.protocol}`);
        }

        // Validar hostname
        // - No permite IP addresses
        // - Debe tener al menos un punto
        // - Solo permite caracteres válidos para dominios
        // - Longitud máxima de 255 caracteres
        const hostname = urlObj.hostname;
        if (
            // No permitir IPs
            /^[\d.]+$/.test(hostname) ||
            // Debe tener al menos un punto (excepto localhost)
            (hostname !== 'localhost' && !hostname.includes('.')) ||
            // Solo caracteres válidos para dominios
            !/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(hostname) ||
            // Longitud máxima
            hostname.length > 255
        ) {
            throw new Error(`Hostname inválido: ${hostname}`);
        }

        // Validar puerto
        if (urlObj.port) {
            const port = parseInt(urlObj.port, 10);
            if (isNaN(port) || port <= 0 || port > 65535) {
                throw new Error(`Puerto inválido: ${urlObj.port}`);
            }
        }

        // Validar path
        // - No permite caracteres especiales excepto los permitidos
        // - No permite ../
        // - Longitud máxima de 1024 caracteres
        const path = urlObj.pathname;
        if (
            /[<>{}[\]`^]/.test(path) ||
            path.includes('../') ||
            path.length > 1024
        ) {
            throw new Error(`Path inválido: ${path}`);
        }

        // Validar query string
        if (urlObj.search) {
            // - Solo permite caracteres válidos
            // - Longitud máxima de 2048 caracteres
            // - Query params deben tener formato válido
            const search = urlObj.search;
            if (
                /[<>{}[\]`^]/.test(search) ||
                search.length > 2048 ||
                !/^\?[^<>{}[\]`^]*$/.test(search)
            ) {
                throw new Error(`Query string inválido: ${search}`);
            }
        }

        // Validar tamaño total de la URL (máximo 2083 caracteres por compatibilidad con IE)
        if (url.length > 2083) {
            throw new Error('URL excede la longitud máxima de 2083 caracteres');
        }

        return true;

    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(`URL absoluta inválida: ${url}`);
        }
        throw error;
    }
};

const getEnvironmentConfig = () => {
    const env = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ? 
                'development' : 'production';
    
    const configs = {
        development: {
            API_URL: '/api/send_message',  // Changed to relative path
            HEALTH_CHECK_ENDPOINT: '/api/health'  // Changed to relative path
        },
        production: {
            API_URL: '/api/send_message',  // Changed to relative path
            HEALTH_CHECK_ENDPOINT: '/api/health'  // Changed to relative path
        }
    };
    
    return configs[env] || configs.development;
};

const envConfig = getEnvironmentConfig();

// Validate URLs before creating CONFIG
Object.entries(envConfig).forEach(([key, value]) => {
    if (!validateUrl(value)) {
        throw new Error(`Invalid URL for ${key}: ${value}`);
    }
});

// Funciones de validación
const validators = {
    isString(value, key) {
        if (typeof value !== 'string') {
            throw new TypeError(`CONFIG.${key} debe ser una cadena de texto`);
        }
        return true;
    },

    isNumber(value, key) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new TypeError(`CONFIG.${key} debe ser un número`);
        }
        return true;
    },

    isBoolean(value, key) {
        if (typeof value !== 'boolean') {
            throw new TypeError(`CONFIG.${key} debe ser un booleano`);
        }
        return true;
    },

    isObject(value, key) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError(`CONFIG.${key} debe ser un objeto`);
        }
        return true;
    },

    isValidUrl(url, key) {
        try {
            if (url.startsWith('/')) {
                if (!/^\/[\w\-./]*$/.test(url)) {
                    throw new Error();
                }
            } else {
                new URL(url);
            }
            return true;
        } catch {
            throw new TypeError(`CONFIG.${key} debe ser una URL válida`);
        }
    }
};

// Constantes para límites de validación
const VALIDATION_LIMITS = {
    STRING: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 1000,
        URL_MAX_LENGTH: 2083 // IE máximo
    },
    NUMBER: {
        MIN_TIMEOUT: 1000,    // 1 segundo mínimo
        MAX_TIMEOUT: 30000,   // 30 segundos máximo
        MIN_RETRIES: 0,
        MAX_RETRIES: 5,
        MIN_INTERVAL: 1000,   // 1 segundo mínimo
        MAX_INTERVAL: 300000  // 5 minutos máximo
    },
    OBJECT: {
        MAX_DEPTH: 5,
        MAX_KEYS: 50
    }
};

// Esquemas de validación específicos por tipo de configuración
const CONFIG_SCHEMAS = {
    API_ENDPOINTS: {
        type: 'string',
        format: 'url',
        required: true,
        pattern: /^(?:\/[a-z0-9-_\/]+|https?:\/\/[^\s]+)$/i,
        minLength: 1,
        maxLength: VALIDATION_LIMITS.STRING.URL_MAX_LENGTH
    },
    TIMEOUTS: {
        type: 'number',
        required: true,
        min: VALIDATION_LIMITS.NUMBER.MIN_TIMEOUT,
        max: VALIDATION_LIMITS.NUMBER.MAX_TIMEOUT
    },
    RETRIES: {
        type: 'number',
        required: true,
        min: VALIDATION_LIMITS.NUMBER.MIN_RETRIES,
        max: VALIDATION_LIMITS.NUMBER.MAX_RETRIES
    },
    INTERVALS: {
        type: 'number',
        required: true,
        min: VALIDATION_LIMITS.NUMBER.MIN_INTERVAL,
        max: VALIDATION_LIMITS.NUMBER.MAX_INTERVAL
    },
    STATUS_OBJECT: {
        type: 'object',
        required: true,
        properties: {
            CONNECTED: { type: 'string', required: true },
            DISCONNECTED: { type: 'string', required: true },
            CHECKING: { type: 'string', required: true }
        },
        additionalProperties: false
    },
    FETCH_OPTIONS: {
        type: 'object',
        required: true,
        properties: {
            headers: {
                type: 'object',
                properties: {
                    'Content-Type': { 
                        type: 'string', 
                        pattern: /^application\/json$/i,
                        httpHeader: true  // Nuevo flag para indicar que es un header HTTP
                    },
                    'Accept': { 
                        type: 'string', 
                        pattern: /^application\/json$/i,
                        httpHeader: true
                    }
                },
                required: ['Content-Type', 'Accept'],
                validatePropertyName: (name) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)
            },
            mode: { 
                type: 'string', 
                enum: ['cors', 'no-cors', 'same-origin']
            },
            credentials: { 
                type: 'string',
                enum: ['same-origin', 'include', 'omit']
            },
            cache: {
                type: 'string',
                enum: ['default', 'no-store', 'reload', 'no-cache', 'force-cache']
            }
        }
    },
    UI_STATES: {
        type: 'object',
        required: true,
        properties: {
            IDLE: { type: 'string', required: true },
            LOADING: { type: 'string', required: true },
            SUCCESS: { type: 'string', required: true },
            ERROR: { type: 'string', required: true }
        },
        additionalProperties: false
    },
    MESSAGES: {
        type: 'object',
        required: true,
        properties: {
            NETWORK: { 
                type: 'string',
                minLength: 10,
                maxLength: 200
            },
            SERVER: { 
                type: 'string',
                minLength: 10,
                maxLength: 200
            },
            TIMEOUT: { 
                type: 'string',
                minLength: 10,
                maxLength: 200
            },
            VALIDATION: { 
                type: 'string',
                minLength: 10,
                maxLength: 200
            }
        },
        additionalProperties: false
    },
    CSS_CLASSES: {
        type: 'object',
        required: true,
        properties: {
            SUCCESS: { type: 'string', pattern: /^[a-zA-Z0-9-_]+$/ },
            ERROR: { type: 'string', pattern: /^[a-zA-Z0-9-_]+$/ },
            LOADING: { type: 'string', pattern: /^[a-zA-Z0-9-_]+$/ },
            HIDDEN: { type: 'string', pattern: /^[a-zA-Z0-9-_]+$/ }
        },
        additionalProperties: false
    },
    VALIDATION_RULES: {
        type: 'object',
        required: true,
        properties: {
            MAX_LENGTH: { 
                type: 'number',
                min: 1,
                max: 10000
            },
            MIN_LENGTH: { 
                type: 'number',
                min: 1,
                max: 1000
            }
        },
        custom: (value) => {
            if (value.MIN_LENGTH >= value.MAX_LENGTH) {
                throw new Error('MIN_LENGTH debe ser menor que MAX_LENGTH');
            }
            return true;
        }
    }
};

// Esquema de validación
const configSchema = {
    API_URL: {
        schema: CONFIG_SCHEMAS.API_ENDPOINTS,
        validators: ['isString', 'isValidUrl']
    },
    HEALTH_CHECK_ENDPOINT: {
        schema: CONFIG_SCHEMAS.API_ENDPOINTS,
        validators: ['isString', 'isValidUrl']
    },
    EXAMPLE_TEXT: {
        schema: {
            type: 'string',
            minLength: 10,
            maxLength: 1000,
            required: true
        },
        validators: ['isString']
    },
    TIMEOUT: {
        schema: CONFIG_SCHEMAS.TIMEOUTS,
        validators: ['isNumber']
    },
    MAX_RETRIES: {
        schema: CONFIG_SCHEMAS.RETRIES,
        validators: ['isNumber']
    },
    RETRY_DELAY: {
        schema: CONFIG_SCHEMAS.INTERVALS,
        validators: ['isNumber']
    },
    HEALTH_CHECK_INTERVAL: {
        schema: CONFIG_SCHEMAS.INTERVALS,
        validators: ['isNumber']
    },
    CONNECTION_STATUS: {
        schema: CONFIG_SCHEMAS.STATUS_OBJECT,
        validators: ['isObject']
    },
    FETCH_OPTIONS: {
        schema: CONFIG_SCHEMAS.FETCH_OPTIONS,
        validators: ['isObject']
    },
    LOADING_STATES: {
        schema: CONFIG_SCHEMAS.UI_STATES,
        validators: ['isObject']
    },
    ERROR_MESSAGES: {
        schema: CONFIG_SCHEMAS.MESSAGES,
        validators: ['isObject']
    },
    UI_CLASSES: {
        schema: CONFIG_SCHEMAS.CSS_CLASSES,
        validators: ['isObject']
    },
    VALIDATION: {
        schema: CONFIG_SCHEMAS.VALIDATION_RULES,
        validators: ['isObject']
    }
};

// Configuración por defecto como fallback
const DEFAULT_CONFIG = {
    API_URL: '/api/fallback',
    HEALTH_CHECK_ENDPOINT: '/api/health',
    EXAMPLE_TEXT: "Ejemplo de texto.",
    TIMEOUT: 5000,
    MAX_RETRIES: 1,
    RETRY_DELAY: 1000,
    HEALTH_CHECK_INTERVAL: 10000,
    CONNECTION_STATUS: {
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        CHECKING: 'checking'
    },
    CLEANUP_TIMEOUT: 5000,
    FETCH_OPTIONS: {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'same-origin'
    },
    LOADING_STATES: {
        IDLE: 'idle',
        LOADING: 'loading',
        SUCCESS: 'success',
        ERROR: 'error'
    },
    ERROR_MESSAGES: {
        NETWORK: 'Error de conexión',
        SERVER: 'Error del servidor',
        TIMEOUT: 'Tiempo de espera agotado',
        VALIDATION: 'Error de validación'
    },
    UI_CLASSES: {
        SUCCESS: 'success',
        ERROR: 'error',
        LOADING: 'loading',
        HIDDEN: 'hidden'
    },
    VALIDATION: {
        MAX_LENGTH: 500,
        MIN_LENGTH: 1
    }
};

// Función para validar objetos anidados recursivamente
const validateNestedObject = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') {
        throw new TypeError(`${path} debe ser un objeto`);
    }

    Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;

        // Validar key - Permitir formato de headers HTTP si estamos en un path de headers
        const isHeader = currentPath.includes('headers');
        const validKeyPattern = isHeader ? 
            /^[a-zA-Z][a-zA-Z0-9-]*$/ :  // Patrón para headers HTTP
            /^[a-zA-Z_][a-zA-Z0-9_]*$/;   // Patrón original para otras props

        if (!validKeyPattern.test(key)) {
            throw new TypeError(`${currentPath}: nombre de propiedad inválido`);
        }

        // Validar valor según tipo
        if (value === null || value === undefined) {
            throw new TypeError(`${currentPath} no puede ser null/undefined`);
        }

        switch (typeof value) {
            case 'string':
                if (!value.trim()) {
                    throw new TypeError(`${currentPath} no puede estar vacío`);
                }
                break;
            case 'number':
                if (!Number.isFinite(value) || value < 0) {
                    throw new TypeError(`${currentPath} debe ser un número válido positivo`);
                }
                break;
            case 'object':
                if (Array.isArray(value)) {
                    if (value.length === 0) {
                        throw new TypeError(`${currentPath} no puede ser un array vacío`);
                    }
                    value.forEach((item, i) => {
                        if (item === null || item === undefined) {
                            throw new TypeError(`${currentPath}[${i}] no puede ser null/undefined`);
                        }
                    });
                } else {
                    validateNestedObject(value, currentPath);
                }
                break;
        }
    });
};

// Función para crear configuración de fallback
const createFallbackConfig = (invalidConfig, validationErrors) => {
    if (!Array.isArray(validationErrors)) {
        throw new TypeError('validationErrors debe ser un array');
    }

    console.warn('Using fallback configuration due to validation errors:', validationErrors);

    const fallbackConfig = { ...DEFAULT_CONFIG };
    
    // Validar estructura mínima requerida
    const requiredKeys = [
        'API_URL',
        'HEALTH_CHECK_ENDPOINT',
        'TIMEOUT',
        'MAX_RETRIES'
    ];

    const missingKeys = requiredKeys.filter(key => !(key in fallbackConfig));
    if (missingKeys.length > 0) {
        throw new Error(`Configuración de fallback inválida: faltan claves requeridas: ${missingKeys.join(', ')}`);
    }

    if (invalidConfig && typeof invalidConfig === 'object') {
        for (const [key, value] of Object.entries(invalidConfig)) {
            try {
                // Validaciones específicas por tipo de configuración
                switch (key) {
                    case 'TIMEOUT':
                    case 'MAX_RETRIES':
                    case 'RETRY_DELAY':
                    case 'HEALTH_CHECK_INTERVAL':
                    case 'CLEANUP_TIMEOUT':
                        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                            fallbackConfig[key] = value;
                        }
                        break;

                    case 'API_URL':
                    case 'HEALTH_CHECK_ENDPOINT':
                        if (typeof value === 'string' && validateUrl(value)) {
                            fallbackConfig[key] = value;
                        }
                        break;

                    case 'FETCH_OPTIONS':
                        if (value && typeof value === 'object') {
                            // Validar headers
                            if (value.headers && typeof value.headers === 'object') {
                                fallbackConfig.FETCH_OPTIONS.headers = {
                                    ...fallbackConfig.FETCH_OPTIONS.headers,
                                    ...Object.fromEntries(
                                        Object.entries(value.headers)
                                            .filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
                                    )
                                };
                            }
                            // Validar mode
                            if (['cors', 'no-cors', 'same-origin'].includes(value.mode)) {
                                fallbackConfig.FETCH_OPTIONS.mode = value.mode;
                            }
                        }
                        break;

                    case 'VALIDATION':
                        if (value && typeof value === 'object') {
                            if (typeof value.MAX_LENGTH === 'number' && value.MAX_LENGTH > 0) {
                                fallbackConfig.VALIDATION.MAX_LENGTH = value.MAX_LENGTH;
                            }
                            if (typeof value.MIN_LENGTH === 'number' && value.MIN_LENGTH > 0) {
                                fallbackConfig.VALIDATION.MIN_LENGTH = Math.min(
                                    value.MIN_LENGTH,
                                    fallbackConfig.VALIDATION.MAX_LENGTH
                                );
                            }
                        }
                        break;

                    case 'ERROR_MESSAGES':
                    case 'UI_CLASSES':
                    case 'CONNECTION_STATUS':
                    case 'LOADING_STATES':
                        if (value && typeof value === 'object') {
                            // Validar que todos los valores sean strings no vacíos
                            const validEntries = Object.entries(value)
                                .filter(([k, v]) => 
                                    typeof k === 'string' && 
                                    typeof v === 'string' && 
                                    v.trim().length > 0
                                );
                            if (validEntries.length > 0) {
                                fallbackConfig[key] = {
                                    ...fallbackConfig[key],
                                    ...Object.fromEntries(validEntries)
                                };
                            }
                        }
                        break;
                }
            } catch (e) {
                console.warn(`Invalid value for ${key}, using default:`, e);
            }
        }
    }

    // Validar la configuración resultante
    try {
        validateNestedObject(fallbackConfig);
    } catch (error) {
        console.error('Fallback config validation failed:', error);
        // Si falla la validación, retornar configuración por defecto pura
        return Object.freeze({...DEFAULT_CONFIG});
    }

    return Object.freeze(fallbackConfig);
};

// Nueva clase de error para configuración
class ConfigValidationError extends Error {
    constructor(message, errors) {
        super(message);
        this.name = 'ConfigValidationError';
        this.errors = errors;
    }
}

// Función de validación principal
const validateConfig = (config) => {
    const errors = [];
    
    // Validar estructura básica
    if (!config || typeof config !== 'object') {
        throw new ConfigValidationError('Configuration must be an object', ['Invalid configuration type']);
    }

    // Validar propiedades requeridas y tipos
    for (const [key, validations] of Object.entries(configSchema)) {
        if (!(key in config)) {
            errors.push(`Missing required property: ${key}`);
            continue;
        }

        validations.validators.forEach(validationType => {
            const validator = validators[validationType];
            if (!validator) {
                errors.push(`Unknown validator: ${validationType}`);
                return;
            }
            
            try {
                validator(config[key], key);
            } catch (error) {
                errors.push(`${key}: ${error.message}`);
            }
        });
    }

    // Validar objetos anidados
    try {
        validateNestedObject(config);
    } catch (error) {
        errors.push(`Nested validation error: ${error.message}`);
    }

    // Agregar validación contra esquemas
    Object.entries(configSchema).forEach(([key, { schema, validators }]) => {
        try {
            validateAgainstSchema(config[key], schema, key);
        } catch (error) {
            errors.push(`${key}: ${error.message}`);
        }
    });

    if (errors.length > 0) {
        throw new ConfigValidationError('Configuration validation failed', errors);
    }

    return true;
};

// Función mejorada para validar contra esquema
const validateAgainstSchema = (value, schema, path = '') => {
    if (!schema || typeof schema !== 'object') {
        throw new TypeError('Invalid schema configuration');
    }

    // Validar requerido
    if (schema.required && (value === undefined || value === null)) {
        throw new Error(`${path} es requerido`);
    }

    // Si el valor es undefined/null y no es requerido, es válido
    if (value === undefined || value === null) {
        return true;
    }

    // Validar tipo
    if (schema.type && typeof value !== schema.type) {
        throw new TypeError(`${path} debe ser de tipo ${schema.type}`);
    }

    // Validaciones específicas por tipo
    switch (schema.type) {
        case 'string':
            validateString(value, schema, path);
            break;
        case 'number':
            validateNumber(value, schema, path);
            break;
        case 'object':
            validateObject(value, schema, path);
            break;
        case 'array':
            validateArray(value, schema, path);
            break;
    }

    // Validación custom si existe
    if (schema.custom && typeof schema.custom === 'function') {
        schema.custom(value);
    }

    return true;
};

// Funciones auxiliares de validación
const validateString = (value, schema, path) => {
    if (schema.minLength && value.length < schema.minLength) {
        throw new Error(`${path} debe tener al menos ${schema.minLength} caracteres`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
        throw new Error(`${path} no debe exceder ${schema.maxLength} caracteres`);
    }
    if (schema.pattern && !schema.pattern.test(value)) {
        throw new Error(`${path} no cumple con el formato requerido`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
        throw new Error(`${path} debe ser uno de: ${schema.enum.join(', ')}`);
    }
    if (schema.format === 'url') {
        validateUrl(value);
    }
};

const validateNumber = (value, schema, path) => {
    if (!Number.isFinite(value)) {
        throw new TypeError(`${path} debe ser un número válido`);
    }
    if (schema.min !== undefined && value < schema.min) {
        throw new Error(`${path} no debe ser menor que ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
        throw new Error(`${path} no debe ser mayor que ${schema.max}`);
    }
};

const validateObject = (value, schema, path) => {
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${path} debe ser un objeto`);
    }

    // Validar nombre de propiedades si existe un validador personalizado
    if (schema.validatePropertyName) {
        Object.keys(value).forEach(key => {
            if (!schema.validatePropertyName(key)) {
                throw new Error(`${path}: nombre de propiedad inválido: ${key}`);
            }
        });
    }

    // Validar profundidad máxima
    const depth = getObjectDepth(value);
    if (depth > VALIDATION_LIMITS.OBJECT.MAX_DEPTH) {
        throw new Error(`${path} excede la profundidad máxima permitida`);
    }

    // Validar número máximo de keys
    const keys = Object.keys(value);
    if (keys.length > VALIDATION_LIMITS.OBJECT.MAX_KEYS) {
        throw new Error(`${path} excede el número máximo de propiedades`);
    }

    // Validar propiedades requeridas
    if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
            if (propSchema.required && !(key in value)) {
                throw new Error(`${path ? path + '.' : ''}${key} es requerido`);
            }
            if (key in value) {
                validateAgainstSchema(
                    value[key], 
                    propSchema, 
                    path ? `${path}.${key}` : key
                );
            }
        });
    }

    // Validar propiedades adicionales
    if (schema.additionalProperties === false) {
        const allowedKeys = Object.keys(schema.properties || {});
        const extraKeys = Object.keys(value).filter(k => !allowedKeys.includes(k));
        if (extraKeys.length > 0) {
            throw new Error(`${path} contiene propiedades no permitidas: ${extraKeys.join(', ')}`);
        }
    }
};

const validateArray = (value, schema, path) => {
    if (!Array.isArray(value)) {
        throw new TypeError(`${path} debe ser un array`);
    }
    if (schema.minItems && value.length < schema.minItems) {
        throw new Error(`${path} debe tener al menos ${schema.minItems} elementos`);
    }
    if (schema.maxItems && value.length > schema.maxItems) {
        throw new Error(`${path} no debe exceder ${schema.maxItems} elementos`);
    }
    if (schema.items) {
        value.forEach((item, index) => {
            validateAgainstSchema(
                item, 
                schema.items, 
                `${path}[${index}]`
            );
        });
    }
};

// Función auxiliar para obtener la profundidad de un objeto
const getObjectDepth = (obj, current = 0) => {
    if (!obj || typeof obj !== 'object') return current;
    return Math.max(
        ...Object.values(obj)
            .map(value => getObjectDepth(value, current + 1))
    );
};

// Modificar creación del CONFIG
let CONFIG;
try {
    const baseConfig = {
        ...envConfig,
        EXAMPLE_TEXT: "Esta película es excelente, me encantó cada minuto. La actuación fue impresionante y la historia me mantuvo al borde de mi asiento.",
        TIMEOUT: 15000,
        MAX_RETRIES: 2,
        RETRY_DELAY: 1000,
        HEALTH_CHECK_INTERVAL: 5000,
        CONNECTION_STATUS: {
            CONNECTED: 'connected',
            DISCONNECTED: 'disconnected',
            CHECKING: 'checking'
        },
        CLEANUP_TIMEOUT: 30000, // Timeout para limpieza de recursos
        FETCH_OPTIONS: {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors',  // Explicitly set CORS mode
            credentials: 'same-origin'
        },
        LOADING_STATES: {
            IDLE: 'idle',
            LOADING: 'loading',
            SUCCESS: 'success',
            ERROR: 'error'
        },
        ERROR_MESSAGES: {
            NETWORK: 'Error de conexión. Por favor, verifica tu conexión a internet.',
            SERVER: 'Error del servidor. Por favor, intenta más tarde.',
            TIMEOUT: 'La solicitud ha excedido el tiempo de espera.',
            VALIDATION: 'Por favor, ingresa un texto válido para analizar.'
        },
        UI_CLASSES: {
            SUCCESS: 'success',
            ERROR: 'error',
            LOADING: 'loading',
            HIDDEN: 'hidden'
        },
        VALIDATION: {
            MAX_LENGTH: 1000,
            MIN_LENGTH: 1
        },
        CRITICAL_ELEMENTS: ['form', 'input', 'responseContainer']
    };

    validateConfig(baseConfig);
    CONFIG = Object.freeze(baseConfig);

} catch (error) {
    if (error instanceof ConfigValidationError) {
        // Crear configuración de fallback si la validación falla
        CONFIG = createFallbackConfig(
            { ...envConfig }, // Configuración original inválida
            error.errors     // Lista de errores de validación
        );
        
        // Registrar el uso de configuración de fallback
        console.warn(
            'Using fallback configuration due to validation errors:',
            error.errors
        );
    } else {
        // Error crítico que no podemos manejar
        throw new Error(`Critical configuration error: ${error.message}`);
    }
}

// Asegurar que CONFIG es inmutable incluso en modo fallback
Object.freeze(CONFIG.CONNECTION_STATUS);
Object.freeze(CONFIG.LOADING_STATES);
Object.freeze(CONFIG.ERROR_MESSAGES);
Object.freeze(CONFIG.UI_CLASSES);
Object.freeze(CONFIG.VALIDATION);

// Separar elementos obligatorios de opcionales
const requiredElements = {
    form: 'queryForm',  // Corregido para coincidir con el nuevo ID
    input: 'queryInput',
    responseContainer: 'responseContainer',
    responseText: 'responseText',
    loading: 'loadingIndicator',
    error: 'errorMessage'
};

const optionalElements = {
    exampleButton: 'exampleButton',
    clearButton: 'clearButton',
    serverStatus: 'serverStatus'
};

// Función para validar duplicados en IDs
const validateElementIds = (requiredElements, optionalElements) => {
    const allIds = new Set();
    const duplicates = new Set();

    // Helper para verificar y registrar duplicados
    const checkAndAddId = (id, source) => {
        if (typeof id !== 'string') {
            throw new TypeError(`ID inválido encontrado en ${source}: ${id}`);
        }
        if (allIds.has(id)) {
            duplicates.add(id);
        }
        allIds.add(id);
    };

    // Verificar elementos requeridos
    Object.entries(requiredElements).forEach(([key, id]) => {
        checkAndAddId(id, `elementos requeridos (${key})`);
    });

    // Verificar elementos opcionales
    Object.entries(optionalElements).forEach(([key, id]) => {
        checkAndAddId(id, `elementos opcionales (${key})`);
    });

    // Si hay duplicados, lanzar error
    if (duplicates.size > 0) {
        throw new Error(
            `IDs duplicados encontrados: ${Array.from(duplicates).join(', ')}. ` +
            'Cada elemento debe tener un ID único.'
        );
    }

    return true;
};

// Validar elementos antes de exportar
try {
    validateElementIds(requiredElements, optionalElements);
} catch (error) {
    console.error('Error en la validación de IDs:', error);
    throw error;
}

export { 
    CONFIG, 
    requiredElements, 
    optionalElements,
    ConfigValidationError, // Exportar para manejo externo
    DEFAULT_CONFIG        // Exportar para testing/debugging
};