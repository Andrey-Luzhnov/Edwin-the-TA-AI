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
