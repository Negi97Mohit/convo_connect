document.addEventListener('DOMContentLoaded', () => {
    const selectButton = document.getElementById('selectBtn');
    const clearButton = document.getElementById('clearBtn');
    const prepareButton = document.getElementById('prepareBtn');
    const downloadButton = document.getElementById('downloadBtn');
    const statusText = document.getElementById('statusText');
    let activeTabId;

    function updateUI(state) {
        selectButton.disabled = false;
        clearButton.disabled = true;
        prepareButton.disabled = true;
        downloadButton.disabled = true;
        statusText.textContent = '1. Select an area.';

        if (state.selector) {
            statusText.textContent = '2. Area selected.';
            selectButton.disabled = true;
            clearButton.disabled = false;
            prepareButton.disabled = false;
        }
        if (state.isPreparing) {
            prepareButton.disabled = true;
            statusText.textContent = 'Preparing...';
        }
        if (state.isReadyToDownload) {
             statusText.textContent = '3. Ready to download!';
             selectButton.disabled = true;
             clearButton.disabled = false;
             prepareButton.disabled = false;
             downloadButton.disabled = false;
        }
    }

    // Main entry point: Get active tab first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        activeTabId = tabs[0].id;
        const storageKey = `selector_${activeTabId}`;
        
        chrome.storage.local.get([storageKey], (result) => {
            updateUI({ selector: result[storageKey] });
        });
    });

    selectButton.addEventListener('click', () => {
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['element_selector.js'] });
        chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ['selector_styles.css'] });
        window.close();
    });
    
    clearButton.addEventListener('click', () => {
        const storageKey = `selector_${activeTabId}`;
        chrome.storage.local.remove([storageKey], () => updateUI({ selector: null }));
    });

    prepareButton.addEventListener('click', () => {
        const storageKey = `selector_${activeTabId}`;
        chrome.storage.local.get([storageKey], (result) => {
            updateUI({ selector: result[storageKey], isPreparing: true });
        });
        chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ['overlay.css'] }, () => {
            if (chrome.runtime.lastError) {
                console.error(`CSS injection failed: ${chrome.runtime.lastError.message}`);
                return;
            }
            chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['autoscroll.js'] });
        });
    });

    downloadButton.addEventListener('click', () => {
        statusText.textContent = 'Extracting...';
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['universal_content.js'] });
    });

    chrome.runtime.onMessage.addListener((message, sender) => {
        // Ensure the message is from the active tab before updating the UI
        if (sender.tab && sender.tab.id === activeTabId) {
            if (message.action === "elementSelected") {
                const storageKey = `selector_${activeTabId}`;
                chrome.storage.local.get([storageKey], (result) => updateUI({ selector: result[storageKey] }));
            }
            if (message.action === "scrollingComplete") {
                const storageKey = `selector_${activeTabId}`;
                chrome.storage.local.get([storageKey], (result) => {
                    updateUI({ selector: result[storageKey], isReadyToDownload: true });
                });
            }
            if (message.action === "sendChatData") {
                if (message.data && message.data.length > 0) {
                    statusText.textContent = 'Downloading...';
                    const chatJson = JSON.stringify(message.data, null, 2);
                    const blob = new Blob([chatJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({ url: url, filename: 'conversation_export.json' }, () => {
                        URL.revokeObjectURL(url);
                        statusText.textContent = 'Download complete!';
                        // After download, reset to the "Ready to Download" state
                        setTimeout(() => {
                            const storageKey = `selector_${activeTabId}`;
                            chrome.storage.local.get([storageKey], (result) => {
                                updateUI({ selector: result[storageKey], isReadyToDownload: true });
                            });
                        }, 2000);
                    });
                } else {
                    statusText.textContent = 'Could not find chat.';
                }
            }
        }
    });
});