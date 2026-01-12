// Monaco Editor Loader for Web
// Loads Monaco Editor from CDN and initializes it

(function() {
    'use strict';

    // Configure Monaco Environment
    window.MonacoEnvironment = {
        getWorkerUrl: function(workerId, label) {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                self.MonacoEnvironment = {
                    baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/'
                };
                importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/base/worker/workerMain.js');
            `)}`;
        }
    };

    // Load Monaco Editor via AMD loader
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js';
    script.async = true;

    script.onload = function() {
        require.config({
            paths: {
                'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs'
            }
        });

        // Trigger Monaco ready event
        window.dispatchEvent(new Event('monaco-ready'));
    };

    script.onerror = function() {
        console.error('Failed to load Monaco Editor');
        alert('Failed to load the code editor. Please check your internet connection and refresh the page.');
    };

    document.head.appendChild(script);
})();
