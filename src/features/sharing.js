'use strict';

import { state } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { fetchWithTimeout, waitForEditorReady } from '../utils/fetch.js';
import { sanitizeHTML } from '../utils/sanitize.js';
import { createNewTab, saveTabsToLocalStorage } from './tabs.js';

/**
 * Checks if there's a shared document ID in the URL.
 * @returns {string|null} The document ID or null if not present
 */
export function getSharedDocumentId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('doc');
}

/**
 * Saves the current document to the server and copies the shareable URL to clipboard.
 */
export async function shareDocument() {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const content = state.editor.getValue();
    const title = tab.fileName || 'Untitled';

    try {
        showToast('Saving to server...');

        const response = await fetchWithTimeout('api/save', {
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
export async function loadSharedDocument(docId) {
    try {
        showToast('Loading shared document...');

        const response = await fetchWithTimeout(
            'api/load?id=' + encodeURIComponent(docId)
        );

        const data = await response.json();

        if (data.success) {
            const fileName = sanitizeHTML(data.title || 'Shared Document');
            createNewTab(fileName, data.content, null, false);

            const newTab = state.tabs[state.tabs.length - 1];
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
 * Checks the URL for a shared document ID parameter and loads it if present.
 * @param {boolean} isInitialLoad - Whether this is the initial page load
 */
export async function checkForSharedDocument(isInitialLoad = false) {
    const docId = getSharedDocumentId();

    if (docId) {
        try {
            await waitForEditorReady();

            const hasOnlyDefaultTab = isInitialLoad && state.tabs.length === 1 &&
                state.tabs[0].fileName === 'Untitled' && state.tabs[0].content === '';
            const defaultTabId = hasOnlyDefaultTab ? state.tabs[0].id : null;

            const loaded = await loadSharedDocument(docId);

            if (loaded && defaultTabId !== null && state.tabs.length > 1) {
                const defaultTab = state.tabs.find(t => t.id === defaultTabId);
                if (defaultTab && defaultTab.id !== state.activeTabId) {
                    const tabElement = document.querySelector(`.tab[data-tab-id="${defaultTab.id}"]`);
                    if (tabElement) {
                        tabElement.remove();
                    }
                    state.tabs = state.tabs.filter(t => t.id !== defaultTabId);
                    saveTabsToLocalStorage();
                }
            }
        } catch (error) {
            console.error('Failed to load shared document:', error);
            showToast('Failed to initialize editor', 5000);
        }
    }
}
