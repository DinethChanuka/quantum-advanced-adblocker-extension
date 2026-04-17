// dom-observer.js - Advanced DOM Mutation Observer
// ============================================================================

(function() {
    'use strict';

    class AdvancedDOMObserver {
        constructor() {
            this.observer = null;
            this.pendingMutations = [];
            this.processingQueue = false;
            this.stats = {
                mutations: 0,
                nodesAdded: 0,
                nodesRemoved: 0,
                attributeChanges: 0
            };
        }

        start(callback) {
            if (this.observer) return;

            this.observer = new MutationObserver(mutations => {
                this.stats.mutations += mutations.length;
                this.pendingMutations.push(...mutations);
                this.processMutations(callback);
            });

            const config = {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'id', 'style', 'data-ad-slot', 'data-ad-client'],
                characterData: false
            };

            const startObserving = () => {
                if (document.body) {
                    this.observer.observe(document.body, config);
                    console.log('[DOMObserver] Started observing');
                } else {
                    requestAnimationFrame(startObserving);
                }
            };

            startObserving();
        }

        processMutations(callback) {
            if (this.processingQueue || this.pendingMutations.length === 0) return;
            
            this.processingQueue = true;
            requestAnimationFrame(() => {
                const mutations = this.pendingMutations.splice(0, 100); // Process in batches
                
                const addedNodes = new Set();
                const modifiedElements = new Set();

                mutations.forEach(mutation => {
                    // Track added nodes
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            addedNodes.add(node);
                            this.stats.nodesAdded++;
                        }
                    });

                    // Track removed nodes
                    if (mutation.removedNodes.length > 0) {
                        this.stats.nodesRemoved += mutation.removedNodes.length;
                    }

                    // Track attribute changes
                    if (mutation.type === 'attributes') {
                        modifiedElements.add(mutation.target);
                        this.stats.attributeChanges++;
                    }
                });

                // Process added nodes
                if (addedNodes.size > 0) {
                    callback({ type: 'added', nodes: Array.from(addedNodes) });
                }

                // Process modified elements
                if (modifiedElements.size > 0) {
                    callback({ type: 'modified', elements: Array.from(modifiedElements) });
                }

                this.processingQueue = false;
                
                // Continue processing if more mutations pending
                if (this.pendingMutations.length > 0) {
                    this.processMutations(callback);
                }
            });
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                console.log('[DOMObserver] Stopped observing');
            }
        }

        getStats() {
            return { ...this.stats };
        }
    }

    // Export to global scope
    window.AdvancedDOMObserver = AdvancedDOMObserver;

})();