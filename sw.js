// MDReader Service Worker
// Enables offline functionality and caching

const CACHE_NAME = 'mdreader-v1.0.0';
const CDN_CACHE = 'mdreader-cdn-v1.0.0';

// Files to cache immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './monaco-loader.js',
    './manifest.json'
];

// CDN resources to cache (with proper CORS)
const CDN_RESOURCES = [
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache CDN resources
            caches.open(CDN_CACHE).then((cache) => {
                console.log('Service Worker: Caching CDN resources');
                return Promise.all(
                    CDN_RESOURCES.map(url =>
                        fetch(url, { mode: 'cors' })
                            .then(response => cache.put(url, response))
                            .catch(err => console.warn(`Failed to cache ${url}:`, err))
                    )
                );
            })
        ]).then(() => {
            console.log('Service Worker: Installed successfully');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== CDN_CACHE) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated successfully');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Handle Monaco Editor requests specially
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('monaco-editor')) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((response) => {
                    // Cache Monaco resources for offline use
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CDN_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first strategy for CDN resources
    if (url.hostname !== location.hostname) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CDN_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache on network error
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-first strategy for app resources
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Update cache in background
                fetch(request).then((response) => {
                    if (response.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response);
                        });
                    }
                }).catch(() => {
                    // Ignore network errors when cache exists
                });

                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((response) => {
                // Cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});
