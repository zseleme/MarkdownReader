'use strict';

/**
 * Monaco Editor Loader
 * Loads Monaco Editor from CDN and signals readiness via flag and event.
 * Uses dual signaling to prevent race conditions between loader and app.
 */
(function() {
    const MONACO_VERSION = '0.44.0';
    const MONACO_CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

    // Flag to indicate Monaco loader is ready (prevents race condition)
    window.monacoLoaderReady = false;

    window.MonacoEnvironment = {
        getWorkerUrl: function(workerId, label) {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                self.MonacoEnvironment = {
                    baseUrl: '${MONACO_CDN_BASE}/'
                };
                importScripts('${MONACO_CDN_BASE}/vs/base/worker/workerMain.js');
            `)}`;
        }
    };

    const script = document.createElement('script');
    script.src = `${MONACO_CDN_BASE}/vs/loader.js`;
    script.async = true;

    script.onload = function() {
        console.log('Monaco loader script loaded successfully');
        try {
            require.config({
                paths: { 'vs': `${MONACO_CDN_BASE}/vs` }
            });
            window.monacoLoaderReady = true;
            console.log('Monaco loader ready, dispatching event');
            window.dispatchEvent(new Event('monaco-ready'));
        } catch (e) {
            console.error('Error configuring Monaco:', e);
        }
    };

    script.onerror = function(e) {
        console.error('Failed to load Monaco Editor loader script:', e);
        alert('Failed to load the code editor. Please check your internet connection and refresh the page.');
    };

    document.head.appendChild(script);
})();
