'use strict';

import { state } from './state.js';
import { showToast } from '../ui/toast.js';
import { updateStatusBar, updateAutoSaveStatus } from '../ui/statusBar.js';
import { createNewTab, switchToTab, loadTabsFromLocalStorage, updateActiveTabContent } from '../features/tabs.js';
import { updatePreview, syncPreviewScroll } from '../features/preview.js';
import { setupAutoSave } from '../features/autosave.js';

/**
 * Initializes the Monaco editor with configuration and event handlers.
 */
export function initializeEditor() {
    if (typeof require === 'undefined') {
        console.error('AMD require is not defined');
        showToast('Failed to load editor: AMD loader not available', 0);
        return;
    }

    require(['vs/editor/editor.main'], function() {
        const container = document.getElementById('editor');

        state.editor = monaco.editor.create(container, {
            value: '',
            language: 'markdown',
            theme: state.isDarkTheme ? 'vs-dark' : 'vs',
            automaticLayout: true,
            wordWrap: 'on',
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            folding: true,
            links: true,
            matchBrackets: 'always',
            stickyScroll: { enabled: true }
        });

        state.editor.onDidChangeModelContent(() => {
            if (!state.isApplyingEditorContent) {
                if (state.contentChangeDebounceTimer) {
                    clearTimeout(state.contentChangeDebounceTimer);
                }
                state.contentChangeDebounceTimer = setTimeout(() => {
                    updateActiveTabContent();
                }, 100);
                updatePreview();
            }
        });

        state.editor.onDidChangeCursorPosition(() => updateStatusBar());

        state.editor.onDidScrollChange(() => {
            if (state.isSyncScrollEnabled && !state.isScrollingPreview) {
                state.isScrollingEditor = true;
                syncPreviewScroll();
                setTimeout(() => { state.isScrollingEditor = false; }, 100);
            }
        });

        state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
            const selection = state.editor.getSelection();
            const text = state.editor.getModel().getValueInRange(selection);
            navigator.clipboard.writeText(text);
        });

        state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, async () => {
            const text = await navigator.clipboard.readText();
            const selection = state.editor.getSelection();
            state.editor.executeEdits('paste', [{
                range: selection,
                text: text,
                forceMoveMarkers: true
            }]);
        });

        state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, async () => {
            const selection = state.editor.getSelection();
            const text = state.editor.getModel().getValueInRange(selection);
            await navigator.clipboard.writeText(text);
            state.editor.executeEdits('', [{ range: selection, text: '' }]);
        });

        const loaded = loadTabsFromLocalStorage();
        if (!loaded) {
            createNewTab();
        }

        if (state.tabs.length === 0) {
            console.warn('No tabs after initialization, creating default tab');
            createNewTab();
        } else if (state.activeTabId === null) {
            console.warn('No active tab after initialization, activating first tab');
            switchToTab(state.tabs[0].id);
        }

        updatePreview();
        updateStatusBar();
        updateAutoSaveStatus('ready');
        setupAutoSave();
        showToast('MDReader loaded successfully!');
    }, function(err) {
        console.error('Failed to load Monaco editor modules:', err);
        showToast('Failed to load editor modules. Please refresh the page.', 0);
    });
}

/**
 * Sets up the editor initialization timeout check.
 */
export function setupEditorTimeoutCheck() {
    setTimeout(() => {
        if (!state.editor) {
            console.error('Monaco failed to initialize');
            showToast('Failed to load editor. Please refresh the page.', 0);
        }
    }, 10000);
}
