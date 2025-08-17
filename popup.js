// popup.js

document.addEventListener('DOMContentLoaded', () => {
    // Button references
    const selectButton = document.getElementById('selectBtn');
    const clearButton = document.getElementById('clearBtn');
    const prepareButton = document.getElementById('prepareBtn');
    const downloadButton = document.getElementById('downloadBtn');
    const saveLogsButton = document.getElementById('saveLogsBtn');
    const clearLogsButton = document.getElementById('clearLogsBtn');

    // UI element references
    const statusText = document.getElementById('statusText');
    const logsContainer = document.getElementById('logsContainer');

    // State variables
    let activeTabId;
    let activeTabUrl;
    let lastUsedSelector;

    /**
     * Renders the list of download logs in the popup.
     * @param {Array} logs - The array of log objects from storage.
     */
    function renderLogs(logs = []) {
        logsContainer.innerHTML = ''; // Clear previous content

        if (logs.length === 0) {
            logsContainer.innerHTML = '<p style="text-align:center; color:#888;">No downloads yet.</p>';
            return;
        }

        // Sort logs by newest first
        logs.sort((a, b) => b.id - a.id);

        logs.forEach(log => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry';
            entryDiv.dataset.logId = log.id;

            const isPending = log.status === 'pending_review';
            const isCorrect = log.status === 'correct';
            const isIncorrect = log.status === 'incorrect';

            // MODIFIED: Added the "Open Downloads" button to each log entry
            entryDiv.innerHTML = `
                <div class="log-details">
                    <div>
                        <strong>File:</strong> ${log.filename}<br>
                        <strong>Site:</strong> ${log.hostname}
                    </div>
                    <button class="open-downloads-btn" title="Open the browser's downloads page">📂 View File</button>
                </div>
                <div class="log-status">
                    <label><input type="radio" name="status-${log.id}" value="pending_review" ${isPending ? 'checked' : ''}> Pending</label>
                    <label><input type="radio" name="status-${log.id}" value="correct" ${isCorrect ? 'checked' : ''}> Correct</label>
                    <label><input type="radio" name="status-${log.id}" value="incorrect" ${isIncorrect ? 'checked' : ''}> Incorrect</label>
                </div>
            `;
            logsContainer.appendChild(entryDiv);
        });
    }

    /**
     * Updates the state of the top action buttons.
     * @param {object} state - The current UI state.
     */
    function updateActionUI(state) {
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
            lastUsedSelector = state.selector;
        }
        if (state.isPreparing) {
            prepareButton.disabled = true;
            statusText.textContent = 'Preparing...';
        }
        if (state.isReadyToDownload) {
             statusText.textContent = '3. Ready to download!';
             prepareButton.disabled = false;
             downloadButton.disabled = false;
        }
    }

    // --- MAIN INITIALIZATION ---
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        activeTabId = tabs[0].id;
        activeTabUrl = tabs[0].url;
        const storageKey = `selector_${activeTabId}`;

        // 1. Get the selector for the current tab to update action buttons
        chrome.storage.local.get([storageKey], (result) => {
            updateActionUI({ selector: result[storageKey] });
        });

        // 2. Get the global download logs to render the list
        chrome.storage.local.get({ downloadLogs: [] }, (result) => {
            renderLogs(result.downloadLogs);
        });
    });


    // --- EVENT LISTENERS ---
    
    // NEW: Use event delegation to handle clicks on the dynamically added "View File" buttons
    logsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('open-downloads-btn')) {
            // This opens the chrome://downloads page in a new tab
            chrome.tabs.create({ url: 'chrome://downloads' });
        }
    });

    selectButton.addEventListener('click', () => {
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['element_selector.js'] });
        chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ['selector_styles.css'] });
        window.close();
    });

    clearButton.addEventListener('click', () => {
        const storageKey = `selector_${activeTabId}`;
        chrome.storage.local.remove([storageKey], () => updateActionUI({ selector: null }));
    });

    prepareButton.addEventListener('click', () => {
        updateActionUI({ selector: lastUsedSelector, isPreparing: true });
        chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ['overlay.css'] });
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['autoscroll.js'] });
    });

    downloadButton.addEventListener('click', () => {
        statusText.textContent = 'Extracting...';
        chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['universal_content.js'] });
    });

    saveLogsButton.addEventListener('click', () => {
        statusText.textContent = 'Saving statuses...';
        chrome.storage.local.get({ downloadLogs: [] }, (result) => {
            let logs = result.downloadLogs;
            const logEntries = document.querySelectorAll('.log-entry');
            let changesMade = false;

            logEntries.forEach(entry => {
                const logId = parseInt(entry.dataset.logId, 10);
                const selectedStatus = entry.querySelector('input[type="radio"]:checked').value;
                const logToUpdate = logs.find(l => l.id === logId);

                if (logToUpdate && logToUpdate.status !== selectedStatus) {
                    logToUpdate.status = selectedStatus;
                    changesMade = true;
                }
            });

            if (changesMade) {
                chrome.storage.local.set({ downloadLogs: logs }, () => {
                    statusText.textContent = 'Log statuses saved!';
                });
            } else {
                statusText.textContent = 'No changes to save.';
            }
        });
    });
    
    clearLogsButton.addEventListener('click', () => {
        if (window.confirm("Are you sure you want to delete all logs? This cannot be undone.")) {
            chrome.storage.local.remove('downloadLogs', () => {
                renderLogs([]);
                statusText.textContent = 'All logs have been cleared.';
                console.log('All download logs cleared.');
            });
        }
    });

    // --- MESSAGE LISTENER FROM CONTENT SCRIPTS ---
    chrome.runtime.onMessage.addListener((message, sender) => {
        if (sender.tab && sender.tab.id === activeTabId) {
            if (message.action === "elementSelected") {
                const storageKey = `selector_${activeTabId}`;
                chrome.storage.local.get([storageKey], (result) => updateActionUI({ selector: result[storageKey] }));
            }
            if (message.action === "scrollingComplete") {
                updateActionUI({ selector: lastUsedSelector, isReadyToDownload: true });
            }
            if (message.action === "sendChatData" && message.data && message.data.length > 0) {
                const timestamp = Date.now();
                const hostname = new URL(activeTabUrl).hostname;
                const newLog = {
                    id: timestamp,
                    filename: `conversation-${timestamp}.json`,
                    hostname: hostname,
                    selector: lastUsedSelector,
                    status: 'pending_review'
                };

                // Add the new log to storage
                chrome.storage.local.get({ downloadLogs: [] }, (result) => {
                    const updatedLogs = [...result.downloadLogs, newLog];
                    chrome.storage.local.set({ downloadLogs: updatedLogs }, () => {
                        renderLogs(updatedLogs);
                    });
                });

                // Trigger the download
                const chatJson = JSON.stringify(message.data, null, 2);
                const blob = new Blob([chatJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                chrome.downloads.download({ url: url, filename: newLog.filename }, () => {
                    URL.revokeObjectURL(url);
                    statusText.textContent = 'Download complete!';
                });
            } else if (message.action === "sendChatData") {
                statusText.textContent = 'Extraction failed. No chat found.';
            }
        }
    });
});