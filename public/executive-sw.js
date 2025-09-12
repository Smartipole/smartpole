const CACHE_NAME = 'smart-pole-executive-v1.1';
const OFFLINE_PAGE = '/admin/mobile-executive.html';

// ไฟล์ที่ต้องการ cache สำหรับหน้าผู้บริหาร
const STATIC_CACHE_URLS = [
  '/admin/mobile-executive.html',
  '/auth-utils.js',
  '/executive-manifest.json',
  '/icons/executive-icon-192.png',
  '/icons/executive-icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js'
];

// Install Event - Cache ไฟล์ที่จำเป็น
self.addEventListener('install', (event) => {
  console.log('📦 Installing Executive Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📋 Caching Executive App files...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Executive App cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Caching failed:', error);
      })
  );
});

// Activate Event - ลบ cache เก่า
self.addEventListener('activate', (event) => {
  console.log('🔄 Activating Executive Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.includes('smart-pole-executive')) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Executive Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch Event - จัดการ network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ตรวจสอบว่าเป็น request สำหรับหน้าผู้บริหารหรือไม่
  if (url.pathname.includes('mobile-executive') || 
      url.pathname.includes('executive-manifest') ||
      url.pathname.includes('executive-icon')) {
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // ถ้ามีใน cache ให้ใช้จาก cache
          if (cachedResponse) {
            console.log('📋 Serving from cache:', request.url);
            return cachedResponse;
          }
          
          // ถ้าไม่มีใน cache ให้ fetch จาก network
          return fetch(request)
            .then((networkResponse) => {
              // บันทึกลง cache หากเป็น GET request และ response สำเร็จ
              if (request.method === 'GET' && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // ถ้า network ไม่พร้อม ให้แสดงหน้า offline
              if (request.destination === 'document') {
                return caches.match(OFFLINE_PAGE);
              }
              
              // สำหรับ resource อื่นๆ ให้ส่ง response ว่างเปล่า
              return new Response('', {
                status: 408,
                statusText: 'Network timeout'
              });
            });
        })
    );
  }
});

// Background Sync - สำหรับส่งข้อมูลเมื่อ online
self.addEventListener('sync', (event) => {
  if (event.tag === 'executive-background-sync') {
    console.log('🔄 Executive Background sync triggered');
    event.waitUntil(
      // ส่งข้อมูลที่รอการส่ง
      sendPendingData()
    );
  }
});

// Push Notification - สำหรับการแจ้งเตือนผู้บริหาร
self.addEventListener('push', (event) => {
  console.log('🔔 Executive push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'มีการอัปเดตใหม่สำหรับผู้บริหาร',
    icon: '/icons/executive-icon-192.png',
    badge: '/icons/executive-badge.png',
    tag: 'executive-notification',
    data: {
      url: '/admin_dashboard/mobile-executive.html'
    },
    actions: [
      {
        action: 'view',
        title: 'ดูรายละเอียด',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'ปิด',
        icon: '/icons/close-icon.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Smart Pole Executive', options)
  );
});

// Notification Click - จัดการการคลิกการแจ้งเตือน
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Executive notification clicked');
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/admin_dashboard/mobile-executive.html')
    );
  }
});

// ฟังก์ชันส่งข้อมูลที่รอการส่ง
async function sendPendingData() {
  try {
    // ดึงข้อมูลที่รอการส่งจาก IndexedDB หรือ localStorage
    const pendingData = await getPendingData();
    
    if (pendingData && pendingData.length > 0) {
      for (const data of pendingData) {
        try {
          await fetch('/api/sync-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          // ลบข้อมูลที่ส่งสำเร็จแล้ว
          await removePendingData(data.id);
        } catch (error) {
          console.error('❌ Failed to sync data:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// ฟังก์ชันดึงข้อมูลที่รอการส่ง
async function getPendingData() {
  // Implementation ขึ้นอยู่กับวิธีการเก็บข้อมูล
  return [];
}

// ฟังก์ชันลบข้อมูลที่ส่งแล้ว
async function removePendingData(id) {
  // Implementation ขึ้นอยู่กับวิธีการเก็บข้อมูล
}
