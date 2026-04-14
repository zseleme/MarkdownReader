'use strict';

import { state } from '../core/state.js';
import { fetchWithTimeout } from '../utils/fetch.js';

/**
 * Updates the status bar with current editor state information.
 */
export function updateStatusBar() {
    const statusInfo = document.getElementById('status-info');
    if (!state.editor) {
        statusInfo.textContent = 'Loading...';
        return;
    }

    const position = state.editor.getPosition();
    const content = state.editor.getValue();
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = content.trim() === '' ? 0 : words.length;
    const charCount = content.length;
    const theme = state.isDarkTheme ? 'Dark' : 'Light';
    const status = state.isModified ? 'Modified' : 'Saved';

    statusInfo.textContent = `${state.currentFileName} - Line ${position.lineNumber}, Column ${position.column} - ${wordCount} words, ${charCount} chars - ${theme} - ${status}`;
}

/**
 * Updates the autosave status indicator in the UI.
 * @param {'saving' | 'saved' | 'modified' | 'ready'} status - The current save status
 */
export function updateAutoSaveStatus(status) {
    const indicator = document.getElementById('autosave-indicator');
    const icon = document.getElementById('autosave-icon');
    const statusText = document.getElementById('autosave-status');

    if (!indicator || !icon || !statusText) return;

    if (state.autoSaveStatusTimeout) {
        clearTimeout(state.autoSaveStatusTimeout);
        state.autoSaveStatusTimeout = null;
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
        state.autoSaveStatusTimeout = setTimeout(() => {
            if (!state.isModified) {
                updateAutoSaveStatus('ready');
            }
        }, 3000);
    }
}

/**
 * Fetches and displays the application version from version.json.
 */
export async function loadVersion() {
    const versionElement = document.getElementById('status-version');
    try {
        const response = await fetch('./version.json?t=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            const version = data.version || 'dev';
            const branch = data.branch || '';
            const shortCommit = data.commit ? data.commit.substring(0, 7) : '';

            if (branch === 'develop') {
                versionElement.textContent = `v${version} (dev)`;
                versionElement.title = `Branch: ${branch}\nCommit: ${shortCommit}\nDeployed: ${data.deployed_at || 'N/A'}`;
            } else {
                versionElement.textContent = `v${version}`;
                versionElement.title = `Commit: ${shortCommit}\nDeployed: ${data.deployed_at || 'N/A'}`;
            }
        } else {
            versionElement.textContent = 'vLocal';
            versionElement.title = 'Running locally';
        }
    } catch {
        versionElement.textContent = 'vLocal';
        versionElement.title = 'Running locally';
    }
}
