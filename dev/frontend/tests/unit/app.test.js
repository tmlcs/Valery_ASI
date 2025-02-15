import { jest } from '@jest/globals';
import { utils, handleSubmit, handleInput } from '../../app.js';
import { CONFIG } from '../../config.js';

describe('App Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateInput', () => {
    test('should validate correct input', () => {
      expect(() => utils.validateInput("Test text")).not.toThrow();
    });

    test('should throw on empty input', () => {
      expect(() => utils.validateInput("")).toThrow();
    });

    test('should throw on too long input', () => {
      const longText = "a".repeat(CONFIG.VALIDATION.MAX_LENGTH + 1);
      expect(() => utils.validateInput(longText)).toThrow();
    });
  });

  describe('handleInput', () => {
    test('should sanitize invalid characters', () => {
      const event = {
        target: { value: 'Test<script>' },
        type: 'input'
      };
      handleInput(event);
      expect(event.target.value).toBe('Test');
    });
  });

  describe('utils.checkServerHealth', () => {
    test('should return true when server is healthy', async () => {
      global.fetch = jest.fn(() => 
        Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
      );
      const result = await utils.checkServerHealth();
      expect(result).toBe(true);
    });

    test('should return false when server is down', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
      const result = await utils.checkServerHealth();
      expect(result).toBe(false);
    });
  });
});
