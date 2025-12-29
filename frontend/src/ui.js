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
