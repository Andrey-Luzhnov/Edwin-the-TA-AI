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
