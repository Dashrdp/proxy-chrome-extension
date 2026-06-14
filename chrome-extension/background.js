importScripts('config.js');

const API_UNREACHABLE_ERROR = {
    errorCode: 'API_UNREACHABLE',
    errorTitle: 'API server not reachable',
    errorDetail: 'The extension could not reach the configured API server.',
    recommendation: 'Verify the API URL in extension Options and ensure the API is online.',
    checks: []
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeScript') {
        const serverIp = message.data.serverIp;
        chrome.storage.session.set({ jobInProgress: true });

        executeRemoteProxyScript(message.data, (progress) => {
            chrome.storage.session.set({ jobProgress: progress });
            chrome.runtime.sendMessage({
                action: 'progressUpdate',
                progress: progress
            }).catch(() => {});
        })
            .then(result => {
                completeExecution(true, result, null, serverIp);
                sendResponse({ success: true, result: result });
            })
            .catch(error => {
                const structured = error.structured || null;
                completeExecution(false, null, error.message, serverIp, structured);
                sendResponse({
                    success: false,
                    error: error.message,
                    ...(structured || {})
                });
            });
        return true;
    } else if (message.action === 'preflightCheck') {
        runPreflightCheck(message.data)
            .then(result => sendResponse(result))
            .catch(error => {
                const structured = error.structured || buildApiUnreachableError('');
                sendResponse({ success: false, ...structured });
            });
        return true;
    } else if (message.action === 'healthCheck') {
        checkAPIHealth()
            .then(result => {
                sendResponse({ success: result.success, data: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    } else if (message.action === 'dataAvailable') {
        handleDataAvailable(message.data);
        sendResponse({ success: true });
        return true;
    } else if (message.action === 'getJobState') {
        chrome.storage.session.get(['jobInProgress', 'lastExecution', 'jobProgress', 'pendingExtraction'])
            .then(state => sendResponse(state));
        return true;
    } else if (message.action === 'clearBadge') {
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
        return true;
    }
});

function handleDataAvailable(data) {
    if (!data || (!data.serverIp && !data.password && !data.proxyIpPort)) {
        return;
    }

    chrome.storage.session.set({ pendingExtraction: data });

    chrome.runtime.sendMessage({
        action: 'dataAvailable',
        data: data
    }).catch(() => {});
}

function parseServerError(responseData, httpStatus) {
    const data = responseData || {};
    return {
        error: data.error || `Server error (${httpStatus})`,
        errorCode: data.error_code || 'UNKNOWN_ERROR',
        errorTitle: data.error_title || 'Operation failed',
        errorDetail: data.error_detail || data.error || '',
        recommendation: data.recommendation || '',
        checks: data.checks || []
    };
}

function createStructuredError(structured) {
    const err = new Error(structured.error);
    err.structured = structured;
    return err;
}

function buildApiUnreachableError(apiUrl) {
    return {
        ...API_UNREACHABLE_ERROR,
        error: `Cannot connect to API at ${apiUrl}`,
        errorDetail: `The extension could not reach ${apiUrl}. Check your network and API URL in Options.`
    };
}

async function parseJsonResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    const textResponse = await response.text();
    throw createStructuredError({
        error: `Server returned invalid response (${response.status})`,
        errorCode: 'API_UNREACHABLE',
        errorTitle: 'Invalid API response',
        errorDetail: textResponse.substring(0, 200),
        recommendation: 'Ensure the API server is running and the URL in Options is correct.',
        checks: []
    });
}

async function runPreflightCheck(data) {
    const apiUrl = await getApiBaseUrl();

    try {
        const response = await fetch(`${apiUrl}/api/preflight-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverIp: data.serverIp,
                password: data.password
            })
        });

        if (response.status === 404) {
            return {
                success: true,
                skipped: true,
                message: 'Pre-flight endpoint not deployed on API — check skipped',
                checks: []
            };
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const textResponse = await response.text();
            if (response.status === 404 || textResponse.toLowerCase().includes('not found')) {
                return {
                    success: true,
                    skipped: true,
                    message: 'Pre-flight endpoint not deployed on API — check skipped',
                    checks: []
                };
            }
            return {
                success: false,
                error: `Server returned invalid response (${response.status})`,
                errorCode: 'API_UNREACHABLE',
                errorTitle: 'Invalid API response',
                errorDetail: textResponse.substring(0, 200),
                recommendation: 'Ensure the API server is running and the URL in Options is correct.',
                checks: []
            };
        }

        const responseData = await response.json();

        if (responseData.success) {
            return {
                success: true,
                checks: responseData.checks || [],
                message: responseData.message
            };
        }

        const structured = parseServerError(responseData, response.status);
        return { success: false, ...structured };
    } catch (error) {
        if (error.structured) {
            return { success: false, ...error.structured };
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { success: false, ...buildApiUnreachableError(apiUrl) };
        }
        throw error;
    }
}

async function completeExecution(success, result, error, serverIp, structured = null) {
    const lastExecution = {
        success,
        result: result || null,
        error: error || null,
        serverIp,
        timestamp: Date.now(),
        ...(structured || {})
    };

    await chrome.storage.session.set({ lastExecution, jobInProgress: false });

    chrome.action.setBadgeText({ text: success ? '✓' : '!' });
    chrome.action.setBadgeBackgroundColor({ color: success ? '#22c55e' : '#ef4444' });

    chrome.notifications.create(`proxy-job-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: success ? 'Proxy configured' : (structured?.errorTitle || 'Configuration failed'),
        message: success
            ? `${serverIp}: configuration complete`
            : (structured?.errorTitle || error || 'Unknown error')
    });
}

async function executeRemoteProxyScript(data, progressCallback) {
    const apiUrl = await getApiBaseUrl();

    try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const utcOffset = -new Date().getTimezoneOffset();

        const dataWithTimezone = {
            ...data,
            browserTimezone: browserTimezone,
            utcOffset: utcOffset
        };

        if (progressCallback) {
            progressCallback({
                step: 1,
                message: 'Preparing request...',
                percentage: 10,
                status: 'preparing',
                details: 'Validating input data and preparing request payload'
            });
            await new Promise(resolve => setTimeout(resolve, 300));

            progressCallback({
                step: 1,
                message: 'Request prepared successfully',
                percentage: 15,
                status: 'ready',
                details: 'All data validated and ready to send'
            });
            await new Promise(resolve => setTimeout(resolve, 200));

            progressCallback({
                step: 2,
                message: 'Connecting to server...',
                percentage: 25,
                status: 'connecting',
                details: `Establishing connection to ${apiUrl}`
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        const result = await executeViaRemoteServer(dataWithTimezone, progressCallback);

        if (progressCallback) {
            progressCallback({
                step: 4,
                message: 'Processing results...',
                percentage: 90,
                status: 'processing',
                details: 'Analyzing server response and formatting results'
            });
            await new Promise(resolve => setTimeout(resolve, 300));

            progressCallback({
                step: 5,
                message: 'Complete!',
                percentage: 100,
                status: 'complete',
                details: 'Script execution completed successfully'
            });
        }

        return result;

    } catch (error) {
        if (progressCallback) {
            progressCallback({
                step: -1,
                message: 'Execution failed',
                percentage: 0,
                status: 'error',
                details: error.message
            });
        }
        if (error.structured) {
            throw error;
        }
        throw createStructuredError({
            error: error.message,
            errorCode: 'EXECUTION_FAILED',
            errorTitle: 'Execution failed',
            errorDetail: error.message,
            recommendation: 'Review the error details and retry.',
            checks: []
        });
    }
}

async function executeViaRemoteServer(data, progressCallback) {
    const apiUrl = await getApiBaseUrl();

    try {
        if (progressCallback) {
            progressCallback({
                step: 2,
                message: 'Sending request to server...',
                percentage: 40,
                status: 'sending',
                details: 'POST request being sent to API endpoint'
            });
        }

        const response = await fetch(`${apiUrl}/api/execute-script`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (progressCallback) {
            progressCallback({
                step: 2,
                message: 'Request sent successfully',
                percentage: 50,
                status: 'sent',
                details: 'Request received by server, waiting for response'
            });
            progressCallback({
                step: 3,
                message: 'Waiting for server response...',
                percentage: 60,
                status: 'waiting',
                details: 'Server is processing the request'
            });
        }

        const responseData = await parseJsonResponse(response);

        if (progressCallback) {
            progressCallback({
                step: 3,
                message: 'Response received',
                percentage: 75,
                status: 'received',
                details: 'Server response received, validating...'
            });
        }

        if (!response.ok || !responseData.success) {
            const structured = parseServerError(responseData, response.status);
            if (progressCallback) {
                progressCallback({
                    step: -1,
                    message: structured.errorTitle,
                    percentage: 0,
                    status: 'error',
                    details: structured.errorDetail
                });
            }
            throw createStructuredError(structured);
        }

        if (progressCallback) {
            progressCallback({
                step: 3,
                message: 'Response validated successfully',
                percentage: 85,
                status: 'validated',
                details: 'Server response is valid and ready for processing'
            });
        }
        return responseData.result;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const structured = buildApiUnreachableError(apiUrl);
            if (progressCallback) {
                progressCallback({
                    step: -1,
                    message: structured.errorTitle,
                    percentage: 0,
                    status: 'error',
                    details: structured.errorDetail
                });
            }
            throw createStructuredError(structured);
        }
        if (progressCallback && !error.structured) {
            progressCallback({
                step: -1,
                message: 'Error occurred',
                percentage: 0,
                status: 'error',
                details: error.message
            });
        }
        throw error;
    }
}

async function checkAPIHealth() {
    const apiUrl = await getApiBaseUrl();

    try {
        const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                status: data.status || 'healthy',
                timestamp: data.timestamp,
                service: data.service
            };
        }

        return {
            success: false,
            error: `Server returned ${response.status}`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Connection failed'
        };
    }
}
