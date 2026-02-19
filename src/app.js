'use strict';

/**
 * MDReader - Modern Markdown Editor
 * Main application entry point
 */

import { state } from './core/state.js';
import { initializeEditor, setupEditorTimeoutCheck } from './core/editor.js';
import { loadThemePreference } from './features/theme.js';
import { loadAutoSavePreference } from './features/autosave.js';
import { checkForSharedDocument } from './features/sharing.js';
import { loadVersion } from './ui/statusBar.js';
import {
    setupEventListeners,
    setupResizer,
    setupDragDrop,
    setupKeyboardShortcuts,
    checkFileSystemAccess
} from './ui/setup.js';

/**
 * Initializes the application: loads preferences, sets up UI, and prepares editor.
 */
function init() {
    loadThemePreference();
    loadAutoSavePreference();
    setupEventListeners();
    setupResizer();
    setupDragDrop();
    setupKeyboardShortcuts();
    checkForSharedDocument(true);
    loadVersion();
    checkFileSystemAccess();
}

/**
 * Starts the application when Monaco is ready.
 */
function startApp() {
    init();
    initializeEditor();
    setupEditorTimeoutCheck();
}

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('Service Worker registered:', registration.scope))
            .catch(error => console.error('Service Worker registration failed:', error));
    });
}

// Check if Monaco is already ready (race condition prevention)
if (window.monacoLoaderReady) {
    startApp();
} else {
    window.addEventListener('monaco-ready', startApp);
}

// Warn user about unsaved changes before leaving
window.addEventListener('beforeunload', (e) => {
    const hasUnsaved = state.tabs.some(tab => tab.isModified);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});
