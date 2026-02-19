'use strict';

/**
 * DOMPurify configuration for sanitizing user content
 */
export const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
        'blockquote', 'code', 'pre', 'strong', 'em', 'img', 'table', 'thead',
        'tbody', 'tr', 'th', 'td', 'br', 'hr', 'del', 'ins', 'sup', 'sub',
        'div', 'span', 'input'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'type', 'checked', 'disabled'],
    ALLOW_DATA_ATTR: false
};

/**
 * Autosave interval in milliseconds
 */
export const AUTOSAVE_INTERVAL_MS = 30000;

/**
 * Editor initialization timeout in milliseconds
 */
export const EDITOR_INIT_TIMEOUT_MS = 100;

/**
 * Maximum editor initialization attempts
 */
export const EDITOR_MAX_INIT_ATTEMPTS = 50;

/**
 * Fetch timeout in milliseconds
 */
export const FETCH_TIMEOUT_MS = 30000;

/**
 * Minimum panel width percentage for resizer
 */
export const MIN_PANEL_WIDTH_PERCENT = 20;

/**
 * Maximum panel width percentage for resizer
 */
export const MAX_PANEL_WIDTH_PERCENT = 80;

/**
 * Check if File System Access API is available
 */
export const hasFileSystemAccess = 'showOpenFilePicker' in window;
