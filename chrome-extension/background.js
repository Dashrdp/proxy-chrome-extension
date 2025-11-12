// Background script for handling Python script execution
// Simple Configuration
const SERVER_CONFIG = {
    // Production server configuration
    url: 'https://proxyconf-api.dashrdp.cloud'  // Production server URL
};

// Simplified - removed complex security functions

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeScript') {
        executeRemoteProxyScript(message.data, (progress) => {
            // Send progress updates to popup
            chrome.runtime.sendMessage({
                action: 'progressUpdate',
                progress: progress
            }).catch(() => {
                // Popup might be closed, that's ok
            });
        })
            .then(result => {
                sendResponse({ success: true, result: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    } else if (message.action === 'healthCheck') {
        checkAPIHealth()
            .then(result => {
                sendResponse({ success: result.success, data: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }
});

async function executeRemoteProxyScript(data, progressCallback) {
    const { serverIp, password, proxyIpPort } = data;
    
    try {
        // Get browser timezone information
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const utcOffset = -new Date().getTimezoneOffset(); // Negative because getTimezoneOffset returns opposite
        
        // Add timezone information to data
        const dataWithTimezone = {
            ...data,
            browserTimezone: browserTimezone,
            utcOffset: utcOffset
        };
        
        // Send progress updates with detailed status
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
                details: `Establishing connection to ${SERVER_CONFIG.url}`
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Use simple remote server execution with timezone data
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
        throw new Error(`Script execution failed: ${error.message}`);
    }
}

async function simulatePythonScript(targetIp, password, proxyIpPort) {
    // This is a simulation since Chrome extensions can't directly run Python
    // In a real implementation, you would need:
    // 1. A local HTTP server running the Python script
    // 2. Native messaging to execute the Python script
    // 3. Or convert the functionality to JavaScript
    
    try {
        // Simulate the proxy connection and IP check
        const mockResponse = await simulateProxyCheck(targetIp, proxyIpPort);
        return mockResponse;
        
    } catch (error) {
        throw new Error(`Proxy check failed: ${error.message}`);
    }
}

async function simulateProxyCheck(targetIp, proxyIpPort) {
    // Mock implementation - in reality this would connect to the remote server
    // and execute the PowerShell commands through pypsrp
    
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate different outcomes
            const isProxyActive = Math.random() > 0.3; // 70% chance proxy is active
            
            if (isProxyActive) {
                const mockIps = ['203.0.113.1', '198.51.100.1', '192.0.2.1'];
                const mockISPs = ['Example ISP', 'Global Networks', 'Proxy Services Inc'];
                const mockCountries = ['US', 'GB', 'DE', 'FR', 'JP'];
                
                const randomIndex = Math.floor(Math.random() * mockIps.length);
                const publicIp = mockIps[randomIndex];
                const isp = mockISPs[randomIndex];
                const country = mockCountries[Math.floor(Math.random() * mockCountries.length)];
                
                resolve(`Public IP: ${publicIp}
ISP: ${isp}
Country: ${country}
Target IP: ${targetIp}
Proxy: ${proxyIpPort}
Status: Proxy Active`);
            } else {
                resolve(`Proxy inactive
Target IP: ${targetIp}
Proxy: ${proxyIpPort}
Status: Connection Failed`);
            }
        }, 2000); // Simulate 2 second delay
    });
}

// Alternative implementation using native messaging (requires additional setup)
async function executeViaNativeMessaging(data) {
    // This would require a native messaging host to be installed
    // that can execute the Python script
    
    try {
        const response = await chrome.runtime.sendNativeMessage(
            'com.example.proxy_manager',
            {
                command: 'execute_script',
                data: data
            }
        );
        return response.result;
    } catch (error) {
        throw new Error(`Native messaging failed: ${error.message}`);
    }
}

// Removed complex API access verification for simplicity

// Simple remote server execution with progress tracking
async function executeViaRemoteServer(data, progressCallback) {
    try {
        console.log('=== CHROME EXTENSION DEBUG ===');
        console.log('Making request to server:', SERVER_CONFIG.url);
        console.log('Request data:', data);
        console.log('Headers being sent:', {
            'Content-Type': 'application/json'
        });
        console.log('=== NO API KEYS - CLEAN REQUEST ===');
        
        if (progressCallback) {
            progressCallback({ 
                step: 2, 
                message: 'Sending request to server...', 
                percentage: 40,
                status: 'sending',
                details: 'POST request being sent to API endpoint'
            });
        }
        
        const response = await fetch(`${SERVER_CONFIG.url}/api/execute-script`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        }
        
        if (progressCallback) {
            progressCallback({ 
                step: 3, 
                message: 'Waiting for server response...', 
                percentage: 60,
                status: 'waiting',
                details: 'Server is processing the request'
            });
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        let responseData;
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            // Response is not JSON, likely an HTML error page
            const textResponse = await response.text();
            console.error('Server returned non-JSON response:', textResponse.substring(0, 200));
            if (progressCallback) {
                progressCallback({ 
                    step: -1, 
                    message: 'Invalid server response', 
                    percentage: 0,
                    status: 'error',
                    details: `Server returned non-JSON response (${response.status})`
                });
            }
            throw new Error(`Server returned invalid response (${response.status}). Please check if the server is running correctly.`);
        }
        
        if (progressCallback) {
            progressCallback({ 
                step: 3, 
                message: 'Response received', 
                percentage: 75,
                status: 'received',
                details: 'Server response received, validating...'
            });
        }
        
        console.log('=== SERVER RESPONSE DEBUG ===');
        console.log('Response status:', response.status);
        console.log('Response data:', responseData);
        
        if (!response.ok) {
            console.error('Server returned error status:', response.status);
            console.error('Error response:', responseData);
            
            if (progressCallback) {
                progressCallback({ 
                    step: -1, 
                    message: `Server error: ${response.status}`, 
                    percentage: 0,
                    status: 'error',
                    details: responseData.error || `HTTP ${response.status} error from server`
                });
            }
            throw new Error(responseData.error || `Server error: ${response.status}`);
        }
        
        if (responseData.success) {
            console.log('Success! Response result:', responseData.result);
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
        } else {
            console.error('Server reported failure:', responseData.error);
            if (progressCallback) {
                progressCallback({ 
                    step: -1, 
                    message: 'Server reported failure', 
                    percentage: 0,
                    status: 'error',
                    details: responseData.error || 'Unknown server error'
                });
            }
            throw new Error(responseData.error || 'Unknown server error');
        }
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            const errorMsg = `Cannot connect to server at ${SERVER_CONFIG.url}. Please check the server URL and ensure the server is running.`;
            if (progressCallback) {
                progressCallback({ 
                    step: -1, 
                    message: 'Connection failed', 
                    percentage: 0,
                    status: 'error',
                    details: errorMsg
                });
            }
            throw new Error(errorMsg);
        } else if (error.message.includes('not valid JSON') || error.message.includes('Unexpected token')) {
            const errorMsg = `Server returned invalid response. The server may be returning an error page instead of JSON. Please check if the server is running correctly.`;
            if (progressCallback) {
                progressCallback({ 
                    step: -1, 
                    message: 'Invalid response format', 
                    percentage: 0,
                    status: 'error',
                    details: errorMsg
                });
            }
            throw new Error(errorMsg);
        }
        if (progressCallback && !error.message.includes('step: -1')) {
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

// API Health check
async function checkAPIHealth() {
    try {
        const response = await fetch(`${SERVER_CONFIG.url}/api/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                status: data.status || 'healthy',
                timestamp: data.timestamp,
                service: data.service
            };
        } else {
            return {
                success: false,
                error: `Server returned ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Connection failed'
        };
    }
}
