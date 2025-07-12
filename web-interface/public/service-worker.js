const CACHE_NAME = 'automation-hub-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';
const API_CACHE = 'api-v1.0.0';

// Define cache strategies for different types of requests
const CACHE_STRATEGIES = {
  static: [
    '/',
    '/offline.html',
    '/manifest.json'
  ],
  dynamic: [
    '/dashboard',
    '/automations',
    '/credentials',
    '/settings'
  ],
  networkFirst: [
    '/api/auth/',
    '/api/websocket/'
  ],
  cacheFirst: [
    '/static/',
    '/assets/',
    '/icons/',
    '.css',
    '.js',
    '.woff2'
  ]
};

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(CACHE_STRATEGIES.static);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(handleRequest(request));
});

// Handle different types of requests with appropriate strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // API requests - Network first with cache fallback
    if (pathname.startsWith('/api/')) {
      return await networkFirst(request, API_CACHE);
    }
    
    // Static assets - Cache first with network fallback
    if (isStaticAsset(pathname)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // WebSocket connections - Network only
    if (pathname.includes('/websocket') || url.protocol === 'ws:' || url.protocol === 'wss:') {
      return await fetch(request);
    }
    
    // Authentication requests - Network first
    if (CACHE_STRATEGIES.networkFirst.some(pattern => pathname.startsWith(pattern))) {
      return await networkFirst(request, API_CACHE);
    }
    
    // App pages - Stale while revalidate
    if (CACHE_STRATEGIES.dynamic.includes(pathname)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }
    
    // Default strategy for app shell
    return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('Service Worker: Request failed:', error);
    
    // Return offline page for navigation requests
    if (request.destination === 'document') {
      const cache = await caches.open(STATIC_CACHE);
      return cache.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    
    // Return cached version or error response
    const cachedResponse = await getCachedResponse(request);
    return cachedResponse || new Response('Network Error', { status: 503 });
  }
}

// Cache strategies implementation
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && networkResponse.status < 400) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for:', request.url);
    const cachedResponse = await getCachedResponse(request, cacheName);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await getCachedResponse(request, cacheName);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && networkResponse.status < 400) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await getCachedResponse(request, cacheName);
  
  // Always try to fetch fresh data in the background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok && networkResponse.status < 400) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(error => {
    console.log('Service Worker: Background fetch failed:', error);
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  return fetchPromise;
}

// Helper functions
async function getCachedResponse(request, cacheName = null) {
  if (cacheName) {
    const cache = await caches.open(cacheName);
    return cache.match(request);
  }
  
  return caches.match(request);
}

function isStaticAsset(pathname) {
  return CACHE_STRATEGIES.cacheFirst.some(pattern => {
    if (pattern.startsWith('.')) {
      return pathname.endsWith(pattern);
    }
    return pathname.startsWith(pattern);
  });
}

// Background sync for failed requests
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('Service Worker: Background sync triggered');
  // Implement background sync logic here
  // For example, retry failed API requests
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Automation Hub', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for communication with main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync (experimental)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-metrics') {
    event.waitUntil(updateMetrics());
  }
});

async function updateMetrics() {
  console.log('Service Worker: Updating metrics in background');
  // Implement periodic metrics update
}