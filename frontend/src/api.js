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
