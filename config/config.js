require('dotenv').config();

/**
 * Determines the base URL for the application.
 * Supports Render, Railway, Heroku, and custom deployments.
 */
const getAppBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // ลำดับความสำคัญ: BASE_URL -> RENDER_EXTERNAL_URL -> Auto-detect
    return process.env.BASE_URL || 
           process.env.APP_BASE_URL || 
           (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : null) ||
           (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
           'https://your-app.onrender.com'; // fallback
  } else {
    const port = process.env.PORT || 3000;
    return process.env.BASE_URL || `http://localhost:${port}`;
  }
};

const appBaseUrl = getAppBaseUrl();

module.exports = {
  // LINE Bot Configuration
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
  
  // Google Sheets Configuration
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  GOOGLE_DRIVE_SIGNATURE_FOLDER_ID: process.env.GOOGLE_DRIVE_SIGNATURE_FOLDER_ID,
  
  // Looker Studio Configuration
  LOOKER_STUDIO_DASHBOARD_URL: process.env.LOOKER_STUDIO_DASHBOARD_URL || '',
  LOOKER_STUDIO_EMBED_URL: process.env.LOOKER_STUDIO_EMBED_URL || '',
  ENABLE_LOOKER_INTEGRATION: process.env.ENABLE_LOOKER_INTEGRATION === 'true',
  
  // Auto Reporting
  AUTO_REPORT_ENABLED: process.env.AUTO_REPORT_ENABLED === 'true',
  AUTO_REPORT_TIME: process.env.AUTO_REPORT_TIME || '08:00',
  DAILY_REPORT_ENABLED: process.env.DAILY_REPORT_ENABLED === 'true',
  WEEKLY_REPORT_ENABLED: process.env.WEEKLY_REPORT_ENABLED === 'true',
  MONTHLY_REPORT_ENABLED: process.env.MONTHLY_REPORT_ENABLED === 'true',
  
  // Sheet Names
  LINE_USER_PROFILE_SHEET_NAME: process.env.LINE_USER_PROFILE_SHEET_NAME || "LineID", 
  REPAIR_REQUESTS_SHEET_NAME: process.env.REPAIR_REQUESTS_SHEET_NAME || "แจ้งเหตุไฟฟ้าขัดข้อง", 
  POLE_DATA_SHEET_NAME: process.env.POLE_DATA_SHEET_NAME || "ข้อมูลเสาไฟฟ้า", 
  INVENTORY_SHEET_NAME: process.env.INVENTORY_SHEET_NAME || "คลังอุปกรณ์",
  ADMIN_USERS_SHEET_NAME: process.env.ADMIN_USERS_SHEET_NAME || "AdminUsers",
  TELEGRAM_CONFIG_SHEET_NAME: process.env.TELEGRAM_CONFIG_SHEET_NAME || 'TelegramConfig',
  
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BASE_URL: appBaseUrl, 
  TIMEZONE: process.env.TIMEZONE || "Asia/Bangkok",
  
  // Organization Information
  ORG_NAME: process.env.ORG_NAME || 'องค์การบริหารส่วนตำบลข่าใหญ่',
  ORG_NAME_SHORT: process.env.ORG_NAME_SHORT || 'อบต.ข่าใหญ่',
  ORG_LOGO_URL: process.env.ORG_LOGO_URL || '',
  
  // Contact Information
  CONTACT_INFO: {
    OFFICE_NAME: "อบต.ข่าใหญ่", 
    PHONE: process.env.CONTACT_PHONE || "042-315962",       
    EMAIL: process.env.CONTACT_EMAIL || "contact@khayai.go.th" 
  },
  
  // States for conversation flow
  STATES: {
    NONE: null, 
    AWAITING_FORM_COMPLETION: 'AWAITING_FORM_COMPLETION', 
    AWAITING_USER_DATA_CONFIRMATION: 'AWAITING_USER_DATA_CONFIRMATION', 
    AWAITING_POLE_ID: 'AWAITING_POLE_ID', 
    AWAITING_REASON: 'AWAITING_REASON',   
    AWAITING_PHOTO_CHOICE: 'AWAITING_PHOTO_CHOICE', 
    AWAITING_PHOTO_UPLOAD: 'AWAITING_PHOTO_UPLOAD', 
    AWAITING_FINAL_CONFIRMATION: 'AWAITING_FINAL_CONFIRMATION', 
    AWAITING_TRACKING_METHOD: 'AWAITING_TRACKING_METHOD',
    AWAITING_REQUEST_ID: 'AWAITING_REQUEST_ID',
    AWAITING_PHONE_NUMBER: 'AWAITING_PHONE_NUMBER',
    AWAITING_TRACKING_CHOICE: 'AWAITING_TRACKING_CHOICE', 
    AWAITING_TRACKING_REQUEST_ID_INPUT: 'AWAITING_TRACKING_REQUEST_ID_INPUT', 
    AWAITING_TRACKING_PHONE_INPUT: 'AWAITING_TRACKING_PHONE_INPUT' 
  },

  // Notification Settings
  NOTIFICATION_PRIORITIES: {
    HIGH: 'high',
    MEDIUM: 'medium', 
    LOW: 'low'
  },
  
  // Report Templates
  REPORT_TEMPLATES: {
    DAILY_SUMMARY: 'daily_summary',
    WEEKLY_SUMMARY: 'weekly_summary',
    MONTHLY_SUMMARY: 'monthly_summary',
    STATUS_UPDATE: 'status_update',
    NEW_REQUEST: 'new_request',
    EXECUTIVE_SUMMARY: 'executive_summary'
  }
};