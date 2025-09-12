const CACHE_NAME = 'smart-pole-technician-v1.1';
const OFFLINE_PAGE = '/admin/mobile-technician.html';

// ไฟล์ที่ต้องการ cache สำหรับหน้าช่าง
const STATIC_CACHE_URLS = [
  '/admin/mobile-technician.html',
  '/auth-utils.js',
  '/technician-manifest.json',
  '/icons/technician-icon-192.png',
  '/icons/technician-icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install Event - Cache ไฟล์ที่จำเป็น
self.addEventListener('install', (event) => {
  console.log('🔧 Installing Technician Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📋 Caching Technician App files...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Technician App cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Caching failed:', error);
      })
  );
});

// Activate Event - ลบ cache เก่า
self.addEventListener('activate', (event) => {
  console.log('🔄 Activating Technician Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.includes('smart-pole-technician')) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Technician Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch Event - จัดการ network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ตรวจสอบว่าเป็น request สำหรับหน้าช่างหรือไม่
  if (url.pathname.includes('mobile-technician') || 
      url.pathname.includes('technician-manifest') ||
      url.pathname.includes('technician-icon')) {
    
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
  if (event.tag === 'technician-background-sync') {
    console.log('🔄 Technician Background sync triggered');
    event.waitUntil(
      // ส่งข้อมูลการซ่อมที่รอการส่ง
      sendPendingRepairData()
    );
  }
});

// Push Notification - สำหรับการแจ้งเตือนช่าง
self.addEventListener('push', (event) => {
  console.log('🔔 Technician push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'มีงานซ่อมใหม่',
    icon: '/icons/technician-icon-192.png',
    badge: '/icons/technician-badge.png',
    tag: 'technician-notification',
    data: {
      url: '/admin_dashboard/mobile-technician.html'
    },
    actions: [
      {
        action: 'view',
        title: 'ดูงาน',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'ปิด',
        icon: '/icons/close-icon.png'
      }
    ],
    vibrate: [200, 100, 200] // เพิ่มการสั่นสำหรับช่าง
  };
  
  event.waitUntil(
    self.registration.showNotification('Smart Pole Technician', options)
  );
});

// Notification Click - จัดการการคลิกการแจ้งเตือน
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Technician notification clicked');
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/admin_dashboard/mobile-technician.html')
    );
  }
});

// Geolocation Sync - สำหรับอัปเดตตำแหน่งช่าง
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_LOCATION') {
    console.log('📍 Updating technician location...');
    
    // เก็บตำแหน่งใน IndexedDB หรือส่งไปยัง server
    updateTechnicianLocation(event.data.location);
  }
});

// ฟังก์ชันส่งข้อมูลการซ่อมที่รอการส่ง
async function sendPendingRepairData() {
  try {
    const pendingData = await getPendingRepairData();
    
    if (pendingData && pendingData.length > 0) {
      for (const data of pendingData) {
        try {
          await fetch('/api/sync-repair-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          await removePendingRepairData(data.id);
        } catch (error) {
          console.error('❌ Failed to sync repair data:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

// ฟังก์ชันอัปเดตตำแหน่งช่าง
async function updateTechnicianLocation(location) {
  try {
    await fetch('/api/update-technician-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: location.lat,
        longitude: location.lng,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    console.error('❌ Failed to update location:', error);
    // เก็บไว้ใน local storage สำหรับส่งทีหลัง
    storePendingLocationUpdate(location);
  }
}

// ฟังก์ชันดึงข้อมูลการซ่อมที่รอการส่ง
async function getPendingRepairData() {
  // Implementation ขึ้นอยู่กับวิธีการเก็บข้อมูล
  return [];
}

// ฟังก์ชันลบข้อมูลการซ่อมที่ส่งแล้ว
async function removePendingRepairData(id) {
  // Implementation ขึ้นอยู่กับวิธีการเก็บข้อมูล
}

// ฟังก์ชันเก็บการอัปเดตตำแหน่งที่รอการส่ง
async function storePendingLocationUpdate(location) {
  // Implementation ขึ้นอยู่กับวิธีการเก็บข้อมูล
}
