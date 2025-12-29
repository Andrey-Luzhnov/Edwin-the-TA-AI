    // ==UserScript==
    // @name         Edwin AI Canvas Chat (Enhanced UI) - Full Panel v11.0
    // @namespace    http://tampermonkey.net/
    // @version      11.0.0
    // @description  Edwin AI panel with modern UI, smooth animations, and enhanced UX
    // @match        https://canvas.asu.edu/*
    // @grant        none
    // ==/UserScript==

    (function() {
        'use strict';

        // BACKEND CONFIGURATION
        const BACKEND_BASE_URL = 'http://localhost:5000';

        // Auto-sync configuration
        const AUTO_SYNC_CONFIG = {
            ENABLED_BY_DEFAULT: true,
            COOLDOWN_HOURS: 12,
            SUPPORTED_PAGE_TYPES: ['syllabus', 'assignments', 'modules', 'announcements', 'assignment']
        };

        // Extract course ID from Canvas URL
        function getCourseIdFromURL() {
            const match = window.location.pathname.match(/\/courses\/(\d+)/);
            return match ? parseInt(match[1]) : null;
        }

        // Auto-detect course name from Canvas page
        function getCourseNameFromCanvas() {
            // Try multiple selectors for course name
            const selectors = [
                '#course_show_secondary a.course-title',
                'a.course-title',
                '#breadcrumbs li:nth-child(2) a',
                '.ic-app-nav-toggle-and-crumbs a[href*="/courses/"]',
                'nav[aria-label="breadcrumbs"] a[href*="/courses/"]'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const courseName = element.textContent?.trim();
                    if (courseName && courseName.length > 0 && !courseName.includes('Dashboard')) {
                        return courseName;
                    }
                }
            }

            // Fallback: try to extract from page title
            const pageTitle = document.title;
            const courseTitleMatch = pageTitle.match(/^([^:]+):/);
            if (courseTitleMatch) {
                return courseTitleMatch[1].trim();
            }

            // Final fallback
            return 'Course';
        }

        const COURSE_ID = getCourseIdFromURL();
        const COURSE_NAME = getCourseNameFromCanvas();

        // Auto-detect user name from Canvas page header
        function getUserNameFromCanvas() {
            // Try multiple selectors for user name
            const selectors = [
                '#global_nav_profile_link',
                '.ic-avatar__image',
                'button[data-testid="account-menu-button"]',
                '.user_name'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const userName = element.getAttribute('aria-label') ||
                                element.getAttribute('title') ||
                                element.textContent?.trim();
                    if (userName && userName.length > 0) {
                        return userName.replace('User: ', '').replace('Account', '').trim();
                    }
                }
            }

            // Fallback: try to get from page title or meta
            const pageUser = document.querySelector('meta[name="user_name"]');
            if (pageUser) return pageUser.getAttribute('content');

            return null;
        }

        // Generate UUID v4
        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // Generate or retrieve user token from localStorage
        function getUserToken() {
            const STORAGE_KEY = 'edwin_user_token';
            const STORAGE_NAME = 'edwin_user_name';

            let userToken = localStorage.getItem(STORAGE_KEY);
            let userName = localStorage.getItem(STORAGE_NAME);
            const detectedName = getUserNameFromCanvas();

            // Generate new token if none exists or user changed
            if (!userToken || (detectedName && detectedName !== userName && detectedName !== null)) {
                userToken = generateUUID();
                localStorage.setItem(STORAGE_KEY, userToken);

                if (detectedName) {
                    localStorage.setItem(STORAGE_NAME, detectedName);
                    console.log(`Edwin: Detected user "${detectedName}" with token ${userToken}`);
                } else {
                    localStorage.setItem(STORAGE_NAME, 'Student');
                    console.log(`Edwin: Generated anonymous user token ${userToken}`);
                }
            }

            return userToken;
        }

        // Get dynamic user token (UUID)
        const USER_ID = getUserToken();

        // CONFIGURATION
        const customSentence = "Hello, what is the grade breakdown for this class?";
        const wordDelay = 200;
        const wordDelayVariance = 100;
        const initialTypingDelay = 2000;
        const panelMarginLeft = 0;
        const panelMarginRight = 0;
        const rainbowSpeed = 8;
        const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'];
        const quizzesPanelSpeed = 8;
        const quizzesPanelColors = ['#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#f1f3f5', '#e0e0e0', '#f8f9fa'];

        // PROGRESS BAR CONFIGURATION
        let quizProgressStage = 0;
        const progressBarWidth = 200;
        const progressBarHeight = 18;
        const progressBarSpacing = 4;
        const progressBarFilledColor = '#ff6b35';
        const progressBarEmptyColor = '#555';


        let isTypingMode = false, isCurrentlyTyping = false, startTimeoutID = null;

        // Quizzes tab configuration
        const quizzesTabExtensionClosed = '51';
        const quizzesTabExtensionOpen = '-1790';
        const quizzesTabAnimationSpeed = 0.39;

        // DOM SCRAPING FUNCTION
        function extractCanvasPageContent() {
            /**
             * Extracts visible content from Canvas pages (syllabus, assignments, modules, etc.)
             * Returns: { title: string, text: string }
             */
            let pageTitle = document.title || 'Untitled Page';
            let extractedText = '';

            // Remove Edwin panel and other UI overlays from extraction
            const elementsToSkip = ['edwin-panel', 'edwin-settings-modal', 'edwin-quizzes-tab'];

            // Target content areas in Canvas
            const contentSelectors = [
                '#content',                          // Main content area
                '.user_content',                     // Course materials
                '.show-content',                     // Assignment content
                '.syllabus_content',                 // Syllabus
                '.description',                      // Module/assignment descriptions
                '.requirements_message',             // Assignment requirements
                '.submission_details',               // Submission info
                '.context_module_item',              // Module items
                'article',                           // Canvas article content
                '.discussion-topic',                 // Discussion topics
                '.user_content_post_body'            // Discussion posts
            ];

            // Extract text from each content area
            for (const selector of contentSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    // Skip if it's part of Edwin UI
                    if (elementsToSkip.some(id => element.id === id || element.closest(`#${id}`))) {
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
                .replace(/\n{3,}/g, '\n\n')          // Remove excessive newlines
                .replace(/\s{3,}/g, ' ')             // Remove excessive spaces
                .trim();

            return {
                title: pageTitle,
                text: extractedText
            };
        }

        // BACKEND API FUNCTIONS
        async function checkBackendHealth() {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(10000)
                });
                const data = await response.json();
                return response.ok && data.success;
            } catch (error) {
                console.error('Backend health check failed:', error);
                return false;
            }
        }

        async function createNewConversation() {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/newConversation`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userID: USER_ID,
                        courseID: COURSE_ID
                    }),
                    signal: AbortSignal.timeout(10000)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    console.log('New conversation created:', data.message);
                    return true;
                } else {
                    console.error('Failed to create new conversation:', data.message);
                    return false;
                }
            } catch (error) {
                console.error('Network error creating new conversation:', error);
                return false;
            }
        }

        async function sendMessageToBackend(question) {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userID: USER_ID,
                        courseID: COURSE_ID,
                        question: question
                    }),
                    signal: AbortSignal.timeout(30000)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    return {
                        success: true,
                        answer: data.answer,
                        citations: data.citations || [],
                        grounded: data.grounded || false,
                        message: data.message
                    };
                } else {
                    return {
                        success: false,
                        answer: "I'm having trouble connecting to my knowledge base. Please try again in a moment.",
                        message: data.message || "Unknown error",
                        grounded: false
                    };
                }
            } catch (error) {
                console.error('Network error sending message:', error);
                return {
                    success: false,
                    answer: "I'm currently offline. Please check your connection and try again.",
                    message: error.message,
                    grounded: false
                };
            }
        }

        async function explainPage(mode = 'explain') {
            try {
                const pageContent = extractCanvasPageContent();

                if (!pageContent.text || pageContent.text.length < 50) {
                    return {
                        success: false,
                        message: 'No significant content found on this page'
                    };
                }

                const response = await fetch(`${BACKEND_BASE_URL}/api/explainPage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userID: USER_ID,
                        courseID: COURSE_ID,
                        pageTitle: pageContent.title,
                        content: pageContent.text,
                        mode: mode
                    }),
                    signal: AbortSignal.timeout(30000)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    return {
                        success: true,
                        data: data
                    };
                } else {
                    return {
                        success: false,
                        message: data.message || 'Failed to explain page'
                    };
                }
            } catch (error) {
                console.error('Error explaining page:', error);
                return {
                    success: false,
                    message: error.message || 'Network error'
                };
            }
        }

        // AUTO-SYNC FUNCTIONALITY
        function getPageType() {
            const path = window.location.pathname;
            if (path.includes('/assignments/')) return 'assignment';
            if (path.includes('/assignments')) return 'assignments';
            if (path.includes('/syllabus')) return 'syllabus';
            if (path.includes('/modules')) return 'modules';
            if (path.includes('/announcements')) return 'announcements';
            return null;
        }

        function shouldAutoSync() {
            const pageType = getPageType();
            if (!pageType || !AUTO_SYNC_CONFIG.SUPPORTED_PAGE_TYPES.includes(pageType)) {
                return false;
            }

            const autoSyncEnabled = localStorage.getItem('edwin_auto_sync_enabled');
            if (autoSyncEnabled === 'false') {
                return false;
            }

            const currentURL = window.location.href;
            const syncHistory = JSON.parse(localStorage.getItem('edwin_sync_history') || '{}');
            const lastSync = syncHistory[currentURL];

            if (lastSync) {
                const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
                if (hoursSinceSync < AUTO_SYNC_CONFIG.COOLDOWN_HOURS) {
                    console.log(`Edwin: Page synced ${hoursSinceSync.toFixed(1)}h ago, skipping auto-sync`);
                    return false;
                }
            }

            return true;
        }

        async function performAutoSync() {
            if (!shouldAutoSync()) return;

            console.log('Edwin: Auto-syncing current page...');

            const pageContent = extractCanvasPageContent();
            if (!pageContent.text || pageContent.text.length < 50) {
                console.log('Edwin: No significant content found, skipping auto-sync');
                return;
            }

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/syncPageContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userID: USER_ID,
                        courseID: COURSE_ID,
                        pageTitle: pageContent.title,
                        pageURL: window.location.href,
                        content: pageContent.text
                    }),
                    signal: AbortSignal.timeout(10000)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    const syncHistory = JSON.parse(localStorage.getItem('edwin_sync_history') || '{}');
                    syncHistory[window.location.href] = Date.now();
                    localStorage.setItem('edwin_sync_history', JSON.stringify(syncHistory));

                    showNotification(`✓ Auto-synced: ${pageContent.title}`, 'success');
                    console.log('Edwin: Auto-sync successful');
                }
            } catch (error) {
                console.error('Edwin: Auto-sync failed:', error);
            }
        }

        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `edwin-notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                background: ${type === 'success' ? 'linear-gradient(135deg, #4caf50, #2e7d32)' :
                            type === 'error' ? 'linear-gradient(135deg, #f44336, #b71c1c)' :
                            'linear-gradient(135deg, #2196f3, #1565c0)'};
                color: white;
                border-radius: 12px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                font-weight: 600;
                animation: slideInRight 0.3s ease-out;
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        function getAutoSyncStatus() {
            const syncHistory = JSON.parse(localStorage.getItem('edwin_sync_history') || '{}');
            const count = Object.keys(syncHistory).length;

            if (count === 0) return 'No pages synced yet';

            const timestamps = Object.values(syncHistory);
            const mostRecent = Math.max(...timestamps);
            const minutesAgo = Math.floor((Date.now() - mostRecent) / (1000 * 60));

            let timeStr;
            if (minutesAgo < 1) timeStr = 'just now';
            else if (minutesAgo < 60) timeStr = `${minutesAgo} min${minutesAgo > 1 ? 's' : ''} ago`;
            else {
                const hoursAgo = Math.floor(minutesAgo / 60);
                timeStr = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
            }

            return `Synced ${count} page${count > 1 ? 's' : ''} • Last sync: ${timeStr}`;
        }

        // Kill Canvas floating scroll buttons if they exist
        const killScrollBtns = setInterval(() => {
            const btns = document.querySelectorAll('.ui-scroll-to-top, .ui-scroll-to-bottom');
            if (btns.length) {
                btns.forEach(b => b.remove());
                clearInterval(killScrollBtns);
            }
        }, 500);

        // Check backend health and show offline banner if needed
        async function checkAndShowOfflineBanner() {
            const isOnline = await checkBackendHealth();

            let banner = document.getElementById('edwin-offline-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'edwin-offline-banner';
                banner.innerHTML = '⚠️ Edwin AI Backend is offline - Please start the backend server';
                document.body.appendChild(banner);
            }

            if (!isOnline) {
                banner.classList.add('show');
                console.log('Edwin: Backend is offline');
            } else {
                banner.classList.remove('show');
                console.log('Edwin: Backend is online');
            }
        }

        // DELIVERABLE A: HIGHLIGHT-TO-EXPLAIN FEATURE
        let highlightTooltip = null;

        function createHighlightTooltip() {
            if (highlightTooltip) return;

            highlightTooltip = document.createElement('div');
            highlightTooltip.id = 'edwin-highlight-tooltip';
            highlightTooltip.innerHTML = '💡 Explain selection';
            highlightTooltip.style.cssText = `
                position: absolute;
                display: none;
                padding: 8px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                z-index: 999998;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                white-space: nowrap;
                transition: transform 0.2s, box-shadow 0.2s;
            `;

            highlightTooltip.addEventListener('mouseenter', () => {
                highlightTooltip.style.transform = 'translateY(-2px)';
                highlightTooltip.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
            });

            highlightTooltip.addEventListener('mouseleave', () => {
                highlightTooltip.style.transform = 'translateY(0)';
                highlightTooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            });

            highlightTooltip.addEventListener('click', handleExplainSelection);

            document.body.appendChild(highlightTooltip);
        }

        async function handleExplainSelection() {
            console.log('🔍 DEBUG: Tooltip clicked! handleExplainSelection function started');

            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            console.log('🔍 DEBUG: Selected text:', selectedText);
            console.log('🔍 DEBUG: Selected text length:', selectedText.length);

            if (!selectedText) {
                console.log('❌ DEBUG: No text selected, returning early');
                return;
            }

            // Hide tooltip
            highlightTooltip.style.display = 'none';
            console.log('✅ DEBUG: Tooltip hidden');

            // Open Edwin panel if not already open
            const panel = document.getElementById('edwin-panel');
            console.log('🔍 DEBUG: Edwin panel element:', panel);
            if (!panel.classList.contains('open')) {
                panel.classList.add('open');
                console.log('✅ DEBUG: Edwin panel opened');
            }

            // Show loading message in chat
            const chat = document.getElementById('edwin-chat');
            console.log('🔍 DEBUG: Chat element:', chat);
            const loadingMsg = document.createElement('div');
            loadingMsg.className = 'edwin-msg edwin show';
            loadingMsg.innerHTML = `
                <div class="message-avatar thinking-avatar">💡</div>
                <div class="message-content">
                    <div class="message-bubble thinking-bubble">
                        Explaining your selection...
                        <div class="thinking-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            chat.appendChild(loadingMsg);
            chat.scrollTop = chat.scrollHeight;
            console.log('✅ DEBUG: Loading message added to chat');

            try {
                const requestPayload = {
                    userID: USER_ID,
                    courseID: COURSE_ID,
                    pageTitle: document.title,
                    content: selectedText,
                    pageURL: window.location.href,
                    mode: 'explain'
                };
                console.log('🔍 DEBUG: Request payload:', requestPayload);
                console.log('🔍 DEBUG: Backend URL:', `${BACKEND_BASE_URL}/api/explainPage`);

                const response = await fetch(`${BACKEND_BASE_URL}/api/explainPage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestPayload),
                    signal: AbortSignal.timeout(30000)
                });

                console.log('🔍 DEBUG: Response received:', response);
                console.log('🔍 DEBUG: Response status:', response.status);
                console.log('🔍 DEBUG: Response ok:', response.ok);

                const data = await response.json();
                console.log('🔍 DEBUG: Response data:', data);

                // Remove loading message
                loadingMsg.classList.add('fade-out');
                setTimeout(() => chat.removeChild(loadingMsg), 300);

                if (response.ok && data.success) {
                    console.log('✅ DEBUG: Response successful, building explanation message');

                    // Add explanation to chat
                    const explanationMsg = document.createElement('div');
                    explanationMsg.className = 'edwin-msg edwin show';

                    // Extract explanation data (backend returns data.data)
                    const explanationData = data.data || data;
                    console.log('🔍 DEBUG: Explanation data:', explanationData);

                    const summary = explanationData.summary || 'N/A';
                    const keyPoints = Array.isArray(explanationData.keyPoints)
                        ? explanationData.keyPoints.map(p => `• ${p}`).join('<br>')
                        : explanationData.keyPoints || 'N/A';
                    const commonMistakes = Array.isArray(explanationData.commonMistakes)
                        ? explanationData.commonMistakes.map(m => `• ${m}`).join('<br>')
                        : explanationData.commonMistakes || 'N/A';

                    console.log('🔍 DEBUG: Formatted summary:', summary);
                    console.log('🔍 DEBUG: Formatted keyPoints:', keyPoints);
                    console.log('🔍 DEBUG: Formatted commonMistakes:', commonMistakes);

                    explanationMsg.innerHTML = `
                        <div class="message-avatar edwin-avatar">💡</div>
                        <div class="message-content">
                            <div class="message-bubble edwin-bubble">
                                <strong>Explanation of selected text:</strong><br><br>
                                <strong>Summary:</strong><br>${summary}<br><br>
                                <strong>Key Points:</strong><br>${keyPoints}<br><br>
                                <strong>Common Mistakes:</strong><br>${commonMistakes}
                            </div>
                        </div>
                    `;
                    chat.appendChild(explanationMsg);
                    chat.scrollTop = chat.scrollHeight;
                    console.log('✅ DEBUG: Explanation message added to chat successfully');
                } else {
                    console.log('❌ DEBUG: Response not ok or data.success is false');
                    throw new Error(data.message || 'Failed to explain selection');
                }
            } catch (error) {
                console.log('❌ DEBUG: Error caught:', error);
                console.log('❌ DEBUG: Error message:', error.message);
                console.log('❌ DEBUG: Error stack:', error.stack);

                loadingMsg.classList.add('fade-out');
                setTimeout(() => chat.removeChild(loadingMsg), 300);

                const errorMsg = document.createElement('div');
                errorMsg.className = 'edwin-msg edwin show';
                errorMsg.innerHTML = `
                    <div class="message-avatar edwin-avatar">❌</div>
                    <div class="message-content">
                        <div class="message-bubble edwin-bubble">
                            Sorry, I couldn't explain that selection. ${error.message}
                        </div>
                    </div>
                `;
                chat.appendChild(errorMsg);
                chat.scrollTop = chat.scrollHeight;
                console.log('✅ DEBUG: Error message added to chat');
            }
        }

        function handleTextSelection() {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            // Check if highlight-to-explain is enabled
            const highlightEnabled = localStorage.getItem('edwin_highlight_enabled');
            if (highlightEnabled === 'false') {
                if (highlightTooltip) highlightTooltip.style.display = 'none';
                return;
            }

            if (selectedText.length >= 25) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (!highlightTooltip) createHighlightTooltip();

                highlightTooltip.style.display = 'block';
                highlightTooltip.style.left = `${rect.left + (rect.width / 2) - 70}px`;
                highlightTooltip.style.top = `${rect.top + window.scrollY - 40}px`;
            } else {
                if (highlightTooltip) highlightTooltip.style.display = 'none';
            }
        }

        // Initialize highlight-to-explain
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('selectionchange', () => {
            setTimeout(handleTextSelection, 10);
        });

        // Hide tooltip when clicking elsewhere
        document.addEventListener('mousedown', (e) => {
            if (highlightTooltip && e.target !== highlightTooltip) {
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection.toString().trim()) {
                        highlightTooltip.style.display = 'none';
                    }
                }, 100);
            }
        });

        // DELIVERABLE C & D: EXAM MODE & MASTERY FUNCTIONS
        async function generateExam(numQuestions, difficulty, timed) {
            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.id = 'exam-loading';
            loadingMsg.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 40px;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 10001;
                text-align: center;
                font-size: 18px;
            `;
            loadingMsg.innerHTML = `
                <div style="margin-bottom: 15px;">🔥 Generating ${numQuestions} exam questions...</div>
                <div style="font-size: 14px; opacity: 0.9;">This may take up to 1 minute</div>
            `;
            document.body.appendChild(loadingMsg);

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/generateExam`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userID: USER_ID,
                        courseID: COURSE_ID,
                        topic: 'all',
                        numQuestions: numQuestions,
                        difficulty: difficulty
                    }),
                    signal: AbortSignal.timeout(60000) // 1 minute for exam generation
                });

                const data = await response.json();

                // Remove loading message
                if (loadingMsg.parentNode) {
                    loadingMsg.parentNode.removeChild(loadingMsg);
                }

                if (response.ok && data.success) {
                    startExam(data.examID, data.questions, timed);
                } else {
                    alert('Failed to generate exam: ' + (data.message || 'Unknown error'));
                }
            } catch (error) {
                // Remove loading message on error
                if (loadingMsg.parentNode) {
                    loadingMsg.parentNode.removeChild(loadingMsg);
                }
                alert('Failed to generate exam: ' + error.message);
            }
        }

        function startExam(examID, questions, timed) {
            window.examWrongAnswers = [];
            window.examQuestions = questions;
            window.examID = examID;

            window.startQuiz(0, `Exam Mode (${questions.length} questions)`, questions);

            if (timed) {
                let timeRemaining = 25 * 60;
                const timerDiv = document.createElement('div');
                timerDiv.id = 'exam-timer';
                timerDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 25px;
                    background: linear-gradient(135deg, #f44336, #b71c1c);
                    color: white;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: 700;
                    z-index: 99999;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                document.body.appendChild(timerDiv);

                const timerInterval = setInterval(() => {
                    timeRemaining--;
                    const minutes = Math.floor(timeRemaining / 60);
                    const seconds = timeRemaining % 60;
                    timerDiv.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;

                    if (timeRemaining <= 0) {
                        clearInterval(timerInterval);
                        timerDiv.remove();
                        alert('Time\'s up! Exam ended.');
                    }
                }, 1000);

                window.examTimerInterval = timerInterval;
                window.examTimerDiv = timerDiv;
            }
        }

        async function loadMasteryDashboard() {
            try {
                const response = await fetch(
                    `${BACKEND_BASE_URL}/api/mastery?userID=${USER_ID}&courseID=${COURSE_ID}`,
                    { signal: AbortSignal.timeout(10000) }
                );

                const data = await response.json();

                if (response.ok && data.success) {
                    const statsDiv = document.getElementById('overall-stats');
                    statsDiv.innerHTML = `
                        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                            <div class="stat-card">
                                <div class="stat-value">${data.streakDays}</div>
                                <div class="stat-label">Day Streak</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${data.totalAttempts}</div>
                                <div class="stat-label">Total Attempts</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${data.lastActive.split(' ')[0] || 'Never'}</div>
                                <div class="stat-label">Last Active</div>
                            </div>
                        </div>
                    `;

                    const topicsDiv = document.getElementById('topic-cards');
                    topicsDiv.innerHTML = data.topics.map(topic => `
                        <div class="topic-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div class="topic-name">${topic.topic}</div>
                                <div class="topic-accuracy ${getAccuracyClass(topic.accuracy)}">
                                    ${Math.round(topic.accuracy * 100)}%
                                </div>
                            </div>
                            <div class="topic-attempts">${topic.attempts} attempts | ${topic.correct}/${topic.total} correct</div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${topic.accuracy * 100}%"></div>
                            </div>
                        </div>
                    `).join('');

                    const weakestDiv = document.getElementById('weakest-topics');
                    weakestDiv.innerHTML = data.weakestTopics.map(topic => `
                        <div class="weak-topic-card">
                            <div>
                                <div class="topic-name">${topic.topic}</div>
                                <div class="topic-accuracy low">${Math.round(topic.accuracy * 100)}% accuracy</div>
                            </div>
                            <button class="practice-btn" data-topic="${topic.topic}">Practice</button>
                        </div>
                    `).join('');

                    document.querySelectorAll('.practice-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const topic = btn.getAttribute('data-topic');
                            const quizData = await generateQuizFromBackend(topic, 'intermediate', 5);
                            if (quizData) {
                                document.getElementById('edwin-progress-section').style.display = 'none';
                                document.getElementById('edwin-quizzes-section').style.display = 'block';
                                startQuiz(0, topic, quizData.questions);
                            }
                        });
                    });
                }
            } catch (error) {
                console.error('Failed to load mastery dashboard:', error);
            }
        }

        function getAccuracyClass(accuracy) {
            if (accuracy >= 0.8) return 'high';
            if (accuracy >= 0.6) return 'medium';
            return 'low';
        }

        // Check backend health on page load
        setTimeout(() => {
            checkAndShowOfflineBanner();
            // Perform auto-sync after checking backend health
            setTimeout(() => performAutoSync(), 2000);
        }, 1000);

        // ---------- INIT ----------
        const checkSidebar = setInterval(() => {
            const nav = document.querySelector('#section-tabs');
            if (nav && !document.querySelector('#edwin-btn')) {
                clearInterval(checkSidebar);

                // ---------- BUTTON ----------
                const li = document.createElement('li');
                li.className = 'section';
                const a = document.createElement('a');
                a.id = 'edwin-btn';
                a.href = '#';
                a.innerHTML = '<span>Edwin AI</span>';
                a.setAttribute('role', 'button');
                a.setAttribute('aria-label', 'Open Edwin AI Assistant');

                // Enhanced button styling
                Object.assign(a.style, {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'edwinButtonGlow 4s ease infinite',
                    borderRadius: '16px',
                    display: 'block',
                    padding: '18px 16px',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
                    fontWeight: '600',
                    fontSize: '17px',
                    letterSpacing: '0.5px',
                    color: 'white',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)'
                });

                a.onmouseover = () => {
                    a.style.transform = 'translateY(-2px) scale(1.02)';
                    a.style.boxShadow = '0 12px 48px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                    a.style.filter = 'brightness(1.1)';
                };

                a.onmouseout = () => {
                    a.style.transform = 'none';
                    a.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                    a.style.filter = 'none';
                };

                a.onmousedown = () => {
                    a.style.transform = 'translateY(0) scale(0.98)';
                };

                // Add click handler directly to button
                a.onclick = (e) => {
                    e.preventDefault();
                    console.log('Edwin AI: Button clicked!');

                    // Check if course ID is detected
                    if (!COURSE_ID) {
                        alert('Please navigate to a Canvas course page to use Edwin AI');
                        return;
                    }

                    const panel = document.getElementById('edwin-panel');
                    if (panel) {
                        panel.classList.add('open');

                        // OPTIMIZATION: Preload materials list immediately when panel opens
                        if (window.loadMaterialsList && !window.materialsListCache) {
                            window.loadMaterialsList();
                        }

                        // Auto-focus input for better UX
                        setTimeout(() => {
                            document.getElementById('edwin-input').focus();
                        }, 500);
                    } else {
                        console.log('Edwin AI: Panel not found, need to initialize');
                    }
                };

                li.appendChild(a);
                nav.appendChild(li);

                // Initialize panel
                initializePanel();
            }
        }, 500);

        function initializePanel() {
            // ---------- PANEL (ENTIRE HTML) ----------
            const panel = document.createElement('div');
            panel.id = 'edwin-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Edwin AI Assistant');
            panel.innerHTML = `
                <div class="edwin-header">
                    <span>Edwin AI</span>
                    <div class="edwin-header-controls">
                        <button id="edwin-settings" aria-label="Settings">⚙</button>
                        <button id="edwin-clear" aria-label="Clear chat">🗑</button>
                        <button id="edwin-close" aria-label="Close panel">✕</button>
                    </div>
                </div>

                <div class="edwin-section" id="edwin-main-section">
                    <div class="edwin-body">
                        <div id="edwin-greeting" class="edwin-greeting-card">
                            <div class="greeting-avatar">🤖</div>
                            <h1>Hello, I am here to assist you</h1>

                            <p id="edwin-subtext">I have access to every lecture, assignment, and presentation.</p>
                        </div>

                        <div id="edwin-chat"></div>
                    </div>

                    <div class="edwin-footer">
                        <div class="input-wrapper">
                            <input type="text" id="edwin-input" placeholder="Ask Edwin anything..." aria-label="Message input">
                            <div class="input-glow"></div>
                        </div>
                        <button id="edwin-send" aria-label="Send message">
                            <span>Send</span>
                            <div class="send-glow"></div>
                        </button>
                    </div>
                </div>

                <!-- QUIZZES SECTION -->
                <div class="edwin-section" id="edwin-quizzes-section">
                    <div class="edwin-quizzes-header">
                        <span>Quizzes</span>
                        <div>
                            <button id="edwin-quizzes-back" aria-label="Back to main">← Back</button>
                        </div>
                    </div>

                    <div class="edwin-quizzes-body">
                        <div class="edwin-quizzes-title-wrapper">
                            <h2>${COURSE_NAME} Quizzes</h2>
                            <div id="edwin-progress-bar" class="enhanced-progress"></div>
                            <img id="edwin-fire-gif" src="https://i.imgur.com/K2xOtlf.gif" alt="Achievement fire effect" class="fire-effect">
                        </div>
                        <p class="section-description">View and practice course quizzes below.</p>
                        <div id="edwin-quizzes-list"></div>
                    </div>

                    <!-- QUIZ PLAY MODE -->
                    <div id="edwin-quiz-play-section" style="display:none;">
                        <div class="edwin-quizzes-header">
                            <span id="edwin-quiz-title">Quiz</span>
                            <div>
                                <button id="edwin-quiz-exit" class="quiz-return-btn">← Back to Quizzes</button>
                            </div>
                        </div>
                        <div class="edwin-quizzes-body" id="edwin-quiz-body"></div>
                    </div>
                </div>


                <!-- Enhanced Settings Modal -->
                <div id="edwin-settings-modal" class="settings-modal">
                    <div class="settings-content">
                        <h2>Settings</h2>
                        <div class="settings-group">
                            <h3 class="settings-section-title">Course Context</h3>
                            <p class="settings-description">Add course materials to Edwin's knowledge base</p>

                            <!-- Auto-Sync Toggle -->
                            <label class="setting-item">
                                <input type="checkbox" id="auto-sync-enabled" checked>
                                <span class="checkmark"></span>
                                Enable Auto-Sync
                            </label>
                            <p class="settings-hint" style="margin-top: -10px; margin-left: 36px;">Automatically sync supported pages (syllabus, assignments, modules, announcements)</p>
                            <div id="auto-sync-status" class="sync-status" style="margin-left: 36px; font-size: 12px; color: rgba(255,255,255,0.6);"></div>

                            <!-- Highlight-to-Explain Toggle -->
                            <label class="setting-item" style="margin-top: 15px;">
                                <input type="checkbox" id="highlight-explain-enabled" checked>
                                <span class="checkmark"></span>
                                Enable Highlight-to-Explain
                            </label>
                            <p class="settings-hint" style="margin-top: -10px; margin-left: 36px;">Show "💡 Explain selection" button when you highlight text (25+ characters)</p>

                            <div class="settings-divider"></div>

                            <!-- Quick Sync: Scrape Current Page -->
                            <div class="setting-item" style="flex-direction: column; align-items: stretch; margin-bottom: 15px;">
                                <button id="sync-current-page-btn" class="sync-button sync-page-btn">📄 Sync This Page</button>
                                <p class="settings-hint">Extracts visible text from this Canvas page (syllabus, modules, assignments, etc.)</p>
                                <div id="page-sync-status" class="sync-status"></div>
                            </div>

                            <div class="settings-divider"></div>

                            <!-- Upload Lecture PDFs -->
                            <div class="setting-item" style="flex-direction: column; align-items: stretch; margin-bottom: 15px;">
                                <label style="margin-bottom: 10px; font-weight: 600; color: rgba(255,255,255,0.9);">Upload Lecture PDFs:</label>
                                <input type="file" id="pdf-upload-input" accept=".pdf" style="
                                    padding: 10px;
                                    background: rgba(255,255,255,0.05);
                                    border: 1px dashed rgba(102, 126, 234, 0.5);
                                    border-radius: 8px;
                                    color: rgba(255,255,255,0.8);
                                    cursor: pointer;
                                    margin-bottom: 10px;
                                ">
                                <button id="upload-pdf-btn" class="sync-button" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">📤 Upload PDF</button>
                                <p class="settings-hint">Upload lecture slides, notes, or study materials (PDF format)</p>
                                <div id="pdf-upload-status" class="sync-status"></div>
                            </div>

                            <div class="settings-divider"></div>

                            <!-- Manage Materials & Generate Quizzes -->
                            <div class="setting-item" style="flex-direction: column; align-items: stretch; margin-bottom: 15px;">
                                <h3 style="margin: 0 0 10px 0; font-weight: 600; color: rgba(255,255,255,0.9);">📚 Manage Materials</h3>
                                <p class="settings-hint" style="margin-bottom: 15px;">Generate quizzes from uploaded PDF materials</p>
                                <div id="materials-list" style="max-height: 300px; overflow-y: auto;">
                                    <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">
                                        Loading materials...
                                    </div>
                                </div>
                                <button id="delete-all-materials-btn" class="sync-button" style="background: linear-gradient(135deg, rgba(244, 67, 54, 0.8) 0%, rgba(211, 47, 47, 0.8) 100%); margin-top: 15px;">🗑️ Delete All Materials</button>
                                <p class="settings-hint">Remove all uploaded PDFs and their associated quizzes</p>
                            </div>

                            <div class="settings-divider"></div>

                            <!-- Main Chat -->
                            <div class="setting-item" style="flex-direction: column; align-items: stretch; margin-bottom: 15px;">
                                <button id="main-chat-btn" class="sync-button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">💬 Main Chat</button>
                                <p class="settings-hint">Return to main chat interface</p>
                            </div>

                            <div class="settings-divider"></div>

                            <!-- Full Sync: Canvas API (Future) -->
                            <div class="setting-item" style="flex-direction: column; align-items: stretch;">
                                <label>Canvas API Token (Optional):</label>
                                <input type="password" id="canvas-token-input" placeholder="Enter Canvas API token" class="setting-input">
                                <button id="sync-materials-btn" class="sync-button" disabled>🔒 Sync All Course Materials (Coming Soon)</button>
                                <p class="settings-hint">Full Canvas API sync - not yet available</p>
                                <div id="sync-status" class="sync-status"></div>
                            </div>
                        </div>

                        <button id="close-settings" class="settings-close">Close</button>
                    </div>
                </div>

                <!-- DELIVERABLE C: EXAM MODE MODAL -->
                <div id="edwin-exam-modal" class="settings-modal">
                    <div class="settings-content">
                        <h2>🔥 Exam Mode Configuration</h2>
                        <div class="settings-group">
                            <div class="setting-item">
                                <label>Number of Questions:</label>
                                <input type="number" id="exam-num-questions" min="20" max="30" value="25" class="setting-input" style="width: 100px;">
                            </div>
                            <div class="setting-item">
                                <label>Difficulty:</label>
                                <select id="exam-difficulty" class="setting-select">
                                    <option value="mixed">Mixed</option>
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>
                            <label class="setting-item">
                                <input type="checkbox" id="exam-timed">
                                <span class="checkmark"></span>
                                Enable Timer (25 min recommended)
                            </label>
                        </div>
                        <button id="start-exam-btn" class="settings-close" style="margin-top: 15px;">Start Exam</button>
                        <button id="cancel-exam-btn" class="settings-close" style="background: rgba(255,255,255,0.1); margin-top: 10px;">Cancel</button>
                    </div>
                </div>

                <!-- DELIVERABLE D: PROGRESS/MASTERY SECTION -->
                <div class="edwin-section" id="edwin-progress-section" style="display:none;">
                    <div class="edwin-header">
                        <span>📊 Your Progress</span>
                        <button id="edwin-progress-back" aria-label="Back to main">← Back</button>
                    </div>
                    <div class="edwin-body" style="padding: 20px;">
                        <div id="overall-stats" style="margin-bottom: 30px;"></div>
                        <h3 style="color: rgba(255,255,255,0.9); margin-bottom: 15px;">Topic Mastery</h3>
                        <div id="topic-cards" style="display: flex; flex-direction: column; gap: 15px;"></div>
                        <h3 style="color: rgba(255,255,255,0.9); margin-top: 30px; margin-bottom: 15px;">Weakest Topics</h3>
                        <div id="weakest-topics" style="display: flex; flex-direction: column; gap: 10px;"></div>
                    </div>
                </div>

                <!-- QUIZZES TAB -->
                <div id="edwin-quizzes-tab" role="button" aria-pressed="false" tabindex="0" class="quizzes-tab">
                    <span>Quizzes</span>
                    <div class="tab-glow"></div>
                </div>

                <!-- PROGRESS TAB -->
                <div id="edwin-progress-tab" role="button" aria-pressed="false" tabindex="0" class="quizzes-tab" style="top: 75%;">
                    <span>Progress</span>
                    <div class="tab-glow"></div>
                </div>
            `;

            document.body.appendChild(panel);

            // Prevent scroll propagation from chat to Canvas page
            const chatContainer = document.getElementById('edwin-chat');
            const quizzesBody = document.querySelector('.edwin-quizzes-body');

            function preventScrollPropagation(element) {
                if (!element) return;

                element.addEventListener('wheel', (e) => {
                    const scrollTop = element.scrollTop;
                    const scrollHeight = element.scrollHeight;
                    const height = element.clientHeight;
                    const delta = e.deltaY;
                    const up = delta < 0;

                    // Prevent scroll chaining when at boundaries
                    if (!up && -delta > scrollHeight - height - scrollTop) {
                        // Scrolling down, at bottom
                        element.scrollTop = scrollHeight;
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (up && delta > scrollTop) {
                        // Scrolling up, at top
                        element.scrollTop = 0;
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }, { passive: false });
            }

            // Apply scroll prevention to all scrollable containers
            preventScrollPropagation(chatContainer);
            // DON'T apply to bodyContainer - it has overflow:hidden and shouldn't scroll
            preventScrollPropagation(quizzesBody);

            // Also prevent touchmove propagation on mobile
            [chatContainer, quizzesBody].forEach(element => {
                if (element) {
                    element.addEventListener('touchmove', (e) => {
                        e.stopPropagation();
                    }, { passive: true });
                }
            });

            // Initialize functionality
            initializeQuizzes();
                document.getElementById('edwin-quiz-exit').addEventListener('click', () => {
                document.getElementById('edwin-quiz-play-section').style.display = 'none';
                document.querySelector('.edwin-quizzes-body').style.display = 'flex';
                // Re-render quiz list to reset button states
                renderQuizzesList();
            });

            initializeInteractions();
            initializeStyles();

            // Create new conversation when panel opens
            const edwinBtn = document.getElementById('edwin-btn');
            const originalOnClick = edwinBtn.onclick;
            edwinBtn.onclick = async (e) => {
                originalOnClick(e);

                // Create new conversation if panel was opened
                if (COURSE_ID) {
                    await createNewConversation();
                }
            };
        }

        async function generateQuizFromBackend(topic, difficulty, numQuestions = 8, materialId = null) {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/generateQuiz`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        courseID: COURSE_ID,
                        topic: topic,
                        difficulty: difficulty,
                        numQuestions: numQuestions,
                        materialId: materialId  // Pass material ID to generate quiz from specific material
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    return data.quiz;
                } else {
                    console.error('Failed to generate quiz:', data.message);
                    return null;
                }
            } catch (error) {
                console.error('Network error generating quiz:', error);
                return null;
            }
        }

        async function syncCanvasMaterials(canvasToken) {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/syncCanvasMaterials`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        courseID: COURSE_ID,
                        canvasToken: canvasToken
                    })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    return {
                        success: true,
                        message: data.message,
                        stats: data.stats
                    };
                } else {
                    return {
                        success: false,
                        message: data.message || 'Failed to sync materials'
                    };
                }
            } catch (error) {
                console.error('Network error syncing materials:', error);
                return {
                    success: false,
                    message: 'Network error during sync'
                };
            }
        }

        function initializeQuizzes() {
            // Load quiz topics from localStorage (generated from materials)
            let quizTopics = JSON.parse(localStorage.getItem('edwin_quiz_topics') || '[]');

            // If no quizzes, show empty state
            if (quizTopics.length === 0) {
                quizTopics = [];
            }

            // Store quiz topics for dynamic generation
            window.edwinQuizTopics = quizTopics;

            // Enhanced quiz rendering
            function renderQuizzesList() {
                // ALWAYS read fresh data from localStorage
                quizTopics = JSON.parse(localStorage.getItem('edwin_quiz_topics') || '[]');
                window.edwinQuizTopics = quizTopics;

                const list = document.getElementById('edwin-quizzes-list');
                list.innerHTML = '';

                // DELIVERABLE C: Add Exam Mode as first item
                const examModeItem = document.createElement('div');
                examModeItem.className = 'edwin-quiz-item';
                examModeItem.style.background = 'linear-gradient(135deg, rgba(255, 107, 53, 0.2) 0%, rgba(247, 147, 30, 0.2) 100%)';
                examModeItem.style.border = '2px solid rgba(255, 107, 53, 0.4)';
                examModeItem.innerHTML = `
                    <div class="quiz-card-header">
                        <div class="quiz-title">🔥 Exam Mode</div>
                        <div class="quiz-difficulty advanced">COMPREHENSIVE</div>
                    </div>
                    <div class="quiz-desc">Full practice exam with 20-30 questions</div>
                    <div class="quiz-card-footer">
                        <button class="quiz-action" id="start-exam-mode">
                            Start Exam Mode
                            <div class="button-glow"></div>
                        </button>
                    </div>
                `;
                list.appendChild(examModeItem);

                // Add click handler for exam mode
                document.getElementById('start-exam-mode').addEventListener('click', () => {
                    document.getElementById('edwin-exam-modal').classList.add('show');
                });

                // Show message if no quizzes generated yet
                if (quizTopics.length === 0) {
                    const emptyMsg = document.createElement('div');
                    emptyMsg.style.cssText = `
                        text-align: center;
                        padding: 40px 20px;
                        color: rgba(255,255,255,0.6);
                    `;
                    emptyMsg.innerHTML = `
                        <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Quizzes Yet</div>
                        <div style="font-size: 14px; margin-bottom: 16px;">Upload PDFs and generate quizzes from Settings</div>
                        <button onclick="document.getElementById('edwin-settings').click();" style="
                            padding: 10px 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                        ">⚙️ Open Settings</button>
                    `;
                    list.appendChild(emptyMsg);
                    return;
                }

                quizTopics.forEach((q, index) => {
                    const completed = localStorage.getItem(`edwin_quiz_${q.id}`) === 'true';
                    const item = document.createElement('div');
                    item.className = 'edwin-quiz-item';
                    item.innerHTML = `
                        <div class="quiz-card-header">
                            <div class="quiz-title">${q.topic}</div>
                            <div class="quiz-difficulty ${q.difficulty.toLowerCase()}">${q.difficulty}</div>
                        </div>
                        <div class="quiz-desc">AI-generated quiz with ${q.numQuestions} questions</div>
                        <div class="quiz-card-footer">
                            <button class="quiz-action ${completed ? 'completed' : ''}" data-quiz-id="${q.id}">
                                ${completed ? '✓ Retake Quiz' : 'Generate & Take Quiz'}
                                <div class="button-glow"></div>
                            </button>
                            ${completed ? '<div class="completion-badge">Completed!</div>' : ''}
                        </div>
                    `;

                    // Add stagger animation
                    item.style.animationDelay = `${index * 0.1}s`;

                    const actionBtn = item.querySelector('.quiz-action');
                    actionBtn.addEventListener('click', async () => {
                        // Show loading state
                        actionBtn.disabled = true;
                        actionBtn.textContent = 'Generating Quiz...';

                        // Generate quiz from backend - pass materialId so quiz is from specific material
                        const quizData = await generateQuizFromBackend(q.topic, q.difficulty, q.numQuestions, q.materialId);

                        if (quizData) {
                            startQuiz(q.id, quizData.title, quizData.questions);
                        } else {
                            actionBtn.disabled = false;
                            actionBtn.textContent = completed ? '✓ Retake Quiz' : 'Generate & Take Quiz';
                            alert('Failed to generate quiz. Please try again.');
                        }
                    });

                    list.appendChild(item);
                });
            }

    function startQuiz(quizId, title, questions) {
        const quizPlay = document.getElementById('edwin-quiz-play-section');
        const quizBody = document.getElementById('edwin-quiz-body');
        const quizTitle = document.getElementById('edwin-quiz-title');

        // Show quiz play section
        quizPlay.style.display = 'block';
        quizTitle.textContent = title;
        quizBody.innerHTML = '';
        let currentQuestionIndex = 0;
        const currentQuizTitle = title;
        const userAnswers = {}; // Track user answers

        // Function to render current question
        function renderQuestion() {
            if (currentQuestionIndex >= questions.length) {
                // Show completion screen
                const allAnswered = Object.keys(userAnswers).length === questions.length;
                if (allAnswered) {
                    localStorage.setItem(`edwin_quiz_${quizId}`, 'true');
                    fetchAndUpdateProgress();
                }

                quizBody.innerHTML = `
                    <div class="quiz-completed">
                        <h2>Quiz Completed! 🎉</h2>
                        <p>You answered ${Object.keys(userAnswers).length} out of ${questions.length} questions</p>
                        <button id="review-quiz-btn" class="quiz-action">Review Answers</button>
                        <button id="back-to-quizzes-btn" class="quiz-action" style="margin-top: 10px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">← Back to Quizzes</button>
                    </div>
                `;

                document.getElementById('review-quiz-btn').addEventListener('click', () => {
                    currentQuestionIndex = 0;
                    renderQuestion();
                });

                document.getElementById('back-to-quizzes-btn').addEventListener('click', () => {
                    document.getElementById('edwin-quiz-play-section').style.display = 'none';
                    document.querySelector('.edwin-quizzes-body').style.display = 'flex';
                    // Re-render quiz list to reset button states
                    renderQuizzesList();
                });
                return;
            }

            const q = questions[currentQuestionIndex];
            const userAnswer = userAnswers[currentQuestionIndex];
            const isAnswered = userAnswer !== undefined;

            quizBody.innerHTML = `
                <div class="quiz-question">
                    <div class="quiz-q-text">${currentQuestionIndex + 1} / ${questions.length}. ${q.question}</div>
                    <div class="quiz-options">
                        ${q.options.map((opt, i) => `
                            <button class="quiz-option ${isAnswered && i === userAnswer ? 'selected' : ''}"
                                    data-option-index="${i}"
                                    data-correct="${i === q.correct}"
                                    data-explanation="${q.explanation}"
                                    ${isAnswered ? 'disabled' : ''}>
                                ${opt}
                            </button>
                        `).join('')}
                    </div>
                    ${isAnswered ? `
                        <div class="quiz-explanation">
                            ${userAnswer === q.correct ? '✓ Correct!' : '✗ Incorrect.'}
                            ${q.explanation}
                        </div>
                    ` : ''}
                </div>
                <div class="quiz-navigation">
                    <button id="prev-question-btn" class="nav-btn" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                        ← Previous
                    </button>
                    <div class="question-progress">
                        Question ${currentQuestionIndex + 1} of ${questions.length}
                    </div>
                    <button id="next-question-btn" class="nav-btn">
                        ${currentQuestionIndex === questions.length - 1 ? 'Finish Quiz ✓' : 'Next →'}
                    </button>
                </div>
            `;

            // Add option click handlers
            if (!isAnswered) {
                quizBody.querySelectorAll('.quiz-option').forEach((btn, btnIndex) => {
                    btn.addEventListener('click', () => {
                        const optionIndex = parseInt(btn.dataset.optionIndex);
                        const isCorrect = btn.dataset.correct === 'true';

                        // Store user's answer
                        userAnswers[currentQuestionIndex] = optionIndex;

                        // Log to backend
                        fetch(`${BACKEND_BASE_URL}/api/quizAttempt`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userID: USER_ID,
                                courseID: COURSE_ID,
                                question: q.question,
                                quizTitle: currentQuizTitle,
                                selectedOption: optionIndex,
                                correctOption: q.correct,
                                isCorrect: isCorrect
                            })
                        }).catch(error => console.error('Failed to log quiz attempt:', error));

                        // Re-render to show explanation
                        renderQuestion();
                    });
                });
            } else {
                // Style already-answered options
                quizBody.querySelectorAll('.quiz-option').forEach((btn, i) => {
                    if (i === userAnswer) {
                        btn.style.background = userAnswer === q.correct
                            ? 'linear-gradient(135deg, #4caf50, #2e7d32)'
                            : 'linear-gradient(135deg, #f44336, #b71c1c)';
                    }
                    btn.disabled = true;
                    btn.style.opacity = '0.8';
                });
            }

            // Navigation button handlers
            const prevBtn = document.getElementById('prev-question-btn');
            const nextBtn = document.getElementById('next-question-btn');

            prevBtn?.addEventListener('click', () => {
                if (currentQuestionIndex > 0) {
                    currentQuestionIndex--;
                    renderQuestion();
                }
            });

            nextBtn?.addEventListener('click', () => {
                if (currentQuestionIndex < questions.length - 1) {
                    currentQuestionIndex++;
                    renderQuestion();
                } else if (currentQuestionIndex === questions.length - 1) {
                    currentQuestionIndex++;
                    renderQuestion(); // Show completion screen
                }
            });
        }

        // Start with the first question
        renderQuestion();

        // Hide quiz list section while playing
        document.querySelector('.edwin-quizzes-body').style.display = 'none';
    }

            // Make functions globally accessible
            window.startQuiz = startQuiz;
            window.renderQuizzesList = renderQuizzesList;

            // Initialize quiz functionality
            renderQuizzesList();
            fetchAndUpdateProgress(); // Fetch real progress from backend
        }

        // Fetch real progress data from backend
        async function fetchAndUpdateProgress() {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/progress?userID=${USER_ID}&courseID=${COURSE_ID}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    const progress = data.progress;

                    // Update streak
                    // Update quiz completion (map 0-X quizzes to 0-5 segments)
                    const totalQuizzes = 10; // Assume 10 quizzes per course for now
                    quizProgressStage = Math.min(5, Math.floor((progress.quizzesCompleted / totalQuizzes) * 5));

                    // Update the bars
                    updateProgressBar();

                    console.log('Progress updated:', progress);
                }
            } catch (error) {
                console.error('Failed to fetch progress:', error);
                // Keep default values if fetch fails
                updateProgressBar();
                updateStreaksBar();
            }
        }

        function updateProgressBar() {
            const progressBar = document.getElementById('edwin-progress-bar');
            const segments = 5;
            const filled = quizProgressStage;

            progressBar.innerHTML = '';

            for (let i = 0; i < segments; i++) {
                const segment = document.createElement('div');
                segment.className = `progress-segment ${i < filled ? 'filled' : ''}`;
                segment.style.animationDelay = `${i * 0.2}s`;
                progressBar.appendChild(segment);
            }

            // Show fire effect if fully completed
            const fireGif = document.getElementById('edwin-fire-gif');
            if (filled === segments) {
                fireGif.style.display = 'block';
                fireGif.style.animation = 'fireGlow 2s ease-in-out infinite alternate';
            }
        }


        function animateNumber(elementId, targetNumber) {
            const element = document.getElementById(elementId);
            let current = 0;
            const increment = targetNumber > 20 ? Math.ceil(targetNumber / 20) : 1;
            const timer = setInterval(() => {
                current += increment;
                if (current >= targetNumber) {
                    current = targetNumber;
                    clearInterval(timer);
                }
                element.textContent = current;
            }, 50);
        }

        function initializeInteractions() {
            // Enhanced message handling with backend integration
            async function getResponse(input) {
                const response = await sendMessageToBackend(input);
                return response; // Return full response object with answer and citations
            }

            async function sendMessage() {
                const inputBox = document.getElementById('edwin-input');
                const text = inputBox.value.trim();
                if (!text) return;

                const greeting = document.getElementById('edwin-greeting');
                if (greeting) {
                    greeting.style.transform = 'translateY(-20px)';
                    greeting.style.opacity = '0';
                    setTimeout(() => greeting.style.display = 'none', 300);
                }

                addMessage('user', text);
                inputBox.value = '';

                const chat = document.getElementById('edwin-chat');
                const thinkingMsg = document.createElement('div');
                thinkingMsg.className = 'edwin-msg edwin thinking';
                thinkingMsg.innerHTML = `
                    <div class="message-avatar thinking-avatar">🤔</div>
                    <div class="message-content">
                        <div class="message-bubble thinking-bubble">
                            <span class="spinner">⟳</span>
                            <span class="thinking-text">Thinking...</span>
                            <div class="thinking-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                `;
                chat.appendChild(thinkingMsg);

                // Animate thinking message
                setTimeout(() => thinkingMsg.classList.add('show'), 50);
                chat.scrollTop = chat.scrollHeight;

                try {
                    // Get AI response from backend (now includes citations)
                    const aiResponse = await getResponse(text);

                    // Remove thinking message with animation
                    thinkingMsg.classList.add('fade-out');
                    setTimeout(() => chat.removeChild(thinkingMsg), 300);

                    // Add AI response with citations, grounded status, and delay for better UX
                    setTimeout(() => addMessage('edwin', aiResponse.answer, aiResponse.citations, aiResponse.grounded), 400);
                } catch (error) {
                    console.error('Error getting response:', error);
                    thinkingMsg.classList.add('fade-out');
                    setTimeout(() => chat.removeChild(thinkingMsg), 300);
                    setTimeout(() => addMessage('edwin', "I'm having trouble processing your request. Please try again."), 400);
                }
            }

            function addMessage(sender, text, citations = null, grounded = null) {
                const chat = document.getElementById('edwin-chat');
                const msg = document.createElement('div');
                const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                msg.className = `edwin-msg ${sender}`;
                msg.innerHTML = `
                    <div class="message-avatar ${sender}-avatar">
                        ${sender === 'user' ? '👤' : '🤖'}
                    </div>
                    <div class="message-content">
                        <div class="message-bubble ${sender}-bubble">
                            <span class="message-text"></span>
                            <div class="message-timestamp">${timestamp}</div>
                        </div>
                    </div>
                `;

                chat.appendChild(msg);

                const textSpan = msg.querySelector('.message-text');
                const messageContent = msg.querySelector('.message-content');
                const messageBubble = msg.querySelector('.message-bubble');

                if (sender === 'edwin') {
                    // Add grounded badge before text (if applicable)
                    if (grounded !== null) {
                        const groundedBadge = document.createElement('div');
                        groundedBadge.className = `grounded-badge ${grounded ? 'grounded' : 'ungrounded'}`;
                        groundedBadge.innerHTML = grounded
                            ? '✅ Grounded'
                            : '⚠️ Ungrounded - Try syncing course materials';
                        messageBubble.insertBefore(groundedBadge, textSpan);
                    }

                    // Typing animation for Edwin
                    let i = 0;
                    const typeInterval = setInterval(() => {
                        textSpan.textContent += text[i];
                        if (++i >= text.length) {
                            clearInterval(typeInterval);

                            // Add citations after typing completes
                            if (citations && citations.length > 0) {
                                const citationsDiv = document.createElement('div');
                                citationsDiv.className = 'message-citations';
                                citationsDiv.innerHTML = `
                                    <div class="citations-header">📚 Sources:</div>
                                    ${citations.map((cite, idx) => `
                                        <div class="citation-item">
                                            <strong>${idx + 1}. ${cite.title}</strong>
                                            ${cite.url ? `<br><a href="${cite.url}" target="_blank" class="citation-link">View source →</a>` : ''}
                                            ${cite.snippet ? `<div class="citation-snippet">${cite.snippet}</div>` : ''}
                                        </div>
                                    `).join('')}
                                `;
                                messageContent.appendChild(citationsDiv);
                            }

                            chat.scrollTop = chat.scrollHeight;
                        }
                    }, 30);

                    // Show message with slide animation
                    setTimeout(() => msg.classList.add('show'), 100);
                } else {
                    // Instant display for user messages
                    textSpan.textContent = text;
                    setTimeout(() => msg.classList.add('show'), 50);
                }

                // Auto-scroll with smooth behavior
                setTimeout(() => {
                    chat.scrollTo({
                        top: chat.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 100);
            }

            // Event listeners
            document.getElementById('edwin-send').addEventListener('click', sendMessage);
            document.getElementById('edwin-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });

            // Enhanced clear functionality
            document.getElementById('edwin-clear').addEventListener('click', async () => {
                const chat = document.getElementById('edwin-chat');
                const messages = chat.querySelectorAll('.edwin-msg');

                // Animate messages out
                messages.forEach((msg, index) => {
                    setTimeout(() => {
                        msg.style.transform = 'translateX(-100%)';
                        msg.style.opacity = '0';
                    }, index * 50);
                });

                setTimeout(() => {
                    chat.innerHTML = '';
                    const greeting = document.getElementById('edwin-greeting');
                    if (greeting) {
                        greeting.style.display = 'block';
                        greeting.style.transform = 'translateY(20px)';
                        greeting.style.opacity = '0';
                        setTimeout(() => {
                            greeting.style.transform = 'none';
                            greeting.style.opacity = '1';
                        }, 100);
                    }
                }, messages.length * 50 + 200);

                // Create new conversation when clearing chat
                await createNewConversation();
            });

            // Close panel with animation
            document.addEventListener('click', (e) => {
                if (e.target.id === 'edwin-close') {
                    const panel = document.getElementById('edwin-panel');
                    panel.style.transform = 'translateY(20px)';
                    panel.style.opacity = '0.8';

                    setTimeout(() => {
                        panel.classList.remove('open', 'quizzes-open', 'quizzes-visible');
                        panel.style.transform = '';
                        panel.style.opacity = '';
                        const quizzesTab = panel.querySelector('#edwin-quizzes-tab');
                        quizzesTab.setAttribute('aria-pressed', 'false');
                    }, 200);
                }
            });

            // Enhanced quizzes tab interaction
            const quizzesTab = document.getElementById('edwin-quizzes-tab');
            quizzesTab.addEventListener('click', () => {
                const panel = document.getElementById('edwin-panel');
                const quizzesSection = document.getElementById('edwin-quizzes-section');
                const mainSection = document.getElementById('edwin-main-section');
                const progressSection = document.getElementById('edwin-progress-section');
                const isOpen = panel.classList.contains('quizzes-open');

                if (!isOpen) {
                    // Show quizzes section, hide others
                    if (quizzesSection) quizzesSection.style.display = 'flex';
                    if (mainSection) mainSection.style.display = 'none';
                    if (progressSection) progressSection.style.display = 'none';

                    panel.classList.add('quizzes-visible');
                    setTimeout(() => panel.classList.add('quizzes-open'), 50);
                    quizzesTab.setAttribute('aria-pressed', 'true');
                } else {
                    panel.classList.remove('quizzes-open');
                    setTimeout(() => {
                        panel.classList.remove('quizzes-visible');
                        // Show main section when closing quizzes
                        if (mainSection) mainSection.style.display = 'flex';
                        if (quizzesSection) quizzesSection.style.display = 'none';
                    }, 450);
                    quizzesTab.setAttribute('aria-pressed', 'false');
                }
            });

            // Back button functionality
            document.getElementById('edwin-quizzes-back').addEventListener('click', () => {
                const panel = document.getElementById('edwin-panel');
                const mainSection = document.getElementById('edwin-main-section');
                const quizzesSection = document.getElementById('edwin-quizzes-section');

                panel.classList.remove('quizzes-open');
                setTimeout(() => {
                    panel.classList.remove('quizzes-visible');
                    // Show main section when going back
                    if (mainSection) mainSection.style.display = 'flex';
                    if (quizzesSection) quizzesSection.style.display = 'none';
                }, 450);
                quizzesTab.setAttribute('aria-pressed', 'false');
                // Re-render quiz list to reset button states when returning
                setTimeout(() => {
                    if (window.renderQuizzesList) window.renderQuizzesList();
                }, 500);
            });

            initializeOtherInteractions();
        }

        // Load and display materials list with Generate Quiz buttons
        async function loadMaterialsList(forceReload = false) {
            const materialsListDiv = document.getElementById('materials-list');

            // Use cached data if available and not forcing reload
            if (window.materialsListCache && !forceReload) {
                renderMaterialsList(window.materialsListCache);
                return;
            }

            // Show loading state
            materialsListDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">Loading materials...</div>';

            try {
                const response = await fetch(`${BACKEND_BASE_URL}/api/getMaterials?courseID=${COURSE_ID}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    // Cache the materials data
                    window.materialsListCache = data.materials;
                    renderMaterialsList(data.materials);
                } else {
                    materialsListDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,69,0,0.8);">Failed to load materials</div>';
                }
            } catch (error) {
                console.error('Error loading materials:', error);
                materialsListDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,69,0,0.8);">Error loading materials</div>';
            }
        }

        // Separate function to render materials list (so we can reuse cached data)
        function renderMaterialsList(materials) {
            const materialsListDiv = document.getElementById('materials-list');

            if (!materials || materials.length === 0) {
                materialsListDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">No materials uploaded yet. Upload a PDF above!</div>';
                return;
            }

            // Display each material with a Generate Quiz button and Delete button
            materialsListDiv.innerHTML = materials.map(material => `
                        <div class="material-item" style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 12px;
                            margin-bottom: 10px;
                            background: rgba(255,255,255,0.05);
                            border: 1px solid rgba(255,255,255,0.1);
                            border-radius: 8px;
                        ">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: rgba(255,255,255,0.9);">${material.title}</div>
                                <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">Uploaded: ${material.uploadedAt}</div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="generate-quiz-btn" data-material-id="${material.id}" data-material-title="${material.title}" style="
                                    padding: 8px 16px;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-weight: 600;
                                    font-size: 13px;
                                    white-space: nowrap;
                                    transition: all 0.2s;
                                ">📝 Generate Quiz</button>
                                <button class="delete-material-btn" data-material-id="${material.id}" data-material-title="${material.title}" style="
                                    padding: 8px 12px;
                                    background: linear-gradient(135deg, rgba(244, 67, 54, 0.8) 0%, rgba(211, 47, 47, 0.8) 100%);
                                    color: white;
                                    border: none;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-weight: 600;
                                    font-size: 13px;
                                    transition: all 0.2s;
                                " title="Delete this material">🗑️</button>
                            </div>
                        </div>
                    `).join('');

                    // Add event listeners to all Generate Quiz buttons
                    document.querySelectorAll('.generate-quiz-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const materialId = btn.getAttribute('data-material-id');
                            const materialTitle = btn.getAttribute('data-material-title');

                            // Disable button and show loading
                            btn.disabled = true;
                            btn.textContent = '⏳ Generating...';

                            try {
                                // Store quiz topic for this material in localStorage
                                const quizTopics = JSON.parse(localStorage.getItem('edwin_quiz_topics') || '[]');

                                // Check if quiz already exists for this material
                                const existingQuiz = quizTopics.find(q => q.materialId === materialId);

                                if (existingQuiz) {
                                    btn.textContent = '✓ Quiz Exists';
                                    btn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
                                    setTimeout(() => {
                                        btn.disabled = false;
                                        btn.textContent = '📝 Regenerate Quiz';
                                        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                                    }, 2000);

                                    // Close settings and open quizzes tab
                                    document.getElementById('edwin-settings-modal').classList.remove('show');
                                    document.getElementById('edwin-quizzes-tab').click();
                                    return;
                                }

                                // Clean up material title to create a meaningful quiz name
                                let cleanedTopic = materialTitle;

                                // Remove generic prefixes like "PDF Full Text", "PDF Page X Image Y"
                                if (materialTitle.includes('PDF Full Text') || materialTitle.match(/PDF Page \d+ Image \d+/)) {
                                    // Strip these generic patterns
                                    cleanedTopic = materialTitle
                                        .replace(/^PDF Full Text/i, '')
                                        .replace(/^PDF Page \d+ Image \d+/i, '')
                                        .trim();

                                    // If nothing left after cleaning, use a generic "Quiz" name
                                    if (!cleanedTopic) {
                                        cleanedTopic = 'Quiz';
                                    }
                                }

                                // Remove .pdf extension if present for cleaner names
                                cleanedTopic = cleanedTopic.replace(/\.pdf$/i, '');

                                // Add new quiz topic - ONE quiz per PDF covering entire content
                                const newQuiz = {
                                    id: Date.now(),
                                    materialId: materialId,
                                    topic: cleanedTopic,
                                    difficulty: 'Mixed',
                                    numQuestions: 15  // More questions to cover entire PDF
                                };

                                quizTopics.push(newQuiz);
                                localStorage.setItem('edwin_quiz_topics', JSON.stringify(quizTopics));

                                // Update quiz topics array
                                window.edwinQuizTopics = quizTopics;

                                // Re-render quizzes list
                                if (window.renderQuizzesList) {
                                    window.renderQuizzesList();
                                }

                                // Success feedback
                                btn.textContent = '✓ Quiz Created!';
                                btn.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';

                                // Show notification
                                showNotification(`Quiz created for "${materialTitle}"`, 'success');

                                // Close settings and open quizzes tab
                                setTimeout(() => {
                                    document.getElementById('edwin-settings-modal').classList.remove('show');
                                    document.getElementById('edwin-quizzes-tab').click();
                                }, 1000);

                            } catch (error) {
                                console.error('Error generating quiz:', error);
                                btn.textContent = '✗ Failed';
                                btn.disabled = false;
                                setTimeout(() => {
                                    btn.textContent = '📝 Generate Quiz';
                                }, 2000);
                            }
                        });
                    });

                    // Add event listeners to all Delete buttons
                    document.querySelectorAll('.delete-material-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const materialId = btn.getAttribute('data-material-id');
                            const materialTitle = btn.getAttribute('data-material-title');

                            // Confirm deletion
                            const confirmed = confirm(`Are you sure you want to delete "${materialTitle}"?\n\nThis will also remove any quizzes generated from this material.`);
                            if (!confirmed) return;

                            // Disable button and show loading
                            btn.disabled = true;
                            btn.textContent = '⏳';

                            try {
                                const response = await fetch(`${BACKEND_BASE_URL}/api/deleteMaterial`, {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ materialId: materialId })
                                });

                                const result = await response.json();

                                if (response.ok && result.success) {
                                    // Remove quizzes associated with this material
                                    const quizTopics = JSON.parse(localStorage.getItem('edwin_quiz_topics') || '[]');
                                    const filteredQuizzes = quizTopics.filter(q => q.materialId !== materialId);
                                    localStorage.setItem('edwin_quiz_topics', JSON.stringify(filteredQuizzes));
                                    window.edwinQuizTopics = filteredQuizzes;

                                    // Re-render quizzes list
                                    if (window.renderQuizzesList) {
                                        window.renderQuizzesList();
                                    }

                                    // Show success notification
                                    showNotification(`Deleted "${materialTitle}"`, 'success');

                                    // Clear cache and reload materials list
                                    window.materialsListCache = null;
                                    loadMaterialsList(true);
                                } else {
                                    alert('Failed to delete material: ' + (result.message || 'Unknown error'));
                                    btn.disabled = false;
                                    btn.textContent = '🗑️';
                                }
                            } catch (error) {
                                console.error('Error deleting material:', error);
                                alert('Error deleting material. Please try again.');
                                btn.disabled = false;
                                btn.textContent = '🗑️';
                            }
                        });
                    });
        }

        // Make loadMaterialsList globally accessible
        window.loadMaterialsList = loadMaterialsList;

        function initializeOtherInteractions() {
            // Enhanced settings functionality
            const settingsModal = document.getElementById('edwin-settings-modal');
            document.getElementById('edwin-settings').addEventListener('click', () => {
                settingsModal.classList.add('show');
                loadMaterialsList(); // Load materials when settings open
            });

            document.getElementById('close-settings').addEventListener('click', () => {
                settingsModal.classList.remove('show');
            });

            // Settings options removed (colorblind, high-contrast, text-size)

            // Sync current page handler (DOM scraping)
            document.getElementById('sync-current-page-btn').addEventListener('click', async () => {
                const statusDiv = document.getElementById('page-sync-status');
                const syncBtn = document.getElementById('sync-current-page-btn');

                if (!COURSE_ID) {
                    statusDiv.textContent = 'Please navigate to a Canvas course page';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                // Show loading state
                syncBtn.disabled = true;
                syncBtn.textContent = '⏳ Extracting page content...';
                statusDiv.textContent = 'Scraping visible page content...';
                statusDiv.className = 'sync-status loading';

                try {
                    // Extract page content from DOM
                    const pageContent = extractCanvasPageContent();

                    if (!pageContent.text || pageContent.text.length < 50) {
                        statusDiv.textContent = '⚠ No significant content found on this page';
                        statusDiv.className = 'sync-status error';
                        syncBtn.disabled = false;
                        syncBtn.textContent = '📄 Sync This Page';
                        return;
                    }

                    // Send to backend
                    const response = await fetch(`${BACKEND_BASE_URL}/api/syncPageContent`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userID: USER_ID,
                            courseID: COURSE_ID,
                            pageTitle: pageContent.title,
                            pageURL: window.location.href,
                            content: pageContent.text
                        })
                    });

                    const result = await response.json();

                    if (response.ok && result.success) {
                        statusDiv.textContent = `✓ Page synced! Added ${Math.floor(pageContent.text.length / 100)} content blocks`;
                        statusDiv.className = 'sync-status success';
                    } else {
                        statusDiv.textContent = `✗ ${result.message || 'Failed to sync page'}`;
                        statusDiv.className = 'sync-status error';
                    }
                } catch (error) {
                    statusDiv.textContent = `✗ Error: ${error.message}`;
                    statusDiv.className = 'sync-status error';
                } finally {
                    syncBtn.disabled = false;
                    syncBtn.textContent = '📄 Sync This Page';
                }
            });

            // Canvas materials sync handler
            document.getElementById('sync-materials-btn').addEventListener('click', async () => {
                const canvasToken = document.getElementById('canvas-token-input').value;
                const statusDiv = document.getElementById('sync-status');
                const syncBtn = document.getElementById('sync-materials-btn');

                if (!canvasToken) {
                    statusDiv.textContent = 'Please enter Canvas API token';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                if (!COURSE_ID) {
                    statusDiv.textContent = 'Please navigate to a Canvas course page';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                // Show loading state
                syncBtn.disabled = true;
                syncBtn.textContent = 'Syncing...';
                statusDiv.textContent = 'Fetching materials from Canvas...';
                statusDiv.className = 'sync-status loading';

                try {
                    const result = await syncCanvasMaterials(canvasToken);

                    if (result.success) {
                        const stats = result.stats;
                        statusDiv.textContent = `✓ ${result.message} (${stats.ingested} new, ${stats.skipped} skipped)`;
                        statusDiv.className = 'sync-status success';

                        // Save token to localStorage for convenience
                        localStorage.setItem('edwin_canvas_token', canvasToken);
                    } else {
                        statusDiv.textContent = `✗ ${result.message}`;
                        statusDiv.className = 'sync-status error';
                    }
                } catch (error) {
                    statusDiv.textContent = `✗ Error: ${error.message}`;
                    statusDiv.className = 'sync-status error';
                } finally {
                    syncBtn.disabled = false;
                    syncBtn.textContent = 'Sync Course Materials';
                }
            });

            // Load saved Canvas token if exists
            const savedToken = localStorage.getItem('edwin_canvas_token');
            if (savedToken) {
                document.getElementById('canvas-token-input').value = savedToken;
            }

            // Auto-sync toggle handler
            const autoSyncCheckbox = document.getElementById('auto-sync-enabled');
            const savedAutoSync = localStorage.getItem('edwin_auto_sync_enabled');
            if (savedAutoSync === 'false') {
                autoSyncCheckbox.checked = false;
            }

            autoSyncCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('edwin_auto_sync_enabled', e.target.checked);
                updateAutoSyncStatus();
            });

            // Update auto-sync status display
            function updateAutoSyncStatus() {
                const statusDiv = document.getElementById('auto-sync-status');
                statusDiv.textContent = getAutoSyncStatus();
            }

            // Initialize settings modal with auto-sync status
            document.getElementById('edwin-settings').addEventListener('click', updateAutoSyncStatus, { once: false });

            // Highlight-to-Explain toggle handler
            const highlightCheckbox = document.getElementById('highlight-explain-enabled');
            const savedHighlight = localStorage.getItem('edwin_highlight_enabled');
            if (savedHighlight === 'false') {
                highlightCheckbox.checked = false;
            }

            highlightCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('edwin_highlight_enabled', e.target.checked);
            });

            // PDF Upload handler
            document.getElementById('upload-pdf-btn').addEventListener('click', async () => {
                const fileInput = document.getElementById('pdf-upload-input');
                const statusDiv = document.getElementById('pdf-upload-status');
                const uploadBtn = document.getElementById('upload-pdf-btn');

                // Check if file is selected
                if (!fileInput.files || fileInput.files.length === 0) {
                    statusDiv.textContent = '⚠️ Please select a PDF file first';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                const file = fileInput.files[0];

                // Validate file type
                if (!file.name.toLowerCase().endsWith('.pdf')) {
                    statusDiv.textContent = '⚠️ Only PDF files are allowed';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                // Validate file size (max 50MB)
                if (file.size > 50 * 1024 * 1024) {
                    statusDiv.textContent = '⚠️ File too large (max 50MB)';
                    statusDiv.className = 'sync-status error';
                    return;
                }

                // Show loading state
                uploadBtn.disabled = true;
                uploadBtn.textContent = '⏳ Uploading...';
                statusDiv.textContent = `Uploading ${file.name}...`;
                statusDiv.className = 'sync-status loading';

                try {
                    // Create FormData
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('courseID', COURSE_ID);
                    formData.append('userID', USER_ID);

                    // Upload to backend
                    const response = await fetch('http://localhost:5000/api/uploadPDF', {
                        method: 'POST',
                        body: formData,
                        signal: AbortSignal.timeout(120000) // 2 minute timeout for large PDFs
                    });

                    const result = await response.json();

                    if (result.success) {
                        statusDiv.textContent = `✓ ${result.message}`;
                        statusDiv.className = 'sync-status success';

                        // Clear file input
                        fileInput.value = '';

                        // Clear materials cache and reload list immediately
                        window.materialsListCache = null;
                        if (window.loadMaterialsList) {
                            window.loadMaterialsList(true); // Force reload with fresh data
                        }

                        // Show success message in chat
                        const chat = document.getElementById('edwin-chat');
                        const successMsg = document.createElement('div');
                        successMsg.className = 'edwin-msg edwin show';
                        successMsg.innerHTML = `
                            <div class="message-avatar edwin-avatar">📚</div>
                            <div class="message-content">
                                <div class="message-bubble edwin-bubble">
                                    <strong>PDF Uploaded Successfully!</strong><br><br>
                                    File: ${file.name}<br>
                                    Status: Processed and added to course materials<br><br>
                                    You can now ask questions about this content!
                                </div>
                            </div>
                        `;
                        chat.appendChild(successMsg);
                        chat.scrollTop = chat.scrollHeight;
                    } else {
                        statusDiv.textContent = `✗ ${result.message}`;
                        statusDiv.className = 'sync-status error';
                    }
                } catch (error) {
                    statusDiv.textContent = `✗ Upload failed: ${error.message}`;
                    statusDiv.className = 'sync-status error';
                } finally {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = '📤 Upload PDF';
                }
            });

            // Main Chat button handler
            document.getElementById('main-chat-btn').addEventListener('click', () => {
                // Close settings modal
                document.getElementById('edwin-settings-modal').classList.remove('show');

                // Switch to main section
                document.getElementById('edwin-main-section').style.display = 'flex';
                document.getElementById('edwin-quizzes-section').style.display = 'none';
                document.getElementById('edwin-progress-section').style.display = 'none';

                // Focus on input
                setTimeout(() => {
                    document.getElementById('edwin-input').focus();
                }, 300);
            });

            // DELIVERABLE C: Exam Mode Event Handlers
            const cancelExamBtn = document.getElementById('cancel-exam-btn');
            const startExamBtn = document.getElementById('start-exam-btn');

            if (cancelExamBtn) {
                cancelExamBtn.addEventListener('click', () => {
                    const examModal = document.getElementById('edwin-exam-modal');
                    if (examModal) {
                        examModal.classList.remove('show');
                    }
                });
            }

            if (startExamBtn) {
                startExamBtn.addEventListener('click', async () => {
                    const numQuestionsInput = document.getElementById('exam-num-questions');
                    const difficultySelect = document.getElementById('exam-difficulty');
                    const timedCheckbox = document.getElementById('exam-timed');

                    const numQuestions = numQuestionsInput ? parseInt(numQuestionsInput.value) : 25;
                    const difficulty = difficultySelect ? difficultySelect.value : 'mixed';
                    const timed = timedCheckbox ? timedCheckbox.checked : false;

                    const examModal = document.getElementById('edwin-exam-modal');
                    if (examModal) {
                        examModal.classList.remove('show');
                    }

                    await generateExam(numQuestions, difficulty, timed);
                });
            }

            // Delete All Materials button handler
            const deleteAllMaterialsBtn = document.getElementById('delete-all-materials-btn');
            if (deleteAllMaterialsBtn) {
                deleteAllMaterialsBtn.addEventListener('click', async () => {
                    const confirmed = confirm('⚠️ WARNING: This will delete ALL uploaded PDFs and their associated quizzes.\n\nThis action cannot be undone. Are you sure?');
                    if (!confirmed) return;

                    // Double confirmation for safety
                    const doubleConfirm = confirm('Are you ABSOLUTELY sure you want to delete all materials? This is your last chance to cancel.');
                    if (!doubleConfirm) return;

                    deleteAllMaterialsBtn.disabled = true;
                    deleteAllMaterialsBtn.textContent = '⏳ Deleting...';

                    try {
                        const response = await fetch(`${BACKEND_BASE_URL}/api/deleteAllMaterials`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ courseID: COURSE_ID })
                        });

                        const result = await response.json();

                        if (response.ok && result.success) {
                            // Clear all quizzes from localStorage
                            localStorage.removeItem('edwin_quiz_topics');
                            window.edwinQuizTopics = [];

                            // Re-render quizzes list (will show empty state)
                            if (window.renderQuizzesList) {
                                window.renderQuizzesList();
                            }

                            // Show success notification
                            showNotification('All materials deleted successfully', 'success');

                            // Clear cache and reload materials list
                            window.materialsListCache = null;
                            loadMaterialsList(true);
                        } else {
                            alert('Failed to delete materials: ' + (result.message || 'Unknown error'));
                        }
                    } catch (error) {
                        console.error('Error deleting all materials:', error);
                        alert('Error deleting materials. Please try again.');
                    } finally {
                        deleteAllMaterialsBtn.disabled = false;
                        deleteAllMaterialsBtn.textContent = '🗑️ Delete All Materials';
                    }
                });
            }

            // DELIVERABLE D: Progress Tab Event Handlers
            const progressTab = document.getElementById('edwin-progress-tab');
            const progressBackBtn = document.getElementById('edwin-progress-back');

            if (progressTab) {
                progressTab.addEventListener('click', () => {
                    const panel = document.getElementById('edwin-panel');
                    const progressSection = document.getElementById('edwin-progress-section');
                    const mainSection = document.getElementById('edwin-main-section');
                    const quizzesSection = document.getElementById('edwin-quizzes-section');

                    // Open panel if not already open
                    if (!panel.classList.contains('open')) {
                        panel.classList.add('open');
                    }

                    if (progressSection) progressSection.style.display = 'block';
                    if (mainSection) mainSection.style.display = 'none';
                    if (quizzesSection) quizzesSection.style.display = 'none';

                    loadMasteryDashboard();
                });
            }

            if (progressBackBtn) {
                progressBackBtn.addEventListener('click', () => {
                    const progressSection = document.getElementById('edwin-progress-section');
                    const mainSection = document.getElementById('edwin-main-section');

                    if (progressSection) progressSection.style.display = 'none';
                    if (mainSection) mainSection.style.display = 'block';
                });
            }
        }

        function initializeStyles() {
            const style = document.createElement('style');
            style.innerHTML = `
                :root {
                    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    --panel-bg: linear-gradient(135deg, rgba(10, 13, 17, 0.95) 0%, rgba(13, 17, 23, 0.95) 100%);
                    --glass-bg: rgba(255, 255, 255, 0.05);
                    --glass-border: rgba(255, 255, 255, 0.1);
                    --text-primary: #ffffff;
                    --text-secondary: rgba(255, 255, 255, 0.8);
                    --text-muted: rgba(255, 255, 255, 0.6);
                    --border-radius: 16px;
                    --border-radius-sm: 12px;
                    --border-radius-lg: 24px;
                    --spacing-xs: 4px;
                    --spacing-sm: 8px;
                    --spacing-md: 16px;
                    --spacing-lg: 24px;
                    --spacing-xl: 32px;
                    --animation-fast: 0.2s;
                    --animation-normal: 0.3s;
                    --animation-slow: 0.5s;
                    --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.1);
                    --shadow-md: 0 8px 32px rgba(0, 0, 0, 0.2);
                    --shadow-lg: 0 16px 64px rgba(0, 0, 0, 0.3);
                    --base-font-size: 16px;
                }

                @keyframes edwinButtonGlow {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }

                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.3); }
                    50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.6); }
                }

                @keyframes fireGlow {
                    0%, 100% { filter: brightness(1) saturate(1); }
                    50% { filter: brightness(1.3) saturate(1.5); }
                }

                @keyframes progressFill {
                    from { width: 0%; }
                    to { width: 100%; }
                }

                @keyframes bounceIn {
                    0% { opacity: 0; transform: scale(0.3); }
                    50% { opacity: 1; transform: scale(1.05); }
                    70% { transform: scale(0.9); }
                    100% { opacity: 1; transform: scale(1); }
                }

                @keyframes thinkingDots {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }

                /* Base Panel Styles */
                #edwin-panel {
                    position: fixed;
                    left: ${panelMarginLeft}px;
                    right: ${panelMarginRight}px;
                    bottom: -100%;
                    height: 100vh;
                    background: var(--panel-bg);
                    backdrop-filter: blur(20px);
                    color: var(--text-primary);
                    display: flex;
                    flex-direction: column;
                    transition: all var(--animation-slow) cubic-bezier(0.4, 0, 0.2, 1);
                    border-radius: 0;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    box-shadow: var(--shadow-lg);
                    opacity: 0;
                    z-index: 9999;
                    overflow: hidden;
                    border: 1px solid var(--glass-border);
                }

                #edwin-panel.open {
                    bottom: 0;
                    opacity: 1;
                    animation: slideInUp var(--animation-slow) cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* Section containers - CRITICAL FOR SCROLL */
                .edwin-section {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                }

                #edwin-main-section {
                    display: flex !important;
                    flex-direction: column;
                    flex: 1;
                    min-height: 0;
                    overflow: hidden;
                }

                /* Header */
                .edwin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md) var(--spacing-lg);
                    font-size: 18px;
                    font-weight: 600;
                    background: var(--glass-bg);
                    backdrop-filter: blur(12px);
                    border-radius: 0;
                    border-bottom: 1px solid var(--glass-border);
                    position: relative;
                    z-index: 5;
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
                    backdrop-filter: blur(8px);
                }

                .edwin-header button:hover {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.1);
                    transform: scale(1.1);
                }

                /* Main Body */
                .edwin-body {
                    padding: var(--spacing-lg);
                    padding-bottom: 120px;
                    flex-grow: 1;
                    overflow: hidden;  /* Changed from overflow-y: auto to prevent body scroll */
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .edwin-body::-webkit-scrollbar {
                    width: 8px;
                }

                .edwin-body::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }

                .edwin-body::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }

                .edwin-body::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }

                /* Enhanced Greeting Card */
                .edwin-greeting-card {
                    text-align: center;
                    padding: var(--spacing-xl);
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--border-radius-lg);
                    backdrop-filter: blur(12px);
                    transition: all var(--animation-normal);
                    animation: slideInUp var(--animation-slow) ease-out;
                }

                .greeting-avatar {
                    font-size: 48px;
                    margin-bottom: var(--spacing-md);
                    animation: bounceIn 1s ease-out 0.5s both;
                }

                .edwin-greeting-card h1 {
                    font-size: 2.5em;
                    font-weight: 700;
                    margin-bottom: 0.5em;
                    background: var(--primary-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .edwin-greeting-card p {
                    font-size: 1.2em;
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-md);
                }

                #edwin-subtext {
                    font-size: 1em;
                    color: var(--text-muted);
                }

                /* Enhanced Footer */
                .edwin-footer {
                    display: flex;
                    padding: var(--spacing-md) var(--spacing-lg);
                    background: var(--glass-bg);
                    backdrop-filter: blur(12px);
                    border-top: 1px solid var(--glass-border);
                    gap: var(--spacing-md);
                    align-items: center;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 4;
                }

                /* Enhanced Input */
                .input-wrapper {
                    position: relative;
                    flex-grow: 1;
                    flex-basis: 0;      /* 🔥 allows input to stretch */
                    display: flex;
                }


                .input-glow {
                    position: absolute;
                    inset: 0;
                    border-radius: var(--border-radius);
                    background: var(--primary-gradient);
                    opacity: 0;
                    z-index: -1;
                    transition: opacity var(--animation-normal);
                }

                .edwin-footer input {
                    flex: 1;            /* 🔥 fully stretch inside wrapper */
                    min-width: 200px;   /* ensures input doesn’t collapse */
                    padding: var(--spacing-md) var(--spacing-lg);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--glass-border);
                    background: var(--glass-bg);
                    backdrop-filter: blur(8px);
                    color: var(--text-primary);
                    font-size: var(--base-font-size);
                    transition: all var(--animation-normal);
                    position: relative;
                    z-index: 1;
                }




                .edwin-footer input:focus {
                    outline: none;
                    border-color: rgba(102, 126, 234, 0.5);
                }

                .edwin-footer input:focus + .input-glow {
                    opacity: 0.1;
                }

                .edwin-footer input::placeholder {
                    color: var(--text-muted);
                }

                /* Enhanced Send Button */
                .edwin-footer #edwin-send {
                    position: relative;
                    min-width: 120px;   /* 👈 force button width */
                    padding: var(--spacing-md) var(--spacing-xl);
                    border: none;
                    border-radius: var(--border-radius);
                    background: var(--primary-gradient);
                    color: white;
                    font-weight: 600;
                    font-size: var(--base-font-size);
                    cursor: pointer;
                    transition: all var(--animation-normal);
                    overflow: hidden;
                    text-align: center;
                }


                .send-glow {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%);
                    opacity: 0;
                    transition: opacity var(--animation-fast);
                }

                .edwin-footer #edwin-send:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .edwin-footer #edwin-send:hover .send-glow {
                    opacity: 1;
                }

                .edwin-footer #edwin-send:active {
                    transform: translateY(0) scale(0.98);
                }

                /* Chat Messages */
                #edwin-chat {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                    flex: 1;
                    overflow-y: auto;
                    min-height: 0;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                }

                #edwin-chat::-webkit-scrollbar {
                    width: 8px;
                }

                #edwin-chat::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }

                #edwin-chat::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }

                #edwin-chat::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }

                .edwin-msg {
                    display: flex;
                    gap: var(--spacing-sm);
                    opacity: 0;
                    transform: translateY(20px);
                    transition: all var(--animation-normal);
                    animation: slideInUp var(--animation-normal) ease-out forwards;
                }

                .edwin-msg.show {
                    opacity: 1;
                    transform: translateY(0);
                }

                .edwin-msg.fade-out {
                    opacity: 0;
                    transform: translateX(-30px);
                }

                .edwin-msg.user {
                    flex-direction: row-reverse;
                }

                .message-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    flex-shrink: 0;
                    border: 2px solid var(--glass-border);
                    backdrop-filter: blur(8px);
                }

                .user-avatar {
                    background: var(--secondary-gradient);
                }

                .edwin-avatar {
                    background: var(--primary-gradient);
                }

                .thinking-avatar {
                    background: var(--success-gradient);
                    animation: pulse 2s infinite;
                }

                .message-content {
                    display: flex;
                    flex-direction: column;
                    max-width: 70%;
                }

                .message-bubble {
                    padding: var(--spacing-md) var(--spacing-lg);
                    border-radius: var(--border-radius-lg);
                    backdrop-filter: blur(8px);
                    border: 1px solid var(--glass-border);
                    position: relative;
                    word-wrap: break-word;
                    line-height: 1.5;
                }

                .user-bubble {
                    background: var(--glass-bg);
                    color: var(--text-primary);
                    border-bottom-right-radius: var(--spacing-sm);
                }

                .edwin-bubble {
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
                    color: var(--text-primary);
                    border-bottom-left-radius: var(--spacing-sm);
                }

                .thinking-bubble {
                    background: linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%);
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                }

                .message-timestamp {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: var(--spacing-xs);
                    text-align: right;
                }

                .edwin-msg.user .message-timestamp {
                    text-align: left;
                }

                .message-citations {
                    margin-top: var(--spacing-md);
                    padding: var(--spacing-sm);
                    background: rgba(0, 0, 0, 0.03);
                    border-radius: var(--radius-md);
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
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 4px;
                    font-size: 11px;
                    font-style: italic;
                    color: var(--text-muted);
                    line-height: 1.4;
                }

                .spinner {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }

                .thinking-dots {
                    display: flex;
                    gap: 4px;
                }

                .thinking-dots span {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: currentColor;
                    animation: thinkingDots 1.4s ease-in-out infinite both;
                }

                .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
                .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }

                .quiz-explanation {
                    font-size: 1em;
                    color: var(--text-secondary);
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--border-radius-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    backdrop-filter: blur(8px);
                    }


                /* Enhanced Quizzes Tab */
                .quizzes-tab {
                    position: absolute;
                    top: 50%;
                    left: calc(-1 * ${quizzesTabExtensionClosed}px);
                    transform: translateY(-50%) rotate(90deg);
                    background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 100%);
                    color: white;
                    padding: var(--spacing-lg) var(--spacing-xl);
                    font-weight: 700;
                    font-size: 18px;
                    border-top-left-radius: var(--border-radius);
                    border-top-right-radius: var(--border-radius);
                    cursor: pointer;
                    box-shadow: var(--shadow-md);
                    transition: all ${quizzesTabAnimationSpeed}s cubic-bezier(0.25, 0.8, 0.25, 1);
                    letter-spacing: 1px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    z-index: 12;
                    user-select: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    border: 1px solid var(--glass-border);
                }

                .tab-glow {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
                    transform: translateX(-100%);
                    transition: transform 0.6s ease;
                }

                .quizzes-tab:hover {
                    transform: translateY(-50%) rotate(90deg) scale(1.1);
                    box-shadow: var(--shadow-lg);
                    filter: brightness(1.2);
                }

                .quizzes-tab:hover .tab-glow {
                    transform: translateX(100%);
                }

                #edwin-panel.quizzes-open .quizzes-tab {
                    left: calc(-1 * ${Math.abs(parseInt(quizzesTabExtensionOpen))}px);
                }

                /* Enhanced Quizzes Section */
                #edwin-quizzes-section {
                    position: absolute;
                    top: 60px;
                    left: 4px;
                    height: 85%;
                    width: 90%;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(135deg,
                        rgba(13, 17, 23, 0.95) 0%,
                        rgba(15, 42, 68, 0.95) 25%,
                        rgba(18, 49, 42, 0.95) 50%,
                        rgba(20, 88, 58, 0.95) 75%,
                        rgba(27, 63, 115, 0.95) 100%);
                    backdrop-filter: blur(20px);
                    border-top-left-radius: var(--border-radius-lg);
                    border-top-right-radius: var(--border-radius-lg);
                    border: 1px solid var(--glass-border);
                    box-shadow: var(--shadow-lg);
                    transform: translateX(-100%);
                    transition: transform 0.45s cubic-bezier(0.22, 0.9, 0.35, 1), opacity 0.2s linear;
                    z-index: 10;
                    pointer-events: none;
                    opacity: 0;
                    visibility: hidden;
                }

                #edwin-panel.quizzes-visible #edwin-quizzes-section {
                    visibility: visible;
                    opacity: 1;
                }

                #edwin-panel.quizzes-open #edwin-quizzes-section {
                    transform: translateX(0);
                    pointer-events: auto;
                }

                .edwin-quizzes-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md) var(--spacing-lg);
                    font-size: 18px;
                    font-weight: 600;
                    background: var(--glass-bg);
                    backdrop-filter: blur(12px);
                    border-top-left-radius: var(--border-radius-lg);
                    border-top-right-radius: var(--border-radius-lg);
                    border-bottom: 1px solid var(--glass-border);
                    z-index: 11;
                }

                .edwin-quizzes-header button {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: none;
                    border-radius: var(--border-radius-sm);
                    background: var(--primary-gradient);
                    color: white;
                    font-weight: 600;
                    font-size: var(--base-font-size);
                    cursor: pointer;
                    z-index: 11;
                    transition: all var(--animation-normal);
                }

                .edwin-quizzes-header button:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .edwin-quizzes-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--spacing-xl);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .edwin-quizzes-title-wrapper {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    margin-bottom: var(--spacing-md);
                }

                .edwin-quizzes-title-wrapper h2 {
                    margin: 0;
                    font-size: 1.8em;
                    font-weight: 700;
                    background: var(--primary-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .section-description {
                    color: var(--text-secondary);
                    font-size: 1.1em;
                    margin-bottom: var(--spacing-lg);
                }

                /* Enhanced Progress Bar */
                .enhanced-progress {
                    position: relative;
                    width: 300px;
                    height: 32px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: var(--border-radius);
                    overflow: hidden;
                    display: flex;
                    border: 1px solid var(--glass-border);
                }

                .progress-segment {
                    flex: 1;
                    margin: 2px;
                    border-radius: 6px;
                    background: rgba(255, 255, 255, 0.1);
                    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .progress-segment.filled {
                    background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                    box-shadow: 0 0 20px rgba(255, 107, 53, 0.5);
                    animation: progressFill 0.8s ease-out;
                }

                .progress-segment.filled::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    animation: shimmer 2s infinite;
                }

                /* Quiz Option Buttons */
                .quiz-option {
                    display: block;
                    width: 100%;
                    margin: 10px 0;
                    padding: 14px;
                    border-radius: 12px;
                    border: none;
                    background: #1b1f27;
                    color: white;
                    font-size: 16px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .quiz-option:hover {
                    background: #2c2c34;
                }


                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }

                .fire-effect {
                    position: absolute;
                    left: 320px;
                    top: -10px;
                    width: 50px;
                    height: 50px;
                    display: none;
                    object-fit: contain;
                    pointer-events: none;
                    filter: drop-shadow(0 0 10px rgba(255, 107, 53, 0.7));
                }

                /* Enhanced Quiz Items */
                #edwin-quizzes-list {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .edwin-quiz-item {
                    background: var(--glass-bg);
                    backdrop-filter: blur(12px);
                    padding: var(--spacing-xl);
                    border-radius: var(--border-radius-lg);
                    border: 1px solid var(--glass-border);
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                    transition: all var(--animation-normal);
                    cursor: pointer;
                    animation: slideInUp var(--animation-normal) ease-out;
                    position: relative;
                    overflow: hidden;
                }

                .edwin-quiz-item::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                    transition: left 0.5s ease;
                }

                .edwin-quiz-item:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-md);
                    border-color: rgba(102, 126, 234, 0.3);
                }

                .edwin-quiz-item:hover::before {
                    left: 100%;
                }

                .quiz-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: var(--spacing-md);
                }

                .quiz-title {
                    font-weight: 700;
                    font-size: 1.3em;
                    color: var(--text-primary);
                    line-height: 1.3;
                }

                .quiz-difficulty {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: 20px;
                    font-size: 0.8em;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                }

                .quiz-difficulty.beginner {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    color: white;
                }

                .quiz-difficulty.intermediate {
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                }

                .quiz-difficulty.advanced {
                    background: linear-gradient(135deg, #ff8a80 0%, #ff5722 100%);
                    color: white;
                }

                .quiz-desc {
                    font-size: 1.1em;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }

                .quiz-card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: var(--spacing-sm);
                }

                .quiz-action {
                    position: relative;
                    padding: var(--spacing-md) var(--spacing-xl);
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 1em;
                    transition: all var(--animation-normal);
                    overflow: hidden;
                    background: var(--primary-gradient);
                    color: white;
                }

                .quiz-action.completed {
                    background: var(--success-gradient);
                }

                .button-glow {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 100%);
                    opacity: 0;
                    transition: opacity var(--animation-fast);
                }

                .quiz-action:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .quiz-action:hover .button-glow {
                    opacity: 1;
                }

                .quiz-action:active {
                    transform: translateY(0) scale(0.98);
                }

                .completion-badge {
                    background: var(--success-gradient);
                    color: white;
                    padding: var(--spacing-xs) var(--spacing-md);
                    border-radius: 20px;
                    font-size: 0.9em;
                    font-weight: 600;
                    animation: bounceIn 0.6s ease-out;
                }


                /* Enhanced Settings Modal */
                .settings-modal {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    opacity: 0;
                    visibility: hidden;
                    transition: all var(--animation-normal);
                }

                .settings-modal.show {
                    opacity: 1;
                    visibility: visible;
                }

                .settings-content {
                    background: var(--panel-bg);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--border-radius-lg);
                    padding: var(--spacing-xl);
                    width: 700px;
                    max-width: 90vw;
                    max-height: 80vh;
                    overflow-y: auto;
                    animation: slideInUp var(--animation-normal) ease-out;
                }

                .settings-content h2 {
                    margin: 0 0 var(--spacing-lg) 0;
                    font-size: 1.8em;
                    font-weight: 700;
                    background: var(--primary-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .settings-group {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                    margin-bottom: var(--spacing-xl);
                }

                .setting-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                    font-size: var(--base-font-size);
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius-sm);
                    transition: background var(--animation-fast);
                }

                .setting-item:hover {
                    background: var(--glass-bg);
                }

                .setting-item input[type="checkbox"] {
                    display: none;
                }

                .checkmark {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--glass-border);
                    border-radius: 4px;
                    position: relative;
                    transition: all var(--animation-fast);
                }

                .setting-item input[type="checkbox"]:checked + .checkmark {
                    background: var(--primary-gradient);
                    border-color: transparent;
                }

                .setting-item input[type="checkbox"]:checked + .checkmark::after {
                    content: '✓';
                    position: absolute;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .setting-select {
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--border-radius-sm);
                    color: var(--text-primary);
                    padding: var(--spacing-sm) var(--spacing-md);
                    font-size: var(--base-font-size);
                    cursor: pointer;
                    transition: all var(--animation-fast);
                }

                .setting-select:focus {
                    outline: none;
                    border-color: rgba(102, 126, 234, 0.5);
                }

                .settings-close {
                    width: 100%;
                    padding: var(--spacing-md);
                    border: none;
                    border-radius: var(--border-radius);
                    background: var(--primary-gradient);
                    color: white;
                    font-weight: 600;
                    font-size: var(--base-font-size);
                    cursor: pointer;
                    transition: all var(--animation-normal);
                }

                .settings-close:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .settings-divider {
                    height: 1px;
                    background: var(--glass-border);
                    margin: var(--spacing-lg) 0;
                }

                .settings-section-title {
                    font-size: 1.2em;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0 0 var(--spacing-sm) 0;
                }

                .settings-description {
                    font-size: 0.9em;
                    color: var(--text-muted);
                    margin: 0 0 var(--spacing-md) 0;
                }

                .setting-input {
                    width: 100%;
                    padding: var(--spacing-md);
                    margin: var(--spacing-sm) 0;
                    border-radius: var(--border-radius-sm);
                    border: 1px solid var(--glass-border);
                    background: var(--glass-bg);
                    color: var(--text-primary);
                    font-size: var(--base-font-size);
                    transition: all var(--animation-fast);
                }

                .setting-input:focus {
                    outline: none;
                    border-color: rgba(102, 126, 234, 0.5);
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .sync-button {
                    width: 100%;
                    padding: var(--spacing-md);
                    margin-top: var(--spacing-sm);
                    border: none;
                    border-radius: var(--border-radius);
                    background: var(--primary-gradient);
                    color: white;
                    font-weight: 600;
                    font-size: var(--base-font-size);
                    cursor: pointer;
                    transition: all var(--animation-normal);
                }

                .sync-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }

                .sync-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .settings-hint {
                    font-size: 0.85em;
                    color: var(--text-muted);
                    margin-top: var(--spacing-xs);
                    font-style: italic;
                }

                .sync-status {
                    margin-top: var(--spacing-sm);
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius-sm);
                    font-size: 0.9em;
                    text-align: center;
                    display: none;
                }

                .sync-status.success {
                    display: block;
                    background: rgba(76, 175, 80, 0.2);
                    color: #4caf50;
                    border: 1px solid rgba(76, 175, 80, 0.3);
                }

                .sync-status.error {
                    display: block;
                    background: rgba(244, 67, 54, 0.2);
                    color: #f44336;
                    border: 1px solid rgba(244, 67, 54, 0.3);
                }

                .sync-status.loading {
                    display: block;
                    background: rgba(255, 152, 0, 0.2);
                    color: #ff9800;
                    border: 1px solid rgba(255, 152, 0, 0.3);
                }

                /* Grounded Badge */
                .grounded-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .grounded-badge.grounded {
                    background: linear-gradient(135deg, #4caf50, #2e7d32);
                    color: white;
                    border: 1px solid rgba(76, 175, 80, 0.3);
                }

                .grounded-badge.ungrounded {
                    background: linear-gradient(135deg, #ff9800, #f57c00);
                    color: white;
                    border: 1px solid rgba(255, 152, 0, 0.3);
                }

                /* Offline Banner */
                #edwin-offline-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #f44336, #b71c1c);
                    color: white;
                    padding: 12px 20px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 14px;
                    z-index: 999999;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    display: none;
                    animation: slideInDown 0.3s ease-out;
                }

                #edwin-offline-banner.show {
                    display: block;
                }

                @keyframes slideInDown {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }

                /* Responsive Design */
                @media (max-width: 1200px) {
                    #edwin-panel {
                        left: 40px;
                        right: 40px;
                    }
                }

                @media (max-width: 768px) {
                    #edwin-panel {
                        left: 10px;
                        right: 10px;
                        height: 70%;
                    }

                    .edwin-quizzes-title-wrapper {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .enhanced-progress {
                        width: 250px;
                    }

                }

                /* Accessibility Improvements */
                @media (prefers-reduced-motion: reduce) {
                    * {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }

                @media (prefers-contrast: high) {
                    :root {
                        --glass-bg: rgba(255, 255, 255, 0.15);
                        --glass-border: rgba(255, 255, 255, 0.3);
                        --text-secondary: rgba(255, 255, 255, 0.9);
                    }
                }

                /* Focus states for keyboard navigation */
                button:focus-visible,
                input:focus-visible,
                [tabindex]:focus-visible {
                    outline: 2px solid rgba(102, 126, 234, 0.8);
                    outline-offset: 2px;
                }

                .quiz-completed {
                    text-align: center;
                    padding: 40px 20px;
                    font-size: 24px;
                    font-weight: 700;
                    background: var(--success-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    border: 2px solid var(--glass-border);
                    border-radius: var(--border-radius-lg);
                    background-color: var(--glass-bg);
                    backdrop-filter: blur(12px);
                }

                .quiz-completed button {
                    -webkit-text-fill-color: white;
                    background-clip: padding-box;
                    -webkit-background-clip: padding-box;
                }

                .quiz-option:disabled {
                    pointer-events: none;
                }

                .quiz-navigation {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background: var(--glass-bg);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--glass-border);
                }

                .nav-btn {
                    padding: var(--spacing-sm) var(--spacing-lg);
                    border: none;
                    border-radius: var(--border-radius-sm);
                    background: var(--primary-gradient);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all var(--animation-fast);
                }

                .nav-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-sm);
                }

                .nav-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    background: rgba(255, 255, 255, 0.1);
                }

                .question-progress {
                    font-size: 14px;
                    color: var(--text-secondary);
                    font-weight: 600;
                }

                .quiz-completed h2 {
                    margin: 0 0 var(--spacing-md) 0;
                    font-size: 2em;
                }

                .quiz-completed p {
                    color: var(--text-secondary);
                    margin-bottom: var(--spacing-lg);
                    font-size: 1.1em;
                }

                /* DELIVERABLE D: Progress/Mastery Styles */
                .stat-card {
                    flex: 1;
                    min-width: 150px;
                    padding: 20px;
                    background: var(--glass-bg);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--glass-border);
                    text-align: center;
                }

                .stat-value {
                    font-size: 2em;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-label {
                    font-size: 0.9em;
                    color: var(--text-secondary);
                    margin-top: 5px;
                }

                .topic-card {
                    padding: 15px;
                    background: var(--glass-bg);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--glass-border);
                    margin-bottom: 15px;
                }

                .topic-name {
                    font-weight: 600;
                    color: var(--text-primary);
                    font-size: 1.1em;
                }

                .topic-attempts {
                    font-size: 0.9em;
                    color: var(--text-muted);
                    margin-top: 5px;
                }

                .topic-accuracy {
                    font-weight: 700;
                    font-size: 1.3em;
                }

                .topic-accuracy.high { color: #4caf50; }
                .topic-accuracy.medium { color: #ff9800; }
                .topic-accuracy.low { color: #f44336; }

                .progress-bar {
                    height: 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    margin-top: 10px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    transition: width 0.5s ease;
                }

                .weak-topic-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    background: var(--glass-bg);
                    border-radius: var(--border-radius);
                    border: 1px solid rgba(244, 67, 54, 0.3);
                }

                .practice-btn {
                    padding: 8px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all var(--animation-fast);
                }

                .practice-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-sm);
                }

            `;

            document.head.appendChild(style);

            // Add Google Fonts for better typography
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
    })();
