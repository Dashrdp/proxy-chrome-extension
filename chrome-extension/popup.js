document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('proxyForm');
    const executeBtn = document.getElementById('executeBtn');
    const extractBtn = document.getElementById('extractBtn');
    const rdpExtendBtn = document.getElementById('rdpExtendBtn');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const output = document.getElementById('output');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');
    const healthStatus = document.getElementById('healthStatus');
    const healthText = document.getElementById('healthText');
    const progressContainer = document.getElementById('progressContainer');
    const progressMessage = document.getElementById('progressMessage');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressFill = document.getElementById('progressFill');

    // Clear old data and start fresh
    clearOldData();
    checkAPIHealth();
    
    // Listen for progress updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'progressUpdate') {
            updateProgress(message.progress);
        }
    });

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

    // RDP Extension button handler
    rdpExtendBtn.addEventListener('click', function() {
        executeRdpExtension();
    });

    // Removed verify access button handler

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
        hideStatus();
        hideResults();
        showProgress();

        try {
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'executeScript',
                data: formData
            });

            if (response.success) {
                hideProgress();
                showStatus('Script executed successfully', 'success');
                showResults(response.result);
            } else {
                hideProgress();
                showStatus(`Error: ${response.error}`, 'error');
            }
        } catch (error) {
            hideProgress();
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
                
                // Update fields and track what was extracted
                const extractedFields = [];
                if (serverIp) {
                    document.getElementById('serverIp').value = serverIp;
                    extractedFields.push('Server IP');
                }
                if (password) {
                    document.getElementById('password').value = password;
                    extractedFields.push('Password');
                }
                if (proxyIpPort) {
                    document.getElementById('proxyIpPort').value = proxyIpPort;
                    extractedFields.push('Proxy IP:Port');
                }

                saveData();
                
                if (extractedFields.length > 0) {
                    showStatus(`Extracted: ${extractedFields.join(', ')}`, 'success');
                } else {
                    showStatus('No data found. Check console for debugging info.', 'error');
                }
            } else {
                const errorMsg = response?.error || 'No suitable fields found on this page';
                
                // Provide more helpful error messages
                let userFriendlyMsg = errorMsg;
                if (errorMsg.includes('No suitable fields')) {
                    userFriendlyMsg = 'No proxy fields detected. Try filling them manually or check console for details.';
                } else if (errorMsg.includes('chrome://')) {
                    userFriendlyMsg = 'Cannot extract from browser internal pages. Navigate to a regular webpage.';
                } else if (errorMsg.includes('Receiving end does not exist')) {
                    userFriendlyMsg = 'Page needs to be refreshed. Please reload the page and try again.';
                }
                
                showStatus(userFriendlyMsg, 'error');
                console.log('Extraction failed:', errorMsg);
                console.log('Check the browser console on the target page for detailed debugging information.');
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
        if (result && result.trim()) {
            // Show the actual result content
            output.textContent = result;
        } else {
            // Fallback to green "Proxy Active" if no result
            output.innerHTML = '<span class="proxy-active-text">Proxy Active</span>';
        }
        results.classList.remove('hidden');
    }

    function hideResults() {
        results.classList.add('hidden');
    }

    function hideStatus() {
        status.classList.add('hidden');
    }
    
    function showProgress() {
        progressContainer.classList.remove('hidden');
        resetProgress();
    }
    
    function hideProgress() {
        progressContainer.classList.add('hidden');
    }
    
    function resetProgress() {
        progressMessage.textContent = 'Initializing...';
        progressPercentage.textContent = '0%';
        progressFill.style.width = '0%';
        
        // Reset all steps
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
    }
    
    function updateProgress(progress) {
        const { step, message, percentage } = progress;
        
        // Update progress bar
        progressMessage.textContent = message;
        progressPercentage.textContent = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        
        // Update step indicators
        const steps = document.querySelectorAll('.progress-step');
        
        if (step === -1) {
            // Error state
            steps.forEach(s => s.classList.remove('active', 'completed'));
            if (steps[0]) steps[0].classList.add('active');
            progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
        } else {
            // Normal progress
            progressFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)';
            
            steps.forEach((stepElement, index) => {
                const stepNumber = index + 1;
                
                if (stepNumber < step) {
                    // Completed steps
                    stepElement.classList.remove('active');
                    stepElement.classList.add('completed');
                } else if (stepNumber === step) {
                    // Current step
                    stepElement.classList.remove('completed');
                    stepElement.classList.add('active');
                } else {
                    // Future steps
                    stepElement.classList.remove('active', 'completed');
                }
            });
        }
    }

    function saveData() {
        const data = {
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value,
            proxyIpPort: document.getElementById('proxyIpPort').value
        };
        chrome.storage.local.set(data);
    }

    function clearOldData() {
        // Clear Chrome storage
        chrome.storage.local.clear(function() {
            console.log('Previous extension data cleared');
        });
        
        // Clear all form fields
        document.getElementById('serverIp').value = '';
        document.getElementById('password').value = '';
        document.getElementById('proxyIpPort').value = '';
        
        // Hide any previous results or status messages
        hideResults();
        hideStatus();
        
        // Show a brief indicator that data was cleared
        showStatus('Extension reset - Ready for new data extraction', 'success');
        setTimeout(() => {
            hideStatus();
        }, 2000);
        
        console.log('Extension opened - all old data cleared, ready for fresh extraction');
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

    async function checkAPIHealth() {
        try {
            // Get the server URL from background script
            const response = await chrome.runtime.sendMessage({
                action: 'healthCheck'
            });

            if (response && response.success) {
                updateHealthStatus('healthy', 'API Online');
            } else {
                updateHealthStatus('unhealthy', 'API Offline');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            updateHealthStatus('unhealthy', 'API Offline');
        }
    }

    function updateHealthStatus(status, text) {
        healthStatus.className = `health-status ${status}`;
        healthText.textContent = text;
    }

    // Check health every 30 seconds
    setInterval(checkAPIHealth, 30000);

    async function executeRdpExtension() {
        const formData = {
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value
        };

        // Validate inputs
        if (!formData.serverIp || !formData.password) {
            showStatus('Please fill in Server IP and Password', 'error');
            return;
        }

        // Validate IP format
        if (!isValidIP(formData.serverIp)) {
            showStatus('Please enter a valid IP address', 'error');
            return;
        }

        rdpExtendBtn.disabled = true;
        hideStatus();
        hideResults();
        showProgress();

        try {
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'extendRdp',
                data: formData
            });

            if (response.success) {
                hideProgress();
                showStatus('RDP extension completed successfully', 'success');
                showResults(response.result);
            } else {
                hideProgress();
                showStatus(`Error: ${response.error}`, 'error');
            }
        } catch (error) {
            hideProgress();
            showStatus(`Connection error: ${error.message}`, 'error');
        } finally {
            rdpExtendBtn.disabled = false;
        }
    }
});
