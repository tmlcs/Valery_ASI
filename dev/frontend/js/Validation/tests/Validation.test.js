import { Validation } from '../Validation';

describe('Validation', () => {
    describe('validatePositiveInteger', () => {
        it('should accept valid positive integers', () => {
            expect(() => Validation.validatePositiveInteger(1, 'test')).not.toThrow();
            expect(() => Validation.validatePositiveInteger(100, 'test')).not.toThrow();
        });

        it('should reject non-positive integers', () => {
            expect(() => Validation.validatePositiveInteger(0, 'test')).toThrow('test must be a positive integer');
            expect(() => Validation.validatePositiveInteger(-1, 'test')).toThrow('test must be a positive integer');
        });

        it('should reject non-integers', () => {
            expect(() => Validation.validatePositiveInteger(1.5, 'test')).toThrow('test must be a positive integer');
            expect(() => Validation.validatePositiveInteger('1', 'test')).toThrow('test must be a positive integer');
        });
    });

    describe('validateNonNegativeInteger', () => {
        it('should accept zero and positive integers', () => {
            expect(() => Validation.validateNonNegativeInteger(0, 'test')).not.toThrow();
            expect(() => Validation.validateNonNegativeInteger(1, 'test')).not.toThrow();
        });

        it('should reject negative numbers', () => {
            expect(() => Validation.validateNonNegativeInteger(-1, 'test')).toThrow('test must be a non-negative integer');
        });
    });

    describe('validatePositiveNumber', () => {
        it('should accept positive numbers', () => {
            expect(() => Validation.validatePositiveNumber(0.1, 'test')).not.toThrow();
            expect(() => Validation.validatePositiveNumber(1.5, 'test')).not.toThrow();
        });

        it('should reject non-positive numbers', () => {
            expect(() => Validation.validatePositiveNumber(0, 'test')).toThrow('test must be a positive number');
            expect(() => Validation.validatePositiveNumber(-1, 'test')).toThrow('test must be a positive number');
        });

        it('should reject non-finite numbers', () => {
            expect(() => Validation.validatePositiveNumber(Infinity, 'test')).toThrow('test must be a positive number');
            expect(() => Validation.validatePositiveNumber(NaN, 'test')).toThrow('test must be a positive number');
        });
    });

    describe('validateObject', () => {
        it('should accept valid objects', () => {
            expect(() => Validation.validateObject({}, 'test')).not.toThrow();
            expect(() => Validation.validateObject({ key: 'value' }, 'test')).not.toThrow();
        });

        it('should reject non-objects', () => {
            expect(() => Validation.validateObject(null, 'test')).toThrow('test must be a non-null object');
            expect(() => Validation.validateObject(undefined, 'test')).toThrow('test must be a non-null object');
            expect(() => Validation.validateObject([], 'test')).toThrow('test must be a non-null object');
        });

        it('should reject primitive values', () => {
            expect(() => Validation.validateObject(123, 'test')).toThrow('test must be a non-null object');
            expect(() => Validation.validateObject('string', 'test')).toThrow('test must be a non-null object');
            expect(() => Validation.validateObject(true, 'test')).toThrow('test must be a non-null object');
        });
    });

    describe('validateFunction', () => {
        it('should accept functions', () => {
            expect(() => Validation.validateFunction(() => {}, 'test')).not.toThrow();
            expect(() => Validation.validateFunction(function(){}, 'test')).not.toThrow();
        });

        it('should reject non-functions', () => {
            expect(() => Validation.validateFunction({}, 'test')).toThrow('test must be a function');
            expect(() => Validation.validateFunction(null, 'test')).toThrow('test must be a function');
        });

        it('should reject primitive values', () => {
            expect(() => Validation.validateFunction(123, 'test')).toThrow('test must be a function');
            expect(() => Validation.validateFunction('string', 'test')).toThrow('test must be a function');
            expect(() => Validation.validateFunction(true, 'test')).toThrow('test must be a function');
        });
    });

    describe('validateTimeoutValue', () => {
        it('should accept valid timeout values', () => {
            expect(() => Validation.validateTimeoutValue(100, 'test')).not.toThrow();
            expect(() => Validation.validateTimeoutValue(1000, 'test')).not.toThrow();
        });

        it('should reject invalid timeout values', () => {
            expect(() => Validation.validateTimeoutValue(99, 'test')).toThrow('test must be an integer >= 100ms');
            expect(() => Validation.validateTimeoutValue(-1, 'test')).toThrow('test must be an integer >= 100ms');
            expect(() => Validation.validateTimeoutValue(100.5, 'test')).toThrow('test must be an integer >= 100ms');
            expect(() => Validation.validateTimeoutValue(null, 'test')).toThrow('test must be an integer >= 100ms');
            expect(() => Validation.validateTimeoutValue(undefined, 'test')).toThrow('test must be an integer >= 100ms');
            expect(() => Validation.validateTimeoutValue('100', 'test')).toThrow('test must be an integer >= 100ms');
        });

        it('should accept custom minimum values', () => {
            expect(() => Validation.validateTimeoutValue(50, 'test', 50)).not.toThrow();
            expect(() => Validation.validateTimeoutValue(49, 'test', 50)).toThrow('test must be an integer >= 50ms');
        });

        it('should validate minimum value parameter', () => {
            expect(() => Validation.validateTimeoutValue(100, 'test', -1)).toThrow();
            expect(() => Validation.validateTimeoutValue(100, 'test', 'invalid')).toThrow();
        });
    });

    describe('validateNonEmptyArray', () => {
        it('should accept non-empty arrays', () => {
            expect(() => Validation.validateNonEmptyArray([1], 'test')).not.toThrow();
            expect(() => Validation.validateNonEmptyArray(['test'], 'test')).not.toThrow();
        });

        it('should reject empty arrays', () => {
            expect(() => Validation.validateNonEmptyArray([], 'test')).toThrow('test must be a non-empty array');
        });

        it('should reject non-arrays', () => {
            expect(() => Validation.validateNonEmptyArray({}, 'test')).toThrow('test must be a non-empty array');
            expect(() => Validation.validateNonEmptyArray(null, 'test')).toThrow('test must be a non-empty array');
        });
    });

    describe('validateNonEmptyString', () => {
        it('should accept non-empty strings', () => {
            expect(() => Validation.validateNonEmptyString('test', 'test')).not.toThrow();
        });

        it('should reject empty strings', () => {
            expect(() => Validation.validateNonEmptyString('', 'test')).toThrow('test must be a non-empty string');
            expect(() => Validation.validateNonEmptyString('   ', 'test')).toThrow('test must be a non-empty string');
        });
    });

    describe('validateEmail', () => {
        it('should accept valid emails', () => {
            expect(() => Validation.validateEmail('test@example.com', 'test')).not.toThrow();
        });

        it('should reject invalid emails', () => {
            expect(() => Validation.validateEmail('invalid', 'test')).toThrow('test must be a valid email address');
            expect(() => Validation.validateEmail('test@', 'test')).toThrow('test must be a valid email address');
        });
    });

    // Nuevas pruebas para validateUrl
    describe('validateUrl', () => {
        it('should accept valid URLs', () => {
            expect(() => Validation.validateUrl('https://example.com', 'test')).not.toThrow();
            expect(() => Validation.validateUrl('http://sub.example.com/path', 'test')).not.toThrow();
            expect(() => Validation.validateUrl('https://example.com/path?query=1', 'test')).not.toThrow();
            expect(() => Validation.validateUrl('https://example.com:8080', 'test')).not.toThrow();
        });

        it('should reject invalid URLs', () => {
            expect(() => Validation.validateUrl('not-a-url', 'test')).toThrow('test must be a valid URL');
            expect(() => Validation.validateUrl('ftp://example.com', 'test')).toThrow('test must be a valid HTTP/HTTPS URL');
            expect(() => Validation.validateUrl('', 'test')).toThrow('test must be a valid URL');
        });

        it('should reject non-string inputs', () => {
            expect(() => Validation.validateUrl(null, 'test')).toThrow('test must be a string');
            expect(() => Validation.validateUrl(undefined, 'test')).toThrow('test must be a string');
            expect(() => Validation.validateUrl(123, 'test')).toThrow('test must be a string');
            expect(() => Validation.validateUrl({}, 'test')).toThrow('test must be a string');
        });

        it('should reject URLs with invalid characters', () => {
            expect(() => Validation.validateUrl('https://example.com/<script>', 'test')).toThrow('test contains invalid characters');
            expect(() => Validation.validateUrl('https://example.com/§±', 'test')).toThrow('test contains invalid characters');
        });

        it('should reject URLs exceeding maximum length', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(2048);
            expect(() => Validation.validateUrl(longUrl, 'test')).toThrow('test exceeds maximum length');
        });
    });
});
