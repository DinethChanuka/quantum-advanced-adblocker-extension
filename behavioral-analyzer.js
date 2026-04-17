// behavioral-analyzer.js - Deep Behavioral Pattern Analysis
// ============================================================================

(function() {
    'use strict';

    class AdvancedBehavioralAnalyzer {
        constructor() {
            this.patterns = {
                // URL patterns that indicate ads/tracking
                urlPatterns: [
                    /\/ad[sx]?\//i, /\/ads\?/, /\/advert/, /\/banner/,
                    /\/click/, /\/track/, /\/pixel/, /\/beacon/,
                    /popunder/, /popup/, /redirect/, /syndication/,
                    /doubleclick/, /adsense/, /adserver/, /admob/
                ],
                
                // Class/ID patterns
                namingPatterns: [
                    /ad[-_]?(?:container|wrapper|slot|unit|banner)/i,
                    /(?:google|fb|facebook)[-_]?ad/i,
                    /sponsor(?:ed)?/i, /promo(?:tion)?/i,
                    /banner[-_]?\d+/, /popup[-_]?(?:container|wrapper)/i
                ],

                // Text content patterns
                textPatterns: [
                    /sponsored/i, /advertisement/i, /ad\s*by/i,
                    /click\s*here/i, /sign\s*up\s*now/i, /limited\s*offer/i,
                    /free\s*trial/i, /hot\s*singles/i, /casino/i,
                    /porn/i, /xxx/i, /dating/i, /viagra/i
                ]
            };

            // Standard ad dimensions (width x height)
            this.adDimensions = [
                [728, 90],   // Leaderboard
                [300, 250],  // Medium Rectangle
                [336, 280],  // Large Rectangle
                [160, 600],  // Wide Skyscraper
                [300, 600],  // Half Page
                [970, 250],  // Billboard
                [970, 90],   // Super Leaderboard
                [320, 50],   // Mobile Banner
                [320, 100],  // Large Mobile Banner
                [468, 60],   // Banner
                [234, 60],   // Half Banner
                [125, 125],  // Square Button
                [120, 600],  // Skyscraper
                [180, 150]   // Rectangle
            ];

            this.suspiciousElements = new WeakMap();
            this.behaviorStats = {
                analyzed: 0,
                flagged: 0,
                byCategory: {}
            };
        }

        analyzeElement(element) {
            if (!element || !element.nodeType) return null;
            if (this.suspiciousElements.has(element)) {
                return this.suspiciousElements.get(element);
            }

            this.behaviorStats.analyzed++;

            const analysis = {
                score: 0,
                maxScore: 100,
                reasons: [],
                category: null,
                confidence: 0
            };

            // 1. Analyze dimensions
            const dimensionScore = this.analyzeDimensions(element);
            analysis.score += dimensionScore.score;
            analysis.reasons.push(...dimensionScore.reasons);

            // 2. Analyze positioning
            const positionScore = this.analyzePositioning(element);
            analysis.score += positionScore.score;
            analysis.reasons.push(...positionScore.reasons);

            // 3. Analyze naming (classes/IDs)
            const namingScore = this.analyzeNaming(element);
            analysis.score += namingScore.score;
            analysis.reasons.push(...namingScore.reasons);

            // 4. Analyze content
            const contentScore = this.analyzeContent(element);
            analysis.score += contentScore.score;
            analysis.reasons.push(...contentScore.reasons);

            // 5. Analyze structure
            const structureScore = this.analyzeStructure(element);
            analysis.score += structureScore.score;
            analysis.reasons.push(...structureScore.reasons);

            // 6. Analyze behavior
            const behaviorScore = this.analyzeBehavior(element);
            analysis.score += behaviorScore.score;
            analysis.reasons.push(...behaviorScore.reasons);

            // 7. Analyze network
            const networkScore = this.analyzeNetwork(element);
            analysis.score += networkScore.score;
            analysis.reasons.push(...networkScore.reasons);

            // Calculate confidence and category
            analysis.confidence = Math.min(analysis.score / analysis.maxScore, 1);
            analysis.category = this.categorize(analysis);

            // Cache result
            if (analysis.score > 30) {
                this.suspiciousElements.set(element, analysis);
                this.behaviorStats.flagged++;
                this.behaviorStats.byCategory[analysis.category] = 
                    (this.behaviorStats.byCategory[analysis.category] || 0) + 1;
            }

            return analysis;
        }

        analyzeDimensions(element) {
            const result = { score: 0, reasons: [] };
            const width = element.offsetWidth;
            const height = element.offsetHeight;

            if (!width || !height) return result;

            // Check against known ad dimensions
            for (const [adW, adH] of this.adDimensions) {
                if (Math.abs(width - adW) <= 5 && Math.abs(height - adH) <= 5) {
                    result.score += 25;
                    result.reasons.push(`standard-ad-size:${adW}x${adH}`);
                    break;
                }
            }

            // Suspicious aspect ratios
            const aspectRatio = width / height;
            if (aspectRatio > 5 || aspectRatio < 0.2) {
                result.score += 10;
                result.reasons.push('unusual-aspect-ratio');
            }

            return result;
        }

        analyzePositioning(element) {
            const result = { score: 0, reasons: [] };
            const style = window.getComputedStyle(element);

            // Fixed/absolute positioning with high z-index
            const position = style.position;
            const zIndex = parseInt(style.zIndex) || 0;

            if (position === 'fixed' || position === 'absolute') {
                if (zIndex > 1000) {
                    result.score += 20;
                    result.reasons.push(`high-z-index:${zIndex}`);
                } else if (zIndex > 100) {
                    result.score += 10;
                    result.reasons.push('elevated-z-index');
                }
            }

            // Full-screen overlay detection
            if (position === 'fixed') {
                const width = element.offsetWidth;
                const height = element.offsetHeight;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (width >= viewportWidth * 0.9 && height >= viewportHeight * 0.9) {
                    result.score += 25;
                    result.reasons.push('fullscreen-overlay');
                }
            }

            return result;
        }

        analyzeNaming(element) {
            const result = { score: 0, reasons: [] };
            const className = element.className || '';
            const id = element.id || '';
            const combined = `${className} ${id}`.toLowerCase();

            // Check against naming patterns
            for (const pattern of this.patterns.namingPatterns) {
                if (pattern.test(combined)) {
                    result.score += 15;
                    result.reasons.push(`suspicious-naming:${pattern.source.substring(0, 30)}`);
                }
            }

            // Check for obfuscated class names
            if (className.length > 20 && /^[a-f0-9]+$/i.test(className)) {
                result.score += 10;
                result.reasons.push('obfuscated-classname');
            }

            return result;
        }

        analyzeContent(element) {
            const result = { score: 0, reasons: [] };
            const text = (element.textContent || '').toLowerCase();

            // Check text patterns
            for (const pattern of this.patterns.textPatterns) {
                if (pattern.test(text)) {
                    result.score += 10;
                    result.reasons.push(`suspicious-text:${pattern.source.substring(0, 20)}`);
                }
            }

            // High link density (common in ads)
            const links = element.querySelectorAll('a').length;
            const textLength = text.length;
            if (textLength > 0) {
                const linkDensity = links / Math.max(textLength / 100, 1);
                if (linkDensity > 2) {
                    result.score += 15;
                    result.reasons.push('high-link-density');
                }
            }

            return result;
        }

        analyzeStructure(element) {
            const result = { score: 0, reasons: [] };

            // Check for iframes (common in ads)
            if (element.tagName === 'IFRAME') {
                const src = element.src || '';
                for (const pattern of this.patterns.urlPatterns) {
                    if (pattern.test(src)) {
                        result.score += 30;
                        result.reasons.push('ad-iframe');
                        break;
                    }
                }
            }

            // Check for tracking pixels
            const images = element.querySelectorAll('img[width="1"], img[height="1"]');
            if (images.length > 0) {
                result.score += 20;
                result.reasons.push(`tracking-pixels:${images.length}`);
            }

            // Check for script tags
            const scripts = element.querySelectorAll('script');
            if (scripts.length > 2) {
                result.score += 5;
                result.reasons.push('multiple-scripts');
            }

            return result;
        }

        analyzeBehavior(element) {
            const result = { score: 0, reasons: [] };

            // Check for click handlers
            const hasOnClick = element.hasAttribute('onclick') || 
                              element.hasAttribute('onmousedown');
            if (hasOnClick) {
                const handler = element.getAttribute('onclick') || 
                               element.getAttribute('onmousedown') || '';
                
                // Check for suspicious patterns
                if (/window\.open|location\.|redirect|popup/i.test(handler)) {
                    result.score += 25;
                    result.reasons.push('suspicious-click-handler');
                }
            }

            // Check for data attributes that might trigger actions
            if (element.hasAttribute('data-href') || 
                element.hasAttribute('data-url') ||
                element.hasAttribute('data-redirect')) {
                result.score += 10;
                result.reasons.push('redirect-attributes');
            }

            return result;
        }

        analyzeNetwork(element) {
            const result = { score: 0, reasons: [] };

            // Check all URLs in the element
            const urls = [];
            
            // Get src attributes
            const srcElements = element.querySelectorAll('[src]');
            srcElements.forEach(el => {
                if (el.src) urls.push(el.src);
            });

            // Get href attributes
            const hrefElements = element.querySelectorAll('[href]');
            hrefElements.forEach(el => {
                if (el.href) urls.push(el.href);
            });

            // Check URLs against patterns
            for (const url of urls) {
                for (const pattern of this.patterns.urlPatterns) {
                    if (pattern.test(url)) {
                        result.score += 15;
                        result.reasons.push('suspicious-url');
                        break;
                    }
                }
            }

            return result;
        }

        categorize(analysis) {
            const { score, reasons } = analysis;

            if (reasons.some(r => r.includes('iframe'))) return 'iframe-ad';
            if (reasons.some(r => r.includes('tracking-pixel'))) return 'tracker';
            if (reasons.some(r => r.includes('overlay'))) return 'overlay';
            if (reasons.some(r => r.includes('popup'))) return 'popup';
            if (score > 60) return 'likely-ad';
            if (score > 40) return 'suspicious';
            return 'unknown';
        }

        isAd(element) {
            const analysis = this.analyzeElement(element);
            return analysis && analysis.confidence > 0.6;
        }

        getStats() {
            return { ...this.behaviorStats };
        }
    }

    // Export to global scope
    window.AdvancedBehavioralAnalyzer = AdvancedBehavioralAnalyzer;

})();