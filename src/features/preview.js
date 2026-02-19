'use strict';

import { state } from '../core/state.js';
import { DOMPURIFY_CONFIG } from '../core/constants.js';
import { showToast } from '../ui/toast.js';
import { setUpdatePreview } from './tabs.js';

// Initialize the marked renderer with custom rendering functions
const renderer = new marked.Renderer();

renderer.heading = function({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const rawText = tokens.map(t => t.raw || t.text || '').join('');
    const slug = rawText.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();
    return `<h${depth} id="${slug}" data-line="${state.currentSourceLine}">${text}</h${depth}>`;
};

renderer.paragraph = function({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<p data-line="${state.currentSourceLine}">${text}</p>\n`;
};

renderer.code = function({ text, lang }) {
    const language = lang || '';
    const highlighted = Prism.languages[language]
        ? Prism.highlight(text, Prism.languages[language], language)
        : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre data-line="${state.currentSourceLine}"><code class="language-${language}">${highlighted}</code></pre>\n`;
};

renderer.blockquote = function({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote data-line="${state.currentSourceLine}">${body}</blockquote>\n`;
};

renderer.list = function({ items, ordered, start }) {
    const tag = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
    let body = '';
    for (const item of items) {
        body += this.listitem(item);
    }
    return `<${tag}${startAttr} data-line="${state.currentSourceLine}">${body}</${tag}>\n`;
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
    let output = `<table data-line="${state.currentSourceLine}"><thead><tr>`;
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
    return `<hr data-line="${state.currentSourceLine}" />\n`;
};

// Configure marked options
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

/**
 * Performs the actual preview rendering.
 * @param {string} content - The markdown content to render
 */
function performPreviewUpdate(content) {
    const preview = document.getElementById('preview');

    try {
        const tokens = marked.lexer(content);

        let html = '';
        let searchPos = 0;

        for (const token of tokens) {
            if (token.raw) {
                const tokenPos = content.indexOf(token.raw, searchPos);
                if (tokenPos !== -1) {
                    const segment = content.substring(searchPos, tokenPos);
                    const newlines = (segment.match(/\n/g) || []).length;
                    state.currentSourceLine += newlines;
                    searchPos = tokenPos + token.raw.length;
                }
            }

            html += marked.parser([token]);
        }

        state.currentSourceLine = 1;

        let cleanHTML;
        if (typeof DOMPurify !== 'undefined') {
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
 * Renders markdown content to the preview pane with syntax mapping for scroll sync.
 * Uses debouncing to prevent UI freezing on large documents.
 */
export function updatePreview() {
    if (!state.editor) return;

    if (state.previewDebounceTimer) {
        clearTimeout(state.previewDebounceTimer);
    }

    const content = state.editor.getValue();

    const debounceMs = content.length > 50000 ? 300 : content.length > 10000 ? 150 : 50;

    state.previewDebounceTimer = setTimeout(() => {
        performPreviewUpdate(content);
    }, debounceMs);
}

// Register updatePreview with tabs module to break circular dependency
setUpdatePreview(updatePreview);

/**
 * Synchronizes preview scroll position with editor scroll position.
 * Uses percentage-based scrolling for reliable synchronization.
 */
export function syncPreviewScroll() {
    if (!state.editor || !state.isSyncScrollEnabled) return;

    if (state.syncScrollDebounceTimer) {
        clearTimeout(state.syncScrollDebounceTimer);
    }

    state.syncScrollDebounceTimer = setTimeout(() => {
        const previewPanel = document.getElementById('preview-panel');

        const editorScrollTop = state.editor.getScrollTop();
        const editorScrollHeight = state.editor.getScrollHeight() - state.editor.getLayoutInfo().height;

        if (editorScrollHeight <= 0) return;

        const scrollPercent = editorScrollTop / editorScrollHeight;
        const previewScrollHeight = previewPanel.scrollHeight - previewPanel.clientHeight;
        const targetScroll = scrollPercent * previewScrollHeight;

        if (Math.abs(previewPanel.scrollTop - targetScroll) > 5) {
            previewPanel.scrollTop = targetScroll;
        }
    }, 16);
}

/**
 * Synchronizes editor scroll position with preview scroll position.
 * Uses percentage-based scrolling for reliable synchronization.
 */
export function syncEditorScroll() {
    if (!state.editor || !state.isSyncScrollEnabled) return;

    const previewPanel = document.getElementById('preview-panel');

    const previewScrollTop = previewPanel.scrollTop;
    const previewScrollHeight = previewPanel.scrollHeight - previewPanel.clientHeight;

    if (previewScrollHeight <= 0) return;

    const scrollPercent = previewScrollTop / previewScrollHeight;
    const editorScrollHeight = state.editor.getScrollHeight() - state.editor.getLayoutInfo().height;
    const targetScroll = scrollPercent * editorScrollHeight;

    if (Math.abs(state.editor.getScrollTop() - targetScroll) > 5) {
        state.editor.setScrollTop(targetScroll);
    }
}

/**
 * Toggles synchronized scrolling between editor and preview panes.
 */
export function toggleSyncScroll() {
    state.isSyncScrollEnabled = !state.isSyncScrollEnabled;
    const btn = document.getElementById('sync-scroll-toggle');
    const icon = document.getElementById('sync-scroll-icon');

    if (state.isSyncScrollEnabled) {
        btn.classList.add('active');
        icon.className = 'fas fa-link';
        showToast('Sync scroll enabled');
    } else {
        btn.classList.remove('active');
        icon.className = 'fas fa-unlink';
        showToast('Sync scroll disabled');
    }
}
