// UI Service Module - Handles UI operations and notifications
const { ipcRenderer } = require('electron');
const SessionService = require('../session/sessionService');

class UiService {
    constructor() {
        this.uploadQueue = [];
        this.notificationTimeout = null;
        this.wasVisibleBeforeScreenshot = true; // Track if window was visible before screenshot
        this.notificationHistory = []; // Track all notifications
        this.queueItemTimeouts = new Map(); // Track timeouts for queue items
        this.sessionService = null; // Will be set from renderer
        this.setupUploadQueue();
        this.setupNotificationClose();
        this.setupNotificationClearAll();
    }

    setSessionService(sessionService) {
        this.sessionService = sessionService;
    }

    getCurrentPlatform() {
        if (this.sessionService) {
            return this.sessionService.getPlatform();
        }
        return null;
    }

    getCurrentSocialMediaType() {
        if (this.sessionService) {
            return this.sessionService.getSocialMediaType();
        }
        return null;
    }

    setupUploadQueue() {
        // Queue toggle functionality
        const queueToggle = document.getElementById('queue-toggle');
        const queueContent = document.getElementById('queue-content');
        
        if (queueToggle && queueContent) {
            queueToggle.addEventListener('click', () => {
                const isCollapsed = queueContent.style.display === 'none';
                queueContent.style.display = isCollapsed ? 'block' : 'none';
                queueToggle.textContent = isCollapsed ? '−' : '+';
            });
        }

        // Clear All button (remove all except errors)
        const clearAllBtn = document.getElementById('queue-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearUploadQueueExceptErrors();
            });
        }
    }

    setupNotificationClose() {
        const closeBtn = document.getElementById('notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideNotification();
            });
        }
    }

    setupNotificationClearAll() {
        const clearAllBtn = document.getElementById('notification-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllNotifications();
            });
        }
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        notification.classList.add('hidden');
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }
    }

    clearAllNotifications() {
        const notification = document.getElementById('notification');
        const notificationType = notification.className.split(' ').find(cls => 
            ['success', 'info', 'error', 'warning'].includes(cls)
        );
        
        // Only clear if it's NOT an error
        if (notificationType !== 'error') {
            console.log('🗑️ Clearing all non-error notifications');
            this.hideNotification();
            
            // Also clear from history
            this.notificationHistory = this.notificationHistory.filter(n => n.type === 'error');
            
            // Show confirmation (briefly)
            this.showNotification('✅ All notifications cleared (errors kept)', 'success');
            setTimeout(() => {
                const currentType = document.getElementById('notification').className.split(' ').find(cls => 
                    ['success', 'info', 'error', 'warning'].includes(cls)
                );
                if (currentType !== 'error') {
                    this.hideNotification();
                }
            }, 2000);
        } else {
            // If it's an error, show message that errors cannot be cleared
            this.showNotification('⚠️ Error notifications cannot be cleared automatically. Please close them manually.', 'info');
        }
    }

    async showNotification(message, type = 'info', fromQueue = false) {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notification-text');
        
        // If notification is already visible and not an error, hide it first to prevent overlapping
        if (!notification.classList.contains('hidden') && type !== 'error') {
            // Hide current notification immediately
            notification.classList.add('hidden');
            // Clear any existing timeout
            if (this.notificationTimeout) {
                clearTimeout(this.notificationTimeout);
                this.notificationTimeout = null;
            }
            // Small delay to ensure smooth transition
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Add to history
        this.notificationHistory.push({
            message,
            type,
            timestamp: Date.now()
        });
        
        text.textContent = message;
        
        // Add 'from-queue' class if notification is from queue
        let className = `notification ${type}`;
        if (fromQueue) {
            className += ' from-queue';
        }
        notification.className = className;
        notification.classList.remove('hidden');

        // Show/hide Clear All button based on notification type
        const clearAllBtn = document.getElementById('notification-clear-all');
        if (clearAllBtn) {
            if (type === 'error') {
                clearAllBtn.style.display = 'none'; // Hide for errors
            } else {
                clearAllBtn.style.display = 'inline-block'; // Show for success/info
            }
        }

        // Clear any existing timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
            this.notificationTimeout = null;
        }

        // Auto-hide only for success and info, errors persist forever
        if (type === 'success' || type === 'info') {
            // Success notifications: 5 seconds (5000ms)
            // Info notifications: use settings duration
            let duration = type === 'success' ? 5000 : 15000; // Default 15 seconds for info
            
            if (type === 'info') {
                try {
                    const { ipcRenderer } = require('electron');
                    const settings = await ipcRenderer.invoke('get-settings');
                    duration = settings.notificationDuration || 15000;
                } catch (error) {
                    console.error('Failed to get notification duration from settings:', error);
                }
            }
            
            this.notificationTimeout = setTimeout(() => {
                // Check if notification is still visible
                const isHidden = notification.classList.contains('hidden');
                const notificationClasses = notification.className.split(' ');
                const displayedType = notificationClasses.find(cls => 
                    ['success', 'info', 'error', 'warning'].includes(cls)
                );
                
                // Auto-hide success notifications after 5s (always hide if it's success type)
                // For info, only hide if still showing info type
                if (!isHidden) {
                    if (displayedType === 'success') {
                        // Success notifications always hide after 5s
                        notification.classList.add('hidden');
                        console.log(`✅ Auto-hiding success notification after ${duration}ms`);
                    } else if (displayedType === 'info' && type === 'info') {
                        // Info notifications hide if still showing info type
                        notification.classList.add('hidden');
                        console.log(`✅ Auto-hiding info notification after ${duration}ms`);
                    }
                }
            }, duration);
        }
        // Errors don't auto-hide - user must manually close them
    }

    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        text.textContent = message;
        overlay.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showMainInterface(user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        const trackerPage = document.getElementById('tracker-page');
        if (trackerPage) {
            trackerPage.classList.add('hidden');
        }
        document.getElementById('user-name').textContent = user.username;
    }

    showLoginInterface() {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('main-interface').classList.add('hidden');
        const trackerPage = document.getElementById('tracker-page');
        if (trackerPage) {
            trackerPage.classList.add('hidden');
        }
    }

    updateSessionStatus(status) {
        const statusElement = document.getElementById('session-status');
        statusElement.textContent = status;
        statusElement.className = `step-status ${status === 'active' ? 'active' : 'ready'}`;
    }

    showScreenshotPreview(screenshotData) {
        const preview = document.getElementById('screenshot-preview');
        const image = document.getElementById('screenshot-image');
        
        if (screenshotData && screenshotData.path) {
            // Load image from local file path
            image.src = `file://${screenshotData.path}`;
            preview.classList.remove('hidden');
        }
    }

    hideScreenshotPreview() {
        document.getElementById('screenshot-preview').classList.add('hidden');
    }

    showScreenshotPopup(data) {
        const popup = document.getElementById('screenshot-popup');
        const filenameEl = document.getElementById('popup-filename');
        const urlEl = document.getElementById('popup-url');
        const timeEl = document.getElementById('popup-time');
        const imageEl = document.getElementById('popup-screenshot-image');
        const signalInput = document.getElementById('popup-signal');

        // Populate popup data
        filenameEl.textContent = data.filename || 'screenshot.png';
        // ONLY use main page URL - no auto detect
        const mainPageUrl = document.getElementById('url').value;
        urlEl.textContent = mainPageUrl || 'No URL detected';
        timeEl.textContent = new Date(data.timestamp).toLocaleString();
        
        // Load screenshot image
        if (data.path) {
            imageEl.src = `file://${data.path}`;
        }

        // Clear popup signal input and search
        signalInput.value = '';
        signalInput.dataset.value = '';
        
        // Clear signal dropdown and hide create signal form
        const signalDropdown = document.getElementById('popup-signal-dropdown');
        const createSignalSection = document.getElementById('create-signal-section');
        const showCreateSignalBtn = document.getElementById('show-create-signal-btn');
        
        if (signalDropdown) {
            signalDropdown.classList.add('hidden');
        }
        if (createSignalSection) {
            createSignalSection.classList.add('hidden');
        }
        if (showCreateSignalBtn) {
            showCreateSignalBtn.classList.remove('hidden');
        }

        // Show/hide view field based on platform
        const viewSection = document.getElementById('popup-view-section');
        const viewInput = document.getElementById('popup-view');
        
        // Get social media type from session service
        const socialMediaType = this.getCurrentSocialMediaType();
        const isFacebook = socialMediaType && socialMediaType.toLowerCase() === 'facebook';
        
        if (isFacebook) {
            if (viewSection) {
                viewSection.classList.remove('hidden');
            }
            if (viewInput) {
                viewInput.value = ''; // Clear previous value
                viewInput.required = true;
            }
        } else {
            if (viewSection) {
                viewSection.classList.add('hidden');
            }
            if (viewInput) {
                viewInput.value = '';
                viewInput.required = false;
            }
        }

        // Show popup
        popup.classList.remove('hidden');
        
        // Focus on signal input and trigger load signals
        setTimeout(() => {
            signalInput.focus();
            // Trigger load signals with empty query to show all signals
            // Dispatch custom event to trigger signal loading
            const loadSignalsEvent = new CustomEvent('loadPopupSignals', {
                detail: { page: 1, query: '', isNewSearch: true }
            });
            document.dispatchEvent(loadSignalsEvent);
        }, 100);
    }

    hideScreenshotPopup() {
        const popup = document.getElementById('screenshot-popup');
        popup.classList.add('hidden');
    }

    // Upload Queue Management
    addToUploadQueue(signalId, url, signalName = '', screenshotData, sessionData = null, userData = null, view = null) {
        // Check if session is still valid before adding to queue
        if (!screenshotData || !screenshotData.path) {
            this.showNotification('No screenshot available for upload', 'error');
            return null;
        }
        
        // Get sportId and assignedUserId from session and user data
        const sportId = sessionData?.sportId || null;
        const assignedUserId = userData?.id || null;
        
        if (!sportId || !assignedUserId) {
            this.showNotification('Missing session or user data. Please restart the app.', 'error');
            return null;
        }
        
        // Validate signalId is present
        if (!signalId) {
            this.showNotification('Please select a signal before uploading', 'error');
            return null;
        }
        
        // Get social media info from session data
        const socialMediaTypeId = sessionData?.socialMediaTypeId || null;
        const socialMediaType = sessionData?.socialMediaType || null;
        
        const queueItem = {
            id: Date.now(),
            signalId,
            url,
            signalName,
            sportId,
            assignedUserId,
            socialMediaTypeId: socialMediaTypeId,
            socialMediaType: socialMediaType,
            view: view, // View field for Facebook platform
            sessionData: sessionData, // Store full session data for later use
            filePath: screenshotData.path,
            status: 'uploading',
            timestamp: new Date(),
            error: null,
            imageUrl: null
        };
        
        this.uploadQueue.unshift(queueItem); // Add to beginning
        this.updateQueueDisplay();
        this.showQueue();
        
        // Start background upload immediately (non-blocking)
        this.uploadScreenshotBackground(queueItem).catch(error => {
            console.error('Upload failed:', error);
        });
        
        return queueItem.id;
    }

    updateQueueDisplay() {
        const queueItems = document.getElementById('queue-items');
        queueItems.innerHTML = '';
        
        this.uploadQueue.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'queue-item';
            itemEl.dataset.itemId = item.id;
            
            const statusClass = item.status === 'uploading' ? 'uploading' : 
                              item.status === 'success' ? 'success' : 
                              item.status === 'cancelled' ? 'cancelled' : 'error';
            
            itemEl.innerHTML = `
                <div class="queue-item-status ${statusClass}"></div>
                <div class="queue-item-info">
                    <div class="queue-item-url">${item.url}</div>
                    ${item.imageUrl ? `<div class="queue-item-image-url">📷 ${item.imageUrl}</div>` : ''}
                    <div class="queue-item-time">${item.timestamp.toLocaleTimeString()}</div>
                </div>
                <div class="queue-item-actions">
                    ${item.status === 'error' && item.detectedLinkId ? '<button class="queue-item-action queue-retry-btn" title="Retry Upload">🔄</button>' : ''}
                    ${item.status === 'error' ? '<button class="queue-item-action" title="View Error">⚠️</button>' : ''}
                    ${item.status === 'success' ? '<button class="queue-item-action" title="View Image">🔗</button>' : ''}
                    <button class="queue-item-action" title="Remove">🗑️</button>
                </div>
            `;
            
            // Add click handlers
            itemEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('queue-item-action')) {
                    e.stopPropagation();
                    return;
                }
                
                if (item.status === 'error') {
                    this.showErrorDetails(item);
                } else if (item.status === 'success') {
                    this.showImageUrl(item);
                } else if (item.status === 'cancelled') {
                    // Cancelled items - just show info, no error popup
                    console.log('Item cancelled:', item);
                }
            });
            
            // Action button handlers
            const retryBtn = itemEl.querySelector('.queue-retry-btn');
            const errorBtn = itemEl.querySelector('[title="View Error"]');
            const imageBtn = itemEl.querySelector('[title="View Image"]');
            const removeBtn = itemEl.querySelector('[title="Remove"]');
            
            if (retryBtn) {
                retryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.retryUpload(item.id);
                });
            }
            if (errorBtn) {
                errorBtn.addEventListener('click', () => this.showErrorDetails(item));
            }
            if (imageBtn) {
                imageBtn.addEventListener('click', () => this.showImageUrl(item));
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeFromQueue(item.id));
            }
            
            queueItems.appendChild(itemEl);
        });
    }

    showQueue() {
        const queue = document.getElementById('upload-queue');
        queue.classList.remove('hidden');
    }

    hideQueue() {
        const queue = document.getElementById('upload-queue');
        queue.classList.add('hidden');
    }

    removeFromQueue(itemId) {
        // Clear timeout if exists
        if (this.queueItemTimeouts.has(itemId)) {
            clearTimeout(this.queueItemTimeouts.get(itemId));
            this.queueItemTimeouts.delete(itemId);
        }
        
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== itemId);
        this.updateQueueDisplay();
        
        if (this.uploadQueue.length === 0) {
            this.hideQueue();
        }
    }

    scheduleQueueItemRemoval(itemId, delay = 5000) {
        // Clear existing timeout if any
        if (this.queueItemTimeouts.has(itemId)) {
            clearTimeout(this.queueItemTimeouts.get(itemId));
        }
        
        // Only remove success items, keep error items
        const timeout = setTimeout(() => {
            const item = this.uploadQueue.find(q => q.id === itemId);
            if (item && item.status === 'success') {
                console.log(`🗑️ Auto-removing success queue item after ${delay}ms:`, itemId);
                this.removeFromQueue(itemId);
            }
            this.queueItemTimeouts.delete(itemId);
        }, delay);
        
        this.queueItemTimeouts.set(itemId, timeout);
    }

    clearUploadQueue() {
        // Clear all timeouts
        this.queueItemTimeouts.forEach(timeout => clearTimeout(timeout));
        this.queueItemTimeouts.clear();
        
        this.uploadQueue = [];
        this.updateQueueDisplay();
        this.hideQueue();
        console.log('Upload queue cleared');
    }

    clearUploadQueueExceptErrors() {
        // Clear timeouts for items that will be removed
        const errorItems = this.uploadQueue.filter(item => item.status === 'error');
        const itemsToRemove = this.uploadQueue.filter(item => item.status !== 'error');
        
        itemsToRemove.forEach(item => {
            if (this.queueItemTimeouts.has(item.id)) {
                clearTimeout(this.queueItemTimeouts.get(item.id));
                this.queueItemTimeouts.delete(item.id);
            }
        });
        
        const removedCount = this.uploadQueue.length - errorItems.length;
        
        this.uploadQueue = errorItems; // Keep only error items
        this.updateQueueDisplay();
        
        if (this.uploadQueue.length === 0) {
            this.hideQueue();
        }
        
        console.log(`🗑️ Cleared ${removedCount} items from queue (kept ${errorItems.length} error items)`);
        
        // Show notification
        if (removedCount > 0) {
            this.showNotification(`✅ Removed ${removedCount} item(s) from queue (${errorItems.length} error(s) kept)`, 'success');
        } else {
            this.showNotification('⚠️ No items to remove (only errors remain)', 'info');
        }
    }

    showErrorDetails(item) {
        const errorMsg = item.error || 'Unknown error occurred';
        this.showNotification(`Upload failed: ${errorMsg}`, 'error');
        
        // Copy error URL to clipboard if available
        if (item.url) {
            navigator.clipboard.writeText(item.url);
            this.showNotification('Error URL copied to clipboard', 'info');
        }
    }

    showImageUrl(item) {
        if (item.imageUrl) {
            navigator.clipboard.writeText(item.imageUrl);
            this.showNotification('Image URL copied to clipboard', 'success');
        }
    }

    async uploadScreenshotBackground(queueItem) {
        const { signalId, url, sportId, assignedUserId, filePath } = queueItem;
        try {
            console.log('Starting background upload for queue item:', queueItem.id);
            console.log('Queue item data:', {
                signalId,
                url,
                sportId,
                assignedUserId,
                filePath
            });
            
            // Check if all required data is available
            if (!signalId || !sportId || !assignedUserId || !filePath) {
                queueItem.status = 'error';
                queueItem.error = 'Missing required data: signalId, sportId, assignedUserId, or filePath';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            // Step 1: Check if URL already exists (required for accuracy)
            console.log('🔍 Checking URL existence:', { url, sportId });
            const { ipcRenderer } = require('electron');
            const urlCheckResult = await ipcRenderer.invoke('check-url-exists', { url, sportId });
            
            // Check if check failed (network error, missing token, etc.)
            if (!urlCheckResult.success) {
                console.log('❌ Failed to check URL existence:', urlCheckResult.error);
                queueItem.status = 'error';
                queueItem.error = `Cannot check URL existence: ${urlCheckResult.error || 'Unknown error'}. Please check your connection and try again.`;
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            // Check if URL already exists
            if (urlCheckResult.exists) {
                console.log('⚠️ URL already exists in database');
                
                // Show popup asking user if they want to continue with existing detected link
                const shouldContinue = await this.showContinueWithExistingLinkPopup(queueItem);
                
                if (!shouldContinue) {
                    // User chose to cancel - not an error, just cancelled
                    queueItem.status = 'cancelled';
                    queueItem.error = 'Upload cancelled - URL already exists in database.';
                    this.updateQueueDisplay();
                    return;
                }
                
                // User chose to continue - call check-exists again to get fresh ID, then upload
                console.log('✅ User chose to continue - checking URL again to get detected link ID...');
                const freshCheckResult = await ipcRenderer.invoke('check-url-exists', { url, sportId });
                
                if (!freshCheckResult.success || !freshCheckResult.exists || !freshCheckResult.detectedLinkId) {
                    console.log('❌ Failed to get detected link ID from check-exists');
                    queueItem.status = 'error';
                    queueItem.error = 'Failed to get detected link ID. Please try again.';
                    this.updateQueueDisplay();
                    this.showErrorPopupWithDetails(queueItem);
                    return;
                }
                
                console.log('✅ Got detected link ID from check-exists:', freshCheckResult.detectedLinkId);
                queueItem.detectedLinkId = freshCheckResult.detectedLinkId;
                // Skip to upload step (skip create detected link)
                await this.uploadScreenshotWithExistingLink(queueItem);
                return;
            }
            
            console.log('✅ URL is new, proceeding with upload');
            
            // Step 2: Create detected link with signal_id
            console.log('🔗 Creating detected link for URL:', url);
            
            // Get social_media_type_id from session
            const sessionData = queueItem.sessionData || {};
            const socialMediaTypeId = sessionData.socialMediaTypeId || queueItem.socialMediaTypeId;
            const socialMediaType = sessionData.socialMediaType || queueItem.socialMediaType;
            
            // Prepare detected link data
            const detectedLinkData = {
                url: url,
                sportId: sportId,
                signalId: signalId,
                assignedUserId: assignedUserId,
                social_media_type_id: socialMediaTypeId
            };
            
            // Add view field if social media type is facebook (must be integer)
            const isFacebook = socialMediaType && socialMediaType.toLowerCase() === 'facebook';
            if (isFacebook && queueItem.view !== null && queueItem.view !== undefined) {
                // Ensure view is an integer
                const viewInt = parseInt(queueItem.view, 10);
                if (!isNaN(viewInt) && viewInt > 0) {
                    detectedLinkData.view = viewInt;
                    console.log('📘 Adding view field for Facebook platform (as int):', viewInt);
                } else {
                    console.error('❌ Invalid view value:', queueItem.view);
                    queueItem.status = 'error';
                    queueItem.error = 'Invalid view value. View must be a positive number.';
                    this.updateQueueDisplay();
                    this.showErrorPopupWithDetails(queueItem);
                    return;
                }
            }
            
            console.log('📤 Creating detected link with data:', detectedLinkData);
            const linkResult = await ipcRenderer.invoke('create-detected-link', detectedLinkData);
            
            // Handle link creation result
            if (!linkResult.success) {
                queueItem.status = 'error';
                queueItem.error = 'Failed to create detected link: ' + linkResult.error + '. Make sure backend server is running on port 8000.';
                this.updateQueueDisplay();
                this.showErrorPopupWithDetails(queueItem);
                return;
            }
            
            console.log('✅ Detected link created:', linkResult.data);
            
            // Save detectedLinkId to queueItem for retry functionality
            queueItem.detectedLinkId = linkResult.data.id;
            if (typeof window !== 'undefined' && window.dispatchEvent && queueItem.detectedLinkId) {
                window.dispatchEvent(
                    new CustomEvent('tracker-link-created', {
                        detail: { detectedLinkId: queueItem.detectedLinkId, url: queueItem.url }
                    })
                );
            }
            
            // Continue with upload (uploadScreenshotWithExistingLink handles success/error)
            await this.uploadScreenshotWithExistingLink(queueItem);
        } catch (error) {
            // Error - update queue item
            queueItem.status = 'error';
            queueItem.error = 'Failed to upload: ' + error.message;
            this.updateQueueDisplay();
            
            // Show error popup with URL and details
            this.showErrorPopupWithDetails(queueItem);
            console.log('❌ Upload error:', error);
        }
    }

    async uploadScreenshotWithExistingLink(queueItem) {
        const { filePath, detectedLinkId } = queueItem;

        try {
            // Step 1: Skip backup for speed (file already preserved in screenshots folder)
            console.log('📁 File already preserved in screenshots folder:', filePath);

            // Step 2: Upload screenshot (backend resolves storage; only file + detected_link_id)
            const uploadData = {
                filePath,
                detectedLinkId
            };
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(
                    new CustomEvent('tracker-upload-started', {
                        detail: { detectedLinkId, url: queueItem.url }
                    })
                );
            }

            console.log('📤 Uploading screenshot with data:', uploadData);
            const { ipcRenderer } = require('electron');
            const uploadResult = await ipcRenderer.invoke('upload-screenshot', uploadData);
            
            if (uploadResult.success) {
                // Success - update queue item
                queueItem.status = 'success';
                queueItem.imageUrl = uploadResult.data?.image_url || uploadResult.imageUrl;
                this.updateQueueDisplay();
                
                // Auto-remove success item after 5 seconds
                this.scheduleQueueItemRemoval(queueItem.id, 5000);
                
                // Show success notification (from queue - will appear on left side)
                this.showNotification('✅ Screenshot uploaded successfully.', 'success', true);
                console.log('✅ Upload completed successfully');
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    const imgId = uploadResult.data?.id;
                    const cmd = uploadResult.data?.command;
                    window.dispatchEvent(
                        new CustomEvent('tracker-upload-finished', {
                            detail: {
                                detectedLinkId,
                                imageId: imgId,
                                command: cmd,
                                success: true
                            }
                        })
                    );
                    if (imgId && cmd?.command_id) {
                        window.dispatchEvent(
                            new CustomEvent('tracker-image-command', {
                                detail: { imageId: imgId, commandId: cmd.command_id }
                            })
                        );
                    }
                    window.dispatchEvent(new CustomEvent('detected-link-updated'));
                }
                console.log('📁 Original file preserved:', filePath);
                
                // Auto-minimize logic:
                if (!this.wasVisibleBeforeScreenshot) {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.invoke('minimize-to-tray').then(result => {
                        if (result && result.minimized) {
                            console.log('🔽 App minimized back to tray after upload (triggered from tray)');
                        }
                    });
                } else {
                    console.log('⏭️ Window was visible before, keeping it visible');
                }
            } else {
                // Error - update queue item and show error popup
                queueItem.status = 'error';
                queueItem.error = 'Upload failed: ' + uploadResult.error;
                this.updateQueueDisplay();
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(
                        new CustomEvent('tracker-upload-finished', {
                            detail: { detectedLinkId, success: false }
                        })
                    );
                }
                
                // Show error popup with URL and details
                this.showErrorPopupWithDetails(queueItem);
                console.log('❌ Upload failed:', uploadResult.error);
            }
        } catch (error) {
            // Error - update queue item
            queueItem.status = 'error';
            queueItem.error = 'Failed to upload: ' + error.message;
            this.updateQueueDisplay();
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(
                    new CustomEvent('tracker-upload-finished', {
                        detail: { detectedLinkId, success: false }
                    })
                );
            }
            
            // Show error popup with URL and details
            this.showErrorPopupWithDetails(queueItem);
            console.log('❌ Upload error:', error);
        }
    }

    async showContinueWithExistingLinkPopup(queueItem) {
        return new Promise((resolve) => {
            // Remove existing popup if any
            const existingPopup = document.querySelector('.continue-existing-link-popup');
            if (existingPopup) {
                existingPopup.remove();
            }
            
            // Create popup
            const popup = document.createElement('div');
            popup.className = 'continue-existing-link-popup error-popup-fullscreen';
            popup.innerHTML = `
                <div class="error-popup-content-fullscreen">
                    <div class="error-popup-header-fullscreen">
                        <span class="error-icon-fullscreen">⚠️</span>
                        <h2>URL Already Exists</h2>
                        <button class="error-popup-close-btn" title="Close (ESC)">✖</button>
                    </div>
                    <div class="error-popup-body-fullscreen">
                        <p class="error-message">This URL already exists in the database.</p>
                        <div class="error-details">
                            <p>🔗 <strong>URL:</strong> ${queueItem.url}</p>
                            <p>📝 <strong>What would you like to do?</strong></p>
                            <p>You can continue and upload the screenshot to the existing detected link (e.g., if you closed the app before uploading), or cancel this upload.</p>
                        </div>
                    </div>
                    <div class="error-popup-footer-fullscreen">
                        <button class="error-popup-btn-fullscreen continue-existing-link-btn" style="background: #28a745; color: white;">
                            Continue & Upload
                        </button>
                        <button class="error-popup-btn-fullscreen cancel-existing-link-btn" style="background: #dc3545; color: white;">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(popup);
            
            // IPC handler for close-error-popup message (declare before closePopup)
            let ipcEscHandler = null;
            
            // Function to close popup
            const closePopup = () => {
                if (popup.parentNode) {
                    popup.remove();
                    if (ipcEscHandler) {
                        ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
                        ipcEscHandler = null;
                    }
                    document.removeEventListener('keydown', escHandler);
                }
            };
            
            // Continue button handler
            const continueBtn = popup.querySelector('.continue-existing-link-btn');
            continueBtn.addEventListener('click', () => {
                closePopup();
                resolve(true); // User chose to continue
            });
            
            // Cancel button handler
            const cancelBtn = popup.querySelector('.cancel-existing-link-btn');
            cancelBtn.addEventListener('click', () => {
                closePopup();
                resolve(false); // User chose to cancel
            });
            
            // Close button handler
            const closeBtn = popup.querySelector('.error-popup-close-btn');
            closeBtn.addEventListener('click', () => {
                closePopup();
                resolve(false); // Close = cancel
            });
            
            // ESC key handler
            const escHandler = (e) => {
                if (e.key === 'Escape' && popup.parentNode) {
                    e.preventDefault();
                    e.stopPropagation();
                    closePopup();
                    resolve(false); // ESC = cancel
                }
            };
            document.addEventListener('keydown', escHandler);
            
            // Set up IPC handler for close-error-popup message
            ipcEscHandler = () => {
                closePopup();
                resolve(false); // IPC close = cancel
            };
            ipcRenderer.on('close-error-popup', ipcEscHandler);
        });
    }

    async retryUpload(queueItemId) {
        const queueItem = this.uploadQueue.find(item => item.id === queueItemId);
        if (!queueItem) {
            console.error('Queue item not found:', queueItemId);
            return;
        }
        
        // Check if detectedLinkId exists (only retry if detected link was created)
        if (!queueItem.detectedLinkId) {
            this.showNotification('Cannot retry: No detected link ID. Please upload again.', 'error');
            return;
        }
        
        // Check if file still exists - use IPC to check file exists (more reliable)
        let filePath = queueItem.filePath;
        
        // Check file exists via IPC (safer than direct fs access in renderer)
        const fileExistsResult = await ipcRenderer.invoke('check-file-exists', filePath);
        
        if (!fileExistsResult.exists) {
            console.log('⚠️ Original file not found, searching in screenshots folder...');
            
            // Get screenshots folder path via IPC
            const screenshotsPathResult = await ipcRenderer.invoke('get-screenshots-path');
            if (!screenshotsPathResult.success || !screenshotsPathResult.path) {
                this.showNotification('❌ Cannot retry: Screenshots folder not found.', 'error');
                return;
            }
            
            const screenshotsDir = screenshotsPathResult.path;
            const findFileResult = await ipcRenderer.invoke('find-file-in-screenshots', {
                fileName: require('path').basename(filePath),
                screenshotsDir: screenshotsDir
            });
            
            if (findFileResult.success && findFileResult.filePath) {
                filePath = findFileResult.filePath;
                console.log('✅ Found file in screenshots folder:', filePath);
            } else {
                this.showNotification('❌ Cannot retry: Screenshot file not found in screenshots folder.', 'error');
                return;
            }
        }
        
        // Update queue item status
        queueItem.status = 'uploading';
        queueItem.error = null;
        queueItem.filePath = filePath; // Update filePath in case it was found in different location
        this.updateQueueDisplay();
        
        // Retry upload - only upload, no need to create detected link
        try {
            console.log('🔄 Retrying upload for detected link ID:', queueItem.detectedLinkId);
            
            const uploadData = {
                filePath,
                detectedLinkId: queueItem.detectedLinkId
            };
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(
                    new CustomEvent('tracker-upload-started', {
                        detail: { detectedLinkId: queueItem.detectedLinkId, url: queueItem.url }
                    })
                );
            }

            console.log('📤 Retrying upload with data:', uploadData);
            const uploadResult = await ipcRenderer.invoke('upload-screenshot', uploadData);
            
            if (uploadResult.success) {
                // Success - update queue item
                queueItem.status = 'success';
                queueItem.imageUrl = uploadResult.data?.image_url || uploadResult.imageUrl;
                this.updateQueueDisplay();
                
                // Auto-remove success item after 5 seconds
                this.scheduleQueueItemRemoval(queueItem.id, 5000);
                
                // Show success notification (from queue - will appear on left side)
                this.showNotification('✅ Retry successful! Screenshot uploaded.', 'success', true);
                console.log('✅ Retry upload completed successfully');
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    const imgId = uploadResult.data?.id;
                    const cmd = uploadResult.data?.command;
                    window.dispatchEvent(
                        new CustomEvent('tracker-upload-finished', {
                            detail: {
                                detectedLinkId: queueItem.detectedLinkId,
                                imageId: imgId,
                                command: cmd,
                                success: true
                            }
                        })
                    );
                    if (imgId && cmd?.command_id) {
                        window.dispatchEvent(
                            new CustomEvent('tracker-image-command', {
                                detail: { imageId: imgId, commandId: cmd.command_id }
                            })
                        );
                    }
                    window.dispatchEvent(new CustomEvent('detected-link-updated'));
                }
            } else {
                // Error - update queue item
                queueItem.status = 'error';
                queueItem.error = 'Retry failed: ' + uploadResult.error;
                this.updateQueueDisplay();
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(
                        new CustomEvent('tracker-upload-finished', {
                            detail: { detectedLinkId: queueItem.detectedLinkId, success: false }
                        })
                    );
                }
                
                // Show error popup with details
                this.showErrorPopupWithDetails(queueItem);
                console.log('❌ Retry upload failed:', uploadResult.error);
            }
        } catch (error) {
            // Error - update queue item
            queueItem.status = 'error';
            queueItem.error = 'Retry failed: ' + error.message;
            this.updateQueueDisplay();
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(
                    new CustomEvent('tracker-upload-finished', {
                        detail: { detectedLinkId: queueItem.detectedLinkId, success: false }
                    })
                );
            }
            
            // Show error popup with details
            this.showErrorPopupWithDetails(queueItem);
            console.log('❌ Retry upload error:', error);
        }
    }

    showErrorPopupWithDetails(queueItem) {
        // Remove existing error popup if any
        const existingPopup = document.querySelector('.error-popup-fullscreen');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // Create error popup with URL and details
        const popup = document.createElement('div');
        popup.className = 'error-popup-fullscreen';
        popup.innerHTML = `
            <div class="error-popup-content-fullscreen">
                <div class="error-popup-header-fullscreen">
                    <span class="error-icon-fullscreen">❌</span>
                    <h2>Upload Failed!</h2>
                    <button class="error-popup-close-btn" title="Close (ESC)">✖</button>
                </div>
                <div class="error-popup-body-fullscreen">
                    <p class="error-message">${queueItem.error}</p>
                    <div class="error-details">
                        <p>🔗 <strong>Failed URL:</strong></p>
                        <p class="error-url">${queueItem.url}</p>
                        <p>⏰ <strong>Time:</strong> ${queueItem.timestamp.toLocaleString()}</p>
                        <p>📝 <strong>What to do?</strong></p>
                        <p>Check your internet connection and try again, or contact support if the problem persists.</p>
                    </div>
                </div>
                <div class="error-popup-footer-fullscreen">
                    <button class="error-popup-btn-fullscreen error-popup-close-action">
                        Got it! I'll try again
                    </button>
                    <button class="error-popup-btn-fullscreen error-copy-url">
                        Copy URL
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // IPC handler for close-error-popup message from main process (declare before closePopup)
        let ipcEscHandler = null;
        
        // Function to close popup
        const closePopup = () => {
            if (popup.parentNode) {
                popup.remove();
                // Clean up IPC listener
                if (ipcEscHandler) {
                    ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
                    ipcEscHandler = null;
                }
            }
        };
        
        // Close button handler
        const closeBtn = popup.querySelector('.error-popup-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closePopup);
        }
        
        // Close action button handler
        const closeActionBtn = popup.querySelector('.error-popup-close-action');
        if (closeActionBtn) {
            closeActionBtn.addEventListener('click', closePopup);
        }
        
        // Copy URL button handler
        const copyUrlBtn = popup.querySelector('.error-copy-url');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(queueItem.url).then(() => {
                    copyUrlBtn.textContent = 'URL Copied!';
                    setTimeout(() => {
                        copyUrlBtn.textContent = 'Copy URL';
                    }, 2000);
                });
            });
        }
        
        // ESC key handler (local) - backup in case global handler doesn't catch it
        const escHandler = (e) => {
            if (e.key === 'Escape' && popup.parentNode) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Local ESC handler - closing error popup');
                closePopup();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Set up IPC handler for close-error-popup message from main process
        ipcEscHandler = () => {
            console.log('IPC close-error-popup received - closing error popup');
            closePopup();
        };
        ipcRenderer.on('close-error-popup', ipcEscHandler);
        
        // Auto remove after 15 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                closePopup();
                document.removeEventListener('keydown', escHandler);
            }
        }, 15000);
    }

    showSystemNotification() {
        // Create system notification
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('URL Already Exists!', {
                    body: 'The URL you\'re trying to capture already exists in our database. Please navigate to a different URL.',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4757"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                    tag: 'url-exists-error',
                    requireInteraction: true
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification('URL Already Exists!', {
                            body: 'The URL you\'re trying to capture already exists in our database. Please navigate to a different URL.',
                            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff4757"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
                            tag: 'url-exists-error',
                            requireInteraction: true
                        });
                    }
                });
            }
        }
    }

    flashWindow() {
        // Flash window to get attention
        try {
            ipcRenderer.send('flash-window');
        } catch (e) {
            console.log('Could not flash window:', e);
        }
    }

    playErrorSound() {
        // Create error sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Fallback: use system beep
            console.log('\a'); // ASCII bell character
        }
    }
}

module.exports = UiService;
