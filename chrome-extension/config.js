const DEFAULT_EXTENSION_SETTINGS = {
    apiBaseUrl: 'https://proxyconf-api.dashrdp.cloud',
    rememberFields: true,
    autoExtractWhmcs: true
};

function isWhmcsUrl(url) {
    if (!url) return false;
    return url.includes('portal.dashrdp.com') ||
        url.includes('clientsservices.php') ||
        url.includes('clientservices.php') ||
        (url.includes('/admin/') && (url.includes('client') || url.includes('service')));
}

async function getExtensionSettings() {
    const stored = await chrome.storage.sync.get('extensionSettings');
    const merged = { ...DEFAULT_EXTENSION_SETTINGS, ...stored.extensionSettings };

    if (!merged.apiBaseUrl || typeof merged.apiBaseUrl !== 'string' || !merged.apiBaseUrl.trim()) {
        merged.apiBaseUrl = DEFAULT_EXTENSION_SETTINGS.apiBaseUrl;
    }

    return merged;
}

async function getApiBaseUrl() {
    const settings = await getExtensionSettings();
    const url = settings.apiBaseUrl.trim().replace(/\/$/, '');

    try {
        new URL(url);
        return url;
    } catch {
        return DEFAULT_EXTENSION_SETTINGS.apiBaseUrl;
    }
}
