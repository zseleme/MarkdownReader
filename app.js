'use strict';

// DOMPurify configuration for sanitizing user content
const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
                  'blockquote', 'code', 'pre', 'strong', 'em', 'img', 'table', 'thead',
                  'tbody', 'tr', 'th', 'td', 'br', 'hr', 'del', 'ins', 'sup', 'sub',
                  'div', 'span', 'input'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'type', 'checked', 'disabled'],
    ALLOW_DATA_ATTR: false
};

// Autosave interval in milliseconds
const AUTOSAVE_INTERVAL_MS = 30000;

// Editor initialization timeout in milliseconds
const EDITOR_INIT_TIMEOUT_MS = 100;
const EDITOR_MAX_INIT_ATTEMPTS = 50;

// Fetch timeout in milliseconds
const FETCH_TIMEOUT_MS = 30000;

// Panel resize constraints (percentage)
const MIN_PANEL_WIDTH_PERCENT = 20;
const MAX_PANEL_WIDTH_PERCENT = 80;

// Track current line number during markdown parsing
let currentSourceLine = 1;

const renderer = new marked.Renderer();

renderer.heading = function({ tokens, depth, raw }) {
    const text = this.parser.parseInline(tokens);
    const rawText = tokens.map(t => t.raw || t.text || '').join('');
    const slug = rawText.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
    return `<h${depth} id="${slug}" data-line="${currentSourceLine}">${text}</h${depth}>`;
};

renderer.paragraph = function({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<p data-line="${currentSourceLine}">${text}</p>\n`;
};

renderer.code = function({ text, lang }) {
    const language = lang || '';
    const highlighted = Prism.languages[language]
        ? Prism.highlight(text, Prism.languages[language], language)
        : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre data-line="${currentSourceLine}"><code class="language-${language}">${highlighted}</code></pre>\n`;
};

renderer.blockquote = function({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote data-line="${currentSourceLine}">${body}</blockquote>\n`;
};

renderer.list = function({ items, ordered, start }) {
    const tag = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
    let body = '';
    for (const item of items) {
        body += this.listitem(item);
    }
    return `<${tag}${startAttr} data-line="${currentSourceLine}">${body}</${tag}>\n`;
};

renderer.listitem = function({ tokens, task, checked }) {
    let text = this.parser.parse(tokens);
    if (task) {
        const checkbox = `<input type="checkbox" ${checked ? 'checked' : ''} disabled>`;
        text = checkbox + text;
    }
    return `<li>${text}</li>\n`;
};

renderer.table = function({ header, rows }) {
    let output = `<table data-line="${currentSourceLine}"><thead><tr>`;
    for (const cell of header) {
        const align = cell.align ? ` style="text-align:${cell.align}"` : '';
        output += `<th${align}>${this.parser.parseInline(cell.tokens)}</th>`;
    }
    output += '</tr></thead><tbody>';
    for (const row of rows) {
        output += '<tr>';
        for (const cell of row) {
            const align = cell.align ? ` style="text-align:${cell.align}"` : '';
            output += `<td${align}>${this.parser.parseInline(cell.tokens)}</td>`;
        }
        output += '</tr>';
    }
    output += '</tbody></table>\n';
    return output;
};

renderer.hr = function() {
    return `<hr data-line="${currentSourceLine}" />\n`;
};

marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: true,
    renderer: renderer
});

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let editor = null;
let currentFilePath = null;
let isDarkTheme = false;
let isModified = false;
let currentFileName = 'Untitled';
let isResizing = false;
let viewMode = 'split';
let isApplyingEditorContent = false;
let isSyncScrollEnabled = false;
let isScrollingEditor = false;
let isScrollingPreview = false;
let syncScrollDebounceTimer = null;
let autoSaveEnabled = true;
let autoSaveTimer = null;
let autoSaveStatusTimeout = null;

const hasFileSystemAccess = 'showOpenFilePicker' in window;

/**
 * Sanitizes a string for safe HTML display by escaping special characters.
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string with HTML entities escaped
 */
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Displays a toast notification to the user.
 * @param {string} message - The message to display
 * @param {number} duration - Duration in milliseconds before auto-hide (0 for permanent)
 */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    if (duration > 0) {
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}

/**
 * Updates the autosave status indicator in the UI.
 * @param {'saving' | 'saved' | 'modified' | 'ready'} status - The current save status
 */
function updateAutoSaveStatus(status) {
    const indicator = document.getElementById('autosave-indicator');
    const icon = document.getElementById('autosave-icon');
    const statusText = document.getElementById('autosave-status');

    if (!indicator || !icon || !statusText) return;

    if (autoSaveStatusTimeout) {
        clearTimeout(autoSaveStatusTimeout);
        autoSaveStatusTimeout = null;
    }

    indicator.classList.remove('status-saved', 'status-saving', 'status-modified', 'status-ready');

    const statusConfig = {
        saving: {
            className: 'status-saving',
            iconClass: 'fas fa-spinner fa-spin',
            text: 'Salvando...'
        },
        saved: {
            className: 'status-saved',
            iconClass: 'fas fa-check-circle',
            text: 'Todas as alteracoes salvas'
        },
        modified: {
            className: 'status-modified',
            iconClass: 'fas fa-exclamation-circle',
            text: 'Alteracoes nao salvas'
        },
        ready: {
            className: 'status-ready',
            iconClass: 'fas fa-check-circle',
            text: 'Pronto'
        }
    };

    const config = statusConfig[status] || statusConfig.ready;
    indicator.classList.add(config.className);
    icon.className = config.iconClass;
    statusText.textContent = config.text;

    if (status === 'saved') {
        autoSaveStatusTimeout = setTimeout(() => {
            if (!isModified) {
                updateAutoSaveStatus('ready');
            }
        }, 3000);
    }
}

/**
 * Updates the status bar with current editor state information.
 */
function updateStatusBar() {
    const statusBar = document.getElementById('status-bar');
    if (!editor) {
        statusBar.textContent = 'Loading...';
        return;
    }

    const position = editor.getPosition();
    const content = editor.getValue();
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = content.trim() === '' ? 0 : words.length;
    const charCount = content.length;
    const theme = isDarkTheme ? 'Dark' : 'Light';
    const status = isModified ? 'Modified' : 'Saved';

    statusBar.textContent = `${currentFileName} - Line ${position.lineNumber}, Column ${position.column} - ${wordCount} words, ${charCount} chars - ${theme} - ${status}`;
}

/**
 * Opens a file using the File System Access API or fallback input element.
 */
async function openFile() {
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
 * Marks the current tab as saved and updates UI state.
 * @param {Object} tab - The tab object to update
 * @param {string} content - The saved content
 */
function markTabAsSaved(tab, content) {
    tab.isModified = false;
    tab.content = content;
    isModified = false;
    updateTabUI(tab);
    updateStatusBar();
    updateAutoSaveStatus('saved');
    saveTabsToLocalStorage();
}

/**
 * Saves the current file to disk or localStorage.
 * @param {boolean} isAutoSave - Whether this is an automatic save operation
 */
async function saveFile(isAutoSave = false) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const content = editor.getValue();

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
async function saveFileAs() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const content = editor.getValue();

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
            currentFileName = handle.name;
            markTabAsSaved(tab, content);
            showToast('File saved!');

        } else {
            const filename = prompt('Enter filename:', tab.fileName || 'untitled.md');
            if (filename) {
                downloadFile(filename, content);
                tab.fileName = filename;
                currentFileName = filename;
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
 * Downloads content as a file to the user's device.
 * @param {string} filename - The name for the downloaded file
 * @param {string} content - The file content
 */
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Exports the current document as a standalone HTML file with embedded styles.
 */
async function exportToHTML() {
    try {
        if (!editor) {
            showToast('Editor not initialized');
            return;
        }

        const content = editor.getValue();
        const html = marked.parse(content);

        let cleanHTML, safeFileName;
        if (typeof DOMPurify !== 'undefined') {
            cleanHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
            safeFileName = DOMPurify.sanitize(currentFileName, { ALLOWED_TAGS: [] });
        } else {
            console.warn('DOMPurify not loaded, exported file may be vulnerable to XSS');
            cleanHTML = html;
            safeFileName = currentFileName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

        const filename = currentFileName.replace(/\.md$/, '') + '.html';
        downloadFile(filename, fullHTML);
        showToast('HTML exported successfully!');

    } catch (error) {
        console.error('Error exporting to HTML:', error);
        showToast('Failed to export HTML: ' + error.message);
    }
}

/**
 * Enables inline editing mode for a tab's title.
 * @param {number} tabId - The ID of the tab to rename
 * @param {HTMLElement} titleSpan - The span element containing the title
 */
function enableInlineRename(tabId, titleSpan) {
    const tab = tabs.find(t => t.id === tabId);
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

        if (activeTabId === tabId) {
            currentFileName = newName;
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
function createNewTab(fileName = 'Untitled', content = '', fileHandle = null, skipSave = false) {
    const tabId = ++tabCounter;

    const tab = {
        id: tabId,
        fileName,
        content,
        fileHandle,
        isModified: false
    };

    tabs.push(tab);

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
function switchToTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) {
        console.warn('switchToTab: tab not found for id:', tabId);
        return;
    }
    if (!editor) {
        console.warn('switchToTab: editor not initialized yet');
        return;
    }

    if (activeTabId !== null) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            currentTab.content = editor.getValue();
        }
    }

    activeTabId = tabId;
    currentFileName = tab.fileName;
    currentFilePath = tab.fileHandle ? tab.fileHandle.name : null;
    isModified = tab.isModified;

    isApplyingEditorContent = true;
    editor.setValue(tab.content);
    isApplyingEditorContent = false;

    updatePreview();

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
function closeTab(tabId) {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    if (tab.isModified && !confirm(`"${tab.fileName}" has unsaved changes. Close anyway?`)) {
        return;
    }

    tabs.splice(tabIndex, 1);

    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }

    if (tabs.length === 0) {
        activeTabId = null;
        currentFileName = 'Untitled';
        isModified = false;
        if (editor) {
            isApplyingEditorContent = true;
            editor.setValue('');
            isApplyingEditorContent = false;
        }
        updateStatusBar();
        updateAutoSaveStatus('ready');
    } else if (activeTabId === tabId) {
        const newActiveTab = tabs[Math.max(0, tabIndex - 1)];
        switchToTab(newActiveTab.id);
    }

    saveTabsToLocalStorage();
}

/**
 * Updates the visual representation of a tab in the UI.
 * @param {Object} tab - The tab object to update
 */
function updateTabUI(tab) {
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
 * Updates the active tab's content and modified state based on editor content.
 */
function updateActiveTabContent() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !editor) return;

    const currentContent = editor.getValue();
    const changed = currentContent !== tab.content;

    tab.isModified = changed;
    isModified = changed;
    updateAutoSaveStatus(changed ? 'modified' : 'ready');
    updateTabUI(tab);
    updateStatusBar();
}

/**
 * Persists all tab data to localStorage.
 */
function saveTabsToLocalStorage() {
    try {
        const tabsData = tabs.map(tab => ({
            id: tab.id,
            fileName: tab.fileName,
            content: tab.content,
            isModified: tab.isModified
        }));

        localStorage.setItem('mdreader-tabs', JSON.stringify(tabsData));
        localStorage.setItem('mdreader-activeTab', activeTabId);
        localStorage.setItem('mdreader-tabCounter', tabCounter);
    } catch (e) {
        console.error('Error saving tabs to localStorage:', e);
    }
}

/**
 * Restores tab data from localStorage.
 * @returns {boolean} Whether tabs were successfully loaded
 */
function loadTabsFromLocalStorage() {
    try {
        const savedTabs = localStorage.getItem('mdreader-tabs');
        const savedActiveTab = localStorage.getItem('mdreader-activeTab');
        const savedCounter = localStorage.getItem('mdreader-tabCounter');

        if (savedCounter) {
            tabCounter = parseInt(savedCounter, 10);
        }

        if (savedTabs) {
            const tabsData = JSON.parse(savedTabs);

            if (Array.isArray(tabsData) && tabsData.length > 0) {
                tabsData.forEach(tabData => {
                    createNewTab(tabData.fileName, tabData.content, null, true);
                    const tab = tabs[tabs.length - 1];
                    if (tab) {
                        tab.isModified = tabData.isModified;
                        updateTabUI(tab);
                    }
                });

                // Ensure we have tabs before trying to switch
                if (tabs.length > 0) {
                    let tabToActivate = tabs[0];

                    if (savedActiveTab) {
                        const activeId = parseInt(savedActiveTab, 10);
                        const tabIndex = tabsData.findIndex(t => t.id === activeId);
                        if (tabIndex !== -1 && tabs[tabIndex]) {
                            tabToActivate = tabs[tabIndex];
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

/**
 * Renders markdown content to the preview pane with syntax mapping for scroll sync.
 */
function updatePreview() {
    if (!editor) return;

    const content = editor.getValue();
    const preview = document.getElementById('preview');

    try {
        // Use lexer to get tokens with line information
        const tokens = marked.lexer(content);

        // Build HTML with line numbers using walkTokens
        let html = '';
        const lines = content.split('\n');
        let currentLine = 1;

        // Process each top-level token
        for (const token of tokens) {
            // Calculate line number from raw content position
            if (token.raw) {
                const beforeToken = content.substring(0, content.indexOf(token.raw));
                currentLine = (beforeToken.match(/\n/g) || []).length + 1;
            }
            currentSourceLine = currentLine;

            // Parse this token to HTML
            html += marked.parser([token]);
        }

        let cleanHTML;
        if (typeof DOMPurify !== 'undefined') {
            // Allow data-line attribute
            const config = {
                ...DOMPURIFY_CONFIG,
                ALLOWED_ATTR: [...DOMPURIFY_CONFIG.ALLOWED_ATTR, 'data-line']
            };
            cleanHTML = DOMPurify.sanitize(html, config);
        } else {
            console.warn('DOMPurify not loaded, preview may be vulnerable to XSS');
            cleanHTML = html;
        }

        preview.innerHTML = cleanHTML;

        preview.querySelectorAll('a').forEach((link) => {
            link.onclick = (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const targetElement = preview.querySelector(`#${CSS.escape(targetId)}`);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        showToast('Section not found');
                    }
                } else if (href && !href.startsWith('http')) {
                    e.preventDefault();
                    showToast('Relative links are not supported in web version');
                }
            };
        });

    } catch (error) {
        console.error('Error rendering markdown:', error);
        const safeMessage = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(error.message)
            : error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        preview.innerHTML = `<p style="color: red;">Error rendering markdown: ${safeMessage}</p>`;
    }
}

/**
 * Initializes the Monaco editor with configuration and event handlers.
 */
function initializeEditor() {
    if (typeof require === 'undefined') {
        console.error('AMD require is not defined');
        showToast('Failed to load editor: AMD loader not available', 0);
        return;
    }

    require(['vs/editor/editor.main'], function() {
        const container = document.getElementById('editor');

        editor = monaco.editor.create(container, {
            value: '',
            language: 'markdown',
            theme: isDarkTheme ? 'vs-dark' : 'vs',
            automaticLayout: true,
            wordWrap: 'on',
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            folding: true,
            links: true,
            matchBrackets: 'always'
        });

        editor.onDidChangeModelContent(() => {
            if (!isApplyingEditorContent) {
                updateActiveTabContent();
                updatePreview();
            }
        });

        editor.onDidChangeCursorPosition(() => updateStatusBar());

        editor.onDidScrollChange(() => {
            if (isSyncScrollEnabled && !isScrollingPreview) {
                isScrollingEditor = true;
                syncPreviewScroll();
                setTimeout(() => { isScrollingEditor = false; }, 100);
            }
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
            const selection = editor.getSelection();
            const text = editor.getModel().getValueInRange(selection);
            navigator.clipboard.writeText(text);
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, async () => {
            const text = await navigator.clipboard.readText();
            editor.trigger('keyboard', 'type', { text });
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, async () => {
            const selection = editor.getSelection();
            const text = editor.getModel().getValueInRange(selection);
            await navigator.clipboard.writeText(text);
            editor.executeEdits('', [{ range: selection, text: '' }]);
        });

        const loaded = loadTabsFromLocalStorage();
        if (!loaded) {
            createNewTab();
        }

        // Safety check: ensure at least one tab exists and is active
        if (tabs.length === 0) {
            console.warn('No tabs after initialization, creating default tab');
            createNewTab();
        } else if (activeTabId === null) {
            console.warn('No active tab after initialization, activating first tab');
            switchToTab(tabs[0].id);
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
 * Sets up the autosave timer to periodically save modified content.
 */
function setupAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }

    if (!autoSaveEnabled) return;

    autoSaveTimer = setInterval(() => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab?.isModified && autoSaveEnabled) {
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
function toggleAutoSave() {
    autoSaveEnabled = !autoSaveEnabled;

    const toggleBtn = document.getElementById('autosave-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', autoSaveEnabled.toString());
    }

    try {
        localStorage.setItem('mdreader-autosave', autoSaveEnabled ? 'enabled' : 'disabled');
    } catch (e) {
        console.error('Error saving autosave preference:', e);
    }

    if (autoSaveEnabled) {
        setupAutoSave();
        showToast('Autosave enabled');
    } else {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
        }
        showToast('Autosave disabled');
    }
}

/**
 * Cycles through view modes: split -> editor -> preview -> split.
 */
function toggleViewMode() {
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const resizer = document.getElementById('resizer');
    const viewModeIcon = document.getElementById('view-mode-icon');
    const viewModeText = document.getElementById('view-mode-text');

    const viewModes = {
        split: {
            next: 'editor',
            editor: { display: 'block', width: '50%' },
            preview: { display: 'block', width: '50%' },
            resizer: 'block',
            icon: 'fas fa-columns',
            text: 'Split'
        },
        editor: {
            next: 'preview',
            editor: { display: 'block', width: '100%' },
            preview: { display: 'none', width: '50%' },
            resizer: 'none',
            icon: 'fas fa-edit',
            text: 'Editor'
        },
        preview: {
            next: 'split',
            editor: { display: 'none', width: '50%' },
            preview: { display: 'block', width: '100%' },
            resizer: 'none',
            icon: 'fas fa-eye',
            text: 'Preview'
        }
    };

    viewMode = viewModes[viewMode].next;
    const config = viewModes[viewMode];

    editorPanel.style.display = config.editor.display;
    editorPanel.style.width = config.editor.width;
    previewPanel.style.display = config.preview.display;
    previewPanel.style.width = config.preview.width;
    resizer.style.display = config.resizer;
    viewModeIcon.className = config.icon;
    viewModeText.textContent = config.text;
}

/**
 * Toggles synchronized scrolling between editor and preview panes.
 */
function toggleSyncScroll() {
    isSyncScrollEnabled = !isSyncScrollEnabled;
    const btn = document.getElementById('sync-scroll-toggle');
    const icon = document.getElementById('sync-scroll-icon');

    if (isSyncScrollEnabled) {
        btn.classList.add('active');
        icon.className = 'fas fa-link';
        showToast('Sync scroll enabled');
    } else {
        btn.classList.remove('active');
        icon.className = 'fas fa-unlink';
        showToast('Sync scroll disabled');
    }
}

/**
 * Synchronizes preview scroll position with editor scroll position.
 * Uses source line mapping for accurate synchronization.
 */
function syncPreviewScroll() {
    if (!editor || !isSyncScrollEnabled) return;

    // Debounce scroll sync for better performance
    if (syncScrollDebounceTimer) {
        clearTimeout(syncScrollDebounceTimer);
    }

    syncScrollDebounceTimer = setTimeout(() => {
        performPreviewSync();
    }, 16); // ~60fps
}

/**
 * Performs the actual preview synchronization using data-line attributes.
 */
function performPreviewSync() {
    if (!editor || !isSyncScrollEnabled) return;

    const previewPanel = document.getElementById('preview-panel');
    const preview = document.getElementById('preview');

    // Get visible line range in editor
    const visibleRanges = editor.getVisibleRanges();
    if (!visibleRanges || visibleRanges.length === 0) return;

    const firstVisibleLine = visibleRanges[0].startLineNumber;

    // Find elements with data-line attributes
    const lineElements = preview.querySelectorAll('[data-line]');
    if (lineElements.length === 0) {
        // Fallback to percentage-based scroll
        const editorScrollTop = editor.getScrollTop();
        const editorScrollHeight = editor.getScrollHeight() - editor.getLayoutInfo().height;
        if (editorScrollHeight > 0) {
            const scrollPercent = editorScrollTop / editorScrollHeight;
            const previewScrollHeight = previewPanel.scrollHeight - previewPanel.clientHeight;
            previewPanel.scrollTop = scrollPercent * previewScrollHeight;
        }
        return;
    }

    // Find the element that corresponds to the visible line
    let targetElement = null;
    let nextElement = null;

    for (let i = 0; i < lineElements.length; i++) {
        const elementLine = parseInt(lineElements[i].getAttribute('data-line'), 10);
        if (elementLine <= firstVisibleLine) {
            targetElement = lineElements[i];
            nextElement = lineElements[i + 1] || null;
        } else {
            if (!targetElement) {
                targetElement = lineElements[i];
            }
            break;
        }
    }

    if (!targetElement) return;

    const previewRect = preview.getBoundingClientRect();
    const elementRect = targetElement.getBoundingClientRect();
    const elementTop = elementRect.top - previewRect.top + previewPanel.scrollTop;

    // Calculate interpolation within the element
    const elementLine = parseInt(targetElement.getAttribute('data-line'), 10);
    let interpolation = 0;

    if (nextElement) {
        const nextLine = parseInt(nextElement.getAttribute('data-line'), 10);
        const nextRect = nextElement.getBoundingClientRect();
        const nextTop = nextRect.top - previewRect.top + previewPanel.scrollTop;

        if (nextLine > elementLine) {
            const lineProgress = (firstVisibleLine - elementLine) / (nextLine - elementLine);
            interpolation = lineProgress * (nextTop - elementTop);
        }
    }

    const targetScroll = Math.max(0, elementTop + interpolation - 20);

    // Apply scroll smoothly
    const scrollDiff = Math.abs(previewPanel.scrollTop - targetScroll);
    if (scrollDiff > 3) {
        previewPanel.scrollTop = targetScroll;
    }
}

/**
 * Synchronizes editor scroll position with preview scroll position.
 * Uses data-line attributes for accurate reverse mapping.
 */
function syncEditorScroll() {
    if (!editor || !isSyncScrollEnabled) return;

    const previewPanel = document.getElementById('preview-panel');
    const preview = document.getElementById('preview');

    const previewScrollTop = previewPanel.scrollTop;

    // Find elements with data-line attributes
    const lineElements = preview.querySelectorAll('[data-line]');
    if (lineElements.length === 0) return;

    const previewRect = preview.getBoundingClientRect();

    // Find the element at the current scroll position
    let targetElement = null;
    let nextElement = null;

    for (let i = 0; i < lineElements.length; i++) {
        const elementRect = lineElements[i].getBoundingClientRect();
        const elementTop = elementRect.top - previewRect.top + previewPanel.scrollTop;

        if (elementTop <= previewScrollTop + 50) {
            targetElement = lineElements[i];
            nextElement = lineElements[i + 1] || null;
        } else {
            break;
        }
    }

    if (!targetElement) {
        targetElement = lineElements[0];
    }

    const targetLine = parseInt(targetElement.getAttribute('data-line'), 10);

    // Calculate interpolation
    let interpolatedLine = targetLine;

    if (nextElement) {
        const nextLine = parseInt(nextElement.getAttribute('data-line'), 10);
        const elementRect = targetElement.getBoundingClientRect();
        const nextRect = nextElement.getBoundingClientRect();
        const elementTop = elementRect.top - previewRect.top + previewPanel.scrollTop;
        const nextTop = nextRect.top - previewRect.top + previewPanel.scrollTop;

        if (nextTop > elementTop) {
            const progress = (previewScrollTop - elementTop) / (nextTop - elementTop);
            interpolatedLine = targetLine + progress * (nextLine - targetLine);
        }
    }

    const finalLine = Math.max(1, Math.round(interpolatedLine));

    // Only scroll if the line is not already visible
    const visibleRanges = editor.getVisibleRanges();
    if (visibleRanges && visibleRanges.length > 0) {
        const start = visibleRanges[0].startLineNumber;
        const end = visibleRanges[0].endLineNumber;
        if (finalLine < start || finalLine > end) {
            editor.revealLineInCenter(finalLine);
        }
    }
}

/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
    isDarkTheme = !isDarkTheme;

    document.body.classList.toggle('dark-theme', isDarkTheme);
    document.documentElement.classList.remove('dark-theme-preload');

    if (editor) {
        monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
    }

    const themeIcon = document.getElementById('theme-icon');
    themeIcon.className = isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';

    localStorage.setItem('mdreader-theme', isDarkTheme ? 'dark' : 'light');
    updateStatusBar();

    showToast(isDarkTheme ? 'Dark theme enabled' : 'Light theme enabled');
}

/**
 * Sets up the panel resizer for adjusting editor/preview split.
 */
function setupResizer() {
    const resizer = document.getElementById('resizer');
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const container = document.getElementById('main-container');

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        if (newWidth > MIN_PANEL_WIDTH_PERCENT && newWidth < MAX_PANEL_WIDTH_PERCENT) {
            editorPanel.style.width = newWidth + '%';
            previewPanel.style.width = (100 - newWidth) + '%';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

/**
 * Sets up drag and drop functionality for opening markdown files.
 */
function setupDragDrop() {
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
function setupKeyboardShortcuts() {
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
            if (activeTabId !== null) {
                closeTab(activeTabId);
            }
        }

        if (isCmdOrCtrl && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            const nextIndex = (currentIndex + 1) % tabs.length;
            switchToTab(tabs[nextIndex].id);
        }

        if (isCmdOrCtrl && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            switchToTab(tabs[prevIndex].id);
        }
    });
}

/**
 * Performs a fetch request with timeout and enhanced error handling.
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} The fetch response
 * @throws {Error} On timeout, network failure, or HTTP error
 */
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const text = await response.text();
            let errorMessage;

            try {
                const data = JSON.parse(text);
                errorMessage = data.error || `HTTP error ${response.status}`;
            } catch {
                errorMessage = `HTTP error ${response.status}: ${text.substring(0, 100)}`;
            }

            throw new Error(errorMessage);
        }

        return response;

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('Request timeout - server may be slow or unreachable');
        } else if (!navigator.onLine) {
            throw new Error('You are offline. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Saves the current document to the server and copies the shareable URL to clipboard.
 */
async function shareDocument() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const content = editor.getValue();
    const title = tab.fileName || 'Untitled';

    try {
        showToast('Saving to server...');

        const response = await fetchWithTimeout('api/save.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title })
        });

        const data = await response.json();

        if (data.success) {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(data.url);
                showToast('Link copied to clipboard! Share: ' + data.url, 8000);
            } else {
                prompt('Share this link:', data.url);
            }

            tab.sharedId = data.id;
            tab.sharedUrl = data.url;

        } else {
            throw new Error(data.error || 'Failed to save document');
        }

    } catch (error) {
        console.error('Error sharing document:', error);
        showToast('Error sharing document: ' + error.message, 5000);
    }
}

/**
 * Loads a shared document from the server by its ID.
 * @param {string} docId - The document ID to load
 * @returns {Promise<boolean>} Whether the document was loaded successfully
 */
async function loadSharedDocument(docId) {
    try {
        showToast('Loading shared document...');

        const response = await fetchWithTimeout(
            'api/load.php?id=' + encodeURIComponent(docId)
        );

        const data = await response.json();

        if (data.success) {
            const fileName = sanitizeHTML(data.title || 'Shared Document');
            createNewTab(fileName, data.content, null, false);

            const newTab = tabs[tabs.length - 1];
            newTab.sharedId = docId;

            showToast('Shared document loaded: ' + fileName, 3000);

            const url = new URL(window.location);
            url.searchParams.set('doc', docId);
            window.history.replaceState({}, '', url);

            return true;

        } else {
            throw new Error(data.error || 'Failed to load document');
        }

    } catch (error) {
        console.error('Error loading shared document:', error);
        showToast('Error loading shared document: ' + error.message, 5000);
        return false;
    }
}

/**
 * Returns a promise that resolves when the editor is fully initialized.
 * @returns {Promise<void>}
 * @throws {Error} If editor fails to initialize within timeout
 */
function waitForEditorReady() {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkEditor = setInterval(() => {
            attempts++;

            if (editor?.getValue !== undefined && editor.getModel() !== null) {
                clearInterval(checkEditor);
                resolve();
            } else if (attempts >= EDITOR_MAX_INIT_ATTEMPTS) {
                clearInterval(checkEditor);
                reject(new Error('Editor initialization timeout'));
            }
        }, EDITOR_INIT_TIMEOUT_MS);
    });
}

/**
 * Checks if there's a shared document ID in the URL.
 * @returns {string|null} The document ID or null if not present
 */
function getSharedDocumentId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('doc');
}

/**
 * Checks the URL for a shared document ID parameter and loads it if present.
 * @param {boolean} isInitialLoad - Whether this is the initial page load
 */
async function checkForSharedDocument(isInitialLoad = false) {
    const docId = getSharedDocumentId();

    if (docId) {
        try {
            await waitForEditorReady();

            // If this is the initial load and there's only an empty default tab,
            // we'll remove it after successfully loading the shared document
            const hasOnlyDefaultTab = isInitialLoad && tabs.length === 1 &&
                tabs[0].fileName === 'Untitled' && tabs[0].content === '';
            const defaultTabId = hasOnlyDefaultTab ? tabs[0].id : null;

            const loaded = await loadSharedDocument(docId);

            // Remove the empty default tab if shared document loaded successfully
            if (loaded && defaultTabId !== null && tabs.length > 1) {
                const defaultTab = tabs.find(t => t.id === defaultTabId);
                if (defaultTab && defaultTab.id !== activeTabId) {
                    const tabElement = document.querySelector(`.tab[data-tab-id="${defaultTab.id}"]`);
                    if (tabElement) {
                        tabElement.remove();
                    }
                    tabs = tabs.filter(t => t.id !== defaultTabId);
                    saveTabsToLocalStorage();
                }
            }
        } catch (error) {
            console.error('Failed to load shared document:', error);
            showToast('Failed to initialize editor', 5000);
        }
    }
}

/**
 * Sets up all UI event listeners for toolbar buttons and panels.
 */
function setupEventListeners() {
    document.getElementById('new-tab-btn').addEventListener('click', () => createNewTab());
    document.getElementById('new-tab-btn-small').addEventListener('click', () => createNewTab());
    document.getElementById('open-btn').addEventListener('click', openFile);
    document.getElementById('save-btn').addEventListener('click', saveFile);
    document.getElementById('save-as-btn').addEventListener('click', saveFileAs);
    document.getElementById('export-html-btn').addEventListener('click', exportToHTML);
    document.getElementById('share-btn').addEventListener('click', shareDocument);
    document.getElementById('view-mode-toggle').addEventListener('click', toggleViewMode);
    document.getElementById('sync-scroll-toggle').addEventListener('click', toggleSyncScroll);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('autosave-toggle').addEventListener('click', toggleAutoSave);

    const previewPanel = document.getElementById('preview-panel');
    previewPanel.addEventListener('scroll', () => {
        if (isSyncScrollEnabled && !isScrollingEditor) {
            isScrollingPreview = true;
            syncEditorScroll();
            setTimeout(() => { isScrollingPreview = false; }, 100);
        }
    });
}

/**
 * Initializes the application: loads preferences, sets up UI, and prepares editor.
 */
function init() {
    try {
        const savedTheme = localStorage.getItem('mdreader-theme') || 'dark';
        isDarkTheme = savedTheme === 'dark';

        if (isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.getElementById('theme-icon').className = 'fas fa-sun';
        }
    } catch (e) {
        console.error('Error loading theme:', e);
    }

    try {
        const savedAutosave = localStorage.getItem('mdreader-autosave');
        autoSaveEnabled = savedAutosave !== 'disabled';

        const toggleBtn = document.getElementById('autosave-toggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', autoSaveEnabled.toString());
        }
    } catch (e) {
        console.error('Error loading autosave preference:', e);
    }

    setupEventListeners();
    setupResizer();
    setupDragDrop();
    setupKeyboardShortcuts();
    checkForSharedDocument(true);

    if (!hasFileSystemAccess) {
        console.warn('File System Access API not supported. Using fallback methods.');
        showToast('Using fallback file operations (download instead of save)', 5000);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('Service Worker registered:', registration.scope))
            .catch(error => console.error('Service Worker registration failed:', error));
    });
}

/**
 * Starts the application when Monaco is ready.
 */
function startApp() {
    init();
    initializeEditor();
}

// Check if Monaco is already ready (race condition prevention)
if (window.monacoLoaderReady) {
    startApp();
} else {
    window.addEventListener('monaco-ready', startApp);
}

setTimeout(() => {
    if (!editor) {
        console.error('Monaco failed to initialize');
        showToast('Failed to load editor. Please refresh the page.', 0);
    }
}, 10000);

window.addEventListener('beforeunload', (e) => {
    const hasUnsaved = tabs.some(tab => tab.isModified);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});
