'use strict';

import { state } from '../core/state.js';
import { DOMPURIFY_CONFIG, hasFileSystemAccess } from '../core/constants.js';
import { showToast } from '../ui/toast.js';
import { updateStatusBar, updateAutoSaveStatus } from '../ui/statusBar.js';
import { createNewTab, updateTabUI, saveTabsToLocalStorage } from './tabs.js';

/**
 * Marks the current tab as saved and updates UI state.
 * @param {Object} tab - The tab object to update
 * @param {string} content - The saved content
 */
export function markTabAsSaved(tab, content) {
    tab.isModified = false;
    tab.content = content;
    state.isModified = false;
    updateTabUI(tab);
    updateStatusBar();
    updateAutoSaveStatus('saved');
    saveTabsToLocalStorage();
}

/**
 * Downloads content as a file to the user's device.
 * @param {string} filename - The name for the downloaded file
 * @param {string} content - The file content
 */
export function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Opens a file using the File System Access API or fallback input element.
 */
export async function openFile() {
    try {
        if (hasFileSystemAccess) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Markdown Files',
                    accept: {
                        'text/markdown': ['.md', '.markdown'],
                        'text/plain': ['.txt']
                    }
                }],
                multiple: false
            });

            const file = await fileHandle.getFile();
            const content = await file.text();

            createNewTab(file.name, content, fileHandle);
            showToast('File opened successfully!');

        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.md,.markdown,.txt';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const content = await file.text();
                createNewTab(file.name, content, null);
                showToast('File opened successfully!');
            };

            input.click();
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error opening file:', err);
            showToast('Error opening file: ' + err.message);
        }
    }
}

/**
 * Saves the current file to disk or localStorage.
 * @param {boolean} isAutoSave - Whether this is an automatic save operation
 */
export async function saveFile(isAutoSave = false) {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const content = state.editor.getValue();

    if (isAutoSave) {
        updateAutoSaveStatus('saving');
    }

    try {
        if (tab.fileHandle && hasFileSystemAccess) {
            const writable = await tab.fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            markTabAsSaved(tab, content);

            if (!isAutoSave) {
                showToast('File saved!');
            }

        } else if (hasFileSystemAccess && !isAutoSave) {
            await saveFileAs();

        } else {
            markTabAsSaved(tab, content);

            if (!isAutoSave && !hasFileSystemAccess) {
                downloadFile(tab.fileName || 'untitled.md', content);
                showToast('File downloaded!');
            }
        }

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error saving file:', err);
            updateAutoSaveStatus('modified');
            showToast('Error saving file: ' + err.message);
        }
    }
}

/**
 * Saves the current file with a new name/location.
 */
export async function saveFileAs() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const content = state.editor.getValue();

    try {
        if (hasFileSystemAccess) {
            const handle = await window.showSaveFilePicker({
                suggestedName: tab.fileName || 'untitled.md',
                types: [{
                    description: 'Markdown Files',
                    accept: { 'text/markdown': ['.md', '.markdown'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            tab.fileHandle = handle;
            tab.fileName = handle.name;
            state.currentFileName = handle.name;
            markTabAsSaved(tab, content);
            showToast('File saved!');

        } else {
            const filename = prompt('Enter filename:', tab.fileName || 'untitled.md');
            if (filename) {
                downloadFile(filename, content);
                tab.fileName = filename;
                state.currentFileName = filename;
                markTabAsSaved(tab, content);
                showToast('File downloaded!');
            }
        }

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error saving file:', err);
            showToast('Error saving file: ' + err.message);
        }
    }
}

/**
 * Exports the current document as a standalone HTML file with embedded styles.
 */
export async function exportToHTML() {
    try {
        if (!state.editor) {
            showToast('Editor not initialized');
            return;
        }

        const content = state.editor.getValue();
        const html = marked.parse(content);

        let cleanHTML, safeFileName;
        if (typeof DOMPurify !== 'undefined') {
            cleanHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
            safeFileName = DOMPurify.sanitize(state.currentFileName, { ALLOWED_TAGS: [] });
        } else {
            console.warn('DOMPurify not loaded, exported file may be vulnerable to XSS');
            cleanHTML = html;
            safeFileName = state.currentFileName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeFileName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Courier New', monospace;
        }
        pre {
            background-color: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }
        pre code {
            background: none;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #007acc;
            padding-left: 16px;
            color: #666;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f4f4f4;
        }
        img {
            max-width: 100%;
            height: auto;
        }
    </style>
</head>
<body>
${cleanHTML}
</body>
</html>`;

        const filename = state.currentFileName.replace(/\.md$/, '') + '.html';
        downloadFile(filename, fullHTML);
        showToast('HTML exported successfully!');

    } catch (error) {
        console.error('Error exporting to HTML:', error);
        showToast('Failed to export HTML: ' + error.message);
    }
}
