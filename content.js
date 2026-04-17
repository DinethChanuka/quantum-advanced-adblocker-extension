// content.js - Advanced Content Script with Behavioral Analysis
// ============================================================================

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION
    // ============================================================================

    const CONFIG = {
        debug: false,
        aiThreshold: 0.7,
        maxRetries: 3,
        observerThrottle: 100,
        batchSize: 10,
        
        // Advanced selectors
        selectors: {
            overlays: [
                '[data-element="overlay"]',
                '[data-izone="stop"]',
                '[class*="popup"]',
                '[class*="modal"]',
                '[class*="lightbox"]',
                '[id*="popup"]',
                '[id*="modal"]',
                'div[style*="position: fixed"][style*="z-index"]',
                'div[style*="position: absolute"][style*="width: 100%"]'
            ],
            ads: [
                '[class*="ad-"]', '[class*="-ad"]', '[class*="ads-"]',
                '[id*="ad-"]', '[id*="-ad"]', '[id*="ads-"]',
                '[class*="banner"]', '[class*="sponsor"]',
                '[class*="promo"]', '[class*="advertisement"]',
                '.adsbygoogle', 'ins.adsbygoogle',
                '[data-ad-slot]', '[data-ad-client]',
                'iframe[src*="doubleclick"]',
                'iframe[src*="googlesyndication"]',
                'iframe[src*="advertising"]',
                'div[class*="code-block"]',
                'img[src*="/api/postback/"]'
            ],
            tracking: [
                'img[width="1"][height="1"]',
                'img[style*="display: none"]',
                'iframe[width="1"][height="1"]',
                'iframe[style*="display: none"]',
                'img[src*="pixel"]',
                'img[src*="track"]',
                'img[src*="beacon"]'
            ]
        },

        // Behavioral patterns
        behaviors: {
            redirectKeywords: ['ad', 'pop', 'redirect', 'track', 'click', 'offer', 'go.', 'anjowpoft', 'popunder'],
            suspiciousHosts: ['bit.ly', 'tinyurl', 'goo.gl', 't.co'],
            adKeywords: ['sponsored', 'advertisement', 'promo', 'popup', 'casino', 'dating', 'porn', 'xxx', 'click here']
        }
    };

    // ============================================================================
    // UTILITIES
    // ============================================================================

    const Utils = {
        log(...args) {
            if (CONFIG.debug) console.log('[QAdBlock]', ...args);
        },

        error(...args) {
            console.error('[QAdBlock]', ...args);
        },

        hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return hash.toString(36);
        },

        getElementSignature(element) {
            return {
                tag: element.tagName,
                classes: Array.from(element.classList).join(' '),
                id: element.id,
                width: element.offsetWidth,
                height: element.offsetHeight,
                position: window.getComputedStyle(element).position,
                zIndex: window.getComputedStyle(element).zIndex,
                text: element.textContent?.substring(0, 100),
                attributes: this.getRelevantAttributes(element)
            };
        },

        getRelevantAttributes(element) {
            const attrs = {};
            const relevant = ['data-ad', 'data-slot', 'data-tracking', 'href', 'src', 'onclick'];
            relevant.forEach(attr => {
                const value = element.getAttribute(attr);
                if (value) attrs[attr] = value.substring(0, 100);
            });
            return attrs;
        },

        isVisible(element) {
            if (!element.offsetParent) return false;
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        },

        throttle(func, delay) {
            let timeout = null;
            return function(...args) {
                if (!timeout) {
                    timeout = setTimeout(() => {
                        func.apply(this, args);
                        timeout = null;
                    }, delay);
                }
            };
        }
    };

    // ============================================================================
    // BEHAVIORAL ANALYZER
    // ============================================================================

    class BehavioralAnalyzer {
        constructor() {
            this.suspiciousElements = new WeakSet();
            this.clickHandlers = new WeakMap();
            this.redirectAttempts = 0;
        }

        analyzeElement(element) {
            const score = {
                total: 0,
                reasons: []
            };

            // Check dimensions (common ad sizes)
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            const adSizes = [
                [728, 90], [300, 250], [160, 600], [970, 250],
                [300, 600], [320, 50], [468, 60], [234, 60]
            ];
            
            if (adSizes.some(([w, h]) => 
                Math.abs(width - w) < 10 && Math.abs(height - h) < 10
            )) {
                score.total += 30;
                score.reasons.push('standard-ad-size');
            }

            // Check position
            const style = window.getComputedStyle(element);
            if (style.position === 'fixed' || style.position === 'absolute') {
                const zIndex = parseInt(style.zIndex);
                if (zIndex > 1000) {
                    score.total += 20;
                    score.reasons.push('high-z-index');
                }
            }

            // Check text content
            const text = element.textContent?.toLowerCase() || '';
            CONFIG.behaviors.adKeywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    score.total += 15;
                    score.reasons.push(`keyword:${keyword}`);
                }
            });

            // Check for tracking pixels
            const imgs = element.querySelectorAll('img[width="1"], img[height="1"]');
            if (imgs.length > 0) {
                score.total += 25;
                score.reasons.push('tracking-pixel');
            }

            // Check for suspicious attributes
            const attrs = element.attributes;
            for (let attr of attrs) {
                if (attr.name.includes('ad') || 
                    attr.name.includes('banner') ||
                    attr.name.includes('sponsor')) {
                    score.total += 20;
                    score.reasons.push(`suspicious-attr:${attr.name}`);
                    break;
                }
            }

            // Check iframes
            if (element.tagName === 'IFRAME') {
                const src = element.src || '';
                if (src.includes('doubleclick') || 
                    src.includes('googlesyndication') ||
                    src.includes('advertising')) {
                    score.total += 50;
                    score.reasons.push('ad-iframe');
                }
            }

            // Check onclick handlers
            if (element.hasAttribute('onclick')) {
                const onclick = element.getAttribute('onclick');
                if (this.isSuspiciousHandler(onclick)) {
                    score.total += 25;
                    score.reasons.push('suspicious-handler');
                }
            }

            return score;
        }

        isSuspiciousHandler(code) {
            if (!code) return false;
            const suspicious = ['window.open', 'location.href', 'redirect', 'popup'];
            return suspicious.some(pattern => code.includes(pattern));
        }

        isLikelyAd(element) {
            const score = this.analyzeElement(element);
            return score.total >= 50;
        }

        monitorClickBehavior(element) {
            if (this.clickHandlers.has(element)) return;

            const handler = (e) => {
                const href = element.getAttribute('href') || 
                             element.getAttribute('data-href') || 
                             '';
                
                if (this.isSuspiciousURL(href)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.redirectAttempts++;
                    Utils.log('Blocked suspicious click:', href);
                    return false;
                }
            };

            element.addEventListener('click', handler, true);
            this.clickHandlers.set(element, handler);
        }

        isSuspiciousURL(url) {
            if (!url) return false;
            const lower = url.toLowerCase();
            return CONFIG.behaviors.redirectKeywords.some(kw => lower.includes(kw)) ||
                   CONFIG.behaviors.suspiciousHosts.some(host => url.includes(host));
        }
    }

    const behavioralAnalyzer = new BehavioralAnalyzer();

    // ============================================================================
    // ML-BASED CLASSIFIER (Simplified)
    // ============================================================================

    class MLClassifier {
        constructor() {
            this.features = [];
            this.trained = false;
        }

        extractFeatures(element) {
            const style = window.getComputedStyle(element);
            return {
                width: element.offsetWidth,
                height: element.offsetHeight,
                area: element.offsetWidth * element.offsetHeight,
                zIndex: parseInt(style.zIndex) || 0,
                isFixed: style.position === 'fixed' ? 1 : 0,
                isAbsolute: style.position === 'absolute' ? 1 : 0,
                hasClickHandler: element.hasAttribute('onclick') ? 1 : 0,
                isIframe: element.tagName === 'IFRAME' ? 1 : 0,
                hasAdClass: /ad|banner|sponsor/i.test(element.className) ? 1 : 0,
                hasAdId: /ad|banner|sponsor/i.test(element.id) ? 1 : 0,
                textLength: element.textContent?.length || 0
            };
        }

        classify(element) {
            const features = this.extractFeatures(element);
            
            // Simple heuristic classifier
            let score = 0;
            
            // Standard ad sizes
            const adSizes = [[728,90],[300,250],[160,600],[970,250],[300,600]];
            if (adSizes.some(([w,h]) => 
                Math.abs(features.width - w) < 10 && 
                Math.abs(features.height - h) < 10
            )) score += 0.3;
            
            // High z-index
            if (features.zIndex > 1000) score += 0.2;
            
            // Fixed/absolute positioning
            if (features.isFixed || features.isAbsolute) score += 0.15;
            
            // Ad-related naming
            if (features.hasAdClass || features.hasAdId) score += 0.4;
            
            // Iframe
            if (features.isIframe) score += 0.2;
            
            return {
                isAd: score > 0.6,
                confidence: Math.min(score, 1.0),
                features
            };
        }
    }

    const mlClassifier = new MLClassifier();

    // ============================================================================
    // AD REMOVER
    // ============================================================================

    class AdRemover {
        constructor() {
            this.processed = new WeakSet();
            this.aiCache = new Map();
            this.stats = {
                removed: 0,
                blocked: 0,
                byMethod: { selector: 0, behavioral: 0, ml: 0, ai: 0 }
            };
        }

        async removeAds() {
            try {
                // 1. Selector-based removal
                this.removeBySelectorAll();
                
                // 2. Behavioral analysis
                await this.removeByBehavior();
                
                // 3. ML classification
                await this.removeByML();
                
                Utils.log('Ad removal cycle complete:', this.stats);
            } catch (error) {
                Utils.error('Ad removal error:', error);
            }
        }

        removeBySelectorAll() {
            CONFIG.selectors.overlays.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (this.processed.has(el)) return;
                        this.removeElement(el, 'selector-overlay');
                    });
                } catch (e) {}
            });

            CONFIG.selectors.ads.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (this.processed.has(el)) return;
                        this.removeElement(el, 'selector-ad');
                    });
                } catch (e) {}
            });

            CONFIG.selectors.tracking.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        if (this.processed.has(el)) return;
                        this.removeElement(el, 'selector-tracking');
                    });
                } catch (e) {}
            });
        }

        async removeByBehavior() {
            const suspicious = document.querySelectorAll('div, aside, section, iframe');
            const batch = [];

            for (const element of suspicious) {
                if (this.processed.has(element)) continue;
                if (!Utils.isVisible(element)) continue;

                if (behavioralAnalyzer.isLikelyAd(element)) {
                    batch.push(element);
                    if (batch.length >= CONFIG.batchSize) {
                        batch.forEach(el => this.removeElement(el, 'behavioral'));
                        batch.length = 0;
                        await new Promise(r => setTimeout(r, 10)); // Yield
                    }
                }
            }

            batch.forEach(el => this.removeElement(el, 'behavioral'));
        }

        async removeByML() {
            const candidates = document.querySelectorAll('div, aside, section');
            
            for (const element of candidates) {
                if (this.processed.has(element)) continue;
                if (!Utils.isVisible(element)) continue;

                const result = mlClassifier.classify(element);
                if (result.isAd && result.confidence > 0.7) {
                    this.removeElement(element, 'ml');
                }
            }
        }

        async removeByAI(element) {
            if (this.processed.has(element)) return;

            const signature = Utils.getElementSignature(element);
            const cacheKey = Utils.hashString(JSON.stringify(signature));

            if (this.aiCache.has(cacheKey)) {
                if (this.aiCache.get(cacheKey)) {
                    this.removeElement(element, 'ai-cached');
                }
                return;
            }

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'analyzeWithAI',
                    data: {
                        html: element.outerHTML.substring(0, 500),
                        url: window.location.href,
                        ...signature
                    }
                });

                if (response && response.isAd && response.confidence > CONFIG.aiThreshold) {
                    this.aiCache.set(cacheKey, true);
                    this.removeElement(element, 'ai');
                } else {
                    this.aiCache.set(cacheKey, false);
                }
            } catch (error) {
                Utils.error('AI analysis failed:', error);
            }
        }

        removeElement(element, method) {
            if (!element || !element.isConnected) return;
            if (this.processed.has(element)) return;

            try {
                // Remove inline handlers
                ['onclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onload']
                    .forEach(attr => element.removeAttribute(attr));
                
                // Remove data attributes that might trigger redirects
                ['data-href', 'data-url', 'data-redirect']
                    .forEach(attr => element.removeAttribute(attr));

                // Check for close buttons first
                const closeBtn = element.querySelector('[data-element="close-button"]');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    element.remove();
                }

                this.processed.add(element);
                this.stats.removed++;
                this.stats.byMethod[method] = (this.stats.byMethod[method] || 0) + 1;
                
                Utils.log(`Removed element via ${method}`);
            } catch (error) {
                Utils.error('Element removal failed:', error);
            }
        }

        getStats() {
            return { ...this.stats };
        }
    }

    const adRemover = new AdRemover();

    // ============================================================================
    // REDIRECT & POPUP BLOCKER
    // ============================================================================

    class RedirectBlocker {
        constructor() {
            this.allowNavigation = true;
            this.blockedAttempts = 0;
            this.setupProtection();
        }

        setupProtection() {
            // 1. Override window.open
            const originalOpen = window.open;
            window.open = (...args) => {
                const url = args[0];
                if (this.isSuspiciousURL(url)) {
                    this.blockedAttempts++;
                    Utils.log('Blocked window.open:', url);
                    return null;
                }
                return originalOpen.apply(window, args);
            };

            // 2. Intercept beforeunload
            window.addEventListener('beforeunload', (e) => {
                if (!this.allowNavigation) {
                    e.preventDefault();
                    e.returnValue = '';
                    return '';
                }
            }, true);

            // 3. Monitor click events
            document.addEventListener('click', (e) => this.handleClick(e), true);

            // 4. Monitor form submissions
            document.addEventListener('submit', (e) => this.handleSubmit(e), true);

            // 5. Block meta refresh
            this.blockMetaRefresh();
        }

        handleClick(e) {
            const target = e.target;
            
            // Check for ad overlays
            const adOverlay = target.closest(CONFIG.selectors.overlays.join(','));
            if (adOverlay) {
                e.stopImmediatePropagation();
                e.preventDefault();
                adRemover.removeElement(adOverlay, 'click-blocked');
                return false;
            }

            // Check links
            const link = target.closest('a');
            if (link && link.href) {
                if (this.isSuspiciousURL(link.href)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.blockedAttempts++;
                    Utils.log('Blocked suspicious link:', link.href);
                    return false;
                }
            }

            // Check for data-href redirects
            const dataHref = target.closest('[data-href], [data-url]');
            if (dataHref) {
                const url = dataHref.getAttribute('data-href') || 
                           dataHref.getAttribute('data-url');
                if (this.isSuspiciousURL(url)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.blockedAttempts++;
                    return false;
                }
            }
        }

        handleSubmit(e) {
            const form = e.target;
            const action = form.action;
            
            if (this.isSuspiciousURL(action)) {
                e.preventDefault();
                e.stopPropagation();
                this.blockedAttempts++;
                Utils.log('Blocked suspicious form submission:', action);
                return false;
            }
        }

        isSuspiciousURL(url) {
            if (!url || typeof url !== 'string') return false;
            
            const lower = url.toLowerCase();
            
            // Check for suspicious keywords
            if (CONFIG.behaviors.redirectKeywords.some(kw => lower.includes(kw))) {
                return true;
            }

            // Check for suspicious hosts
            try {
                const urlObj = new URL(url, window.location.href);
                return CONFIG.behaviors.suspiciousHosts.some(host => 
                    urlObj.hostname.includes(host)
                );
            } catch {
                return false;
            }
        }

        blockMetaRefresh() {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'META' && 
                            node.getAttribute('http-equiv') === 'refresh') {
                            const content = node.getAttribute('content');
                            if (content && this.isSuspiciousURL(content)) {
                                node.remove();
                                Utils.log('Blocked meta refresh');
                            }
                        }
                    });
                });
            });

            if (document.head) {
                observer.observe(document.head, { childList: true });
            }
        }

        getStats() {
            return { blockedAttempts: this.blockedAttempts };
        }
    }

    const redirectBlocker = new RedirectBlocker();

    // ============================================================================
    // MUTATION OBSERVER
    // ============================================================================

    class DOMObserver {
        constructor() {
            this.observer = null;
            this.throttledRemoval = Utils.throttle(
                () => adRemover.removeAds(), 
                CONFIG.observerThrottle
            );
        }

        start() {
            if (this.observer) return;

            this.observer = new MutationObserver(mutations => {
                let hasNewNodes = false;

                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Clean inline handlers immediately
                            this.cleanElement(node);
                            hasNewNodes = true;
                        }
                    });
                });

                if (hasNewNodes) {
                    this.throttledRemoval();
                }
            });

            const startObserving = () => {
                if (document.body) {
                    this.observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['class', 'id', 'style']
                    });
                    Utils.log('DOM observer started');
                } else {
                    requestAnimationFrame(startObserving);
                }
            };

            startObserving();
        }

        cleanElement(element) {
            ['onclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onload']
                .forEach(attr => {
                    if (element.hasAttribute && element.hasAttribute(attr)) {
                        element.removeAttribute(attr);
                    }
                });

            // Clean child elements
            if (element.querySelectorAll) {
                element.querySelectorAll('[onclick], [onmousedown], [data-href]')
                    .forEach(child => this.cleanElement(child));
            }
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                Utils.log('DOM observer stopped');
            }
        }
    }

    const domObserver = new DOMObserver();

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    function init() {
        Utils.log('Quantum AdBlocker content script initializing...');

        // Remove initial ads
        adRemover.removeAds();

        // Start observers
        domObserver.start();

        // Periodic cleanup
        setInterval(() => {
            adRemover.removeAds();
        }, 5000);

        // Listen for messages
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getStats') {
                sendResponse({
                    adRemover: adRemover.getStats(),
                    redirectBlocker: redirectBlocker.getStats()
                });
            }
        });

        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            domObserver.stop();
        });

        Utils.log('Quantum AdBlocker initialized successfully');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();