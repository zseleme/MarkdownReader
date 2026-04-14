'use strict';

import { FETCH_TIMEOUT_MS, EDITOR_INIT_TIMEOUT_MS, EDITOR_MAX_INIT_ATTEMPTS } from '../core/constants.js';
import { state } from '../core/state.js';

/**
 * Performs a fetch request with timeout and enhanced error handling.
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} The fetch response
 * @throws {Error} On timeout, network failure, or HTTP error
 */
export async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
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
 * Returns a promise that resolves when the editor is fully initialized.
 * @returns {Promise<void>}
 * @throws {Error} If editor fails to initialize within timeout
 */
export function waitForEditorReady() {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkEditor = setInterval(() => {
            attempts++;

            if (state.editor?.getValue !== undefined && state.editor.getModel() !== null) {
                clearInterval(checkEditor);
                resolve();
            } else if (attempts >= EDITOR_MAX_INIT_ATTEMPTS) {
                clearInterval(checkEditor);
                reject(new Error('Editor initialization timeout'));
            }
        }, EDITOR_INIT_TIMEOUT_MS);
    });
}
