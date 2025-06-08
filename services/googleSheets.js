// googleSheets.js (ปรับปรุงแล้วรองรับฟอร์มใหม่ + ข้อมูลเพิ่มเติม + ระบบ Request ID ใหม่)
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config/config');

class GoogleSheetsService {
  constructor() {
    this.doc = null;
    this.isAuthenticated = false;
    this.POLE_DATA_SHEET_NAME = config.POLE_DATA_SHEET_NAME;
    this.INVENTORY_SHEET_NAME = config.INVENTORY_SHEET_NAME;
    this.ADMIN_USERS_SHEET_NAME = config.ADMIN_USERS_SHEET_NAME;
    this.TELEGRAM_CONFIG_SHEET_NAME = config.TELEGRAM_CONFIG_SHEET_NAME;
    this.SYSTEM_CONFIG_SHEET_NAME = 'System_Config'; // เพิ่มใหม่

    this.columnMappings = {
      [config.LINE_USER_PROFILE_SHEET_NAME]: {
        TIMESTAMP: 'Timestamp',
        LINE_ID: 'Line ID',
        DISPLAY_NAME: 'Display Name',
        PREFIX: 'คำนำหน้าชื่อ',
        FIRST_NAME: 'ชื่อจริง',
        LAST_NAME: 'นามสกุลจริง',
        AGE: 'อายุ',
        ETHNICITY: 'เชื้อชาติ',
        NATIONALITY: 'สัญชาติ',
        PHONE: 'เบอร์โทรศัพท์',
        HOUSE_NO: 'บ้านเลขที่',
        MOO: 'หมู่ที่',
        LAST_ACTIVE: 'Last Active Update'
      },
      [config.REPAIR_REQUESTS_SHEET_NAME]: {
        DATE_REPORTED: 'ประทับเวลา',
        REQUEST_ID: 'เลขรับแจ้ง',
        LINE_USER_ID: 'LINE User ID',
        LINE_DISPLAY_NAME: 'Line name',
        TITLE_PREFIX: 'คำนำหน้า',
        FIRST_NAME: 'ชื่อ',
        LAST_NAME: 'นามสกุล',
        AGE: 'อายุ',
        ETHNICITY: 'เชื้อชาติ',
        NATIONALITY: 'สัญชาติ',
        PHONE: 'เบอร์โทรติดต่อ',
        HOUSE_NO: 'บ้านเลขที่',
        MOO: 'หมู่ที่',
        POLE_ID: 'หมายเลขรหัสเสาไฟฟ้า',
        REASON: 'สาเหตุไฟฟ้าส่องสว่างชำรุดเนื่องจาก...',
        PHOTO_MESSAGE_ID: 'ID ของรูปภาพ ถ้ามี',
        STATUS: 'สถานะ',
        TECHNICIAN_NOTES: 'หมายเหตุช่าง',
        CONFIRMATION_CSV: 'ข้าพเจ้าขอยืนยันว่าข้อมูลที่ได้แจ้งเป็นความจริง หากมีการแจ้งที่เป็นเท็จ จะมีการดำเนินคดีตามกฏหมายว่าด้วยการแจ้งความที่เป็นเท๊จ',
        SATISFACTION_CSV: 'กรุณาประเมินความพึงพอใจในการใช้บริการ',
        EXECUTIVE_SIGNATURE_URL: 'URL ลายเซ็นผู้บริหาร',
        APPROVED_BY: 'ผู้อนุมัติ',
        APPROVAL_TIMESTAMP: 'วันที่อนุมัติ',
        LATITUDE: 'พิกัดละติจูด',
        LONGITUDE: 'พิกัดลองจิจูด',
        PHOTO_BASE64: 'รูปภาพ Base64',
        FORM_TYPE: 'ประเภทการแจ้ง'
      },
      [this.POLE_DATA_SHEET_NAME]: {
        POLE_ID_HEADER: 'รหัสเสาไฟฟ้า',
        VILLAGE_HEADER: 'หมู่บ้าน',
        POLE_TYPE_HEADER: 'ประเภทเสาไฟฟ้า',
        POLE_SUBTYPE_HEADER: 'ชนิดเสาไฟฟ้า',
        LATITUDE_HEADER: 'พิกัด ละติจูด',
        LONGITUDE_HEADER: 'พิกัด ลองติจูด',
        LAMP_TYPE_HEADER: 'ชนิดหลอด',
        WATTAGE_HEADER: 'ขนาดวัตต์',
        INSTALL_DATE_HEADER: 'วันที่ติดตั้ง',
        INSTALL_COMPANY_HEADER: 'บริษัทผู้ติดตั้ง',
        NOTES_HEADER: 'หมายเหตุ',
        QR_CODE_HEADER: 'QR Code'
      },
      [this.INVENTORY_SHEET_NAME]: {
        ITEM_NAME: 'รายการ',
        UNIT: 'หน่วย',
        FISCAL_YEAR: 'ปีงบประมาณ',
        PRICE_PER_UNIT: 'ราคา/หน่วย',
        TOTAL_QUANTITY: 'จำนวนทั้งหมด',
        ADDED_QUANTITY: 'จำนวนเพิ่มอุปกรณ์',
        USED_QUANTITY: 'จำนวนการเบิก',
        CURRENT_STOCK: 'จำนวนคงเหลือ',
        TOTAL_PRICE: 'ราคารวม'
      },
      [this.ADMIN_USERS_SHEET_NAME]: {
        USERNAME: 'Username',
        PASSWORD_HASH: 'PasswordHash',
        ROLE: 'Role',
        FULL_NAME: 'FullName',
        EMAIL: 'Email',
        IS_ACTIVE: 'IsActive',
        LAST_LOGIN: 'LastLogin',
        CREATED_AT: 'CreatedAt'
      },
      [this.TELEGRAM_CONFIG_SHEET_NAME]: {
        CONFIG_KEY: 'ConfigKey',
        BOT_TOKEN: 'BotToken',
        CHAT_ID: 'ChatID',
        IS_ENABLED: 'IsEnabled'
      },
      [this.SYSTEM_CONFIG_SHEET_NAME]: {
        COUNTER_TYPE: 'Counter_Type',
        PERIOD: 'Period',
        VALUE: 'Value'
      }
    };
  }

  async authenticate() {
    if (this.isAuthenticated) {
      return;
    }
    try {
      if (!config.GOOGLE_SERVICE_ACCOUNT_EMAIL || !config.GOOGLE_PRIVATE_KEY || !config.SPREADSHEET_ID) {
        throw new Error('Google Sheets credentials or Spreadsheet ID are not configured in .env file.');
      }
      const serviceAccountAuth = new JWT({
        email: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: config.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.doc = new GoogleSpreadsheet(config.SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      this.isAuthenticated = true;
      console.log('✅ Google Sheets authenticated and document loaded successfully.');
    } catch (error) {
      console.error('❌ Google Sheets authentication or document loading failed:', error.message);
      throw new Error(`Failed to connect to Google Sheets: ${error.message}`);
    }
  }

  // ===== ระบบ Request ID ใหม่ =====

  /**
   * สร้าง Request ID ในรูปแบบ YYMM-NNN
   * เช่น 2506-001, 2506-002, 2507-001
   */
async generateRequestId() {
    try {
      const now = new Date();
      const year = now.getFullYear();  // ← แก้ตรงนี้
      const yearShort = year.toString().slice(-2); // เอา 2 หลักท้าย
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const period = `${yearShort}${month}`; // เช่น "2506"

      const counter = await this.getNextRequestCounter(period);
      const requestId = `${period}-${counter.toString().padStart(3, '0')}`;
      
      console.log(`✅ Generated new Request ID: ${requestId}`);
      return requestId;
    } catch (error) {
      console.error('❌ Error generating request ID:', error.message);
      // Fallback ใช้เวลา timestamp
      const timestamp = Date.now().toString().slice(-6);
      return `REQ-${timestamp}`;
    }
  }

  /**
   * ดึงหมายเลขถัดไปสำหรับเดือนนั้นๆ
   */
  async getNextRequestCounter(period) {
    try {
      const currentCounter = await this.getSystemCounter('REQUEST_ID', period);
      const nextCounter = currentCounter + 1;
      await this.setSystemCounter('REQUEST_ID', nextCounter, period);
      return nextCounter;
    } catch (error) {
      console.error('❌ Error getting next request counter:', error.message);
      return 1; // ค่าเริ่มต้น
    }
  }

  /**
   * อ่านค่า counter จาก System_Config sheet
   */
  async getSystemCounter(counterType, period) {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];

      for (const row of rows) {
        if (row.get(mapping.COUNTER_TYPE) === counterType && 
            row.get(mapping.PERIOD) === period) {
          const value = parseInt(row.get(mapping.VALUE)) || 0;
          return value;
        }
      }
      return 0; // ไม่พบข้อมูล
    } catch (error) {
      console.error('❌ Error reading system counter:', error.message);
      return 0;
    }
  }

  /**
   * บันทึกค่า counter ลง System_Config sheet
   */
  async setSystemCounter(counterType, value, period) {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];

      // หาแถวที่ตรงกับ counterType และ period
      let existingRow = null;
      for (const row of rows) {
        if (row.get(mapping.COUNTER_TYPE) === counterType && 
            row.get(mapping.PERIOD) === period) {
          existingRow = row;
          break;
        }
      }

      if (existingRow) {
        // อัปเดตแถวที่มีอยู่
        existingRow.set(mapping.VALUE, value);
        await existingRow.save();
      } else {
        // เพิ่มแถวใหม่
        const newRowData = {
          [mapping.COUNTER_TYPE]: counterType,
          [mapping.PERIOD]: period,
          [mapping.VALUE]: value
        };
        await sheet.addRow(newRowData);
      }

      console.log(`✅ System counter updated: ${counterType}/${period} = ${value}`);
      return true;
    } catch (error) {
      console.error('❌ Error setting system counter:', error.message);
      return false;
    }
  }

  /**
   * ตั้งค่า System_Config sheet ครั้งแรก
   */
  async setupSystemConfigSheet() {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      console.log('✅ System_Config sheet setup complete');
      return true;
    } catch (error) {
      console.error('❌ Error setting up System_Config sheet:', error.message);
      return false;
    }
  }

  /**
   * ทดสอบระบบ Request ID ใหม่
   */
  async testNewRequestIdSystem() {
    console.log('🧪 Testing new request ID system...');
    
    // ทดสอบสร้าง ID หลายตัว
    for (let i = 0; i < 5; i++) {
      const requestId = await this.generateRequestId();
      console.log(`✅ Generated: ${requestId}`);
    }

    // ทดสอบการเปลี่ยนเดือน
    const testMonth = '2507'; // เดือนกรกฎาคม
    const testCounter = await this.getNextRequestCounter(testMonth);
    console.log(`✅ Test July counter: ${testMonth}-${testCounter.toString().padStart(3, '0')}`);
    
    return true;
  }

  // ===== ฟังก์ชันเดิมที่ปรับปรุงแล้ว =====

  async getOrCreateSheet(sheetTitle) {
    await this.authenticate();
    let sheet = this.doc.sheetsByTitle[sheetTitle];
    const expectedHeaders = this.getHeaderRowForSheet(sheetTitle);

    if (!sheet) {
      console.log(`Sheet "${sheetTitle}" not found, creating new sheet...`);
      if (!expectedHeaders || expectedHeaders.length === 0) {
          console.warn(`⚠️ No headers defined in columnMappings for new sheet "${sheetTitle}". Creating an empty sheet.`);
           sheet = await this.doc.addSheet({ title: sheetTitle });
      } else {
          sheet = await this.doc.addSheet({
            title: sheetTitle,
            headerValues: expectedHeaders
          });
          console.log(`✅ Created new sheet: "${sheetTitle}" with headers:`, JSON.stringify(expectedHeaders));
      }
    } else {
        try {
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];

            if (expectedHeaders && expectedHeaders.length > 0) {
                const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));
                if (missingHeaders.length > 0) {
                    console.warn(`Sheet "${sheetTitle}" is missing expected headers:`, missingHeaders);
                    const updatedHeaders = [...currentHeaders, ...missingHeaders];
                    await sheet.setHeaderRow(updatedHeaders);
                    console.log(`✅ Headers for sheet "${sheetTitle}" updated to include missing ones. Please verify column order if needed.`);
                }
            }
        } catch (e) {
            console.error(`❌ Failed to load or set headers for sheet "${sheetTitle}": ${e.message}. Manual check required.`);
            if (sheet.rowCount === 0 && expectedHeaders && expectedHeaders.length > 0) {
                console.log(`Sheet "${sheetTitle}" is empty. Attempting to set headers.`);
                try {
                    await sheet.setHeaderRow(expectedHeaders);
                    console.log(`✅ Headers set for empty sheet: "${sheetTitle}".`);
                } catch (setErr) {
                    console.error(`❌ Failed to set headers for empty sheet "${sheetTitle}": ${setErr.message}.`);
                }
            }
        }
    }
    return sheet;
  }

  getHeaderRowForSheet(sheetTitle) {
    const mappings = this.columnMappings[sheetTitle];
    return mappings ? Object.values(mappings) : [];
  }

  // ฟังก์ชันใหม่สำหรับบันทึกข้อมูลจากฟอร์ม (ใช้ Request ID แบบใหม่)
async saveRepairRequestFromForm(requestData) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];

      // ใช้ Request ID ที่ส่งมา  ← เพิ่มบรรทัดนี้
      const requestId = requestData.requestId;

      // ดึงข้อมูลส่วนตัวถ้ามี
      const personalDetails = requestData.personalDetails || {};
      const phoneNumber = personalDetails.phone ? String(personalDetails.phone) : '';

      // เตรียมข้อมูลสำหรับบันทึกลง Sheet
      const sheetRowData = {
        [repairSheetMapping.DATE_REPORTED]: requestData.dateReported,
        [repairSheetMapping.REQUEST_ID]: requestId, // ใช้ Request ID แบบใหม่
        [repairSheetMapping.LINE_USER_ID]: requestData.lineUserId,
        [repairSheetMapping.LINE_DISPLAY_NAME]: requestData.lineDisplayName || 'ผู้ใช้ LINE',
        [repairSheetMapping.TITLE_PREFIX]: personalDetails.prefix || '',
        [repairSheetMapping.FIRST_NAME]: personalDetails.firstName || '',
        [repairSheetMapping.LAST_NAME]: personalDetails.lastName || '',
        [repairSheetMapping.AGE]: personalDetails.age || '',
        [repairSheetMapping.ETHNICITY]: personalDetails.ethnicity || '',
        [repairSheetMapping.NATIONALITY]: personalDetails.nationality || '',
        [repairSheetMapping.PHONE]: phoneNumber ? `'${phoneNumber}` : '',
        [repairSheetMapping.HOUSE_NO]: personalDetails.houseNo || '',
        [repairSheetMapping.MOO]: personalDetails.moo || '',
        [repairSheetMapping.POLE_ID]: requestData.poleId || 'ไม่ระบุ',
        [repairSheetMapping.REASON]: requestData.problemDescription,
        [repairSheetMapping.PHOTO_MESSAGE_ID]: '',
        [repairSheetMapping.STATUS]: requestData.status || 'รอดำเนินการ',
        [repairSheetMapping.TECHNICIAN_NOTES]: '',
        [repairSheetMapping.CONFIRMATION_CSV]: 'ยืนยัน (จากฟอร์ม)',
        [repairSheetMapping.SATISFACTION_CSV]: '',
        [repairSheetMapping.EXECUTIVE_SIGNATURE_URL]: '',
        [repairSheetMapping.APPROVED_BY]: '',
        [repairSheetMapping.APPROVAL_TIMESTAMP]: '',
        [repairSheetMapping.LATITUDE]: requestData.latitude || '',
        [repairSheetMapping.LONGITUDE]: requestData.longitude || '',
        [repairSheetMapping.PHOTO_BASE64]: requestData.photoBase64 ? 'มีรูปภาพ' : 'ไม่มีรูปภาพ',
        [repairSheetMapping.FORM_TYPE]: 'FORM'
      };

      await sheet.addRow(sheetRowData);
      console.log(`✅ Repair request from form saved: ${requestId} for user ${requestData.lineUserId}`);
      return { success: true, requestId: requestId };
    } catch (error) {
      console.error(`❌ Error saving repair request from form:`, error.message, error.stack);
      return { success: false, error: error.message };
    }
  }

  // ปรับปรุงฟังก์ชันเดิมให้ใช้ Request ID แบบใหม่
  async saveRepairRequest(repairDataFromBot, userId) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const now = new Date();
      const dateTimeForSheet = now.toLocaleString('th-TH', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false, timeZone: config.TIMEZONE
      });

      // สร้าง Request ID แบบใหม่
      const requestId = await this.generateRequestId();

      const phoneNumber = repairDataFromBot.phone ? String(repairDataFromBot.phone) : '';
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];

      const sheetRowData = {
        [repairSheetMapping.DATE_REPORTED]: dateTimeForSheet,
        [repairSheetMapping.REQUEST_ID]: requestId, // ใช้ Request ID แบบใหม่
        [repairSheetMapping.LINE_USER_ID]: userId,
        [repairSheetMapping.LINE_DISPLAY_NAME]: repairDataFromBot.lineDisplayName || 'N/A',
        [repairSheetMapping.TITLE_PREFIX]: repairDataFromBot.prefix || '',
        [repairSheetMapping.FIRST_NAME]: repairDataFromBot.firstName || '',
        [repairSheetMapping.LAST_NAME]: repairDataFromBot.lastName || '',
        [repairSheetMapping.AGE]: repairDataFromBot.age || '',
        [repairSheetMapping.ETHNICITY]: repairDataFromBot.ethnicity || '',
        [repairSheetMapping.NATIONALITY]: repairDataFromBot.nationality || '',
        [repairSheetMapping.PHONE]: `'${phoneNumber}`,
        [repairSheetMapping.HOUSE_NO]: repairDataFromBot.houseNo || '',
        [repairSheetMapping.MOO]: repairDataFromBot.moo || '',
        [repairSheetMapping.POLE_ID]: repairDataFromBot.poleId || 'ไม่ระบุ',
        [repairSheetMapping.REASON]: repairDataFromBot.reason || '',
        [repairSheetMapping.PHOTO_MESSAGE_ID]: repairDataFromBot.photoMessageId || '',
        [repairSheetMapping.STATUS]: 'รอดำเนินการ',
        [repairSheetMapping.TECHNICIAN_NOTES]: '',
        [repairSheetMapping.CONFIRMATION_CSV]: 'ยืนยัน (จากระบบ)',
        [repairSheetMapping.SATISFACTION_CSV]: '',
        [repairSheetMapping.EXECUTIVE_SIGNATURE_URL]: '',
        [repairSheetMapping.APPROVED_BY]: '',
        [repairSheetMapping.APPROVAL_TIMESTAMP]: '',
        [repairSheetMapping.LATITUDE]: '',
        [repairSheetMapping.LONGITUDE]: '',
        [repairSheetMapping.PHOTO_BASE64]: '',
        [repairSheetMapping.FORM_TYPE]: 'CHAT'
      };

      await sheet.addRow(sheetRowData);
      console.log(`✅ Repair request saved: ${requestId} for user ${userId}`);
      return { success: true, requestId };
    } catch (error) {
      console.error(`❌ Error saving repair request:`, error.message, error.stack);
      return { success: false, error: error.message };
    }
  }

  async saveOrUpdateUserPersonalDetails(userId, personalDataFromBot) {
    try {
      const sheet = await this.getOrCreateSheet(config.LINE_USER_PROFILE_SHEET_NAME);
      const rows = await sheet.getRows();
      const userColHeader = this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].LINE_ID;
      const timestampColHeader = this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].TIMESTAMP;
      const lastActiveColHeader = this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].LAST_ACTIVE;

      let existingRow = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].get(userColHeader) === userId) {
          existingRow = rows[i];
          break;
        }
      }

      const now = new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE });
      const phoneNumber = personalDataFromBot.phone ? String(personalDataFromBot.phone) : '';

      const sheetRowData = {
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].LINE_ID]: userId,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].DISPLAY_NAME]: personalDataFromBot.lineDisplayName || 'N/A',
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].PREFIX]: personalDataFromBot.prefix,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].FIRST_NAME]: personalDataFromBot.firstName,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].LAST_NAME]: personalDataFromBot.lastName,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].AGE]: personalDataFromBot.age || '',
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].ETHNICITY]: personalDataFromBot.ethnicity || '',
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].NATIONALITY]: personalDataFromBot.nationality || '',
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].PHONE]: `'${phoneNumber}`,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].HOUSE_NO]: personalDataFromBot.houseNo,
        [this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].MOO]: personalDataFromBot.moo,
        [lastActiveColHeader]: now
      };

      if (!existingRow) {
        sheetRowData[timestampColHeader] = now;
      }

      if (existingRow) {
        Object.keys(sheetRowData).forEach(headerKey => {
          if (headerKey !== userColHeader) {
            existingRow.set(headerKey, sheetRowData[headerKey]);
          }
        });
        await existingRow.save();
      } else {
        await sheet.addRow(sheetRowData);
      }

      console.log(`✅ User personal details saved/updated for: ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving/updating user personal details for ${userId}:`, error.message, error.stack);
      return false;
    }
  }

  async getUserPersonalDetails(userId) {
    try {
      const sheet = await this.getOrCreateSheet(config.LINE_USER_PROFILE_SHEET_NAME);
      const rows = await sheet.getRows();
      const userColHeader = this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME].LINE_ID;
      const userProfileMapping = this.columnMappings[config.LINE_USER_PROFILE_SHEET_NAME];

      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row.get(userColHeader) === userId) {
          return {
            lineDisplayName: row.get(userProfileMapping.DISPLAY_NAME) || 'N/A',
            prefix: row.get(userProfileMapping.PREFIX) || '',
            firstName: row.get(userProfileMapping.FIRST_NAME) || '',
            lastName: row.get(userProfileMapping.LAST_NAME) || '',
            age: row.get(userProfileMapping.AGE) || '',
            ethnicity: row.get(userProfileMapping.ETHNICITY) || '',
            nationality: row.get(userProfileMapping.NATIONALITY) || '',
            phone: String(row.get(userProfileMapping.PHONE) || '').replace(/^'/, ''),
            houseNo: row.get(userProfileMapping.HOUSE_NO) || '',
            moo: row.get(userProfileMapping.MOO) || ''
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`❌ Error retrieving user personal details for ${userId}:`, error.message);
      return null;
    }
  }

  async findRepairRequestById(requestId) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const rows = await sheet.getRows();
      const requestIdColHeader = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME].REQUEST_ID;
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];

      for (const row of rows) {
        if (row.get(requestIdColHeader) === requestId) {
          const repairData = {};
          for (const internalKey in repairSheetMapping) {
              const headerName = repairSheetMapping[internalKey];
              if (headerName) {
                if (internalKey === 'PHONE') {
                    repairData[internalKey] = String(row.get(headerName) || '').replace(/^'/, '');
                } else {
                    repairData[internalKey] = row.get(headerName) || '';
                }
              }
          }
          return repairData;
        }
      }
      return null;
    } catch (error) {
      console.error(`❌ Error finding repair request by ID ${requestId}:`, error.message);
      return null;
    }
  }

  async findRepairRequestsByPhone(phoneNumber) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const rows = await sheet.getRows();
      const phoneColHeader = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME].PHONE;

      const matchingRequests = [];
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];

      for (const row of rows) {
        const sheetPhoneNumber = String(row.get(phoneColHeader) || '').replace(/^'/, '');
        const queryPhoneNumber = String(phoneNumber).replace(/^'/, '');
        if (sheetPhoneNumber === queryPhoneNumber) {
          const repairData = {};
           for (const internalKey in repairSheetMapping) {
              const headerName = repairSheetMapping[internalKey];
              if (headerName) {
                if (internalKey === 'PHONE') {
                    repairData[internalKey] = String(row.get(headerName) || '').replace(/^'/, '');
                } else {
                    repairData[internalKey] = row.get(headerName) || '';
                }
              }
          }
          matchingRequests.push(repairData);
        }
      }

      matchingRequests.sort((a, b) => {
        const parseDateTime = (dateStrWithPossibleTime) => {
            if (!dateStrWithPossibleTime) return new Date(0);
            const parts = dateStrWithPossibleTime.split(/,\s*/);
            const datePart = parts[0].trim();
            const timePart = parts.length > 1 ? parts[1].trim() : '00:00:00';
            const dateSegments = datePart.split('/');
            if (dateSegments.length !== 3) return new Date(0);
            const day = parseInt(dateSegments[0]);
            const month = parseInt(dateSegments[1]);
            let year = parseInt(dateSegments[2]);
            if (year > 2500) { year -= 543; }
            const timeSegments = timePart.split(':');
            if (timeSegments.length < 2) return new Date(0);
            const hour = parseInt(timeSegments[0]);
            const minute = parseInt(timeSegments[1]);
            const second = timeSegments.length > 2 ? parseInt(timeSegments[2]) : 0;
            if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute) || isNaN(second)) { return new Date(0); }
            return new Date(year, month - 1, day, hour, minute, second);
        };
        const dateA = parseDateTime(a.DATE_REPORTED);
        const dateB = parseDateTime(b.DATE_REPORTED);
        return dateB - dateA;
      });
      return matchingRequests;
    } catch (error) {
      console.error(`❌ Error finding repair requests by phone ${phoneNumber}:`, error.message);
      return [];
    }
  }

  async getAllRepairRequests(options = {}) {
    const { limit, sortBy = 'newest', filterByStatus } = options;
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      let rows = await sheet.getRows();
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];
      let allRequests = rows.map(row => {
        const requestData = {};
        for (const internalKey in repairSheetMapping) {
          const headerName = repairSheetMapping[internalKey];
          if (headerName) {
            if (internalKey === 'PHONE') {
              requestData[internalKey] = String(row.get(headerName) || '').replace(/^'/, '');
            } else {
              requestData[internalKey] = row.get(headerName) || '';
            }
          }
        }
        return requestData;
      });
      if (filterByStatus) {
        allRequests = allRequests.filter(req => req.STATUS && req.STATUS.toLowerCase() === filterByStatus.toLowerCase());
      }
      allRequests.sort((a, b) => {
        const parseDateTime = (dateStrWithPossibleTime) => {
            if (!dateStrWithPossibleTime) return new Date(0);
            const parts = dateStrWithPossibleTime.split(/,\s*/);
            const datePart = parts[0].trim();
            const timePart = parts.length > 1 ? parts[1].trim() : '00:00:00';
            const dateSegments = datePart.split('/');
            if (dateSegments.length !== 3) return new Date(0);
            const day = parseInt(dateSegments[0]);
            const month = parseInt(dateSegments[1]);
            let year = parseInt(dateSegments[2]);
            if (year > 2500) year -= 543;
            const timeSegments = timePart.split(':');
            if (timeSegments.length < 2) return new Date(0);
            const hour = parseInt(timeSegments[0]);
            const minute = parseInt(timeSegments[1]);
            const second = timeSegments.length > 2 ? parseInt(timeSegments[2]) : 0;
            if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute) || isNaN(second)) return new Date(0);
            return new Date(year, month - 1, day, hour, minute, second);
        };
        const dateA = parseDateTime(a.DATE_REPORTED);
        const dateB = parseDateTime(b.DATE_REPORTED);
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
      });
      return limit && limit > 0 ? allRequests.slice(0, limit) : allRequests;
    } catch (error) {
      console.error('❌ Error fetching all repair requests:', error.message, error.stack);
      return [];
    }
  }

  async getRepairRequestsSummary() {
    try {
        const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
        const rows = await sheet.getRows();
        const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];
        const statusHeader = repairSheetMapping.STATUS;
        const summary = { total: rows.length, pending: 0, inProgress: 0, completed: 0, cancelled: 0, other: 0 };
        rows.forEach(row => {
            const status = (row.get(statusHeader) || '').trim().toLowerCase();
            if (status === 'รอดำเนินการ') summary.pending++;
            else if (status === 'กำลังดำเนินการ') summary.inProgress++;
            else if (status === 'เสร็จสิ้น') summary.completed++;
            else if (status === 'ยกเลิก') summary.cancelled++;
            else if (status) summary.other++;
        });
        return summary;
    } catch (error) {
        console.error('❌ Error calculating repair requests summary:', error.message, error.stack);
        return { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, other: 0 };
    }
  }

  async updateRepairRequestStatus(requestId, newStatus, technicianNotes, signatureUrl, approvedBy, approvalTimestamp) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const rows = await sheet.getRows();
      const repairSheetMapping = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME];

      const requestIdColHeader = repairSheetMapping.REQUEST_ID;
      const statusColHeader = repairSheetMapping.STATUS;
      const notesColHeader = repairSheetMapping.TECHNICIAN_NOTES;
      const signatureUrlColHeader = repairSheetMapping.EXECUTIVE_SIGNATURE_URL;
      const approvedByColHeader = repairSheetMapping.APPROVED_BY;
      const approvalTimestampColHeader = repairSheetMapping.APPROVAL_TIMESTAMP;

      let rowUpdated = false;
      for (const row of rows) {
        if (row.get(requestIdColHeader) === requestId) {
          let changed = false;

          if (typeof newStatus !== 'undefined' && newStatus !== null && row.get(statusColHeader) !== newStatus) {
            row.set(statusColHeader, newStatus);
            changed = true;
          }
          if (typeof technicianNotes !== 'undefined' && row.get(notesColHeader) !== technicianNotes) {
            row.set(notesColHeader, technicianNotes || '');
            changed = true;
          }
          if (signatureUrlColHeader && typeof signatureUrl !== 'undefined' && row.get(signatureUrlColHeader) !== signatureUrl) {
            row.set(signatureUrlColHeader, signatureUrl || '');
            changed = true;
          }
          if (approvedByColHeader && typeof approvedBy !== 'undefined' && row.get(approvedByColHeader) !== approvedBy) {
            row.set(approvedByColHeader, approvedBy || '');
            changed = true;
          }
          if (approvalTimestampColHeader && typeof approvalTimestamp !== 'undefined' && row.get(approvalTimestampColHeader) !== approvalTimestamp) {
            row.set(approvalTimestampColHeader, approvalTimestamp || '');
            changed = true;
          }

          if (changed) {
            await row.save();
            console.log(`✅ Request ${requestId} updated successfully. Status: ${newStatus}, ApprovedBy: ${approvedBy}`);
          }
          rowUpdated = true;
          break;
        }
      }
      if (!rowUpdated) {
        console.warn(`⚠️ Request ID ${requestId} not found for update in sheet.`);
      }
      return rowUpdated;
    } catch (error) {
      console.error(`❌ Error updating status/approval for request ${requestId}:`, error.message, error.stack);
      return false;
    }
  }

  // --- Pole Management Functions ---
  async getAllPoles(options = {}) {
    const { search } = options;
    try {
      const sheet = await this.getOrCreateSheet(this.POLE_DATA_SHEET_NAME);
      const rows = await sheet.getRows();
      const poleMapping = this.columnMappings[this.POLE_DATA_SHEET_NAME];
      if (!poleMapping) { console.error(`❌ Column mappings not defined for sheet: ${this.POLE_DATA_SHEET_NAME}`); return []; }
      let allPoles = rows.map(row => {
        const poleData = {};
        for (const internalKey in poleMapping) {
          const headerName = poleMapping[internalKey];
          if (headerName) poleData[internalKey] = row.get(headerName) || '';
        }
        return poleData;
      });
      if (search) {
        const searchTerm = search.toLowerCase();
        allPoles = allPoles.filter(pole =>
          (pole.POLE_ID_HEADER && String(pole.POLE_ID_HEADER).toLowerCase().includes(searchTerm)) ||
          (pole.VILLAGE_HEADER && String(pole.VILLAGE_HEADER).toLowerCase().includes(searchTerm)) ||
          (pole.POLE_TYPE_HEADER && String(pole.POLE_TYPE_HEADER).toLowerCase().includes(searchTerm)) ||
          (pole.NOTES_HEADER && String(pole.NOTES_HEADER).toLowerCase().includes(searchTerm))
        );
      }
      return allPoles;
    } catch (error) {
      console.error('❌ Error fetching all poles:', error.message, error.stack);
      return [];
    }
  }

  async addPole(poleDataFromForm) {
    try {
      const sheet = await this.getOrCreateSheet(this.POLE_DATA_SHEET_NAME);
      const poleMapping = this.columnMappings[this.POLE_DATA_SHEET_NAME];
      const sheetRowData = {};
      for (const formKey in poleDataFromForm) {
          const internalMappingKey = Object.keys(poleMapping).find( k => k.toLowerCase().replace('_header', '') === formKey.toLowerCase() );
          if (internalMappingKey && poleMapping[internalMappingKey]) {
              const headerName = poleMapping[internalMappingKey];
              sheetRowData[headerName] = poleDataFromForm[formKey] || '';
          } else { console.warn(`[AddPole] No mapping found for form key: ${formKey}.`); }
      }
      Object.values(poleMapping).forEach(header => { if (!(header in sheetRowData)) sheetRowData[header] = ''; });
      await sheet.addRow(sheetRowData);
      const poleIdValue = sheetRowData[poleMapping.POLE_ID_HEADER] || poleDataFromForm.poleId;
      console.log(`✅ New pole added successfully with ID: ${poleIdValue}`);
      return true;
    } catch (error) {
      console.error('❌ Error adding new pole:', error.message, error.stack);
      return false;
    }
  }

  async findPoleByPoleId(poleIdToFind) {
    try {
      const sheet = await this.getOrCreateSheet(this.POLE_DATA_SHEET_NAME);
      const rows = await sheet.getRows();
      const poleMapping = this.columnMappings[this.POLE_DATA_SHEET_NAME];
      const poleIdHeader = poleMapping.POLE_ID_HEADER;
      for (const row of rows) {
        if (row.get(poleIdHeader) === poleIdToFind) {
          const poleData = {};
          for (const internalKey in poleMapping) {
            const headerName = poleMapping[internalKey];
            if (headerName) poleData[internalKey] = row.get(headerName) || '';
          }
          return poleData;
        }
      }
      return null;
    } catch (error) {
      console.error(`❌ Error finding pole by ID ${poleIdToFind}:`, error.message, error.stack);
      return null;
    }
  }

  async updatePoleByPoleId(originalPoleId, poleDataFromForm) {
    try {
      const sheet = await this.getOrCreateSheet(this.POLE_DATA_SHEET_NAME);
      const rows = await sheet.getRows();
      const poleMapping = this.columnMappings[this.POLE_DATA_SHEET_NAME];
      const poleIdHeader = poleMapping.POLE_ID_HEADER;
      let rowUpdated = false;
      for (const row of rows) {
        if (row.get(poleIdHeader) === originalPoleId) {
          let changesMade = false;
          for (const formKey in poleDataFromForm) {
            const internalMappingKey = Object.keys(poleMapping).find( k => k.toLowerCase().replace('_header', '') === formKey.toLowerCase() );
            if (internalMappingKey && poleMapping[internalMappingKey]) {
                const headerName = poleMapping[internalMappingKey];
                const newValue = poleDataFromForm[formKey] || '';
                if (row.get(headerName) !== newValue) {
                    row.set(headerName, newValue);
                    changesMade = true;
                }
            } else if (formKey !== 'originalPoleId') { console.warn(`[UpdatePole] No mapping for form key: ${formKey}.`);}
          }
          if (changesMade) await row.save();
          else console.log(`ℹ️ No changes to save for pole ID ${originalPoleId}.`);
          rowUpdated = true;
          break;
        }
      }
      return rowUpdated;
    } catch (error) {
      console.error(`❌ Error updating pole data for ID ${originalPoleId}:`, error.message, error.stack);
      return false;
    }
  }

  // --- Inventory Management Functions ---
  async getAllInventoryItems(options = {}) {
    const { search } = options;
    try {
      const sheet = await this.getOrCreateSheet(this.INVENTORY_SHEET_NAME);
      const rows = await sheet.getRows();
      const inventoryMapping = this.columnMappings[this.INVENTORY_SHEET_NAME];
      if (!inventoryMapping) { console.error(`❌ Column mappings not defined for sheet: ${this.INVENTORY_SHEET_NAME}`); return []; }
      let allItems = rows.map(row => {
        const itemData = {};
        for (const internalKey in inventoryMapping) {
          const headerName = inventoryMapping[internalKey];
          if (headerName) {
            if (['PRICE_PER_UNIT', 'TOTAL_QUANTITY', 'ADDED_QUANTITY', 'USED_QUANTITY', 'CURRENT_STOCK', 'TOTAL_PRICE'].includes(internalKey)) {
                const val = row.get(headerName);
                itemData[internalKey] = val !== null && val !== '' ? parseFloat(String(val).replace(/,/g, '')) : 0;
            } else { itemData[internalKey] = row.get(headerName) || ''; }
          }
        }
        return itemData;
      });
      if (search) {
        const searchTerm = search.toLowerCase();
        allItems = allItems.filter(item =>
          (item.ITEM_NAME && String(item.ITEM_NAME).toLowerCase().includes(searchTerm)) ||
          (item.UNIT && String(item.UNIT).toLowerCase().includes(searchTerm))
        );
      }
      return allItems;
    } catch (error) {
      console.error('❌ Error fetching all inventory items:', error.message, error.stack);
      return [];
    }
  }

  async findInventoryItemByName(itemName) {
    try {
      const sheet = await this.getOrCreateSheet(this.INVENTORY_SHEET_NAME);
      const rows = await sheet.getRows();
      const inventoryMapping = this.columnMappings[this.INVENTORY_SHEET_NAME];
      const itemNameHeader = inventoryMapping.ITEM_NAME;
      for (const row of rows) {
        if (row.get(itemNameHeader) === itemName) {
          const itemData = {};
          for (const internalKey in inventoryMapping) {
            const headerName = inventoryMapping[internalKey];
            if (headerName) {
                 if (['PRICE_PER_UNIT', 'TOTAL_QUANTITY', 'ADDED_QUANTITY', 'USED_QUANTITY', 'CURRENT_STOCK', 'TOTAL_PRICE'].includes(internalKey)) {
                    const val = row.get(headerName);
                    itemData[internalKey] = val !== null && val !== '' ? parseFloat(String(val).replace(/,/g, '')) : 0;
                } else { itemData[internalKey] = row.get(headerName) || ''; }
            }
          }
          return itemData;
        }
      }
      return null;
    } catch (error) {
      console.error(`❌ Error finding inventory item by name ${itemName}:`, error.message, error.stack);
      return null;
    }
  }

  async addInventoryItem(itemDataFromForm) {
    try {
      const sheet = await this.getOrCreateSheet(this.INVENTORY_SHEET_NAME);
      const inventoryMapping = this.columnMappings[this.INVENTORY_SHEET_NAME];
      const existingItem = await this.findInventoryItemByName(itemDataFromForm.itemName);
      if (existingItem) { throw new Error(`รายการวัสดุ "${itemDataFromForm.itemName}" มีอยู่ในคลังแล้ว`); }
      const sheetRowData = {};
      for (const formKey in itemDataFromForm) {
          const internalMappingKey = Object.keys(inventoryMapping).find( k => k.toLowerCase() === formKey.toLowerCase() || k.toLowerCase().replace('_header', '') === formKey.toLowerCase() );
          if (internalMappingKey && inventoryMapping[internalMappingKey]) {
              const headerName = inventoryMapping[internalMappingKey];
              let value = itemDataFromForm[formKey] || '';
              if (['pricePerUnit', 'totalQuantity', 'addedQuantity', 'usedQuantity', 'currentStock'].includes(formKey)) {
                  value = parseFloat(String(value).replace(/,/g, '')) || 0;
              }
              sheetRowData[headerName] = value;
          }
      }
       Object.values(inventoryMapping).forEach(header => {
          if (!(header in sheetRowData)) {
              if (header === inventoryMapping.PRICE_PER_UNIT || header === inventoryMapping.TOTAL_QUANTITY || header === inventoryMapping.ADDED_QUANTITY || header === inventoryMapping.USED_QUANTITY || header === inventoryMapping.CURRENT_STOCK || header === inventoryMapping.TOTAL_PRICE) {
                sheetRowData[header] = 0;
              } else { sheetRowData[header] = ''; }
          }
      });
      await sheet.addRow(sheetRowData);
      console.log(`✅ New inventory item added: ${sheetRowData[inventoryMapping.ITEM_NAME]}`);
      return true;
    } catch (error) {
      console.error('❌ Error adding new inventory item:', error.message, error.stack);
      if (error.message.includes("มีอยู่ในคลังแล้ว")) throw error;
      return false;
    }
  }

  async updateInventoryItem(originalItemName, itemDataFromForm) {
    try {
      const sheet = await this.getOrCreateSheet(this.INVENTORY_SHEET_NAME);
      const rows = await sheet.getRows();
      const inventoryMapping = this.columnMappings[this.INVENTORY_SHEET_NAME];
      const itemNameHeader = inventoryMapping.ITEM_NAME;
      let rowUpdated = false;
      for (const row of rows) {
        if (row.get(itemNameHeader) === originalItemName) {
          let changesMade = false;
          for (const formKey in itemDataFromForm) {
            if (formKey === 'currentStock' || formKey === 'totalQuantity' || formKey === 'addedQuantity' || formKey === 'usedQuantity') continue;
            const internalMappingKey = Object.keys(inventoryMapping).find( k => k.toLowerCase() === formKey.toLowerCase() || k.toLowerCase().replace('_header', '') === formKey.toLowerCase() );
            if (internalMappingKey && inventoryMapping[internalMappingKey]) {
                const headerName = inventoryMapping[internalMappingKey];
                const newValue = itemDataFromForm[formKey] || '';
                 if (row.get(headerName) !== newValue) {
                    if (headerName === itemNameHeader && newValue !== originalItemName) {
                        const checkExisting = await this.findInventoryItemByName(newValue);
                        if (checkExisting) throw new Error(`ชื่อรายการวัสดุ "${newValue}" ซ้ำกับที่มีอยู่แล้ว`);
                    }
                    row.set(headerName, newValue);
                    changesMade = true;
                }
            }
          }
          if (changesMade) await row.save();
          else console.log(`ℹ️ No changes to save for inventory item "${originalItemName}".`);
          rowUpdated = true;
          break;
        }
      }
      if (!rowUpdated) throw new Error(`ไม่พบรายการวัสดุ "${originalItemName}" สำหรับการแก้ไข`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating inventory item "${originalItemName}":`, error.message, error.stack);
      if (error.message.includes("ซ้ำกับที่มีอยู่แล้ว") || error.message.includes("ไม่พบรายการวัสดุ")) throw error;
      return false;
    }
  }

  async adjustInventoryQuantity(itemName, quantityChange, transactionType = 'เบิกจ่าย') {
    try {
      const sheet = await this.getOrCreateSheet(this.INVENTORY_SHEET_NAME);
      const rows = await sheet.getRows();
      const inventoryMapping = this.columnMappings[this.INVENTORY_SHEET_NAME];
      const itemNameHeader = inventoryMapping.ITEM_NAME;
      const currentStockHeader = inventoryMapping.CURRENT_STOCK;
      const usedQuantityHeader = inventoryMapping.USED_QUANTITY;
      const addedQuantityHeader = inventoryMapping.ADDED_QUANTITY;
      let itemFound = false;
      for (const row of rows) {
        if (row.get(itemNameHeader) === itemName) {
          itemFound = true;
          let currentStock = parseFloat(String(row.get(currentStockHeader) || '0').replace(/,/g, ''));
          let usedQuantity = parseFloat(String(row.get(usedQuantityHeader) || '0').replace(/,/g, ''));
          let addedQuantity = parseFloat(String(row.get(addedQuantityHeader) || '0').replace(/,/g, ''));
          const change = parseFloat(quantityChange);
          if (isNaN(currentStock)) currentStock = 0;
          if (isNaN(usedQuantity)) usedQuantity = 0;
          if (isNaN(addedQuantity)) addedQuantity = 0;
          if (isNaN(change) || change <= 0) throw new Error('จำนวนที่เปลี่ยนแปลงต้องเป็นตัวเลขที่มากกว่า 0');
          if (transactionType.toLowerCase() === 'เบิกจ่าย' || transactionType.toLowerCase() === 'used') {
            if (currentStock < change) throw new Error(`ไม่สามารถเบิก "${itemName}" จำนวน ${change} ได้เนื่องจากมีในคลังเพียง ${currentStock}`);
            row.set(currentStockHeader, currentStock - change);
            row.set(usedQuantityHeader, usedQuantity + change);
          } else if (transactionType.toLowerCase() === 'รับเข้า' || transactionType.toLowerCase() === 'added') {
            row.set(currentStockHeader, currentStock + change);
            row.set(addedQuantityHeader, addedQuantity + change);
          } else { throw new Error('ประเภทการทำรายการไม่ถูกต้อง (ต้องเป็น "เบิกจ่าย" หรือ "รับเข้า")'); }
          await row.save();
          console.log(`✅ Quantity for "${itemName}" adjusted by ${quantityChange} (${transactionType}). New stock: ${row.get(currentStockHeader)}`);
          return true;
        }
      }
      if (!itemFound) throw new Error(`ไม่พบรายการวัสดุ "${itemName}" ในคลัง`);
      return false;
    } catch (error) {
      console.error(`❌ Error adjusting quantity for "${itemName}":`, error.message, error.stack);
      throw error;
    }
  }

  // --- Admin User Management Functions ---
  async findAdminUserByUsername(username) {
    try {
      const sheet = await this.getOrCreateSheet(this.ADMIN_USERS_SHEET_NAME);
      const rows = await sheet.getRows();
      const usernameHeader = this.columnMappings[this.ADMIN_USERS_SHEET_NAME].USERNAME;
      const adminUserMapping = this.columnMappings[this.ADMIN_USERS_SHEET_NAME];

      for (const row of rows) {
        if (row.get(usernameHeader) === username) {
          const userData = {};
          for (const internalKey in adminUserMapping) {
            userData[internalKey] = row.get(adminUserMapping[internalKey]) || '';
          }
          console.log(`✅ Found admin user: ${username}`);
          return userData;
        }
      }
      console.log(`ℹ️ Admin user not found: ${username}`);
      return null;
    } catch (error) {
      console.error(`❌ Error finding admin user ${username}:`, error.message, error.stack);
      return null;
    }
  }

  async addAdminUser(adminUserData) {
    try {
      const sheet = await this.getOrCreateSheet(this.ADMIN_USERS_SHEET_NAME);
      const adminUserMapping = this.columnMappings[this.ADMIN_USERS_SHEET_NAME];

      const existingUser = await this.findAdminUserByUsername(adminUserData.USERNAME);
      if (existingUser) {
        throw new Error(`ชื่อผู้ใช้ "${adminUserData.USERNAME}" นี้มีอยู่ในระบบแล้ว`);
      }

      const sheetRowData = {
        [adminUserMapping.USERNAME]: adminUserData.USERNAME,
        [adminUserMapping.PASSWORD_HASH]: adminUserData.PASSWORD_HASH,
        [adminUserMapping.ROLE]: adminUserData.ROLE || 'technician',
        [adminUserMapping.FULL_NAME]: adminUserData.FULL_NAME || '',
        [adminUserMapping.EMAIL]: adminUserData.EMAIL || '',
        [adminUserMapping.IS_ACTIVE]: typeof adminUserData.IS_ACTIVE !== 'undefined' ? String(adminUserData.IS_ACTIVE).toUpperCase() : 'TRUE',
        [adminUserMapping.CREATED_AT]: new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE }),
        [adminUserMapping.LAST_LOGIN]: ''
      };

      console.log(`[SheetSave] Preparing to add new admin user:`, JSON.stringify(sheetRowData));
      await sheet.addRow(sheetRowData);
      console.log(`✅ New admin user added: ${adminUserData.USERNAME}`);
      return true;
    } catch (error) {
      console.error('❌ Error adding new admin user:', error.message, error.stack);
      if (error.message.includes("มีอยู่ในระบบแล้ว")) throw error;
      return false;
    }
  }

  async getAllAdminUsers() {
    try {
      const sheet = await this.getOrCreateSheet(this.ADMIN_USERS_SHEET_NAME);
      const rows = await sheet.getRows();
      const adminUserMapping = this.columnMappings[this.ADMIN_USERS_SHEET_NAME];

      const allAdminUsers = rows.map(row => {
        const userData = {};
        for (const internalKey in adminUserMapping) {
          if (internalKey === 'PASSWORD_HASH') continue;
          userData[internalKey] = row.get(adminUserMapping[internalKey]) || '';
        }
        return userData;
      });
      console.log(`✅ Fetched ${allAdminUsers.length} admin users.`);
      return allAdminUsers;
    } catch (error) {
      console.error('❌ Error fetching all admin users:', error.message, error.stack);
      return [];
    }
  }

  async updateAdminUser(username, updateData) {
    try {
      const sheet = await this.getOrCreateSheet(this.ADMIN_USERS_SHEET_NAME);
      const rows = await sheet.getRows();
      const adminUserMapping = this.columnMappings[this.ADMIN_USERS_SHEET_NAME];
      const usernameHeader = adminUserMapping.USERNAME;

      let userFound = false;
      for (const row of rows) {
        if (row.get(usernameHeader) === username) {
          userFound = true;
          let changesMade = false;
          for (const internalKey in updateData) {
            const sheetHeader = adminUserMapping[internalKey];
            if (sheetHeader && typeof updateData[internalKey] !== 'undefined') {
              if (internalKey === 'USERNAME' || internalKey === 'PASSWORD_HASH') {
                 if (internalKey === 'PASSWORD_HASH' && updateData.PASSWORD_HASH) {
                    if (row.get(sheetHeader) !== String(updateData[internalKey])) {
                        row.set(sheetHeader, String(updateData[internalKey]));
                        changesMade = true;
                    }
                 } else {
                    console.warn(`Attempt to update protected/special field "${internalKey}" for admin user "${username}" was ignored or needs specific handling.`);
                    continue;
                 }
              } else if (row.get(sheetHeader) !== String(updateData[internalKey])) {
                row.set(sheetHeader, String(updateData[internalKey]));
                changesMade = true;
              }
            }
          }
          if (changesMade) {
            await row.save();
            console.log(`✅ Admin user "${username}" updated successfully.`);
          } else {
            console.log(`ℹ️ No changes to save for admin user "${username}".`);
          }
          return true;
        }
      }
      if (!userFound) {
        console.warn(`⚠️ Admin user "${username}" not found for update.`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error updating admin user "${username}":`, error.message, error.stack);
      return false;
    }
  }

  async deleteAdminUser(username) {
    try {
      const sheet = await this.getOrCreateSheet(this.ADMIN_USERS_SHEET_NAME);
      const rows = await sheet.getRows();
      const usernameHeader = this.columnMappings[this.ADMIN_USERS_SHEET_NAME].USERNAME;

      for (let i = 0; i < rows.length; i++) {
        if (rows[i].get(usernameHeader) === username) {
          await rows[i].delete();
          console.log(`✅ Admin user "${username}" deleted successfully.`);
          return true;
        }
      }
      console.warn(`⚠️ Admin user "${username}" not found for deletion.`);
      return false;
    } catch (error) {
      console.error(`❌ Error deleting admin user "${username}":`, error.message, error.stack);
      return false;
    }
  }

  // --- Telegram Configuration Functions ---
  async getTelegramConfig() {
    try {
      const sheet = await this.getOrCreateSheet(this.TELEGRAM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const configMapping = this.columnMappings[this.TELEGRAM_CONFIG_SHEET_NAME];
      const configKeyHeader = configMapping.CONFIG_KEY;

      for (const row of rows) {
        if (row.get(configKeyHeader) === 'TELEGRAM_SETTINGS') {
          return {
            botToken: row.get(configMapping.BOT_TOKEN) || '',
            chatId: row.get(configMapping.CHAT_ID) || '',
            isEnabled: String(row.get(configMapping.IS_ENABLED)).toUpperCase() === 'TRUE'
          };
        }
      }
      return { botToken: '', chatId: '', isEnabled: false };
    } catch (error) {
      console.error('❌ Error fetching Telegram config:', error.message, error.stack);
      return { botToken: '', chatId: '', isEnabled: false };
    }
  }
  
  async saveTelegramConfig(configData) {
    try {
      const sheet = await this.getOrCreateSheet(this.TELEGRAM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const configMapping = this.columnMappings[this.TELEGRAM_CONFIG_SHEET_NAME];
      const configKeyHeader = configMapping.CONFIG_KEY;

      let existingRow = null;
      for (const row of rows) {
        if (row.get(configKeyHeader) === 'TELEGRAM_SETTINGS') {
          existingRow = row;
          break;
        }
      }

      const sheetRowData = {
        [configMapping.CONFIG_KEY]: 'TELEGRAM_SETTINGS',
        [configMapping.BOT_TOKEN]: configData.botToken || '',
        [configMapping.CHAT_ID]: configData.chatId || '',
        [configMapping.IS_ENABLED]: String(configData.isEnabled).toUpperCase()
      };

      if (existingRow) {
        existingRow.set(configMapping.BOT_TOKEN, sheetRowData[configMapping.BOT_TOKEN]);
        existingRow.set(configMapping.CHAT_ID, sheetRowData[configMapping.CHAT_ID]);
        existingRow.set(configMapping.IS_ENABLED, sheetRowData[configMapping.IS_ENABLED]);
        await existingRow.save();
      } else {
        await sheet.addRow(sheetRowData);
      }
      console.log('✅ Telegram configuration saved successfully.');
      return true;
    } catch (error) {
      console.error('❌ Error saving Telegram config:', error.message, error.stack);
      return false;
    }
  }

  // --- ฟังก์ชันเพิ่มเติมสำหรับ Request ID System ---

  /**
   * ดูสถิติ Request ID แต่ละเดือน
   */
  async getRequestIdStatistics() {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];
      
      const statistics = [];
      for (const row of rows) {
        if (row.get(mapping.COUNTER_TYPE) === 'REQUEST_ID') {
          const period = row.get(mapping.PERIOD);
          const value = parseInt(row.get(mapping.VALUE)) || 0;
          
          // แปลง period เป็นรูปแบบที่อ่านได้
          const year = `25${period.substring(0, 2)}`;
          const month = period.substring(2, 4);
          const monthNames = {
            '01': 'มกราคม', '02': 'กุมภาพันธ์', '03': 'มีนาคม',
            '04': 'เมษายน', '05': 'พฤษภาคม', '06': 'มิถุนายน',
            '07': 'กรกฎาคม', '08': 'สิงหาคม', '09': 'กันยายน',
            '10': 'ตุลาคม', '11': 'พฤศจิกายน', '12': 'ธันวาคม'
          };
          
          statistics.push({
            period: period,
            displayName: `${monthNames[month]} ${year}`,
            totalRequests: value,
            lastRequestId: `${period}-${value.toString().padStart(3, '0')}`
          });
        }
      }
      
      // เรียงตาม period จากใหม่ไปเก่า
      statistics.sort((a, b) => b.period.localeCompare(a.period));
      
      return statistics;
    } catch (error) {
      console.error('❌ Error fetching request ID statistics:', error.message);
      return [];
    }
  }

  /**
   * รีเซ็ต counter สำหรับเดือนใหม่ (ใช้เมื่อต้องการ manual reset)
   */
  async resetCounterForNewPeriod(period) {
    try {
      await this.setSystemCounter('REQUEST_ID', 0, period);
      console.log(`✅ Counter reset for period: ${period}`);
      return true;
    } catch (error) {
      console.error(`❌ Error resetting counter for period ${period}:`, error.message);
      return false;
    }
  }

  /**
   * ตรวจสอบว่า Request ID นั้นมีอยู่จริงหรือไม่
   */
  async isValidRequestId(requestId) {
    try {
      const sheet = await this.getOrCreateSheet(config.REPAIR_REQUESTS_SHEET_NAME);
      const rows = await sheet.getRows();
      const requestIdColHeader = this.columnMappings[config.REPAIR_REQUESTS_SHEET_NAME].REQUEST_ID;

      for (const row of rows) {
        if (row.get(requestIdColHeader) === requestId) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(`❌ Error validating request ID ${requestId}:`, error.message);
      return false;
    }
  }

  /**
   * สร้าง backup ของ counter (เผื่อกรณีเกิดปัญหา)
   */
  async backupCounters() {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];
      
      const backup = [];
      for (const row of rows) {
        backup.push({
          counterType: row.get(mapping.COUNTER_TYPE),
          period: row.get(mapping.PERIOD),
          value: row.get(mapping.VALUE)
        });
      }
      
      console.log(`✅ Backed up ${backup.length} counter records`);
      return backup;
    } catch (error) {
      console.error('❌ Error backing up counters:', error.message);
      return [];
    }
  }

  /**
   * ลบข้อมูล counter เก่าที่ไม่ต้องการแล้ว (เช่น เก่ากว่า 2 ปี)
   */
  async cleanupOldCounters(keepYears = 2) {
    try {
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];
      
      const currentYear = new Date().getFullYear() + 543;
      const cutoffYear = currentYear - keepYears;
      let deletedCount = 0;
      
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row.get(mapping.COUNTER_TYPE) === 'REQUEST_ID') {
          const period = row.get(mapping.PERIOD);
          if (period && period.length === 4) {
            const yearFromPeriod = parseInt(`25${period.substring(0, 2)}`);
            if (yearFromPeriod < cutoffYear) {
              await row.delete();
              deletedCount++;
            }
          }
        }
      }
      
      console.log(`✅ Cleaned up ${deletedCount} old counter records`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up old counters:', error.message);
      return 0;
    }
  }

   /**
   * บันทึกการตั้งค่า Flex Message ลง Google Sheets
   */
  async saveFlexMessageSettings(settings) {
    try {
      await this.authenticate();
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      
      // เตรียมข้อมูลให้อยู่ในรูปแบบที่เก็บใน Google Sheets ได้
      const settingsString = JSON.stringify(settings);
      const timestamp = new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE });
      
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];
      
      // หาแถวที่มี FLEX_MESSAGE_SETTINGS
      let existingRow = null;
      for (const row of rows) {
        if (row.get(mapping.COUNTER_TYPE) === 'FLEX_MESSAGE_SETTINGS') {
          existingRow = row;
          break;
        }
      }
      
      if (existingRow) {
        // อัปเดตแถวที่มีอยู่
        existingRow.set(mapping.PERIOD, 'CURRENT');
        existingRow.set(mapping.VALUE, settingsString);
        await existingRow.save();
      } else {
        // เพิ่มแถวใหม่
        const newRowData = {
          [mapping.COUNTER_TYPE]: 'FLEX_MESSAGE_SETTINGS',
          [mapping.PERIOD]: 'CURRENT',
          [mapping.VALUE]: settingsString
        };
        await sheet.addRow(newRowData);
      }
      
      console.log('✅ Flex Message settings saved to Google Sheets');
      return true;
    } catch (error) {
      console.error('❌ Error saving Flex Message settings to Google Sheets:', error.message);
      throw error;
    }
  }

  /**
   * ดึงการตั้งค่า Flex Message จาก Google Sheets
   */
  async getFlexMessageSettings() {
    try {
      await this.authenticate();
      const sheet = await this.getOrCreateSheet(this.SYSTEM_CONFIG_SHEET_NAME);
      
      const rows = await sheet.getRows();
      const mapping = this.columnMappings[this.SYSTEM_CONFIG_SHEET_NAME];
      
      // หาแถวที่มี FLEX_MESSAGE_SETTINGS
      for (const row of rows) {
        if (row.get(mapping.COUNTER_TYPE) === 'FLEX_MESSAGE_SETTINGS') {
          try {
            const settingsString = row.get(mapping.VALUE);
            if (settingsString) {
              const settings = JSON.parse(settingsString);
              console.log('✅ Loaded Flex Message settings from Google Sheets');
              return settings;
            }
          } catch (parseError) {
            console.error('❌ Error parsing Flex Message settings:', parseError.message);
            return null;
          }
        }
      }
      
      console.log('ℹ️ No Flex Message settings found in Google Sheets');
      return null;
    } catch (error) {
      console.error('❌ Error loading Flex Message settings from Google Sheets:', error.message);
      return null;
    }
  }

  /**
   * ฟังก์ชันทดสอบระบบครบถ้วน
   */
  async runFullSystemTest() {
    console.log('🧪 Running comprehensive Request ID system test...');
    
    try {
      // 1. ทดสอบการสร้าง Request ID
      console.log('\n1. Testing Request ID generation:');
      for (let i = 0; i < 3; i++) {
        const requestId = await this.generateRequestId();
        console.log(`   Generated: ${requestId}`);
      }
      
      // 2. ทดสอบการดูสถิติ
      console.log('\n2. Testing statistics:');
      const stats = await this.getRequestIdStatistics();
      console.log(`   Found ${stats.length} periods with data`);
      stats.forEach(stat => {
        console.log(`   ${stat.displayName}: ${stat.totalRequests} requests (Last: ${stat.lastRequestId})`);
      });
      
      // 3. ทดสอบการ backup
      console.log('\n3. Testing backup:');
      const backup = await this.backupCounters();
      console.log(`   Backed up ${backup.length} records`);
      
      // 4. ทดสอบการ validate Request ID
      console.log('\n4. Testing validation:');
      const testId = await this.generateRequestId();
      const isValid = await this.isValidRequestId(testId);
      console.log(`   Request ID ${testId} validation: ${isValid ? 'VALID' : 'INVALID'}`);
      
      console.log('\n✅ All tests completed successfully!');
      return true;
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      return false;
    }
  }
}

// แก้ไข module.exports ให้ถูกต้อง
module.exports = new GoogleSheetsService();