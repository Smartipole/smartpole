// services/notificationService.js
const axios = require('axios');
const config = require('../config/config');
const googleSheetsService = require('./googleSheets');
const lookerStudioService = require('./lookerStudioService');
const schedule = require('node-schedule'); // npm install node-schedule

class NotificationService {
  constructor() {
    this.scheduledJobs = new Map();
    this.init();
  }

  async init() {
    console.log('🔔 Initializing Notification Service...');
    
    // ✅ ตั้งค่า Scheduled Reports
    if (config.AUTO_REPORT_ENABLED) {
      this.setupScheduledReports();
    }
  }

  /**
   * ✅ ตั้งค่ารายงานอัตโนมัติ
   */
  setupScheduledReports() {
    // รายงานประจำวัน
    if (config.DAILY_REPORT_ENABLED) {
      const [hour, minute] = config.AUTO_REPORT_TIME.split(':');
      const dailyJob = schedule.scheduleJob(`${minute} ${hour} * * *`, async () => {
        await this.sendDailySummaryReport();
      });
      this.scheduledJobs.set('dailyReport', dailyJob);
      console.log(`📅 Daily report scheduled at ${config.AUTO_REPORT_TIME}`);
    }

    // รายงานประจำสัปดาห์ (วันจันทร์ 08:00)
    if (config.WEEKLY_REPORT_ENABLED) {
      const [hour, minute] = config.AUTO_REPORT_TIME.split(':');
      const weeklyJob = schedule.scheduleJob(`${minute} ${hour} * * 1`, async () => {
        await this.sendWeeklySummaryReport();
      });
      this.scheduledJobs.set('weeklyReport', weeklyJob);
      console.log(`📅 Weekly report scheduled for Mondays at ${config.AUTO_REPORT_TIME}`);
    }

    // รายงานประจำเดือน (วันที่ 1 ของเดือน 08:00)
    if (config.MONTHLY_REPORT_ENABLED) {
      const [hour, minute] = config.AUTO_REPORT_TIME.split(':');
      const monthlyJob = schedule.scheduleJob(`${minute} ${hour} 1 * *`, async () => {
        await this.sendMonthlySummaryReport();
      });
      this.scheduledJobs.set('monthlyReport', monthlyJob);
      console.log(`📅 Monthly report scheduled for 1st of each month at ${config.AUTO_REPORT_TIME}`);
    }
  }

  /**
   * ✅ ส่งรายงานสรุปประจำวัน
   */
  async sendDailySummaryReport() {
    try {
      console.log('📊 Sending daily summary report...');
      
      const reportMessage = await lookerStudioService.createDashboardSummaryReport('daily');
      const result = await this.sendTelegramNotification(reportMessage, true);
      
      if (result.success) {
        console.log('✅ Daily summary report sent successfully');
      } else {
        console.error('❌ Failed to send daily summary report:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending daily summary report:', error);
    }
  }

  /**
   * ✅ ส่งรายงานสรุปประจำสัปดาห์
   */
  async sendWeeklySummaryReport() {
    try {
      console.log('📊 Sending weekly summary report...');
      
      const reportMessage = await lookerStudioService.createDashboardSummaryReport('weekly');
      const result = await this.sendTelegramNotification(reportMessage, true);
      
      if (result.success) {
        console.log('✅ Weekly summary report sent successfully');
      } else {
        console.error('❌ Failed to send weekly summary report:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending weekly summary report:', error);
    }
  }

  /**
   * ✅ ส่งรายงานสรุปประจำเดือน
   */
  async sendMonthlySummaryReport() {
    try {
      console.log('📊 Sending monthly summary report...');
      
      const reportMessage = await lookerStudioService.createDashboardSummaryReport('monthly');
      const result = await this.sendTelegramNotification(reportMessage, true);
      
      if (result.success) {
        console.log('✅ Monthly summary report sent successfully');
      } else {
        console.error('❌ Failed to send monthly summary report:', result.error);
      }
    } catch (error) {
      console.error('❌ Error sending monthly summary report:', error);
    }
  }

  /**
   * ✅ ส่งแจ้งเตือนคำขอใหม่
   */
  async sendNewRequestNotification(requestData) {
    try {
      const message = lookerStudioService.createNewRequestNotificationWithDashboard(requestData);
      const result = await this.sendTelegramNotification(message, true);
      
      if (result.success) {
        console.log(`✅ New request notification sent for ${requestData.requestId}`);
      } else {
        console.error(`❌ Failed to send new request notification for ${requestData.requestId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error sending new request notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ส่งแจ้งเตือนอัปเดตสถานะ
   */
  async sendStatusUpdateNotification(requestData, newStatus, technicianNotes) {
    try {
      const message = lookerStudioService.createStatusUpdateNotificationWithDashboard(
        requestData, 
        newStatus, 
        technicianNotes
      );
      const result = await this.sendTelegramNotification(message, true);
      
      if (result.success) {
        console.log(`✅ Status update notification sent for ${requestData.REQUEST_ID}`);
      } else {
        console.error(`❌ Failed to send status update notification for ${requestData.REQUEST_ID}:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error sending status update notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ส่งแจ้งเตือนแบบ Custom
   */
  async sendCustomNotification(message, includeDashboard = false, dashboardType = 'general', includeLoginLink = false) {
    try {
      let finalMessage = message;
      
      if (includeDashboard && lookerStudioService.isEnabled) {
        finalMessage = lookerStudioService.createTelegramMessageWithDashboard(message, dashboardType);
      }
      
      const result = await this.sendTelegramNotification(finalMessage, includeLoginLink);
      return result;
    } catch (error) {
      console.error('❌ Error sending custom notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ส่งแจ้งเตือนผ่าน Telegram
   */
  async sendTelegramNotification(message, includeLoginLink = false) {
    try {
      const telegramConfig = await googleSheetsService.getTelegramConfig();
      
      if (!telegramConfig || !telegramConfig.isEnabled) {
        console.log('📱 Telegram notifications are disabled.');
        return { success: false, reason: 'disabled' };
      }

      if (!telegramConfig.botToken || !telegramConfig.chatId) {
        console.warn('⚠️ Telegram notifications are enabled, but Bot Token or Chat ID is missing.');
        return { success: false, reason: 'missing_config' };
      }

      let finalMessage = message;
      if (includeLoginLink) {
        const loginUrl = `${config.BASE_URL}/admin/smart-login.html`;
        finalMessage += `\n\n🔗 [เข้าสู่ระบบจัดการ](${loginUrl})`;
      }

      // ตรวจสอบความยาวข้อความ (Telegram limit ~4096 characters)
      if (finalMessage.length > 4000) {
        finalMessage = finalMessage.substring(0, 3900) + '\n\n... (ข้อความถูกตัดทอนเนื่องจากยาวเกินไป)';
      }

      const telegramApiUrl = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
      
      const response = await axios.post(telegramApiUrl, {
        chat_id: telegramConfig.chatId,
        text: finalMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.ok) {
        console.log(`✅ Telegram notification sent successfully`);
        return { success: true, messageId: response.data.result.message_id };
      } else {
        console.error('❌ Telegram API returned error:', JSON.stringify(response.data, null, 2));
        return { success: false, error: response.data };
      }
    } catch (error) {
      console.error('❌ Error sending Telegram notification:', error.message);
      if (error.response && error.response.data) {
        console.error('❌ Telegram API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ทดสอบการส่งแจ้งเตือน Telegram
   */
  async testTelegramNotification(botToken, chatId) {
    try {
      const testMessage = lookerStudioService.createTelegramMessageWithDashboard(
        `🔧 *ทดสอบการแจ้งเตือน Telegram*\n\nระบบแจ้งซ่อมไฟฟ้า ${config.ORG_NAME}\n⏰ ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`,
        'general'
      );
      
      const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      const response = await axios.post(telegramApiUrl, {
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data && response.data.ok;
    } catch (error) {
      console.error('Test Telegram notification failed:', error.message);
      return false;
    }
  }

  /**
   * ✅ ส่งรายงานสรุปตามคำขอ
   */
  async sendOnDemandReport(reportType, filters = {}) {
    try {
      let message = '';
      let dashboardType = 'general';

      switch (reportType) {
        case 'pending':
          const pendingRequests = await googleSheetsService.getAllRepairRequests({ filterByStatus: 'รอดำเนินการ' });
          message = `⏳ *รายการรอดำเนินการ*\n\n📊 จำนวน: ${pendingRequests.length} รายการ\n⏰ ณ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`;
          dashboardType = 'pending';
          break;

        case 'inProgress':
          const inProgressRequests = await googleSheetsService.getAllRepairRequests({ filterByStatus: 'กำลังดำเนินการ' });
          message = `🔧 *รายการกำลังดำเนินการ*\n\n📊 จำนวน: ${inProgressRequests.length} รายการ\n⏰ ณ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`;
          dashboardType = 'inProgress';
          break;

        case 'completed':
          const completedRequests = await googleSheetsService.getAllRepairRequests({ filterByStatus: 'เสร็จสิ้น' });
          message = `✅ *รายการเสร็จสิ้น*\n\n📊 จำนวน: ${completedRequests.length} รายการ\n⏰ ณ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`;
          dashboardType = 'completed';
          break;

        case 'summary':
          return await this.sendDailySummaryReport();

        default:
          message = `📊 *รายงานข้อมูลทั่วไป*\n\n⏰ ณ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`;
          dashboardType = 'general';
      }

      const finalMessage = lookerStudioService.createTelegramMessageWithDashboard(message, dashboardType, filters);
      return await this.sendTelegramNotification(finalMessage, true);
    } catch (error) {
      console.error('❌ Error sending on-demand report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ✅ ระงับงาน Scheduled Reports
   */
  pauseScheduledReports() {
    this.scheduledJobs.forEach((job, name) => {
      if (job) {
        job.cancel();
        console.log(`⏸️ Paused scheduled job: ${name}`);
      }
    });
  }

  /**
   * ✅ เริ่มงาน Scheduled Reports ใหม่
   */
  resumeScheduledReports() {
    this.pauseScheduledReports();
    this.scheduledJobs.clear();
    if (config.AUTO_REPORT_ENABLED) {
      this.setupScheduledReports();
      console.log('▶️ Resumed scheduled reports');
    }
  }

  /**
   * ✅ ปิดระบบ
   */
  shutdown() {
    console.log('🛑 Shutting down Notification Service...');
    this.pauseScheduledReports();
    this.scheduledJobs.clear();
  }

  /**
   * ✅ Health Check
   */
  healthCheck() {
    const activeJobs = Array.from(this.scheduledJobs.keys());
    return {
      autoReportEnabled: config.AUTO_REPORT_ENABLED,
      activeJobs: activeJobs,
      lookerStudioIntegration: lookerStudioService.healthCheck()
    };
  }
}

module.exports = new NotificationService();