// auth-utils.js - Enhanced Authentication utilities for อบต.ข่าใหญ่ Admin System

/**
 * Enhanced Authentication and Session Management Utilities
 * รองรับ Multi-system และ Multi-role authentication
 */
class AuthUtils {
    constructor() {
        this.API_BASE = '';
        this.LOGIN_PAGE = '/admin/smart-login.html';
        
        // Token keys for different systems
        this.PC_TOKEN_KEY = 'pc_token';
        this.EXECUTIVE_TOKEN_KEY = 'executive_token';
        this.TECHNICIAN_TOKEN_KEY = 'technician_token';
        this.ADMIN_TOKEN_KEY = 'admin_token';
        
        // User data keys
        this.PC_USER_KEY = 'pc_user';
        this.EXECUTIVE_USER_KEY = 'executive_user';
        this.TECHNICIAN_USER_KEY = 'technician_user';
        this.ADMIN_USER_KEY = 'admin_user';
        
        // System priorities (higher number = higher priority)
        this.SYSTEM_PRIORITY = {
            'pc': 4,
            'admin': 3,
            'executive': 2,
            'technician': 1
        };
        
        // Role display names
        this.ROLE_NAMES = {
            'executive': 'ผู้บริหาร',
            'technician': 'ช่างเทคนิค', 
            'admin': 'ผู้ดูแลระบบ'
        };
    }

    /**
     * Get current user data based on current system (ปรับปรุงใหม่)
     * ตรวจสอบทุก system และ return ระบบที่มี priority สูงสุด
     */
    getCurrentUser() {
        const sessions = [
            {
                token: localStorage.getItem(this.PC_TOKEN_KEY),
                user: localStorage.getItem(this.PC_USER_KEY),
                system: 'pc',
                priority: this.SYSTEM_PRIORITY.pc
            },
            {
                token: localStorage.getItem(this.ADMIN_TOKEN_KEY),
                user: localStorage.getItem(this.ADMIN_USER_KEY),
                system: 'admin',
                priority: this.SYSTEM_PRIORITY.admin
            },
            {
                token: localStorage.getItem(this.EXECUTIVE_TOKEN_KEY),
                user: localStorage.getItem(this.EXECUTIVE_USER_KEY),
                system: 'executive',
                priority: this.SYSTEM_PRIORITY.executive
            },
            {
                token: localStorage.getItem(this.TECHNICIAN_TOKEN_KEY),
                user: localStorage.getItem(this.TECHNICIAN_USER_KEY),
                system: 'technician',
                priority: this.SYSTEM_PRIORITY.technician
            }
        ];

        // กรองเอาเฉพาะ session ที่มี token และ user
        const validSessions = sessions.filter(session => 
            session.token && session.user
        );

        if (validSessions.length === 0) {
            return null;
        }

        // เรียงตาม priority และเอาตัวสูงสุด
        validSessions.sort((a, b) => b.priority - a.priority);
        const currentSession = validSessions[0];

        try {
            return {
                token: currentSession.token,
                user: JSON.parse(currentSession.user),
                system: currentSession.system
            };
        } catch (e) {
            console.error('Error parsing user data:', e);
            // ลบ session ที่เสียหาย
            this.clearSessionBySystem(currentSession.system);
            return null;
        }
    }

    /**
     * Get user by specific system
     */
    getUserBySystem(system) {
        const tokenKey = this[`${system.toUpperCase()}_TOKEN_KEY`];
        const userKey = this[`${system.toUpperCase()}_USER_KEY`];
        
        if (!tokenKey || !userKey) {
            console.error(`Invalid system: ${system}`);
            return null;
        }

        const token = localStorage.getItem(tokenKey);
        const user = localStorage.getItem(userKey);
        
        if (token && user) {
            try {
                return {
                    token: token,
                    user: JSON.parse(user),
                    system: system
                };
            } catch (e) {
                console.error(`Error parsing user data for ${system}:`, e);
                this.clearSessionBySystem(system);
            }
        }
        
        return null;
    }

    /**
     * Clear session by specific system
     */
    clearSessionBySystem(system) {
        const tokenKey = this[`${system.toUpperCase()}_TOKEN_KEY`];
        const userKey = this[`${system.toUpperCase()}_USER_KEY`];
        
        if (tokenKey) localStorage.removeItem(tokenKey);
        if (userKey) localStorage.removeItem(userKey);
    }

    /**
     * Check if user is authenticated for any system
     */
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }

    /**
     * Check if user has specific role
     */
    hasRole(role) {
        const currentUser = this.getCurrentUser();
        return currentUser && currentUser.user && currentUser.user.role === role;
    }

    /**
     * Check if user has any of the specified roles
     */
    hasAnyRole(roles) {
        if (!Array.isArray(roles)) {
            return this.hasRole(roles);
        }
        
        const currentUser = this.getCurrentUser();
        if (!currentUser || !currentUser.user) {
            return false;
        }
        
        return roles.includes(currentUser.user.role);
    }

    /**
     * Get current user's role
     */
    getCurrentRole() {
        const currentUser = this.getCurrentUser();
        return currentUser && currentUser.user ? currentUser.user.role : null;
    }

    /**
     * Get role display name
     */
    getRoleDisplayName(role = null) {
        const userRole = role || this.getCurrentRole();
        return this.ROLE_NAMES[userRole] || userRole || 'ไม่ระบุ';
    }

    /**
     * Get authorization header for API calls
     */
    getAuthHeader() {
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.token) {
            return {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            };
        }
        return { 'Content-Type': 'application/json' };
    }

    /**
     * Clear all session data (ปรับปรุงให้ครอบคลุมทุก system)
     */
    clearAllSessions() {
        // Remove all authentication tokens
        localStorage.removeItem(this.PC_TOKEN_KEY);
        localStorage.removeItem(this.EXECUTIVE_TOKEN_KEY);
        localStorage.removeItem(this.TECHNICIAN_TOKEN_KEY);
        localStorage.removeItem(this.ADMIN_TOKEN_KEY);
        
        // Remove all user data
        localStorage.removeItem(this.PC_USER_KEY);
        localStorage.removeItem(this.EXECUTIVE_USER_KEY);
        localStorage.removeItem(this.TECHNICIAN_USER_KEY);
        localStorage.removeItem(this.ADMIN_USER_KEY);
        
        // Clear any other session-related data
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('_token') || key.includes('_user') || key.includes('_session'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Save session for specific system
     */
    saveSession(system, token, userData) {
        const tokenKey = this[`${system.toUpperCase()}_TOKEN_KEY`];
        const userKey = this[`${system.toUpperCase()}_USER_KEY`];
        
        if (!tokenKey || !userKey) {
            console.error(`Invalid system: ${system}`);
            return false;
        }
        
        try {
            localStorage.setItem(tokenKey, token);
            localStorage.setItem(userKey, JSON.stringify(userData));
            return true;
        } catch (error) {
            console.error(`Error saving session for ${system}:`, error);
            return false;
        }
    }

    /**
     * Logout user and redirect to login page
     */
    logout(message = null) {
        console.log('Logging out user...');
        
        // Clear all sessions
        this.clearAllSessions();
        
        // Prepare redirect URL
        let redirectUrl = this.LOGIN_PAGE;
        
        if (message) {
            const encodedMessage = encodeURIComponent(message);
            redirectUrl += `?message=${encodedMessage}`;
        }
        
        // Show logout message briefly before redirect
        this.showLogoutMessage(() => {
            window.location.href = redirectUrl;
        });
    }

    /**
     * Force logout with session expired message
     */
    forceLogout(reason = 'Session expired') {
        this.logout(`${reason} - กรุณาเข้าสู่ระบบใหม่อีกครั้ง`);
    }

    /**
     * Show logout message with loading animation
     */
    showLogoutMessage(callback) {
        // Create logout overlay
        const overlay = document.createElement('div');
        overlay.id = 'logoutOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div style="
                    width: 3rem;
                    height: 3rem;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                "></div>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.25rem;">กำลังออกจากระบบ</h3>
                <p style="margin: 0; font-size: 1rem; opacity: 0.9;">โปรดรอสักครู่...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
        
        // Remove overlay and execute callback after delay
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            if (callback) callback();
        }, 1500);
    }

    /**
     * Check token expiration and auto-logout if needed
     */
    checkTokenExpiration() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return false;
        
        try {
            // Decode JWT payload (simple base64 decode)
            const tokenParts = currentUser.token.split('.');
            if (tokenParts.length !== 3) {
                this.forceLogout('Invalid token format');
                return false;
            }
            
            const payload = JSON.parse(atob(tokenParts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < now) {
                this.forceLogout('Token หมดอายุ');
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error checking token expiration:', error);
            this.forceLogout('Error validating session');
            return false;
        }
    }

    /**
     * Make authenticated API call
     */
    async apiCall(url, options = {}) {
        // Check authentication
        if (!this.isAuthenticated()) {
            this.forceLogout('ไม่พบการเข้าสู่ระบบ');
            throw new Error('Not authenticated');
        }

        // Check token expiration
        if (!this.checkTokenExpiration()) {
            throw new Error('Token expired');
        }

        // Prepare request options
        const requestOptions = {
            ...options,
            headers: {
                ...this.getAuthHeader(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, requestOptions);
            
            // Handle authentication errors
            if (response.status === 401) {
                this.forceLogout('Unauthorized access');
                throw new Error('Unauthorized');
            }
            
            if (response.status === 403) {
                this.forceLogout('Access forbidden');
                throw new Error('Forbidden');
            }
            
            return response;
        } catch (error) {
            // Handle network errors
            if (error.message.includes('fetch')) {
                console.error('Network error:', error);
                throw new Error('Network error - please check your connection');
            }
            throw error;
        }
    }

    /**
     * Create logout button element (ปรับปรุงให้ทำงานได้ดีกับหลายระบบ)
     */
    createLogoutButton(container, options = {}) {
        const {
            text = 'ออกจากระบบ',
            className = 'logout-btn',
            style = 'default',
            position = 'append',
            showUserInfo = true
        } = options;
        
        const button = document.createElement('button');
        button.textContent = text;
        button.className = className;
        
        // Apply styles based on style type
        if (style === 'default') {
            button.style.cssText = `
                background: #ef4444;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
                transition: all 0.15s;
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = '#dc2626';
                button.style.transform = 'translateY(-1px)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = '#ef4444';
                button.style.transform = 'translateY(0)';
            });
        }
        
        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.confirmLogout();
        });
        
        // Add to container
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (container) {
            if (position === 'prepend') {
                container.insertBefore(button, container.firstChild);
            } else {
                container.appendChild(button);
            }
        }
        
        return button;
    }

    /**
     * Show logout confirmation dialog
     */
    confirmLogout() {
        const currentUser = this.getCurrentUser();
        const userName = currentUser?.user?.username || 'ผู้ใช้';
        const userRole = this.getRoleDisplayName(currentUser?.user?.role);
        const currentSystem = currentUser?.system || 'ไม่ทราบ';
        
        if (confirm(`คุณต้องการออกจากระบบหรือไม่?\n\nผู้ใช้: ${userName}\nตำแหน่ง: ${userRole}\nระบบ: ${currentSystem}`)) {
            this.logout('ออกจากระบบสำเร็จ');
        }
    }

    /**
     * Initialize auto-logout on token expiration
     */
    initializeAutoLogout() {
        // Check every 5 minutes
        const checkInterval = 5 * 60 * 1000;
        
        setInterval(() => {
            if (this.isAuthenticated()) {
                this.checkTokenExpiration();
            }
        }, checkInterval);
        
        // Check immediately
        if (this.isAuthenticated()) {
            this.checkTokenExpiration();
        }
    }

    /**
     * Setup page protection (ปรับปรุงให้รองรับ multi-role)
     */
    protectPage(requiredRoles = null) {
        if (!this.isAuthenticated()) {
            this.logout('กรุณาเข้าสู่ระบบก่อนใช้งาน');
            return false;
        }
        
        // ถ้าไม่ระบุ role ก็ผ่าน (authenticated ก็พอ)
        if (!requiredRoles) {
            return true;
        }
        
        // ตรวจสอบ role requirements
        if (!this.hasAnyRole(requiredRoles)) {
            const currentRole = this.getCurrentRole();
            console.warn(`Access denied. Current role: ${currentRole}, Required: ${requiredRoles}`);
            this.logout('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            return false;
        }
        
        return true;
    }

    /**
     * Get system URL based on role and device
     */
    getSystemUrl(role, deviceType = 'desktop') {
        const urls = {
            pc: '/admin/pc-dashboard.html',
            executive: '/admin/mobile-executive.html',
            technician: '/admin/mobile-technician.html',
            admin: '/admin/mobile-admin.html'
        };

        // สำหรับ admin สามารถเข้าได้ทุกระบบ
        if (role === 'admin') {
            return deviceType === 'desktop' ? urls.pc : urls.admin;
        }
        
        // สำหรับ executive และ technician
        if (role === 'executive') {
            return deviceType === 'desktop' ? urls.pc : urls.executive;
        }
        
        if (role === 'technician') {
            return deviceType === 'desktop' ? urls.pc : urls.technician;
        }
        
        // Default fallback
        return urls.executive;
    }

    /**
     * Redirect to appropriate system based on user role and device
     */
    redirectToSystem(targetSystem = null, userData = null) {
        const currentUser = userData || this.getCurrentUser();
        if (!currentUser) {
            this.logout('ไม่พบข้อมูลผู้ใช้');
            return;
        }

        let systemUrl;
        if (targetSystem) {
            const urls = {
                pc: '/admin/pc-dashboard.html',
                executive: '/admin/mobile-executive.html',
                technician: '/admin/mobile-technician.html',
                admin: '/admin/mobile-admin.html'
            };
            systemUrl = urls[targetSystem];
        } else {
            // Auto-detect based on role and device
            const deviceType = this.detectDeviceType();
            systemUrl = this.getSystemUrl(currentUser.user.role, deviceType);
        }

        if (systemUrl) {
            window.location.href = systemUrl;
        } else {
            console.error('Unable to determine system URL');
            this.logout('ไม่สามารถระบุระบบที่เหมาะสมได้');
        }
    }

    /**
     * Detect device type
     */
    detectDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?=.*tablet)|(?=.*\bmobile\b)(?=.*\btablet\b)/i.test(userAgent);
        const screenWidth = window.screen.width;
        const isLargeScreen = screenWidth >= 1024;
        
        if (isMobile && !isTablet) {
            return 'mobile';
        } else if (isTablet) {
            return 'tablet';
        } else if (isLargeScreen) {
            return 'desktop';
        } else {
            return 'mobile'; // Default to mobile for smaller screens
        }
    }

    /**
     * Debug: Get all active sessions
     */
    getActiveSessions() {
        const systems = ['pc', 'executive', 'technician', 'admin'];
        const sessions = {};
        
        systems.forEach(system => {
            const session = this.getUserBySystem(system);
            if (session) {
                sessions[system] = {
                    username: session.user.username,
                    role: session.user.role,
                    hasToken: !!session.token
                };
            }
        });
        
        return sessions;
    }

    /**
     * Debug: Log current authentication status
     */
    debugAuthStatus() {
        console.group('🔐 Auth Status Debug');
        console.log('Authenticated:', this.isAuthenticated());
        console.log('Current User:', this.getCurrentUser());
        console.log('Current Role:', this.getCurrentRole());
        console.log('Active Sessions:', this.getActiveSessions());
        console.groupEnd();
    }
}

// Create global instance
window.AuthUtils = new AuthUtils();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auto-logout checker
    window.AuthUtils.initializeAutoLogout();
    
    // Add logout button to common locations if they exist
    const navbarUser = document.querySelector('.navbar-user');
    const headerActions = document.querySelector('.header-actions');
    const adminHeader = document.querySelector('.admin-header');
    const headerRight = document.querySelector('.header-right');
    
    if (navbarUser) {
        window.AuthUtils.createLogoutButton(navbarUser);
    } else if (headerActions) {
        window.AuthUtils.createLogoutButton(headerActions);
    } else if (adminHeader) {
        window.AuthUtils.createLogoutButton(adminHeader);
    } else if (headerRight) {
        // สำหรับ PC Dashboard ที่มี header-right แล้ว
        console.log('Header-right found, logout button should be handled by page');
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function() {
    if (window.AuthUtils.isAuthenticated()) {
        window.AuthUtils.checkTokenExpiration();
    }
});

// Handle page visibility change (check auth when page becomes visible)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.AuthUtils.isAuthenticated()) {
        window.AuthUtils.checkTokenExpiration();
    }
});

// Export for module use (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUtils;
}