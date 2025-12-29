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
