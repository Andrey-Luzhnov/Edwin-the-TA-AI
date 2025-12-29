// ==UserScript==
// @name         Edwin AI Canvas Chat (Modular Build)
// @namespace    http://tampermonkey.net/
// @version      11.0.0
// @description  AI Teaching Assistant for Canvas LMS - Modular build with auto-sync and explain features
// @author       Edwin Team
// @match        https://canvas.*.edu/courses/*
// @match        https://*.instructure.com/courses/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';


// ========================================
// Module: config.js
// ========================================

// Edwin AI Configuration
const CONFIG = {
    // Backend URL
    BACKEND_BASE_URL: 'http://localhost:5000',

    // API endpoints (all use /api prefix)
    API: {
        HEALTH: '/api/health',
        NEW_CONVERSATION: '/api/newConversation',
        SEND_MESSAGE: '/api/sendMessage',
        GENERATE_QUIZ: '/api/generateQuiz',
        SYNC_PAGE_CONTENT: '/api/syncPageContent',
        QUIZ_ATTEMPT: '/api/quizAttempt',
        PROGRESS: '/api/progress',
        INSIGHTS: '/api/insights',
        EXPLAIN_PAGE: '/api/explainPage'
    },

    // Storage keys
    STORAGE: {
        USER_TOKEN: 'edwin_user_token',
        USER_NAME: 'edwin_user_name',
        AUTO_SYNC_ENABLED: 'edwin_auto_sync_enabled',
        SYNC_HISTORY: 'edwin_sync_history'
    },

    // Auto-sync settings
    AUTO_SYNC: {
        ENABLED_BY_DEFAULT: true,
        COOLDOWN_HOURS: 12,
        SUPPORTED_PAGE_TYPES: ['syllabus', 'assignments', 'modules', 'announcements', 'assignment']
    },

    // API timeouts
    TIMEOUT: {
        DEFAULT: 10000,  // 10 seconds
        QUIZ_GENERATION: 30000,  // 30 seconds
        PAGE_SYNC: 15000  // 15 seconds
    },

    // UI configuration
    UI: {
        PANEL_MARGIN_LEFT: 0,
        PANEL_MARGIN_RIGHT: 0,
        TYPING_ANIMATION_SPEED: 30
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.STORAGE);
Object.freeze(CONFIG.AUTO_SYNC);
Object.freeze(CONFIG.TIMEOUT);
Object.freeze(CONFIG.UI);



// ========================================
// Module: canvasDetect.js
// ========================================

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



// ========================================
// Module: scrape.js
// ========================================

// DOM Scraping utilities for Canvas pages

const Scraper = {
    /**
     * Extract visible content from Canvas page
     * Removes UI chrome, navigation, and Edwin panel
     */
    extractPageContent() {
        const elementsToSkip = [
            'edwin-panel',
            'edwin-settings-modal',
            'edwin-quizzes-tab',
            'global_nav',
            'breadcrumbs',
            'right-side',
            'course-navigation',
            '.ui-scroll-to-top',
            '.ui-scroll-to-bottom'
        ];

        const contentSelectors = [
            '#content',                    // Main content
            '.user_content',               // Course materials
            '.show-content',               // Assignment content
            '.syllabus_content',           // Syllabus
            '.description',                // Descriptions
            '.requirements_message',       // Requirements
            '.submission_details',         // Submission info
            '.context_module_item',        // Module items
            'article',                     // Article content
            '.discussion-topic',           // Discussion topics
            '.user_content_post_body',     // Discussion posts
            '.assignment-title',
            '.assignment-description',
            '.page-content'
        ];

        let extractedText = '';

        for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if it's part of excluded UI
                if (this.shouldSkipElement(element, elementsToSkip)) {
                    return;
                }

                const text = element.innerText || element.textContent;
                if (text && text.trim().length > 20) {
                    extractedText += text.trim() + '\n\n';
                }
            });
        }

        // Clean up extracted text
        extractedText = extractedText
            .replace(/\n{3,}/g, '\n\n')      // Remove excessive newlines
            .replace(/\s{3,}/g, ' ')         // Remove excessive spaces
            .trim();

        return {
            title: CanvasDetect.getPageTitle(),
            text: extractedText,
            url: window.location.href,
            pageType: CanvasDetect.getPageType()
        };
    },

    /**
     * Check if element should be skipped during scraping
     */
    shouldSkipElement(element, skipIds) {
        return skipIds.some(id => {
            return element.id === id ||
                   element.classList.contains(id) ||
                   element.closest(`#${id}`) ||
                   element.closest(`.${id}`);
        });
    },

    /**
     * Generate content hash for deduplication
     */
    hashContent(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;  // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    },

    /**
     * Get minimal excerpt from content
     */
    getExcerpt(text, maxLength = 200) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength).trim() + '...';
    }
};



// ========================================
// Module: api.js
// ========================================

// API client wrapper for all backend communication

const API = {
    /**
     * Make API request with timeout and error handling
     */
    async request(endpoint, options = {}) {
        const timeout = options.timeout || CONFIG.TIMEOUT.DEFAULT;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${CONFIG.BACKEND_BASE_URL}${endpoint}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return { success: true, data };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                return { success: false, error: 'Request timeout - backend may be offline' };
            }

            return { success: false, error: error.message };
        }
    },

    /**
     * Check backend health
     */
    async checkHealth() {
        return this.request(CONFIG.API.HEALTH, {
            method: 'GET',
            timeout: 3000
        });
    },

    /**
     * Send message to Edwin AI
     */
    async sendMessage(userToken, courseId, question) {
        return this.request(CONFIG.API.SEND_MESSAGE, {
            method: 'POST',
            body: JSON.stringify({
                userID: userToken,
                courseID: courseId,
                question: question
            })
        });
    },

    /**
     * Sync page content to backend
     */
    async syncPageContent(userToken, courseId, pageTitle, pageUrl, content) {
        return this.request(CONFIG.API.SYNC_PAGE_CONTENT, {
            method: 'POST',
            timeout: CONFIG.TIMEOUT.PAGE_SYNC,
            body: JSON.stringify({
                userID: userToken,
                courseID: courseId,
                pageTitle: pageTitle,
                pageURL: pageUrl,
                content: content
            })
        });
    },

    /**
     * Generate quiz
     */
    async generateQuiz(courseId, topic, difficulty, numQuestions) {
        return this.request(CONFIG.API.GENERATE_QUIZ, {
            method: 'POST',
            timeout: CONFIG.TIMEOUT.QUIZ_GENERATION,
            body: JSON.stringify({
                courseID: courseId,
                topic: topic,
                difficulty: difficulty,
                numQuestions: numQuestions
            })
        });
    },

    /**
     * Log quiz attempt (fire-and-forget)
     */
    logQuizAttempt(userToken, question, quizTitle, selectedOption, correctOption, isCorrect) {
        // Non-blocking - don't wait for response
        fetch(`${CONFIG.BACKEND_BASE_URL}${CONFIG.API.QUIZ_ATTEMPT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userID: userToken,
                question: question,
                quizTitle: quizTitle,
                selectedOption: selectedOption,
                correctOption: correctOption,
                isCorrect: isCorrect
            })
        }).catch(error => console.error('Failed to log quiz attempt:', error));
    },

    /**
     * Get user progress
     */
    async getProgress(userToken, courseId) {
        return this.request(`${CONFIG.API.PROGRESS}?userID=${userToken}&courseID=${courseId}`, {
            method: 'GET'
        });
    },

    /**
     * Get instructor insights
     */
    async getInsights(courseId) {
        return this.request(`${CONFIG.API.INSIGHTS}?courseID=${courseId}`, {
            method: 'GET'
        });
    },

    /**
     * Explain page or generate practice questions
     */
    async explainPage(userToken, courseId, pageTitle, content, mode = 'explain') {
        return this.request(CONFIG.API.EXPLAIN_PAGE, {
            method: 'POST',
            timeout: CONFIG.TIMEOUT.QUIZ_GENERATION,
            body: JSON.stringify({
                userID: userToken,
                courseID: courseId,
                pageTitle: pageTitle,
                content: content,
                mode: mode  // 'explain' or 'practice'
            })
        });
    },

    /**
     * Create new conversation
     */
    async newConversation(userToken, courseId) {
        return this.request(CONFIG.API.NEW_CONVERSATION, {
            method: 'POST',
            body: JSON.stringify({
                userID: userToken,
                courseID: courseId
            })
        });
    }
};



// ========================================
// Module: ui.js
// ========================================

// UI rendering and manipulation functions

const UI = {
    /**
     * Add message to chat with typing animation
     */
    addMessage(sender, text, citations = null, grounded = true) {
        const messagesContainer = document.getElementById('edwin-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';

        messageContent.appendChild(textSpan);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (sender === 'user') {
            textSpan.textContent = text;
        } else if (sender === 'edwin') {
            // Add grounded badge if applicable
            if (citations && citations.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'grounded-badge grounded';
                badge.innerHTML = '✅ Grounded';
                messageContent.insertBefore(badge, textSpan);
            } else if (grounded === false) {
                const badge = document.createElement('span');
                badge.className = 'grounded-badge ungrounded';
                badge.innerHTML = '⚠️ Ungrounded';
                messageContent.insertBefore(badge, textSpan);

                // Add suggestion to sync
                const suggestion = document.createElement('div');
                suggestion.className = 'sync-suggestion';
                suggestion.innerHTML = '💡 Tip: Click "Sync This Page" in settings to ground Edwin with course materials';
                messageContent.appendChild(suggestion);
            }

            // Typing animation
            let i = 0;
            const typeInterval = setInterval(() => {
                textSpan.textContent += text[i];
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                if (++i >= text.length) {
                    clearInterval(typeInterval);

                    // Add citations after typing completes
                    if (citations && citations.length > 0) {
                        const citationsDiv = this.renderCitations(citations);
                        messageContent.appendChild(citationsDiv);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }, 30);
        }
    },

    /**
     * Render citations block
     */
    renderCitations(citations) {
        const citationsDiv = document.createElement('div');
        citationsDiv.className = 'message-citations';

        citationsDiv.innerHTML = `
            <div class="citations-header">📚 Sources:</div>
            ${citations.map((cite, idx) => `
                <div class="citation-item">
                    <strong>${idx + 1}. ${cite.title || 'Source'}</strong>
                    ${cite.url ? `<br><a href="${cite.url}" target="_blank" class="citation-link">View source →</a>` : ''}
                    ${cite.snippet ? `<div class="citation-snippet">${cite.snippet}</div>` : ''}
                </div>
            `).join('')}
        `;

        return citationsDiv;
    },

    /**
     * Show status message in sync section
     */
    showSyncStatus(message, type = 'info') {
        const statusDiv = document.getElementById('page-sync-status');
        if (!statusDiv) return;

        statusDiv.textContent = message;
        statusDiv.className = `sync-status ${type}`;

        // Auto-clear success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.textContent = '';
                statusDiv.className = 'sync-status';
            }, 5000);
        }
    },

    /**
     * Update auto-sync status display
     */
    updateAutoSyncStatus() {
        const statusDiv = document.getElementById('auto-sync-status');
        if (!statusDiv) return;

        const syncHistory = JSON.parse(localStorage.getItem(CONFIG.STORAGE.SYNC_HISTORY) || '{}');
        const syncedPages = Object.keys(syncHistory).length;

        if (syncedPages === 0) {
            statusDiv.textContent = 'No pages synced yet';
            return;
        }

        // Find most recent sync
        const timestamps = Object.values(syncHistory);
        const mostRecent = Math.max(...timestamps);
        const minsAgo = Math.floor((Date.now() - mostRecent) / 60000);

        let timeStr;
        if (minsAgo < 1) timeStr = 'just now';
        else if (minsAgo < 60) timeStr = `${minsAgo} mins ago`;
        else if (minsAgo < 1440) timeStr = `${Math.floor(minsAgo / 60)} hours ago`;
        else timeStr = `${Math.floor(minsAgo / 1440)} days ago`;

        statusDiv.textContent = `Synced ${syncedPages} pages • Last sync: ${timeStr}`;
    },

    /**
     * Show backend offline warning
     */
    showBackendOffline() {
        // Check if banner already exists
        if (document.getElementById('backend-offline-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'backend-offline-banner';
        banner.className = 'backend-offline-banner';
        banner.innerHTML = `
            ⚠️ Backend offline - Edwin cannot respond. Please start the backend server.
            <button onclick="this.parentElement.remove()">Dismiss</button>
        `;

        document.body.insertBefore(banner, document.body.firstChild);
    },

    /**
     * Hide backend offline warning
     */
    hideBackendOffline() {
        const banner = document.getElementById('backend-offline-banner');
        if (banner) banner.remove();
    },

    /**
     * Update progress bars
     */
    updateProgressDisplay(progressData) {
        // Update streak
        const streakFill = document.querySelector('.streak-fill');
        if (streakFill) {
            const streakProgress = Math.min(progressData.streak || 0, 7);
            streakFill.style.width = `${(streakProgress / 7) * 100}%`;
        }

        const streakText = document.querySelector('.streak-text');
        if (streakText) {
            streakText.textContent = `${progressData.streak || 0} day streak`;
        }

        // Update quiz completion
        const quizFill = document.querySelector('.quiz-progress-fill');
        if (quizFill) {
            const completionPercent = Math.min((progressData.quizzesCompleted || 0) / 10 * 100, 100);
            quizFill.style.width = `${completionPercent}%`;
        }

        // Update accuracy
        const accuracyText = document.querySelector('.accuracy-text');
        if (accuracyText) {
            accuracyText.textContent = `${progressData.accuracy || 0}% accuracy`;
        }
    },

    /**
     * Show loading state for button
     */
    setButtonLoading(buttonId, loading, loadingText = '⏳ Loading...', defaultText = 'Button') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || defaultText;
        }
    },

    /**
     * Render "Explain This Page" results
     */
    renderExplanation(data, mode = 'explain') {
        const messagesContainer = document.getElementById('edwin-messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message edwin explanation-result';

        let content = '';

        if (mode === 'explain') {
            content = `
                <div class="explanation-header">📖 Page Explanation</div>
                <div class="explanation-section">
                    <strong>Summary:</strong>
                    <p>${data.summary || 'No summary available'}</p>
                </div>
                ${data.keyPoints && data.keyPoints.length > 0 ? `
                    <div class="explanation-section">
                        <strong>Key Points:</strong>
                        <ul>${data.keyPoints.map(point => `<li>${point}</li>`).join('')}</ul>
                    </div>
                ` : ''}
                ${data.commonMistakes && data.commonMistakes.length > 0 ? `
                    <div class="explanation-section">
                        <strong>Common Mistakes to Avoid:</strong>
                        <ul>${data.commonMistakes.map(mistake => `<li>${mistake}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            `;
        } else if (mode === 'practice') {
            content = `
                <div class="explanation-header">📝 Practice Questions Generated</div>
                <p>Practice questions have been added to your quiz list. Check the Quizzes tab!</p>
            `;
        }

        messageDiv.innerHTML = content;

        // Add citations if available
        if (data.citations && data.citations.length > 0) {
            const citationsDiv = this.renderCitations(data.citations);
            messageDiv.appendChild(citationsDiv);
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Show error message in chat
     */
    showError(errorMessage) {
        this.addMessage('edwin', `⚠️ Error: ${errorMessage}`);
    }
};



// ========================================
// Module: template.js
// ========================================

// HTML template and CSS for Edwin panel
// This will be injected into the page by main.js

const EdwinTemplate = {
    /**
     * Create and inject Edwin UI into the page
     */
    createUI() {
        // Add CSS styles
        this.injectStyles();

        // Add Edwin button to Canvas sidebar
        this.addSidebarButton();

        // Create main panel
        this.createPanel();

        // Create quizzes tab
        this.createQuizzesTab();

        // Create settings modal
        this.createSettingsModal();
    },

    /**
     * Inject all CSS styles
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Edwin AI Styles - v11.0 */

            :root {
                --primary-color: #667eea;
                --primary-dark: #5568d3;
                --secondary-color: #764ba2;
                --success-color: #48bb78;
                --error-color: #f56565;
                --warning-color: #ed8936;

                --panel-bg: rgba(26, 32, 44, 0.98);
                --glass-bg: rgba(45, 55, 72, 0.6);
                --glass-border: rgba(255, 255, 255, 0.1);

                --text-primary: #f7fafc;
                --text-secondary: #cbd5e0;
                --text-muted: #a0aec0;

                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 12px;
                --spacing-lg: 16px;
                --spacing-xl: 24px;

                --border-radius: 12px;
                --border-radius-sm: 8px;
                --border-radius-lg: 16px;

                --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
                --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
                --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.3);

                --animation-fast: 0.15s;
                --animation-normal: 0.3s;
                --animation-slow: 0.5s;
            }

            /* Panel Base */
            #edwin-panel {
                position: fixed;
                right: 0;
                bottom: -100%;
                width: 450px;
                height: 100vh;
                background: var(--panel-bg);
                backdrop-filter: blur(20px);
                color: var(--text-primary);
                display: flex;
                flex-direction: column;
                transition: bottom var(--animation-slow) cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: var(--shadow-lg);
                opacity: 0;
                z-index: 9999;
                border-left: 1px solid var(--glass-border);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            #edwin-panel.open {
                bottom: 0;
                opacity: 1;
            }

            /* Header */
            .edwin-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-lg);
                font-size: 18px;
                font-weight: 600;
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid var(--glass-border);
            }

            .edwin-header-controls {
                display: flex;
                gap: var(--spacing-sm);
            }

            .edwin-header button {
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-sm);
                font-size: 18px;
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--spacing-sm) var(--spacing-md);
                transition: all var(--animation-fast);
            }

            .edwin-header button:hover {
                color: var(--text-primary);
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }

            /* Chat Messages */
            .edwin-body {
                padding: var(--spacing-lg);
                padding-bottom: 100px;
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            #edwin-messages {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .message {
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s ease-out;
            }

            .message.user {
                align-items: flex-end;
            }

            .message.edwin {
                align-items: flex-start;
            }

            .message-content {
                max-width: 85%;
                padding: var(--spacing-md);
                border-radius: var(--border-radius);
                background: var(--glass-bg);
                border: 1px solid var(--glass-border);
            }

            .message.user .message-content {
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            }

            /* Grounded Badge */
            .grounded-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                margin-bottom: 8px;
            }

            .grounded-badge.grounded {
                background: rgba(72, 187, 120, 0.2);
                color: #48bb78;
                border: 1px solid rgba(72, 187, 120, 0.3);
            }

            .grounded-badge.ungrounded {
                background: rgba(237, 137, 54, 0.2);
                color: #ed8936;
                border: 1px solid rgba(237, 137, 54, 0.3);
            }

            .sync-suggestion {
                margin-top: 8px;
                padding: 8px;
                background: rgba(237, 137, 54, 0.1);
                border-radius: 6px;
                font-size: 12px;
                color: var(--text-secondary);
            }

            /* Citations */
            .message-citations {
                margin-top: var(--spacing-md);
                padding: var(--spacing-sm);
                background: rgba(0, 0, 0, 0.03);
                border-radius: var(--border-radius);
                border-left: 3px solid var(--primary-color);
            }

            .citations-header {
                font-size: 13px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--spacing-sm);
            }

            .citation-item {
                margin-top: var(--spacing-sm);
                padding: var(--spacing-xs);
                font-size: 12px;
                color: var(--text-secondary);
            }

            .citation-link {
                color: var(--primary-color);
                text-decoration: none;
                font-weight: 500;
                transition: color 0.2s;
            }

            .citation-link:hover {
                color: var(--primary-dark);
                text-decoration: underline;
            }

            .citation-snippet {
                margin-top: 4px;
                padding: 6px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                font-size: 11px;
                font-style: italic;
                color: var(--text-muted);
            }

            /* Footer Input */
            .edwin-footer {
                display: flex;
                padding: var(--spacing-md) var(--spacing-lg);
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border-top: 1px solid var(--glass-border);
                gap: var(--spacing-md);
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
            }

            .input-wrapper {
                flex: 1;
                position: relative;
            }

            .edwin-footer input {
                width: 100%;
                padding: var(--spacing-md);
                border-radius: var(--border-radius);
                border: 1px solid var(--glass-border);
                background: var(--glass-bg);
                color: var(--text-primary);
                font-size: 14px;
                transition: all var(--animation-normal);
            }

            .edwin-footer input:focus {
                outline: none;
                border-color: var(--primary-color);
            }

            .edwin-footer button {
                padding: var(--spacing-md) var(--spacing-lg);
                border: none;
                border-radius: var(--border-radius);
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all var(--animation-normal);
            }

            .edwin-footer button:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            /* Settings Modal */
            .settings-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                align-items: center;
                justify-content: center;
            }

            .settings-modal.show {
                display: flex;
            }

            .settings-content {
                background: var(--panel-bg);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .settings-section {
                margin-bottom: var(--spacing-lg);
                padding-bottom: var(--spacing-lg);
                border-bottom: 1px solid var(--glass-border);
            }

            .settings-section:last-child {
                border-bottom: none;
            }

            .settings-btn {
                width: 100%;
                padding: var(--spacing-md);
                margin-top: var(--spacing-sm);
                border: 1px solid var(--glass-border);
                border-radius: var(--border-radius);
                background: var(--glass-bg);
                color: var(--text-primary);
                cursor: pointer;
                transition: all var(--animation-fast);
            }

            .settings-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: translateY(-2px);
            }

            .settings-btn.primary {
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                border: none;
            }

            .sync-status {
                margin-top: var(--spacing-sm);
                padding: var(--spacing-sm);
                border-radius: var(--border-radius-sm);
                font-size: 13px;
            }

            .sync-status.success {
                background: rgba(72, 187, 120, 0.2);
                color: #48bb78;
            }

            .sync-status.error {
                background: rgba(245, 101, 101, 0.2);
                color: #f56565;
            }

            /* Backend Offline Banner */
            .backend-offline-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                padding: var(--spacing-md);
                background: var(--error-color);
                color: white;
                text-align: center;
                font-weight: 600;
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--spacing-md);
            }

            .backend-offline-banner button {
                padding: 4px 12px;
                border: 1px solid white;
                border-radius: 4px;
                background: transparent;
                color: white;
                cursor: pointer;
            }

            /* Auto-sync notification */
            .auto-sync-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: var(--spacing-md);
                background: var(--success-color);
                color: white;
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-lg);
                z-index: 9998;
                animation: slideInRight 0.3s ease-out;
                opacity: 1;
                transition: opacity 0.5s;
            }

            /* Quizzes Tab */
            #edwin-quizzes-tab {
                position: fixed;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                color: white;
                padding: 16px 12px;
                border-radius: 0 12px 12px 0;
                font-weight: 600;
                cursor: pointer;
                z-index: 9998;
                box-shadow: var(--shadow-lg);
                transition: all var(--animation-normal);
                writing-mode: vertical-rl;
            }

            #edwin-quizzes-tab:hover {
                padding-right: 16px;
                box-shadow: 0 8px 32px rgba(102, 126, 234, 0.5);
            }

            /* Animations */
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* Typing indicator */
            .typing-indicator {
                display: flex;
                gap: 4px;
                padding: 12px;
                background: var(--glass-bg);
                border-radius: var(--border-radius);
                width: fit-content;
            }

            .typing-indicator span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--text-secondary);
                animation: typing 1.4s infinite;
            }

            .typing-indicator span:nth-child(2) {
                animation-delay: 0.2s;
            }

            .typing-indicator span:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typing {
                0%, 60%, 100% {
                    opacity: 0.3;
                    transform: scale(0.8);
                }
                30% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Add Edwin button to Canvas sidebar
     */
    addSidebarButton() {
        const checkSidebar = setInterval(() => {
            const nav = document.querySelector('#section-tabs');
            if (nav && !document.querySelector('#edwin-btn')) {
                clearInterval(checkSidebar);

                const li = document.createElement('li');
                li.className = 'section';
                const a = document.createElement('a');
                a.id = 'edwin-btn';
                a.href = '#';
                a.innerHTML = '<span>Edwin AI</span>';

                Object.assign(a.style, {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '16px',
                    display: 'block',
                    padding: '18px 16px',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
                    fontWeight: '600',
                    fontSize: '17px',
                    color: 'white',
                    transition: 'all 0.3s'
                });

                a.onclick = (e) => {
                    e.preventDefault();
                    const panel = document.getElementById('edwin-panel');
                    if (panel) {
                        panel.classList.add('open');
                        setTimeout(() => {
                            const input = document.getElementById('edwin-chat-input');
                            if (input) input.focus();
                        }, 500);
                    }
                };

                li.appendChild(a);
                nav.appendChild(li);
            }
        }, 500);
    },

    /**
     * Create main Edwin panel
     */
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'edwin-panel';
        panel.innerHTML = `
            <div class="edwin-header">
                <span>Edwin AI</span>
                <div class="edwin-header-controls">
                    <button id="edwin-settings" aria-label="Settings">⚙</button>
                    <button id="edwin-clear" aria-label="Clear chat">🗑</button>
                    <button id="edwin-close" aria-label="Close panel">✕</button>
                </div>
            </div>

            <div class="edwin-body">
                <div id="edwin-greeting" style="text-align: center; padding: 24px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🤖</div>
                    <h1 style="font-size: 24px; margin-bottom: 8px;">Hello, I am here to assist you</h1>
                    <p style="color: var(--text-secondary);">I have access to course materials you've synced.</p>
                </div>
                <div id="edwin-messages"></div>
            </div>

            <div class="edwin-footer">
                <div class="input-wrapper">
                    <input type="text" id="edwin-chat-input" placeholder="Ask Edwin anything..." />
                </div>
                <button id="edwin-send-btn">Send</button>
            </div>
        `;
        document.body.appendChild(panel);
    },

    /**
     * Create quizzes tab
     */
    createQuizzesTab() {
        const tab = document.createElement('div');
        tab.id = 'edwin-quizzes-tab';
        tab.textContent = 'Quizzes';
        tab.onclick = () => {
            alert('Quizzes feature - coming soon in full build!');
        };
        document.body.appendChild(tab);
    },

    /**
     * Create settings modal
     */
    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'edwin-settings-modal';
        modal.className = 'settings-modal';
        modal.innerHTML = `
            <div class="settings-content">
                <h2 style="margin-bottom: 24px;">Settings</h2>

                <div class="settings-section">
                    <h3>Auto-Sync</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        Automatically sync supported pages when you visit them
                    </p>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="auto-sync-toggle" />
                        <span>Enable Auto-Sync</span>
                    </label>
                    <div id="auto-sync-status" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);"></div>
                </div>

                <div class="settings-section" id="explain-page-section">
                    <h3>Page Analysis</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        Get AI-powered explanations and practice questions
                    </p>
                    <button id="explain-page-btn" class="settings-btn primary">
                        📖 Explain This Page
                    </button>
                    <button id="practice-questions-btn" class="settings-btn">
                        📝 Generate Practice Questions
                    </button>
                </div>

                <div class="settings-section" id="page-sync-section">
                    <h3>Manual Sync</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                        Sync the current page to Edwin's knowledge base
                    </p>
                    <button id="sync-current-page-btn" class="settings-btn">
                        📄 Sync This Page
                    </button>
                    <div id="page-sync-status" class="sync-status"></div>
                </div>

                <button id="close-settings-btn" class="settings-btn" style="margin-top: 24px;">
                    Close
                </button>
            </div>
        `;

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        };

        document.body.appendChild(modal);

        // Attach event listeners
        document.getElementById('edwin-settings').onclick = () => {
            modal.classList.add('show');
        };

        document.getElementById('close-settings-btn').onclick = () => {
            modal.classList.remove('show');
        };

        document.getElementById('edwin-close').onclick = () => {
            document.getElementById('edwin-panel').classList.remove('open');
        };

        document.getElementById('edwin-clear').onclick = () => {
            const messages = document.getElementById('edwin-messages');
            if (messages) messages.innerHTML = '';
        };
    }
};



// ========================================
// Module: features/autoSync.js
// ========================================

// Auto-sync feature for automatically syncing Canvas pages

const AutoSync = {
    /**
     * Check if auto-sync is enabled
     */
    isEnabled() {
        const enabled = localStorage.getItem(CONFIG.STORAGE.AUTO_SYNC_ENABLED);
        return enabled === null ? CONFIG.AUTO_SYNC.ENABLED_BY_DEFAULT : enabled === 'true';
    },

    /**
     * Set auto-sync enabled state
     */
    setEnabled(enabled) {
        localStorage.setItem(CONFIG.STORAGE.AUTO_SYNC_ENABLED, enabled.toString());
    },

    /**
     * Get sync history from localStorage
     */
    getSyncHistory() {
        const history = localStorage.getItem(CONFIG.STORAGE.SYNC_HISTORY);
        return history ? JSON.parse(history) : {};
    },

    /**
     * Save sync history to localStorage
     */
    saveSyncHistory(history) {
        localStorage.setItem(CONFIG.STORAGE.SYNC_HISTORY, JSON.stringify(history));
    },

    /**
     * Check if URL was recently synced (within cooldown period)
     */
    wasRecentlySynced(url) {
        const history = this.getSyncHistory();
        const lastSync = history[url];

        if (!lastSync) return false;

        const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
        return hoursSinceSync < CONFIG.AUTO_SYNC.COOLDOWN_HOURS;
    },

    /**
     * Mark URL as synced
     */
    markAsSynced(url) {
        const history = this.getSyncHistory();
        history[url] = Date.now();
        this.saveSyncHistory(history);
    },

    /**
     * Check if current page should be auto-synced
     */
    shouldAutoSync() {
        // Check if auto-sync is enabled
        if (!this.isEnabled()) return false;

        // Check if page type is supported
        if (!CanvasDetect.isSyncablePage()) return false;

        // Check if course ID is available
        const courseId = CanvasDetect.getCourseId();
        if (!courseId) return false;

        // Check if URL was recently synced
        const currentUrl = window.location.href;
        if (this.wasRecentlySynced(currentUrl)) return false;

        return true;
    },

    /**
     * Perform auto-sync
     */
    async performAutoSync() {
        if (!this.shouldAutoSync()) {
            console.log('AutoSync: Skipping (not eligible)');
            return { success: false, reason: 'not_eligible' };
        }

        const userToken = CanvasDetect.getUserToken();
        const courseId = CanvasDetect.getCourseId();
        const currentUrl = window.location.href;

        console.log('AutoSync: Starting auto-sync...');

        // Extract page content
        const pageContent = Scraper.extractPageContent();

        // Check if content is substantial
        if (!pageContent.text || pageContent.text.length < 50) {
            console.log('AutoSync: Insufficient content');
            return { success: false, reason: 'insufficient_content' };
        }

        // Sync to backend
        const result = await API.syncPageContent(
            userToken,
            courseId,
            pageContent.title,
            currentUrl,
            pageContent.text
        );

        if (result.success) {
            // Mark as synced
            this.markAsSynced(currentUrl);

            // Update UI status
            UI.updateAutoSyncStatus();

            console.log(`AutoSync: Successfully synced "${pageContent.title}"`);
            return { success: true, pageTitle: pageContent.title };
        } else {
            console.error('AutoSync: Failed to sync:', result.error);
            return { success: false, reason: 'api_error', error: result.error };
        }
    },

    /**
     * Initialize auto-sync on page load
     */
    async init() {
        // Wait for page to fully load
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // Wait additional time for Canvas to render content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Perform auto-sync
        const result = await this.performAutoSync();

        // Show subtle notification if synced
        if (result.success) {
            const notification = document.createElement('div');
            notification.className = 'auto-sync-notification';
            notification.textContent = `✓ Auto-synced: ${result.pageTitle}`;
            document.body.appendChild(notification);

            // Fade out after 3 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }
    },

    /**
     * Clear sync history (for testing)
     */
    clearHistory() {
        localStorage.removeItem(CONFIG.STORAGE.SYNC_HISTORY);
        console.log('AutoSync: Sync history cleared');
    },

    /**
     * Get sync statistics
     */
    getStats() {
        const history = this.getSyncHistory();
        const urls = Object.keys(history);

        if (urls.length === 0) {
            return {
                totalSynced: 0,
                lastSync: null,
                oldestSync: null
            };
        }

        const timestamps = Object.values(history);
        const mostRecent = Math.max(...timestamps);
        const oldest = Math.min(...timestamps);

        return {
            totalSynced: urls.length,
            lastSync: new Date(mostRecent),
            oldestSync: new Date(oldest),
            urls: urls
        };
    }
};



// ========================================
// Module: features/explainThisPage.js
// ========================================

// "Explain This Page" and "Generate Practice Questions" feature

const ExplainThisPage = {
    /**
     * Explain the current page
     */
    async explainPage() {
        const userToken = CanvasDetect.getUserToken();
        const courseId = CanvasDetect.getCourseId();

        if (!courseId) {
            UI.showError('Please navigate to a Canvas course page');
            return;
        }

        // Extract page content
        const pageContent = Scraper.extractPageContent();

        if (!pageContent.text || pageContent.text.length < 50) {
            UI.showError('No significant content found on this page to explain');
            return;
        }

        // Show loading message
        UI.addMessage('user', 'Explain this page');
        UI.addMessage('edwin', '🤔 Analyzing page content...');

        // Call API
        const result = await API.explainPage(
            userToken,
            courseId,
            pageContent.title,
            pageContent.text,
            'explain'
        );

        // Remove loading message
        const messagesContainer = document.getElementById('edwin-messages');
        if (messagesContainer && messagesContainer.lastChild) {
            messagesContainer.removeChild(messagesContainer.lastChild);
        }

        if (result.success) {
            UI.renderExplanation(result.data, 'explain');
        } else {
            UI.showError(result.error || 'Failed to explain page');
        }
    },

    /**
     * Generate practice questions from current page
     */
    async generatePracticeQuestions() {
        const userToken = CanvasDetect.getUserToken();
        const courseId = CanvasDetect.getCourseId();

        if (!courseId) {
            UI.showError('Please navigate to a Canvas course page');
            return;
        }

        // Extract page content
        const pageContent = Scraper.extractPageContent();

        if (!pageContent.text || pageContent.text.length < 100) {
            UI.showError('Not enough content on this page to generate practice questions');
            return;
        }

        // Show loading message
        UI.addMessage('user', 'Generate practice questions from this page');
        UI.addMessage('edwin', '📝 Generating practice questions...');

        // Call API
        const result = await API.explainPage(
            userToken,
            courseId,
            pageContent.title,
            pageContent.text,
            'practice'
        );

        // Remove loading message
        const messagesContainer = document.getElementById('edwin-messages');
        if (messagesContainer && messagesContainer.lastChild) {
            messagesContainer.removeChild(messagesContainer.lastChild);
        }

        if (result.success) {
            // If API returned questions, we could add them to quiz list
            // For now, just show confirmation
            UI.renderExplanation(result.data, 'practice');

            // TODO: Add questions to quiz list if returned in result.data.questions
        } else {
            UI.showError(result.error || 'Failed to generate practice questions');
        }
    },

    /**
     * Add "Explain This Page" buttons to settings panel
     */
    addButtonsToUI() {
        const settingsBody = document.querySelector('.settings-body');
        if (!settingsBody) return;

        // Check if buttons already exist
        if (document.getElementById('explain-page-section')) return;

        const section = document.createElement('div');
        section.id = 'explain-page-section';
        section.className = 'settings-section';
        section.innerHTML = `
            <h3>Page Analysis</h3>
            <p class="settings-description">Get AI-powered explanations and practice questions from the current page</p>

            <button id="explain-page-btn" class="settings-btn primary">
                📖 Explain This Page
            </button>

            <button id="practice-questions-btn" class="settings-btn secondary">
                📝 Generate Practice Questions
            </button>

            <div id="explain-status" class="sync-status"></div>
        `;

        // Insert before sync section
        const syncSection = document.getElementById('page-sync-section');
        if (syncSection) {
            settingsBody.insertBefore(section, syncSection);
        } else {
            settingsBody.appendChild(section);
        }

        // Add event listeners
        document.getElementById('explain-page-btn').addEventListener('click', async () => {
            UI.setButtonLoading('explain-page-btn', true, '🤔 Analyzing...', '📖 Explain This Page');

            await this.explainPage();

            UI.setButtonLoading('explain-page-btn', false);

            // Close settings modal
            const modal = document.getElementById('edwin-settings-modal');
            if (modal) modal.style.display = 'none';
        });

        document.getElementById('practice-questions-btn').addEventListener('click', async () => {
            UI.setButtonLoading('practice-questions-btn', true, '📝 Generating...', '📝 Generate Practice Questions');

            await this.generatePracticeQuestions();

            UI.setButtonLoading('practice-questions-btn', false);

            // Close settings modal
            const modal = document.getElementById('edwin-settings-modal');
            if (modal) modal.style.display = 'none';
        });
    },

    /**
     * Initialize the feature
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.addButtonsToUI());
        } else {
            // DOM already loaded, add buttons after short delay to ensure settings panel exists
            setTimeout(() => this.addButtonsToUI(), 1000);
        }
    }
};



// ========================================
// Module: main.js
// ========================================

// Main initialization and event handlers for Edwin AI

(function() {
    // Global state
    let userToken = null;
    let courseId = null;
    let conversationId = null;
    let backendOnline = false;

    /**
     * Initialize Edwin on page load
     */
    async function init() {
        console.log('Edwin: Initializing...');

        // Detect user and course
        userToken = CanvasDetect.getUserToken();
        courseId = CanvasDetect.getCourseId();

        console.log(`Edwin: User token: ${userToken}`);
        console.log(`Edwin: Course ID: ${courseId || 'Not on a course page'}`);

        // Check backend health
        await checkBackendHealth();

        // Initialize UI
        createEdwinUI();

        // Initialize features
        if (courseId && backendOnline) {
            // Initialize auto-sync
            AutoSync.init();

            // Initialize explain-this-page feature
            ExplainThisPage.init();

            // Create new conversation
            await createConversation();

            // Load progress
            await loadProgress();
        }

        console.log('Edwin: Initialization complete');
    }

    /**
     * Check if backend is online
     */
    async function checkBackendHealth() {
        const result = await API.checkHealth();

        if (result.success) {
            backendOnline = true;
            UI.hideBackendOffline();
            console.log('Edwin: Backend is online');
        } else {
            backendOnline = false;
            UI.showBackendOffline();
            console.error('Edwin: Backend is offline:', result.error);
        }

        return backendOnline;
    }

    /**
     * Create new conversation
     */
    async function createConversation() {
        if (!userToken || !courseId) return;

        const result = await API.newConversation(userToken, courseId);

        if (result.success) {
            conversationId = result.data.conversationID;
            console.log(`Edwin: Conversation created: ${conversationId}`);
        }
    }

    /**
     * Load user progress
     */
    async function loadProgress() {
        if (!userToken || !courseId) return;

        const result = await API.getProgress(userToken, courseId);

        if (result.success) {
            UI.updateProgressDisplay(result.data.progress);
        }
    }

    /**
     * Send message to Edwin
     */
    async function sendMessage(question) {
        if (!backendOnline) {
            UI.showError('Backend is offline. Please start the backend server.');
            return;
        }

        if (!courseId) {
            UI.showError('Please navigate to a Canvas course page');
            return;
        }

        // Add user message
        UI.addMessage('user', question);

        // Show typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        document.getElementById('edwin-messages').appendChild(typingDiv);

        // Send to backend
        const result = await API.sendMessage(userToken, courseId, question);

        // Remove typing indicator
        typingDiv.remove();

        if (result.success) {
            const data = result.data;
            const grounded = data.citations && data.citations.length > 0;

            UI.addMessage('edwin', data.answer, data.citations, grounded);
        } else {
            UI.showError(result.error || 'Failed to get response');
        }
    }

    /**
     * Sync current page
     */
    async function syncCurrentPage() {
        if (!backendOnline) {
            UI.showSyncStatus('Backend is offline', 'error');
            return;
        }

        if (!courseId) {
            UI.showSyncStatus('Please navigate to a Canvas course page', 'error');
            return;
        }

        UI.showSyncStatus('⏳ Extracting page content...', 'info');
        UI.setButtonLoading('sync-current-page-btn', true, '⏳ Syncing...', '📄 Sync This Page');

        // Extract content
        const pageContent = Scraper.extractPageContent();

        if (!pageContent.text || pageContent.text.length < 50) {
            UI.showSyncStatus('⚠ No significant content found on this page', 'error');
            UI.setButtonLoading('sync-current-page-btn', false);
            return;
        }

        // Sync to backend
        const result = await API.syncPageContent(
            userToken,
            courseId,
            pageContent.title,
            window.location.href,
            pageContent.text
        );

        UI.setButtonLoading('sync-current-page-btn', false);

        if (result.success) {
            const contentBlocks = Math.floor(pageContent.text.length / 100);
            UI.showSyncStatus(`✓ Page synced! Added ${contentBlocks} content blocks`, 'success');

            // Mark as synced in auto-sync history
            AutoSync.markAsSynced(window.location.href);
            UI.updateAutoSyncStatus();
        } else {
            UI.showSyncStatus(`⚠ Sync failed: ${result.error}`, 'error');
        }
    }

    /**
     * Generate quiz
     */
    async function generateQuiz(topic, difficulty, numQuestions) {
        if (!backendOnline) {
            UI.showError('Backend is offline');
            return null;
        }

        if (!courseId) {
            UI.showError('Please navigate to a Canvas course page');
            return null;
        }

        const result = await API.generateQuiz(courseId, topic, difficulty, numQuestions);

        if (result.success) {
            // Load progress after quiz generation
            await loadProgress();
            return result.data;
        } else {
            UI.showError(result.error || 'Failed to generate quiz');
            return null;
        }
    }

    /**
     * Log quiz attempt
     */
    function logQuizAttempt(question, quizTitle, selectedOption, correctOption, isCorrect) {
        if (!userToken) return;

        // Fire-and-forget
        API.logQuizAttempt(userToken, question, quizTitle, selectedOption, correctOption, isCorrect);

        // Reload progress after short delay
        setTimeout(() => loadProgress(), 1000);
    }

    /**
     * Create Edwin UI using template
     */
    function createEdwinUI() {
        // Use the template module to create all UI elements
        EdwinTemplate.createUI();

        console.log('Edwin: UI created');

        // Set up event listeners after UI is created
        setTimeout(() => {
            setupEventListeners();
        }, 500);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('edwin-chat-input');
        const sendBtn = document.getElementById('edwin-send-btn');

        if (chatInput && sendBtn) {
            sendBtn.addEventListener('click', () => {
                const question = chatInput.value.trim();
                if (question) {
                    sendMessage(question);
                    chatInput.value = '';
                }
            });

            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendBtn.click();
                }
            });
        }

        // Sync button
        const syncBtn = document.getElementById('sync-current-page-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', syncCurrentPage);
        }

        // Auto-sync toggle
        const autoSyncToggle = document.getElementById('auto-sync-toggle');
        if (autoSyncToggle) {
            autoSyncToggle.checked = AutoSync.isEnabled();

            autoSyncToggle.addEventListener('change', (e) => {
                AutoSync.setEnabled(e.target.checked);
                console.log(`Edwin: Auto-sync ${e.target.checked ? 'enabled' : 'disabled'}`);
            });
        }

        // Update auto-sync status on page load
        UI.updateAutoSyncStatus();

        console.log('Edwin: Event listeners attached');
    }

    /**
     * Expose public API for quiz integration
     * (Quiz UI code can call these functions)
     */
    window.Edwin = {
        sendMessage,
        syncCurrentPage,
        generateQuiz,
        logQuizAttempt,
        checkBackendHealth,
        getState: () => ({ userToken, courseId, backendOnline })
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();


})();
