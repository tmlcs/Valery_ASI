import { RateLimiter } from '../RateLimiter.js';

describe('RateLimiter', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimiter(2, 1000); // 2 requests per second
    });

    afterEach(() => {
        if (rateLimiter) {
            rateLimiter.dispose();
        }
    });

    test('should validate constructor parameters', () => {
        expect(() => new RateLimiter(-1)).toThrow();
        expect(() => new RateLimiter(0)).toThrow();
        expect(() => new RateLimiter(1, -1)).toThrow();
    });

    test('should handle dispose correctly', async () => {
        rateLimiter = new RateLimiter(2, 1000);
        rateLimiter.dispose();
        await expect(rateLimiter.tryAcquire()).rejects.toThrow();
    });

    test('should allow requests within rate limit', async () => {
        const result1 = await rateLimiter.tryAcquire();
        const result2 = await rateLimiter.tryAcquire();
        
        expect(result1).toBe(true);
        expect(result2).toBe(true);
    });

    test('should block requests exceeding rate limit', async () => {
        await rateLimiter.tryAcquire();
        await rateLimiter.tryAcquire();
        const result = await rateLimiter.tryAcquire();
        
        expect(result).toBe(false);
    });

    test('should allow requests after timeout', async () => {
        await rateLimiter.tryAcquire();
        await rateLimiter.tryAcquire();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await rateLimiter.tryAcquire();
        expect(result).toBe(true);
    });

    test('should handle concurrent requests correctly', async () => {
        const results = await Promise.all([
            rateLimiter.tryAcquire(),
            rateLimiter.tryAcquire(),
            rateLimiter.tryAcquire()
        ]);

        expect(results).toEqual([true, true, false]);
    });

    test('should accept options object in constructor', () => {
        expect(() => new RateLimiter({ maxRequests: 2, timeWindow: 1000 })).not.toThrow();
        expect(() => new RateLimiter({ maxRequests: -1 })).toThrow();
    });

    test('should return correct stats', () => {
        const stats = rateLimiter.getStats();
        expect(stats).toHaveProperty('currentRequests');
        expect(stats).toHaveProperty('maxRequests');
        expect(stats).toHaveProperty('timeWindow');
        expect(stats).toHaveProperty('isDisposed');
    });

    test('should handle minimum timeWindow correctly', () => {
        expect(() => new RateLimiter(1, 50)).toThrow();
    });

    test('rejects maxRequests exceeding limit', () => {
        expect(() => new RateLimiter(10001)).toThrow('maxRequests cannot exceed 10000');
        expect(() => new RateLimiter({ maxRequests: 10001 })).toThrow('maxRequests cannot exceed 10000');
    });

    test('validates timeWindow bounds', () => {
        expect(() => new RateLimiter(1, 50)).toThrow('timeWindow must be an integer >= 100ms');
        expect(() => new RateLimiter(1, 3600001)).toThrow('timeWindow must be an integer <= 3600000ms');
        expect(() => new RateLimiter({ timeWindow: 50 })).toThrow('timeWindow must be an integer >= 100ms');
    });

    test('handles array size limit', async () => {
        const limiter = new RateLimiter(10000, 1000);
        const promises = [];
        
        // Intentar llenar el array más allá del límite
        for (let i = 0; i < 10100; i++) {
            promises.push(limiter.tryAcquire());
        }
        
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r === true).length;
        
        expect(successCount).toBeLessThanOrEqual(10000);
    });

    test('cleanup optimizes array operations', async () => {
        const limiter = new RateLimiter(1000, 1000);
        // En lugar de espiar la propiedad privada, verificamos el comportamiento
        const initialStats = limiter.getStats();
        
        // Llenar con requests
        for (let i = 0; i < 100; i++) {
            await limiter.tryAcquire();
        }
        
        const midStats = limiter.getStats();
        // Esperar a que algunos requests expiren
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Forzar limpieza
        await limiter.tryAcquire();
        
        const finalStats = limiter.getStats();
        // Verificar que la limpieza funcionó
        expect(finalStats.currentRequests).toBeLessThan(midStats.currentRequests);
    });
});
