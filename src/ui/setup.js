'use strict';

import { state } from '../core/state.js';
import { MIN_PANEL_WIDTH_PERCENT, MAX_PANEL_WIDTH_PERCENT, hasFileSystemAccess } from '../core/constants.js';
import { showToast } from './toast.js';
import { createNewTab, switchToTab, closeTab } from '../features/tabs.js';
import { openFile, saveFile, saveFileAs, exportToHTML } from '../features/files.js';
import { toggleTheme, toggleViewMode } from '../features/theme.js';
import { toggleSyncScroll, syncPreviewScroll, syncEditorScroll } from '../features/preview.js';
import { toggleAutoSave } from '../features/autosave.js';
import { shareDocument } from '../features/sharing.js';

/**
 * Sets up all UI event listeners for toolbar buttons and panels.
 */
export function setupEventListeners() {
    document.getElementById('new-tab-btn').addEventListener('click', () => createNewTab());
    document.getElementById('new-tab-btn-small').addEventListener('click', () => createNewTab());
    document.getElementById('open-btn').addEventListener('click', openFile);
    document.getElementById('save-btn').addEventListener('click', () => saveFile());
    document.getElementById('save-as-btn').addEventListener('click', saveFileAs);
    document.getElementById('export-html-btn').addEventListener('click', exportToHTML);
    document.getElementById('share-btn').addEventListener('click', shareDocument);
    document.getElementById('view-mode-toggle').addEventListener('click', toggleViewMode);
    document.getElementById('sync-scroll-toggle').addEventListener('click', toggleSyncScroll);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('autosave-toggle').addEventListener('click', toggleAutoSave);

    const previewPanel = document.getElementById('preview-panel');
    previewPanel.addEventListener('scroll', () => {
        if (state.isSyncScrollEnabled && !state.isScrollingEditor) {
            state.isScrollingPreview = true;
            syncEditorScroll();
            setTimeout(() => { state.isScrollingPreview = false; }, 100);
        }
    });
}

/**
 * Sets up the panel resizer for adjusting editor/preview split.
 */
export function setupResizer() {
    const resizer = document.getElementById('resizer');
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const container = document.getElementById('main-container');

    resizer.addEventListener('mousedown', () => {
        state.isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!state.isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        if (newWidth > MIN_PANEL_WIDTH_PERCENT && newWidth < MAX_PANEL_WIDTH_PERCENT) {
            editorPanel.style.width = newWidth + '%';
            previewPanel.style.width = (100 - newWidth) + '%';
        }
    });

    document.addEventListener('mouseup', () => {
        if (state.isResizing) {
            state.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

/**
 * Sets up drag and drop functionality for opening markdown files.
 */
export function setupDragDrop() {
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.body.classList.add('drag-over');
    });

    document.body.addEventListener('dragleave', (e) => {
        if (e.target === document.body) {
            document.body.classList.remove('drag-over');
        }
    });

    document.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        document.body.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);

        for (const file of files) {
            if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
                const content = await file.text();
                createNewTab(file.name, content, null);
            }
        }
    });
}

/**
 * Sets up global keyboard shortcuts for the application.
 */
export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;

        if (isCmdOrCtrl && e.key === 's' && !e.shiftKey) {
            e.preventDefault();
            await saveFile();
        }

        if (isCmdOrCtrl && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            await saveFileAs();
        }

        if (isCmdOrCtrl && e.key === 'o') {
            e.preventDefault();
            await openFile();
        }

        if (isCmdOrCtrl && e.key === 't') {
            e.preventDefault();
            createNewTab();
        }

        if (isCmdOrCtrl && e.key === 'w') {
            e.preventDefault();
            if (state.activeTabId !== null) {
                closeTab(state.activeTabId);
            }
        }

        if (isCmdOrCtrl && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
            const nextIndex = (currentIndex + 1) % state.tabs.length;
            switchToTab(state.tabs[nextIndex].id);
        }

        if (isCmdOrCtrl && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
            const prevIndex = (currentIndex - 1 + state.tabs.length) % state.tabs.length;
            switchToTab(state.tabs[prevIndex].id);
        }
    });
}

/**
 * Shows a warning if File System Access API is not available.
 */
export function checkFileSystemAccess() {
    if (!hasFileSystemAccess) {
        console.warn('File System Access API not supported. Using fallback methods.');
        showToast('Using fallback file operations (download instead of save)', 5000);
    }
}
