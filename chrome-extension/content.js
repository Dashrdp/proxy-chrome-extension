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
    
    const proxyRelatedInputs = [];
    const ipPortInputs = [];
    
    allInputs.forEach((input, index) => {
        const label = getAssociatedLabel(input);
        const combinedText = `${label} ${input.placeholder || ''} ${input.name || ''} ${input.id || ''}`.toLowerCase();
        
        const inputInfo = {
            index: index + 1,
            type: input.type,
            name: input.name,
            id: input.id,
            value: input.value ? (input.type === 'password' ? '***' : input.value) : '',
            placeholder: input.placeholder,
            className: input.className,
            label: label,
            combinedText: combinedText
        };
        
        console.log(`Input ${index + 1}:`, inputInfo);
        
        // Identify proxy-related inputs
        if (isProxyField(input, label, input.placeholder || '')) {
            proxyRelatedInputs.push(inputInfo);
        }
        
        // Identify inputs that might contain IP addresses or ports
        if (input.value) {
            const hasIP = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/.test(input.value);
            const hasPort = /^\d{1,5}$/.test(input.value.trim()) && parseInt(input.value.trim()) <= 65535;
            const hasIPPort = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/.test(input.value);
            
            if (hasIP || hasPort || hasIPPort) {
                ipPortInputs.push({...inputInfo, hasIP, hasPort, hasIPPort});
            }
        }
    });
    
    if (proxyRelatedInputs.length > 0) {
        console.log('=== Proxy-related inputs found ===');
        proxyRelatedInputs.forEach(input => console.log('Proxy input:', input));
    }
    
    if (ipPortInputs.length > 0) {
        console.log('=== Inputs with IP/Port patterns ===');
        ipPortInputs.forEach(input => console.log('IP/Port input:', input));
    }
    
    // Check for specific custom fields
    const customField390 = document.querySelector('input[name="customfield[390]"], #customfield390, [name*="customfield390"]');
    const customField391 = document.querySelector('input[name="customfield[391]"], #customfield391, [name*="customfield391"]');
    
    console.log('=== DashRDP Custom Fields ===');
    console.log('customfield[390] (Proxy IP):', customField390 ? {
        value: customField390.value,
        visible: customField390.offsetParent !== null
    } : 'Not found');
    console.log('customfield[391] (Proxy Port):', customField391 ? {
        value: customField391.value,
        visible: customField391.offsetParent !== null
    } : 'Not found');
    
    // Check for any fields with proxy-like names
    const proxyNamePatterns = [
        'proxy', 'socks', 'gateway', 'endpoint', 'tunnel',
        'http_proxy', 'https_proxy', 'proxy_server'
    ];
    
    console.log('=== Fields with proxy-like names ===');
    proxyNamePatterns.forEach(pattern => {
        const fields = document.querySelectorAll(`input[name*="${pattern}"], input[id*="${pattern}"], input[placeholder*="${pattern}"]`);
        if (fields.length > 0) {
            console.log(`Fields matching "${pattern}":`, Array.from(fields).map(f => ({
                name: f.name,
                id: f.id,
                value: f.value,
                placeholder: f.placeholder
            })));
        }
    });
    
    // Check for table structure with field labels
    console.log('=== Table structure analysis ===');
    const fieldLabels = document.querySelectorAll('td.fieldlabel');
    console.log(`Found ${fieldLabels.length} field labels with class "fieldlabel"`);
    
    fieldLabels.forEach((label, index) => {
        const labelText = label.textContent.trim();
        const isProxyRelated = labelText.toLowerCase().includes('proxy');
        
        if (isProxyRelated) {
            console.log(`Proxy-related label ${index + 1}: "${labelText}"`);
            
            // Try to find the associated input field
            const inputField = findInputNearLabel(label);
            if (inputField) {
                console.log('  -> Associated input field:', {
                    name: inputField.name,
                    id: inputField.id,
                    value: inputField.value,
                    type: inputField.type
                });
            } else {
                console.log('  -> No associated input field found');
            }
        }
    });
    
    // Also check for any other table cells that might contain proxy labels
    const allTableCells = document.querySelectorAll('td, th');
    const proxyLabelCells = Array.from(allTableCells).filter(cell => 
        cell.textContent.toLowerCase().includes('proxy')
    );
    
    if (proxyLabelCells.length > 0) {
        console.log('=== All table cells containing "proxy" ===');
        proxyLabelCells.forEach((cell, index) => {
            console.log(`Proxy cell ${index + 1}:`, {
                text: cell.textContent.trim(),
                class: cell.className,
                tagName: cell.tagName
            });
        });
    }
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
    
    // Enhanced selectors for common proxy field patterns
    const proxySelectors = [
        // DashRDP specific fields
        'input[name="customfield[390]"]', '#customfield390', '[name*="customfield390"]',
        'input[name="customfield[391]"]', '#customfield391', '[name*="customfield391"]',
        
        // Common proxy IP field patterns
        'input[name*="proxy"][name*="ip"]', 'input[id*="proxy"][id*="ip"]',
        'input[name*="proxyip"]', 'input[id*="proxyip"]',
        'input[name*="proxy_ip"]', 'input[id*="proxy_ip"]',
        'input[name*="proxy-ip"]', 'input[id*="proxy-ip"]',
        
        // Common proxy port field patterns
        'input[name*="proxy"][name*="port"]', 'input[id*="proxy"][id*="port"]',
        'input[name*="proxyport"]', 'input[id*="proxyport"]',
        'input[name*="proxy_port"]', 'input[id*="proxy_port"]',
        'input[name*="proxy-port"]', 'input[id*="proxy-port"]',
        
        // Generic proxy fields
        'input[name*="proxy"]', 'input[id*="proxy"]',
        'input[placeholder*="proxy"]',
        
        // SOCKS proxy fields
        'input[name*="socks"]', 'input[id*="socks"]',
        'input[placeholder*="socks"]',
        
        // HTTP proxy fields
        'input[name*="http_proxy"]', 'input[id*="http_proxy"]',
        'input[name*="httpproxy"]', 'input[id*="httpproxy"]'
    ];
    
    // Try to find separate IP and Port fields first
    const proxyIpCombinations = findSeparateProxyFields();
    if (proxyIpCombinations) {
        console.log('Successfully extracted proxy from separate fields:', proxyIpCombinations);
        return proxyIpCombinations;
    }
    
    // Try to find combined IP:Port fields
    const combinedProxy = findCombinedProxyField(proxySelectors);
    if (combinedProxy) {
        console.log('Successfully extracted proxy from combined field:', combinedProxy);
        return combinedProxy;
    }
    
    // Enhanced pattern matching in field values
    const extractedProxy = extractProxyFromAnyField();
    if (extractedProxy) {
        console.log('Successfully extracted proxy from general search:', extractedProxy);
        return extractedProxy;
    }
    
    // Try fallback strategies as last resort
    const fallbackProxy = findProxyWithFallbackStrategies();
    if (fallbackProxy) {
        console.log('Successfully extracted proxy using fallback strategies:', fallbackProxy);
        return fallbackProxy;
    }
    
    console.log('No proxy information found after exhaustive search');
    return null;
}

function findSeparateProxyFields() {
    console.log('Searching for separate IP and port fields...');
    
    // First, try to find fields by table cell labels (most reliable method)
    const labelBasedResult = findFieldsByTableLabels();
    if (labelBasedResult) {
        console.log('Successfully found proxy fields by table labels:', labelBasedResult);
        return labelBasedResult;
    }
    
    const ipSelectors = [
        'input[name="customfield[390]"]', '#customfield390', '[name*="customfield390"]',
        'input[name*="proxy"][name*="ip"]', 'input[id*="proxy"][id*="ip"]',
        'input[name*="proxyip"]', 'input[id*="proxyip"]',
        'input[name*="proxy_ip"]', 'input[id*="proxy_ip"]',
        'input[name*="proxy-ip"]', 'input[id*="proxy-ip"]',
        'input[name*="socks"][name*="ip"]', 'input[id*="socks"][id*="ip"]',
        'input[name*="host"]', 'input[id*="host"]'
    ];
    
    const portSelectors = [
        'input[name="customfield[391]"]', '#customfield391', '[name*="customfield391"]',
        'input[name*="proxy"][name*="port"]', 'input[id*="proxy"][id*="port"]',
        'input[name*="proxyport"]', 'input[id*="proxyport"]',
        'input[name*="proxy_port"]', 'input[id*="proxy_port"]',
        'input[name*="proxy-port"]', 'input[id*="proxy-port"]',
        'input[name*="socks"][name*="port"]', 'input[id*="socks"][id*="port"]',
        'input[name*="port"]', 'input[id*="port"]'
    ];
    
    let proxyIp = null;
    let proxyPort = null;
    
    // Find IP field
    for (const selector of ipSelectors) {
        const field = document.querySelector(selector);
        if (field && field.value.trim()) {
            const value = field.value.trim();
            console.log(`Found potential IP field (${selector}):`, value);
            
            // Validate IP format
            if (isValidIPAddress(value)) {
                proxyIp = value;
                console.log('Valid IP found:', proxyIp);
                break;
            }
        }
    }
    
    // Find Port field
    for (const selector of portSelectors) {
        const field = document.querySelector(selector);
        if (field && field.value.trim()) {
            const value = field.value.trim();
            console.log(`Found potential port field (${selector}):`, value);
            
            // Validate port format
            if (isValidPort(value)) {
                proxyPort = value;
                console.log('Valid port found:', proxyPort);
                break;
            }
        }
    }
    
    // Try proximity-based matching if we don't have both
    if (!proxyIp || !proxyPort) {
        const proximityResult = findProxyFieldsByProximity();
        if (proximityResult) {
            proxyIp = proximityResult.ip || proxyIp;
            proxyPort = proximityResult.port || proxyPort;
        }
    }
    
    if (proxyIp && proxyPort) {
        return `${proxyIp}:${proxyPort}`;
    }
    
    return null;
}

function findCombinedProxyField(selectors) {
    console.log('Searching for combined IP:Port fields...');
    
    const proxyRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/;
    
    // Check specific selectors first
    for (const selector of selectors) {
        try {
            const fields = document.querySelectorAll(selector);
            for (const field of fields) {
                const value = field.value.trim();
                if (value) {
                    console.log(`Checking field (${selector}):`, value);
                    const match = value.match(proxyRegex);
                    if (match) {
                        return match[0];
                    }
                }
            }
        } catch (e) {
            // Invalid selector, continue
            continue;
        }
    }
    
    // Check all input fields
    const allInputs = document.querySelectorAll('input[type="text"], input[type="url"], input:not([type])');
    for (const input of allInputs) {
        const value = input.value.trim();
        if (value) {
            const match = value.match(proxyRegex);
            if (match) {
                const label = getAssociatedLabel(input);
                const placeholder = input.placeholder || '';
                
                if (isProxyField(input, label, placeholder)) {
                    return match[0];
                }
            }
        }
    }
    
    return null;
}

function extractProxyFromAnyField() {
    console.log('Performing general proxy extraction...');
    
    const proxyRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/g;
    
    // Check all visible text on the page
    const allText = document.body.innerText || document.body.textContent || '';
    const matches = allText.match(proxyRegex);
    
    if (matches && matches.length > 0) {
        console.log('Found proxy patterns in page text:', matches);
        
        // Filter out obvious non-proxy IPs (like localhost, etc.)
        const validProxies = matches.filter(match => {
            const [ip] = match.split(':');
            return !isLocalIP(ip) && !isCommonNonProxyIP(ip);
        });
        
        if (validProxies.length > 0) {
            return validProxies[0];
        }
    }
    
    return null;
}

function findProxyFieldsByProximity() {
    console.log('Searching for proxy fields by proximity...');
    
    const allInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
    let bestIpField = null;
    let bestPortField = null;
    let minDistance = Infinity;
    
    // Look for fields that are close to each other and might be IP/Port pairs
    for (let i = 0; i < allInputs.length; i++) {
        for (let j = i + 1; j < allInputs.length; j++) {
            const field1 = allInputs[i];
            const field2 = allInputs[j];
            
            const field1Label = getAssociatedLabel(field1).toLowerCase();
            const field2Label = getAssociatedLabel(field2).toLowerCase();
            
            // Check if one looks like IP and other like port
            const field1IsIP = field1Label.includes('ip') || field1Label.includes('host') || field1Label.includes('address');
            const field1IsPort = field1Label.includes('port');
            const field2IsIP = field2Label.includes('ip') || field2Label.includes('host') || field2Label.includes('address');
            const field2IsPort = field2Label.includes('port');
            
            if ((field1IsIP && field2IsPort) || (field1IsPort && field2IsIP)) {
                const rect1 = field1.getBoundingClientRect();
                const rect2 = field2.getBoundingClientRect();
                const distance = Math.sqrt(
                    Math.pow(rect1.left - rect2.left, 2) + 
                    Math.pow(rect1.top - rect2.top, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    if (field1IsIP) {
                        bestIpField = field1;
                        bestPortField = field2;
                    } else {
                        bestIpField = field2;
                        bestPortField = field1;
                    }
                }
            }
        }
    }
    
    if (bestIpField && bestPortField) {
        const ip = bestIpField.value.trim();
        const port = bestPortField.value.trim();
        
        if (isValidIPAddress(ip) && isValidPort(port)) {
            console.log('Found proxy by proximity:', { ip, port });
            return { ip, port };
        }
    }
    
    return null;
}

function isValidIPAddress(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

function isValidPort(port) {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

function isCommonNonProxyIP(ip) {
    const commonNonProxyIPs = [
        '8.8.8.8', '8.8.4.4', // Google DNS
        '1.1.1.1', '1.0.0.1', // Cloudflare DNS
        '208.67.222.222', '208.67.220.220' // OpenDNS
    ];
    return commonNonProxyIPs.includes(ip);
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
    const proxyKeywords = [
        'proxy', 'socks', 'gateway', 'endpoint', 'tunnel', 'vpn',
        'http_proxy', 'https_proxy', 'socks_proxy', 'proxy_server',
        'proxy_host', 'proxy_address', 'proxy_ip', 'proxy_port',
        'forward', 'redirect', 'relay'
    ];
    
    // Check for exact matches and partial matches
    const hasProxyKeyword = proxyKeywords.some(keyword => combinedText.includes(keyword));
    
    // Additional checks for common proxy field patterns
    const hasCustomField = combinedText.includes('customfield');
    const hasPortPattern = /port|:\d+/.test(combinedText);
    const hasIPPattern = /ip|address|host/.test(combinedText);
    
    return hasProxyKeyword || (hasCustomField && (hasPortPattern || hasIPPattern));
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

// Enhanced field detection with fallback strategies
function findFieldsByTableLabels() {
    console.log('=== Searching for fields by table cell labels ===');
    
    // Look for table cells with specific proxy labels
    const proxyIpLabels = [
        'proxy ip', 'proxy IP', 'Proxy IP', 'PROXY IP',
        'proxyip', 'ProxyIP', 'PROXYIP',
        'proxy_ip', 'Proxy_IP', 'PROXY_IP'
    ];
    
    const proxyPortLabels = [
        'proxy port', 'proxy PORT', 'Proxy PORT', 'PROXY PORT',
        'proxyport', 'ProxyPort', 'PROXYPORT',
        'proxy_port', 'Proxy_Port', 'PROXY_PORT'
    ];
    
    let proxyIp = null;
    let proxyPort = null;
    
    // Find all table cells with class "fieldlabel"
    const fieldLabels = document.querySelectorAll('td.fieldlabel');
    console.log(`Found ${fieldLabels.length} field label cells`);
    
    fieldLabels.forEach((labelCell, index) => {
        const labelText = labelCell.textContent.trim();
        console.log(`Label ${index + 1}: "${labelText}"`);
        
        // Check if this is a proxy IP label
        if (proxyIpLabels.some(label => labelText.toLowerCase().includes(label.toLowerCase()))) {
            console.log('Found proxy IP label:', labelText);
            const inputField = findInputNearLabel(labelCell);
            if (inputField && inputField.value.trim()) {
                const value = inputField.value.trim();
                console.log('Found input value for proxy IP:', value);
                if (isValidIPAddress(value)) {
                    proxyIp = value;
                    console.log('Valid proxy IP extracted:', proxyIp);
                }
            }
        }
        
        // Check if this is a proxy PORT label
        if (proxyPortLabels.some(label => labelText.toLowerCase().includes(label.toLowerCase()))) {
            console.log('Found proxy PORT label:', labelText);
            const inputField = findInputNearLabel(labelCell);
            if (inputField && inputField.value.trim()) {
                const value = inputField.value.trim();
                console.log('Found input value for proxy PORT:', value);
                if (isValidPort(value)) {
                    proxyPort = value;
                    console.log('Valid proxy PORT extracted:', proxyPort);
                }
            }
        }
    });
    
    // Also check other common label patterns
    if (!proxyIp || !proxyPort) {
        const allLabels = document.querySelectorAll('td, th, label, span, div');
        allLabels.forEach(element => {
            const text = element.textContent.trim().toLowerCase();
            
            // Check for proxy IP patterns
            if (!proxyIp && (text.includes('proxy') && text.includes('ip'))) {
                console.log('Found potential proxy IP label (broader search):', text);
                const inputField = findInputNearLabel(element);
                if (inputField && inputField.value.trim() && isValidIPAddress(inputField.value.trim())) {
                    proxyIp = inputField.value.trim();
                    console.log('Valid proxy IP extracted (broader search):', proxyIp);
                }
            }
            
            // Check for proxy PORT patterns
            if (!proxyPort && (text.includes('proxy') && text.includes('port'))) {
                console.log('Found potential proxy PORT label (broader search):', text);
                const inputField = findInputNearLabel(element);
                if (inputField && inputField.value.trim() && isValidPort(inputField.value.trim())) {
                    proxyPort = inputField.value.trim();
                    console.log('Valid proxy PORT extracted (broader search):', proxyPort);
                }
            }
        });
    }
    
    if (proxyIp && proxyPort) {
        console.log('Successfully extracted both proxy IP and PORT using table labels');
        return `${proxyIp}:${proxyPort}`;
    } else if (proxyIp || proxyPort) {
        console.log('Partially extracted proxy info:', { proxyIp, proxyPort });
    }
    
    return null;
}

function findInputNearLabel(labelElement) {
    console.log('Looking for input field near label element...');
    
    // Strategy 1: Look in the same table row
    let currentElement = labelElement;
    let attempts = 0;
    
    // Traverse up to find the table row
    while (currentElement && currentElement.tagName !== 'TR' && attempts < 5) {
        currentElement = currentElement.parentElement;
        attempts++;
    }
    
    if (currentElement && currentElement.tagName === 'TR') {
        console.log('Found table row, looking for input fields...');
        const inputsInRow = currentElement.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
        console.log(`Found ${inputsInRow.length} input fields in the same row`);
        
        if (inputsInRow.length > 0) {
            // Return the first input field that has a value
            for (const input of inputsInRow) {
                if (input.value && input.value.trim()) {
                    console.log('Found input with value:', input.value);
                    return input;
                }
            }
            // If no input has a value, return the first one
            return inputsInRow[0];
        }
    }
    
    // Strategy 2: Look for the next input field after this label
    let nextElement = labelElement.nextElementSibling;
    attempts = 0;
    
    while (nextElement && attempts < 10) {
        if (nextElement.tagName === 'INPUT' || nextElement.querySelector('input')) {
            const input = nextElement.tagName === 'INPUT' ? nextElement : nextElement.querySelector('input');
            console.log('Found input field as next sibling:', input);
            return input;
        }
        nextElement = nextElement.nextElementSibling;
        attempts++;
    }
    
    // Strategy 3: Look in the next table cell
    if (labelElement.tagName === 'TD') {
        const nextCell = labelElement.nextElementSibling;
        if (nextCell) {
            const inputInNextCell = nextCell.querySelector('input[type="text"], input[type="number"], input:not([type])');
            if (inputInNextCell) {
                console.log('Found input field in next table cell:', inputInNextCell);
                return inputInNextCell;
            }
        }
    }
    
    // Strategy 4: Look within the same parent container
    const parentContainer = labelElement.parentElement;
    if (parentContainer) {
        const inputsInContainer = parentContainer.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
        if (inputsInContainer.length > 0) {
            console.log('Found input field in parent container:', inputsInContainer[0]);
            return inputsInContainer[0];
        }
    }
    
    console.log('No input field found near label');
    return null;
}

function findProxyWithFallbackStrategies() {
    console.log('=== Trying fallback proxy detection strategies ===');
    
    // Strategy 1: Look for hidden or invisible fields
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (const input of hiddenInputs) {
        if (input.value && /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/.test(input.value)) {
            console.log('Found proxy in hidden field:', input);
            return input.value.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/)[0];
        }
    }
    
    // Strategy 2: Look in data attributes
    const elementsWithData = document.querySelectorAll('[data-proxy], [data-ip], [data-port], [data-endpoint]');
    for (const element of elementsWithData) {
        const dataValues = [
            element.dataset.proxy,
            element.dataset.ip,
            element.dataset.port,
            element.dataset.endpoint
        ].filter(Boolean);
        
        for (const value of dataValues) {
            if (/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/.test(value)) {
                console.log('Found proxy in data attribute:', value);
                return value.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/)[0];
            }
        }
    }
    
    // Strategy 3: Look in script tags for JSON or configuration
    const scriptTags = document.querySelectorAll('script');
    for (const script of scriptTags) {
        if (script.textContent) {
            const proxyMatches = script.textContent.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/g);
            if (proxyMatches) {
                console.log('Found proxy in script tag:', proxyMatches);
                // Filter for likely proxy IPs (not DNS servers, etc.)
                const validProxies = proxyMatches.filter(match => {
                    const [ip] = match.split(':');
                    return !isLocalIP(ip) && !isCommonNonProxyIP(ip);
                });
                if (validProxies.length > 0) {
                    return validProxies[0];
                }
            }
        }
    }
    
    // Strategy 4: Look for select/option elements
    const selects = document.querySelectorAll('select option');
    for (const option of selects) {
        if (option.value && /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/.test(option.value)) {
            console.log('Found proxy in select option:', option);
            return option.value.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):\d{1,5}\b/)[0];
        }
    }
    
    return null;
}

// Run auto-extraction when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoExtractOnLoad);
} else {
    autoExtractOnLoad();
}
