// lib/openrouter.js - Helper for OpenRouter API (optional, not directly used in extension but provided for completeness)
class OpenRouterClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://openrouter.ai/api/v1';
    }

    async chat(messages, model = 'google/gemini-flash-1.5') {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, messages })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    }

    async classifyAd(htmlSnippet, url) {
        const prompt = `Classify this HTML element as an advertisement or legitimate content. Respond ONLY with "ad" or "safe". Context: ${url}\nHTML: ${htmlSnippet}`;
        const result = await this.chat([{ role: 'user', content: prompt }]);
        return result.choices[0].message.content.toLowerCase().includes('ad');
    }
}

// Expose to window if needed (but we use background messaging)
if (typeof window !== 'undefined') {
    window.OpenRouterClient = OpenRouterClient;
}