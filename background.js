// This script runs in the background to manage storage and messages.

// 1. Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    const storageKey = `selector_${tabId}`;
    chrome.storage.local.remove(storageKey, () => {
        if (chrome.runtime.lastError) {
            // Silently ignore errors, e.g., if storage was already clear.
        } else {
            console.log(`Cleared storage for closed tab: ${tabId}`);
        }
    });
});

// 2. Respond to content scripts asking for their tab ID
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getTabId") {
        sendResponse({ tabId: sender.tab.id });
    }
});