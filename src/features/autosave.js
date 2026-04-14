'use strict';

import { state } from '../core/state.js';
import { AUTOSAVE_INTERVAL_MS } from '../core/constants.js';
import { showToast } from '../ui/toast.js';
import { updateAutoSaveStatus } from '../ui/statusBar.js';
import { saveFile } from './files.js';

/**
 * Sets up the autosave timer to periodically save modified content.
 */
export function setupAutoSave() {
    if (state.autoSaveTimer) {
        clearInterval(state.autoSaveTimer);
    }

    if (!state.autoSaveEnabled) return;

    state.autoSaveTimer = setInterval(() => {
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (tab?.isModified && state.autoSaveEnabled) {
            saveFile(true).catch(err => {
                console.error('Autosave error:', err);
                updateAutoSaveStatus('modified');
            });
        }
    }, AUTOSAVE_INTERVAL_MS);
}

/**
 * Toggles the autosave feature on or off.
 */
export function toggleAutoSave() {
    state.autoSaveEnabled = !state.autoSaveEnabled;

    const toggleBtn = document.getElementById('autosave-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', state.autoSaveEnabled.toString());
    }

    try {
        localStorage.setItem('mdreader-autosave', state.autoSaveEnabled ? 'enabled' : 'disabled');
    } catch (e) {
        console.error('Error saving autosave preference:', e);
    }

    if (state.autoSaveEnabled) {
        setupAutoSave();
        showToast('Autosave enabled');
    } else {
        if (state.autoSaveTimer) {
            clearInterval(state.autoSaveTimer);
            state.autoSaveTimer = null;
        }
        showToast('Autosave disabled');
    }
}

/**
 * Loads the autosave preference from localStorage.
 */
export function loadAutoSavePreference() {
    try {
        const savedAutosave = localStorage.getItem('mdreader-autosave');
        state.autoSaveEnabled = savedAutosave !== 'disabled';

        const toggleBtn = document.getElementById('autosave-toggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', state.autoSaveEnabled.toString());
        }
    } catch (e) {
        console.error('Error loading autosave preference:', e);
    }
}
