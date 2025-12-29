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
