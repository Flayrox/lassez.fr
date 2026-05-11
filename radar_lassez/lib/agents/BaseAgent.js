export class BaseAgent {
    constructor(apiKey, modelName) {
        this.apiKey = apiKey;
        this.modelName = modelName;
    }

    /**
     * Helper for exponential backoff or simple delay
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Executes a Gemini call with retry logic for 503 errors
     */
    async callWithRetry(fn, maxRetries = 3) {
        let lastError = null;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                const isOverloaded = error.message?.includes('503') || error.message?.includes('high demand');
                
                if (isOverloaded && i < maxRetries - 1) {
                    const delay = Math.pow(2, i + 1) * 1000;
                    console.warn(`[Agent] Gemini overloaded (503). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                    await this.sleep(delay);
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
}
