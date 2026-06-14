document.addEventListener('DOMContentLoaded', async function() {
    const form = document.getElementById('optionsForm');
    const saveStatus = document.getElementById('saveStatus');

    const settings = await getExtensionSettings();
    document.getElementById('apiBaseUrl').value = settings.apiBaseUrl;
    document.getElementById('rememberFields').checked = settings.rememberFields;
    document.getElementById('autoExtractWhmcs').checked = settings.autoExtractWhmcs;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const extensionSettings = {
            apiBaseUrl: document.getElementById('apiBaseUrl').value.replace(/\/$/, ''),
            rememberFields: document.getElementById('rememberFields').checked,
            autoExtractWhmcs: document.getElementById('autoExtractWhmcs').checked
        };

        await chrome.storage.sync.set({ extensionSettings });
        saveStatus.classList.remove('hidden');
        setTimeout(() => saveStatus.classList.add('hidden'), 2000);
    });
});
