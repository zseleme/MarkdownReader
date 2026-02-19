'use strict';

/**
 * Displays a toast notification to the user.
 * @param {string} message - The message to display
 * @param {number} duration - Duration in milliseconds before auto-hide (0 for permanent)
 */
export function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    if (duration > 0) {
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}
