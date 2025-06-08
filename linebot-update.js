// เพิ่มใน lineBotHandler.js

// เพิ่มในส่วน default settings
function getDefaultFlexSettings() {
    return {
        welcome: { /* existing settings */ },
        form: { /* existing settings */ },
        confirm: { /* existing settings */ },
        // เพิ่มใหม่
        status: {
            primaryColor: '#10b981',
            completedColor: '#10b981',
            currentColor: '#f59e0b',
            pendingColor: '#94a3b8',
            bgColor: '#f8fafc',
            lineColor: '#d1d5db',
            headerIcon: '📊',
            title: 'สถานะการแจ้งซ่อม',
            requestId: '2024-001',
            notificationText: 'ได้รับการแจ้งซ่อมแล้ว ระบบจะอัปเดตสถานะให้ทราบ',
            stepCount: 5,
            currentStep: 2,
            iconStyle: 'emoji',
            iconSize: '20px',
            showDetails: 'true',
            showTime: 'true',
            connectionStyle: 'line',
            dotSize: '12px',
            steps: [
                { title: 'รับคำขอ', detail: 'ได้รับการแจ้งซ่อมจากระบบ', icon: '📥', time: '10:30', status: 'completed' },
                { title: 'ตรวจสอบ', detail: 'เจ้าหน้าที่ตรวจสอบข้อมูล', icon: '🔍', time: '11:15', status: 'current' },
                { title: 'อนุมัติ', detail: 'ผู้บริหารพิจารณาอนุมัติ', icon: '✅', time: '-', status: 'pending' },
                { title: 'ดำเนินการ', detail: 'ช่างออกซ่อมบำรุง', icon: '🔧', time: '-', status: 'pending' },
                { title: 'เสร็จสิ้น', detail: 'งานซ่อมบำรุงเสร็จสิ้น', icon: '🎉', time: '-', status: 'pending' }
            ]
        },
        progress: { /* existing settings */ },
        timeline: { /* existing settings */ }
    };
}

// เพิ่มฟังก์ชันใหม่สำหรับสร้าง Timeline Status Message
function createTimelineStatusFlexMessage(requestData, currentStatus, customSettings = null) {
    const settings = customSettings || currentFlexSettings.status;
    
    // แปลงสถานะให้เป็นขั้นตอน
    const statusStepMapping = {
        'รอดำเนินการ': 1,
        'อนุมัติแล้วรอช่าง': 2,
        'กำลังดำเนินการ': 4,
        'เสร็จสิ้น': 5,
        'ไม่อนุมัติโดยผู้บริหาร': 3,
        'ยกเลิก': 0
    };
    
    const currentStep = statusStepMapping[currentStatus] || 1;
    
    // สร้างขั้นตอนตามสถานะปัจจุบัน
    const steps = [...settings.steps];
    for (let i = 0; i < steps.length; i++) {
        if (i + 1 < currentStep) {
            steps[i].status = 'completed';
            steps[i].time = requestData.LAST_UPDATED || new Date().toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (i + 1 === currentStep) {
            steps[i].status = 'current';
            steps[i].time = new Date().toLocaleTimeString('th-TH', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            steps[i].status = 'pending';
            steps[i].time = '-';
        }
    }
    
    return {
        type: "flex",
        altText: `สถานะ: ${currentStatus}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${settings.headerIcon} ${settings.title}`,
                        weight: "bold",
                        size: "lg",
                        color: "#ffffff",
                        align: "center"
                    }
                ],
                backgroundColor: settings.primaryColor,
                paddingAll: "20px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    // Notification card
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: `🎫 รหัสคำขอ: ${requestData.REQUEST_ID || settings.requestId}`,
                                weight: "bold",
                                size: "md",
                                color: "#ffffff",
                                align: "center"
                            },
                            {
                                type: "text",
                                text: settings.notificationText,
                                size: "sm",
                                color: "rgba(255,255,255,0.9)",
                                align: "center",
                                margin: "sm",
                                wrap: true
                            }
                        ],
                        backgroundColor: `${settings.primaryColor}CC`,
                        paddingAll: "15px",
                        cornerRadius: "8px",
                        margin: "none"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: settings.lineColor
                    },
                    // Timeline steps
                    ...generateTimelineSteps(steps, settings)
                ],
                paddingAll: "20px",
                backgroundColor: settings.bgColor
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "link",
                        action: {
                            type: "message",
                            label: "📊 ติดตามสถานะอื่นๆ",
                            text: "ติดตามการซ่อม"
                        }
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#f8fafc"
            }
        }
    };
}

// ฟังก์ชันช่วยสร้างขั้นตอน Timeline
function generateTimelineSteps(steps, settings) {
    const timelineContents = [];
    
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isLast = i === steps.length - 1;
        
        // กำหนดสีตามสถานะ
        let stepColor = settings.pendingColor;
        let stepBgColor = '#f9fafb';
        let statusIcon = '⏸️';
        
        if (step.status === 'completed') {
            stepColor = settings.completedColor;
            stepBgColor = '#f0fdf4';
            statusIcon = '✅';
        } else if (step.status === 'current') {
            stepColor = settings.currentColor;
            stepBgColor = '#fffbeb';
            statusIcon = '⏳';
        }
        
        // ไอคอนขั้นตอน
        let iconContent = step.icon;
        if (settings.iconStyle === 'numbers') {
            iconContent = (i + 1).toString();
        } else if (settings.iconStyle === 'dots') {
            iconContent = '●';
        } else if (settings.iconStyle === 'checks') {
            iconContent = step.status === 'completed' ? '✓' : (step.status === 'current' ? '●' : '○');
        }
        
        // เนื้อหาขั้นตอน
        const stepContent = {
            type: "box",
            layout: "horizontal",
            contents: [
                // ไอคอนขั้นตอน
                {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: iconContent,
                            size: settings.iconSize,
                            color: "#ffffff",
                            weight: "bold",
                            align: "center"
                        }
                    ],
                    width: settings.dotSize,
                    height: settings.dotSize,
                    backgroundColor: stepColor,
                    cornerRadius: "50px",
                    justifyContent: "center",
                    alignItems: "center",
                    flex: 0,
                    margin: "none"
                },
                // เนื้อหา
                {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                {
                                    type: "text",
                                    text: step.title,
                                    weight: "bold",
                                    size: "sm",
                                    color: "#1f2937",
                                    flex: 1
                                },
                                {
                                    type: "text",
                                    text: statusIcon,
                                    size: "md",
                                    flex: 0
                                }
                            ]
                        },
                        ...(settings.showDetails === 'true' ? [
                            {
                                type: "text",
                                text: step.detail,
                                size: "xs",
                                color: "#6b7280",
                                wrap: true,
                                margin: "xs"
                            }
                        ] : []),
                        ...(settings.showTime === 'true' && step.time !== '-' ? [
                            {
                                type: "text",
                                text: step.time,
                                size: "xs",
                                color: stepColor,
                                weight: "bold",
                                margin: "xs"
                            }
                        ] : [])
                    ],
                    backgroundColor: stepBgColor,
                    paddingAll: "12px",
                    cornerRadius: "8px",
                    borderWidth: "medium",
                    borderColor: stepColor,
                    margin: "sm",
                    flex: 1
                }
            ],
            spacing: "sm",
            margin: isLast ? "lg" : "md"
        };
        
        timelineContents.push(stepContent);
        
        // เส้นเชื่อม (ยกเว้นขั้นตอนสุดท้าย)
        if (!isLast) {
            const connectionContent = {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "separator",
                        color: settings.lineColor
                    }
                ],
                margin: "sm",
                paddingStart: `${parseInt(settings.dotSize)/2}px`
            };
            timelineContents.push(connectionContent);
        }
    }
    
    return timelineContents;
}

// ปรับปรุงฟังก์ชัน sendStatusUpdateToUser ให้ใช้ Timeline แทน
async function sendStatusUpdateToUser(requestDetails, newStatus, technicianNotes) {
    try {
        if (requestDetails.LINE_USER_ID && newStatus) {
            // ใช้ Timeline Status Message แทน simple status update
            const timelineStatusMessage = createTimelineStatusFlexMessage(requestDetails, newStatus);
            await lineService.pushMessage(requestDetails.LINE_USER_ID, [timelineStatusMessage]);
            
            // ส่งหมายเหตุแยกถ้ามี
            if (technicianNotes) {
                const noteMessage = {
                    type: 'text',
                    text: `📝 หมายเหตุจากเจ้าหน้าที่:\n${technicianNotes}`
                };
                await lineService.pushMessage(requestDetails.LINE_USER_ID, [noteMessage]);
            }
            
            // Send Telegram notification
            await notificationService.sendStatusUpdateNotification(requestDetails, newStatus, technicianNotes);
        }
    } catch (error) {
        console.error(`⚠️ Failed to send timeline status update to user ${requestDetails.LINE_USER_ID}:`, error.message);
        throw error;
    }
}

// Export เพิ่มเติม
module.exports = {
    // เดิม...
    handleWebhook,
    handlePersonalInfoSubmission,
    handleRepairFormSubmission,
    sendStatusUpdateToUser,
    updateFlexSettings,
    
    // เพิ่มใหม่
    createTimelineStatusFlexMessage,
    generateTimelineSteps,
    
    // เดิม...
    createWelcomeFlexMessage,
    createPersonalInfoFormFlexMessage,
    createRepairFormFlexMessage,
    createPersonalInfoConfirmationFlexMessage,
    createRepairConfirmationFlexMessage,
    createStatusUpdateFlexMessage,
    createTrackingMethodFlexMessage,
    createTrackingResultFlexMessage,
    setUserState,
    getUserState,
    setUserData,
    getUserData,
    clearUserStateAndData,
    getDefaultFlexSettings
};