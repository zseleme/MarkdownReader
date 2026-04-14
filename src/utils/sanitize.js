'use strict';

/**
 * Sanitizes a string for safe HTML display by escaping special characters.
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string with HTML entities escaped
 */
export function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
