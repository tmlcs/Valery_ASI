import { CircuitBreaker } from '../CircuitBreaker';
import { jest } from '@jest/globals';

describe('CircuitBreaker', () => {
  let circuitBreaker;
  const mockFunction = jest.fn();
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(mockFunction, {
      failureThreshold: 3,
      recoveryTimeout: 1000
    });
    mockFunction.mockClear();
  });

  afterEach(() => {
    if (circuitBreaker) {
      circuitBreaker.dispose();
    }
    jest.clearAllMocks();
  });

  test('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  test('should move to OPEN state after failures exceed threshold', async () => {
    mockFunction.mockRejectedValue(new Error('Service error'));

    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute();
      } catch (error) {
        expect(error.message).toBe('Service error');
      }
    }

    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  test('should reject calls when in OPEN state', async () => {
    circuitBreaker.forceOpen();

    await expect(circuitBreaker.execute()).rejects.toThrow('Circuit breaker is OPEN');
  });

  test('should move to HALF_OPEN state after recovery timeout', async () => {
    circuitBreaker.forceOpen();
    
    // Aumentar el tiempo de espera
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(circuitBreaker.getState()).toBe('HALF_OPEN');
  }, 2000);

  test('should reset to CLOSED state after successful call in HALF_OPEN', async () => {
    circuitBreaker.forceHalfOpen();
    mockFunction.mockResolvedValue('success');

    await circuitBreaker.execute();
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  test('should return original function result when circuit is CLOSED', async () => {
    mockFunction.mockResolvedValue('success');
    
    const result = await circuitBreaker.execute();
    expect(result).toBe('success');
  });

  test('should validate constructor parameters', () => {
    expect(() => new CircuitBreaker(null)).toThrow();
    expect(() => new CircuitBreaker(() => {}, null)).toThrow();
    expect(() => new CircuitBreaker(() => {}, { failureThreshold: -1 })).toThrow();
  });

  test('should handle concurrent calls correctly', async () => {
    mockFunction.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('ok'), 10)));
    
    const results = await Promise.all([
        circuitBreaker.execute(),
        circuitBreaker.execute(),
        circuitBreaker.execute()
    ]);
    
    expect(results).toEqual(['ok', 'ok', 'ok']);
  });

  test('should properly handle dispose', async () => {
    circuitBreaker.dispose();
    await expect(circuitBreaker.execute()).rejects.toThrow();
    expect(circuitBreaker.state).toBe('DISPOSED');
  });

  test('should handle concurrent state transitions correctly', async () => {
    const cb = new CircuitBreaker(mockFunction, {
      failureThreshold: 2,
      resetTimeout: 1000  // Cambiado de 100 a 1000
    });
    
    mockFunction.mockRejectedValue(new Error('Failed'));
    
    await Promise.all([
      expect(cb.execute()).rejects.toThrow(),
      expect(cb.execute()).rejects.toThrow()
    ]);
    
    expect(cb.getState()).toBe('OPEN');
  });

  test('should handle operation timeout', async () => {
    const cb = new CircuitBreaker(
        () => new Promise(resolve => setTimeout(resolve, 1500)),
        { operationTimeout: 1000 }
    );
    
    await expect(cb.execute()).rejects.toThrow('Operation timeout');
  }, 2000);

  test('should maintain state consistency under load', async () => {
    const cb = new CircuitBreaker(mockFunction, {
      failureThreshold: 3,
      resetTimeout: 1000  // Cambiado de 100 a 1000
    });
    
    mockFunction.mockRejectedValue(new Error('Failed'));
    
    const promises = Array(10).fill().map(() => cb.execute().catch(() => {}));
    await Promise.all(promises);
    
    expect(cb.getState()).toBe('OPEN');
  });

  test('should collect accurate statistics', async () => {
    mockFunction.mockRejectedValue(new Error('Test error'));
    
    try {
      await circuitBreaker.execute();
    } catch (error) {
      const stats = circuitBreaker.getStats();
      expect(stats).toMatchObject({
        state: 'CLOSED',
        failureCount: 1,
        lastFailureTime: expect.any(Number)
      });
    }
  });

  test('should respect operation timeout', async () => {
    const slowCb = new CircuitBreaker(
      () => new Promise(resolve => setTimeout(resolve, 2000)),
      { operationTimeout: 1000 }
    );
    
    await expect(slowCb.execute()).rejects.toThrow('Operation timeout');
  });

  test('should reset failure count after successful execution', async () => {
    mockFunction.mockRejectedValueOnce(new Error('Fail'))
               .mockRejectedValueOnce(new Error('Fail'))
               .mockResolvedValue('Success');

    try { await circuitBreaker.execute(); } catch {}
    try { await circuitBreaker.execute(); } catch {}
    await circuitBreaker.execute();

    const stats = circuitBreaker.getStats();
    expect(stats.failureCount).toBe(0);
  });
});
