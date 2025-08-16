(async function() {
    if (window.isAutoScrollerRunning) return;
    window.isAutoScrollerRunning = true;
    console.log("Auto-scroll script initiated.");

    const overlay = document.createElement('div');
    overlay.id = 'scroller-overlay';
    overlay.innerHTML = `
        <div class="scroller-overlay-content">
            <div class="scroller-spinner"></div>
            <p>Preparing chat...</p>
            <span>Scrolling to the beginning...</span>
        </div>`;
    document.body.appendChild(overlay);

    const cleanup = (message) => {
        console.log(message);
        if (document.body.contains(overlay)) overlay.remove();
        window.isAutoScrollerRunning = false;
        chrome.runtime.sendMessage({ action: "scrollingComplete" });
    };

    try {
        const { tabId } = await chrome.runtime.sendMessage({ action: "getTabId" });
        const storageKey = `selector_${tabId}`;
        const result = await chrome.storage.local.get(storageKey);
        const chatContainerSelector = result[storageKey];

        if (!chatContainerSelector) return cleanup("Error: No chat container selector found for this tab.");
        
        let userSelectedContainer;
        try {
            userSelectedContainer = document.querySelector(chatContainerSelector);
        } catch (e) {
            return cleanup(`Error: The saved selector is invalid. Please clear and re-select.`);
        }
        
        if (!userSelectedContainer) return cleanup("Error: The selected container could not be found.");
        
        function findScrollableElement() {
            if (userSelectedContainer.scrollHeight > userSelectedContainer.clientHeight) return userSelectedContainer;
            const elements = Array.from(userSelectedContainer.querySelectorAll('*'));
            let bestCandidate = null;
            for (const el of elements) {
                if (el.scrollHeight > el.clientHeight * 1.2) {
                    const style = window.getComputedStyle(el);
                    if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
                        if (!bestCandidate || el.scrollHeight > bestCandidate.scrollHeight) bestCandidate = el;
                    }
                }
            }
            return bestCandidate || window;
        }

        const scrollableElement = findScrollableElement();
        let lastScrollTop = -1;
        let consecutiveStableScrolls = 0;
        const STABILITY_THRESHOLD = 3;

        const autoScroll = () => {
            const isWindow = scrollableElement === window;
            const currentScrollTop = isWindow ? window.scrollY : scrollableElement.scrollTop;
            if (currentScrollTop === 0) lastScrollTop = 0;
            if (isWindow) window.scrollTo(0, 0);
            else scrollableElement.scrollTo(0, 0);
            
            setTimeout(() => {
                const newScrollTop = isWindow ? window.scrollY : scrollableElement.scrollTop;
                if (newScrollTop === lastScrollTop) consecutiveStableScrolls++;
                else consecutiveStableScrolls = 0;
                lastScrollTop = newScrollTop;
                if (consecutiveStableScrolls >= STABILITY_THRESHOLD) return cleanup("Auto-scrolling finished.");
                setTimeout(autoScroll, 1500);
            }, 500);
        };
        autoScroll();

    } catch (error) {
        cleanup(`An unexpected error occurred: ${error.message}`);
    }
})();