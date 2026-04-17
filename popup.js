// popup.js - Advanced Popup Interface
// ============================================================================

(async function() {
    'use strict';

    const contentDiv = document.getElementById('content');
    const aiStatusDiv = document.getElementById('aiStatus');

    // Load stats
    async function loadStats() {
        try {
            const stats = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'getStats' }, resolve);
            });

            const storage = await chrome.storage.local.get([
                'blockCount',
                'openRouterApiKey',
                'filterRuleCount',
                'installDate'
            ]);

            displayStats(stats, storage);
        } catch (error) {
            console.error('Failed to load stats:', error);
            contentDiv.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p style="opacity: 0.8;">Failed to load statistics</p>
                </div>
            `;
        }
    }

    function displayStats(stats, storage) {
        const totalBlocked = storage.blockCount || 0;
        const filterCount = storage.filterRuleCount || 0;
        const hasAI = !!storage.openRouterApiKey;

        // Calculate days since install
        const installDate = storage.installDate || Date.now();
        const daysSince = Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24));

        contentDiv.innerHTML = `
            <div class="stats">
                <div class="stat-card">
                    <div class="label">Total Blocked</div>
                    <div class="value">${formatNumber(totalBlocked)}</div>
                    <div class="subtext">Ads, trackers, and malware blocked</div>
                </div>

                <div class="stat-grid">
                    <div class="mini-stat">
                        <div class="value">${formatNumber(stats?.ai?.requests || 0)}</div>
                        <div class="label">AI Scans</div>
                    </div>
                    <div class="mini-stat">
                        <div class="value">${formatNumber(filterCount)}</div>
                        <div class="label">Filter Rules</div>
                    </div>
                </div>

                <div class="stat-grid">
                    <div class="mini-stat">
                        <div class="value">${Math.round((stats?.ai?.hits || 0) / Math.max(stats?.ai?.requests || 1, 1) * 100)}%</div>
                        <div class="label">Cache Hit Rate</div>
                    </div>
                    <div class="mini-stat">
                        <div class="value">${daysSince}</div>
                        <div class="label">Days Active</div>
                    </div>
                </div>
            </div>

            <div class="actions">
                <button class="btn btn-primary" id="settingsBtn">
                    ⚙️ Settings & AI Configuration
                </button>
                <button class="btn btn-secondary" id="updateFiltersBtn">
                    🔄 Update Filter Lists
                </button>
                <button class="btn btn-secondary" id="clearCacheBtn">
                    🗑️ Clear AI Cache
                </button>
            </div>
        `;

        // Update AI status
        if (hasAI) {
            const cacheSize = stats?.ai?.cacheSize || 0;
            aiStatusDiv.innerHTML = `
                🤖 AI Mode: Active | Cache: ${formatNumber(cacheSize)} entries
            `;
        } else {
            aiStatusDiv.innerHTML = `
                ⚠️ AI Mode: Disabled (Configure in Settings)
            `;
        }

        // Add event listeners
        document.getElementById('settingsBtn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        document.getElementById('updateFiltersBtn').addEventListener('click', async () => {
            const btn = document.getElementById('updateFiltersBtn');
            btn.textContent = '⏳ Updating...';
            btn.disabled = true;

            try {
                await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'updateFilters' }, resolve);
                });
                btn.textContent = '✓ Updated!';
                setTimeout(() => loadStats(), 1000);
            } catch (error) {
                btn.textContent = '❌ Failed';
            }

            setTimeout(() => {
                btn.textContent = '🔄 Update Filter Lists';
                btn.disabled = false;
            }, 2000);
        });

        document.getElementById('clearCacheBtn').addEventListener('click', () => {
            chrome.storage.local.set({ aiCache: {} });
            aiStatusDiv.textContent = 'Cache cleared!';
            setTimeout(() => loadStats(), 1000);
        });
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // Initialize
    loadStats();

    // Update every 2 seconds
    setInterval(loadStats, 2000);

})();