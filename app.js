// MDReader Web App
// Modern Markdown Editor with Live Preview

'use strict';

// ===== CONFIGURATION =====
marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: true,
    highlight: function(code, lang) {
        if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
        } else {
            return code;
        }
    }
});

// ===== STATE =====
let tabs = [];
let activeTabId = null;
let tabCounter = 0;

let editor = null;
let currentFilePath = null;
let isDarkTheme = false;
let isModified = false;
let currentFileName = 'Untitled';
let isResizing = false;
let viewMode = 'split'; // 'split', 'editor', 'preview'
let isApplyingEditorContent = false;
let isSyncScrollEnabled = false;
let isScrollingEditor = false;
let isScrollingPreview = false;

// Autosave configuration
let autoSaveEnabled = true;
let autoSaveInterval = 30000; // 30 seconds
let autoSaveTimer = null;

// Feature detection
const hasFileSystemAccess = 'showOpenFilePicker' in window;

// ===== UTILITY FUNCTIONS =====

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ===== AUTOSAVE STATUS INDICATOR =====

let autoSaveStatusTimeout = null;

function updateAutoSaveStatus(status) {
    const indicator = document.getElementById('autosave-indicator');
    const icon = document.getElementById('autosave-icon');
    const statusText = document.getElementById('autosave-status');

    if (!indicator || !icon || !statusText) return;

    // Clear any existing timeout
    if (autoSaveStatusTimeout) {
        clearTimeout(autoSaveStatusTimeout);
        autoSaveStatusTimeout = null;
    }

    // Remove all status classes
    indicator.classList.remove('status-saved', 'status-saving', 'status-modified', 'status-ready');

    switch(status) {
        case 'saving':
            indicator.classList.add('status-saving');
            icon.className = 'fas fa-spinner fa-spin';
            statusText.textContent = 'Salvando...';
            break;

        case 'saved':
            indicator.classList.add('status-saved');
            icon.className = 'fas fa-check-circle';
            statusText.textContent = 'Todas as alterações salvas';

            // After 3 seconds, change to "ready" if still not modified
            autoSaveStatusTimeout = setTimeout(() => {
                if (!isModified) {
                    updateAutoSaveStatus('ready');
                }
            }, 3000);
            break;

        case 'modified':
            indicator.classList.add('status-modified');
            icon.className = 'fas fa-exclamation-circle';
            statusText.textContent = 'Alterações não salvas';
            break;

        case 'ready':
        default:
            indicator.classList.add('status-ready');
            icon.className = 'fas fa-check-circle';
            statusText.textContent = 'Pronto';
            break;
    }
}

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

// ===== FILE OPERATIONS =====

async function openFile() {
    try {
        if (hasFileSystemAccess) {
            // Modern API (Chrome/Edge)
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
            // Fallback for older browsers
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

async function saveFile(isAutoSave = false) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const content = editor.getValue();

    // Show saving status
    if (isAutoSave) {
        updateAutoSaveStatus('saving');
    }

    try {
        if (tab.fileHandle && hasFileSystemAccess) {
            // Save to existing file
            const writable = await tab.fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            tab.isModified = false;
            tab.content = content;
            isModified = false;
            updateTabUI(tab);
            updateStatusBar();
            updateAutoSaveStatus('saved');

            if (!isAutoSave) {
                showToast('File saved!');
            }
            saveTabsToLocalStorage();

        } else if (hasFileSystemAccess && !isAutoSave) {
            // Save as new file (only for manual save, not autosave)
            await saveFileAs();

        } else {
            // For autosave without fileHandle, or fallback: save to localStorage
            if (isAutoSave || !hasFileSystemAccess) {
                // Just update localStorage for autosave
                tab.isModified = false;
                tab.content = content;
                isModified = false;
                updateTabUI(tab);
                updateStatusBar();
                updateAutoSaveStatus('saved');
                saveTabsToLocalStorage();

                if (!isAutoSave && !hasFileSystemAccess) {
                    // Fallback: download file for manual save in unsupported browsers
                    downloadFile(tab.fileName || 'untitled.md', content);
                    showToast('File downloaded!');
                }
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
            tab.isModified = false;
            tab.content = content;

            currentFileName = handle.name;
            isModified = false;

            updateTabUI(tab);
            updateStatusBar();
            showToast('File saved!');
            saveTabsToLocalStorage();

        } else {
            // Fallback: download
            const filename = prompt('Enter filename:', tab.fileName || 'untitled.md');
            if (filename) {
                downloadFile(filename, content);
                tab.fileName = filename;
                currentFileName = filename;
                tab.isModified = false;
                isModified = false;
                updateTabUI(tab);
                updateStatusBar();
                showToast('File downloaded!');
                saveTabsToLocalStorage();
            }
        }

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error saving file:', err);
            showToast('Error saving file: ' + err.message);
        }
    }
}

function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function exportToHTML() {
    try {
        if (!editor) {
            showToast('Editor not initialized');
            return;
        }

        const content = editor.getValue();
        const html = marked.parse(content);

        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${currentFileName}</title>
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
${html}
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

// ===== TAB MANAGEMENT =====

function createNewTab(fileName = 'Untitled', content = '', fileHandle = null, skipSave = false) {
    const tabId = ++tabCounter;

    const tab = {
        id: tabId,
        fileName: fileName,
        content: content,
        fileHandle: fileHandle,
        isModified: false
    };

    tabs.push(tab);

    // Create tab element
    const tabElement = document.createElement('button');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tabId;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tab-title';
    titleSpan.textContent = fileName;

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

function switchToTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !editor) return;

    // Save current tab content
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

    // Update editor content
    isApplyingEditorContent = true;
    editor.setValue(tab.content);
    isApplyingEditorContent = false;

    // Update preview
    updatePreview();

    // Update UI
    document.querySelectorAll('.tab').forEach(el => {
        el.classList.remove('active');
    });
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    updateStatusBar();

    // Update autosave status based on tab state
    if (tab.isModified) {
        updateAutoSaveStatus('modified');
    } else {
        updateAutoSaveStatus('ready');
    }

    saveTabsToLocalStorage();
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    if (tab.isModified) {
        if (!confirm(`"${tab.fileName}" has unsaved changes. Close anyway?`)) {
            return;
        }
    }

    // Remove from array
    tabs.splice(tabIndex, 1);

    // Remove from DOM
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }

    // Switch to another tab or clear editor if no tabs left
    if (tabs.length === 0) {
        // Clear editor and reset state
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

function updateTabUI(tab) {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tab.id}"]`);
    if (!tabElement) return;

    const titleSpan = tabElement.querySelector('.tab-title');
    titleSpan.textContent = tab.fileName + (tab.isModified ? ' •' : '');
}

function updateActiveTabContent() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !editor) return;

    const currentContent = editor.getValue();

    // Check if content actually changed from saved state
    const changed = currentContent !== tab.content;

    // Only update if changed
    if (changed) {
        tab.isModified = true;
        isModified = true;
        updateAutoSaveStatus('modified');
    } else {
        tab.isModified = false;
        isModified = false;
        updateAutoSaveStatus('ready');
    }

    updateTabUI(tab);
    updateStatusBar();
}

// ===== LOCAL STORAGE =====

function saveTabsToLocalStorage() {
    try {
        const tabsData = tabs.map(tab => ({
            id: tab.id,
            fileName: tab.fileName,
            content: tab.content,
            isModified: tab.isModified
            // fileHandle cannot be serialized
        }));

        localStorage.setItem('mdreader-tabs', JSON.stringify(tabsData));
        localStorage.setItem('mdreader-activeTab', activeTabId);
        localStorage.setItem('mdreader-tabCounter', tabCounter);
    } catch (e) {
        console.error('Error saving tabs to localStorage:', e);
    }
}

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

            if (tabsData.length > 0) {
                tabsData.forEach(tabData => {
                    // Create tab with restored content, skip save to avoid multiple localStorage writes
                    createNewTab(tabData.fileName, tabData.content, null, true);
                    const tab = tabs[tabs.length - 1];

                    // Only update isModified flag
                    tab.isModified = tabData.isModified;
                    updateTabUI(tab);
                });

                // Switch to the previously active tab
                if (savedActiveTab) {
                    const activeId = parseInt(savedActiveTab, 10);
                    // Find the tab by index instead since IDs have changed
                    const tabIndex = tabsData.findIndex(t => t.id === activeId);
                    if (tabIndex !== -1 && tabs[tabIndex]) {
                        switchToTab(tabs[tabIndex].id);
                    } else if (tabs.length > 0) {
                        switchToTab(tabs[0].id);
                    }
                } else if (tabs.length > 0) {
                    switchToTab(tabs[0].id);
                }

                return true;
            }
        }
    } catch (e) {
        console.error('Error loading tabs from localStorage:', e);
    }

    return false;
}

// ===== PREVIEW =====

function updatePreview() {
    if (!editor) return;

    const content = editor.getValue();
    const preview = document.getElementById('preview');

    try {
        const html = marked.parse(content);
        preview.innerHTML = html;

        // Highlight code blocks
        preview.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });

        // Handle links
        preview.querySelectorAll('a').forEach((link) => {
            link.onclick = (e) => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http')) {
                    e.preventDefault();
                    showToast('Relative links are not supported in web version');
                }
            };
        });

    } catch (error) {
        console.error('Error rendering markdown:', error);
        preview.innerHTML = `<p style="color: red;">Error rendering markdown: ${error.message}</p>`;
    }
}

// ===== MONACO EDITOR INITIALIZATION =====

function initializeEditor() {
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

        // On content change
        editor.onDidChangeModelContent(() => {
            if (!isApplyingEditorContent) {
                updateActiveTabContent();
                updatePreview();
            }
        });

        // On cursor position change
        editor.onDidChangeCursorPosition(() => {
            updateStatusBar();
        });

        // On scroll (for sync scroll)
        editor.onDidScrollChange(() => {
            if (isSyncScrollEnabled && !isScrollingPreview) {
                isScrollingEditor = true;
                syncPreviewScroll();
                setTimeout(() => { isScrollingEditor = false; }, 50);
            }
        });

        // Custom clipboard commands
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
            editor.executeEdits('', [{
                range: selection,
                text: ''
            }]);
        });

        // Initialize app state
        const loaded = loadTabsFromLocalStorage();
        if (!loaded) {
            createNewTab();
        }

        updatePreview();
        updateStatusBar();

        // Initialize autosave status
        updateAutoSaveStatus('ready');

        // Setup autosave
        setupAutoSave();

        showToast('MDReader loaded successfully!');
    });
}

// ===== AUTOSAVE =====

function setupAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }

    if (!autoSaveEnabled) {
        return; // Don't start autosave if disabled
    }

    autoSaveTimer = setInterval(() => {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.isModified && autoSaveEnabled) {
            // Always use saveFile with autosave flag
            // It will handle file save or localStorage appropriately
            saveFile(true).catch(err => {
                console.error('Autosave error:', err);
                updateAutoSaveStatus('modified');
            });
        }
    }, autoSaveInterval);
}

function toggleAutoSave() {
    autoSaveEnabled = !autoSaveEnabled;

    const toggleBtn = document.getElementById('autosave-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', autoSaveEnabled.toString());
    }

    // Save preference to localStorage
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

// ===== VIEW MODES =====

function toggleViewMode() {
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const resizer = document.getElementById('resizer');
    const viewModeIcon = document.getElementById('view-mode-icon');
    const viewModeText = document.getElementById('view-mode-text');

    if (viewMode === 'split') {
        viewMode = 'editor';
        editorPanel.style.width = '100%';
        previewPanel.style.display = 'none';
        resizer.style.display = 'none';
        viewModeIcon.className = 'fas fa-edit';
        viewModeText.textContent = 'Editor';
    } else if (viewMode === 'editor') {
        viewMode = 'preview';
        editorPanel.style.display = 'none';
        previewPanel.style.display = 'block';
        previewPanel.style.width = '100%';
        resizer.style.display = 'none';
        viewModeIcon.className = 'fas fa-eye';
        viewModeText.textContent = 'Preview';
    } else {
        viewMode = 'split';
        editorPanel.style.display = 'block';
        editorPanel.style.width = '50%';
        previewPanel.style.display = 'block';
        previewPanel.style.width = '50%';
        resizer.style.display = 'block';
        viewModeIcon.className = 'fas fa-columns';
        viewModeText.textContent = 'Split';
    }
}

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

function syncPreviewScroll() {
    if (!editor || !isSyncScrollEnabled) return;

    const editorScrollTop = editor.getScrollTop();
    const editorScrollHeight = editor.getScrollHeight() - editor.getLayoutInfo().height;
    const scrollPercent = editorScrollTop / editorScrollHeight;

    const previewPanel = document.getElementById('preview-panel');
    const previewScrollHeight = previewPanel.scrollHeight - previewPanel.clientHeight;
    previewPanel.scrollTop = scrollPercent * previewScrollHeight;
}

// ===== THEME =====

function toggleTheme() {
    isDarkTheme = !isDarkTheme;

    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        document.documentElement.classList.remove('dark-theme-preload');
    } else {
        document.body.classList.remove('dark-theme');
        document.documentElement.classList.remove('dark-theme-preload');
    }

    if (editor) {
        monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
    }

    const themeIcon = document.getElementById('theme-icon');
    themeIcon.className = isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';

    localStorage.setItem('mdreader-theme', isDarkTheme ? 'dark' : 'light');
    updateStatusBar();

    showToast(isDarkTheme ? 'Dark theme enabled' : 'Light theme enabled');
}

// ===== RESIZER =====

function setupResizer() {
    const resizer = document.getElementById('resizer');
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const container = document.getElementById('main-container');

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        if (newWidth > 20 && newWidth < 80) {
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

// ===== DRAG AND DROP =====

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

// ===== KEYBOARD SHORTCUTS =====

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        // Ctrl+S: Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            await saveFile();
        }

        // Ctrl+Shift+S: Save As
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            await saveFileAs();
        }

        // Ctrl+O: Open
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            await openFile();
        }

        // Ctrl+T: New Tab
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            createNewTab();
        }

        // Ctrl+W: Close Tab
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
            e.preventDefault();
            if (activeTabId !== null) {
                closeTab(activeTabId);
            }
        }

        // Ctrl+Tab: Next Tab
        if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            const nextIndex = (currentIndex + 1) % tabs.length;
            switchToTab(tabs[nextIndex].id);
        }

        // Ctrl+Shift+Tab: Previous Tab
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            const currentIndex = tabs.findIndex(t => t.id === activeTabId);
            const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            switchToTab(tabs[prevIndex].id);
        }
    });
}

// ===== ONLINE SHARING =====

/**
 * Save current document to server and get shareable link
 */
async function shareDocument() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const content = editor.getValue();
    const title = tab.fileName || 'Untitled';

    try {
        showToast('Saving to server...');

        const response = await fetch('api/save.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                title: title
            })
        });

        const data = await response.json();

        if (data.success) {
            // Copy URL to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(data.url);
                showToast('Link copied to clipboard! Share: ' + data.url, 8000);
            } else {
                // Fallback: show prompt with URL
                prompt('Share this link:', data.url);
            }

            // Store document ID in tab
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
 * Load document from server by ID
 */
async function loadSharedDocument(docId) {
    try {
        showToast('Loading shared document...');

        const response = await fetch('api/load.php?id=' + encodeURIComponent(docId));
        const data = await response.json();

        if (data.success) {
            // Create new tab with loaded content
            const newTab = {
                id: ++tabCounter,
                fileName: data.title || 'Shared Document',
                content: data.content,
                isModified: false,
                fileHandle: null,
                sharedId: docId
            };

            tabs.push(newTab);
            activeTabId = newTab.id;

            // Update UI
            renderTabs();
            switchToTab(newTab.id);

            showToast('Shared document loaded: ' + newTab.fileName, 3000);

            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('doc', docId);
            window.history.replaceState({}, '', url);

        } else {
            throw new Error(data.error || 'Failed to load document');
        }

    } catch (error) {
        console.error('Error loading shared document:', error);
        showToast('Error loading shared document: ' + error.message, 5000);
    }
}

/**
 * Check URL for shared document ID and load it
 */
function checkForSharedDocument() {
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('doc');

    if (docId) {
        // Wait a bit for editor to be ready
        setTimeout(() => {
            loadSharedDocument(docId);
        }, 500);
    }
}

// ===== EVENT LISTENERS =====

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

    // Preview scroll sync
    const previewPanel = document.getElementById('preview-panel');
    previewPanel.addEventListener('scroll', () => {
        if (isSyncScrollEnabled && !isScrollingEditor) {
            isScrollingPreview = true;
            setTimeout(() => { isScrollingPreview = false; }, 50);
        }
    });
}

// ===== INITIALIZATION =====

function init() {
    // Load theme
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

    // Load autosave preference
    try {
        const savedAutosave = localStorage.getItem('mdreader-autosave');
        autoSaveEnabled = savedAutosave !== 'disabled'; // Default to enabled

        const toggleBtn = document.getElementById('autosave-toggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', autoSaveEnabled.toString());
        }
    } catch (e) {
        console.error('Error loading autosave preference:', e);
    }

    // Setup UI
    setupEventListeners();
    setupResizer();
    setupDragDrop();
    setupKeyboardShortcuts();

    // Check for shared document in URL
    checkForSharedDocument();

    // Display API support message
    if (!hasFileSystemAccess) {
        console.warn('File System Access API not supported. Using fallback methods.');
        showToast('Using fallback file operations (download instead of save)', 5000);
    }
}

// ===== SERVICE WORKER =====

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// ===== START APP =====

// Wait for Monaco to be ready
window.addEventListener('monaco-ready', () => {
    init();
    initializeEditor();
});

// Fallback if Monaco doesn't load
setTimeout(() => {
    if (!editor) {
        console.error('Monaco failed to initialize');
        showToast('Failed to load editor. Please refresh the page.', 0);
    }
}, 10000);

// Handle page unload
window.addEventListener('beforeunload', (e) => {
    const hasUnsaved = tabs.some(tab => tab.isModified);
    if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});
