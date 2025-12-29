// Main initialization and event handlers for Edwin AI

(function() {
    'use strict';

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
