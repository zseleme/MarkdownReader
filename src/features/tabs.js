'use strict';

import { state } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { updateStatusBar, updateAutoSaveStatus } from '../ui/statusBar.js';

// Forward declarations for circular dependency resolution
let updatePreviewFn = null;

/**
 * Sets the updatePreview function reference (called from preview.js to break circular dependency)
 * @param {Function} fn - The updatePreview function
 */
export function setUpdatePreview(fn) {
    updatePreviewFn = fn;
}

/**
 * Updates the visual representation of a tab in the UI.
 * @param {Object} tab - The tab object to update
 */
export function updateTabUI(tab) {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tab.id}"]`);
    if (!tabElement) return;

    const titleSpan = tabElement.querySelector('.tab-title');
    titleSpan.textContent = tab.fileName + (tab.isModified ? ' *' : '');
    titleSpan.title = 'Double-click to rename';

    if (tab.fileName === 'Untitled') {
        titleSpan.classList.add('untitled');
    } else {
        titleSpan.classList.remove('untitled');
    }
}

/**
 * Enables inline editing mode for a tab's title.
 * @param {number} tabId - The ID of the tab to rename
 * @param {HTMLElement} titleSpan - The span element containing the title
 */
export function enableInlineRename(tabId, titleSpan) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const currentName = tab.fileName.replace(/\.md$/, '');
    const originalName = currentName;

    titleSpan.contentEditable = true;
    titleSpan.textContent = currentName;
    titleSpan.classList.add('editing');

    titleSpan.focus();
    const range = document.createRange();
    range.selectNodeContents(titleSpan);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const saveRename = () => {
        let newName = titleSpan.textContent.trim();

        if (!newName || newName === originalName) {
            titleSpan.contentEditable = false;
            titleSpan.classList.remove('editing');
            updateTabUI(tab);
            return;
        }

        if (!newName.endsWith('.md')) {
            newName += '.md';
        }

        tab.fileName = newName;
        tab.isModified = true;

        titleSpan.contentEditable = false;
        titleSpan.classList.remove('editing');
        updateTabUI(tab);

        if (state.activeTabId === tabId) {
            state.currentFileName = newName;
            updateStatusBar();
        }

        saveTabsToLocalStorage();
        showToast('File renamed to: ' + newName);
    };

    const cancelRename = () => {
        titleSpan.contentEditable = false;
        titleSpan.classList.remove('editing');
        updateTabUI(tab);
    };

    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveRename();
            cleanup();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRename();
            cleanup();
        }
    };

    const handleBlur = () => {
        saveRename();
        cleanup();
    };

    const cleanup = () => {
        titleSpan.removeEventListener('keydown', handleKeydown);
        titleSpan.removeEventListener('blur', handleBlur);
    };

    titleSpan.addEventListener('keydown', handleKeydown);
    titleSpan.addEventListener('blur', handleBlur);
}

/**
 * Creates a new editor tab with optional content and file handle.
 * @param {string} fileName - The name for the new tab
 * @param {string} content - Initial content for the tab
 * @param {FileSystemFileHandle|null} fileHandle - File handle for File System Access API
 * @param {boolean} skipSave - Whether to skip saving to localStorage
 */
export function createNewTab(fileName = 'Untitled', content = '', fileHandle = null, skipSave = false) {
    const tabId = ++state.tabCounter;

    const tab = {
        id: tabId,
        fileName,
        content,
        fileHandle,
        isModified: false
    };

    state.tabs.push(tab);

    const tabElement = document.createElement('button');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tabId;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tab-title';
    titleSpan.textContent = fileName;
    titleSpan.title = 'Double-click to rename';

    titleSpan.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        enableInlineRename(tabId, titleSpan);
    };

    if (fileName === 'Untitled') {
        titleSpan.classList.add('untitled');
    }

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tabId);
    };

    tabElement.appendChild(titleSpan);
    tabElement.appendChild(closeBtn);
    tabElement.onclick = () => switchToTab(tabId);

    document.getElementById('tabs-list').appendChild(tabElement);

    if (!skipSave) {
        switchToTab(tabId);
        saveTabsToLocalStorage();
    }
}

/**
 * Switches the editor to display a different tab.
 * @param {number} tabId - The ID of the tab to switch to
 */
export function switchToTab(tabId) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) {
        console.warn('switchToTab: tab not found for id:', tabId);
        return;
    }
    if (!state.editor) {
        console.warn('switchToTab: editor not initialized yet');
        return;
    }

    if (state.activeTabId !== null) {
        const currentTab = state.tabs.find(t => t.id === state.activeTabId);
        if (currentTab) {
            currentTab.content = state.editor.getValue();
        }
    }

    state.activeTabId = tabId;
    state.currentFileName = tab.fileName;
    state.currentFilePath = tab.fileHandle ? tab.fileHandle.name : null;
    state.isModified = tab.isModified;

    state.isApplyingEditorContent = true;
    state.editor.setValue(tab.content);
    state.isApplyingEditorContent = false;

    if (updatePreviewFn) {
        updatePreviewFn();
    }

    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    updateStatusBar();
    updateAutoSaveStatus(tab.isModified ? 'modified' : 'ready');
    saveTabsToLocalStorage();
}

/**
 * Closes a tab, prompting for save if there are unsaved changes.
 * @param {number} tabId - The ID of the tab to close
 */
export function closeTab(tabId) {
    const tabIndex = state.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = state.tabs[tabIndex];

    if (tab.isModified && !confirm(`"${tab.fileName}" has unsaved changes. Close anyway?`)) {
        return;
    }

    state.tabs.splice(tabIndex, 1);

    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }

    if (state.tabs.length === 0) {
        state.activeTabId = null;
        state.currentFileName = 'Untitled';
        state.isModified = false;
        if (state.editor) {
            state.isApplyingEditorContent = true;
            state.editor.setValue('');
            state.isApplyingEditorContent = false;
        }
        updateStatusBar();
        updateAutoSaveStatus('ready');
    } else if (state.activeTabId === tabId) {
        const newActiveTab = state.tabs[Math.max(0, tabIndex - 1)];
        switchToTab(newActiveTab.id);
    }

    saveTabsToLocalStorage();
}

/**
 * Updates the active tab's content and modified state based on editor content.
 * Optimized to avoid expensive operations on every keystroke.
 */
export function updateActiveTabContent() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || !state.editor) return;

    if (!tab.isModified) {
        tab.isModified = true;
        state.isModified = true;
        updateAutoSaveStatus('modified');
        updateTabUI(tab);
    }
    updateStatusBar();
}

/**
 * Persists all tab data to localStorage.
 */
export function saveTabsToLocalStorage() {
    try {
        const tabsData = state.tabs.map(tab => ({
            id: tab.id,
            fileName: tab.fileName,
            content: tab.content,
            isModified: tab.isModified
        }));

        localStorage.setItem('mdreader-tabs', JSON.stringify(tabsData));
        localStorage.setItem('mdreader-activeTab', state.activeTabId);
        localStorage.setItem('mdreader-tabCounter', state.tabCounter);
    } catch (e) {
        console.error('Error saving tabs to localStorage:', e);
    }
}

/**
 * Restores tab data from localStorage.
 * @returns {boolean} Whether tabs were successfully loaded
 */
export function loadTabsFromLocalStorage() {
    try {
        const savedTabs = localStorage.getItem('mdreader-tabs');
        const savedActiveTab = localStorage.getItem('mdreader-activeTab');
        const savedCounter = localStorage.getItem('mdreader-tabCounter');

        if (savedCounter) {
            state.tabCounter = parseInt(savedCounter, 10);
        }

        if (savedTabs) {
            const tabsData = JSON.parse(savedTabs);

            if (Array.isArray(tabsData) && tabsData.length > 0) {
                tabsData.forEach(tabData => {
                    createNewTab(tabData.fileName, tabData.content, null, true);
                    const tab = state.tabs[state.tabs.length - 1];
                    if (tab) {
                        tab.isModified = tabData.isModified;
                        updateTabUI(tab);
                    }
                });

                if (state.tabs.length > 0) {
                    let tabToActivate = state.tabs[0];

                    if (savedActiveTab) {
                        const activeId = parseInt(savedActiveTab, 10);
                        const tabIndex = tabsData.findIndex(t => t.id === activeId);
                        if (tabIndex !== -1 && state.tabs[tabIndex]) {
                            tabToActivate = state.tabs[tabIndex];
                        }
                    }

                    switchToTab(tabToActivate.id);
                    return true;
                }
            }
        }
    } catch (e) {
        console.error('Error loading tabs from localStorage:', e);
    }

    return false;
}
