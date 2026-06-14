document.addEventListener('DOMContentLoaded', async function() {
    const form = document.getElementById('proxyForm');
    const executeBtn = document.getElementById('executeBtn');
    const extractBtn = document.getElementById('extractBtn');
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
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionIcon = connectionStatus.querySelector('.connection-icon');
    const connectionText = connectionStatus.querySelector('.connection-text');
    const statusLogToggle = document.getElementById('statusLogToggle');
    const statusLog = document.getElementById('statusLog');
    const statusLogEntries = document.getElementById('statusLogEntries');
    const logCount = document.getElementById('logCount');
    const clearSessionBtn = document.getElementById('clearSessionBtn');
    const detectionBanner = document.getElementById('detectionBanner');
    const detectionFillBtn = document.getElementById('detectionFillBtn');
    const detectionDismissBtn = document.getElementById('detectionDismissBtn');
    const extractionPanel = document.getElementById('extractionPanel');
    const extractionList = document.getElementById('extractionList');
    const confirmExtractBtn = document.getElementById('confirmExtractBtn');
    const copyResultsBtn = document.getElementById('copyResultsBtn');
    const optionsLink = document.getElementById('optionsLink');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const errorPanel = document.getElementById('errorPanel');
    const errorTitle = document.getElementById('errorTitle');
    const errorCode = document.getElementById('errorCode');
    const errorDetail = document.getElementById('errorDetail');
    const errorRecommendation = document.getElementById('errorRecommendation');
    const errorChecks = document.getElementById('errorChecks');

    let statusLogData = [];
    let isStatusLogOpen = false;
    let pendingExtraction = null;
    let extractionConfirmed = true;
    let extensionSettings = await getExtensionSettings();
    let lastResultText = '';

    chrome.runtime.sendMessage({ action: 'clearBadge' });

    await loadSavedData();
    await restoreJobState();
    await checkPendingExtraction();
    checkAPIHealth();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'progressUpdate') {
            updateProgress(message.progress);
        } else if (message.action === 'dataAvailable') {
            handleDataAvailable(message.data);
        }
    });

    statusLogToggle.addEventListener('click', toggleStatusLog);
    passwordToggle.addEventListener('click', togglePasswordVisibility);
    form.addEventListener('submit', (e) => { e.preventDefault(); executeScript(); });
    extractBtn.addEventListener('click', extractFieldsFromPage);
    clearSessionBtn.addEventListener('click', clearSession);
    confirmExtractBtn.addEventListener('click', confirmExtraction);
    copyResultsBtn.addEventListener('click', copyResults);
    testConnectionBtn.addEventListener('click', testConnection);
    optionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    detectionFillBtn.addEventListener('click', () => {
        if (pendingExtraction) {
            applyExtractedData(pendingExtraction, { showPanel: true });
            dismissDetectionBanner();
        }
    });

    detectionBanner.addEventListener('click', (e) => {
        if (e.target === detectionDismissBtn || e.target.closest('#detectionDismissBtn')) return;
        if (pendingExtraction) {
            applyExtractedData(pendingExtraction, { showPanel: true });
            dismissDetectionBanner();
        }
    });

    detectionDismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissDetectionBanner();
    });

    form.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', saveData);
    });

    async function executeScript() {
        if (!extractionConfirmed) {
            showStatus('Review extracted fields and click "Looks good" first', 'error');
            return;
        }

        const formData = {
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value,
            proxyIpPort: document.getElementById('proxyIpPort').value
        };

        if (!formData.serverIp || !formData.password || !formData.proxyIpPort) {
            showStatus('Please fill in all fields', 'error');
            return;
        }
        if (!isValidIP(formData.serverIp)) {
            showStatus('Please enter a valid IP address', 'error');
            return;
        }
        if (!isValidProxyFormat(formData.proxyIpPort)) {
            showStatus('Please enter proxy in format IP:Port', 'error');
            return;
        }

        executeBtn.disabled = true;
        testConnectionBtn.disabled = true;
        hideStatus();
        hideResults();
        hideErrorPanel();
        showProgress();

        try {
            updateProgress({
                step: 1,
                message: 'Running pre-flight checks...',
                percentage: 5,
                status: 'preparing',
                details: 'Checking WinRM port and credentials before configuring proxy'
            });

            const preflight = await chrome.runtime.sendMessage({
                action: 'preflightCheck',
                data: {
                    serverIp: formData.serverIp,
                    password: formData.password
                }
            });

            if (!preflight || (!preflight.success && !preflight.skipped)) {
                hideProgress();
                showDetailedError(preflight || {
                    errorTitle: 'Pre-flight check failed',
                    errorDetail: 'Could not verify server connectivity.',
                    errorCode: 'UNKNOWN_ERROR'
                });
                return;
            }

            if (preflight.skipped) {
                updateProgress({
                    step: 1,
                    message: 'Pre-flight skipped',
                    percentage: 8,
                    status: 'preparing',
                    details: 'API not updated yet — proceeding without connectivity check'
                });
            } else {
                updateProgress({
                    step: 1,
                    message: 'Pre-flight passed',
                    percentage: 10,
                    status: 'ready',
                    details: 'Server reachable and credentials valid — starting configuration'
                });
            }

            const response = await chrome.runtime.sendMessage({
                action: 'executeScript',
                data: formData
            });

            if (response.success) {
                hideProgress();
                hideErrorPanel();
                showStatus('Proxy configured successfully', 'success');
                showResults(response.result);
            } else {
                hideProgress();
                showDetailedError(response);
            }
        } catch (error) {
            hideProgress();
            showDetailedError({
                errorTitle: 'Connection error',
                errorDetail: error.message,
                errorCode: 'API_UNREACHABLE',
                recommendation: 'Check the API URL in Options and reload the extension.'
            });
        } finally {
            executeBtn.disabled = false;
            testConnectionBtn.disabled = false;
            updateExecuteButtonState();
        }
    }

    async function testConnection() {
        const serverIp = document.getElementById('serverIp').value;
        const password = document.getElementById('password').value;

        if (!serverIp || !password) {
            showStatus('Enter server IP and password to test connection', 'error');
            return;
        }
        if (!isValidIP(serverIp)) {
            showStatus('Please enter a valid IP address', 'error');
            return;
        }

        testConnectionBtn.disabled = true;
        hideErrorPanel();
        hideResults();
        showStatus('Testing connection...', 'loading');

        try {
            const result = await chrome.runtime.sendMessage({
                action: 'preflightCheck',
                data: { serverIp, password }
            });

            if (result && result.skipped) {
                showStatus('Pre-flight not deployed on API — deploy server update to enable', 'loading');
                showDetailedError({
                    errorTitle: 'Pre-flight not available yet',
                    errorDetail: 'The API at your configured URL does not have /api/preflight-check. The live server needs the latest deploy.',
                    errorCode: 'PREFLIGHT_NOT_DEPLOYED',
                    recommendation: 'Deploy the updated server (app.py + winrm_diagnostics.py), then retry Test connection.',
                    checks: []
                });
            } else if (result && result.success) {
                showStatus('Connection OK — server reachable, credentials valid', 'success');
                showDetailedError({
                    errorTitle: 'Pre-flight check passed',
                    errorDetail: result.message || 'Server is ready for proxy configuration.',
                    errorCode: 'OK',
                    recommendation: 'You can now click Configure Proxy.',
                    checks: result.checks || []
                }, { successMode: true });
            } else {
                showDetailedError(result);
                showStatus('Connection test failed', 'error');
            }
        } catch (error) {
            showDetailedError({
                errorTitle: 'Connection test failed',
                errorDetail: error.message,
                errorCode: 'API_UNREACHABLE'
            });
            showStatus('Could not reach API server', 'error');
        } finally {
            testConnectionBtn.disabled = false;
        }
    }

    function showDetailedError(errorInfo, options = {}) {
        if (!errorInfo) return;

        const isSuccess = options.successMode === true;
        errorPanel.classList.toggle('error-panel-success', isSuccess);

        errorTitle.textContent = errorInfo.errorTitle || errorInfo.error || 'Error';
        errorCode.textContent = errorInfo.errorCode || '';
        errorDetail.textContent = errorInfo.errorDetail || errorInfo.error || 'An unknown error occurred.';
        errorRecommendation.textContent = errorInfo.recommendation || '';
        errorRecommendation.classList.toggle('hidden', !errorInfo.recommendation);

        errorChecks.innerHTML = '';
        const checks = errorInfo.checks || [];
        checks.forEach((check) => {
            const li = document.createElement('li');
            li.className = `error-check-item ${check.ok ? 'ok' : 'fail'}`;
            li.innerHTML = `
                <span class="error-check-icon">${check.ok ? '✓' : '✗'}</span>
                <span class="error-check-label">${check.label || check.name}</span>
                <span class="error-check-message">${check.message}</span>
            `;
            errorChecks.appendChild(li);
        });

        errorPanel.classList.remove('hidden');
    }

    function hideErrorPanel() {
        errorPanel.classList.add('hidden');
        errorPanel.classList.remove('error-panel-success');
        errorChecks.innerHTML = '';
    }

    async function extractFieldsFromPage() {
        extractBtn.disabled = true;
        showStatus('Extracting fields from page...', 'loading');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) throw new Error('No active tab found');

            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
                tab.url.startsWith('edge://') || tab.url.startsWith('about:') ||
                tab.url.startsWith('moz-extension://')) {
                throw new Error('Cannot access browser internal pages');
            }

            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['config.js', 'content.js']
                });
            } catch (injectionError) {
                console.log('Content script may already be injected:', injectionError.message);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractFields' });

            if (response && response.success) {
                const extractedFields = applyExtractedData(response.data, { showPanel: true });
                if (extractedFields.length > 0) {
                    showStatus(`Extracted ${extractedFields.length} field(s) — review before configuring`, 'success');
                } else {
                    showStatus('No data found. Check console for debugging info.', 'error');
                }
            } else {
                const errorMsg = response?.error || 'No suitable fields found on this page';
                let userFriendlyMsg = errorMsg;
                if (errorMsg.includes('No suitable fields')) {
                    userFriendlyMsg = 'No proxy fields detected. Try filling them manually or check console for details.';
                } else if (errorMsg.includes('Receiving end does not exist')) {
                    userFriendlyMsg = 'Page needs to be refreshed. Please reload the page and try again.';
                }
                showStatus(userFriendlyMsg, 'error');
            }
        } catch (error) {
            console.error('Extract error:', error);
            let errorMessage = 'Could not extract fields from this page';
            if (error.message.includes('Receiving end does not exist')) {
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

    function applyExtractedData(data, options = {}) {
        const { serverIp, password, proxyIpPort, sources } = data;
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

        if (options.showPanel && extractedFields.length > 0) {
            showExtractionPanel(data);
        }

        return extractedFields;
    }

    function showExtractionPanel(data) {
        extractionList.innerHTML = '';
        const fieldDefs = [
            { key: 'serverIp', label: 'Server IP' },
            { key: 'password', label: 'Password' },
            { key: 'proxyIpPort', label: 'Proxy IP:Port' }
        ];

        fieldDefs.forEach(({ key, label }) => {
            if (!data[key]) return;
            const li = document.createElement('li');
            li.className = 'extraction-item';
            const displayValue = key === 'password' ? '••••••••' : data[key];
            const source = data.sources?.[key] || 'unknown';
            li.innerHTML = `
                <span class="extraction-field">${label}</span>
                <span class="extraction-value">${displayValue}</span>
                <span class="extraction-source">${source}</span>
            `;
            extractionList.appendChild(li);
        });

        extractionConfirmed = false;
        extractionPanel.classList.remove('hidden');
        updateExecuteButtonState();
    }

    function confirmExtraction() {
        extractionConfirmed = true;
        extractionPanel.classList.add('hidden');
        updateExecuteButtonState();
        showStatus('Fields confirmed — ready to configure', 'success');
    }

    function updateExecuteButtonState() {
        if (!extractionConfirmed) {
            executeBtn.disabled = true;
            executeBtn.title = 'Confirm extracted fields first';
        } else {
            executeBtn.disabled = false;
            executeBtn.title = '';
        }
    }

    async function handleDataAvailable(data) {
        if (!data || (!data.serverIp && !data.password && !data.proxyIpPort)) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const onWhmcs = tab && isWhmcsUrl(tab.url);

        pendingExtraction = data;

        if (onWhmcs) {
            applyExtractedData(data, { showPanel: true });
            dismissDetectionBanner();
        } else {
            showDetectionBanner(data);
        }
    }

    function showDetectionBanner(data) {
        const fields = [];
        if (data.serverIp) fields.push('Server IP');
        if (data.password) fields.push('Password');
        if (data.proxyIpPort) fields.push('Proxy IP:Port');
        detectionBanner.querySelector('.detection-label').textContent =
            `Fields detected (${fields.join(', ')}) — click to fill`;
        detectionBanner.classList.remove('hidden');
    }

    function dismissDetectionBanner() {
        detectionBanner.classList.add('hidden');
        pendingExtraction = null;
        chrome.storage.session.remove('pendingExtraction');
    }

    async function checkPendingExtraction() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const { pendingExtraction: stored } = await chrome.storage.session.get('pendingExtraction');
        if (stored) {
            await handleDataAvailable(stored);
        }
    }

    async function restoreJobState() {
        try {
            const state = await chrome.runtime.sendMessage({ action: 'getJobState' });

            if (state?.jobInProgress) {
                showProgress();
                if (state.jobProgress) {
                    updateProgress(state.jobProgress);
                }
                showStatus('Job still running…', 'loading');
            }

            if (state?.lastExecution) {
                const { success, result, error, timestamp } = state.lastExecution;
                const age = Date.now() - timestamp;
                if (age < 3600000) {
                    if (success && result) {
                        showResults(result);
                        showStatus('Last run completed successfully', 'success');
                    } else if (!success && error) {
                        showDetailedError({
                            errorTitle: state.lastExecution.errorTitle || 'Last run failed',
                            errorDetail: state.lastExecution.errorDetail || error,
                            errorCode: state.lastExecution.errorCode || 'UNKNOWN_ERROR',
                            recommendation: state.lastExecution.recommendation || '',
                            checks: state.lastExecution.checks || []
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Could not restore job state:', error);
        }
    }

    async function copyResults() {
        const text = lastResultText || output.textContent;
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            copyResultsBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyResultsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
            }, 1500);
        } catch {
            showStatus('Could not copy to clipboard', 'error');
        }
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.classList.remove('hidden');
        if (type === 'success') {
            setTimeout(() => status.classList.add('hidden'), 5000);
        }
    }

    function showResults(result) {
        if (result && result.trim()) {
            output.textContent = result;
            lastResultText = result;
        } else {
            output.innerHTML = '<span class="proxy-active-text">Proxy Active</span>';
            lastResultText = 'Proxy Active';
        }
        results.classList.remove('hidden');
    }

    function hideResults() { results.classList.add('hidden'); }
    function hideStatus() { status.classList.add('hidden'); }

    function showProgress() {
        progressContainer.classList.remove('hidden');
        resetProgress();
    }

    function hideProgress() { progressContainer.classList.add('hidden'); }

    function resetProgress() {
        progressMessage.textContent = 'Initializing...';
        progressPercentage.textContent = '0%';
        progressFill.style.width = '0%';
        document.querySelectorAll('.progress-step').forEach(step => {
            step.classList.remove('active', 'completed');
        });
        connectionStatus.className = 'connection-status';
        connectionIcon.textContent = '●';
        connectionText.textContent = 'Connecting...';
        statusLogData = [];
        statusLogEntries.innerHTML = '';
        updateLogCount();
        isStatusLogOpen = false;
        statusLog.classList.add('hidden');
        statusLogToggle.querySelector('.toggle-icon').textContent = '▼';
    }

    function updateProgress(progress) {
        const { step, message, percentage, status: progressStatus, details } = progress;
        progressMessage.textContent = message;
        progressPercentage.textContent = `${percentage}%`;
        progressFill.style.width = `${percentage}%`;
        updateConnectionStatus(progressStatus, message);
        addStatusLogEntry(message, progressStatus, details);

        const steps = document.querySelectorAll('.progress-step');
        if (step === -1) {
            steps.forEach(s => s.classList.remove('active', 'completed'));
            if (steps[0]) steps[0].classList.add('active');
            progressFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
            connectionStatus.className = 'connection-status error';
        } else {
            progressFill.style.background = 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)';
            steps.forEach((stepElement, index) => {
                const stepNumber = index + 1;
                if (stepNumber < step) {
                    stepElement.classList.remove('active');
                    stepElement.classList.add('completed');
                } else if (stepNumber === step) {
                    stepElement.classList.remove('completed');
                    stepElement.classList.add('active');
                } else {
                    stepElement.classList.remove('active', 'completed');
                }
            });
        }
    }

    function updateConnectionStatus(statusType, message) {
        if (!statusType) return;
        connectionStatus.className = `connection-status ${statusType}`;
        const statusConfig = {
            'preparing': { icon: '●', text: 'Preparing...', color: '#fbbf24' },
            'ready': { icon: '✓', text: 'Ready', color: '#22c55e' },
            'connecting': { icon: '⟳', text: 'Connecting...', color: '#3b82f6' },
            'sending': { icon: '↑', text: 'Sending...', color: '#3b82f6' },
            'sent': { icon: '✓', text: 'Sent', color: '#22c55e' },
            'waiting': { icon: '⏳', text: 'Waiting...', color: '#fbbf24' },
            'received': { icon: '↓', text: 'Received', color: '#22c55e' },
            'validated': { icon: '✓', text: 'Validated', color: '#22c55e' },
            'processing': { icon: '⟳', text: 'Processing...', color: '#3b82f6' },
            'complete': { icon: '✓', text: 'Complete', color: '#22c55e' },
            'error': { icon: '✗', text: 'Error', color: '#ef4444' }
        };
        const config = statusConfig[statusType] || { icon: '●', text: message, color: '#ffffff' };
        connectionIcon.textContent = config.icon;
        connectionText.textContent = config.text;
        connectionIcon.style.color = config.color;
        connectionText.style.color = config.color;
    }

    function addStatusLogEntry(message, statusType, details) {
        const timestamp = new Date().toLocaleTimeString();
        statusLogData.push({ timestamp, message, status: statusType || 'info', details: details || '' });
        updateLogCount();
        const entryElement = document.createElement('div');
        entryElement.className = `status-log-entry ${statusType || 'info'}`;
        entryElement.innerHTML = `
            <div class="log-entry-header">
                <span class="log-icon" style="color: ${getStatusColor(statusType)}">${getStatusIcon(statusType)}</span>
                <span class="log-message">${message}</span>
                <span class="log-timestamp">${timestamp}</span>
            </div>
            ${details ? `<div class="log-details">${details}</div>` : ''}
        `;
        statusLogEntries.appendChild(entryElement);
        if (isStatusLogOpen) {
            statusLogEntries.scrollTop = statusLogEntries.scrollHeight;
        }
    }

    function getStatusIcon(s) {
        const icons = { 'preparing': '⚙', 'ready': '✓', 'connecting': '⟳', 'sending': '↑', 'sent': '✓', 'waiting': '⏳', 'received': '↓', 'validated': '✓', 'processing': '⟳', 'complete': '✓', 'error': '✗', 'info': '●' };
        return icons[s] || '●';
    }

    function getStatusColor(s) {
        const colors = { 'preparing': '#fbbf24', 'ready': '#22c55e', 'connecting': '#3b82f6', 'sending': '#3b82f6', 'sent': '#22c55e', 'waiting': '#fbbf24', 'received': '#22c55e', 'validated': '#22c55e', 'processing': '#3b82f6', 'complete': '#22c55e', 'error': '#ef4444', 'info': '#ffffff' };
        return colors[s] || '#ffffff';
    }

    function updateLogCount() { logCount.textContent = statusLogData.length; }

    function toggleStatusLog() {
        isStatusLogOpen = !isStatusLogOpen;
        statusLog.classList.toggle('hidden', !isStatusLogOpen);
        statusLogToggle.querySelector('.toggle-icon').textContent = isStatusLogOpen ? '▲' : '▼';
        if (isStatusLogOpen) {
            setTimeout(() => { statusLogEntries.scrollTop = statusLogEntries.scrollHeight; }, 100);
        }
    }

    async function saveData() {
        if (!extensionSettings.rememberFields) return;
        await chrome.storage.local.set({
            serverIp: document.getElementById('serverIp').value,
            password: document.getElementById('password').value,
            proxyIpPort: document.getElementById('proxyIpPort').value
        });
    }

    async function clearSession() {
        await chrome.storage.local.clear();
        await chrome.storage.session.remove(['pendingExtraction', 'lastExecution']);
        document.getElementById('serverIp').value = '';
        document.getElementById('password').value = '';
        document.getElementById('proxyIpPort').value = '';
        hideResults();
        hideStatus();
        hideErrorPanel();
        dismissDetectionBanner();
        extractionPanel.classList.add('hidden');
        extractionConfirmed = true;
        updateExecuteButtonState();
        showStatus('Session cleared', 'success');
        setTimeout(() => hideStatus(), 2000);
    }

    async function loadSavedData() {
        if (!extensionSettings.rememberFields) return;
        const data = await chrome.storage.local.get(['serverIp', 'password', 'proxyIpPort']);
        if (data.serverIp) document.getElementById('serverIp').value = data.serverIp;
        if (data.password) document.getElementById('password').value = data.password;
        if (data.proxyIpPort) document.getElementById('proxyIpPort').value = data.proxyIpPort;
    }

    function isValidIP(ip) {
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
    }

    function isValidProxyFormat(proxy) {
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}$/.test(proxy);
    }

    function togglePasswordVisibility() {
        const eyeOn = passwordToggle.querySelector('.icon-eye');
        const eyeOff = passwordToggle.querySelector('.icon-eye-off');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeOn.classList.add('hidden');
            eyeOff.classList.remove('hidden');
            passwordToggle.title = 'Hide password';
        } else {
            passwordInput.type = 'password';
            eyeOn.classList.remove('hidden');
            eyeOff.classList.add('hidden');
            passwordToggle.title = 'Show password';
        }
    }

    async function checkAPIHealth() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'healthCheck' });
            if (response && response.success) {
                updateHealthStatus('healthy', 'API Online');
            } else {
                const detail = response?.error || response?.data?.error || '';
                updateHealthStatus('unhealthy', detail ? `API Offline` : 'API Offline');
                if (detail) console.error('Health check failed:', detail);
            }
        } catch (error) {
            console.error('Health check error:', error);
            updateHealthStatus('unhealthy', 'API Offline');
        }
    }

    function updateHealthStatus(s, text) {
        healthStatus.className = `health-status ${s}`;
        healthText.textContent = text;
    }

    setInterval(checkAPIHealth, 30000);
});
