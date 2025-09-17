document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('proxyForm');
    const executeBtn = document.getElementById('executeBtn');
    const extractBtn = document.getElementById('extractBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const output = document.getElementById('output');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');

    // Load saved data
    loadSavedData();

    // Password toggle functionality
    passwordToggle.addEventListener('click', function() {
        togglePasswordVisibility();
    });

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
            
            if (!tab || !tab.id) {
                throw new Error('No active tab found');
            }

            // Check if we can access the tab
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('edge://') || tab.url.startsWith('about:') || 
                tab.url.startsWith('moz-extension://')) {
                throw new Error('Cannot access browser internal pages');
            }

            console.log('Attempting to extract from tab:', tab.url);
            
            // First, try to inject the content script if it's not already injected
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (injectionError) {
                console.log('Content script may already be injected:', injectionError.message);
                // This is okay, the script might already be injected
            }

            // Wait a moment for the script to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Execute content script to extract fields
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'extractFields'
            });

            console.log('Content script response:', response);

            if (response && response.success) {
                const { serverIp, password, proxyIpPort } = response.data;
                
                console.log('Extracted data:', { 
                    serverIp, 
                    password: password ? '***' : null, 
                    proxyIpPort 
                });
                
                if (serverIp) document.getElementById('serverIp').value = serverIp;
                if (password) document.getElementById('password').value = password;
                if (proxyIpPort) document.getElementById('proxyIpPort').value = proxyIpPort;

                saveData();
                
                const extractedCount = [serverIp, password, proxyIpPort].filter(Boolean).length;
                if (extractedCount > 0) {
                    showStatus(`Extracted ${extractedCount} field(s) from page`, 'success');
                } else {
                    showStatus('No data found in the expected fields', 'error');
                }
            } else {
                const errorMsg = response?.error || 'No suitable fields found on this page';
                showStatus(errorMsg, 'error');
                console.log('Extraction failed:', errorMsg);
            }
        } catch (error) {
            console.error('Extract error:', error);
            let errorMessage = 'Could not extract fields from this page';
            
            if (error.message.includes('chrome://')) {
                errorMessage = 'Cannot extract from browser internal pages';
            } else if (error.message.includes('Receiving end does not exist')) {
                errorMessage = 'Page needs to be refreshed. Please reload and try again.';
            } else if (error.message.includes('No active tab')) {
                errorMessage = 'No active tab found';
            } else if (error.message.includes('Cannot access')) {
                errorMessage = error.message;
            }
            
            showStatus(errorMessage, 'error');
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

    function togglePasswordVisibility() {
        const toggleIcon = passwordToggle.querySelector('.toggle-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.textContent = '🙈'; // Hide eye
            passwordToggle.title = 'Hide password';
        } else {
            passwordInput.type = 'password';
            toggleIcon.textContent = '👁️'; // Show eye
            passwordToggle.title = 'Show password';
        }
    }
});
