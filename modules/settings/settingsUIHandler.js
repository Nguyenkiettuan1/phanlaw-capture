// Settings UI Handler - Handles settings modal and keyboard shortcut recording
const { ipcRenderer } = require('electron');

class SettingsUIHandler {
    constructor() {
        this.currentSettings = null;
        this.recordingInput = null;
        this.recordedKeys = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Close buttons
        document.getElementById('settings-close-btn')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-cancel-btn')?.addEventListener('click', () => this.closeSettings());
        
        // Save button
        document.getElementById('settings-save-btn')?.addEventListener('click', () => this.saveSettings());
        
        // Reset all button
        document.getElementById('settings-reset-all-btn')?.addEventListener('click', () => this.resetAllSettings());

        // Shortcut inputs
        const shortcutInputs = document.querySelectorAll('.shortcut-input');
        shortcutInputs.forEach(input => {
            input.addEventListener('click', () => this.startRecording(input));
            input.addEventListener('focus', () => this.startRecording(input));
        });

        // Reset buttons
        const resetButtons = document.querySelectorAll('.btn-reset');
        resetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const shortcutName = btn.getAttribute('data-shortcut');
                this.resetShortcut(shortcutName);
            });
        });

        // Check for updates button
        const checkUpdatesBtn = document.getElementById('check-updates-btn');
        if (checkUpdatesBtn) {
            checkUpdatesBtn.addEventListener('click', () => this.checkForUpdates());
        }

        // Keyboard event for recording
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    async openSettings() {
        try {
            // Load current settings
            this.currentSettings = await ipcRenderer.invoke('get-settings');
            
            // Populate UI
            this.populateSettings();
            
            // Show modal
            document.getElementById('settings-modal').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        this.stopRecording();
    }

    populateSettings() {
        if (!this.currentSettings) return;

        // Populate shortcuts
        const { shortcuts } = this.currentSettings;
        document.getElementById('shortcut-screenshot').value = this.formatShortcut(shortcuts.takeScreenshot);
        document.getElementById('shortcut-upload').value = this.formatShortcut(shortcuts.uploadScreenshot);
        document.getElementById('shortcut-cancel').value = this.formatShortcut(shortcuts.cancelAction);

        // Populate general settings
        document.getElementById('auto-minimize-checkbox').checked = this.currentSettings.autoMinimizeAfterUpload;
        document.getElementById('check-updates-checkbox').checked = this.currentSettings.checkUpdatesOnStartup;
        document.getElementById('notification-duration').value = this.currentSettings.notificationDuration / 1000;
    }

    formatShortcut(shortcut) {
        if (!shortcut || shortcut === 'None') return '';
        
        // Convert CommandOrControl to Ctrl/Cmd
        return shortcut
            .replace('CommandOrControl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
            .replace('+', ' + ');
    }

    startRecording(input) {
        // Stop any previous recording
        this.stopRecording();
        
        // Start new recording
        this.recordingInput = input;
        this.recordedKeys = [];
        input.classList.add('recording');
        input.value = 'Press keys...';
        input.placeholder = 'Press keys...';
    }

    stopRecording() {
        if (this.recordingInput) {
            this.recordingInput.classList.remove('recording');
            this.recordingInput = null;
            this.recordedKeys = [];
        }
    }

    handleKeyDown(e) {
        // Only record if we're in recording mode
        if (!this.recordingInput) return;

        // Ignore if settings modal is not visible
        const modal = document.getElementById('settings-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        e.preventDefault();
        e.stopPropagation();

        // Build shortcut string
        const keys = [];
        
        // Modifiers
        if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        
        // Main key - handle special keys and regular keys
        let mainKey = this.normalizeKeyName(e.key, e.code);
        
        // Ignore modifier keys themselves
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(mainKey)) {
            keys.push(mainKey);
            
            // We have a complete shortcut
            const shortcut = keys.join('+');
            this.recordingInput.value = this.formatShortcut(shortcut);
            this.recordingInput.dataset.shortcut = shortcut;
            this.stopRecording();
        } else if (keys.length > 0) {
            // Just show modifiers while waiting for main key
            this.recordingInput.value = this.formatShortcut(keys.join('+')) + ' + ...';
        }
    }

    normalizeKeyName(key, code) {
        // Map special keys to Electron format
        const specialKeys = {
            // Print Screen
            'PrintScreen': 'PrintScreen',
            'Print': 'PrintScreen',
            
            // Function keys
            'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
            'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
            'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
            'F13': 'F13', 'F14': 'F14', 'F15': 'F15', 'F16': 'F16',
            'F17': 'F17', 'F18': 'F18', 'F19': 'F19', 'F20': 'F20',
            'F21': 'F21', 'F22': 'F22', 'F23': 'F23', 'F24': 'F24',
            
            // Navigation
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'Insert': 'Insert',
            'Delete': 'Delete',
            
            // Arrow keys
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            
            // Media keys
            'MediaPlayPause': 'MediaPlayPause',
            'MediaStop': 'MediaStop',
            'MediaNextTrack': 'MediaNextTrack',
            'MediaPreviousTrack': 'MediaPreviousTrack',
            'VolumeUp': 'VolumeUp',
            'VolumeDown': 'VolumeDown',
            'VolumeMute': 'VolumeMute',
            
            // Other special keys
            'Escape': 'Escape',
            'Tab': 'Tab',
            'Enter': 'Enter',
            'Space': 'Space',
            'Backspace': 'Backspace',
            'CapsLock': 'CapsLock',
            'NumLock': 'NumLock',
            'ScrollLock': 'ScrollLock',
            'Pause': 'Pause',
        };

        // Check if it's a special key
        if (specialKeys[key]) {
            return specialKeys[key];
        }

        // Use code for PrintScreen if key doesn't match
        if (code === 'PrintScreen') {
            return 'PrintScreen';
        }

        // For single character keys, capitalize
        if (key.length === 1) {
            return key.toUpperCase();
        }

        // Return as-is for other keys
        return key;
    }

    async checkForUpdates() {
        const btn = document.getElementById('check-updates-btn');
        if (!btn) return;
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = '🔄 Checking...';
        
        try {
            const result = await ipcRenderer.invoke('check-for-updates', { force: true });
            
            if (result.success) {
                this.showNotification('Checking for updates...', 'info');
                // The update dialog will be shown by main.js when update is found
            } else {
                this.showNotification(result.message || result.error || 'Failed to check for updates', 'error');
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
            this.showNotification('Failed to check for updates: ' + error.message, 'error');
        } finally {
            // Re-enable button after 2 seconds
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = originalText;
            }, 2000);
        }
    }

    showNotification(message, type = 'info') {
        // Simple notification - you can enhance this later
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async resetShortcut(shortcutName) {
        const defaults = {
            takeScreenshot: 'CommandOrControl+Shift+Q',
            uploadScreenshot: 'CommandOrControl+Shift+U',
            cancelAction: 'Escape'
        };

        const inputMap = {
            takeScreenshot: 'shortcut-screenshot',
            uploadScreenshot: 'shortcut-upload',
            cancelAction: 'shortcut-cancel'
        };

        const inputId = inputMap[shortcutName];
        if (inputId) {
            const input = document.getElementById(inputId);
            input.value = this.formatShortcut(defaults[shortcutName]);
            input.dataset.shortcut = defaults[shortcutName];
        }
    }

    async saveSettings() {
        try {
            // Gather settings from UI
            const settings = {
                shortcuts: {
                    takeScreenshot: document.getElementById('shortcut-screenshot').dataset.shortcut || 
                                   this.parseShortcut(document.getElementById('shortcut-screenshot').value) ||
                                   'CommandOrControl+Shift+Q',
                    uploadScreenshot: document.getElementById('shortcut-upload').dataset.shortcut || 
                                     this.parseShortcut(document.getElementById('shortcut-upload').value) ||
                                     'CommandOrControl+Shift+U',
                    cancelAction: document.getElementById('shortcut-cancel').dataset.shortcut || 
                                 this.parseShortcut(document.getElementById('shortcut-cancel').value) ||
                                 'Escape'
                },
                autoMinimizeAfterUpload: document.getElementById('auto-minimize-checkbox').checked,
                checkUpdatesOnStartup: document.getElementById('check-updates-checkbox').checked,
                notificationDuration: parseInt(document.getElementById('notification-duration').value) * 1000
            };

            // Save via IPC
            const result = await ipcRenderer.invoke('save-settings', settings);
            
            if (result.success) {
                // Show success notification
                this.showNotification('Settings saved successfully!', 'success');
                this.closeSettings();
                
                // Reload settings
                this.currentSettings = settings;
            } else {
                this.showNotification('Failed to save settings: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showNotification('Failed to save settings: ' + error.message, 'error');
        }
    }

    parseShortcut(formattedShortcut) {
        if (!formattedShortcut) return '';
        
        // Convert back from display format to Electron format
        return formattedShortcut
            .replace(/\s*\+\s*/g, '+')
            .replace('Ctrl', 'CommandOrControl')
            .replace('Cmd', 'CommandOrControl');
    }

    async resetAllSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            try {
                const result = await ipcRenderer.invoke('reset-settings');
                
                if (result.success) {
                    this.showNotification('All settings reset to defaults!', 'success');
                    this.closeSettings();
                } else {
                    this.showNotification('Failed to reset settings: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Failed to reset settings:', error);
                this.showNotification('Failed to reset settings: ' + error.message, 'error');
            }
        }
    }

    showNotification(message, type = 'info') {
        // Use existing notification system
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        if (notification && text) {
            text.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.remove('hidden');

            if (type === 'success' || type === 'info') {
                setTimeout(() => {
                    notification.classList.add('hidden');
                }, 5000);
            }
        }
    }
}

module.exports = SettingsUIHandler;


