// tracker-blocker.js - Advanced Tracking Protection
// ============================================================================

(function() {
    'use strict';

    class TrackerBlocker {
        constructor() {
            this.blockedTrackers = new Map();
            this.stats = {
                cookiesBlocked: 0,
                storageBlocked: 0,
                fingerprintingBlocked: 0,
                trackingPixelsBlocked: 0
            };

            this.trackingDomains = new Set([
                'google-analytics.com', 'googletagmanager.com',
                'facebook.com/tr', 'connect.facebook.net',
                'doubleclick.net', 'scorecardresearch.com',
                'quantserve.com', 'hotjar.com', 'mouseflow.com',
                'crazyegg.com', 'mixpanel.com', 'segment.com'
            ]);

            this.init();
        }

        init() {
            this.blockTrackingCookies();
            this.blockTrackingStorage();
            this.blockTrackingPixels();
            this.blockFingerprinting();
        }

        blockTrackingCookies() {
            // Monitor cookie setting
            const originalCookieSetter = Object.getOwnPropertyDescriptor(
                Document.prototype, 'cookie'
            ).set;

            Object.defineProperty(document, 'cookie', {
                set: (value) => {
                    // Block tracking cookies
                    const trackingPatterns = [
                        '_ga', '_gid', '_gat', '_fbp', '_fbc',
                        '__utm', '_hjid', '_mkto', '_gcl'
                    ];

                    const isTracking = trackingPatterns.some(pattern => 
                        value.includes(pattern)
                    );

                    if (isTracking) {
                        this.stats.cookiesBlocked++;
                        console.log('[TrackerBlocker] Blocked tracking cookie:', value.substring(0, 50));
                        return;
                    }

                    return originalCookieSetter.call(document, value);
                },
                get: Object.getOwnPropertyDescriptor(Document.prototype, 'cookie').get
            });
        }

        blockTrackingStorage() {
            // Block localStorage tracking
            const originalSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                const trackingKeys = [
                    '_ga', '_gid', '_fbp', '_tracking',
                    '_analytics', '_visitor', '_session'
                ];

                const isTracking = trackingKeys.some(pattern => 
                    key.toLowerCase().includes(pattern)
                );

                if (isTracking) {
                    this.stats.storageBlocked++;
                    console.log('[TrackerBlocker] Blocked tracking storage:', key);
                    return;
                }

                return originalSetItem.call(this, key, value);
            }.bind(this);

            // Block sessionStorage tracking
            const originalSessionSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                const trackingKeys = [
                    '_ga', '_gid', '_fbp', '_tracking'
                ];

                const isTracking = trackingKeys.some(pattern => 
                    key.toLowerCase().includes(pattern)
                );

                if (isTracking) {
                    this.stats.storageBlocked++;
                    return;
                }

                return originalSessionSetItem.call(this, key, value);
            }.bind(this);
        }

        blockTrackingPixels() {
            // Monitor image loading
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'IMG') {
                            this.checkTrackingPixel(node);
                        }
                    });
                });
            });

            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }

            // Check existing images
            document.querySelectorAll('img').forEach(img => {
                this.checkTrackingPixel(img);
            });
        }

        checkTrackingPixel(img) {
            const width = parseInt(img.width) || img.offsetWidth;
            const height = parseInt(img.height) || img.offsetHeight;
            const src = img.src || '';

            // Tracking pixel characteristics
            const isTrackingPixel = (width <= 1 && height <= 1) ||
                                   src.includes('pixel') ||
                                   src.includes('track') ||
                                   src.includes('beacon') ||
                                   src.includes('analytics');

            if (isTrackingPixel) {
                img.remove();
                this.stats.trackingPixelsBlocked++;
                console.log('[TrackerBlocker] Blocked tracking pixel:', src.substring(0, 50));
            }
        }

        blockFingerprinting() {
            // Already handled in stealth.js, but add extra protection here
            
            // Block Navigator properties access
            const navigatorProps = ['userAgent', 'platform', 'plugins', 'languages'];
            navigatorProps.forEach(prop => {
                const originalValue = navigator[prop];
                Object.defineProperty(navigator, prop, {
                    get: () => {
                        this.stats.fingerprintingBlocked++;
                        return originalValue;
                    }
                });
            });

            // Block Screen properties
            const screenProps = ['width', 'height', 'colorDepth'];
            screenProps.forEach(prop => {
                const originalValue = screen[prop];
                Object.defineProperty(screen, prop, {
                    get: () => {
                        this.stats.fingerprintingBlocked++;
                        return originalValue;
                    }
                });
            });
        }

        isTrackingDomain(url) {
            try {
                const urlObj = new URL(url);
                return Array.from(this.trackingDomains).some(domain => 
                    urlObj.hostname.includes(domain)
                );
            } catch {
                return false;
            }
        }

        blockRequest(url) {
            if (this.isTrackingDomain(url)) {
                const count = this.blockedTrackers.get(url) || 0;
                this.blockedTrackers.set(url, count + 1);
                return true;
            }
            return false;
        }

        getStats() {
            return {
                ...this.stats,
                blockedDomains: this.blockedTrackers.size,
                totalBlocked: Array.from(this.blockedTrackers.values())
                    .reduce((sum, count) => sum + count, 0)
            };
        }
    }

    // Initialize tracker blocker
    const trackerBlocker = new TrackerBlocker();
    window.TrackerBlocker = trackerBlocker;

    console.log('[TrackerBlocker] Initialized');

})();