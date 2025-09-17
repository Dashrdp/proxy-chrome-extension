// Content script for extracting fields from web pages
console.log('DashRDP Proxy Configurator content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.action === 'extractFields') {
        try {
            const extractedData = extractFieldsFromPage();
            console.log('Extraction result:', extractedData);
            sendResponse({ success: true, data: extractedData });
        } catch (error) {
            console.error('Extraction error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    return true;
});

function extractFieldsFromPage() {
    console.log('=== Starting field extraction ===');
    console.log('Page URL:', window.location.href);
    console.log('Page title:', document.title);
    
    // Debug: Show all input fields on the page
    debugShowAllInputs();
    
    const result = {
        serverIp: null,
        password: null,
        proxyIpPort: null
    };

    // Extract server IP
    result.serverIp = findServerIP();
    
    // Extract password
    result.password = findPassword();
    
    // Extract proxy IP:Port
    result.proxyIpPort = findProxyIpPort();

    console.log('=== Final extraction result ===', result);
    return result;
}

function debugShowAllInputs() {
    console.log('=== Debug: All input fields on page ===');
    const allInputs = document.querySelectorAll('input');
    console.log('Total inputs found:', allInputs.length);
    
    allInputs.forEach((input, index) => {
        console.log(`Input ${index + 1}:`, {
            type: input.type,
            name: input.name,
            id: input.id,
            value: input.value ? (input.type === 'password' ? '***' : input.value) : '',
            placeholder: input.placeholder,
            className: input.className
        });
    });
}

function findServerIP() {
    console.log('Looking for server IP...');
    // Look for IP addresses in various contexts
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    
    // Check input fields first
    const inputs = document.querySelectorAll('input[type="text"], input[type="url"], input');
    for (const input of inputs) {
        const value = input.value.trim();
        const placeholder = input.placeholder || '';
        const label = getAssociatedLabel(input);
        
        // Check if this looks like a server IP field
        if (isServerIPField(input, label, placeholder)) {
            const match = value.match(ipRegex);
            if (match) return match[0];
        }
    }
    
    // Check for IP addresses in text content
    const textContent = document.body.textContent || '';
    const ipMatches = textContent.match(ipRegex);
    if (ipMatches) {
        // Return the first IP that looks like a server IP
        for (const ip of ipMatches) {
            if (!isLocalIP(ip)) {
                return ip;
            }
        }
    }
    
    return null;
}

function findPassword() {
    console.log('Looking for password fields...');
    // Look for password fields
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    console.log('Found password inputs:', passwordInputs.length);
    if (passwordInputs.length > 0) {
        // Return the value of the first password field that has content
        for (const input of passwordInputs) {
            if (input.value.trim()) {
                return input.value.trim();
            }
        }
    }
    
    // Look for text inputs that might contain passwords
    const textInputs = document.querySelectorAll('input[type="text"], input');
    for (const input of textInputs) {
        const label = getAssociatedLabel(input);
        const placeholder = input.placeholder || '';
        
        if (isPasswordField(input, label, placeholder) && input.value.trim()) {
            return input.value.trim();
        }
    }
    
    return null;
}

function findProxyIpPort() {
    console.log('Looking for proxy IP and port fields...');
    
    // First, try to find the specific proxy IP and port fields you mentioned
    const proxyIpField = document.querySelector('input[name="customfield[390]"], #customfield390');
    const proxyPortField = document.querySelector('input[name="customfield[391]"], #customfield391');
    
    console.log('Found proxy IP field:', proxyIpField);
    console.log('Found proxy PORT field:', proxyPortField);
    
    if (proxyIpField && proxyPortField) {
        const ip = proxyIpField.value.trim();
        const port = proxyPortField.value.trim();
        
        console.log('Proxy IP value:', ip);
        console.log('Proxy PORT value:', port);
        
        if (ip && port) {
            console.log('Successfully extracted proxy:', `${ip}:${port}`);
            return `${ip}:${port}`;
        }
    }
    
    // Fallback to original logic for other proxy field formats
    const proxyRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/g;
    
    // Check input fields
    const inputs = document.querySelectorAll('input[type="text"], input[type="url"], input');
    for (const input of inputs) {
        const value = input.value.trim();
        const placeholder = input.placeholder || '';
        const label = getAssociatedLabel(input);
        
        if (isProxyField(input, label, placeholder)) {
            const match = value.match(proxyRegex);
            if (match) return match[0];
        }
    }
    
    // Check text content
    const textContent = document.body.textContent || '';
    const proxyMatches = textContent.match(proxyRegex);
    if (proxyMatches) {
        return proxyMatches[0];
    }
    
    return null;
}

function getAssociatedLabel(input) {
    // Try to find associated label
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent.toLowerCase();
    }
    
    // Check parent elements for label-like text
    let parent = input.parentElement;
    while (parent && parent !== document.body) {
        const text = parent.textContent.toLowerCase();
        if (text.length < 100) { // Reasonable label length
            return text;
        }
        parent = parent.parentElement;
    }
    
    return '';
}

function isServerIPField(input, label, placeholder) {
    const combinedText = `${label} ${placeholder} ${input.name || ''} ${input.id || ''}`.toLowerCase();
    const serverKeywords = ['server', 'host', 'target', 'remote', 'ip', 'address'];
    
    return serverKeywords.some(keyword => combinedText.includes(keyword));
}

function isPasswordField(input, label, placeholder) {
    const combinedText = `${label} ${placeholder} ${input.name || ''} ${input.id || ''}`.toLowerCase();
    const passwordKeywords = ['password', 'pass', 'pwd', 'secret', 'auth'];
    
    return passwordKeywords.some(keyword => combinedText.includes(keyword));
}

function isProxyField(input, label, placeholder) {
    const combinedText = `${label} ${placeholder} ${input.name || ''} ${input.id || ''}`.toLowerCase();
    const proxyKeywords = ['proxy', 'socks', 'gateway', 'endpoint'];
    
    return proxyKeywords.some(keyword => combinedText.includes(keyword));
}

function isLocalIP(ip) {
    const parts = ip.split('.').map(Number);
    
    // Check for common local IP ranges
    if (parts[0] === 127) return true; // 127.x.x.x (localhost)
    if (parts[0] === 10) return true; // 10.x.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16-31.x.x
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.x.x
    
    return false;
}

// Auto-extraction on page load (optional)
function autoExtractOnLoad() {
    // Only auto-extract if the page looks like it has relevant forms
    const hasPasswordField = document.querySelector('input[type="password"]') !== null;
    const hasIPField = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/.test(document.body.textContent);
    
    if (hasPasswordField || hasIPField) {
        // Store extracted data for quick access
        const extractedData = extractFieldsFromPage();
        if (extractedData.serverIp || extractedData.password || extractedData.proxyIpPort) {
            // Could notify the extension that data is available
            chrome.runtime.sendMessage({
                action: 'dataAvailable',
                data: extractedData
            }).catch(() => {
                // Extension might not be listening, that's OK
            });
        }
    }
}

// Run auto-extraction when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoExtractOnLoad);
} else {
    autoExtractOnLoad();
}
