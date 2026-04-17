// background.js - Advanced Background Service Worker with Multi-AI Detection
// ============================================================================

const CONFIG = {
    version: '5.0.0',
    aiProviders: {
        openRouter: 'https://openrouter.ai/api/v1/chat/completions',
        anthropic: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions'
    },
    models: {
        primary: 'google/gemini-flash-1.5-8b',
        secondary: 'anthropic/claude-3-haiku',
        tertiary: 'openai/gpt-4o-mini'
    },
    updateInterval: 3600000, // 1 hour
    maxCacheSize: 10000,
    confidenceThreshold: 0.75
};

// Advanced Malicious Domain Database (Continuously Updated)
const THREAT_DATABASE = {
    malicious: new Set([
        "b6c9c4cf28.com", "deductgreedyheadroom.com", "wpadmngr.com",
        "cloudflareinsights.com", "anjowpoft.in", "popads.net",
        "popcash.net", "propellerads.com", "adcash.com", "hilltopads.net",
        "exoclick.com", "juicyads.com", "trafficjunky.com", "ero-advertising.com",
        "adsterra.com", "clickadu.com", "ads.yahoo.com", "bidvertiser.com"
    ]),
    tracking: new Set([
        "google-analytics.com", "googletagmanager.com", "doubleclick.net",
        "facebook.com/tr", "connect.facebook.net", "scorecardresearch.com",
        "quantserve.com", "hotjar.com", "mouseflow.com", "crazyegg.com"
    ]),
    patterns: [
        // Simple URL path patterns that can be blocked with urlFilter
        '/ad/', '/ads/', '/adx/', '/adv/',
        '/banner', '/pop', '/redirect', '/click',
        'tracking', 'analytics', 'pixel', 'beacon'
    ],
    // Hex domain pattern kept for regex check (optional)
    hexDomainPattern: /^[a-f0-9]{8,16}\.[a-f0-9]{8,16}\.com$/
};

// AI Response Cache with TTL
class AICache {
    constructor(maxSize = CONFIG.maxCacheSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = 86400000; // 24 hours
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    clear() {
        this.cache.clear();
    }
}

const aiCache = new AICache();
const blockStats = {
    total: 0,
    byType: { ads: 0, trackers: 0, malware: 0, popups: 0 },
    byDomain: new Map()
};

// ============================================================================
// ADVANCED FILTER LIST MANAGEMENT
// ============================================================================

class FilterListManager {
    constructor() {
        this.lists = {
            easylist: 'https://easylist.to/easylist/easylist.txt',
            easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
            fanboy: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
            ublock: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt'
        };
        this.compiledRules = [];
        this.lastUpdate = 0;
    }

    async updateFilters() {
        try {
            const rules = [];
            let ruleId = 10000;

            // Download and parse filter lists
            for (const [name, url] of Object.entries(this.lists)) {
                try {
                    const response = await fetch(url);
                    const text = await response.text();
                    const parsed = this.parseFilterList(text, ruleId);
                    rules.push(...parsed.rules);
                    ruleId = parsed.nextId;
                    console.log(`[FilterList] Loaded ${parsed.rules.length} rules from ${name}`);
                } catch (err) {
                    console.warn(`[FilterList] Failed to load ${name}:`, err.message);
                }
            }

            // Update dynamic rules
            if (rules.length > 0) {
                await this.applyDynamicRules(rules.slice(0, 5000)); // Chrome limit
                this.compiledRules = rules;
                this.lastUpdate = Date.now();
                await chrome.storage.local.set({ 
                    filterListUpdate: this.lastUpdate,
                    filterRuleCount: rules.length 
                });
            }
        } catch (error) {
            console.error('[FilterList] Update failed:', error);
        }
    }

    parseFilterList(text, startId) {
        const rules = [];
        let ruleId = startId;
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;

            // Parse blocking rules
            if (trimmed.startsWith('||') && trimmed.includes('^')) {
                const domain = trimmed.slice(2, trimmed.indexOf('^'));
                if (domain && domain.length > 3) {
                    rules.push({
                        id: ruleId++,
                        priority: 1,
                        action: { type: 'block' },
                        condition: {
                            urlFilter: `||${domain}^`,
                            resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other']
                        }
                    });
                }
            }
            // Parse domain-based rules
            else if (trimmed.includes('##') || trimmed.includes('#@#')) {
                // Cosmetic filters - handled in content script
                continue;
            }
        }

        return { rules, nextId: ruleId };
    }

    async applyDynamicRules(rules) {
        try {
            const existing = await chrome.declarativeNetRequest.getDynamicRules();
            const existingIds = existing.map(r => r.id);

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: existingIds,
                addRules: rules
            });

            console.log(`[FilterList] Applied ${rules.length} dynamic rules`);
        } catch (error) {
            console.error('[FilterList] Failed to apply rules:', error);
        }
    }
}

const filterManager = new FilterListManager();

// ============================================================================
// MULTI-AI DETECTION SYSTEM
// ============================================================================

class MultiAIDetector {
    constructor() {
        this.apiKeys = {};
        this.stats = { requests: 0, hits: 0, misses: 0, errors: 0 };
    }

    async init() {
        const keys = await chrome.storage.local.get([
            'openRouterApiKey', 
            'anthropicApiKey', 
            'openaiApiKey'
        ]);
        this.apiKeys = keys;
    }

    async analyzeWithConsensus(data) {
        const cacheKey = this.getCacheKey(data);
        const cached = aiCache.get(cacheKey);
        if (cached) {
            this.stats.hits++;
            return cached;
        }

        this.stats.requests++;
        const results = await Promise.allSettled([
            this.analyzeWithPrimary(data),
            this.analyzeWithSecondary(data),
            this.analyzeWithTertiary(data)
        ]);

        const votes = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        if (votes.length === 0) {
            this.stats.errors++;
            return { isAd: false, confidence: 0, method: 'fallback' };
        }

        // Consensus voting
        const adVotes = votes.filter(v => v.isAd).length;
        const confidence = adVotes / votes.length;
        const isAd = confidence >= CONFIG.confidenceThreshold;

        const result = {
            isAd,
            confidence,
            votes: votes.length,
            method: 'consensus',
            details: votes
        };

        aiCache.set(cacheKey, result);
        this.stats.misses++;
        return result;
    }

    async analyzeWithPrimary(data) {
        if (!this.apiKeys.openRouterApiKey) return null;

        try {
            const response = await fetch(CONFIG.aiProviders.openRouter, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKeys.openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://quantum-adblocker.extension',
                    'X-Title': 'Quantum AdBlocker'
                },
                body: JSON.stringify({
                    model: CONFIG.models.primary,
                    messages: [{
                        role: 'user',
                        content: this.buildAnalysisPrompt(data)
                    }],
                    temperature: 0.1,
                    max_tokens: 150
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const json = await response.json();
            const content = json.choices[0].message.content.toLowerCase();
            
            return this.parseAIResponse(content, 'primary');
        } catch (error) {
            console.error('[AI-Primary] Error:', error.message);
            return null;
        }
    }

    async analyzeWithSecondary(data) {
        if (!this.apiKeys.openRouterApiKey) return null;

        try {
            const response = await fetch(CONFIG.aiProviders.openRouter, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKeys.openRouterApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CONFIG.models.secondary,
                    messages: [{
                        role: 'user',
                        content: this.buildAnalysisPrompt(data)
                    }],
                    temperature: 0.1,
                    max_tokens: 150
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const json = await response.json();
            const content = json.choices[0].message.content.toLowerCase();
            
            return this.parseAIResponse(content, 'secondary');
        } catch (error) {
            console.error('[AI-Secondary] Error:', error.message);
            return null;
        }
    }

    async analyzeWithTertiary(data) {
        if (!this.apiKeys.openRouterApiKey) return null;

        try {
            const response = await fetch(CONFIG.aiProviders.openRouter, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKeys.openRouterApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: CONFIG.models.tertiary,
                    messages: [{
                        role: 'user',
                        content: this.buildAnalysisPrompt(data)
                    }],
                    temperature: 0.1,
                    max_tokens: 150
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const json = await response.json();
            const content = json.choices[0].message.content.toLowerCase();
            
            return this.parseAIResponse(content, 'tertiary');
        } catch (error) {
            console.error('[AI-Tertiary] Error:', error.message);
            return null;
        }
    }

    buildAnalysisPrompt(data) {
        return `Analyze this web element for advertising/tracking content. Consider:
1. Visual properties: size, position, styling
2. Text content and keywords
3. URL patterns and domains
4. HTML structure and attributes
5. JavaScript behavior

Element Data:
- URL: ${data.url || 'unknown'}
- HTML: ${data.html?.substring(0, 500) || 'N/A'}
- Classes: ${data.classes || 'N/A'}
- Attributes: ${JSON.stringify(data.attributes || {}).substring(0, 200)}
- Text: ${data.text?.substring(0, 200) || 'N/A'}
- Size: ${data.width}x${data.height}
- Position: ${data.position || 'N/A'}

Respond with JSON: {"isAd": boolean, "confidence": 0-1, "reason": "brief explanation"}`;
    }

    parseAIResponse(content, source) {
        try {
            // Try to extract JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    isAd: parsed.isAd || false,
                    confidence: parsed.confidence || 0.5,
                    reason: parsed.reason || 'AI analysis',
                    source
                };
            }

            // Fallback to keyword detection
            const isAd = content.includes('"isad": true') || 
                        content.includes('advertisement') ||
                        content.includes('is an ad') ||
                        content.match(/\bad\b/);

            return {
                isAd: !!isAd,
                confidence: isAd ? 0.7 : 0.3,
                reason: 'keyword match',
                source
            };
        } catch (error) {
            console.error('[AI-Parse] Error:', error);
            return { isAd: false, confidence: 0, reason: 'parse error', source };
        }
    }

    getCacheKey(data) {
        const str = JSON.stringify({
            html: data.html?.substring(0, 100),
            classes: data.classes,
            url: data.url
        });
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    async getStats() {
        return { ...this.stats, cacheSize: aiCache.cache.size };
    }
}

const aiDetector = new MultiAIDetector();

// ============================================================================
// DYNAMIC RULE UPDATES (FIXED - NO REGEX LIMIT ERROR)
// ============================================================================

/**
 * Safely adds a regex rule after checking support.
 */
async function addRegexRuleIfSupported(rules, ruleId, pattern, resourceTypes, priority = 1) {
    try {
        const result = await chrome.declarativeNetRequest.isRegexSupported({
            regex: pattern.source,
            isCaseSensitive: !pattern.ignoreCase,
            requireCapturing: false
        });
        if (result.isSupported) {
            rules.push({
                id: ruleId,
                priority,
                action: { type: 'block' },
                condition: {
                    regexFilter: pattern.source,
                    resourceTypes
                }
            });
            return true;
        } else {
            console.warn(`[Background] Regex not supported, skipping: ${pattern}`);
        }
    } catch (e) {
        console.warn(`[Background] Regex check failed: ${e.message}`);
    }
    return false;
}

async function updateDynamicRules() {
    try {
        const rules = [];
        let ruleId = 1000;

        // Block malicious domains (using urlFilter, no regex)
        for (const domain of THREAT_DATABASE.malicious) {
            rules.push({
                id: ruleId++,
                priority: 2,
                action: { type: 'block' },
                condition: {
                    urlFilter: `||${domain}^`,
                    resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'other', 'media']
                }
            });
        }

        // Block tracking domains
        for (const domain of THREAT_DATABASE.tracking) {
            rules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: `||${domain}^`,
                    resourceTypes: ['script', 'xmlhttprequest']
                }
            });
        }

        // Block pattern-based threats using urlFilter (NO regexFilter)
        // Convert patterns to simple wildcard urlFilters
        const urlPatterns = [
            // Path-based patterns
            '*://*/*/ad/*',
            '*://*/*/ads/*',
            '*://*/*/adx/*',
            '*://*/*/adv/*',
            '*://*/*/banner*',
            '*://*/*/pop*',
            '*://*/*/redirect*',
            '*://*/*/click*',
            // Keyword-based patterns
            '*tracking*',
            '*analytics*',
            '*pixel*',
            '*beacon*'
        ];

        for (const filter of urlPatterns) {
            rules.push({
                id: ruleId++,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: filter,
                    resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame']
                }
            });
        }

        // Special hex-domain pattern (check regex support first)
        const hexPattern = THREAT_DATABASE.hexDomainPattern;
        const wasAdded = await addRegexRuleIfSupported(
            rules, ruleId++, hexPattern,
            ['script', 'image', 'xmlhttprequest', 'sub_frame']
        );
        if (!wasAdded) {
            console.log('[Background] Hex domain regex skipped (exceeds memory limit). Using domain blocklist fallback.');
        }

        // Apply rules
        const existing = await chrome.declarativeNetRequest.getDynamicRules();
        const existingIds = existing.filter(r => r.id >= 1000 && r.id < 10000).map(r => r.id);

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingIds,
            addRules: rules
        });

        console.log(`[Background] Updated ${rules.length} dynamic rules`);
        
        // Update filter lists
        await filterManager.updateFilters();

    } catch (error) {
        console.error('[Background] Failed to update rules:', error);
    }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeWithAI') {
        aiDetector.analyzeWithConsensus(request.data)
            .then(sendResponse)
            .catch(err => sendResponse({ isAd: false, error: err.message }));
        return true;
    }

    if (request.action === 'getStats') {
        Promise.all([
            aiDetector.getStats(),
            chrome.storage.local.get(['blockCount', 'filterRuleCount'])
        ]).then(([aiStats, storage]) => {
            sendResponse({
                ...blockStats,
                ai: aiStats,
                filters: storage.filterRuleCount || 0,
                totalBlocked: storage.blockCount || 0
            });
        });
        return true;
    }

    if (request.action === 'reportAd') {
        // Crowdsourced threat intelligence
        handleAdReport(request.data);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'updateFilters') {
        filterManager.updateFilters()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

async function handleAdReport(data) {
    // Store reported ads for analysis
    const reports = await chrome.storage.local.get('adReports') || { adReports: [] };
    reports.adReports = reports.adReports || [];
    reports.adReports.push({
        ...data,
        timestamp: Date.now(),
        url: data.url
    });
    
    // Keep last 1000 reports
    if (reports.adReports.length > 1000) {
        reports.adReports = reports.adReports.slice(-1000);
    }
    
    await chrome.storage.local.set(reports);
}

// ============================================================================
// NETWORK REQUEST MONITORING
// ============================================================================

chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId === 0) {
        // Track navigation for popup detection
        chrome.tabs.get(details.tabId).then(tab => {
            if (tab.openerTabId) {
                // Likely a popup
                const url = new URL(details.url);
                if (THREAT_DATABASE.malicious.has(url.hostname)) {
                    chrome.tabs.remove(details.tabId);
                    blockStats.byType.popups++;
                }
            }
        }).catch(() => {});
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
    await updateDynamicRules();
    await aiDetector.init();
    
    // Set up periodic updates
    chrome.alarms.create('updateFilters', { periodInMinutes: 60 });
    
    // Initialize stats
    await chrome.storage.local.set({
        blockCount: 0,
        installDate: Date.now(),
        version: CONFIG.version
    });

    console.log('[Background] Quantum AdBlocker initialized');
});

chrome.runtime.onStartup.addListener(async () => {
    await updateDynamicRules();
    await aiDetector.init();
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateFilters') {
        filterManager.updateFilters();
    }
});

// Track blocked requests
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(details => {
    blockStats.total++;
    blockStats.byType.ads++;
    
    const url = new URL(details.request.url);
    const count = blockStats.byDomain.get(url.hostname) || 0;
    blockStats.byDomain.set(url.hostname, count + 1);
    
    chrome.storage.local.get('blockCount').then(data => {
        const newCount = (data.blockCount || 0) + 1;
        chrome.storage.local.set({ blockCount: newCount });
    });
});

console.log('[Background] Quantum AdBlocker v5.0 loaded');