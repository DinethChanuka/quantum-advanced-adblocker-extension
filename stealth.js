// stealth.js - Military-Grade Anti-Detection System
// ============================================================================

(function() {
    'use strict';

    const STEALTH_CONFIG = {
        debug: false,
        spoofAdEnvironment: true,
        preventFingerprinting: true,
        blockDetectionScripts: true
    };

    function log(...args) {
        if (STEALTH_CONFIG.debug) console.log('[Stealth]', ...args);
    }

    // ============================================================================
    // 1. AD ENVIRONMENT SPOOFING
    // ============================================================================

    if (STEALTH_CONFIG.spoofAdEnvironment) {
        // Google AdSense Spoofing
        const fakeAdsense = {
            loaded: true,
            push: function(...args) {
                log('Intercepted adsbygoogle.push:', args);
                return args.length;
            },
            google_ad_client: "ca-pub-0000000000000000",
            google_ad_slot: "0000000000",
            enable_page_level_ads: true,
            google_ad_status: 'filled'
        };

        Object.defineProperty(window, 'adsbygoogle', {
            get: () => fakeAdsense,
            set: () => {},
            configurable: false
        });

        // Fake Google Tag Manager
        Object.defineProperty(window, 'dataLayer', {
            value: {
                push: function(...args) {
                    log('Intercepted dataLayer.push:', args);
                    return args.length;
                }
            },
            writable: false,
            configurable: false
        });

        // Fake Facebook Pixel
        Object.defineProperty(window, 'fbq', {
            value: function(...args) {
                log('Intercepted fbq:', args);
            },
            writable: false,
            configurable: false
        });

        // Fake Google Analytics
        Object.defineProperty(window, 'ga', {
            value: function(...args) {
                log('Intercepted ga:', args);
            },
            writable: false,
            configurable: false
        });

        Object.defineProperty(window, 'gtag', {
            value: function(...args) {
                log('Intercepted gtag:', args);
            },
            writable: false,
            configurable: false
        });

        // Create fake ad slots
        function injectFakeSlots() {
            if (!document.body) return;

            // Fake AdSense ins element
            const fakeIns = document.createElement('ins');
            fakeIns.className = 'adsbygoogle';
            fakeIns.setAttribute('data-ad-status', 'filled');
            fakeIns.setAttribute('data-ad-slot', '0000000000');
            fakeIns.style.cssText = 'display:block;width:0;height:0;position:absolute;top:-9999px';
            document.body.appendChild(fakeIns);

            // Fake Google Ads iframe
            const fakeIframe = document.createElement('div');
            fakeIframe.id = 'google_ads_iframe_container';
            fakeIframe.style.cssText = 'display:none;position:absolute;top:-9999px';
            document.body.appendChild(fakeIframe);

            log('Fake ad slots injected');
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectFakeSlots);
        } else {
            injectFakeSlots();
        }
    }

    // ============================================================================
    // 2. FINGERPRINTING PROTECTION
    // ============================================================================

    if (STEALTH_CONFIG.preventFingerprinting) {
        // Canvas Fingerprinting Protection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const context = this.getContext('2d');
            if (context) {
                // Add minimal noise to prevent fingerprinting
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ 1; // XOR with 1 to add noise
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, args);
        };

        HTMLCanvasElement.prototype.toBlob = function(...args) {
            const context = this.getContext('2d');
            if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ 1;
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToBlob.apply(this, args);
        };

        // WebGL Fingerprinting Protection
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // Spoof renderer and vendor
            if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
            if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
            return getParameter.call(this, parameter);
        };

        // Audio Context Fingerprinting Protection
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const originalCreateOscillator = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function() {
                const oscillator = originalCreateOscillator.call(this);
                const originalStart = oscillator.start;
                oscillator.start = function(...args) {
                    // Add minimal timing jitter
                    const jitter = Math.random() * 0.0001;
                    if (args[0]) args[0] += jitter;
                    return originalStart.apply(this, args);
                };
                return oscillator;
            };
        }

        log('Fingerprinting protection enabled');
    }

    // ============================================================================
    // 3. ELEMENT VISIBILITY SPOOFING
    // ============================================================================

    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
        // Return fake dimensions for ad elements to bypass detection
        if (this.matches && (
            this.matches('[data-element="overlay"]') ||
            this.matches('.code-block') ||
            this.matches('[class*="ad-"]') ||
            this.matches('[id*="ad-"]')
        )) {
            return { width: 0, height: 0, top: -9999, left: -9999, right: -9999, bottom: -9999 };
        }
        return originalGetBoundingClientRect.call(this);
    };

    const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        get: function() {
            if (this.matches && (
                this.matches('[class*="ad-"]') ||
                this.matches('[id*="ad-"]') ||
                this.classList.contains('code-block')
            )) {
                return 0;
            }
            return originalOffsetWidth.get.call(this);
        }
    });

    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        get: function() {
            if (this.matches && (
                this.matches('[class*="ad-"]') ||
                this.matches('[id*="ad-"]') ||
                this.classList.contains('code-block')
            )) {
                return 0;
            }
            return originalOffsetHeight.get.call(this);
        }
    });

    // ============================================================================
    // 4. NETWORK REQUEST INTERCEPTION
    // ============================================================================

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        // Block detection scripts
        if (url && (
            url.includes('/detect') ||
            url.includes('/adblock') ||
            url.includes('/checker') ||
            url.includes('/anti-adblock')
        )) {
            log('Blocked detection request:', url);
            return Promise.resolve(new Response(
                JSON.stringify({ adblock: false, status: 'ok', ads_enabled: true }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        return originalFetch.apply(this, args);
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
        if (this._url && (
            this._url.includes('/detect') ||
            this._url.includes('/adblock') ||
            this._url.includes('/checker')
        )) {
            log('Blocked XHR detection request:', this._url);
            
            // Fake success response
            Object.defineProperty(this, 'status', { value: 200 });
            Object.defineProperty(this, 'statusText', { value: 'OK' });
            Object.defineProperty(this, 'responseText', { 
                value: JSON.stringify({ adblock: false, status: 'ok' })
            });
            Object.defineProperty(this, 'response', { 
                value: JSON.stringify({ adblock: false, status: 'ok' })
            });
            Object.defineProperty(this, 'readyState', { value: 4 });
            
            setTimeout(() => {
                if (this.onload) this.onload.call(this);
                if (this.onreadystatechange) this.onreadystatechange.call(this);
            }, 0);
            
            return;
        }

        return originalSend.apply(this, args);
    };

    // ============================================================================
    // 5. SCRIPT INJECTION PROTECTION
    // ============================================================================

    if (STEALTH_CONFIG.blockDetectionScripts) {
        // Monitor script creation
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            
            if (tagName.toLowerCase() === 'script') {
                const originalSetAttribute = element.setAttribute;
                element.setAttribute = function(name, value) {
                    if (name === 'src' && value && (
                        value.includes('/adblock') ||
                        value.includes('/detect') ||
                        value.includes('/anti-ad') ||
                        value.includes('pagead2.googlesyndication') ||
                        value.includes('googletagservices')
                    )) {
                        log('Blocked script injection:', value);
                        return;
                    }
                    return originalSetAttribute.call(this, name, value);
                };
            }
            
            return element;
        };

        // Monitor appendChild for script injection
        const originalAppendChild = Element.prototype.appendChild;
        Element.prototype.appendChild = function(child) {
            if (child.tagName === 'SCRIPT' && child.src) {
                if (child.src.includes('/adblock') || 
                    child.src.includes('/detect') ||
                    child.src.includes('/anti-ad')) {
                    log('Blocked script appendChild:', child.src);
                    return child;
                }
            }
            return originalAppendChild.call(this, child);
        };
    }

    // ============================================================================
    // 6. PROPERTY DETECTION PREVENTION
    // ============================================================================

    // Prevent detection through property checks
    Object.defineProperty(window, '__firefox__', { value: undefined });
    Object.defineProperty(window, '__chrome__', { value: undefined });
    Object.defineProperty(window, '__adblock__', { value: undefined });
    Object.defineProperty(window, 'adblock', { value: false });
    Object.defineProperty(window, 'adBlock', { value: false });
    Object.defineProperty(window, 'adBlockEnabled', { value: false });

    // ============================================================================
    // 7. TIMING ATTACK PREVENTION
    // ============================================================================

    const originalPerformanceNow = performance.now;
    performance.now = function() {
        // Add random jitter to prevent timing attacks
        return originalPerformanceNow.call(this) + (Math.random() - 0.5) * 0.1;
    };

    // ============================================================================
    // 8. CONSOLE SPOOFING
    // ============================================================================

    // Prevent detection through console inspection
    const originalConsoleLog = console.log;
    console.log = function(...args) {
        // Filter out certain log messages that might reveal adblocking
        const str = args.join(' ');
        if (!str.includes('AdBlock') && !str.includes('adblock')) {
            return originalConsoleLog.apply(this, args);
        }
    };

    // ============================================================================
    // 9. STORAGE ACCESS CONTROL
    // ============================================================================

    // Monitor localStorage access for tracking prevention
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
        // Block certain tracking keys
        if (key && (
            key.includes('_ga') ||
            key.includes('_fbp') ||
            key.includes('_tracking') ||
            key.includes('_ad_')
        )) {
            log('Blocked tracking storage:', key);
            return;
        }
        return originalSetItem.call(this, key, value);
    };

    // ============================================================================
    // 10. MUTATION OBSERVER PROTECTION
    // ============================================================================

    // Prevent detection scripts from observing our modifications
    const originalMutationObserver = window.MutationObserver;
    window.MutationObserver = function(callback) {
        return new originalMutationObserver(function(mutations, observer) {
            // Filter out mutations related to our adblocking
            const filtered = mutations.filter(m => {
                return !Array.from(m.removedNodes).some(node => 
                    node.classList && (
                        node.classList.contains('code-block') ||
                        node.getAttribute && node.getAttribute('data-element') === 'overlay'
                    )
                );
            });
            
            if (filtered.length > 0) {
                return callback.call(this, filtered, observer);
            }
        });
    };

    log('Stealth mode activated - Full protection enabled');

})();