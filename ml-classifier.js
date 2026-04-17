// ml-classifier.js - Machine Learning Classifier
// ============================================================================

(function() {
    'use strict';

    class MLAdClassifier {
        constructor() {
            this.features = [];
            this.weights = this.initializeWeights();
            this.trainingData = [];
            this.accuracy = 0;
        }

        initializeWeights() {
            // Pre-trained weights based on common ad characteristics
            return {
                width: 0.05,
                height: 0.05,
                area: 0.08,
                aspectRatio: 0.06,
                zIndex: 0.12,
                isFixed: 0.15,
                isAbsolute: 0.10,
                hasClickHandler: 0.14,
                isIframe: 0.18,
                hasAdClass: 0.25,
                hasAdId: 0.22,
                textLength: -0.03,
                linkCount: 0.08,
                imageCount: 0.05,
                scriptCount: 0.07,
                suspiciousURL: 0.20,
                trackingPixel: 0.18,
                highLinkDensity: 0.12,
                fullWidth: 0.09,
                position_top: 0.06,
                position_bottom: 0.06,
                hasDataAd: 0.20
            };
        }

        extractFeatures(element) {
            if (!element || !element.nodeType) return null;

            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            const features = {
                // Dimensional features
                width: element.offsetWidth || 0,
                height: element.offsetHeight || 0,
                area: (element.offsetWidth || 0) * (element.offsetHeight || 0),
                aspectRatio: this.calculateAspectRatio(element),
                
                // Position features
                zIndex: parseInt(style.zIndex) || 0,
                isFixed: style.position === 'fixed' ? 1 : 0,
                isAbsolute: style.position === 'absolute' ? 1 : 0,
                position_top: rect.top < 100 ? 1 : 0,
                position_bottom: rect.bottom > window.innerHeight - 100 ? 1 : 0,
                fullWidth: element.offsetWidth >= window.innerWidth * 0.9 ? 1 : 0,
                
                // Interaction features
                hasClickHandler: this.hasClickHandler(element) ? 1 : 0,
                
                // Element type features
                isIframe: element.tagName === 'IFRAME' ? 1 : 0,
                
                // Naming features
                hasAdClass: this.hasAdNaming(element.className) ? 1 : 0,
                hasAdId: this.hasAdNaming(element.id) ? 1 : 0,
                hasDataAd: this.hasDataAdAttributes(element) ? 1 : 0,
                
                // Content features
                textLength: (element.textContent || '').length,
                linkCount: element.querySelectorAll('a').length,
                imageCount: element.querySelectorAll('img').length,
                scriptCount: element.querySelectorAll('script').length,
                
                // Behavioral features
                suspiciousURL: this.hasSuspiciousURL(element) ? 1 : 0,
                trackingPixel: this.hasTrackingPixel(element) ? 1 : 0,
                highLinkDensity: this.hasHighLinkDensity(element) ? 1 : 0
            };

            return this.normalizeFeatures(features);
        }

        normalizeFeatures(features) {
            // Normalize numerical features to 0-1 range
            const normalized = { ...features };
            
            normalized.width = Math.min(features.width / 1000, 1);
            normalized.height = Math.min(features.height / 1000, 1);
            normalized.area = Math.min(features.area / 500000, 1);
            normalized.zIndex = Math.min(Math.abs(features.zIndex) / 10000, 1);
            normalized.textLength = Math.min(features.textLength / 500, 1);
            normalized.linkCount = Math.min(features.linkCount / 10, 1);
            normalized.imageCount = Math.min(features.imageCount / 5, 1);
            normalized.scriptCount = Math.min(features.scriptCount / 3, 1);
            
            return normalized;
        }

        calculateAspectRatio(element) {
            const width = element.offsetWidth || 1;
            const height = element.offsetHeight || 1;
            return Math.min(width / height, height / width);
        }

        hasClickHandler(element) {
            return element.hasAttribute('onclick') ||
                   element.hasAttribute('onmousedown') ||
                   element.hasAttribute('data-href') ||
                   element.hasAttribute('data-url');
        }

        hasAdNaming(str) {
            if (!str) return false;
            const patterns = [
                /ad[-_]?/i, /banner/i, /sponsor/i, /promo/i,
                /advertisement/i, /\bad\b/i
            ];
            return patterns.some(p => p.test(str));
        }

        hasDataAdAttributes(element) {
            const adAttrs = ['data-ad-slot', 'data-ad-client', 'data-ad-unit'];
            return adAttrs.some(attr => element.hasAttribute(attr));
        }

        hasSuspiciousURL(element) {
            const urls = [];
            
            // Collect URLs
            if (element.src) urls.push(element.src);
            if (element.href) urls.push(element.href);
            element.querySelectorAll('[src], [href]').forEach(el => {
                if (el.src) urls.push(el.src);
                if (el.href) urls.push(el.href);
            });

            const patterns = [
                /doubleclick/i, /googlesyndication/i, /advertising/i,
                /adserver/i, /\/ad[sx]?\//i, /banner/i, /popunder/i
            ];

            return urls.some(url => patterns.some(p => p.test(url)));
        }

        hasTrackingPixel(element) {
            const pixels = element.querySelectorAll('img[width="1"], img[height="1"]');
            return pixels.length > 0;
        }

        hasHighLinkDensity(element) {
            const text = element.textContent || '';
            const links = element.querySelectorAll('a').length;
            if (text.length === 0) return false;
            return (links / Math.max(text.length / 100, 1)) > 2;
        }

        classify(element) {
            const features = this.extractFeatures(element);
            if (!features) {
                return { isAd: false, confidence: 0, features: null };
            }

            // Calculate weighted sum
            let score = 0;
            for (const [feature, value] of Object.entries(features)) {
                if (this.weights[feature] !== undefined) {
                    score += value * this.weights[feature];
                }
            }

            // Apply sigmoid activation
            const confidence = 1 / (1 + Math.exp(-score));
            const isAd = confidence > 0.6;

            return {
                isAd,
                confidence,
                features,
                score
            };
        }

        classifyBatch(elements) {
            return elements.map(el => this.classify(el));
        }

        // Simple online learning
        updateWeights(element, actualLabel, learningRate = 0.01) {
            const features = this.extractFeatures(element);
            if (!features) return;

            const prediction = this.classify(element);
            const error = actualLabel - prediction.confidence;

            // Update weights using gradient descent
            for (const [feature, value] of Object.entries(features)) {
                if (this.weights[feature] !== undefined) {
                    this.weights[feature] += learningRate * error * value;
                }
            }

            this.trainingData.push({ element, label: actualLabel });
        }

        getWeights() {
            return { ...this.weights };
        }

        getStats() {
            return {
                trainingDataSize: this.trainingData.length,
                accuracy: this.accuracy,
                weights: this.getWeights()
            };
        }
    }

    // Export to global scope
    window.MLAdClassifier = MLAdClassifier;

})();