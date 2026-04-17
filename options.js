// options.js - Settings Management
// ============================================================================

(function() {
    'use strict';

    const elements = {
        openRouterKey: document.getElementById('openRouterKey'),
        anthropicKey: document.getElementById('anthropicKey'),
        openaiKey: document.getElementById('openaiKey'),
        saveBtn: document.getElementById('saveBtn'),
        testBtn: document.getElementById('testBtn'),
        status: document.getElementById('status'),
        
        enableAI: document.getElementById('enableAI'),
        enableStealth: document.getElementById('enableStealth'),
        enableTrackerBlocking: document.getElementById('enableTrackerBlocking'),
        enableBehavioral: document.getElementById('enableBehavioral'),
        saveAdvancedBtn: document.getElementById('saveAdvancedBtn'),
        advancedStatus: document.getElementById('advancedStatus'),
        
        totalBlocked: document.getElementById('totalBlocked'),
        aiRequests: document.getElementById('aiRequests'),
        filterRules: document.getElementById('filterRules'),
        cacheSize: document.getElementById('cacheSize')
    };

    // Load existing settings
    async function loadSettings() {
        try {
            const data = await chrome.storage.local.get([
                'openRouterApiKey',
                'anthropicApiKey',
                'openaiApiKey',
                'enableAI',
                'enableStealth',
                'enableTrackerBlocking',
                'enableBehavioral',
                'blockCount',
                'filterRuleCount'
            ]);

            // Load API keys
            if (data.openRouterApiKey) {
                elements.openRouterKey.value = data.openRouterApiKey;
            }
            if (data.anthropicApiKey) {
                elements.anthropicKey.value = data.anthropicApiKey;
            }
            if (data.openaiApiKey) {
                elements.openaiKey.value = data.openaiApiKey;
            }

            // Load advanced settings
            elements.enableAI.checked = data.enableAI !== false;
            elements.enableStealth.checked = data.enableStealth !== false;
            elements.enableTrackerBlocking.checked = data.enableTrackerBlocking !== false;
            elements.enableBehavioral.checked = data.enableBehavioral !== false;

            // Load stats
            loadStats();
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // Load statistics
    async function loadStats() {
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'getStats' }, resolve);
            });

            const storage = await chrome.storage.local.get([
                'blockCount',
                'filterRuleCount'
            ]);

            elements.totalBlocked.textContent = formatNumber(storage.blockCount || 0);
            elements.aiRequests.textContent = formatNumber(response?.ai?.requests || 0);
            elements.filterRules.textContent = formatNumber(storage.filterRuleCount || 0);
            elements.cacheSize.textContent = formatNumber(response?.ai?.cacheSize || 0);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    // Save settings
    elements.saveBtn.addEventListener('click', async () => {
        const settings = {
            openRouterApiKey: elements.openRouterKey.value.trim(),
            anthropicApiKey: elements.anthropicKey.value.trim(),
            openaiApiKey: elements.openaiKey.value.trim()
        };

        try {
            await chrome.storage.local.set(settings);
            showStatus(elements.status, 'Settings saved successfully! ✓', 'success');
            
            // Reload background script to apply new keys
            chrome.runtime.sendMessage({ action: 'reloadSettings' });
        } catch (error) {
            showStatus(elements.status, 'Failed to save settings: ' + error.message, 'error');
        }
    });

    // Test AI connection
    elements.testBtn.addEventListener('click', async () => {
        const testData = {
            html: '<div class="advertisement">Test Ad</div>',
            url: 'https://example.com',
            classes: 'advertisement banner',
            width: 300,
            height: 250
        };

        elements.testBtn.textContent = '⏳ Testing...';
        elements.testBtn.disabled = true;

        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ 
                    action: 'analyzeWithAI', 
                    data: testData 
                }, resolve);
            });

            if (response && response.isAd !== undefined) {
                showStatus(elements.status, 
                    `✓ AI connection successful! Detected as: ${response.isAd ? 'Ad' : 'Safe'} (Confidence: ${Math.round(response.confidence * 100)}%)`, 
                    'success');
            } else if (response && response.error) {
                showStatus(elements.status, '❌ AI error: ' + response.error, 'error');
            } else {
                showStatus(elements.status, '⚠️ No AI key configured', 'error');
            }
        } catch (error) {
            showStatus(elements.status, '❌ Test failed: ' + error.message, 'error');
        } finally {
            elements.testBtn.textContent = '🧪 Test AI Connection';
            elements.testBtn.disabled = false;
        }
    });

    // Save advanced settings
    elements.saveAdvancedBtn.addEventListener('click', async () => {
        const settings = {
            enableAI: elements.enableAI.checked,
            enableStealth: elements.enableStealth.checked,
            enableTrackerBlocking: elements.enableTrackerBlocking.checked,
            enableBehavioral: elements.enableBehavioral.checked
        };

        try {
            await chrome.storage.local.set(settings);
            showStatus(elements.advancedStatus, 'Advanced settings saved! ✓', 'success');
        } catch (error) {
            showStatus(elements.advancedStatus, 'Failed to save: ' + error.message, 'error');
        }
    });

    // Show status message
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = 'status ' + type;
        element.style.display = 'block';

        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    // Format numbers
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // Initialize
    loadSettings();

    // Refresh stats every 5 seconds
    setInterval(loadStats, 5000);

})();