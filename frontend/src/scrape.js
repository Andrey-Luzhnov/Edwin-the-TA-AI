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
