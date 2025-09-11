// services/lookerStudioService.js - ✅ เพิ่มฟีเจอร์การพิมพ์และแสดงตัวอย่าง
const config = require('../config/config');
const googleSheetsService = require('./googleSheets');

class LookerStudioService {
  constructor() {
    this.dashboardUrl = config.LOOKER_STUDIO_DASHBOARD_URL;
    this.embedUrl = config.LOOKER_STUDIO_EMBED_URL;
    this.isEnabled = config.ENABLE_LOOKER_INTEGRATION;
  }

  /**
   * ✅ สร้าง URL สำหรับ Dashboard (แบบง่าย ไม่มี parameters)
   */
  createDashboardUrl(filters = {}) {
    if (!this.isEnabled || !this.dashboardUrl) {
      return null;
    }

    // ส่งคืน URL พื้นฐานโดยไม่เพิ่ม parameters
    return this.dashboardUrl;
  }

  /**
   * ✅ สร้าง URL สำหรับ Embed Dashboard (แบบง่าย)
   */
  createEmbedUrl(filters = {}) {
    if (!this.isEnabled || !this.embedUrl) {
      return this.createDashboardUrl(filters);
    }

    // ส่งคืน URL พื้นฐานโดยไม่เพิ่ม parameters
    return this.embedUrl;
  }

  /**
   * 🆕 สร้าง URL สำหรับ Print Preview
   */
  createPrintPreviewUrl(filters = {}) {
    if (!this.isEnabled || !this.dashboardUrl) {
      return null;
    }

    let url = this.dashboardUrl;
    const params = new URLSearchParams();

    // เพิ่มการตั้งค่าสำหรับ print
    params.append('print', 'true');
    params.append('format', 'pdf');
    params.append('size', 'A4');
    params.append('orientation', 'portrait');
    params.append('scale', '0.8');

    // เพิ่ม filters
    if (filters.dateFrom) {
      params.append('config', JSON.stringify({
        'df146': `${filters.dateFrom}`,
        'df147': `${filters.dateTo || filters.dateFrom}`
      }));
    }

    if (filters.status) {
      params.append('filter', `status:${filters.status}`);
    }

    if (filters.requestId) {
      params.append('filter', `request_id:${filters.requestId}`);
    }

    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    return url;
  }

  /**
   * 🆕 สร้าง URL สำหรับการพิมพ์โดยตรง
   */
  createDirectPrintUrl(filters = {}, options = {}) {
    if (!this.isEnabled || !this.dashboardUrl) {
      return null;
    }

    const printOptions = {
      format: options.format || 'pdf',
      size: options.size || 'A4',
      orientation: options.orientation || 'portrait',
      scale: options.scale || '0.8',
      download: options.download !== false ? 'true' : 'false',
      filename: options.filename || `รายงานแจ้งซ่อมไฟฟ้า_${new Date().toISOString().split('T')[0]}`
    };

    let url = this.dashboardUrl;
    const params = new URLSearchParams();

    // เพิ่มการตั้งค่าการพิมพ์
    Object.entries(printOptions).forEach(([key, value]) => {
      params.append(key, value);
    });

    // เพิ่ม filters
    if (filters.dateFrom) {
      params.append('config', JSON.stringify({
        'df146': `${filters.dateFrom}`,
        'df147': `${filters.dateTo || filters.dateFrom}`
      }));
    }

    if (filters.status) {
      params.append('filter', `status:${filters.status}`);
    }

    if (filters.requestId) {
      params.append('filter', `request_id:${filters.requestId}`);
    }

    // เพิ่ม action สำหรับการพิมพ์
    params.append('action', 'export');

    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    return url;
  }

  /**
   * 🆕 สร้าง URL สำหรับตัวอย่างเอกสารก่อนพิมพ์
   */
  createDocumentPreviewUrl(filters = {}, options = {}) {
    const previewOptions = {
      view: 'preview',
      toolbar: 'true',
      zoom: options.zoom || '100',
      ...options
    };

    let url = this.createEmbedUrl(filters);
    if (!url) return null;

    const params = new URLSearchParams();
    Object.entries(previewOptions).forEach(([key, value]) => {
      params.append(key, value);
    });

    url += (url.includes('?') ? '&' : '?') + params.toString();
    return url;
  }

  /**
   * 🆕 สร้างข้อมูลสำหรับ Print Modal ใน Admin Dashboard
   */
  createPrintModalData(type = 'general', filters = {}) {
    const reportConfigs = {
      general: {
        title: 'รายงานทั่วไป - ภาพรวมระบบแจ้งซ่อมไฟฟ้า',
        description: 'รายงานสรุปข้อมูลการแจ้งซ่อมไฟฟ้าทั้งหมด',
        icon: '📊'
      },
      today: {
        title: 'รายงานประจำวัน',
        description: `ข้อมูลการแจ้งซ่อมวันที่ ${new Date().toLocaleDateString('th-TH')}`,
        icon: '📈'
      },
      thisWeek: {
        title: 'รายงานประจำสัปดาห์',
        description: 'สรุปข้อมูลการแจ้งซ่อมในสัปดาห์นี้',
        icon: '📅'
      },
      thisMonth: {
        title: 'รายงานประจำเดือน',
        description: 'รายงานสรุปการแจ้งซ่อมประจำเดือน',
        icon: '📆'
      },
      pending: {
        title: 'รายการรอดำเนินการ',
        description: 'รายการแจ้งซ่อมที่ยังไม่ได้ดำเนินการ',
        icon: '⏳'
      },
      inProgress: {
        title: 'รายการกำลังดำเนินการ',
        description: 'รายการแจ้งซ่อมที่อยู่ระหว่างการซ่อมแซม',
        icon: '🔧'
      },
      completed: {
        title: 'รายการเสร็จสิ้น',
        description: 'รายการแจ้งซ่อมที่ดำเนินการเสร็จสิ้นแล้ว',
        icon: '✅'
      },
      custom: {
        title: 'รายงานกำหนดเอง',
        description: 'รายงานตามเงื่อนไขที่กำหนด',
        icon: '🎯'
      }
    };

    const config = reportConfigs[type] || reportConfigs.general;

    return {
      ...config,
      embedUrl: this.createEmbedUrl(filters),
      previewUrl: this.createDocumentPreviewUrl(filters),
      printUrl: this.createDirectPrintUrl(filters),
      printPreviewUrl: this.createPrintPreviewUrl(filters),
      filters: filters,
      isEnabled: this.isEnabled
    };
  }

  /**
   * ✅ สร้างลิงก์ Dashboard สำหรับ Telegram (แบบง่าย)
   */
  getDashboardLinkForTelegram(type = 'general', filters = {}) {
    // ส่งคืน URL พื้นฐานเดียวกันทุกประเภท
    return this.createDashboardUrl();
  }

  /**
   * 🆕 สร้าง Print Instructions สำหรับ Admin
   */
  createPrintInstructions() {
    return {
      steps: [
        '🖱️ คลิกปุ่ม "ดูตัวอย่าง" เพื่อดูรายงานก่อนพิมพ์',
        '📋 ตรวจสอบข้อมูลในรายงานให้ถูกต้อง',
        '🖨️ คลิกปุ่ม "พิมพ์" หรือใช้ Ctrl+P',
        '⚙️ เลือกเครื่องพิมพ์และการตั้งค่า',
        '✅ กดพิมพ์เพื่อออกเอกสาร'
      ],
      tips: [
        '💡 ใช้ Chrome หรือ Edge สำหรับผลลัพธ์ที่ดีที่สุด',
        '📄 แนะนำให้ใช้กระดาษ A4 แนวตั้ง',
        '🎨 ตั้งค่า "พิมพ์สี" หากต้องการกราฟสีสัน',
        '💾 สามารถ "บันทึกเป็น PDF" แทนการพิมพ์ได้'
      ],
      troubleshooting: [
        {
          problem: 'รายงานไม่แสดงข้อมูล',
          solution: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและรีเฟรชหน้า'
        },
        {
          problem: 'การพิมพ์ไม่ครบหน้า',
          solution: 'ตรวจสอบการตั้งค่า "พิมพ์พื้นหลัง" ในเบราว์เซอร์'
        },
        {
          problem: 'ข้อมูลไม่ถูกต้อง',
          solution: 'รีเฟรชข้อมูลและตรวจสอบตัวกรองที่ตั้งไว้'
        }
      ]
    };
  }

  /**
   * ✅ สร้างข้อความ Telegram พร้อมลิงก์ Dashboard
   */
  createTelegramMessageWithDashboard(message, dashboardType = 'general', filters = {}) {
    if (!this.isEnabled) {
      return message;
    }

    const dashboardUrl = this.getDashboardLinkForTelegram(dashboardType, filters);
    if (!dashboardUrl) {
      return message;
    }

    const dashboardTexts = {
      general: '📊 ดูข้อมูลทั้งหมด',
      today: '📈 ข้อมูลวันนี้',
      thisWeek: '📈 ข้อมูลสัปดาห์นี้',
      thisMonth: '📈 ข้อมูลเดือนนี้',
      pending: '⏳ รายการรอดำเนินการ',
      inProgress: '🔧 รายการกำลังดำเนินการ',
      completed: '✅ รายการเสร็จสิ้น',
      custom: '📊 ดูรายงาน'
    };

    const linkText = dashboardTexts[dashboardType] || dashboardTexts.general;

    return `${message}

🔗 [${linkText}](${dashboardUrl})`;
  }

  /**
   * ✅ สร้างรายงานสรุปพร้อมลิงก์ Dashboard
   */
  async createDashboardSummaryReport(type = 'daily') {
    try {
      const summary = await googleSheetsService.getRepairRequestsSummary();
      const today = new Date().toLocaleDateString('th-TH');
      
      let reportMessage = '';
      let dashboardType = 'general';

      switch (type) {
        case 'daily':
          reportMessage = `📊 *รายงานสรุปประจำวัน*
📅 วันที่: ${today}

📋 สรุปข้อมูล:
• รายการทั้งหมด: ${summary.total} รายการ
• รอดำเนินการ: ${summary.pending} รายการ
• กำลังดำเนินการ: ${summary.inProgress} รายการ
• เสร็จสิ้น: ${summary.completed} รายการ
• ยกเลิก: ${summary.cancelled} รายการ`;
          dashboardType = 'today';
          break;

        case 'weekly':
          reportMessage = `📊 *รายงานสรุปประจำสัปดาห์*
📅 ประจำสัปดาห์ที่ ${this.getWeekNumber()}

📋 สรุปข้อมูล:
• รายการทั้งหมด: ${summary.total} รายการ
• รอดำเนินการ: ${summary.pending} รายการ
• กำลังดำเนินการ: ${summary.inProgress} รายการ
• เสร็จสิ้น: ${summary.completed} รายการ`;
          dashboardType = 'thisWeek';
          break;

        case 'monthly':
          const monthName = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
          reportMessage = `📊 *รายงานสรุปประจำเดือน*
📅 เดือน ${monthName}

📋 สรุปข้อมูล:
• รายการทั้งหมด: ${summary.total} รายการ
• รอดำเนินการ: ${summary.pending} รายการ
• กำลังดำเนินการ: ${summary.inProgress} รายการ
• เสร็จสิ้น: ${summary.completed} รายการ`;
          dashboardType = 'thisMonth';
          break;
      }

      return this.createTelegramMessageWithDashboard(reportMessage, dashboardType);
    } catch (error) {
      console.error('Error creating dashboard summary report:', error);
      return `❌ เกิดข้อผิดพลาดในการสร้างรายงาน: ${error.message}`;
    }
  }

  /**
   * ✅ สร้างข้อความแจ้งเตือนใหม่พร้อม Dashboard link และ Print link
   */
  createNewRequestNotificationWithDashboard(requestData) {
    const baseMessage = this.formatNewRequestMessage(requestData);
    const messageWithDashboard = this.createTelegramMessageWithDashboard(baseMessage, 'today');
    
    // เพิ่มลิงค์พิมพ์รายงานโดยตรง
    const printUrl = this.dashboardUrl; // ใช้ URL ที่กำหนดใน .env
    if (printUrl && this.isEnabled) {
      return `${messageWithDashboard}

🖨️ [พิมพ์รายงานคำขอ](${printUrl})`;
    }
    
    return messageWithDashboard;
  }

  /**
   * ✅ สร้างข้อความอัปเดตสถานะพร้อม Dashboard link และ Print link
   */
  createStatusUpdateNotificationWithDashboard(requestData, newStatus, technicianNotes) {
    const baseMessage = this.formatStatusUpdateMessage(requestData, newStatus, technicianNotes);
    const dashboardType = this.getDashboardTypeByStatus(newStatus);
    const messageWithDashboard = this.createTelegramMessageWithDashboard(baseMessage, dashboardType);
    
    // เพิ่มลิงค์พิมพ์รายงานสำหรับคำขอเฉพาะ
    const printUrl = this.dashboardUrl;
    if (printUrl && this.isEnabled) {
      return `${messageWithDashboard}

🖨️ [พิมพ์รายงานคำขอ](${printUrl})`;
    }
    
    return messageWithDashboard;
  }

  /**
   * ✅ Helper functions
   */
  formatNewRequestMessage(requestData) {
    const personalInfo = requestData.personalDetails ? 
      `👤 ผู้แจ้ง: ${this.escapeMarkdown(requestData.personalDetails.prefix || '')}${this.escapeMarkdown(requestData.personalDetails.firstName || '')} ${this.escapeMarkdown(requestData.personalDetails.lastName || '')} (${this.escapeMarkdown(requestData.lineDisplayName)})
📱 เบอร์โทร: ${this.escapeMarkdown(requestData.personalDetails.phone || 'ไม่ระบุ')}
🎂 อายุ: ${requestData.personalDetails.age ? `${this.escapeMarkdown(requestData.personalDetails.age)} ปี` : 'ไม่ระบุ'}
🌏 เชื้อชาติ: ${this.escapeMarkdown(requestData.personalDetails.ethnicity || 'ไม่ระบุ')}
🏳️ สัญชาติ: ${this.escapeMarkdown(requestData.personalDetails.nationality || 'ไม่ระบุ')}
🏠 ที่อยู่: ${requestData.personalDetails.houseNo ? `บ้านเลขที่ ${this.escapeMarkdown(requestData.personalDetails.houseNo)}, ${this.escapeMarkdown(requestData.personalDetails.moo)}` : 'ไม่ระบุ'}` :
      `👤 ผู้แจ้ง: ${this.escapeMarkdown(requestData.lineDisplayName)} (ยังไม่มีข้อมูลส่วนตัว)`;

    return `🆕 *คำขอแจ้งซ่อมใหม่*

🎫 เลขที่: *${this.escapeMarkdown(requestData.requestId)}*
${personalInfo}
🗼 รหัสเสา: ${this.escapeMarkdown(requestData.poleId || 'ไม่ระบุ')}
📍 พิกัด: ${requestData.latitude && requestData.longitude ? `${requestData.latitude}, ${requestData.longitude}` : 'ไม่ระบุ'}
⚠️ ปัญหา: ${this.escapeMarkdown(requestData.problemDescription)}
📸 รูปภาพ: ${requestData.photoBase64 ? 'มี' : 'ไม่มี'}

📅 วันที่แจ้ง: ${this.escapeMarkdown(requestData.dateReported)}`;
  }

  formatStatusUpdateMessage(requestData, newStatus, technicianNotes) {
    const statusEmoji = {
      'รอดำเนินการ': '⏳',
      'อนุมัติแล้วรอช่าง': '✅',
      'กำลังดำเนินการ': '🔧',
      'เสร็จสิ้น': '✅',
      'ไม่อนุมัติโดยผู้บริหาร': '❌',
      'ยกเลิก': '🚫'
    };

    const safePersonName = `${this.escapeMarkdown(requestData.TITLE_PREFIX || '')}${this.escapeMarkdown(requestData.FIRST_NAME || '')} ${this.escapeMarkdown(requestData.LAST_NAME || '')}`.trim();
    const safePhone = this.escapeMarkdown(requestData.PHONE || 'ไม่ระบุ');
    const safeHouseAddress = requestData.HOUSE_NO ? 
        `บ้านเลขที่ ${this.escapeMarkdown(requestData.HOUSE_NO)}, หมู่ ${this.escapeMarkdown(requestData.MOO)}` : 
        'ไม่ระบุ';
    const safePoleId = this.escapeMarkdown(requestData.POLE_ID || 'ไม่ระบุ');
    const safeStatus = this.escapeMarkdown(newStatus);
    const safeRequestId = this.escapeMarkdown(requestData.REQUEST_ID);
    const safeTechnicianNotes = technicianNotes ? this.escapeMarkdown(technicianNotes) : '';

    return `${statusEmoji[newStatus] || '🔄'} *อัปเดตสถานะคำขอแจ้งซ่อม*

🎫 เลขที่: *${safeRequestId}*
👤 ผู้แจ้ง: ${safePersonName}
📱 เบอร์โทร: ${safePhone}
🏠 ที่อยู่: ${safeHouseAddress}
🗼 รหัสเสา: ${safePoleId}

📊 สถานะใหม่: *${safeStatus}*
${safeTechnicianNotes ? `📝 หมายเหตุ: ${safeTechnicianNotes}\n` : ''}
📅 เวลาอัปเดต: ${new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE })}`;
  }

  getDashboardTypeByStatus(status) {
    const statusMapping = {
      'รอดำเนินการ': 'pending',
      'อนุมัติแล้วรอช่าง': 'pending',
      'กำลังดำเนินการ': 'inProgress',
      'เสร็จสิ้น': 'completed',
      'ไม่อนุมัติโดยผู้บริหาร': 'pending',
      'ยกเลิก': 'general'
    };
    return statusMapping[status] || 'general';
  }

  escapeMarkdown(text) {
    if (!text || typeof text !== 'string') return 'ไม่ระบุ';
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  getWeekStart() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }

  getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  }

  /**
   * ✅ Health Check
   */
  healthCheck() {
    return {
      isEnabled: this.isEnabled,
      dashboardUrl: this.dashboardUrl ? '✅ มี' : '❌ ไม่มี',
      embedUrl: this.embedUrl ? '✅ มี' : '❌ ไม่มี',
      printingSupported: this.isEnabled && (this.dashboardUrl || this.embedUrl) ? '✅ รองรับ' : '❌ ไม่รองรับ',
      features: {
        dashboard: '✅ ดู Dashboard',
        embed: '✅ ฝังใน Admin',
        print: '✅ พิมพ์เอกสาร',
        preview: '✅ ตัวอย่างก่อนพิมพ์',
        telegram: '✅ แชร์ผ่าน Telegram'
      }
    };
  }
}

module.exports = new LookerStudioService();