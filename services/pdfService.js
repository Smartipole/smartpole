// services/pdfService.js - Updated for Cloud Deployment
const puppeteer = require('puppeteer');
const path = require('path');

class PDFService {
    constructor() {
        this.browser = null;
    }

    // เริ่มต้น browser - ปรับแต่งสำหรับ cloud hosting
    async initBrowser() {
        if (!this.browser) {
            // Configuration สำหรับ different hosting platforms
            const isProduction = process.env.NODE_ENV === 'production';
            const isRailway = process.env.RAILWAY_ENVIRONMENT;
            const isRender = process.env.RENDER;
            const isVercel = process.env.VERCEL;
            
            let launchOptions = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-background-networking',
                    '--disable-ipc-flooding-protection',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--ignore-certificate-errors-spki-list',
                    '--disable-extensions'
                ]
            };
            
            if (isProduction) {
                if (isHeroku) {
                    launchOptions.executablePath = '/app/.apt/usr/bin/google-chrome';
                    launchOptions.args.push('--disable-gpu', '--remote-debugging-port=9222');
                }
                
                if (isRender || isRailway) {
                    launchOptions.args.push(
                        '--single-process',
                        '--no-zygote',
                        '--disable-gpu',
                        '--memory-pressure-off'
                    );
                }
                
                if (isVercel) {
                    // Vercel ไม่รองรับ Puppeteer ดีนัก อาจต้องใช้ Playwright แทน
                    console.warn('Puppeteer may not work well on Vercel. Consider using @vercel/og or external PDF service.');
                }

                // Try to use bundled Chromium first, fallback to system Chrome
                try {
                    launchOptions.executablePath = puppeteer.executablePath();
                } catch (error) {
                    console.warn('Bundled Chromium not found, using system Chrome if available');
                    // Remove executablePath to let Puppeteer find system Chrome
                }
            }

            try {
                this.browser = await puppeteer.launch(launchOptions);
                console.log('✅ Puppeteer browser launched successfully');
            } catch (error) {
                console.error('❌ Failed to launch Puppeteer browser:', error.message);
                // Fallback: try with minimal configuration
                try {
                    console.log('🔄 Trying fallback Puppeteer configuration...');
                    this.browser = await puppeteer.launch({
                        headless: 'new',
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    });
                    console.log('✅ Puppeteer browser launched with fallback configuration');
                } catch (fallbackError) {
                    console.error('❌ Puppeteer fallback also failed:', fallbackError.message);
                    throw new Error('Unable to initialize PDF service. Browser launch failed.');
                }
            }
        }
        return this.browser;
    }

    // ปิด browser
    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                console.log('✅ Puppeteer browser closed successfully');
            } catch (error) {
                console.error('❌ Error closing Puppeteer browser:', error.message);
            }
        }
    }

    // สร้าง PDF จาก HTML - เพิ่ม error handling
    async generatePDF(html, options = {}) {
        try {
            const browser = await this.initBrowser();
            const page = await browser.newPage();
            
            // Set longer timeout for cloud hosting
            await page.setDefaultTimeout(60000);
            await page.setDefaultNavigationTimeout(60000);
            
            await page.setContent(html, { 
                waitUntil: 'networkidle0',
                timeout: 60000 
            });

            const pdfOptions = {
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                },
                printBackground: true,
                displayHeaderFooter: false,
                preferCSSPageSize: false,
                timeout: 60000,
                ...options
            };

            const pdfBuffer = await page.pdf(pdfOptions);
            await page.close();

            return pdfBuffer;
        } catch (error) {
            console.error('❌ Error generating PDF:', error.message);
            
            // ถ้า Puppeteer ไม่ทำงาน ให้ return mock PDF หรือ error response
            if (process.env.NODE_ENV === 'production') {
                console.log('🔄 PDF generation failed, returning error response');
                throw new Error('PDF generation temporarily unavailable. Please try again later or contact support.');
            } else {
                throw error;
            }
        }
    }

    // Health check สำหรับ PDF service
    async healthCheck() {
        try {
            const browser = await this.initBrowser();
            const page = await browser.newPage();
            await page.setContent('<html><body><h1>Test</h1></body></html>');
            await page.close();
            return { status: 'healthy', message: 'PDF service is working' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    // เก็บ methods อื่นๆ เหมือนเดิม...
    generateRepairRequestHTML(requests, templateOptions = {}) {
        // ใช้โค้ดเดิม
        const {
            title = 'รายงานคำขอแจ้งซ่อมไฟฟ้า',
            headerColor = '#2563eb',
            showDate = true,
            filterStatus = null,
            dateRange = null
        } = templateOptions;

        const currentDate = new Date().toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // กรองข้อมูลตามเงื่อนไข
        let filteredRequests = requests;
        if (filterStatus) {
            filteredRequests = requests.filter(req => req.STATUS === filterStatus);
        }

        // สรุปสถิติ
        const stats = {
            total: filteredRequests.length,
            pending: filteredRequests.filter(r => r.STATUS === 'รอดำเนินการ').length,
            approved: filteredRequests.filter(r => r.STATUS === 'อนุมัติแล้วรอช่าง').length,
            inProgress: filteredRequests.filter(r => r.STATUS === 'กำลังดำเนินการ').length,
            completed: filteredRequests.filter(r => r.STATUS === 'เสร็จสิ้น').length,
            cancelled: filteredRequests.filter(r => r.STATUS === 'ยกเลิก' || r.STATUS === 'ไม่อนุมัติโดยผู้บริหาร').length
        };

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Sarabun', sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #333;
                    background: white;
                }
                
                .container {
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 20mm;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid ${headerColor};
                    padding-bottom: 20px;
                }
                
                .header h1 {
                    color: ${headerColor};
                    font-size: 28px;
                    font-weight: 600;
                    margin-bottom: 10px;
                }
                
                .header .org-name {
                    font-size: 20px;
                    color: #666;
                    margin-bottom: 10px;
                }
                
                .date {
                    color: #666;
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                
                .summary {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    border-left: 4px solid ${headerColor};
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .stat-item {
                    text-align: center;
                    padding: 15px;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                
                .stat-number {
                    font-size: 24px;
                    font-weight: bold;
                    color: ${headerColor};
                }
                
                .stat-label {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .data-table th {
                    background: ${headerColor};
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 500;
                    font-size: 13px;
                }
                
                .data-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 12px;
                }
                
                .data-table tr:nth-child(even) {
                    background: #f8fafc;
                }
                
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .status-pending { background: #fef3c7; color: #d97706; }
                .status-approved { background: #dbeafe; color: #1d4ed8; }
                .status-progress { background: #e0e7ff; color: #6366f1; }
                .status-completed { background: #dcfce7; color: #166534; }
                .status-cancelled { background: #fee2e2; color: #991b1b; }
                
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 20px;
                }
                
                @media print {
                    .container {
                        padding: 15mm;
                    }
                    
                    .data-table {
                        font-size: 10px;
                    }
                    
                    .data-table th,
                    .data-table td {
                        padding: 6px 4px;
                    }
                    
                    .stats-grid {
                        grid-template-columns: repeat(3, 1fr);
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="org-name">องค์การบริหารส่วนตำบลข่าใหญ่</div>
                    <h1>${title}</h1>
                    ${showDate ? `<div class="date">วันที่สร้างรายงาน: ${currentDate}</div>` : ''}
                    ${dateRange ? `<div class="date">ช่วงข้อมูล: ${dateRange}</div>` : ''}
                    ${filterStatus ? `<div class="date">กรองตามสถานะ: ${filterStatus}</div>` : ''}
                </div>
                
                <div class="summary">
                    <h3 style="margin-bottom: 15px; color: ${headerColor};">สรุปข้อมูล</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number">${stats.total}</div>
                            <div class="stat-label">ทั้งหมด</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${stats.pending}</div>
                            <div class="stat-label">รอดำเนินการ</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${stats.approved}</div>
                            <div class="stat-label">อนุมัติแล้ว</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${stats.inProgress}</div>
                            <div class="stat-label">กำลังดำเนินการ</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${stats.completed}</div>
                            <div class="stat-label">เสร็จสิ้น</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${stats.cancelled}</div>
                            <div class="stat-label">ยกเลิก</div>
                        </div>
                    </div>
                </div>
                
                ${filteredRequests.length > 0 ? `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 12%;">เลขที่คำขอ</th>
                            <th style="width: 10%;">วันที่แจ้ง</th>
                            <th style="width: 18%;">ผู้แจ้ง</th>
                            <th style="width: 12%;">เบอร์โทร</th>
                            <th style="width: 15%;">ที่อยู่</th>
                            <th style="width: 8%;">รหัสเสา</th>
                            <th style="width: 15%;">ปัญหา</th>
                            <th style="width: 10%;">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredRequests.map(request => `
                            <tr>
                                <td><strong>${request.REQUEST_ID || '-'}</strong></td>
                                <td>${request.DATE_REPORTED ? this.formatThaiDate(request.DATE_REPORTED) : '-'}</td>
                                <td>${(request.TITLE_PREFIX || '') + ' ' + (request.FIRST_NAME || '') + ' ' + (request.LAST_NAME || '')}</td>
                                <td>${request.PHONE || '-'}</td>
                                <td>บ้านเลขที่ ${request.HOUSE_NO || '-'}, ${request.MOO || '-'}</td>
                                <td>${request.POLE_ID || 'ไม่ระบุ'}</td>
                                <td style="max-width: 150px; word-wrap: break-word;">${this.truncateText(request.REASON || '-', 50)}</td>
                                <td><span class="status-badge ${this.getStatusClass(request.STATUS || 'รอดำเนินการ')}">${request.STATUS || 'รอดำเนินการ'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p style="text-align: center; color: #666; margin: 40px 0;">ไม่พบข้อมูลตามเงื่อนไขที่กำหนด</p>'}
                
                <div class="footer">
                    <p><strong>องค์การบริหารส่วนตำบลข่าใหญ่</strong></p>
                    <p>โทร: ${process.env.CONTACT_PHONE || '0XX-XXXXXXX'} | อีเมล: ${process.env.CONTACT_EMAIL || 'info@khaiyai.go.th'}</p>
                    <p>สร้างรายงานเมื่อ: ${new Date().toLocaleString('th-TH')} | ระบบแจ้งซ่อมไฟฟ้า v2.0</p>
                </div>
            </div>
        </body>
        </html>`;

        return htmlContent;
    }

    // Helper functions
    getStatusClass(status) {
        switch (status) {
            case 'รอดำเนินการ': return 'status-pending';
            case 'อนุมัติแล้วรอช่าง': return 'status-approved';
            case 'กำลังดำเนินการ': return 'status-progress';
            case 'เสร็จสิ้น': return 'status-completed';
            case 'ยกเลิก': case 'ไม่อนุมัติโดยผู้บริหาร': return 'status-cancelled';
            default: return 'status-pending';
        }
    }

    formatThaiDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('th-TH');
        } catch (error) {
            return dateString;
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // สร้างรายงานคำขอแจ้งซ่อม
    async createRepairRequestsReport(requests, options = {}) {
        try {
            const html = this.generateRepairRequestHTML(requests, options);
            const pdfBuffer = await this.generatePDF(html, {
                landscape: requests.length > 20 // ใช้แนวนอนถ้าข้อมูลเยอะ
            });
            
            return {
                success: true,
                pdf: pdfBuffer,
                recordCount: requests.length
            };
        } catch (error) {
            console.error('Error creating repair requests report:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // สร้างรายงานเอกสารคำร้องแบบเดี่ยว
    async createSingleRequestDocument(request, options = {}) {
        try {
            const {
                title = 'แบบฟอร์มแจ้งซ่อมไฟฟ้าส่องสว่าง',
                headerColor = '#2563eb',
                showSignature = true
            } = options;

            const html = `
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Sarabun', sans-serif;
                        font-size: 16px;
                        line-height: 1.8;
                        color: #333;
                        background: white;
                    }
                    
                    .container {
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 25mm;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 40px;
                        border-bottom: 3px solid ${headerColor};
                        padding-bottom: 25px;
                    }
                    
                    .header h1 {
                        color: ${headerColor};
                        font-size: 28px;
                        font-weight: 600;
                        margin-bottom: 10px;
                    }
                    
                    .header h2 {
                        color: #666;
                        font-size: 22px;
                        font-weight: 500;
                        margin-bottom: 15px;
                    }
                    
                    .request-id {
                        background: ${headerColor};
                        color: white;
                        padding: 10px 20px;
                        border-radius: 25px;
                        display: inline-block;
                        font-weight: 600;
                        font-size: 18px;
                    }
                    
                    .section {
                        margin-bottom: 30px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 20px;
                        background: #f8fafc;
                    }
                    
                    .section-title {
                        color: ${headerColor};
                        font-size: 20px;
                        font-weight: 600;
                        margin-bottom: 15px;
                        border-bottom: 2px solid ${headerColor};
                        padding-bottom: 5px;
                    }
                    
                    .info-row {
                        display: flex;
                        margin-bottom: 12px;
                        align-items: flex-start;
                    }
                    
                    .info-label {
                        font-weight: 600;
                        color: #374151;
                        min-width: 180px;
                        margin-right: 15px;
                    }
                    
                    .info-value {
                        flex: 1;
                        border-bottom: 1px dotted #ccc;
                        padding-bottom: 2px;
                        min-height: 25px;
                    }
                    
                    .signature-section {
                        margin-top: 40px;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                    }
                    
                    .signature-box {
                        text-align: center;
                        border: 1px solid #ccc;
                        padding: 20px;
                        border-radius: 8px;
                        background: white;
                    }
                    
                    .signature-area {
                        height: 80px;
                        border: 1px dashed #999;
                        margin: 15px 0;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #666;
                        font-style: italic;
                    }
                    
                    .footer {
                        margin-top: 50px;
                        text-align: center;
                        color: #666;
                        font-size: 14px;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 20px;
                    }
                    
                    .status-badge {
                        display: inline-block;
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-weight: 600;
                        font-size: 14px;
                        margin-left: 10px;
                    }
                    
                    .status-pending { background: #fef3c7; color: #d97706; }
                    .status-approved { background: #dbeafe; color: #1d4ed8; }
                    .status-progress { background: #e0e7ff; color: #6366f1; }
                    .status-completed { background: #dcfce7; color: #166534; }
                    
                    @media print {
                        .container {
                            padding: 20mm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>องค์การบริหารส่วนตำบลข่าใหญ่</h1>
                        <h2>${title}</h2>
                        <div class="request-id">เลขที่: ${request.REQUEST_ID}</div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">📋 ข้อมูลผู้แจ้ง</div>
                        <div class="info-row">
                            <div class="info-label">ชื่อ-นามสกุล:</div>
                            <div class="info-value">${request.TITLE_PREFIX} ${request.FIRST_NAME} ${request.LAST_NAME}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">เบอร์โทรติดต่อ:</div>
                            <div class="info-value">${request.PHONE}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">ที่อยู่:</div>
                            <div class="info-value">บ้านเลขที่ ${request.HOUSE_NO}, ${request.MOO}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">วันที่แจ้ง:</div>
                            <div class="info-value">${this.formatThaiDate(request.DATE_REPORTED)}</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">⚡ รายละเอียดการแจ้งซ่อม</div>
                        <div class="info-row">
                            <div class="info-label">รหัสเสาไฟฟ้า:</div>
                            <div class="info-value">${request.POLE_ID || 'ไม่ระบุ'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">สาเหตุการชำรุด:</div>
                            <div class="info-value" style="min-height: 60px; border-bottom: none; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                ${request.REASON || '-'}
                            </div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">รูปภาพประกอบ:</div>
                            <div class="info-value">${request.PHOTO_MESSAGE_ID ? 'มี' : 'ไม่มี'}</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">📊 สถานะการดำเนินการ</div>
                        <div class="info-row">
                            <div class="info-label">สถานะปัจจุบัน:</div>
                            <div class="info-value">
                                ${request.STATUS || 'รอดำเนินการ'}
                                <span class="status-badge ${this.getStatusClass(request.STATUS || 'รอดำเนินการ')}">${request.STATUS || 'รอดำเนินการ'}</span>
                            </div>
                        </div>
                        ${request.TECHNICIAN_NOTES ? `
                        <div class="info-row">
                            <div class="info-label">หมายเหตุจากเจ้าหน้าที่:</div>
                            <div class="info-value" style="min-height: 40px; border-bottom: none; background: white; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                ${request.TECHNICIAN_NOTES}
                            </div>
                        </div>
                        ` : ''}
                        ${request.APPROVED_BY ? `
                        <div class="info-row">
                            <div class="info-label">ผู้อนุมัติ:</div>
                            <div class="info-value">${request.APPROVED_BY}</div>
                        </div>
                        ` : ''}
                        ${request.APPROVAL_TIMESTAMP ? `
                        <div class="info-row">
                            <div class="info-label">วันที่อนุมัติ:</div>
                            <div class="info-value">${this.formatThaiDate(request.APPROVAL_TIMESTAMP)}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="section">
                        <div class="section-title">✅ การยืนยัน</div>
                        <p style="text-align: justify; line-height: 2; margin-bottom: 20px;">
                            ข้าพเจ้าขอยืนยันว่าข้อมูลที่ได้แจ้งเป็นความจริง หากมีการแจ้งที่เป็นเท็จ 
                            จะมีการดำเนินคดีตามกฎหมายว่าด้วยการแจ้งความที่เป็นเท็จ
                        </p>
                        
                        ${showSignature ? `
                        <div class="signature-section">
                            <div class="signature-box">
                                <div class="signature-area">ลายเซ็นผู้แจ้ง</div>
                                <div style="font-weight: 600;">
                                    ${request.TITLE_PREFIX} ${request.FIRST_NAME} ${request.LAST_NAME}
                                </div>
                                <div style="margin-top: 10px; color: #666;">
                                    วันที่ ......./......./.......
                                </div>
                            </div>
                            
                            <div class="signature-box">
                                <div class="signature-area">ลายเซ็นเจ้าหน้าที่</div>
                                <div style="font-weight: 600;">
                                    _________________________
                                </div>
                                <div style="margin-top: 10px; color: #666;">
                                    วันที่ ......./......./.......
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="footer">
                        <p><strong>องค์การบริหารส่วนตำบลข่าใหญ่</strong></p>
                        <p>โทร: ${process.env.CONTACT_PHONE || '0XX-XXXXXXX'} | อีเมล: ${process.env.CONTACT_EMAIL || 'info@khaiyai.go.th'}</p>
                        <p>พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')} | ระบบแจ้งซ่อมไฟฟ้า v2.0</p>
                    </div>
                </div>
            </body>
            </html>`;

            const pdfBuffer = await this.generatePDF(html);
            
            return {
                success: true,
                pdf: pdfBuffer
            };
        } catch (error) {
            console.error('Error creating single request document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PDFService();