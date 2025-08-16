(async function() {
    console.log("Universal Scraper Activated.");

    try {
        const { tabId } = await chrome.runtime.sendMessage({ action: "getTabId" });
        const storageKey = `selector_${tabId}`;
        const result = await chrome.storage.local.get(storageKey);
        const chatContainerSelector = result[storageKey];

        if (!chatContainerSelector) throw new Error("No chat container selector found for this tab.");

        let container;
        try {
            container = document.querySelector(chatContainerSelector);
        } catch (e) {
            throw new Error(`The saved selector is invalid. Please clear and re-select.`);
        }

        if (!container) throw new Error("Selected container not found on page.");

        function findAllBubbles(container) {
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let node;
            while(node = walker.nextNode()) {
                if (node.textContent.trim().length > 5) textNodes.push(node);
            }
            if (textNodes.length === 0) return [];
            const bubbles = textNodes.map(node => findCommonAncestor(node, container, 7));
            return Array.from(new Set(bubbles.filter(b => b)));
        }

        function findCommonAncestor(node, container, maxDepth) {
            let parent = node.parentElement;
            let depth = 0;
            while (parent && parent !== container && depth < maxDepth) {
                const style = window.getComputedStyle(parent);
                if (style.padding !== '0px' && style.display !== 'inline') return parent;
                parent = parent.parentElement;
                depth++;
            }
            return parent !== container ? parent : null;
        }

        function getBubbleSignature(bubble) {
            if (!bubble) return '';
            const style = window.getComputedStyle(bubble);
            const alignment = style.justifyContent || style.alignSelf || '';
            return `${bubble.tagName}_${Array.from(bubble.classList).join('-')}_${alignment}`;
        }

        function extractVisibleContent(bubble) {
            const clone = bubble.cloneNode(true);
            clone.querySelectorAll('button, svg, [aria-label*="copy"], [class*="icon"]').forEach(el => el.remove());
            const isVisible = (el) => {
                 const style = window.getComputedStyle(el);
                 return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
            const visibleTexts = [];
            let currentNode;
            while(currentNode = walker.nextNode()) {
                if (currentNode.parentElement && isVisible(currentNode.parentElement)) {
                    visibleTexts.push(currentNode.textContent.trim());
                }
            }
            return visibleTexts.join(' ').replace(/\s+/g, ' ').trim();
        }
        
        const bubbles = findAllBubbles(container);
        if (bubbles.length < 1) throw new Error("No message bubbles found in the selected area.");

        const userSignature = getBubbleSignature(bubbles[0]);
        let assistantSignature = null;
        for (let i = 1; i < bubbles.length; i++) {
            if (getBubbleSignature(bubbles[i]) !== userSignature) {
                assistantSignature = getBubbleSignature(bubbles[i]);
                break;
            }
        }
        if (!assistantSignature) assistantSignature = 'ASSISTANT_SIGNATURE_NOT_FOUND_' + Date.now();

        const allMessages = bubbles.map(bubble => ({
            author: getBubbleSignature(bubble) === userSignature ? 'user' : 'assistant',
            content: extractVisibleContent(bubble)
        }));

        const conversationTurns = [];
        let currentTurn = {};
        allMessages.forEach(message => {
            if (message.content.length < 2) return;
            if (message.author === 'user') {
                if (currentTurn.user_prompt && currentTurn.assistant_response) {
                    conversationTurns.push(currentTurn);
                }
                currentTurn = { user_prompt: (currentTurn.user_prompt && !currentTurn.assistant_response) ? `${currentTurn.user_prompt}\n\n${message.content}` : message.content, assistant_response: '' };

            } else if (message.author === 'assistant') {
                if (!currentTurn.user_prompt) currentTurn.user_prompt = '[No user prompt for this response]';
                currentTurn.assistant_response += message.content + '\n\n';
            }
        });
        if (currentTurn.user_prompt) {
            currentTurn.assistant_response = currentTurn.assistant_response.trim();
            conversationTurns.push(currentTurn);
        }
        
        if (conversationTurns.length === 0) throw new Error("Conversational parser failed.");
        chrome.runtime.sendMessage({ action: "sendChatData", data: conversationTurns });

    } catch (error) {
        console.error("Error during scraping:", error.message);
        chrome.runtime.sendMessage({ action: "sendChatData", data: [] });
    }
})();