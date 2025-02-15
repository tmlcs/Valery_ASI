/**
 * Utility class for common validation operations
 */
export class Validation {
    /**
     * Validates if a value is a positive integer
     * @param {number} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a positive integer
     */
    static validatePositiveInteger(value, name) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new Error(`${name} must be a positive integer`);
        }
    }

    /**
     * Validates if a value is a non-negative integer
     * @param {number} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a non-negative integer
     */
    static validateNonNegativeInteger(value, name) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`${name} must be a non-negative integer`);
        }
    }

    /**
     * Validates if a value is a positive number
     * @param {number} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a positive number
     */
    static validatePositiveNumber(value, name) {
        if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
            throw new Error(`${name} must be a positive number`);
        }
    }

    /**
     * Validates if a value is a non-null object
     * @param {object} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a non-null object
     */
    static validateObject(value, name) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`${name} must be a non-null object`);
        }
    }

    /**
     * Validates if a value is a function
     * @param {function} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a function
     */
    static validateFunction(value, name) {
        if (typeof value !== 'function') {
            throw new Error(`${name} must be a function`);
        }
    }

    /**
     * Validates if a value is a valid timeout value
     * @param {number} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @param {number} [minValue=100] - Minimum value for the timeout
     * @param {number} [maxValue=300000] - Maximum value for the timeout
     * @throws {Error} If value is not a valid timeout value
     */
    static validateTimeoutValue(value, name, minValue = 100, maxValue = 300000) {
        if (!Number.isInteger(minValue) || minValue < 0) {
            throw new Error('minimum value must be a non-negative integer');
        }
        if (!Number.isInteger(maxValue) || maxValue <= minValue) {
            throw new Error('maximum value must be greater than minimum value');
        }
        if (!Number.isInteger(value) || value < minValue) {
            throw new Error(`${name} must be an integer >= ${minValue}ms`);
        }
        if (value > maxValue) {
            throw new Error(`${name} must be an integer <= ${maxValue}ms`);
        }
    }

    /**
     * Validates if a value is a non-empty array
     * @param {any[]} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not an array or is empty
     */
    static validateNonEmptyArray(value, name) {
        if (!Array.isArray(value) || value.length === 0) {
            throw new Error(`${name} must be a non-empty array`);
        }
    }

    /**
     * Validates if a value is a non-empty string
     * @param {string} value - The value to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a string or is empty
     */
    static validateNonEmptyString(value, name) {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${name} must be a non-empty string`);
        }
    }

    /**
     * Validates if a string is a valid email
     * @param {string} value - The email to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a valid email
     */
    static validateEmail(value, name) {
        // Mejorar validación de email
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (typeof value !== 'string' || !emailRegex.test(value) || value.length > 254) {
            throw new Error(`${name} must be a valid email address`);
        }
    }

    /**
     * Validates if a string is a valid URL
     * @param {string} value - The URL to validate
     * @param {string} name - Name of the parameter for error message
     * @throws {Error} If value is not a valid URL
     */
    static validateUrl(value, name) {
        if (typeof value !== 'string') {
            throw new Error(`${name} must be a string`);
        }

        // Validar longitud máxima primero
        if (value.length > 2048) {
            throw new Error(`${name} exceeds maximum length`);
        }

        // Mejorar validación de URL
        const urlRegex = new RegExp(
            '^(https?:\/\/)?' + // protocolo
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // dominio
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // O ip
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // puerto y path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', // fragment
            'i'
        );

        // Validar caracteres permitidos usando una expresión regular más estricta
        if (!urlRegex.test(value)) {
            throw new Error(`${name} contains invalid characters`);
        }

        try {
            const url = new URL(value);
            // Validar específicamente los protocolos HTTP/HTTPS
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error(`${name} must be a valid HTTP/HTTPS URL`);
            }
        } catch (error) {
            // Si el error es de la validación del protocolo, propagarlo
            if (error.message.includes('HTTP/HTTPS')) {
                throw error;
            }
            // Para otros errores de URL, usar el mensaje genérico esperado por el test
            throw new Error(`${name} must be a valid URL`);
        }
    }
}
