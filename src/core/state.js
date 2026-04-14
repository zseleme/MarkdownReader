'use strict';

/**
 * Global application state
 * Centralized state management for the MDReader application
 */
export const state = {
    /** @type {Array<{id: number, fileName: string, content: string, fileHandle: FileSystemFileHandle|null, isModified: boolean, sharedId?: string, sharedUrl?: string}>} */
    tabs: [],

    /** @type {number|null} */
    activeTabId: null,

    /** @type {number} */
    tabCounter: 0,

    /** @type {monaco.editor.IStandaloneCodeEditor|null} */
    editor: null,

    /** @type {string|null} */
    currentFilePath: null,

    /** @type {boolean} */
    isDarkTheme: false,

    /** @type {boolean} */
    isModified: false,

    /** @type {string} */
    currentFileName: 'Untitled',

    /** @type {boolean} */
    isResizing: false,

    /** @type {'split'|'editor'|'preview'} */
    viewMode: 'split',

    /** @type {boolean} - Flag to prevent loops during programmatic editor updates */
    isApplyingEditorContent: false,

    /** @type {boolean} */
    isSyncScrollEnabled: false,

    /** @type {boolean} */
    isScrollingEditor: false,

    /** @type {boolean} */
    isScrollingPreview: false,

    /** @type {number|null} */
    syncScrollDebounceTimer: null,

    /** @type {number|null} */
    previewDebounceTimer: null,

    /** @type {number|null} */
    contentChangeDebounceTimer: null,

    /** @type {boolean} */
    autoSaveEnabled: true,

    /** @type {number|null} */
    autoSaveTimer: null,

    /** @type {number|null} */
    autoSaveStatusTimeout: null,

    /** @type {number} - Track current line number during markdown parsing */
    currentSourceLine: 1
};
