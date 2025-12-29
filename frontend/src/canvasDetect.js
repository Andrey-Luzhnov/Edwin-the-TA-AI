// Canvas Page Detection and User/Course ID extraction

const CanvasDetect = {
    /**
     * Extract course ID from Canvas URL
     * Pattern: /courses/{id}/...
     */
    getCourseId() {
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        return match ? parseInt(match[1]) : null;
    },

    /**
     * Detect user display name from Canvas DOM
     * Tries multiple selectors in order, falls back to "Student"
     */
    getUserName() {
        const selectors = [
            '#global_nav_profile_link',  // Global nav profile
            '[data-testid="globalNavProfileLink"]',  // New Canvas UI
            'button[data-testid="account-menu-button"]',  // Account menu
            '.ic-app-header__menu-list-item.ic-app-header__menu-list-item--active span',
            '.user_name',
            '[aria-label*="Account"]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const userName = element.getAttribute('aria-label') ||
                               element.getAttribute('title') ||
                               element.textContent?.trim();
                if (userName && userName.length > 0) {
                    // Clean up the name
                    return userName
                        .replace('User: ', '')
                        .replace('Account', '')
                        .replace(/\s+/g, ' ')
                        .trim();
                }
            }
        }

        return 'Student';  // Fallback
    },

    /**
     * Generate or retrieve stable user token
     * Stored in localStorage with user name
     */
    getUserToken() {
        let userToken = localStorage.getItem(CONFIG.STORAGE.USER_TOKEN);
        let storedName = localStorage.getItem(CONFIG.STORAGE.USER_NAME);
        const detectedName = this.getUserName();

        // If no token or user name changed, generate new token
        if (!userToken || (detectedName !== 'Student' && detectedName !== storedName)) {
            userToken = this.generateUUID();
            localStorage.setItem(CONFIG.STORAGE.USER_TOKEN, userToken);
            localStorage.setItem(CONFIG.STORAGE.USER_NAME, detectedName);
            console.log(`[Edwin] New user token generated for "${detectedName}"`);
        }

        return userToken;
    },

    /**
     * Simple UUID v4 generator
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Detect page type for auto-sync
     * Returns: 'syllabus' | 'assignments' | 'modules' | 'announcements' | 'assignment' | 'unknown'
     */
    getPageType() {
        const path = window.location.pathname;

        if (path.includes('/assignments') && path.match(/\/assignments\/\d+/)) {
            return 'assignment';  // Single assignment page
        }
        if (path.includes('/assignments')) {
            return 'assignments';  // Assignments list
        }
        if (path.includes('/modules')) {
            return 'modules';
        }
        if (path.includes('/announcements')) {
            return 'announcements';
        }
        if (path.includes('/assignments/syllabus')) {
            return 'syllabus';
        }
        if (path.includes('/pages/')) {
            return 'page';  // Generic page
        }

        return 'unknown';
    },

    /**
     * Check if current page is supported for auto-sync
     */
    isSyncablePage() {
        const pageType = this.getPageType();
        return CONFIG.AUTO_SYNC.SUPPORTED_PAGE_TYPES.includes(pageType);
    },

    /**
     * Get page title from Canvas
     */
    getPageTitle() {
        // Try to get more specific title from Canvas breadcrumbs or header
        const breadcrumb = document.querySelector('.ellipsible');
        if (breadcrumb) {
            return breadcrumb.textContent.trim();
        }

        const pageTitle = document.querySelector('h1.page-title, h1');
        if (pageTitle) {
            return pageTitle.textContent.trim();
        }

        return document.title || 'Untitled Page';
    }
};
