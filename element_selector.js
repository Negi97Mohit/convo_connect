(async function() {
    if (window.isSelectorActive) return;
    window.isSelectorActive = true;

    const { tabId } = await chrome.runtime.sendMessage({ action: "getTabId" });
    if (!tabId) {
        console.error("Could not get a valid Tab ID. Aborting selection.");
        return;
    }
    const storageKey = `selector_${tabId}`;

    const overlay = document.createElement('div');
    overlay.className = 'element-selector-overlay';
    document.body.appendChild(overlay);

    function mouseMoveHandler(e) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target || target === overlay || target.id === 'scroller-overlay') return;
        const rect = target.getBoundingClientRect();
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.left = `${rect.left + window.scrollX}px`;
    }

    function clickHandler(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (!target) return;
        
        const selector = createStableSelector(target);
        chrome.storage.local.set({ [storageKey]: selector }, () => {
            console.log('Chat area selector saved:', selector);
            cleanup();
            chrome.runtime.sendMessage({ action: "elementSelected", tabId });
            alert('Chat area selected! Re-open the extension to continue.');
        });
    }

    /**
     * Creates a robust, stable, and syntactically valid CSS selector.
     * This version actively avoids invalid characters found in modern web frameworks.
     */
    function createStableSelector(element) {
        // Regex to check for a valid CSS identifier (for IDs and class names)
        const validIdentifier = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;

        // 1. Prioritize a unique and syntactically valid ID
        if (element.id && validIdentifier.test(element.id)) {
            const selector = `#${element.id}`;
            if (document.querySelectorAll(selector).length === 1) {
                return selector;
            }
        }
        
        // 2. Prioritize a unique and syntactically valid class
        const validClasses = Array.from(element.classList).filter(c => validIdentifier.test(c));
        for (const c of validClasses) {
            const selector = `.${c}`;
            if (document.querySelectorAll(selector).length === 1) {
                return selector;
            }
        }

        // 3. Fallback to a full path using tag names and nth-of-type, which is always valid
        let path = '';
        let current = element;
        while (current && current.parentElement) {
            const tagName = current.tagName.toLowerCase();
            if (tagName === 'body') break; // Stop at the body
            
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.tagName.toLowerCase() === tagName) index++;
                sibling = sibling.previousElementSibling;
            }
            path = ` > ${tagName}:nth-of-type(${index})${path}`;
            current = current.parentElement;
        }
        return `body${path}`.trim();
    }

    function cleanup() {
        document.removeEventListener('mousemove', mouseMoveHandler, true);
        document.removeEventListener('click', clickHandler, true);
        if (document.body.contains(overlay)) overlay.remove();
        window.isSelectorActive = false;
    }

    document.addEventListener('mousemove', mouseMoveHandler, true);
    document.addEventListener('click', clickHandler, true);
})();