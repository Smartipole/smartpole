// server.js (ปรับปรุงหลังแยก LINE Bot Handler + UptimeRobot Integration + Timezone Fix สำหรับ Render.com)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('./config/config');
const googleSheetsService = require('./services/googleSheets');
const lineService = require('./services/lineService');
const lookerStudioService = require('./services/lookerStudioService');
const notificationService = require('./services/notificationService');
const lineBotHandler = require('./services/lineBotHandler'); // ✅ เพิ่มการ import LINE Bot Handler
const { google } = require('googleapis');
const stream = require('stream');
const schedule = require('node-schedule');
const { JWT } = require('google-auth-library');

let pdfService = null;
try {
    pdfService = require('./services/pdfService');
    console.log('✅ PDF Service loaded successfully');
} catch (error) {
    console.warn('⚠️ PDF Service not available:', error.message);
    console.log('📄 PDF features will be disabled, but the system will continue to work normally');
    
    // สร้าง mock PDF service
    pdfService = {
        healthCheck: async () => ({ status: 'unavailable', message: 'PDF service disabled - puppeteer not installed' }),
        closeBrowser: async () => { console.log('PDF service not available, nothing to close'); },
        createRepairRequestsReport: async () => ({ 
            success: false, 
            error: 'PDF service ไม่พร้อมใช้งาน - กรุณาติดต่อผู้ดูแลระบบเพื่อติดตั้ง puppeteer' 
        }),
        createSingleRequestDocument: async () => ({ 
            success: false, 
            error: 'PDF service ไม่พร้อมใช้งาน - กรุณาติดต่อผู้ดูแลระบบเพื่อติดตั้ง puppeteer' 
        })
    };
}

const app = express();

// Middleware Setup
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin_dashboard')));

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// PWA Service Workers Routes
app.get('/executive-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'executive-sw.js'));
});

app.get('/technician-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'technician-sw.js'));
});

// PWA Center Route
app.get('/pwa', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pwa-center.html'));
});

app.use('/mobile', express.static(path.join(__dirname, 'mobile', 'build')));
app.get('/mobile/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile', 'build', 'index.html'), (err) => {
    if (err) {
      console.error("Error sending React app's index.html:", err);
      res.status(500).send("Error loading the application.");
    }
  });
});

// Admin Authentication
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const JWT_SECRET = process.env.JWT_SECRET || 'your-very-strong-jwt-secret-key-please-change-this';

function authenticateAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        if (req.path.includes('/admin/') && req.method === 'GET' && !req.path.startsWith('/api/admin/')) {
            return next();
        }
        if (req.path.startsWith('/api/admin/')) {
            console.warn(`🚫 API Access Denied: No token provided for ${req.method} ${req.path}.`);
            return res.status(401).json({ status: 'error', message: 'Token not provided. Please login.' });
        }
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            if (req.path.includes('/admin/') && req.method === 'GET' && !req.path.startsWith('/api/admin/')) {
                return res.redirect('/admin/login?session=expired');
            }
            return res.status(403).json({ status: 'error', message: 'Token is not valid or expired. Please login again.' });
        }
        req.user = user;
        next();
    });
}

// =====================================
// 🔄 KEEP-ALIVE & MONITORING SYSTEM (แก้ไข Timezone สำหรับ Render.com)
// =====================================

let keepAliveInterval = null;
let serverStartTime = new Date();
let monitoringStats = {
    totalRequests: 0,
    healthChecks: 0,
    uptimeChecks: 0,
    lastUptimeCheck: null,
    downtimeAlerts: 0
};

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = '7610983723:AAEFXDbDlq5uTHeyID8Fc5XEmIUx-LT6rJM';
const TELEGRAM_CHAT_ID = '7809169283';

// ===============================================
// 🕐 TIMEZONE FUNCTIONS สำหรับ RENDER.COM
// ===============================================

// ฟังก์ชันสำหรับแปลงเวลา UTC เป็นเวลาไทย
function getThaiTime() {
    const now = new Date();
    // เพิ่ม 7 ชั่วโมง (25200000 มิลลิวินาที = 7 * 60 * 60 * 1000)
    const thaiTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return thaiTime;
}

// ฟังก์ชันสำหรับแสดงเวลาไทยในรูปแบบที่อ่านง่าย
function formatThaiTime(date = null) {
    const thaiTime = date || getThaiTime();
    return thaiTime.toISOString().replace('T', ' ').substring(0, 19) + ' (Thai)';
}

// ฟังก์ชันเช็คว่าอยู่ในช่วงเวลาทำงานหรือไม่ (แก้ไขแล้วสำหรับ Render)
function isWorkingHours() {
    const thaiTime = getThaiTime();
    const hours = thaiTime.getUTCHours(); // ใช้ getUTCHours เพราะเราได้ปรับเวลาแล้ว
    const minutes = thaiTime.getUTCMinutes();
    
    // Debug log
    console.log(`🕐 Current times:`);
    console.log(`   ├── UTC: ${new Date().toISOString()}`);
    console.log(`   └── Thai: ${formatThaiTime(thaiTime)}`);
    console.log(`   └── Thai hour: ${hours}:${minutes.toString().padStart(2, '0')}`);
    
    // เวลาไทย: 05:00-21:00
    const isWorking = hours >= 4 && hours < 23;
    console.log(`⚡ Working hours check: ${isWorking} (${hours}:${minutes.toString().padStart(2, '0')} is ${isWorking ? 'within' : 'outside'} 04:00-23:00 Thai time)`);
    
    return isWorking;
}

// ปรับปรุงฟังก์ชันคำนวณเวลาทำงานถัดไป
function getNextActiveTime() {
    const thaiTime = getThaiTime();
    const hours = thaiTime.getUTCHours();
    
    if (hours < 4) {
        // ถ้ายังไม่ถึง 5 โมงเช้าของวันนี้ (เวลาไทย)
        const today = new Date(thaiTime);
        today.setUTCHours(4, 0, 0, 0);
        // แปลงกลับเป็น UTC สำหรับ return
        const utcTime = new Date(today.getTime() - (7 * 60 * 60 * 1000));
        return utcTime.toISOString();
    } else {
        // เริ่มทำงานพรุ่งนี้ 5 โมง (เวลาไทย)
        const tomorrow = new Date(thaiTime);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(4, 0, 0, 0);
        // แปลงกลับเป็น UTC สำหรับ return
        const utcTime = new Date(tomorrow.getTime() - (7 * 60 * 60 * 1000));
        return utcTime.toISOString();
    }
}

// ฟังก์ชันคำนวณเวลาหยุดถัดไป
function getNextStandbyTime() {
    const thaiTime = getThaiTime();
    const hours = thaiTime.getUTCHours();
    
    if (hours >= 23) {
        // ถ้าเลยเวลาหยุดแล้ว ให้คืนเวลาหยุดของพรุ่งนี้
        const tomorrow = new Date(thaiTime);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(23, 0, 0, 0);
        const utcTime = new Date(tomorrow.getTime() - (7 * 60 * 60 * 1000));
        return utcTime.toISOString();
    } else {
        // หยุดทำงานวันนี้ 21 โมง (เวลาไทย)
        const today = new Date(thaiTime);
        today.setUTCHours(23, 0, 0, 0);
        const utcTime = new Date(today.getTime() - (7 * 60 * 60 * 1000));
        return utcTime.toISOString();
    }
}

// ฟังก์ชันส่งข้อความไป Telegram (ปรับปรุงให้แสดงเวลาทั้ง UTC และไทย)
async function sendTelegramNotification(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        // เพิ่มข้อมูลเวลาใน message
        const thaiTime = getThaiTime();
        const utcTime = new Date();
        const timeInfo = `\n\n⏰ UTC: ${utcTime.toISOString()}\n🇹🇭 Thai: ${formatThaiTime(thaiTime)}`;
        
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message + timeInfo,
            parse_mode: 'Markdown'
        });
        
        if (response.data.ok) {
            console.log('📱 Telegram notification sent successfully');
        } else {
            console.warn('⚠️ Telegram notification failed:', response.data);
        }
    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error.message);
    }
}

// ฟังก์ชัน Keep-Alive ping (ปรับปรุง)
function keepAlivePing() {
    const thaiTime = getThaiTime();
    const utcTime = new Date();
    
    console.log(`🏓 Keep alive ping:`);
    console.log(`   ├── UTC: ${utcTime.toISOString()}`);
    console.log(`   └── Thai: ${formatThaiTime(thaiTime)}`);
    
    // Optional: ping ตัวเอง
    if (config.BASE_URL) {
        axios.get(`${config.BASE_URL}/health`)
            .then((response) => {
                console.log(`✅ Self ping successful: ${response.data.status}`);
            })
            .catch(err => {
                console.warn(`⚠️ Self ping failed: ${err.message}`);
            });
    }
}

// เริ่ม Keep-Alive (ปรับปรุง)
async function startKeepAlive() {
    if (keepAliveInterval) {
        console.log('⚠️ Keep-alive already running, skipping start');
        return;
    }
    
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    
    console.log('🟢 Starting keep-alive service');
    console.log(`📅 UTC: ${utcTime.toISOString()}`);
    console.log(`📅 Thai: ${formatThaiTime(thaiTime)}`);
    console.log(`⏰ Working hours: 04:00-23:00 Thai time`);
    
    // ส่งแจ้งเตือนไป Telegram
    await sendTelegramNotification(
        `🟢 *ระบบเข้าสู่โหมด Active*\n\n` +
        `📊 สถานะ: กำลังทำงาน Keep-Alive\n` +
        `🔄 ระยะเวลา: 04:00 - 23:00 (Thai time)\n` +
        `⚡ ระบบพร้อมใช้งาน\n` +
        `🌐 UptimeRobot: จะได้รับ HTTP 200`
    );
    
    keepAliveInterval = setInterval(() => {
        const currentWorking = isWorkingHours();
        if (currentWorking) {
            keepAlivePing();
        } else {
            console.log('😴 Outside working hours, skipping ping');
            console.log('🔄 Will auto-stop at next scheduled time (23:00 Thai = 16:00 UTC)');
        }
    }, 14 * 60 * 1000); // ทุก 14 นาที
}

// หยุด Keep-Alive (ปรับปรุง)
async function stopKeepAlive() {
    if (!keepAliveInterval) {
        console.log('⚠️ Keep-alive not running, skipping stop');
        return;
    }
    
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    
    console.log('🔴 Keep-alive service stopped');
    console.log(`📅 UTC: ${utcTime.toISOString()}`);
    console.log(`📅 Thai: ${formatThaiTime(thaiTime)}`);
    
    // ส่งแจ้งเตือนไป Telegram
    await sendTelegramNotification(
        `🔴 *สิ้นสุดเวลาทำงาน*\n\n` +
        `😴 สถานะ: ระบบเข้าสู่โหมด Sleep\n` +
        `🌙 โหมด: Sleep Mode\n` +
        `⏰ เวลาเริ่มใหม่: 04:00 น. วันถัดไป (Thai time)\n` +
        `🌐 UptimeRobot: จะได้รับ HTTP 503`
    );
}

// ตรวจสอบและแก้ไขสถานะอัตโนมัติ
function validateAndFixKeepAliveState() {
    const isWorking = isWorkingHours();
    const isRunning = !!keepAliveInterval;
    
    console.log(`🔍 State validation:`);
    console.log(`   ├── Should be working: ${isWorking}`);
    console.log(`   ├── Currently running: ${isRunning}`);
    console.log(`   └── Thai time: ${formatThaiTime()}`);
    
    if (isWorking && !isRunning) {
        console.log('🔧 Auto-fixing: Should be working but not running → Starting keep-alive');
        startKeepAlive();
    } else if (!isWorking && isRunning) {
        console.log('🔧 Auto-fixing: Should be sleeping but still running → Stopping keep-alive');
        stopKeepAlive();
    } else {
        console.log('✅ State is correct - no action needed');
    }
}

// --- General Routes ---
app.get('/', (req, res) => {
  const thaiTime = getThaiTime();
  const isWorking = isWorkingHours();
  
  res.json({
    status: 'success',
    message: `LINE Bot API & Admin API for ${config.ORG_NAME} is running!`,
    timestamp: new Date().toISOString(),
    thaiTime: formatThaiTime(thaiTime),
    uptime: process.uptime(),
    monitoringActive: isWorking,
    workingHours: '04:00-23:00 Thai time (UTC+7)',
    platform: 'Render.com (UTC timezone)',
    endpoints: {
      personal_info_form: `${config.BASE_URL}/form?userId=EXAMPLE_USER_ID`,
      repair_form: `${config.BASE_URL}/repair-form.html?userId=EXAMPLE_USER_ID`,
      line_webhook: `${config.BASE_URL}/webhook`,
      react_admin_app: `${config.BASE_URL}/mobile`,
      admin_login_page_html: `${config.BASE_URL}/admin/login`,
      admin_dashboard_page_html: `${config.BASE_URL}/admin/dashboard`,
      admin_executive_dashboard_page_html: `${config.BASE_URL}/admin/executive-dashboard`,
      looker_studio_dashboard: config.LOOKER_STUDIO_DASHBOARD_URL,
      // UptimeRobot endpoints
      health_check: `${config.BASE_URL}/health`,
      detailed_health: `${config.BASE_URL}/api/health`,
      uptime_status: `${config.BASE_URL}/uptime-status`,
      monitoring_stats: `${config.BASE_URL}/api/monitoring/stats`
    },
    integrations: {
      lookerStudio: lookerStudioService.healthCheck(),
      notifications: notificationService.healthCheck(),
      uptimeRobot: {
        workingHours: '04:00-23:00 Thai time (UTC+7)',
        currentlyActive: isWorking,
        telegramNotifications: !!TELEGRAM_BOT_TOKEN,
        httpStatus: isWorking ? 200 : 503
      }
    }
  });
});

// =====================================
// 🔍 UPTIMEROBOT MONITORING ENDPOINTS (ปรับปรุงสำหรับ Timezone)
// =====================================

// Basic health check สำหรับ UptimeRobot (ปรับปรุงแล้ว)
app.get('/health', (req, res) => {
    monitoringStats.healthChecks++;
    
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    const isWorking = isWorkingHours();
    
    console.log(`🔍 Health check received:`);
    console.log(`   ├── UTC Time: ${utcTime.toISOString()}`);
    console.log(`   ├── Thai Time: ${formatThaiTime(thaiTime)}`);
    console.log(`   ├── Working Status: ${isWorking ? 'ACTIVE' : 'SLEEPING'}`);
    console.log(`   └── Will return: HTTP ${isWorking ? '200' : '503'}`);
    
    // ถ้าอยู่นอกเวลาทำงาน ให้ส่ง HTTP 503 สำหรับ UptimeRobot
    if (!isWorking) {
        return res.status(503).json({ 
            status: 'sleeping', 
            message: 'Outside working hours (04:00-23:00 Thai time)',
            serverTime: {
                utc: utcTime.toISOString(),
                thai: formatThaiTime(thaiTime),
                thaiHour: thaiTime.getUTCHours()
            },
            workingHours: '04:00-23:00 Thai time (UTC+7)',
            platform: 'Render.com (UTC timezone)',
            nextActiveTime: getNextActiveTime(),
            note: 'Server in sleep mode - returns HTTP 503 for UptimeRobot'
        });
    }
    
    res.status(200).json({ 
        status: 'healthy', 
        message: 'Server is active during working hours',
        serverTime: {
            utc: utcTime.toISOString(),
            thai: formatThaiTime(thaiTime),
            thaiHour: thaiTime.getUTCHours()
        },
        workingHours: '04:00-23:00 Thai time (UTC+7)',
        platform: 'Render.com (UTC timezone)',
        uptime: process.uptime(),
        nextStandbyTime: getNextStandbyTime()
    });
});

// Status endpoint เฉพาะสำหรับ UptimeRobot (ปรับปรุงแล้ว)
app.get('/uptime-status', (req, res) => {
    monitoringStats.uptimeChecks++;
    monitoringStats.lastUptimeCheck = new Date().toISOString();
    
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    const isActive = isWorkingHours();
    const status = isActive ? 'active' : 'standby';
    
    res.status(200).json({
        status: status,
        active: isActive,
        message: isActive ? 'System is active and monitoring' : 'System in standby mode',
        workingHours: '04:00-23:00 Thai time (UTC+7)',
        platform: 'Render.com (UTC timezone)',
        serverTime: {
            utc: utcTime.toISOString(),
            thai: formatThaiTime(thaiTime)
        },
        uptime: process.uptime(),
        nextActiveTime: isActive ? null : getNextActiveTime(),
        nextStandbyTime: isActive ? getNextStandbyTime() : null,
        httpHealthStatus: isActive ? 200 : 503
    });
});

// UptimeRobot webhook receiver
app.post('/api/monitoring/uptime-webhook', async (req, res) => {
    try {
        const { alertType, monitorFriendlyName, monitorURL, alertDateTime } = req.body;
        
        console.log('📡 UptimeRobot webhook received:', { alertType, monitorFriendlyName });
        
        let message;
        if (alertType === 'down') {
            monitoringStats.downtimeAlerts++;
            message = `🚨 *ALERT: Server Down*\n\n` +
                     `📍 Monitor: ${monitorFriendlyName}\n` +
                     `🔗 URL: ${monitorURL}\n` +
                     `⏰ Alert Time: ${alertDateTime}\n` +
                     `📊 Working Hours: ${isWorkingHours() ? 'Active' : 'Standby'}\n` +
                     `🔄 Total Alerts: ${monitoringStats.downtimeAlerts}\n` +
                     `💡 Note: ถ้าเป็นเวลา 23:00-04:00 Thai time = Sleep mode (ปกติ)`;
        } else if (alertType === 'up') {
            message = `✅ *RECOVERY: Server Back Online*\n\n` +
                     `📍 Monitor: ${monitorFriendlyName}\n` +
                     `🔗 URL: ${monitorURL}\n` +
                     `⏰ Recovery Time: ${alertDateTime}\n` +
                     `🎉 Status: Server recovered successfully`;
        }
        
        if (message) {
            await sendTelegramNotification(message);
        }
        
        res.json({ 
            status: 'success', 
            message: 'Webhook processed successfully',
            alertType,
            processed: !!message
        });
        
    } catch (error) {
        console.error('❌ Error processing UptimeRobot webhook:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Error processing webhook: ' + error.message 
        });
    }
});

// Monitoring statistics (ปรับปรุงแล้ว)
app.get('/api/monitoring/stats', (req, res) => {
    const uptimeSeconds = process.uptime();
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    
    res.json({
        server: {
            startTime: serverStartTime.toISOString(),
            uptime: {
                seconds: Math.floor(uptimeSeconds),
                formatted: `${uptimeHours}h ${uptimeMinutes}m`,
                days: Math.floor(uptimeSeconds / 86400)
            },
            status: isWorkingHours() ? 'active' : 'standby',
            platform: 'Render.com (UTC timezone)'
        },
        time: {
            utc: utcTime.toISOString(),
            thai: formatThaiTime(thaiTime),
            thaiHour: thaiTime.getUTCHours()
        },
        monitoring: {
            ...monitoringStats,
            workingHours: '04:00-23:00 Thai time (UTC+7)',
            currentlyInWorkingHours: isWorkingHours(),
            keepAliveActive: !!keepAliveInterval,
            telegramNotifications: !!TELEGRAM_BOT_TOKEN,
            httpHealthStatus: isWorkingHours() ? 200 : 503
        },
        schedule: {
            nextActiveTime: isWorkingHours() ? null : getNextActiveTime(),
            nextStandbyTime: isWorkingHours() ? getNextStandbyTime() : null,
            cronJobs: {
                start: '22:00 UTC (05:00 Thai)',
                stop: '14:00 UTC (21:00 Thai)'
            }
        }
    });
});

// Manual monitoring controls (สำหรับ admin)
app.post('/api/admin/monitoring/start', authenticateAdminToken, async (req, res) => {
    try {
        await startKeepAlive();
        res.json({ 
            status: 'success', 
            message: 'Keep-alive monitoring started manually',
            thaiTime: formatThaiTime()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

app.post('/api/admin/monitoring/stop', authenticateAdminToken, async (req, res) => {
    try {
        await stopKeepAlive();
        res.json({ 
            status: 'success', 
            message: 'Keep-alive monitoring stopped manually',
            thaiTime: formatThaiTime()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// Middleware สำหรับนับ requests
app.use((req, res, next) => {
    monitoringStats.totalRequests++;
    next();
});

app.get('/form', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

app.get('/repair-form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'repair-form.html'));
});

// --- API Endpoints ---

// ✅ API สำหรับฟอร์มข้อมูลส่วนตัว (ใช้ handler จาก lineBotHandler)
app.post('/api/form-submit', async (req, res) => {
  try {
    const result = await lineBotHandler.handlePersonalInfoSubmission(req.body);
    res.json({ status: 'success', message: result.message });
  } catch (error) {
    console.error('❌ Error in /api/form-submit:', error.message, error.stack);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ✅ API สำหรับฟอร์มแจ้งซ่อมใหม่ (ใช้ handler จาก lineBotHandler)
app.post('/api/repair-form-submit', async (req, res) => {
  try {
    const result = await lineBotHandler.handleRepairFormSubmission(req.body);
    res.json({ 
      status: 'success', 
      message: result.message,
      requestId: result.requestId
    });
  } catch (error) {
    console.error('❌ Error in /api/repair-form-submit:', error.message, error.stack);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// ✅ ปรับ webhook ให้ใช้ handler จาก lineBotHandler
app.post('/webhook', lineBotHandler.handleWebhook);

// ✅ API สำหรับดึง Looker URL จาก config
app.get('/api/admin/config/looker-url', authenticateAdminToken, (req, res) => {
    try {
        res.json({
            status: 'success',
            data: {
                lookerUrl: config.LOOKER_STUDIO_DASHBOARD_URL || '',
                isEnabled: config.ENABLE_LOOKER_INTEGRATION || false
            }
        });
    } catch (error) {
        console.error('Error getting Looker URL:', error);
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถดึง Looker URL ได้: ' + error.message
        });
    }
});

// ✅ Looker Studio API Endpoints
app.get('/api/admin/looker-studio/dashboard-url', authenticateAdminToken, (req, res) => {
    try {
        const { type = 'general', filters } = req.query;
        const parsedFilters = filters ? JSON.parse(filters) : {};
        const url = lookerStudioService.getDashboardLinkForTelegram(type, parsedFilters);
        
        res.json({
            status: 'success',
            data: {
                url: url,
                type: type,
                filters: parsedFilters,
                isEnabled: lookerStudioService.isEnabled
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถสร้าง Dashboard URL ได้: ' + error.message
        });
    }
});

app.get('/api/admin/looker-studio/embed-url', authenticateAdminToken, (req, res) => {
    try {
        const { filters } = req.query;
        const parsedFilters = filters ? JSON.parse(filters) : {};
        const url = lookerStudioService.createEmbedUrl(parsedFilters);
        
        res.json({
            status: 'success',
            data: {
                embedUrl: url,
                filters: parsedFilters,
                isEnabled: lookerStudioService.isEnabled
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถสร้าง Embed URL ได้: ' + error.message
        });
    }
});

app.get('/api/admin/looker-studio/health', authenticateAdminToken, (req, res) => {
    try {
        const health = lookerStudioService.healthCheck();
        res.json({
            status: 'success',
            data: health
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถตรวจสอบสถานะ Looker Studio ได้: ' + error.message
        });
    }
});

// ✅ Notification API Endpoints
app.post('/api/admin/notifications/send-report', authenticateAdminToken, async (req, res) => {
    try {
        const { reportType = 'summary', filters = {} } = req.body;
        const result = await notificationService.sendOnDemandReport(reportType, filters);
        
        if (result.success) {
            res.json({
                status: 'success',
                message: 'ส่งรายงานสำเร็จ',
                data: result
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'ไม่สามารถส่งรายงานได้: ' + result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'เกิดข้อผิดพลาดในการส่งรายงาน: ' + error.message
        });
    }
});

app.post('/api/admin/notifications/send-custom', authenticateAdminToken, async (req, res) => {
    try {
        const { 
            message, 
            includeDashboard = false, 
            dashboardType = 'general', 
            includeLoginLink = false 
        } = req.body;
        
        if (!message) {
            return res.status(400).json({
                status: 'error',
                message: 'กรุณาระบุข้อความที่จะส่ง'
            });
        }
        
        const result = await notificationService.sendCustomNotification(
            message, 
            includeDashboard, 
            dashboardType, 
            includeLoginLink
        );
        
        if (result.success) {
            res.json({
                status: 'success',
                message: 'ส่งแจ้งเตือนสำเร็จ',
                data: result
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: 'ไม่สามารถส่งแจ้งเตือนได้: ' + result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน: ' + error.message
        });
    }
});

app.get('/api/admin/notifications/health', authenticateAdminToken, (req, res) => {
    try {
        const health = notificationService.healthCheck();
        res.json({
            status: 'success',
            data: health
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถตรวจสอบสถานะระบบแจ้งเตือนได้: ' + error.message
        });
    }
});

app.post('/api/admin/notifications/schedule/pause', authenticateAdminToken, (req, res) => {
    try {
        notificationService.pauseScheduledReports();
        res.json({
            status: 'success',
            message: 'ระงับการส่งรายงานอัตโนมัติแล้ว'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถระงับการส่งรายงานอัตโนมัติได้: ' + error.message
        });
    }
});

app.post('/api/admin/notifications/schedule/resume', authenticateAdminToken, (req, res) => {
    try {
        notificationService.resumeScheduledReports();
        res.json({
            status: 'success',
            message: 'เริ่มการส่งรายงานอัตโนมัติใหม่แล้ว'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'ไม่สามารถเริ่มการส่งรายงานอัตโนมัติได้: ' + error.message
        });
    }
});

// --- Admin API Endpoints ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const adminUser = await googleSheetsService.findAdminUserByUsername(username);

        if (adminUser && adminUser.PASSWORD_HASH && password === adminUser.PASSWORD_HASH && String(adminUser.IS_ACTIVE).toLowerCase() === 'true') {
            const userPayload = { username: adminUser.USERNAME, role: adminUser.ROLE };
            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '8h' });
            await googleSheetsService.updateAdminUser(username, { LAST_LOGIN: new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE }) });
            res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ!', token: token, role: adminUser.ROLE, username: adminUser.USERNAME });
        } else if (adminUser && String(adminUser.IS_ACTIVE).toLowerCase() !== 'true') {
            res.status(401).json({ status: 'error', message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน' });
        } else {
            res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (error) {
        console.error('Login API error:', error.message, error.stack);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + error.message });
    }
});

app.get('/api/admin/repair-requests', authenticateAdminToken, async (req, res) => {
    try {
        const { limit, sortBy, filterByStatus } = req.query;
        const options = {
            limit: limit ? parseInt(limit) : 0,
            sortBy: sortBy || 'newest',
            filterByStatus: filterByStatus || undefined
        };
        const requests = await googleSheetsService.getAllRepairRequests(options);
        res.json({ status: 'success', data: requests });
    } catch (error) {
        console.error('❌ Error fetching repair requests for admin:', error.message, error.stack);
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลรายการแจ้งซ่อมได้' });
    }
});

app.get('/api/admin/repair-request/:id', authenticateAdminToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!requestId) {
            return res.status(400).json({ status: 'error', message: 'กรุณาระบุเลขที่คำขอ' });
        }
        const requestData = await googleSheetsService.findRepairRequestById(requestId);
        if (requestData) {
            res.json({ status: 'success', data: requestData });
        } else {
            res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลคำขอแจ้งซ่อม' });
        }
    } catch (error) {
        console.error(`❌ Error fetching details for request ID ${req.params.id}:`, error.message, error.stack);
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลรายละเอียดคำขอได้' });
    }
});

// ✅ ปรับ status update API ให้ใช้ handler จาก lineBotHandler
app.put('/api/admin/repair-request/:id/status', authenticateAdminToken, async (req, res) => {
    try {
        const requestId = req.params.id;
        const { newStatus, technicianNotes, signatureUrl, approvalTimestampClient } = req.body;
        const approverUsername = req.user.username;
        const approverRole = req.user.role;

        if (!requestId) {
            return res.status(400).json({ status: 'error', message: 'กรุณาระบุเลขที่คำขอ' });
        }
        if (typeof newStatus === 'undefined' && typeof technicianNotes === 'undefined' && typeof signatureUrl === 'undefined' && typeof approvalTimestampClient === 'undefined') {
            return res.status(400).json({ status: 'error', message: 'กรุณาระบุข้อมูลสำหรับการอัปเดตอย่างน้อยหนึ่งอย่าง' });
        }

        const executiveActionStatuses = ["อนุมัติแล้วรอช่าง", "ไม่อนุมัติโดยผู้บริหาร"];
        let isExecutiveApprovalAction = false;
        let finalSignatureUrl = undefined;
        let finalApprovedBy = undefined;
        let finalApprovalTimestamp = undefined;

        if (newStatus && executiveActionStatuses.includes(newStatus)) {
            if (approverRole !== 'executive' && approverRole !== 'admin') {
                return res.status(403).json({ status: 'error', message: 'คุณไม่มีสิทธิ์ในการตั้งค่าสถานะนี้' });
            }
            isExecutiveApprovalAction = true;
            finalSignatureUrl = signatureUrl;
            finalApprovedBy = approverUsername;
            finalApprovalTimestamp = approvalTimestampClient || new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE });
            if (newStatus === "อนุมัติแล้วรอช่าง" && !signatureUrl) {
                 console.warn(`⚠️ Missing signatureUrl for executive approval of request ${requestId} by ${approverUsername}.`);
            }
        }
        
        const success = await googleSheetsService.updateRepairRequestStatus(
            requestId, newStatus, technicianNotes,
            isExecutiveApprovalAction ? finalSignatureUrl : undefined,
            isExecutiveApprovalAction ? finalApprovedBy : undefined,
            isExecutiveApprovalAction ? finalApprovalTimestamp : undefined
        );
        
        if (success) {
            const requestDetails = await googleSheetsService.findRepairRequestById(requestId);
            if (requestDetails) {
                // ✅ ใช้ handler จาก lineBotHandler แทน
                if (newStatus) {
                    await lineBotHandler.sendStatusUpdateToUser(requestDetails, newStatus, technicianNotes);
                }
            }
            res.json({ status: 'success', message: 'อัปเดตสถานะและข้อมูลการอนุมัติเรียบร้อยแล้ว' });
        } else {
            res.status(404).json({ status: 'error', message: 'ไม่สามารถอัปเดตสถานะได้ อาจไม่พบคำขอหรือเกิดข้อผิดพลาดในการบันทึกข้อมูล' });
        }
    } catch (error) {
        console.error(`❌ Error updating status for request ID ${req.params.id}:`, error.message, error.stack);
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message });
    }
});

app.get('/api/admin/dashboard-summary', authenticateAdminToken, async (req, res) => {
    try {
        const summary = await googleSheetsService.getRepairRequestsSummary();
        res.json({ status: 'success', summary: summary });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลสรุปได้' });
    }
});

// Pole Management APIs
app.get('/api/admin/poles', authenticateAdminToken, async (req, res) => {
    try {
        const { search } = req.query;
        const options = { search: search || undefined };
        const poles = await googleSheetsService.getAllPoles(options);
        res.json({ status: 'success', data: poles });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลเสาไฟฟ้าได้' });
    }
});

app.get('/api/admin/poles/:poleId', authenticateAdminToken, async (req, res) => {
    try {
        const poleIdToFind = req.params.poleId;
        if (!poleIdToFind) return res.status(400).json({ status: 'error', message: 'กรุณาระบุรหัสเสาไฟฟ้า' });
        const poleData = await googleSheetsService.findPoleByPoleId(poleIdToFind);
        if (poleData) res.json({ status: 'success', data: poleData });
        else res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลเสาไฟฟ้า' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลรายละเอียดเสาไฟฟ้าได้' });
    }
});

app.post('/api/admin/poles', authenticateAdminToken, async (req, res) => {
    try {
        const poleDataFromForm = req.body;
        if (!poleDataFromForm || !poleDataFromForm.poleId || !poleDataFromForm.village) {
            return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลที่จำเป็น (รหัสเสาไฟฟ้า, หมู่บ้าน) ให้ครบถ้วน' });
        }
        const success = await googleSheetsService.addPole(poleDataFromForm);
        if (success) res.status(201).json({ status: 'success', message: 'เพิ่มข้อมูลเสาไฟฟ้าใหม่สำเร็จ', data: poleDataFromForm });
        else res.status(500).json({ status: 'error', message: 'ไม่สามารถเพิ่มข้อมูลเสาไฟฟ้าได้ (service layer error)' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลเสาไฟฟ้า: ' + error.message });
    }
});

app.put('/api/admin/poles/:poleId', authenticateAdminToken, async (req, res) => {
    try {
        const originalPoleId = req.params.poleId;
        const updatedPoleData = req.body;
        if (!originalPoleId) return res.status(400).json({ status: 'error', message: 'กรุณาระบุรหัสเสาไฟฟ้าที่จะแก้ไข' });
        if (!updatedPoleData || !updatedPoleData.poleId || !updatedPoleData.village) {
             return res.status(400).json({ status: 'error', message: 'ข้อมูลที่ส่งมาสำหรับแก้ไขไม่ครบถ้วน (รหัสเสาไฟฟ้า, หมู่บ้าน)' });
        }
        const success = await googleSheetsService.updatePoleByPoleId(originalPoleId, updatedPoleData);
        if (success) res.json({ status: 'success', message: 'แก้ไขข้อมูลเสาไฟฟ้าสำเร็จ', data: updatedPoleData });
        else res.status(404).json({ status: 'error', message: 'ไม่สามารถแก้ไขข้อมูลเสาไฟฟ้าได้ อาจไม่พบข้อมูลหรือเกิดข้อผิดพลาด' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลเสาไฟฟ้า: ' + error.message });
    }
});

// Inventory Management APIs
app.get('/api/admin/inventory', authenticateAdminToken, async (req, res) => {
    try {
        const { search } = req.query;
        const options = { search: search || undefined };
        const items = await googleSheetsService.getAllInventoryItems(options);
        res.json({ status: 'success', data: items });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลคลังอุปกรณ์ได้' });
    }
});

app.post('/api/admin/inventory', authenticateAdminToken, async (req, res) => {
    try {
        const itemData = req.body;
        if (!itemData || !itemData.itemName || !itemData.unit || typeof itemData.pricePerUnit === 'undefined' || typeof itemData.currentStock === 'undefined') {
            return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลวัสดุให้ครบถ้วน (รายการ, หน่วย, ราคา/หน่วย, จำนวนคงเหลือ)' });
        }
        const success = await googleSheetsService.addInventoryItem(itemData);
        if (success) res.status(201).json({ status: 'success', message: 'เพิ่มรายการวัสดุใหม่สำเร็จ', data: itemData });
    } catch (error) {
        if (error.message.includes("มีอยู่ในคลังแล้ว")) return res.status(409).json({ status: 'error', message: error.message });
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการเพิ่มรายการวัสดุ: ' + error.message });
    }
});

app.put('/api/admin/inventory/:itemName', authenticateAdminToken, async (req, res) => {
    try {
        const originalItemName = decodeURIComponent(req.params.itemName);
        const updatedItemData = req.body;
        if (!originalItemName) return res.status(400).json({ status: 'error', message: 'กรุณาระบุชื่อรายการวัสดุที่จะแก้ไข' });
        if (!updatedItemData || !updatedItemData.itemName) return res.status(400).json({ status: 'error', message: 'ข้อมูลชื่อรายการใหม่ไม่ถูกต้อง' });
        const success = await googleSheetsService.updateInventoryItem(originalItemName, updatedItemData);
        if (success) res.json({ status: 'success', message: 'แก้ไขข้อมูลวัสดุสำเร็จ', data: updatedItemData });
    } catch (error) {
        if (error.message.includes("ซ้ำกับที่มีอยู่แล้ว")) return res.status(409).json({ status: 'error', message: error.message });
        else if (error.message.includes("ไม่พบรายการวัสดุ")) return res.status(404).json({ status: 'error', message: error.message });
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลวัสดุ: ' + error.message });
    }
});

app.post('/api/admin/inventory/adjust', authenticateAdminToken, async (req, res) => {
    try {
        const { itemName, quantityChange, transactionType } = req.body;
        if (!itemName || typeof quantityChange === 'undefined' || !transactionType) {
            return res.status(400).json({ status: 'error', message: 'ข้อมูลไม่ครบถ้วน (ชื่อรายการ, จำนวน, ประเภทการทำรายการ)' });
        }
        const numQuantityChange = parseFloat(quantityChange);
        if (isNaN(numQuantityChange) || numQuantityChange <= 0) {
            return res.status(400).json({ status: 'error', message: 'จำนวนต้องเป็นตัวเลขที่มากกว่า 0' });
        }
        const success = await googleSheetsService.adjustInventoryQuantity(itemName, numQuantityChange, transactionType);
        if (success) res.json({ status: 'success', message: `ปรับปรุงจำนวน "${itemName}" เรียบร้อยแล้ว` });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
});

// Admin User Management APIs
app.get('/api/admin/users', authenticateAdminToken, async (req, res) => {
    try {
        const adminUsers = await googleSheetsService.getAllAdminUsers();
        res.json({ status: 'success', data: adminUsers });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลผู้ดูแลระบบได้' });
    }
});

app.post('/api/admin/users', authenticateAdminToken, async (req, res) => {
    try {
        const { username, password, role, fullName, email, isActive } = req.body;
        if (!username || !password || !role) return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลที่จำเป็น (Username, Password, Role) ให้ครบถ้วน' });
        const hashedPassword = password;
        const adminUserData = { USERNAME: username, PASSWORD_HASH: hashedPassword, ROLE: role, FULL_NAME: fullName || '', EMAIL: email || '', IS_ACTIVE: isActive !== undefined ? isActive : true, };
        const success = await googleSheetsService.addAdminUser(adminUserData);
        if (success) {
            const { PASSWORD_HASH, ...userDataToReturn } = adminUserData;
            res.status(201).json({ status: 'success', message: 'เพิ่มผู้ดูแลระบบใหม่สำเร็จ', data: userDataToReturn });
        }
    } catch (error) {
        if (error.message.includes("มีอยู่ในระบบแล้ว")) return res.status(409).json({ status: 'error', message: error.message });
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการเพิ่มผู้ดูแลระบบ: ' + error.message });
    }
});

app.get('/api/admin/users/:username', authenticateAdminToken, async (req, res) => {
    try {
        const usernameToFind = req.params.username;
        if (!usernameToFind) return res.status(400).json({ status: 'error', message: 'กรุณาระบุ Username' });
        const userData = await googleSheetsService.findAdminUserByUsername(usernameToFind);
        if (userData) { const { PASSWORD_HASH, ...userDataToReturn } = userData; res.json({ status: 'success', data: userDataToReturn }); }
        else res.status(404).json({ status: 'error', message: 'ไม่พบข้อมูลผู้ดูแลระบบ' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลผู้ดูแลระบบได้' });
    }
});

app.put('/api/admin/users/:username', authenticateAdminToken, async (req, res) => {
    try {
        const usernameToUpdate = req.params.username;
        const { role, fullName, email, isActive, password } = req.body;
        if (!usernameToUpdate) return res.status(400).json({ status: 'error', message: 'กรุณาระบุ Username ของผู้ใช้ที่ต้องการแก้ไข' });
        const updateData = {};
        if (typeof role !== 'undefined') updateData.ROLE = role;
        if (typeof fullName !== 'undefined') updateData.FULL_NAME = fullName;
        if (typeof email !== 'undefined') updateData.EMAIL = email;
        if (typeof isActive !== 'undefined') updateData.IS_ACTIVE = isActive;
        if (password) updateData.PASSWORD_HASH = password;
        if (Object.keys(updateData).length === 0) return res.status(400).json({ status: 'error', message: 'ไม่มีข้อมูลสำหรับการอัปเดต' });
        const success = await googleSheetsService.updateAdminUser(usernameToUpdate, updateData);
        if (success) res.json({ status: 'success', message: `แก้ไขข้อมูลผู้ดูแลระบบ "${usernameToUpdate}" สำเร็จ` });
        else res.status(404).json({ status: 'error', message: `ไม่พบผู้ดูแลระบบ "${usernameToUpdate}" หรือไม่สามารถแก้ไขได้` });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้ดูแลระบบ: ' + error.message });
    }
});

app.delete('/api/admin/users/:username', authenticateAdminToken, async (req, res) => {
    try {
        const usernameToDelete = req.params.username;
        if (!usernameToDelete) return res.status(400).json({ status: 'error', message: 'กรุณาระบุ Username ของผู้ใช้ที่ต้องการลบ' });
        if (usernameToDelete === (process.env.ADMIN_USERNAME || 'admin') || usernameToDelete === req.user.username) {
             return res.status(403).json({ status: 'error', message: 'ไม่สามารถลบบัญชีผู้ดูแลระบบหลักหรือบัญชีที่กำลังใช้งานอยู่ได้' });
        }
        const success = await googleSheetsService.deleteAdminUser(usernameToDelete);
        if (success) res.json({ status: 'success', message: `ลบผู้ดูแลระบบ "${usernameToDelete}" สำเร็จ` });
        else res.status(404).json({ status: 'error', message: `ไม่พบผู้ดูแลระบบ "${usernameToDelete}" หรือไม่สามารถลบได้` });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดในการลบผู้ดูแลระบบ: ' + error.message });
    }
});

// API Endpoint for uploading signature - Alternative methods due to Service Account limitations
app.post('/api/admin/upload-signature', authenticateAdminToken, async (req, res) => {
    try {
        const { imageDataUrl, fileNamePrefix } = req.body;
        const username = req.user ? req.user.username : 'unknown_user';
        
        if (!imageDataUrl) {
            return res.status(400).json({ status: 'error', message: 'No image data provided.' });
        }

        const matches = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ status: 'error', message: 'Invalid image data format.' });
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const anonyfileNamePrefix = fileNamePrefix ? fileNamePrefix.replace(/[^a-zA-Z0-9-_]/g, '') : 'signature';
        const fileName = `${anonyfileNamePrefix}_${username}_${Date.now()}.png`;

        // Method 1: Try Google Sheets as file storage (fallback)
        try {
            const signatureData = {
                fileName: fileName,
                mimeType: mimeType,
                base64Data: base64Data,
                uploadedBy: username,
                uploadedAt: new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE }),
                fileSize: Math.round(base64Data.length * 0.75) // approximate file size
            };

            // Store signature data in Google Sheets (Signatures sheet)
            const success = await googleSheetsService.saveSignatureData(signatureData);
            
            if (success) {
                // Return a data URL that can be used directly
                const dataUrl = `data:${mimeType};base64,${base64Data}`;
                
                res.json({ 
                    status: 'success', 
                    message: 'ลายเซ็นบันทึกสำเร็จ! (เก็บในระบบฐานข้อมูล)', 
                    signatureUrl: dataUrl,
                    fileName: fileName,
                    method: 'sheets_storage',
                    note: 'ลายเซ็นถูกเก็บในฐานข้อมูล Google Sheets เนื่องจาก Service Account ไม่สามารถใช้ Google Drive ส่วนตัวได้'
                });
                return;
            }
        } catch (sheetsError) {
            console.warn('⚠️ Sheets storage failed, trying alternative method:', sheetsError.message);
        }

        // Method 2: Store as base64 in response for immediate use
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        
        console.log(`📝 Signature stored as data URL for user: ${username}, file: ${fileName}`);
        
        res.json({ 
            status: 'success', 
            message: 'ลายเซ็นพร้อมใช้งาน (ไม่ได้บันทึกถาวร)', 
            signatureUrl: dataUrl,
            fileName: fileName,
            method: 'data_url',
            note: 'Service Account ไม่สามารถอัปโหลดไฟล์ไปยัง Google Drive ส่วนตัวได้ กรุณาใช้ Shared Drive หรือ OAuth แทน',
            suggestion: 'สำหรับการใช้งานจริง แนะนำให้ตั้งค่า Google Shared Drive หรือใช้ OAuth 2.0'
        });

    } catch (error) {
        console.error('❌ Error processing signature:', error.message);
        res.status(500).json({ 
            status: 'error', 
            message: 'เกิดข้อผิดพลาดในการประมวลผลลายเซ็น: ' + error.message,
            suggestion: 'ปัญหา: Service Account ไม่สามารถใช้ Google Drive ส่วนตัวได้ ต้องใช้ Shared Drive หรือ OAuth'
        });
    }
});

// --- Telegram Configuration API Endpoints ---
app.get('/api/admin/telegram-config', authenticateAdminToken, async (req, res) => {
    try {
        const config = await googleSheetsService.getTelegramConfig();
        res.json({ status: 'success', data: config });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลการตั้งค่า Telegram ได้' });
    }
});

app.post('/api/admin/telegram-config', authenticateAdminToken, async (req, res) => {
    try {
        const { botToken, chatId, isEnabled, testMessage } = req.body;
        
        if (typeof botToken === 'undefined' || typeof chatId === 'undefined' || typeof isEnabled === 'undefined') {
            return res.status(400).json({ 
                status: 'error', 
                message: 'ข้อมูลไม่ครบถ้วน (botToken, chatId, isEnabled)' 
            });
        }

        // ทดสอบการเชื่อมต่อก่อนบันทึก (ถ้าเปิดใช้งาน)
        if (isEnabled && botToken && chatId) {
            const testResult = await notificationService.testTelegramNotification(botToken, chatId);
            if (!testResult) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'ไม่สามารถเชื่อมต่อ Telegram ได้ กรุณาตรวจสอบ Bot Token และ Chat ID' 
                });
            }
        }

        const configData = { botToken, chatId, isEnabled };
        const success = await googleSheetsService.saveTelegramConfig(configData);
        
        if (success) {
            // ส่งข้อความทดสอบเพิ่มเติมถ้าร้องขอ
            if (testMessage && isEnabled) {
                await notificationService.sendCustomNotification(
                    `✅ *การตั้งค่า Telegram สำเร็จ!*\n\nระบบแจ้งเตือนพร้อมใช้งานแล้ว`,
                    true,
                    'general',
                    true
                );
            }
            
            res.json({ 
                status: 'success', 
                message: 'บันทึกการตั้งค่า Telegram สำเร็จ' 
            });
        } else {
            res.status(500).json({ 
                status: 'error', 
                message: 'ไม่สามารถบันทึกการตั้งค่า Telegram ได้' 
            });
        }
    } catch (error) {
        console.error('Error saving Telegram settings:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า Telegram: ' + error.message 
        });
    }
});

// สร้างรายงานคำขอแจ้งซ่อม PDF
app.post('/api/admin/reports/repair-requests/pdf', authenticateAdminToken, async (req, res) => {
    // ตรวจสอบว่า PDF service พร้อมใช้งานหรือไม่
    if (!pdfService || typeof pdfService.createRepairRequestsReport !== 'function') {
        return res.status(503).json({
            status: 'error',
            message: 'PDF service ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ (puppeteer ยังไม่ได้ติดตั้ง)',
            suggestion: 'คุณสามารถส่งออกข้อมูลในรูปแบบอื่น เช่น Excel หรือ CSV ได้'
        });
    }
    
    try {
        const {
            filterStatus,
            dateRange,
            templateOptions = {},
            pdfOptions = {}
        } = req.body;

        let queryOptions = {};
        if (filterStatus) {
            queryOptions.filterByStatus = filterStatus;
        }

        const requests = await googleSheetsService.getAllRepairRequests(queryOptions);

        let filteredRequests = requests;
        if (dateRange && dateRange.start && dateRange.end) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            
            filteredRequests = requests.filter(request => {
                if (!request.DATE_REPORTED) return false;
                
                let requestDate;
                try {
                    if (request.DATE_REPORTED.includes(',')) {
                        const [datePart] = request.DATE_REPORTED.split(',');
                        const [day, month, year] = datePart.trim().split('/');
                        let fullYear = parseInt(year);
                        if (fullYear > 2500) fullYear -= 543;
                        requestDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
                    } else {
                        requestDate = new Date(request.DATE_REPORTED);
                    }
                } catch (error) {
                    console.error('Date parsing error:', error);
                    return false;
                }
                
                return requestDate >= startDate && requestDate <= endDate;
            });
        }

        const finalTemplateOptions = {
            title: `รายงานคำขอแจ้งซ่อมไฟฟ้า${filterStatus ? ` (สถานะ: ${filterStatus})` : ''}`,
            headerColor: '#2563eb',
            showDate: true,
            filterStatus: filterStatus,
            dateRange: dateRange ? `${new Date(dateRange.start).toLocaleDateString('th-TH')} ถึง ${new Date(dateRange.end).toLocaleDateString('th-TH')}` : null,
            ...templateOptions
        };

        const result = await pdfService.createRepairRequestsReport(filteredRequests, finalTemplateOptions);

        if (result.success) {
            const filename = `รายงานคำขอแจ้งซ่อม_${new Date().toISOString().split('T')[0]}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-Length', result.pdf.length);
            res.send(result.pdf);
        } else {
            res.status(500).json({
                status: 'error',
                message: 'ไม่สามารถสร้างรายงาน PDF ได้: ' + result.error
            });
        }
    } catch (error) {
        console.error('Error generating repair requests PDF:', error);
        res.status(500).json({
            status: 'error',
            message: 'เกิดข้อผิดพลาดในการสร้างรายงาน PDF: ' + error.message
        });
    }
});

app.post('/api/admin/request/:id/pdf', authenticateAdminToken, async (req, res) => {
    // ตรวจสอบว่า PDF service พร้อมใช้งานหรือไม่
    if (!pdfService || typeof pdfService.createSingleRequestDocument !== 'function') {
        return res.status(503).json({
            status: 'error',
            message: 'PDF service ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ (puppeteer ยังไม่ได้ติดตั้ง)',
            suggestion: 'คุณสามารถดูข้อมูลบนหน้าจอและใช้ฟังก์ชัน Print ของเบราว์เซอร์ได้'
        });
    }
    
    try {
        const requestId = req.params.id;
        const { templateOptions = {} } = req.body;

        if (!requestId) {
            return res.status(400).json({
                status: 'error',
                message: 'กรุณาระบุเลขที่คำขอ'
            });
        }

        const requestData = await googleSheetsService.findRepairRequestById(requestId);
        if (!requestData) {
            return res.status(404).json({
                status: 'error',
                message: 'ไม่พบข้อมูลคำขอแจ้งซ่อม'
            });
        }

        const result = await pdfService.createSingleRequestDocument(requestData, templateOptions);

        if (result.success) {
            const filename = `คำร้องแจ้งซ่อม_${requestId}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Content-Length', result.pdf.length);
            res.send(result.pdf);
        } else {
            res.status(500).json({
                status: 'error',
                message: 'ไม่สามารถสร้างเอกสาร PDF ได้: ' + result.error
            });
        }
    } catch (error) {
        console.error(`Error generating PDF for request ${req.params.id}:`, error);
        res.status(500).json({
            status: 'error',
            message: 'เกิดข้อผิดพลาดในการสร้างเอกสาร PDF: ' + error.message
        });
    }
});

// บันทึก Flex Message Template
app.post('/api/admin/flex-templates', authenticateAdminToken, async (req, res) => {
  // บันทึกลง Google Sheets หรือ Database
});

// โหลด Flex Message Templates
app.get('/api/admin/flex-templates', authenticateAdminToken, async (req, res) => {
  // ดึงข้อมูลจาก Google Sheets
});

app.get('/admin/flex-editor', authenticateAdminToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_dashboard', 'flex-editor.html'));
});

// --- Admin Dashboard HTML Routes ---
app.get('/admin/smart-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_dashboard', 'smart-login.html'));
});
app.get('/admin/login', (req, res) => { res.redirect('/admin/smart-login.html'); });
app.get('/admin/dashboard', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'dashboard.html')); });
app.get('/admin/executive-dashboard', authenticateAdminToken, (req, res) => {
    if (req.user && (req.user.role === 'executive' || req.user.role === 'admin')) {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'executive-dashboard.html'));
    } else { res.status(403).send('Access Denied. Only for Executives or Admins.'); }
});
app.get('/admin/requests', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'requests.html')); });
app.get('/admin/request-details', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'request-details.html')); });
app.get('/admin/poles', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'poles.html')); });
app.get('/admin/pole-form', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'pole-form.html')); });
app.get('/admin/inventory', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'inventory.html')); });
app.get('/admin/users', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'users.html')); });
app.get('/admin/user-form', authenticateAdminToken, (req, res) => { res.sendFile(path.join(__dirname, 'admin_dashboard', 'user-form.html')); });

// ✅ เพิ่มหน้า Looker Studio Dashboard
app.get('/admin/reports', authenticateAdminToken, (req, res) => { 
    res.sendFile(path.join(__dirname, 'admin_dashboard', 'reports.html')); 
});

// Mobile Apps (with auth and role checking)
app.get('/admin/mobile-executive.html', authenticateAdminToken, (req, res) => {
    if (req.user && (req.user.role === 'executive' || req.user.role === 'admin')) {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'mobile-executive.html'));
    } else { res.status(403).send('Access Denied. Only for Executives or Admins.'); }
});
app.get('/admin/mobile-admin.html', authenticateAdminToken, (req, res) => {
    if (req.user && req.user.role === 'admin') {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'mobile-admin.html'));
    } else { res.status(403).send('Access Denied. Only for Admins.'); }
});
app.get('/admin/mobile-technician.html', authenticateAdminToken, (req, res) => {
    if (req.user && (req.user.role === 'technician' || req.user.role === 'admin')) {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'mobile-technician.html'));
    } else { res.status(403).send('Access Denied. Only for Technicians or Admins.'); }
});
app.get('/admin/mobile-executive', authenticateAdminToken, (req, res) => {
    if (req.user && (req.user.role === 'executive' || req.user.role === 'admin')) {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'mobile-executive.html'));
    } else { res.status(403).send('Access Denied. Only for Executives or Admins.'); }
});
app.get('/admin/mobile-technician', authenticateAdminToken, (req, res) => {
    if (req.user && (req.user.role === 'technician' || req.user.role === 'admin')) {
        res.sendFile(path.join(__dirname, 'admin_dashboard', 'mobile-technician.html'));
    } else { res.status(403).send('Access Denied. Only for Technicians or Admins.'); }
});
app.get('/admin', (req, res) => { res.redirect('/admin/smart-login.html'); });

// ✅ Flex Message Settings API
app.get('/api/admin/flex-settings', authenticateAdminToken, async (req, res) => {
    try {
        // ดึงการตั้งค่าจาก lineBotHandler หรือ Google Sheets
        const settings = await googleSheetsService.getFlexMessageSettings();
        res.json({ 
            status: 'success', 
            data: settings || lineBotHandler.getDefaultFlexSettings() 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'ไม่สามารถดึงการตั้งค่าได้: ' + error.message 
        });
    }
});

app.post('/api/admin/flex-settings', authenticateAdminToken, async (req, res) => {
    try {
        const newSettings = req.body;
        
        // อัปเดตใน lineBotHandler
        lineBotHandler.updateFlexSettings(newSettings);
        
        // บันทึกลง Google Sheets (ถ้ามีฟังก์ชัน)
        await googleSheetsService.saveFlexMessageSettings(newSettings);
        
        res.json({ 
            status: 'success', 
            message: 'บันทึกการตั้งค่า Flex Message สำเร็จ' 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: 'ไม่สามารถบันทึกการตั้งค่าได้: ' + error.message 
        });
    }
});

// เพิ่มใน server.js (ปรับปรุงแล้ว)
app.get('/api/health', async (req, res) => {
    try {
        // ตรวจสอบ Google Sheets connection
        await googleSheetsService.authenticate();
        
        // ตรวจสอบ PDF service (แต่ไม่ fail ถ้าไม่มี)
        let pdfHealth = { status: 'unavailable' };
        if (pdfService && typeof pdfService.healthCheck === 'function') {
            try {
                pdfHealth = await pdfService.healthCheck();
            } catch (pdfError) {
                pdfHealth = { status: 'error', message: pdfError.message };
            }
        }
        
        // ตรวจสอบ Looker Studio และ Notification Services
        const lookerHealth = lookerStudioService.healthCheck();
        const notificationHealth = notificationService.healthCheck();
        
        const utcTime = new Date();
        const thaiTime = getThaiTime();
        const isWorking = isWorkingHours();
        
        res.json({
            status: 'healthy',
            timestamp: utcTime.toISOString(),
            thaiTime: formatThaiTime(thaiTime),
            uptime: process.uptime(),
            platform: 'Render.com (UTC timezone)',
            workingHours: {
                active: isWorking,
                schedule: '04:00-23:00 Thai time (UTC+7)',
                cronSchedule: {
                    start: '23:00 UTC (04:00 Thai)',
                    stop: '16:00 UTC (23:00 Thai)'
                },
                nextActiveTime: isWorking ? null : getNextActiveTime(),
                nextStandbyTime: isWorking ? getNextStandbyTime() : null,
                httpHealthStatus: isWorking ? 200 : 503
            },
            services: {
                googleSheets: 'connected',
                pdfService: pdfHealth.status,
                lookerStudio: lookerHealth.isEnabled ? 'enabled' : 'disabled',
                notifications: notificationHealth.autoReportEnabled ? 'enabled' : 'disabled',
                keepAlive: keepAliveInterval ? 'active' : 'inactive',
                telegram: TELEGRAM_BOT_TOKEN ? 'configured' : 'not-configured'
            },
            integrations: {
                lookerStudio: lookerHealth,
                notifications: notificationHealth
            },
            monitoring: {
                totalRequests: monitoringStats.totalRequests,
                healthChecks: monitoringStats.healthChecks,
                uptimeChecks: monitoringStats.uptimeChecks,
                lastUptimeCheck: monitoringStats.lastUptimeCheck,
                downtimeAlerts: monitoringStats.downtimeAlerts
            },
            message: pdfHealth.status === 'unavailable' ? 'PDF features disabled but system operational' : 'All services operational'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
            thaiTime: formatThaiTime(),
            platform: 'Render.com (UTC timezone)',
            workingHours: {
                active: isWorkingHours(),
                schedule: '04:00-23:00 Thai time (UTC+7)'
            }
        });
    }
});

// --- Server Health Check and Final Error Handling ---
app.use((req, res, next) => {
    if (!res.headersSent) {
        res.status(404).json({ status: 'error', message: 'Route not found or not handled' });
    }
});

app.use((err, req, res, next) => {
    console.error('❌ Unhandled Error:', err.stack || err.message || err);
    if (!res.headersSent) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// =====================================
// ⏰ CRON SCHEDULE (แก้ไขสำหรับ RENDER.COM)
// =====================================

// เวลาไทย 04:00 = UTC 21:00 (คืนก่อน)
schedule.scheduleJob('0 21 * * *', async () => {
    console.log('🌅 [SCHEDULED] Starting daily keep-alive service');
    console.log(`   ├── UTC: ${new Date().toISOString()}`);
    console.log(`   └── Thai: ${formatThaiTime()}`);
    console.log('   (04:00 Thai time = 21:00 UTC)');
    await startKeepAlive();
});

// เวลาไทย 23:00 = UTC 16:00 
schedule.scheduleJob('0 16 * * *', async () => {
    console.log('🌙 [SCHEDULED] Stopping daily keep-alive service');
    console.log(`   ├── UTC: ${new Date().toISOString()}`);
    console.log(`   └── Thai: ${formatThaiTime()}`);
    console.log('   (23:00 Thai time = 16:00 UTC)');
    await stopKeepAlive();
});

// ตรวจสอบและแก้ไขสถานะทุก 30 นาที
setInterval(validateAndFixKeepAliveState, 30 * 60 * 1000);

// =====================================
// 🚀 SERVER INITIALIZATION (ปรับปรุงแล้ว)
// =====================================

async function initializeMonitoringSystem() {
    console.log('\n🔄 Monitoring & Keep-Alive System (Render.com + Thai Timezone):');
    
    const utcTime = new Date();
    const thaiTime = getThaiTime();
    const isWorking = isWorkingHours();
    
    console.log(`📅 Server startup times:`);
    console.log(`   ├── UTC: ${utcTime.toISOString()}`);
    console.log(`   └── Thai: ${formatThaiTime(thaiTime)}`);
    console.log(`⏰ Current Thai hour: ${thaiTime.getUTCHours()}:${thaiTime.getUTCMinutes().toString().padStart(2, '0')}`);
    console.log(`├── Working Hours: 04:00-23:00 (Thai time)`);
    console.log(`├── Current Status: ${isWorking ? 'ACTIVE' : 'SLEEP MODE'}`);
    console.log(`├── Platform: Render.com (UTC timezone)`);
    console.log(`├── UptimeRobot will receive: HTTP ${isWorking ? '200' : '503'}`);
    console.log(`└── Cron jobs: 21:00 UTC (start) / 16:00 UTC (stop)`);
    
    // เริ่มทำงานทันทีถ้าอยู่ในเวลาทำงาน
    if (isWorking) {
        console.log('🟢 Auto-starting keep-alive (currently in Thai working hours)');
        await startKeepAlive();
    } else {
        console.log('😴 Not starting keep-alive (outside Thai working hours)');
        console.log(`⏰ Next start time: ${getNextActiveTime()}`);
        
        // ส่งแจ้งเตือนว่าระบบเริ่มในโหมด sleep
        await sendTelegramNotification(
            `😴 *Server Started in Sleep Mode*\n\n` +
            `📊 สถานะ: นอกเวลาทำงาน\n` +
            `🌙 โหมด: Sleep Mode (HTTP 503)\n` +
            `⏰ เวลาเริ่มงาน: 04:00-23:00 Thai time\n` +
            `🌐 Platform: Render.com (UTC timezone)`
        );
    }
}

// เพิ่มในส่วนการปิด server (รวม keep-alive และ services)
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down server...');
    try {
        // หยุด Keep-Alive ก่อน
        await stopKeepAlive();
        
        // ส่งแจ้งเตือนปิดระบบ
        await sendTelegramNotification(
            `🛑 *Server Shutdown*\n\n` +
            `📊 Uptime: ${Math.floor(process.uptime() / 60)} minutes\n` +
            `🔄 Total Requests: ${monitoringStats.totalRequests}\n` +
            `⚠️ Reason: Manual shutdown (SIGINT)\n` +
            `🌐 Platform: Render.com`
        );
        
        // ปิด PDF Service
        if (pdfService && typeof pdfService.closeBrowser === 'function') {
            await pdfService.closeBrowser();
        }
        
        // ปิด Notification Service
        if (notificationService && typeof notificationService.shutdown === 'function') {
            notificationService.shutdown();
        }
    } catch (error) {
        console.error('Error closing services:', error);
    }
    console.log('👋 Server shutdown complete');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down server...');
    try {
        // หยุด Keep-Alive ก่อน
        await stopKeepAlive();
        
        // ส่งแจ้งเตือนปิดระบบ
        await sendTelegramNotification(
            `🛑 *Server Shutdown*\n\n` +
            `📊 Uptime: ${Math.floor(process.uptime() / 60)} minutes\n` +
            `🔄 Total Requests: ${monitoringStats.totalRequests}\n` +
            `⚠️ Reason: Process termination (SIGTERM)\n` +
            `🌐 Platform: Render.com`
        );
        
        // ปิด PDF Service
        if (pdfService && typeof pdfService.closeBrowser === 'function') {
            await pdfService.closeBrowser();
        }
        
        // ปิด Notification Service
        if (notificationService && typeof notificationService.shutdown === 'function') {
            notificationService.shutdown();
        }
    } catch (error) {
        console.error('Error closing services:', error);
    }
    console.log('👋 Server shutdown complete');
    process.exit(0);
});

// --- Start Server ---
const PORT = config.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT} in ${config.NODE_ENV} mode.`);
  console.log(`🔗 LINE Webhook URL: ${config.BASE_URL}/webhook`);
  console.log(`📝 Personal Info Form URL: ${config.BASE_URL}/form?userId=EXAMPLE_USER_ID`);
  console.log(`🔧 Repair Form URL: ${config.BASE_URL}/repair-form.html?userId=EXAMPLE_USER_ID`);
  console.log(`📱 React App (Mobile Admin): ${config.BASE_URL}/mobile`);
  console.log(`🔑 Admin Login (HTML): ${config.BASE_URL}/admin/login`);
  console.log(`👑 Executive Dashboard (HTML): ${config.BASE_URL}/admin/executive-dashboard`);
  console.log(`📊 Reports Dashboard (HTML): ${config.BASE_URL}/admin/reports`);
  
  // UptimeRobot specific endpoints
  console.log(`\n🔍 UptimeRobot Monitoring Endpoints:`);
  console.log(`├── Basic Health Check: ${config.BASE_URL}/health`);
  console.log(`├── Detailed Health Check: ${config.BASE_URL}/api/health`);
  console.log(`├── Uptime Status: ${config.BASE_URL}/uptime-status`);
  console.log(`├── Monitoring Stats: ${config.BASE_URL}/api/monitoring/stats`);
  console.log(`└── Webhook Receiver: ${config.BASE_URL}/api/monitoring/uptime-webhook`);
  
  // Setup System_Config sheet ครั้งแรก
  try {
    await googleSheetsService.setupSystemConfigSheet();
    console.log('✅ System_Config sheet initialized');
  } catch (error) {
    console.warn('⚠️ System_Config setup warning:', error.message);
  }
  
  // ✅ แสดงข้อมูล Looker Studio
  if (config.ENABLE_LOOKER_INTEGRATION) {
    console.log(`📈 Looker Studio Dashboard: ${config.LOOKER_STUDIO_DASHBOARD_URL}`);
  }
  
  // ✅ แสดงสถานะการแจ้งเตือนอัตโนมัติ
  const notificationHealth = notificationService.healthCheck();
  if (notificationHealth.autoReportEnabled) {
    console.log(`🔔 Auto Reports: Enabled (Jobs: ${notificationHealth.activeJobs.join(', ')})`);
  } else {
    console.log(`🔕 Auto Reports: Disabled`);
  }
  
  // ✅ Initialize monitoring system (ปรับปรุงแล้ว)
  await initializeMonitoringSystem();
  
  // ส่งแจ้งเตือนเริ่มระบบ (ปรับปรุงแล้ว)
  if (TELEGRAM_BOT_TOKEN) {
    await sendTelegramNotification(
      `🚀 *Server Started Successfully*\n\n` +
      `🌐 Port: ${PORT}\n` +
      `📊 Status: ${isWorkingHours() ? 'Active Monitoring' : 'Sleep Mode'}\n` +
      `🔄 Keep-Alive: ${isWorkingHours() ? 'Running' : 'Scheduled for 04:00 Thai'}\n` +
      `🔍 UptimeRobot: Ready for monitoring\n` +
      `🌐 Platform: Render.com (UTC timezone)\n` +
      `✅ All services operational`
    );
  }
});

module.exports = app;
