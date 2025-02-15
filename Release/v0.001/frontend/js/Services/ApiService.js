import { CONFIG } from '../Config/Config.js';

class ApiService {
    constructor() {
        this.baseUrl = '/api/v1';
        this.defaultOptions = {
            ...CONFIG.FETCH_OPTIONS,
            headers: {
                ...CONFIG.FETCH_OPTIONS.headers,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 5000
        };
    }

    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(), 
            options.timeout || CONFIG.TIMEOUT
        );

        try {
            const response = await fetch(url, {
                ...this.defaultOptions,
                ...options,
                signal: controller.signal
            });

            if (!response.ok) {
                if (response.status >= 500) {
                    throw new ServerError('Server error', response.status);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new NetworkError('Request timeout');
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    // Endpoint de salud del servidor
    async checkHealth() {
        return this.fetchWithTimeout(`${this.baseUrl}/health`);
    }

    // Procesar consulta de texto
    async processQuery(query) {
        return this.fetchWithTimeout(`${this.baseUrl}/process`, {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    }

    // Detección de objetos en imágenes
    async detectObjects(imageBase64) {
        return this.fetchWithTimeout(`${this.baseUrl}/ai/vision/detect-objects`, {
            method: 'POST',
            body: JSON.stringify({ image: imageBase64 })
        });
    }

    // Análisis de texto médico
    async analyzeMedicalText(text) {
        return this.fetchWithTimeout(`${this.baseUrl}/ai/medical/analyze`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    // Detección de amenazas de seguridad
    async detectThreats(data) {
        return this.fetchWithTimeout(`${this.baseUrl}/ai/security/detect-threats`, {
            method: 'POST',
            body: JSON.stringify({ data })
        });
    }

    // Análisis de riesgo financiero
    async analyzeFinancialRisk(text) {
        return this.fetchWithTimeout(`${this.baseUrl}/ai/finance/analyze-risk`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    // Subir archivo
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        return this.fetchWithTimeout(`${this.baseUrl}/upload`, {
            method: 'POST',
            headers: {
                // Remove Content-Type to let browser set it with boundary
                'Accept': 'application/json'
            },
            body: formData
        });
    }

    // Procesar datos genéricos
    async processData(data) {
        return this.fetchWithTimeout(`${this.baseUrl}/result`, {
            method: 'POST',
            body: JSON.stringify({ data })
        });
    }
}

// Exportar una única instancia del servicio
export const apiService = new ApiService();
