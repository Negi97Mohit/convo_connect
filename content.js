(function() {
    /**
     * Scrapes the chat data from the webpage.
     * * NOTE: The CSS selectors below are EXAMPLES. You must inspect the HTML
     * of your target chat website and update them to match its structure.
     */
    function scrapeConversation() {
        // Selector for each individual message block in the conversation.
        const messageElements = document.querySelectorAll('div[data-testid^="conversation-turn-"]');
        
        const chatData = [];

        messageElements.forEach(element => {
            // Selector to find the author's role (e.g., 'user' or 'assistant').
            const roleElement = element.querySelector('[data-message-author-role]');
            const role = roleElement ? roleElement.getAttribute('data-message-author-role') : 'unknown';

            // Selector for the actual text content of the message.
            // Often, message content is inside a div with a class like 'markdown' or within a specific structure.
            const contentElement = element.querySelector('.markdown, .prose'); 
            const content = contentElement ? contentElement.innerText.trim() : '';

            // Only add the message if content was found
            if (content) {
                chatData.push({
                    role: role,
                    content: content
                });
            }
        });

        return chatData;
    }

    // Run the scraper and send the extracted data back to the popup script.
    const extractedData = scrapeConversation();
    chrome.runtime.sendMessage({ action: "sendChatData", data: extractedData });
})();