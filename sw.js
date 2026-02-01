'use strict';

/**
 * MDReader Service Worker
 * Provides offline functionality through strategic caching of static assets and CDN resources.
 */

const CACHE_NAME = 'mdreader-v1.2.0';
const CDN_CACHE = 'mdreader-cdn-v1.2.0';

const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './monaco-loader.js',
    './manifest.json'
];

const CDN_RESOURCES = [
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

/**
 * Caches a list of URLs to a specified cache.
 * @param {string} cacheName - Name of the cache to use
 * @param {string[]} urls - URLs to cache
 * @param {RequestInit} fetchOptions - Options for fetch requests
 * @returns {Promise<void>}
 */
async function cacheUrls(cacheName, urls, fetchOptions = {}) {
    const cache = await caches.open(cacheName);
    return Promise.all(
        urls.map(url =>
            fetch(url, fetchOptions)
                .then(response => cache.put(url, response))
                .catch(err => console.warn(`Failed to cache ${url}:`, err))
        )
    );
}

/**
 * Caches a response if it was successful.
 * @param {string} cacheName - Name of the cache to use
 * @param {Request} request - The original request
 * @param {Response} response - The response to cache
 */
async function cacheIfSuccessful(cacheName, request, response) {
    if (response.status === 200) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
    }
}

/**
 * Network-first strategy: try network, fall back to cache.
 * @param {Request} request - The request to handle
 * @param {string} cacheName - Cache to use for fallback
 * @returns {Promise<Response>}
 */
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        await cacheIfSuccessful(cacheName, request, response);
        return response;
    } catch {
        return caches.match(request);
    }
}

/**
 * Cache-first strategy with background update.
 * @param {Request} request - The request to handle
 * @param {string} cacheName - Cache to use
 * @returns {Promise<Response>}
 */
async function cacheFirstWithUpdate(request, cacheName) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        fetch(request)
            .then(response => cacheIfSuccessful(cacheName, request, response))
            .catch(() => {});
        return cachedResponse;
    }

    const response = await fetch(request);
    await cacheIfSuccessful(cacheName, request, response);
    return response;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)),
            cacheUrls(CDN_CACHE, CDN_RESOURCES, { mode: 'cors' })
        ]).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== CDN_CACHE)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Monaco Editor resources: cache-first for performance
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('monaco-editor')) {
        event.respondWith(cacheFirstWithUpdate(request, CDN_CACHE));
        return;
    }

    // External CDN resources: network-first for freshness
    if (url.hostname !== location.hostname) {
        event.respondWith(networkFirst(request, CDN_CACHE));
        return;
    }

    // App resources: cache-first with background update
    event.respondWith(cacheFirstWithUpdate(request, CACHE_NAME));
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then(cacheNames => Promise.all(cacheNames.map(name => caches.delete(name))))
                .then(() => event.ports[0].postMessage({ success: true }))
        );
    }
});
