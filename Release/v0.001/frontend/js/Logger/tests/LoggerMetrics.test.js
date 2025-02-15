import { jest } from '@jest/globals';
import { LoggerMetrics } from '../LoggerMetrics';

describe('LoggerMetrics', () => {
    let metrics;

    beforeEach(() => {
        metrics = new LoggerMetrics();
    });

    afterEach(() => {
        if (metrics) {
            metrics.dispose();
        }
    });

    test('tracks log entries correctly', async () => {
        await metrics.trackLogEntry(100, 1000, 500);
        const result = metrics.getMetrics();
        
        expect(result.totalLogs).toBe(1);
        expect(result.avgProcessingTime).toBe(100);
        expect(result.compressionRatio).toBe(0.5);
    });

    test('handles negative values correctly', async () => {
        await expect(metrics.trackLogEntry(-100)).rejects.toThrow('Processing time must be a valid number');
    });

    test('handles concurrent tracking', async () => {
        const promises = Array.from({ length: 100 }, () =>
            Promise.resolve().then(() => metrics.trackLogEntry(100, 1000, 500))
        );
        try {
            await Promise.all(promises);
            const result = metrics.getMetrics();
            expect(result.totalLogs).toBe(100);
        } catch (error) {
            throw error;
        }
    });

    test('handles overflow values', () => {
        expect(() => metrics.trackLogEntry(Number.MAX_VALUE)).toThrow();
    });

    test('validates input parameters', () => {
        expect(() => metrics.trackLogEntry(-1)).toThrow();
        expect(() => metrics.trackLogEntry(Number.MAX_VALUE + 1)).toThrow();
        expect(() => metrics.trackLogEntry(100, -1)).toThrow();
        expect(() => metrics.trackLogEntry(100, 1000, 2000)).toThrow();
    });

    test('handles cleanup of old metrics', () => {
        const mockDate = new Date(2023, 0, 1);
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        metrics.trackLogEntry(100, 1000, 500);
        mockDate.setHours(mockDate.getHours() + 2);
        
        const result = metrics.getMetrics();
        expect(result.totalLogs).toBe(1);
    });

    test('maintains accurate averages over time', () => {
        const entries = [
            { time: 100, size: 1000, compressed: 500 },
            { time: 200, size: 2000, compressed: 1000 },
            { time: 300, size: 3000, compressed: 1500 }
        ];
        
        entries.forEach(e => metrics.trackLogEntry(e.time, e.size, e.compressed));
        
        const result = metrics.getMetrics();
        expect(result.totalLogs).toBe(3);
        expect(result.avgProcessingTime).toBe(200);
        expect(result.compressionRatio).toBeCloseTo(0.5);
    });

    test('handles concurrent operations safely', async () => {
        const operations = Array.from({ length: 100 }, () => ({
            processingTime: 100,
            size: 1000,
            compressedSize: 500
        }));

        await Promise.all(
            operations.map(op => 
                metrics.trackLogEntry(op.processingTime, op.size, op.compressedSize)
            )
        );

        const result = metrics.getMetrics();
        expect(result.totalLogs).toBe(100);
    });

    test('validates numeric boundaries', () => {
        expect(() => 
            metrics.trackLogEntry(Number.MAX_SAFE_INTEGER + 1, 1000, 500)
        ).rejects.toThrow('Processing time out of valid range');

        expect(() => 
            metrics.trackLogEntry(100, -1, 500)
        ).rejects.toThrow('Size out of valid range');

        expect(() => 
            metrics.trackLogEntry(100, 1000, 2000)
        ).rejects.toThrow('Invalid compressed size');
    });

    test('handles non-numeric values', () => {
        expect(() => 
            metrics.trackLogEntry('100', 1000, 500)
        ).rejects.toThrow('Processing time must be a valid number');

        expect(() => 
            metrics.trackLogEntry(100, '1000', 500)
        ).rejects.toThrow('Size must be a valid number');

        expect(() => 
            metrics.trackLogEntry(100, 1000, '500')
        ).rejects.toThrow('Compressed size must be a valid number');
    });

    test('handles NaN and Infinity', () => {
        expect(() => 
            metrics.trackLogEntry(NaN, 1000, 500)
        ).rejects.toThrow('Processing time must be a valid number');

        expect(() => 
            metrics.trackLogEntry(Infinity, 1000, 500)
        ).rejects.toThrow('Processing time must be a valid number');
    });

    test('handles metric reset after overflow', async () => {
        metrics.trackLogEntry(100, 1000, 500);
        Object.defineProperty(metrics, '#metrics', {
            value: { ...metrics.getMetrics(), totalLogs: Number.MAX_SAFE_INTEGER - 1 }
        });
        
        await metrics.trackLogEntry(100, 1000, 500);
        const result = metrics.getMetrics();
        expect(result.totalLogs).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    test('prevents use after disposal', () => {
        metrics.dispose();
        expect(() => 
            metrics.trackLogEntry(100, 1000, 500)
        ).rejects.toThrow('LoggerMetrics has been disposed');

        expect(() => 
            metrics.getMetrics()
        ).toThrow('LoggerMetrics has been disposed');
    });

    test('handles mutex timeout', async () => {
        // Simulate a long-running operation that should trigger mutex timeout
        const longOperation = metrics.trackLogEntry(100, 1000, 500);
        await expect(
            Promise.race([
                metrics.trackLogEntry(100, 1000, 500),
                new Promise(resolve => setTimeout(resolve, 6000))
            ])
        ).rejects.toThrow('Mutex acquisition timeout');
    });
});
