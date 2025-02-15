import { utils } from '../../app.js';
import { CONFIG } from '../../config.js';

describe('API Integration', () => {
  describe('Text Analysis Flow', () => {
    test('should complete full analysis flow', async () => {
      const mockText = "This is a test message";
      const response = await utils.fetchWithRetry(CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ message: mockText })
      });

      expect(response).toHaveProperty('sentiment');
      expect(response).toHaveProperty('emotion');
      expect(response.sentiment).toHaveProperty('label');
      expect(response.sentiment).toHaveProperty('score');
    });

    test('should handle server errors gracefully', async () => {
      const mockText = "Test error case";
      try {
        await utils.fetchWithRetry(CONFIG.API_URL, {
          method: 'POST',
          body: JSON.stringify({ message: mockText })
        });
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
      }
    });
  });

  describe('Health Check Integration', () => {
    test('should verify server connection', async () => {
      const isConnected = await utils.ensureServerConnection();
      expect(isConnected).toBe(true);
    });
  });
});
