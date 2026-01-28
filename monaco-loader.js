'use strict';

/**
 * Monaco Editor Loader
 * Loads Monaco Editor from CDN and dispatches 'monaco-ready' event when complete.
 */
(function() {
    const MONACO_VERSION = '0.44.0';
    const MONACO_CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

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
        require.config({
            paths: { 'vs': `${MONACO_CDN_BASE}/vs` }
        });
        window.dispatchEvent(new Event('monaco-ready'));
    };

    script.onerror = function() {
        console.error('Failed to load Monaco Editor');
        alert('Failed to load the code editor. Please check your internet connection and refresh the page.');
    };

    document.head.appendChild(script);
})();
