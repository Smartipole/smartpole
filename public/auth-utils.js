// auth-utils.js - Authentication utilities for อบต.ข่าใหญ่ Admin System

/**
 * Authentication and Session Management Utilities
 */
class AuthUtils {
    constructor() {
        this.API_BASE = '';
        this.LOGIN_PAGE = '/admin/smart-login.html';
        
        // Token keys
        this.EXECUTIVE_TOKEN_KEY = 'executive_token';
        this.TECHNICIAN_TOKEN_KEY = 'technician_token';
        this.EXECUTIVE_USER_KEY = 'executive_user';
        this.TECHNICIAN_USER_KEY = 'technician_user';
        
        // Legacy token keys for backward compatibility
        this.LEGACY_TOKEN_KEY = 'authToken';
        this.LEGACY_USER_KEY = 'authUser';
    }

    /**
     * Debug authentication state (for development/troubleshooting)
     */
    debugAuth() {
        console.group('🔍 Authentication Debug Information');
        
        try {
            // Check all possible authentication sources
            const executiveToken = localStorage.getItem(this.EXECUTIVE_TOKEN_KEY);
            const technicianToken = localStorage.getItem(this.TECHNICIAN_TOKEN_KEY);
            const executiveUser = localStorage.getItem(this.EXECUTIVE_USER_KEY);
            const technicianUser = localStorage.getItem(this.TECHNICIAN_USER_KEY);
            const legacyToken = localStorage.getItem(this.LEGACY_TOKEN_KEY);
            const legacyUser = localStorage.getItem(this.LEGACY_USER_KEY);
            
            console.log('📊 Token Status:');
            console.log('  ├── Executive Token:', executiveToken ? '✅ Present' : '❌ Missing');
            console.log('  ├── Technician Token:', technicianToken ? '✅ Present' : '❌ Missing');
            console.log('  └── Legacy Token:', legacyToken ? '✅ Present' : '❌ Missing');
            
            console.log('👤 User Data Status:');
            console.log('  ├── Executive User:', executiveUser ? '✅ Present' : '❌ Missing');
            console.log('  ├── Technician User:', technicianUser ? '✅ Present' : '❌ Missing');
            console.log('  └── Legacy User:', legacyUser ? '✅ Present' : '❌ Missing');
            
            // Get current user
            const currentUser = this.getCurrentUser();
            console.log('🎯 Current Session:');
            if (currentUser) {
                console.log('  ├── System:', currentUser.system);
                console.log('  ├── Username:', currentUser.user?.username);
                console.log('  ├── Role:', currentUser.user?.role);
                console.log('  ├── Token Length:', currentUser.token ? currentUser.token.length : 0);
                console.log('  └── Is Valid:', this.isAuthenticated() ? '✅ Yes' : '❌ No');
                
                // Check token expiration
                if (currentUser.token) {
                    try {
                        const tokenParts = currentUser.token.split('.');
                        if (tokenParts.length === 3) {
                            const payload = JSON.parse(atob(tokenParts[1]));
                            const now = Math.floor(Date.now() / 1000);
                            const expires = payload.exp;
                            const timeLeft = expires ? expires - now : null;
                            
                            console.log('⏰ Token Expiration:');
                            console.log('  ├── Expires At:', expires ? new Date(expires * 1000).toLocaleString() : 'N/A');
                            console.log('  ├── Time Left:', timeLeft ? `${Math.floor(timeLeft / 60)} minutes` : 'N/A');
                            console.log('  └── Status:', timeLeft && timeLeft > 0 ? '✅ Valid' : '❌ Expired');
                        }
                    } catch (e) {
                        console.log('⚠️ Could not parse token:', e.message);
                    }
                }
            } else {
                console.log('  └── Status: ❌ No active session');
            }
            
            // Check localStorage keys
            console.log('🗄️ localStorage Keys:');
            const authKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('token') || key.includes('user') || key.includes('auth'))) {
                    authKeys.push(key);
                }
            }
            if (authKeys.length > 0) {
                authKeys.forEach(key => {
                    const value = localStorage.getItem(key);
                    console.log(`  ├── ${key}:`, value ? `Present (${value.length} chars)` : 'Empty');
                });
            } else {
                console.log('  └── No authentication-related keys found');
            }
            
        } catch (error) {
            console.error('❌ Error during auth debug:', error);
        }
        
        console.groupEnd();
    }

    /**
     * Get current user data based on current system
     */
    getCurrentUser() {
        // Try legacy format first (for backward compatibility)
        const legacyToken = localStorage.getItem(this.LEGACY_TOKEN_KEY);
        const legacyUser = localStorage.getItem(this.LEGACY_USER_KEY);
        
        if (legacyToken && legacyUser) {
            try {
                return {
                    token: legacyToken,
                    user: JSON.parse(legacyUser),
                    system: 'legacy'
                };
            } catch (e) {
                console.error('Error parsing legacy user data:', e);
            }
        }

        // Try executive session
        const executiveToken = localStorage.getItem(this.EXECUTIVE_TOKEN_KEY);
        const executiveUser = localStorage.getItem(this.EXECUTIVE_USER_KEY);
        
        if (executiveToken && executiveUser) {
            try {
                return {
                    token: executiveToken,
                    user: JSON.parse(executiveUser),
                    system: 'executive'
                };
            } catch (e) {
                console.error('Error parsing executive user data:', e);
            }
        }
        
        // Try technician session
        const technicianToken = localStorage.getItem(this.TECHNICIAN_TOKEN_KEY);
        const technicianUser = localStorage.getItem(this.TECHNICIAN_USER_KEY);
        
        if (technicianToken && technicianUser) {
            try {
                return {
                    token: technicianToken,
                    user: JSON.parse(technicianUser),
                    system: 'technician'
                };
            } catch (e) {
                console.error('Error parsing technician user data:', e);
            }
        }
        
        return null;
    }

    /**
     * Check if user is authenticated for any system
     */
    isAuthenticated() {
        return this.getCurrentUser() !== null;
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
     * Clear all session data
     */
    clearAllSessions() {
        // Remove all authentication tokens
        localStorage.removeItem(this.EXECUTIVE_TOKEN_KEY);
        localStorage.removeItem(this.TECHNICIAN_TOKEN_KEY);
        localStorage.removeItem(this.EXECUTIVE_USER_KEY);
        localStorage.removeItem(this.TECHNICIAN_USER_KEY);
        localStorage.removeItem(this.LEGACY_TOKEN_KEY);
        localStorage.removeItem(this.LEGACY_USER_KEY);
        
        // Clear any other session-related data
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('_token') || key.includes('_user') || key.includes('_session') || key.includes('auth'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('🧹 All sessions cleared');
    }

    /**
     * Logout user and redirect to login page
     */
    logout(message = null) {
        console.log('👋 Logging out user...');
        
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
        console.warn('⚠️ Force logout:', reason);
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
                console.warn('⚠️ Invalid token format detected');
                this.forceLogout('Invalid token format');
                return false;
            }
            
            const payload = JSON.parse(atob(tokenParts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < now) {
                console.warn('⚠️ Token expired');
                this.forceLogout('Token หมดอายุ');
                return false;
            }
            
            // Warn if token expires within 10 minutes
            if (payload.exp && (payload.exp - now) < 600) {
                const minutesLeft = Math.floor((payload.exp - now) / 60);
                console.warn(`⚠️ Token expires in ${minutesLeft} minutes`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error checking token expiration:', error);
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
            console.warn('🚫 API call blocked: Not authenticated');
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
            console.log(`🌐 API Call: ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, requestOptions);
            
            // Handle authentication errors
            if (response.status === 401) {
                console.warn('🚫 API returned 401: Unauthorized');
                this.forceLogout('Unauthorized access');
                throw new Error('Unauthorized');
            }
            
            if (response.status === 403) {
                console.warn('🚫 API returned 403: Forbidden');
                this.forceLogout('Access forbidden');
                throw new Error('Forbidden');
            }
            
            console.log(`✅ API Response: ${response.status} ${response.statusText}`);
            return response;
        } catch (error) {
            // Handle network errors
            if (error.message.includes('fetch')) {
                console.error('🌐 Network error:', error);
                throw new Error('Network error - please check your connection');
            }
            throw error;
        }
    }

    /**
     * Create logout button element
     */
    createLogoutButton(container, options = {}) {
        const {
            text = 'ออกจากระบบ',
            className = 'logout-btn',
            style = 'default',
            position = 'append'
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
        
        if (confirm(`คุณต้องการออกจากระบบหรือไม่?\n\nผู้ใช้: ${userName}`)) {
            this.logout('ออกจากระบบสำเร็จ');
        }
    }

    /**
     * Initialize auto-logout on token expiration
     */
    initializeAutoLogout() {
        console.log('🔄 Initializing auto-logout system...');
        
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
     * Setup page protection (redirect to login if not authenticated)
     */
    protectPage(requiredRoles = null) {
        console.log('🛡️ Protecting page...');
        
        if (!this.isAuthenticated()) {
            console.warn('🚫 Page protection failed: Not authenticated');
            this.logout('กรุณาเข้าสู่ระบบก่อนใช้งาน');
            return false;
        }
        
        const currentUser = this.getCurrentUser();
        console.log(`✅ User authenticated: ${currentUser.user.username} (${currentUser.user.role})`);
        
        // Check role requirements
        if (requiredRoles && Array.isArray(requiredRoles)) {
            const userRole = currentUser.user.role;
            if (!requiredRoles.includes(userRole)) {
                console.warn(`🚫 Role check failed: User has ${userRole}, required: ${requiredRoles.join(', ')}`);
                this.logout('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
                return false;
            }
            console.log(`✅ Role check passed: ${userRole} is in [${requiredRoles.join(', ')}]`);
        }
        
        return true;
    }

    /**
     * Migrate legacy authentication data to new format
     */
    migrateLegacyAuth() {
        const legacyToken = localStorage.getItem(this.LEGACY_TOKEN_KEY);
        const legacyUser = localStorage.getItem(this.LEGACY_USER_KEY);
        
        if (legacyToken && legacyUser) {
            try {
                const userData = JSON.parse(legacyUser);
                console.log('🔄 Migrating legacy authentication data...');
                
                // Determine target storage based on user role
                if (userData.role === 'executive' || userData.role === 'admin') {
                    localStorage.setItem(this.EXECUTIVE_TOKEN_KEY, legacyToken);
                    localStorage.setItem(this.EXECUTIVE_USER_KEY, legacyUser);
                } else {
                    localStorage.setItem(this.TECHNICIAN_TOKEN_KEY, legacyToken);
                    localStorage.setItem(this.TECHNICIAN_USER_KEY, legacyUser);
                }
                
                console.log('✅ Legacy authentication migrated successfully');
                return true;
            } catch (e) {
                console.error('❌ Failed to migrate legacy authentication:', e);
            }
        }
        
        return false;
    }

    /**
     * Get session information for debugging
     */
    getSessionInfo() {
        const currentUser = this.getCurrentUser();
        if (!currentUser) return null;
        
        try {
            const tokenParts = currentUser.token.split('.');
            const payload = tokenParts.length === 3 ? JSON.parse(atob(tokenParts[1])) : {};
            
            return {
                username: currentUser.user.username,
                role: currentUser.user.role,
                system: currentUser.system,
                tokenLength: currentUser.token.length,
                issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
                expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
                timeLeft: payload.exp ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : null
            };
        } catch (e) {
            return {
                username: currentUser.user.username,
                role: currentUser.user.role,
                system: currentUser.system,
                error: e.message
            };
        }
    }
}

// Create global instance
window.AuthUtils = new AuthUtils();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 AuthUtils initialized');
    
    // Try to migrate legacy authentication data
    window.AuthUtils.migrateLegacyAuth();
    
    // Initialize auto-logout checker
    window.AuthUtils.initializeAutoLogout();
    
    // Add logout button to common locations if they exist
    const navbarUser = document.querySelector('.navbar-user');
    const headerActions = document.querySelector('.header-actions');
    const adminHeader = document.querySelector('.admin-header');
    
    if (navbarUser) {
        window.AuthUtils.createLogoutButton(navbarUser);
    } else if (headerActions) {
        window.AuthUtils.createLogoutButton(headerActions);
    } else if (adminHeader) {
        window.AuthUtils.createLogoutButton(adminHeader);
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