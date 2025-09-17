document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('proxyForm');
    const executeBtn = document.getElementById('executeBtn');
    const extractBtn = document.getElementById('extractBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const output = document.getElementById('output');

    // Load saved data
    loadSavedData();

    // Form submission handler
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        executeScript();
    });

    // Extract button handler
    extractBtn.addEventListener('click', function() {
        extractFieldsFromPage();
    });

    // Save data on input change
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', saveData);
    });

    async function executeScript() {
        const formData = {
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value,
            proxyIpPort: document.getElementById('proxyIpPort').value
        };

        // Validate inputs
        if (!formData.serverIp || !formData.password || !formData.proxyIpPort) {
            showStatus('Please fill in all fields', 'error');
            return;
        }

        // Validate IP format
        if (!isValidIP(formData.serverIp)) {
            showStatus('Please enter a valid IP address', 'error');
            return;
        }

        // Validate proxy format (IP:Port)
        if (!isValidProxyFormat(formData.proxyIpPort)) {
            showStatus('Please enter proxy in format IP:Port', 'error');
            return;
        }

        executeBtn.disabled = true;
        showStatus('Executing script...', 'loading');
        hideResults();

        try {
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'executeScript',
                data: formData
            });

            if (response.success) {
                showStatus('Script executed successfully', 'success');
                showResults(response.result);
            } else {
                showStatus(`Error: ${response.error}`, 'error');
            }
        } catch (error) {
            showStatus(`Connection error: ${error.message}`, 'error');
        } finally {
            executeBtn.disabled = false;
        }
    }

    async function extractFieldsFromPage() {
        extractBtn.disabled = true;
        showStatus('Extracting fields from page...', 'loading');

        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Execute content script to extract fields
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractFields'
            });

            if (response && response.success) {
                const { serverIp, password, proxyIpPort } = response.data;
                
                if (serverIp) document.getElementById('serverIp').value = serverIp;
                if (password) document.getElementById('password').value = password;
                if (proxyIpPort) document.getElementById('proxyIpPort').value = proxyIpPort;

                saveData();
                
                const extractedCount = [serverIp, password, proxyIpPort].filter(Boolean).length;
                showStatus(`Extracted ${extractedCount} field(s) from page`, 'success');
            } else {
                showStatus('No suitable fields found on this page', 'error');
            }
        } catch (error) {
            showStatus('Could not extract fields from this page', 'error');
        } finally {
            extractBtn.disabled = false;
        }
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.classList.remove('hidden');
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                status.classList.add('hidden');
            }, 5000);
        }
    }

    function showResults(result) {
        output.textContent = result;
        results.classList.remove('hidden');
    }

    function hideResults() {
        results.classList.add('hidden');
    }

    function saveData() {
        const data = {
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value,
            proxyIpPort: document.getElementById('proxyIpPort').value
        };
        chrome.storage.local.set(data);
    }

    function loadSavedData() {
        chrome.storage.local.get(['serverIp', 'password', 'proxyIpPort'], function(data) {
            if (data.serverIp) document.getElementById('serverIp').value = data.serverIp;
            if (data.password) document.getElementById('password').value = data.password;
            if (data.proxyIpPort) document.getElementById('proxyIpPort').value = data.proxyIpPort;
        });
    }

    function isValidIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    function isValidProxyFormat(proxy) {
        const proxyRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}$/;
        return proxyRegex.test(proxy);
    }
});
