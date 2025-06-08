// services/lineBotHandler.js - LINE Bot Handler with Customizable Flex Messages
const config = require('../config/config');
const googleSheetsService = require('./googleSheets');
const lineService = require('./lineService');
const notificationService = require('./notificationService');

// --- State Management ---
const userStates = new Map();
const userDataStore = new Map();

// Current flex message settings (loaded from database/config)
let currentFlexSettings = getDefaultFlexSettings();

// --- Utility Functions for STATE Management ---
function setUserState(userId, state) {
    if (state) { 
        userStates.set(userId, state); 
    } else { 
        userStates.delete(userId); 
    }
}

function getUserState(userId) { 
    return userStates.get(userId) || config.STATES.NONE; 
}

function setUserData(userId, data) {
    const currentData = userDataStore.get(userId) || {};
    const newData = { ...currentData, ...data };
    userDataStore.set(userId, newData);
}

function getUserData(userId) { 
    return userDataStore.get(userId) || {}; 
}

function clearUserStateAndData(userId) {
    userStates.delete(userId); 
    userDataStore.delete(userId);
}

// --- Flex Message Settings Management ---
function getDefaultFlexSettings() {
    return {
        welcome: {
            primaryColor: '#fbbf24',
            bgColor: '#f8fafc',
            buttonColor: '#f59e0b',
            title: '⚡ ระบบแจ้งซ่อมไฟฟ้า',
            subtitle: config.ORG_NAME || 'องค์การบริหารส่วนตำบลข่าใหญ่',
            message: '🙏 ยินดีต้อนรับท่านครับ',
            instruction: 'กรุณาเลือกบริการที่ต้องการใช้งาน',
            repairBtn: '🔧 แจ้งซ่อมไฟฟ้า',
            trackBtn: '📊 ติดตามการซ่อม'
        },
        form: {
            primaryColor: '#fbbf24',
            bgColor: '#ffffff',
            title: '📝 กรอกข้อมูลส่วนตัว',
            description: 'ข้อมูลสำหรับการติดต่อ',
            instruction: 'กรุณากรอกข้อมูลเพื่อให้เจ้าหน้าที่สามารถติดต่อกลับได้'
        },
        confirm: {
            primaryColor: '#10b981',
            bgColor: '#f0fdf4',
            title: '✅ ยืนยันข้อมูลส่วนตัว',
            message: 'ข้อมูลที่บันทึกไว้',
            instruction: 'กรุณาตรวจสอบความถูกต้อง'
        },
        status: {
            pendingColor: '#f59e0b',
            approvedColor: '#10b981',
            progressColor: '#3b82f6',
            completeColor: '#10b981',
            rejectedColor: '#ef4444',
            cancelledColor: '#6b7280'
        }
    };
}

function updateFlexSettings(newSettings) {
    currentFlexSettings = { ...currentFlexSettings, ...newSettings };
    console.log('✅ Flex Message settings updated');
}

// --- Customizable Flex Message Templates ---
function createWelcomeFlexMessage(customSettings = null) {
    const settings = customSettings || currentFlexSettings.welcome;
    
    return {
        type: "flex",
        altText: settings.title,
        contents: {
            type: "bubble",
            size: "kilo",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: settings.title,
                        weight: "bold",
                        size: "xl",
                        color: "#0f172a",
                        align: "center"
                    },
                    {
                        type: "text",
                        text: settings.subtitle,
                        size: "sm",
                        color: "#1e293b",
                        align: "center",
                        margin: "sm"
                    }
                ],
                backgroundColor: settings.primaryColor,
                paddingAll: "20px",
                spacing: "sm"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: settings.message,
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
                        align: "center"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: settings.buttonColor
                    },
                    {
                        type: "text",
                        text: settings.instruction,
                        size: "sm",
                        color: "#475569",
                        align: "center",
                        margin: "lg"
                    }
                ],
                spacing: "md",
                paddingAll: "20px",
                backgroundColor: settings.bgColor
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "message",
                            label: settings.repairBtn,
                            text: "แจ้งซ่อม"
                        },
                        color: settings.buttonColor,
                        flex: 1
                    },
                    {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: {
                            type: "message",
                            label: settings.trackBtn,
                            text: "ติดตามการซ่อม"
                        },
                        flex: 1
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#f1f5f9"
            }
        }
    };
}

function createPersonalInfoFormFlexMessage(userId, customSettings = null) {
    const settings = customSettings || currentFlexSettings.form;
    const formUrl = `${config.BASE_URL}/form?userId=${encodeURIComponent(userId)}`;
    
    return {
        type: "flex",
        altText: settings.title,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: settings.title,
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
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
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "✨",
                                        size: "xxl",
                                        color: settings.primaryColor,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: "#fff7ed",
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: settings.description,
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: settings.instruction,
                                        size: "sm",
                                        color: "#64748b",
                                        wrap: true,
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    },
                    {
                        type: "separator",
                        margin: "xl",
                        color: settings.primaryColor
                    },
                    // Form fields preview
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "xl",
                        spacing: "md",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "👤",
                                        size: "lg",
                                        flex: 0,
                                        color: settings.primaryColor
                                    },
                                    {
                                        type: "text",
                                        text: "คำนำหน้า ชื่อ นามสกุล",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f8fafc",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🎂",
                                        size: "lg",
                                        flex: 0,
                                        color: "#3b82f6"
                                    },
                                    {
                                        type: "text",
                                        text: "อายุ เชื้อชาติ สัญชาติ",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0f9ff",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📱",
                                        size: "lg",
                                        flex: 0,
                                        color: "#10b981"
                                    },
                                    {
                                        type: "text",
                                        text: "หมายเลขโทรศัพท์",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0fdf4",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🏠",
                                        size: "lg",
                                        flex: 0,
                                        color: "#8b5cf6"
                                    },
                                    {
                                        type: "text",
                                        text: "ที่อยู่ (บ้านเลขที่ หมู่ที่)",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#faf5ff",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            }
                        ]
                    }
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
                        style: "primary",
                        action: {
                            type: "uri",
                            label: "📝 เปิดฟอร์มกรอกข้อมูล",
                            uri: formUrl
                        },
                        color: settings.primaryColor,
                        height: "md"
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#fff7ed"
            }
        }
    };
}

function createRepairFormFlexMessage(userId, customSettings = null) {
    const settings = customSettings || currentFlexSettings.form;
    const formUrl = `${config.BASE_URL}/repair-form.html?userId=${encodeURIComponent(userId)}`;
    
    return {
        type: "flex",
        altText: "แบบฟอร์มแจ้งซ่อมไฟฟ้า",
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "🔧 แจ้งซ่อมไฟฟ้า",
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
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
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "⚡",
                                        size: "xxl",
                                        color: settings.primaryColor,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: "#fff7ed",
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "กรอกแบบฟอร์มแจ้งซ่อม",
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: "ระบุรายละเอียดปัญหาไฟฟ้าพร้อมตำแหน่งที่ตั้ง",
                                        size: "sm",
                                        color: "#64748b",
                                        wrap: true,
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    },
                    {
                        type: "separator",
                        margin: "xl",
                        color: settings.primaryColor
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "xl",
                        spacing: "md",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🗼",
                                        size: "lg",
                                        flex: 0,
                                        color: "#3b82f6"
                                    },
                                    {
                                        type: "text",
                                        text: "รหัสเสาไฟฟ้า (หากทราบ)",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0f9ff",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📍",
                                        size: "lg",
                                        flex: 0,
                                        color: "#10b981"
                                    },
                                    {
                                        type: "text",
                                        text: "ตำแหน่งที่ตั้ง/พิกัด GPS",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0fdf4",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "⚠️",
                                        size: "lg",
                                        flex: 0,
                                        color: "#ef4444"
                                    },
                                    {
                                        type: "text",
                                        text: "ลักษณะปัญหา/อาการ",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#fef2f2",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📸",
                                        size: "lg",
                                        flex: 0,
                                        color: "#8b5cf6"
                                    },
                                    {
                                        type: "text",
                                        text: "รูปภาพประกอบ (ถ้ามี)",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 1,
                                        margin: "sm",
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#faf5ff",
                                paddingAll: "10px",
                                cornerRadius: "8px"
                            }
                        ]
                    }
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
                        style: "primary",
                        action: {
                            type: "uri",
                            label: "📝 เปิดฟอร์มแจ้งซ่อม",
                            uri: formUrl
                        },
                        color: settings.primaryColor,
                        height: "md"
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#fff7ed"
            }
        }
    };
}

function createPersonalInfoConfirmationFlexMessage(userData, customSettings = null) {
    const settings = customSettings || currentFlexSettings.confirm;
    
    return {
        type: "flex",
        altText: settings.title,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: settings.title,
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
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
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "👤",
                                        size: "xxl",
                                        color: settings.primaryColor,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: settings.bgColor,
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: settings.message,
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: settings.instruction,
                                        size: "sm",
                                        color: "#64748b",
                                        wrap: true,
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    },
                    {
                        type: "separator",
                        margin: "xl",
                        color: settings.primaryColor
                    },
                    // User data display
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "xl",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "👤 ชื่อ:",
                                        size: "sm",
                                        color: settings.primaryColor,
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: `${userData.prefix || ''}${userData.firstName || ''} ${userData.lastName || ''}`,
                                        size: "sm",
                                        flex: 3,
                                        wrap: true,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#fff7ed",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🎂 อายุ:",
                                        size: "sm",
                                        color: "#3b82f6",
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: userData.age ? `${userData.age} ปี` : 'ไม่ระบุ',
                                        size: "sm",
                                        flex: 3,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#f0f9ff",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🌏 เชื้อชาติ:",
                                        size: "sm",
                                        color: "#10b981",
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: userData.ethnicity || 'ไม่ระบุ',
                                        size: "sm",
                                        flex: 3,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#f0fdf4",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🏳️ สัญชาติ:",
                                        size: "sm",
                                        color: "#8b5cf6",
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: userData.nationality || 'ไม่ระบุ',
                                        size: "sm",
                                        flex: 3,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#faf5ff",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📱 โทร:",
                                        size: "sm",
                                        color: "#ef4444",
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: userData.phone || 'ไม่ระบุ',
                                        size: "sm",
                                        flex: 3,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#fef2f2",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🏠 ที่อยู่:",
                                        size: "sm",
                                        color: settings.primaryColor,
                                        flex: 2,
                                        weight: "bold"
                                    },
                                    {
                                        type: "text",
                                        text: `บ้านเลขที่ ${userData.houseNo || ''}, ${userData.moo || ''}`,
                                        size: "sm",
                                        flex: 3,
                                        wrap: true,
                                        color: "#1e293b"
                                    }
                                ],
                                backgroundColor: "#fff7ed",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            }
                        ]
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#ffffff"
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        action: {
                            type: "message",
                            label: "✅ ถูกต้อง ดำเนินการต่อ",
                            text: "ยืนยันข้อมูล"
                        },
                        color: settings.primaryColor,
                        height: "md"
                    },
                    {
                        type: "button",
                        style: "secondary",
                        action: {
                            type: "message",
                            label: "✏️ แก้ไขข้อมูล",
                            text: "แก้ไขข้อมูล"
                        }
                    }
                ],
                paddingAll: "20px",
                backgroundColor: settings.bgColor
            }
        }
    };
}

function createRepairConfirmationFlexMessage(requestData, customSettings = null) {
    const settings = customSettings || currentFlexSettings.confirm;
    
    return {
        type: "flex",
        altText: `การแจ้งซ่อมเลขที่ ${requestData.requestId} สำเร็จ`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "✅ แจ้งซ่อมสำเร็จ",
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
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🎫",
                                        size: "xxl",
                                        color: settings.primaryColor,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: settings.bgColor,
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "เลขที่การแจ้งซ่อม",
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: requestData.requestId,
                                        weight: "bold",
                                        size: "xl",
                                        color: "#f59e0b",
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    },
                    {
                        type: "separator",
                        margin: "xl",
                        color: settings.primaryColor
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "xl",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🗼",
                                        size: "lg",
                                        flex: 0,
                                        color: "#3b82f6"
                                    },
                                    {
                                        type: "text",
                                        text: "รหัสเสา:",
                                        size: "sm",
                                        color: "#64748b",
                                        flex: 1,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: requestData.poleId || "ไม่ระบุ",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 2,
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0f9ff",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📍",
                                        size: "lg",
                                        flex: 0,
                                        color: "#10b981"
                                    },
                                    {
                                        type: "text",
                                        text: "ตำแหน่ง:",
                                        size: "sm",
                                        color: "#64748b",
                                        flex: 1,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: requestData.latitude && requestData.longitude ? 
                                            `${parseFloat(requestData.latitude).toFixed(4)}, ${parseFloat(requestData.longitude).toFixed(4)}` : "ไม่ระบุ",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 2,
                                        wrap: true,
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#f0fdf4",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "⚠️",
                                        size: "lg",
                                        flex: 0,
                                        color: "#ef4444"
                                    },
                                    {
                                        type: "text",
                                        text: "ปัญหา:",
                                        size: "sm",
                                        color: "#64748b",
                                        flex: 1,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: requestData.problemDescription || requestData.reason,
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 3,
                                        wrap: true,
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#fef2f2",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            },
                            {
                                type: "box",
                                layout: "horizontal",
                                contents: [
                                    {
                                        type: "text",
                                        text: "📸",
                                        size: "lg",
                                        flex: 0,
                                        color: "#8b5cf6"
                                    },
                                    {
                                        type: "text",
                                        text: "รูปภาพ:",
                                        size: "sm",
                                        color: "#64748b",
                                        flex: 1,
                                        margin: "sm"
                                    },
                                    {
                                        type: "text",
                                        text: requestData.photoBase64 || requestData.photoMessageId ? "✅ มี" : "❌ ไม่มี",
                                        size: "sm",
                                        color: "#1e293b",
                                        flex: 2,
                                        weight: "bold"
                                    }
                                ],
                                backgroundColor: "#faf5ff",
                                paddingAll: "8px",
                                cornerRadius: "8px"
                            }
                        ]
                    },
                    {
                        type: "separator",
                        margin: "xl",
                        color: "#d1d5db"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "📞",
                                size: "lg",
                                color: "#f59e0b",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: "เจ้าหน้าที่จะดำเนินการตรวจสอบและติดต่อกลับโดยเร็วที่สุด",
                                size: "sm",
                                color: "#64748b",
                                wrap: true,
                                flex: 1,
                                margin: "sm"
                            }
                        ],
                        backgroundColor: "#fff7ed",
                        paddingAll: "12px",
                        cornerRadius: "8px",
                        margin: "lg"
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#ffffff"
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        action: {
                            type: "postback",
                            label: "📋 คัดลอกรหัสแจ้งซ่อม",
                            data: `copy_request_id_${requestData.requestId}`,
                            displayText: requestData.requestId
                        },
                        color: settings.primaryColor,
                        height: "sm"
                    },
                    {
                        type: "button",
                        style: "link",
                        action: {
                            type: "message",
                            label: "📊 ติดตามสถานะ",
                            text: "ติดตามการซ่อม"
                        }
                    }
                ],
                paddingAll: "20px",
                backgroundColor: settings.bgColor
            }
        }
    };
}

function createStatusUpdateFlexMessage(requestData, newStatus, technicianNotes, customSettings = null) {
    const statusSettings = customSettings || currentFlexSettings.status;
    
    const statusConfigs = {
        'รอดำเนินการ': { 
            emoji: '⏳', 
            color: statusSettings.pendingColor, 
            bgColor: '#fff7ed',
            headerBg: statusSettings.pendingColor
        },
        'อนุมัติแล้วรอช่าง': { 
            emoji: '✅', 
            color: statusSettings.approvedColor, 
            bgColor: '#f0fdf4',
            headerBg: statusSettings.approvedColor
        },
        'กำลังดำเนินการ': { 
            emoji: '🔧', 
            color: statusSettings.progressColor, 
            bgColor: '#f0f9ff',
            headerBg: statusSettings.progressColor
        },
        'เสร็จสิ้น': { 
            emoji: '🎉', 
            color: statusSettings.completeColor, 
            bgColor: '#f0fdf4',
            headerBg: statusSettings.completeColor
        },
        'ไม่อนุมัติโดยผู้บริหาร': { 
            emoji: '❌', 
            color: statusSettings.rejectedColor, 
            bgColor: '#fef2f2',
            headerBg: statusSettings.rejectedColor
        },
        'ยกเลิก': { 
            emoji: '🚫', 
            color: statusSettings.cancelledColor, 
            bgColor: '#f9fafb',
            headerBg: statusSettings.cancelledColor
        }
    };

    const config = statusConfigs[newStatus] || statusConfigs['รอดำเนินการ'];

    return {
        type: "flex",
        altText: `อัปเดตสถานะ: ${newStatus}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${config.emoji} อัปเดตสถานะ`,
                        weight: "bold",
                        size: "lg",
                        color: "#ffffff",
                        align: "center"
                    }
                ],
                backgroundColor: config.headerBg,
                paddingAll: "20px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: config.emoji,
                                        size: "xxl",
                                        color: config.color,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: config.bgColor,
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: `🎫 ${requestData.REQUEST_ID}`,
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: `สถานะ: ${newStatus}`,
                                        size: "sm",
                                        color: config.color,
                                        weight: "bold",
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    },
                    ...(technicianNotes ? [
                        {
                            type: "separator",
                            margin: "xl",
                            color: config.color
                        },
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                {
                                    type: "text",
                                    text: "📝",
                                    size: "lg",
                                    color: config.color,
                                    flex: 0
                                },
                                {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        {
                                            type: "text",
                                            text: "หมายเหตุจากเจ้าหน้าที่:",
                                            size: "sm",
                                            color: "#64748b",
                                            weight: "bold"
                                        },
                                        {
                                            type: "text",
                                            text: technicianNotes,
                                            size: "sm",
                                            wrap: true,
                                            margin: "sm",
                                            color: "#1e293b"
                                        }
                                    ],
                                    flex: 1,
                                    margin: "sm"
                                }
                            ],
                            backgroundColor: config.bgColor,
                            paddingAll: "12px",
                            cornerRadius: "8px",
                            margin: "lg"
                        }
                    ] : [])
                ],
                paddingAll: "20px",
                backgroundColor: "#ffffff"
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
                backgroundColor: config.bgColor
            }
        }
    };
}

function createTrackingMethodFlexMessage(customSettings = null) {
    const settings = customSettings || currentFlexSettings.welcome;
    
    return {
        type: "flex",
        altText: "เลือกวิธีติดตามการซ่อม",
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "📊 ติดตามการซ่อม",
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
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
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "🔍",
                                        size: "xxl",
                                        color: settings.primaryColor,
                                        align: "center"
                                    }
                                ],
                                flex: 0,
                                paddingAll: "10px",
                                backgroundColor: "#fff7ed",
                                cornerRadius: "15px"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "เลือกวิธีติดตาม",
                                        weight: "bold",
                                        size: "md",
                                        color: "#0f172a"
                                    },
                                    {
                                        type: "text",
                                        text: "กรุณาเลือกวิธีการค้นหาข้อมูลการแจ้งซ่อมของท่าน",
                                        size: "sm",
                                        color: "#64748b",
                                        wrap: true,
                                        margin: "sm"
                                    }
                                ],
                                flex: 1,
                                margin: "md"
                            }
                        ],
                        margin: "lg"
                    }
                ],
                paddingAll: "20px",
                backgroundColor: settings.bgColor
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        action: {
                            type: "message",
                            label: "🎫 ใช้เลขที่การแจ้งซ่อม",
                            text: "ติดตามด้วยเลขที่"
                        },
                        color: settings.buttonColor,
                        height: "md"
                    },
                    {
                        type: "button",
                        style: "secondary",
                        action: {
                            type: "message",
                            label: "📱 ใช้เบอร์โทรศัพท์",
                            text: "ติดตามด้วยเบอร์โทร"
                        }
                    }
                ],
                paddingAll: "20px",
                backgroundColor: "#fff7ed"
            }
        }
    };
}

function createTrackingResultFlexMessage(requests, customSettings = null) {
    const settings = customSettings || currentFlexSettings.welcome;
    
    if (!requests || requests.length === 0) {
        return {
            type: "flex",
            altText: "ไม่พบข้อมูลการแจ้งซ่อม",
            contents: {
                type: "bubble",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "❌ ไม่พบข้อมูล",
                            weight: "bold",
                            size: "lg",
                            color: "#ffffff",
                            align: "center"
                        }
                    ],
                    backgroundColor: "#ef4444",
                    paddingAll: "20px"
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "text",
                            text: "ไม่พบข้อมูลการแจ้งซ่อมตามเงื่อนไขที่ระบุ",
                            size: "md",
                            color: "#1e293b",
                            align: "center",
                            wrap: true
                        }
                    ],
                    paddingAll: "20px"
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "button",
                            style: "secondary",
                            action: {
                                type: "message",
                                label: "🔄 ค้นหาใหม่",
                                text: "ติดตามการซ่อม"
                            }
                        }
                    ],
                    paddingAll: "20px"
                }
            }
        };
    }

    // For tracking results, return simplified bubble showing request info
    const request = requests[0]; // Show first result for simplicity
    
    return {
        type: "flex",
        altText: `สถานะการซ่อม: ${request.STATUS}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "📊 ผลการค้นหา",
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
                    {
                        type: "text",
                        text: `🎫 ${request.REQUEST_ID}`,
                        weight: "bold",
                        size: "lg",
                        color: "#0f172a",
                        align: "center"
                    },
                    {
                        type: "text",
                        text: `สถานะ: ${request.STATUS}`,
                        size: "md",
                        color: settings.buttonColor,
                        align: "center",
                        margin: "sm",
                        weight: "bold"
                    },
                    {
                        type: "separator",
                        margin: "lg",
                        color: settings.primaryColor
                    },
                    {
                        type: "text",
                        text: `วันที่แจ้ง: ${request.DATE_REPORTED || 'ไม่ระบุ'}`,
                        size: "sm",
                        color: "#64748b",
                        margin: "lg"
                    },
                    {
                        type: "text",
                        text: `ปัญหา: ${request.PROBLEM_DESCRIPTION || request.REASON || 'ไม่ระบุ'}`,
                        size: "sm",
                        color: "#64748b",
                        wrap: true,
                        margin: "sm"
                    }
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
                        style: "secondary",
                        action: {
                            type: "message",
                            label: "🔄 ค้นหาใหม่",
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

// --- Main Handler Functions ---
async function handleWebhook(req, res) {
    try {
        const events = req.body.events;
        if (!events || events.length === 0) {
            return res.status(200).json({ status: 'success', message: 'No events to process' });
        }
        
        for (const event of events) {
            if (!event.source || !event.source.userId) {
                console.warn('⚠️ Event without userId, skipping:', JSON.stringify(event));
                continue;
            }
            
            const userId = event.source.userId;
            
            if (event.type === 'follow') {
                await handleFollowEvent(userId, event.replyToken);
            } else if (event.type === 'message') {
                await handleMessageEvent(userId, event.message, event.replyToken);
            } else if (event.type === 'postback') {
                await handlePostbackEvent(userId, event.postback, event.replyToken);
            }
        }
        
        res.status(200).json({ status: 'success', message: 'Events processed' });
    } catch (error) {
        console.error('❌ Error in /webhook:', error.message, error.stack);
        res.status(200).json({ status: 'error', message: 'Internal server error occurred' });
    }
}

async function handlePersonalInfoSubmission(formData) {
    try {
        const { lineUserId, titlePrefix, firstName, lastName, age, ethnicity, nationality, phone, houseNo, moo } = formData;
        
        // Validate required fields
        if (!lineUserId || !titlePrefix || !firstName || !lastName || !phone || !houseNo || !moo) {
            throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
        }
        
        // Validate phone format
        if (!/^[0-9]{9,10}$/.test(phone)) {
            throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (9-10 หลัก)');
        }
        
        // Validate age if provided
        if (age && (isNaN(parseInt(age)) || parseInt(age) < 1 || parseInt(age) > 120)) {
            throw new Error('กรุณากรอกอายุที่ถูกต้อง (1-120 ปี)');
        }
        
        const userProfile = await lineService.getLineUserProfile(lineUserId);
        const lineDisplayName = userProfile ? userProfile.displayName : 'N/A';

        const personalData = { 
            lineUserId, 
            lineDisplayName, 
            prefix: titlePrefix, 
            firstName, 
            lastName, 
            age: age || '',
            ethnicity: ethnicity || '',
            nationality: nationality || '',
            phone, 
            houseNo, 
            moo, 
            personalInfoConfirmed: false 
        };
        
        setUserData(lineUserId, personalData);
        setUserState(lineUserId, config.STATES.AWAITING_USER_DATA_CONFIRMATION);

        const confirmationMessage = createPersonalInfoConfirmationFlexMessage(personalData);
        await lineService.pushMessage(lineUserId, [confirmationMessage]);
        
        return { 
            success: true, 
            message: 'ข้อมูลของท่านถูกส่งไปยัง LINE เพื่อยืนยันแล้ว กรุณากลับไปที่แอปพลิเคชัน LINE' 
        };
    } catch (error) {
        console.error('❌ Error in handlePersonalInfoSubmission:', error.message);
        throw error;
    }
}

async function handleRepairFormSubmission(formData) {
    try {
        const { lineUserId, poleId, latitude, longitude, problemDescription, photoBase64 } = formData;
        
        if (!lineUserId || !problemDescription) {
            throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
        }

        // Get user profile from LINE
        const userProfile = await lineService.getLineUserProfile(lineUserId);
        const lineDisplayName = userProfile ? userProfile.displayName : 'ผู้ใช้ LINE';

        // Get personal details
        const personalDetails = await googleSheetsService.getUserPersonalDetails(lineUserId);

        // Generate request ID
        const requestId = await googleSheetsService.generateRequestId();

        // Prepare request data
        const requestData = {
            lineUserId,
            lineDisplayName,
            requestId,
            poleId: poleId || 'ไม่ระบุ',
            latitude: latitude || null,
            longitude: longitude || null,
            problemDescription,
            photoBase64: photoBase64 || null,
            dateReported: new Date().toLocaleString('th-TH', { timeZone: config.TIMEZONE }),
            status: 'รอดำเนินการ',
            personalDetails: personalDetails || {}
        };

        // Save to Google Sheets
        const success = await googleSheetsService.saveRepairRequestFromForm(requestData);
        
        if (success) {
            // Send confirmation flex message
            const confirmationMessage = createRepairConfirmationFlexMessage(requestData);
            await lineService.pushMessage(lineUserId, [confirmationMessage]);
            
            // Send notification
            await notificationService.sendNewRequestNotification(requestData);
            
            return { 
                success: true, 
                message: 'ส่งข้อมูลการแจ้งซ่อมสำเร็จ',
                requestId: requestId
            };
        } else {
            throw new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    } catch (error) {
        console.error('❌ Error in handleRepairFormSubmission:', error.message);
        throw error;
    }
}

async function sendStatusUpdateToUser(requestDetails, newStatus, technicianNotes) {
    try {
        if (requestDetails.LINE_USER_ID && newStatus) {
            const statusUpdateMessage = createStatusUpdateFlexMessage(requestDetails, newStatus, technicianNotes);
            await lineService.pushMessage(requestDetails.LINE_USER_ID, [statusUpdateMessage]);
            
            // Send Telegram notification
            await notificationService.sendStatusUpdateNotification(requestDetails, newStatus, technicianNotes);
        }
    } catch (error) {
        console.error(`⚠️ Failed to send status update to user ${requestDetails.LINE_USER_ID}:`, error.message);
        throw error;
    }
}

// --- Event Handlers ---
async function handleFollowEvent(userId, replyToken) {
    console.log(`➕ User ${userId} followed the bot.`);
    const welcomeMessage = createWelcomeFlexMessage();
    await lineService.replyToUser(replyToken, [welcomeMessage]);
}

async function handleMessageEvent(userId, message, replyToken) {
    if (message.type === 'text') {
        const userText = message.text.trim();
        await processUserText(userId, userText, replyToken);
    } else {
        await lineService.replyToUser(replyToken, 'ขออภัยครับ ระบบรองรับเฉพาะข้อความเท่านั้น');
    }
}

async function handlePostbackEvent(userId, postback, replyToken) {
    const postbackData = postback.data;
    await processUserText(userId, postbackData, replyToken);
}

async function processUserText(userId, text, replyToken) {
    const lowerText = text.toLowerCase();
    const currentState = getUserState(userId);
    let currentData = getUserData(userId);

    if (lowerText === 'ยกเลิก' || lowerText === 'cancel') {
        clearUserStateAndData(userId);
        await lineService.replyToUser(replyToken, '🔄 การดำเนินการปัจจุบันถูกยกเลิกแล้วครับ\nหากต้องการเริ่มใหม่ กรุณาเลือกจากเมนูหลัก');
        const welcomeMessage = createWelcomeFlexMessage();
        await lineService.pushMessage(userId, [welcomeMessage]);
        return;
    }

    // Handle tracking states
    if (currentState === config.STATES.AWAITING_TRACKING_METHOD) {
        if (lowerText === 'ติดตามด้วยเลขที่') {
            setUserState(userId, config.STATES.AWAITING_REQUEST_ID);
            await lineService.replyToUser(replyToken, '🎫 กรุณาระบุเลขที่การแจ้งซ่อม\n(ตัวอย่าง: 2506-001)\n\nหรือพิมพ์ "ยกเลิก" เพื่อกลับเมนูหลัก');
        } else if (lowerText === 'ติดตามด้วยเบอร์โทร') {
            setUserState(userId, config.STATES.AWAITING_PHONE_NUMBER);
            await lineService.replyToUser(replyToken, '📱 กรุณาระบุเบอร์โทรศัพท์ที่ใช้แจ้งซ่อม\n(ตัวอย่าง: 0812345678)\n\nหรือพิมพ์ "ยกเลิก" เพื่อกลับเมนูหลัก');
        } else {
            await lineService.replyToUser(replyToken, '❌ กรุณาเลือกวิธีติดตามที่ถูกต้อง');
        }
        return;
    }

    if (currentState === config.STATES.AWAITING_REQUEST_ID) {
        const requestId = text.trim();
        try {
            const request = await googleSheetsService.findRepairRequestById(requestId);
            if (request) {
                const resultMessage = createTrackingResultFlexMessage([request]);
                await lineService.replyToUser(replyToken, [resultMessage]);
            } else {
                const notFoundMessage = createTrackingResultFlexMessage([]);
                await lineService.replyToUser(replyToken, [notFoundMessage]);
            }
            clearUserStateAndData(userId);
        } catch (error) {
            console.error('Error searching by request ID:', error);
            await lineService.replyToUser(replyToken, '❌ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง');
        }
        return;
    }

    if (currentState === config.STATES.AWAITING_PHONE_NUMBER) {
        const phoneNumber = text.trim();
        if (!/^[0-9]{9,10}$/.test(phoneNumber)) {
            await lineService.replyToUser(replyToken, '❌ รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง\nกรุณาใส่เบอร์โทรศัพท์ 9-10 หลัก');
            return;
        }
        
        try {
            const requests = await googleSheetsService.findRepairRequestsByPhone(phoneNumber);
            const resultMessage = createTrackingResultFlexMessage(requests);
            await lineService.replyToUser(replyToken, [resultMessage]);
            clearUserStateAndData(userId);
        } catch (error) {
            console.error('Error searching by phone number:', error);
            await lineService.replyToUser(replyToken, '❌ เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง');
        }
        return;
    }

    if (lowerText === 'ติดตามการซ่อม' || lowerText === 'ติดตาม') {
        await initiateTrackingProcess(userId, replyToken);
        return;
    }

    switch (currentState) {
        case config.STATES.NONE:
            if (lowerText === 'แจ้งซ่อม' || lowerText === 'แจ้งปัญหา' || lowerText === 'เริ่มแจ้งซ่อม') {
                await initiateRepairProcess(userId, replyToken);
            } else {
                const welcomeMessage = createWelcomeFlexMessage();
                await lineService.replyToUser(replyToken, [welcomeMessage]);
            }
            break;

        case config.STATES.AWAITING_FORM_COMPLETION:
            if (lowerText === 'แจ้งซ่อม' || lowerText === 'แจ้งปัญหา') {
                await initiateRepairProcess(userId, replyToken);
            } else {
                await lineService.replyToUser(replyToken, '📝 กรุณากรอกข้อมูลในฟอร์มที่ส่งให้ก่อนครับ\nหรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่');
            }
            break;

        case config.STATES.AWAITING_USER_DATA_CONFIRMATION:
            if (lowerText === 'ยืนยันข้อมูล') {
                currentData.personalInfoConfirmed = true;
                setUserData(userId, currentData);
                const savedToSheet = await googleSheetsService.saveOrUpdateUserPersonalDetails(userId, currentData);
                if (savedToSheet) {
                    clearUserStateAndData(userId);
                    const repairFormMessage = createRepairFormFlexMessage(userId);
                    await lineService.pushMessage(userId, `✅ ข้อมูลของท่านได้รับการยืนยันและบันทึกแล้วครับ\n\n📝 ต่อไปกรุณากรอกแบบฟอร์มแจ้งซ่อม`);
                    await lineService.pushMessage(userId, [repairFormMessage]);
                } else {
                    await lineService.replyToUser(replyToken, `❌ ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกข้อมูล\nกรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่`);
                    clearUserStateAndData(userId);
                }
            } else if (lowerText === 'แก้ไขข้อมูล') {
                const personalFormMessage = createPersonalInfoFormFlexMessage(userId);
                await lineService.replyToUser(replyToken, [personalFormMessage]);
                setUserState(userId, config.STATES.AWAITING_FORM_COMPLETION);
            } else {
                await lineService.replyToUser(replyToken, '❓ กรุณาเลือกจากตัวเลือกที่ให้ไว้\n"ยืนยันข้อมูล", "แก้ไขข้อมูล" หรือ "ยกเลิก"');
            }
            break;

        default:
            const welcomeMessage = createWelcomeFlexMessage();
            await lineService.replyToUser(replyToken, [welcomeMessage]);
            break;
    }
}

async function initiateRepairProcess(userId, replyToken) {
    clearUserStateAndData(userId);
    
    // Check if user has personal details
    const existingDetails = await googleSheetsService.getUserPersonalDetails(userId);
    
    if (existingDetails && existingDetails.firstName) {
        // Has data -> show confirmation before repair form
        setUserData(userId, { ...existingDetails, personalInfoConfirmed: false });
        setUserState(userId, config.STATES.AWAITING_USER_DATA_CONFIRMATION);
        
        const confirmationMessage = createPersonalInfoConfirmationFlexMessage(existingDetails);
        await lineService.replyToUser(replyToken, [confirmationMessage]);
    } else {
        // No data -> show personal info form first
        const personalFormMessage = createPersonalInfoFormFlexMessage(userId);
        await lineService.replyToUser(replyToken, [personalFormMessage]);
        setUserState(userId, config.STATES.AWAITING_FORM_COMPLETION);
    }
}

async function initiateTrackingProcess(userId, replyToken) {
    clearUserStateAndData(userId);
    setUserState(userId, config.STATES.AWAITING_TRACKING_METHOD);
    
    const trackingMessage = createTrackingMethodFlexMessage();
    await lineService.replyToUser(replyToken, [trackingMessage]);
}

// Initialize flex settings from database on startup
async function initializeFlexSettings() {
    try {
        const settings = await googleSheetsService.getFlexMessageSettings();
        if (settings) {
            currentFlexSettings = settings;
            console.log('✅ Flex Message settings loaded from database');
        } else {
            console.log('ℹ️ Using default Flex Message settings');
        }
    } catch (error) {
        console.warn('⚠️ Could not load Flex Message settings, using defaults:', error.message);
    }
}

// Initialize on module load
initializeFlexSettings();

// Export all functions
module.exports = {
    // Main handlers
    handleWebhook,
    handlePersonalInfoSubmission,
    handleRepairFormSubmission,
    sendStatusUpdateToUser,
    
    // Settings management
    updateFlexSettings,
    
    // Flex message creators (for testing and custom use)
    createWelcomeFlexMessage,
    createPersonalInfoFormFlexMessage,
    createRepairFormFlexMessage,
    createPersonalInfoConfirmationFlexMessage,
    createRepairConfirmationFlexMessage,
    createStatusUpdateFlexMessage,
    createTrackingMethodFlexMessage,
    createTrackingResultFlexMessage,
    
    // State management (for external use if needed)
    setUserState,
    getUserState,
    setUserData,
    getUserData,
    clearUserStateAndData,
    
    // Settings helpers
    getDefaultFlexSettings
};