// Modern JavaScript for Electron Desktop App
const { ipcRenderer } = require('electron');
const config = require('./app.config');

// Import modules
const UiService = require('./modules/ui/uiService');
const SessionService = require('./modules/session/sessionService');
const SettingsUIHandler = require('./modules/settings/settingsUIHandler');
const ApiService = require('./modules/api/apiService');

class TestAutomationDesktopApp {
    constructor() {
        this.currentUser = null;
        this.screenshotData = null;
        this.signals = [];
        this.apiBaseUrl = config.apiBaseUrl; // Use config from app.config.js
        
        // Store sport data for bucket name
        this.currentLeague = null;
        this.currentMatchName = null;
        
        // Initialize services
        this.uiService = new UiService();
        this.sessionService = new SessionService();
        this.settingsUIHandler = new SettingsUIHandler();
        this.apiService = new ApiService();
        
        // Link session service to UI service
        this.uiService.setSessionService(this.sessionService);
        
        this.init();
    }

    async init() {
        await this.loadEnvironment();
        this.bindEvents();
        this.setupWindowControls();
        this.checkConnection();
    }

    async loadEnvironment() {
        try {
            // Get config from main process
            const config = await ipcRenderer.invoke('get-config');
            this.apiBaseUrl = config.apiBaseUrl;
            console.log('🔧 Loaded config from main process:', config);
            console.log('🌐 API Base URL:', this.apiBaseUrl);
        } catch (error) {
            console.error('❌ Failed to load config from main process:', error);
            // Keep default API URL from config
            console.log('🌐 Using config API Base URL:', this.apiBaseUrl);
        }
    }

    bindEvents() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Start session
        document.getElementById('start-session-btn').addEventListener('click', () => {
            this.startSession();
        });

        // Stop session
        document.getElementById('stop-session-btn').addEventListener('click', () => {
            this.stopSession();
        });

        // Take screenshot
        document.getElementById('take-screenshot-btn').addEventListener('click', () => {
            this.takeScreenshot();
        });

        // Detect URL
        document.getElementById('detect-url-btn').addEventListener('click', () => {
            this.detectUrl();
        });

        // Detect URL from clipboard
        document.getElementById('detect-clipboard-btn').addEventListener('click', () => {
            this.detectUrlFromClipboard();
        });

        // Single input functionality for all dropdowns (setup only, no data loading)
        this.setupSingleInputHandlers('region', 'regions', 'region_name', this.loadRegions.bind(this));
        this.setupSingleInputHandlers('sport', 'sports', 'league', this.loadSports.bind(this));
        this.setupSingleInputHandlers('signal', 'signals', 'signal_name', this.loadSignals.bind(this));
        
        // Don't load social media platforms here - wait for login
        
        // Popup signal (same logic as main signal)
        this.setupSingleInputHandlers('popup-signal', 'signals', 'signal_name', this.loadPopupSignals.bind(this));
        
        // Create signal functionality
        this.setupCreateSignalHandlers();
        
        // Listen for custom event to load popup signals
        document.addEventListener('loadPopupSignals', (event) => {
            const { page, query, isNewSearch } = event.detail;
            this.loadPopupSignals(page, query, isNewSearch);
        });

        // Sport filter inputs - reload sports when filters change
        this.setupSportFilterListeners();

        // Global keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Upload queue system - ENABLED (background processing)
        // Note: Upload queue is now handled by UiService

        // Upload screenshot
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.uploadScreenshot();
        });

        // Cancel screenshot
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.cancelScreenshot();
        });

        // Screenshot preview actions
        document.getElementById('confirm-upload-btn').addEventListener('click', () => {
            this.confirmUpload();
        });

        document.getElementById('cancel-upload-btn').addEventListener('click', () => {
            this.cancelUpload();
        });

        // Popup actions
        document.getElementById('popup-ok-btn').addEventListener('click', () => {
            this.handlePopupOk();
        });

        document.getElementById('popup-cancel-btn').addEventListener('click', () => {
            this.handlePopupCancel();
        });

        document.getElementById('popup-close-btn').addEventListener('click', () => {
            this.handlePopupCancel();
        });

        document.getElementById('popup-open-location-btn').addEventListener('click', () => {
            this.openScreenshotLocation();
        });

        // IPC events from main process (optimized for speed)
        ipcRenderer.on('screenshot-taken', (event, data) => {
            this.handleScreenshotTaken(data);
        });

        ipcRenderer.on('screenshot-failed', (event, data) => {
            this.showNotification('Screenshot failed: ' + data.error, 'error');
            this.hideLoading();
        });

        // Track if window was visible before screenshot (for auto-minimize logic)
        ipcRenderer.on('screenshot-visibility-state', (event, data) => {
            if (this.uiService) {
                this.uiService.wasVisibleBeforeScreenshot = data.wasVisibleBeforeScreenshot;
                console.log('📊 Window visibility state before screenshot:', data.wasVisibleBeforeScreenshot);
            }
        });

        ipcRenderer.on('url-already-exists', (event, data) => {
            this.showErrorPopup(data.message);
        });

        ipcRenderer.on('url-detected', (event, url) => {
            this.handleUrlDetected(url);
        });

        ipcRenderer.on('url-detection-failed', (event, error) => {
            this.showNotification('URL detection failed: ' + error, 'error');
        });

        ipcRenderer.on('url-detection-request', (event, message) => {
            this.showNotification(message, 'info');
        });

        ipcRenderer.on('trigger-extension-url', (event) => {
            this.triggerExtensionUrlDetection();
        });

        // Hotkey triggers
        ipcRenderer.on('trigger-upload', (event) => {
            this.uploadScreenshot();
        });

        ipcRenderer.on('trigger-cancel', (event) => {
            this.cancelScreenshot();
        });

        // Listen for open settings from tray menu
        ipcRenderer.on('open-settings', () => {
            if (this.settingsUIHandler) {
                this.settingsUIHandler.openSettings();
            }
        });

        // Update check events
        ipcRenderer.on('update-check-start', () => {
            this.showNotification('🔍 Đang kiểm tra cập nhật...', 'info');
        });

        // Update available - new version found
        ipcRenderer.on('update-available', (event, info) => {
            console.log('Update available:', info);
            const version = info.version || 'mới';
            this.showNotification(`🎉 Phiên bản ${version} đang được tải xuống...`, 'info', true);
        });

        // Update download progress
        ipcRenderer.on('update-progress', (event, progress) => {
            // Handle both old format (just percent) and new format (object)
            let percent, transferred, total;
            if (typeof progress === 'number') {
                percent = progress;
            } else {
                percent = progress.percent || 0;
                transferred = progress.transferred;
                total = progress.total;
            }
            
            const message = total 
                ? `📥 Đang tải cập nhật: ${percent}% (${transferred}MB / ${total}MB)`
                : `📥 Đang tải cập nhật: ${percent}%`;
            
            // Update notification (show persistent notification during download)
            this.showNotification(message, 'info', true);
        });

        ipcRenderer.on('update-downloading', () => {
            this.showNotification('📥 Đang tải xuống cập nhật...', 'info', true);
        });

        ipcRenderer.on('update-error', (event, error) => {
            console.error('Update error:', error);
            const message = error.message || 'Không thể kiểm tra cập nhật';
            this.showNotification(`❌ Lỗi cập nhật: ${message}`, 'error');
        });
    }

    setupWindowControls() {
        // Window control buttons
        document.getElementById('minimize-btn').addEventListener('click', () => {
            ipcRenderer.invoke('minimize-window');
        });

        document.getElementById('maximize-btn').addEventListener('click', () => {
            ipcRenderer.invoke('toggle-maximize-window');
        });

        document.getElementById('close-btn').addEventListener('click', () => {
            ipcRenderer.invoke('close-window');
        });
    }




    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }



    setupSingleInputHandlers(inputId, apiEndpoint, searchParam, loadFunction) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(`${inputId}-dropdown`);
        const optionsContainer = document.getElementById(`${inputId}-options`);
        
        // Track state
        let currentPage = 1;
        let isLoading = false;
        let hasMoreData = true;
        let currentQuery = '';
        let selectedIndex = -1;
        let currentRegionId = null;
        let debounceTimeout = null; // For debouncing sport search
        
        // For sport, sync hasMoreData with instance variable
        if (inputId === 'sport') {
            // Initialize hasMoreSports if not exists
            if (this.hasMoreSports === undefined) {
                this.hasMoreSports = true;
            }
        }
        
        // For social-media, sync hasMoreData with instance variable
        if (inputId === 'social-media') {
            // Initialize hasMoreSocialMedia if not exists
            if (this.hasMoreSocialMedia === undefined) {
                this.hasMoreSocialMedia = true;
            }
        }
        
        // DON'T load initial data here - wait for user interaction
        
        // Input focus - show dropdown and load data if needed
        input.addEventListener('focus', async () => {
            console.log(`Focus on ${inputId}, children:`, optionsContainer.children.length);
            
            // Load initial data on first focus
            if (optionsContainer.children.length === 0) {
                if (inputId === 'sport') {
                    // For sports, wait for region selection
                    console.log('Sport input focused but no region selected yet');
                    return;
                } else {
                    console.log(`Loading initial data for ${inputId}`);
                    await loadFunction(1, '', true);
                }
            }
            
            // Always show dropdown when focused
            console.log(`Showing dropdown for ${inputId}`);
            dropdown.classList.remove('hidden');
        });
        
        // Input typing - search with debounce for sport
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentQuery = query;
            currentPage = 1;
            hasMoreData = true;
            selectedIndex = -1;
            
            // Reset hasMoreSports for sport
            if (inputId === 'sport') {
                this.hasMoreSports = true;
            }
            
            // Reset hasMoreSocialMedia for social-media
            if (inputId === 'social-media') {
                this.hasMoreSocialMedia = true;
            }
            
            // Clear previous debounce timeout
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            
            // For sport, add debounce (300ms) to avoid too many API calls
            const debounceDelay = inputId === 'sport' ? 300 : 0;
            
            debounceTimeout = setTimeout(() => {
                if (query.length >= 1) {
                    dropdown.classList.remove('hidden');
                    if (inputId === 'sport' && currentRegionId) {
                        loadFunction(currentRegionId, 1, query, true);
                    } else {
                        loadFunction(1, query, true);
                    }
                } else if (query.length === 0) {
                    if (inputId === 'sport' && currentRegionId) {
                        loadFunction(currentRegionId, 1, '', true);
                    } else {
                        loadFunction(1, '', true);
                    }
                }
            }, debounceDelay);
        });
        
        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const options = optionsContainer.querySelectorAll(`.${inputId}-option`);
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
                this.updateSelection(options, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.updateSelection(options, selectedIndex);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && options[selectedIndex]) {
                    this.selectOption(options[selectedIndex], inputId);
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.add('hidden');
                selectedIndex = -1;
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
        
        const self = this; // Store reference to 'this' for use in closure
        
        // Infinite scroll on dropdown
        dropdown.addEventListener('scroll', () => {
            const scrollTop = dropdown.scrollTop;
            const scrollHeight = dropdown.scrollHeight;
            const clientHeight = dropdown.clientHeight;
            
            // Check if we can load more - for sport and social-media, also check instance variable
            let canLoadMore = hasMoreData;
            if (inputId === 'sport') {
                canLoadMore = hasMoreData && (self.hasMoreSports !== false);
            } else if (inputId === 'social-media') {
                canLoadMore = hasMoreData && (self.hasMoreSocialMedia !== false);
            }
            
            // Trigger when scrolled to 80%
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && !isLoading && canLoadMore) {
                loadMoreData();
            }
        });
        async function loadMoreData() {
            // Check hasMoreData - for sport and social-media, also check instance variable
            let canLoadMore = hasMoreData;
            if (inputId === 'sport') {
                canLoadMore = hasMoreData && (self.hasMoreSports !== false);
            } else if (inputId === 'social-media') {
                canLoadMore = hasMoreData && (self.hasMoreSocialMedia !== false);
            }
                
            if (isLoading || !canLoadMore) return;
            
            isLoading = true;
            currentPage++;
            
            try {
                if (inputId === 'sport' && currentRegionId) {
                    await loadFunction(currentRegionId, currentPage, currentQuery, false);
                } else {
                    await loadFunction(currentPage, currentQuery, false);
                }
                
                // Update hasMoreData based on instance variable for sport and social-media
                if (inputId === 'sport') {
                    hasMoreData = self.hasMoreSports !== false;
                } else if (inputId === 'social-media') {
                    hasMoreData = self.hasMoreSocialMedia !== false;
                }
            } catch (error) {
                console.error(`Error loading more ${inputId}:`, error);
                currentPage--;
            } finally {
                isLoading = false;
            }
        }
        
        // Special handling for sports - track region changes
        if (inputId === 'sport') {
            const regionInput = document.getElementById('region');
            regionInput.addEventListener('change', (e) => {
                // Get region ID from dataset, not input value
                currentRegionId = e.target.dataset.value;
                currentPage = 1;
                hasMoreData = true;
                currentQuery = '';
                
                // Reset hasMoreSports when region changes
                this.hasMoreSports = true;
                
                if (currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    optionsContainer.innerHTML = '';
                }
            });
        }
        
        // Special handling for social-media - track pagination
        if (inputId === 'social-media') {
            // Initialize hasMoreSocialMedia if not exists
            if (this.hasMoreSocialMedia === undefined) {
                this.hasMoreSocialMedia = true;
            }
        }
    }

    updateSelection(options, selectedIndex) {
        options.forEach((option, index) => {
            option.classList.toggle('selected', index === selectedIndex);
        });
    }

    parseAndStoreSportData(sportText) {
        // Parse sport data from format: "PL 25_26 - 18/10/2025 18:29 - Nottingham Forest - Chelsea"
        if (sportText && sportText.includes(' - ')) {
            const sportParts = sportText.split(' - ');
            if (sportParts.length >= 3) {
                this.currentLeague = sportParts[0].trim(); // "PL 25_26"
                // Join all parts from index 2 onwards to get full match name
                this.currentMatchName = sportParts.slice(2).join(' - ').trim(); // "Nottingham Forest - Chelsea"
                
                console.log('🏈 Sport data parsed:', {
                    league: this.currentLeague,
                    matchName: this.currentMatchName,
                    fullText: sportText,
                    parts: sportParts
                });
            }
        } else {
            // Clear if no valid format
            this.currentLeague = null;
            this.currentMatchName = null;
        }
    }

    selectOption(option, inputId) {
        const value = option.dataset.value;
        const text = option.textContent;
        const input = document.getElementById(inputId);
        
        // Set the selected value and store the ID
        input.value = text;
        input.dataset.value = value;
        
        // Store type for social media (to check if it's facebook)
        if (inputId === 'social-media') {
            const type = option.dataset.type || '';
            input.dataset.type = type;
            console.log('📱 Selected social media:', { id: value, type: type, text: text });
        }
        
        // Parse and store sport data when sport is selected
        if (inputId === 'sport') {
            this.parseAndStoreSportData(text);
        }
        
        // Trigger change event so other handlers can react
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
        
        // Hide dropdown
        document.getElementById(`${inputId}-dropdown`).classList.add('hidden');
        
        // Show success
        this.showNotification(`${inputId} selected: ${text}`, 'success');
        
        // Special handling for region -> load sports
        if (inputId === 'region') {
            this.loadSports(value, 1, '', true);
        }
    }

    setupSportFilterListeners() {
        // Get all sport filter inputs
        const leagueInput = document.getElementById('sport-league');
        const matchNameInput = document.getElementById('sport-match-name');
        const startTimeInput = document.getElementById('sport-start-time');
        
        const reloadSports = () => {
            const regionInput = document.getElementById('region');
            const regionId = regionInput?.dataset.value;
            
            // Only reload if region is selected
            if (regionId) {
                this.loadSports(regionId, 1, '', true);
            }
        };
        
        // Add event listeners for ENTER key and BLUR (click outside)
        const filterInputs = [leagueInput, matchNameInput];
        
        filterInputs.forEach(input => {
            if (input) {
                // Reload on Enter key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        reloadSports();
                    }
                });
                
                // Reload when user clicks outside (blur)
                input.addEventListener('blur', () => {
                    reloadSports();
                });
            }
        });
        
        // For start time inputs (date + hour + minute), reload on change
        const startTimeDateInput = document.getElementById('sport-start-time-date');
        const startTimeHourInput = document.getElementById('sport-start-time-hour');
        const startTimeMinuteInput = document.getElementById('sport-start-time-minute');
        
        // Function to validate and format time inputs
        const validateTimeInput = (input, max) => {
            const value = parseInt(input.value, 10);
            if (isNaN(value) || value < 0) {
                input.value = '';
            } else if (value > max) {
                input.value = max;
            } else {
                // Pad with zero if needed
                input.value = String(value).padStart(2, '0');
            }
        };
        
        if (startTimeDateInput) {
            startTimeDateInput.addEventListener('change', () => {
                const dateValue = startTimeDateInput.value;
                if (dateValue) {
                    // Auto-set hour and minute to 00:00 when date is selected
                    if (startTimeHourInput && !startTimeHourInput.value) {
                        startTimeHourInput.value = '00';
                    }
                    if (startTimeMinuteInput && !startTimeMinuteInput.value) {
                        startTimeMinuteInput.value = '00';
                    }
                } else {
                    // Clear hour and minute when date is cleared
                    if (startTimeHourInput) {
                        startTimeHourInput.value = '';
                    }
                    if (startTimeMinuteInput) {
                        startTimeMinuteInput.value = '';
                    }
                }
                // Update visibility immediately
                this.updateSportWeekInfoVisibility();
                reloadSports();
            });
            // Also handle input event for immediate feedback when typing/clearing
            startTimeDateInput.addEventListener('input', () => {
                const dateValue = startTimeDateInput.value;
                if (!dateValue) {
                    // Clear hour and minute when date is cleared
                    if (startTimeHourInput) {
                        startTimeHourInput.value = '';
                    }
                    if (startTimeMinuteInput) {
                        startTimeMinuteInput.value = '';
                    }
                }
                this.updateSportWeekInfoVisibility();
            });
        }
        
        if (startTimeHourInput) {
            startTimeHourInput.addEventListener('input', (e) => {
                validateTimeInput(e.target, 23);
                // Update visibility immediately
                this.updateSportWeekInfoVisibility();
            });
            startTimeHourInput.addEventListener('blur', (e) => {
                validateTimeInput(e.target, 23);
                if (e.target.value) {
                    e.target.value = String(parseInt(e.target.value, 10)).padStart(2, '0');
                }
                // Update visibility immediately
                this.updateSportWeekInfoVisibility();
                reloadSports();
            });
        }
        
        if (startTimeMinuteInput) {
            startTimeMinuteInput.addEventListener('input', (e) => {
                validateTimeInput(e.target, 59);
                // Update visibility immediately
                this.updateSportWeekInfoVisibility();
            });
            startTimeMinuteInput.addEventListener('blur', (e) => {
                validateTimeInput(e.target, 59);
                if (e.target.value) {
                    e.target.value = String(parseInt(e.target.value, 10)).padStart(2, '0');
                }
                // Update visibility immediately
                this.updateSportWeekInfoVisibility();
                reloadSports();
            });
        }
    }

    // Calculate week range (Monday to Sunday) for a given date
    getWeekRange(date = new Date()) {
        // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const dayOfWeek = date.getDay();
        
        // Calculate days to Monday (if Sunday, go back 6 days; otherwise go back dayOfWeek - 1 days)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        // Calculate Monday of the week
        const monday = new Date(date);
        monday.setDate(date.getDate() - daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        // Calculate Sunday of the week (6 days after Monday)
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return {
            monday: monday,
            sunday: sunday
        };
    }

    // Format date to yyyy-mm-dd HH:MM format
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    // Format date to DD/MM/YYYY for display
    formatDateDisplay(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Update sport week info display
    updateSportWeekInfo(monday, sunday) {
        const weekInfoEl = document.getElementById('sport-week-info');
        const weekStartEl = document.getElementById('sport-week-start');
        const weekEndEl = document.getElementById('sport-week-end');
        
        if (weekInfoEl && weekStartEl && weekEndEl) {
            weekStartEl.textContent = this.formatDateDisplay(monday);
            weekEndEl.textContent = this.formatDateDisplay(sunday);
            weekInfoEl.style.display = 'block';
        }
    }

    updateSportWeekInfoVisibility() {
        // Check if start-time filter has any value
        const startTimeDateInput = document.getElementById('sport-start-time-date');
        const startTimeHourInput = document.getElementById('sport-start-time-hour');
        const startTimeMinuteInput = document.getElementById('sport-start-time-minute');
        
        const hasDate = startTimeDateInput?.value;
        const hasHour = startTimeHourInput?.value;
        const hasMinute = startTimeMinuteInput?.value;
        const hasFilter = hasDate || hasHour || hasMinute;
        
        const weekInfoEl = document.getElementById('sport-week-info');
        if (weekInfoEl) {
            if (hasFilter) {
                // Hide when filter is applied
                weekInfoEl.style.display = 'none';
            } else {
                // Show week info when no filter - calculate current week
                const weekRange = this.getWeekRange();
                this.updateSportWeekInfo(weekRange.monday, weekRange.sunday);
            }
        }
    }

    // Convert DD/MM/YYYY HH:MM to yyyy-mm-dd HH:MM format (24-hour format only)
    convertDateFormat(inputValue) {
        if (!inputValue || !inputValue.trim()) {
            return null;
        }
        
        // Try to parse DD/MM/YYYY HH:MM format (24-hour: 00:00 - 23:59)
        // Example: 14/11/2025 23:30
        const pattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
        const match = inputValue.trim().match(pattern);
        
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            const hours = parseInt(match[4], 10);
            const minutes = parseInt(match[5], 10);
            
            // Validate hours (00-23) and minutes (00-59)
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                return null; // Invalid time
            }
            
            const hoursStr = String(hours).padStart(2, '0');
            const minutesStr = String(minutes).padStart(2, '0');
            
            // Validate date
            const date = new Date(`${year}-${month}-${day}T${hoursStr}:${minutesStr}`);
            if (date.getDate() == parseInt(day, 10) && date.getMonth() + 1 == parseInt(month, 10) && date.getFullYear() == parseInt(year, 10)) {
                return `${year}-${month}-${day} ${hoursStr}:${minutesStr}`;
            }
        }
        
        // If format doesn't match, return null (invalid format)
        return null;
    }

    setupDropdownInfiniteScroll(dropdownId, apiEndpoint, searchParam, loadFunction) {
        const dropdown = document.getElementById(dropdownId);
        const searchInput = document.getElementById(`${dropdownId}-search`);
        
        // Track pagination state
        let currentPage = 1;
        let isLoading = false;
        let hasMoreData = true;
        let currentQuery = '';
        let currentRegionId = null;
        
        // Load initial data
        if (dropdownId === 'sport') {
            // For sports, wait for region selection
            return;
        } else {
            loadFunction(1, '', true);
        }
        
        // Search input handler
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentQuery = query;
            currentPage = 1;
            hasMoreData = true;
            
            // Clear dropdown
            dropdown.innerHTML = '<option value="">Select...</option>';
            
            if (query.length >= 2) {
                if (dropdownId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, query, true);
                } else {
                    loadFunction(1, query, true);
                }
            } else if (query.length === 0) {
                if (dropdownId === 'sport' && currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    loadFunction(1, '', true);
                }
            }
        });
        
        // Infinite scroll on dropdown
        dropdown.addEventListener('scroll', () => {
            const scrollTop = dropdown.scrollTop;
            const scrollHeight = dropdown.scrollHeight;
            const clientHeight = dropdown.clientHeight;
            
            // Trigger when scrolled to 80% (item 8/10)
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && !isLoading && hasMoreData) {
                loadMoreData();
            }
        });
        
        async function loadMoreData() {
            if (isLoading || !hasMoreData) return;
            
            isLoading = true;
            currentPage++;
            
            try {
                if (dropdownId === 'sport' && currentRegionId) {
                    await loadFunction(currentRegionId, currentPage, currentQuery, false);
                } else {
                    await loadFunction(currentPage, currentQuery, false);
                }
            } catch (error) {
                console.error(`Error loading more ${dropdownId}:`, error);
                currentPage--; // Revert page on error
            } finally {
                isLoading = false;
            }
        }
        
        // Special handling for sports - track region changes
        if (dropdownId === 'sport') {
            const regionSelect = document.getElementById('region');
            regionSelect.addEventListener('change', (e) => {
                currentRegionId = e.target.value;
                currentPage = 1;
                hasMoreData = true;
                currentQuery = '';
                
                if (currentRegionId) {
                    loadFunction(currentRegionId, 1, '', true);
                } else {
                    dropdown.innerHTML = '<option value="">Select Sport...</option>';
                }
            });
        }
    }

    async checkConnection() {
        try {
            // Check if Python hybrid server is running
            const response = await this.apiCall('GET', '/status');
            if (response.user) {
                this.showMainInterface(response.user);
            }
        } catch (error) {
            console.log('Python hybrid server not running or not logged in');
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginButton = document.querySelector('#login-form button');
        const usernameGroup = document.querySelector('#username').closest('.form-group');
        const passwordGroup = document.querySelector('#password').closest('.form-group');

        // Clear previous states
        usernameGroup.classList.remove('error', 'success');
        passwordGroup.classList.remove('error', 'success');

        if (!username || !password) {
            this.showNotification('Please enter username and password', 'error');
            if (!username) {
                usernameGroup.classList.add('error');
                document.getElementById('username').focus();
            }
            if (!password) {
                passwordGroup.classList.add('error');
                document.getElementById('password').focus();
            }
            return;
        }

        try {
            // Add loading state to button
            loginButton.classList.add('loading');
            loginButton.textContent = 'Logging in...';
            loginButton.disabled = true;
            
            this.showLoading('Logging in...');
            
            console.log('🔐 Attempting login to:', `${this.apiBaseUrl}/auth/login`);
            console.log('👤 Username:', username);
            
            // Use form data for OAuth2PasswordRequestForm
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData
            });
            
            if (!response.ok) {
                console.error('❌ Login failed:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
                console.error('❌ Error details:', errorData);
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Store access token
            this.accessToken = result.access_token;
            
            // Get user info first
            const userResponse = await fetch(`${this.apiBaseUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                this.currentUser = userData;
                
                // Set user in session service
                this.sessionService.setCurrentUser(userData);
                
                // Set access token for apiService in renderer
                this.apiService.setAccessToken(this.accessToken, userData);
                
                // Set access token and user info in main process
                await ipcRenderer.invoke('set-access-token', { 
                    token: this.accessToken, 
                    user: userData 
                });
                
                // Add success states
                usernameGroup.classList.add('success');
                passwordGroup.classList.add('success');
                
                // Show success animation
                setTimeout(() => {
                    this.showMainInterface(userData);
                    this.showNotification('Login successful!', 'success');
                    // Load social media platforms after login
                    this.loadSocialMediaRadioButtons();
                }, 500);
            } else {
                throw new Error('Failed to get user info');
            }
        } catch (error) {
            // Add error states
            usernameGroup.classList.add('error');
            passwordGroup.classList.add('error');
            this.showNotification('Login failed: ' + error.message, 'error');
        } finally {
            // Reset button state
            loginButton.classList.remove('loading');
            loginButton.textContent = 'Login';
            loginButton.disabled = false;
            this.hideLoading();
        }
    }

    handleLogout() {
        // Reset all data
        this.currentUser = null;
        this.currentSession = null;
        this.screenshotData = null;
        this.accessToken = null;
        
        // Clear stored sport data
        this.currentLeague = null;
        this.currentMatchName = null;
        
        // Clear session service
        this.sessionService.resetSession();
        
        // Clear upload queue
        this.uiService.clearUploadQueue();
        
        // Reset UI elements
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('main-interface').classList.add('hidden');
        
        // Reset form fields
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        document.getElementById('url').value = '';
        document.getElementById('bucket-name').value = '';
        
        // Reset input fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        
        // Clear dataset values
        document.getElementById('region').dataset.value = '';
        document.getElementById('sport').dataset.value = '';
        document.getElementById('signal').dataset.value = '';
        
        // Hide dropdowns
        document.getElementById('region-dropdown').classList.add('hidden');
        document.getElementById('sport-dropdown').classList.add('hidden');
        document.getElementById('signal-dropdown').classList.add('hidden');
        
        // Reset form states
        document.getElementById('region').disabled = false;
        document.getElementById('sport').disabled = false;
        document.getElementById('start-session-btn').disabled = false;
        document.getElementById('stop-session-btn').classList.add('hidden');
        
        // Reset session status
        this.updateSessionStatus('Not Started');
        
        // Hide any popups
        this.hideScreenshotPreview();
        this.hideScreenshotPopup();
        
        this.showNotification('Logged out successfully', 'info');
    }


    showMainInterface(user) {
        this.uiService.showMainInterface(user);
        this.loadData();
    }

    async loadData() {
        try {
            this.showLoading('Loading data...');
            
            // Don't load data immediately - let user interact first
            // Data will be loaded when user focuses on inputs
            
            this.showNotification('Ready to use - click on any field to load data', 'success');
        } catch (error) {
            this.showNotification('Failed to initialize: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadRegions(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('region_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/regions?${params}`);
            const optionsContainer = document.getElementById('region-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading regions:', response.data);
                response.data.forEach(region => {
                    const option = document.createElement('div');
                    option.className = 'region-option';
                    option.dataset.value = region.id;
                    option.textContent = region.region_name;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'region');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('region-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMoreRegions = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="region-loading">No regions found</div>';
            }
        } catch (error) {
            console.error('Error loading regions:', error);
            if (isNewSearch) {
                this.showNotification('Error loading regions', 'error');
            }
        }
    }

    async loadSignals(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('signal_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/signals?${params}`);
            const optionsContainer = document.getElementById('signal-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading signals:', response.data);
                response.data.forEach(signal => {
                    const option = document.createElement('div');
                    option.className = 'signal-option';
                    option.dataset.value = signal.id;
                    option.textContent = signal.signal_name;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'signal');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('signal-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMoreSignals = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="signal-loading">No signals found</div>';
            }
        } catch (error) {
            console.error('Error loading signals:', error);
            if (isNewSearch) {
                this.showNotification('Error loading signals', 'error');
            }
        }
    }

    async loadSports(regionId, page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (regionId) {
                params.append('region_id', regionId);
            }
            
            // Get filter values from inputs
            const leagueFilter = document.getElementById('sport-league')?.value.trim();
            const matchNameFilter = document.getElementById('sport-match-name')?.value.trim();
            const startTimeDateInput = document.getElementById('sport-start-time-date');
            const startTimeHourInput = document.getElementById('sport-start-time-hour');
            const startTimeMinuteInput = document.getElementById('sport-start-time-minute');
            
            // Combine date and time inputs to yyyy-mm-dd HH:mm format (24-hour only)
            let startTimeFilterValue = null;
            const dateValue = startTimeDateInput?.value; // yyyy-mm-dd format
            const hourValue = startTimeHourInput?.value ? String(parseInt(startTimeHourInput.value, 10)).padStart(2, '0') : null;
            const minuteValue = startTimeMinuteInput?.value ? String(parseInt(startTimeMinuteInput.value, 10)).padStart(2, '0') : null;
            
            if (dateValue) {
                if (hourValue !== null && minuteValue !== null) {
                    // Date + hour + minute all provided
                    startTimeFilterValue = `${dateValue} ${hourValue}:${minuteValue}`;
                } else if (hourValue !== null) {
                    // Date + hour only, use 00 for minutes
                    startTimeFilterValue = `${dateValue} ${hourValue}:00`;
                } else if (minuteValue !== null) {
                    // Date + minute only, use 00 for hours
                    startTimeFilterValue = `${dateValue} 00:${minuteValue}`;
                } else {
                    // Only date, use 00:00 as default time
                    startTimeFilterValue = `${dateValue} 00:00`;
                }
            } else if (hourValue !== null || minuteValue !== null) {
                // Only time selected, use today's date
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const timeStr = `${hourValue || '00'}:${minuteValue || '00'}`;
                startTimeFilterValue = `${year}-${month}-${day} ${timeStr}`;
            }
            
            // ALWAYS calculate current week range (Monday to Sunday) for sports loading
            const weekRange = this.getWeekRange(); // Use current date
            const weekStartTime = this.formatDateTime(weekRange.monday);
            const weekEndTime = this.formatDateTime(weekRange.sunday);
            
            // Always add end_time for the current week (Sunday 23:59)
            params.append('end_time', weekEndTime);
            
            // If user provided start time filter, use it (for exact time filtering)
            // Otherwise, use week start time (Monday 00:00)
            if (startTimeFilterValue) {
                // Convert datetime-local format (yyyy-mm-ddTHH:mm) to API format (yyyy-mm-dd HH:mm)
                const apiStartTime = startTimeFilterValue.replace('T', ' ');
                params.append('start_time', apiStartTime);
                console.log('📅 Using user filter start_time:', apiStartTime);
            } else {
                // Use week start time (Monday 00:00)
                params.append('start_time', weekStartTime);
            }
            
            console.log('📅 Auto-calculated week range (current week):', {
                start_time: startTimeFilterValue ? startTimeFilterValue.replace('T', ' ') : weekStartTime,
                end_time: weekEndTime,
                monday: weekRange.monday.toLocaleDateString(),
                sunday: weekRange.sunday.toLocaleDateString()
            });
            
            // Display week range info to user
            // Always check visibility based on current filter state
            this.updateSportWeekInfoVisibility();
            
            // Apply filters (if provided, they override the search query)
            if (leagueFilter) {
                params.append('league', leagueFilter);
            } else if (query) {
                // Use search query only if no league filter
                params.append('league', query);
            }
            
            if (matchNameFilter) {
                params.append('match_name', matchNameFilter);
            }
            
            const sportsResponse = await this.apiCallWithAuth('GET', `/sports?${params}`);
            const optionsContainer = document.getElementById('sport-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            // Update week info visibility after loading sports (respects filter state)
            // Don't force show - let updateSportWeekInfoVisibility() handle it based on filter
            this.updateSportWeekInfoVisibility();
            
            if (sportsResponse.data && sportsResponse.data.length > 0) {
                console.log('Loading sports:', sportsResponse.data);
                sportsResponse.data.forEach(sport => {
                    const option = document.createElement('div');
                    option.className = 'sport-option';
                    option.dataset.value = sport.id;

                    // Format start_time yyyy-mm-dd => dd/mm/yyyy
                    let formattedStartTime = sport.start_time;
                    if (formattedStartTime && /^\d{4}-\d{2}-\d{2}/.test(formattedStartTime)) {
                        // Only transform the date part if present at front
                        const dateParts = formattedStartTime.split(' ')[0].split('-');
                        if (dateParts.length === 3) {
                            formattedStartTime = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` +
                                (sport.start_time.length > 10 ? sport.start_time.slice(10) : '');
                        }
                    }

                    // Highlight important info: start time (bold), league (bold), match name (bold)
                    option.innerHTML = `<b>${sport.league}</b> - <b>${formattedStartTime}</b> - <b>${sport.match_name}</b>`;
                    
                    option.addEventListener('click', () => {
                        this.selectOption(option, 'sport');
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('sport-dropdown').classList.remove('hidden');
                
                // Check if there's more data - use meta.has_next if available, otherwise check data length
                if (sportsResponse.meta && sportsResponse.meta.has_next !== undefined) {
                    // Use API's has_next flag if available
                    this.hasMoreSports = sportsResponse.meta.has_next;
                } else {
                    // Fallback: if we got exactly 10 items, assume there might be more
                    if (sportsResponse.data.length < 10) {
                        this.hasMoreSports = false;
                    } else {
                        // If we got 10 items, assume there might be more (unless API tells us otherwise)
                        this.hasMoreSports = true;
                    }
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="sport-loading">No sports found</div>';
            }
        } catch (error) {
            if (isNewSearch) {
                this.showNotification('Failed to load sports: ' + error.message, 'error');
            }
        }
    }

    async loadSocialMediaRadioButtons() {
        try {
            const container = document.getElementById('social-media-radio-container');
            if (!container) return;
            
            // Check if user is logged in
            if (!this.accessToken) {
                container.innerHTML = '<div style="color: #6c757d; font-size: 14px">Please login first</div>';
                return;
            }
            
            container.innerHTML = '<div style="color: #6c757d; font-size: 14px">Loading platforms...</div>';
            
            // Load all social media platforms (no pagination needed for radio buttons)
            const params = new URLSearchParams({
                page: '1',
                page_size: '100', // Load all platforms
                order_by: 'type',
                order_desc: 'false'
            });
            
            const response = await this.apiCallWithAuth('GET', `/social_media/?${params}`);
            
            if (response.data && response.data.length > 0) {
                console.log('Loading social media platforms:', response.data);
                container.innerHTML = '';
                
                response.data.forEach(socialMedia => {
                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; cursor: pointer; padding: 8px; border-radius: 4px; transition: background-color 0.15s;';
                    label.onmouseover = () => label.style.backgroundColor = '#f8f9fa';
                    label.onmouseout = () => label.style.backgroundColor = 'transparent';
                    
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'social-media-platform';
                    radio.value = socialMedia.id;
                    radio.dataset.type = socialMedia.type || '';
                    radio.style.cssText = 'margin-right: 8px; width: 18px; height: 18px; cursor: pointer;';
                    
                    const span = document.createElement('span');
                    span.textContent = socialMedia.type || 'Unknown';
                    span.style.fontSize = '16px';
                    
                    label.appendChild(radio);
                    label.appendChild(span);
                    container.appendChild(label);
                });
            } else {
                container.innerHTML = '<div style="color: #dc3545; font-size: 14px">No social media platforms found</div>';
            }
        } catch (error) {
            console.error('Error loading social media platforms:', error);
            const container = document.getElementById('social-media-radio-container');
            if (container) {
                container.innerHTML = '<div style="color: #dc3545; font-size: 14px">Error loading platforms. Please refresh.</div>';
            }
        }
    }

    async loadPopupSignals(page = 1, query = '', isNewSearch = true) {
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: '10'
            });
            
            if (query) {
                params.append('signal_name', query);
            }
            
            const response = await this.apiCallWithAuth('GET', `/signals?${params}`);
            const optionsContainer = document.getElementById('popup-signal-options');
            
            // Clear dropdown only for new search
            if (isNewSearch) {
                optionsContainer.innerHTML = '';
            }
            
            if (response.data && response.data.length > 0) {
                console.log('Loading popup signals:', response.data);
                response.data.forEach(signal => {
                    const option = document.createElement('div');
                    option.className = 'popup-signal-option';
                    option.dataset.value = signal.id;
                    option.textContent = signal.signal_name;
                    
                    option.addEventListener('click', () => {
                        this.selectPopupSignal(option);
                    });
                    
                    optionsContainer.appendChild(option);
                });
                
                // Show dropdown after populating
                document.getElementById('popup-signal-dropdown').classList.remove('hidden');
                
                // Check if there's more data
                if (response.data.length < 10) {
                    this.hasMorePopupSignals = false;
                }
            } else if (isNewSearch) {
                optionsContainer.innerHTML = '<div class="popup-signal-loading">No signals found</div>';
            }
        } catch (error) {
            console.error('Error loading popup signals:', error);
            if (isNewSearch) {
                this.showNotification('Error loading signals', 'error');
            }
        }
    }

    selectPopupSignal(option) {
        const value = option.dataset.value;
        const text = option.textContent;
        const input = document.getElementById('popup-signal');
        
        // Set the selected value and store the ID
        input.value = text;
        input.dataset.value = value;
        
        // Hide dropdown
        document.getElementById('popup-signal-dropdown').classList.add('hidden');
        
        // Show success
        this.showNotification(`Signal selected: ${text}`, 'success');
    }

    setupCreateSignalHandlers() {
        // Show create signal form
        document.getElementById('show-create-signal-btn').addEventListener('click', () => {
            this.showCreateSignalForm();
        });

        // Cancel create signal
        document.getElementById('cancel-create-signal-btn').addEventListener('click', () => {
            this.hideCreateSignalForm();
        });

        document.getElementById('cancel-create-signal-btn2').addEventListener('click', () => {
            this.hideCreateSignalForm();
        });

        // Create signal
        document.getElementById('create-signal-btn').addEventListener('click', () => {
            this.createNewSignal();
        });
    }

    showCreateSignalForm() {
        // Hide signal dropdown and show create form
        document.getElementById('popup-signal-dropdown').classList.add('hidden');
        document.getElementById('create-signal-section').classList.remove('hidden');
        document.getElementById('show-create-signal-btn').classList.add('hidden');
        
        // Clear form
        document.getElementById('new-signal-name').value = '';
        document.getElementById('new-signal-description').value = '';
        
        // Focus on signal name input
        document.getElementById('new-signal-name').focus();
    }

    hideCreateSignalForm() {
        // Hide create form and show create button
        document.getElementById('create-signal-section').classList.add('hidden');
        document.getElementById('show-create-signal-btn').classList.remove('hidden');
        
        // Clear form
        document.getElementById('new-signal-name').value = '';
        document.getElementById('new-signal-description').value = '';
    }

    async createNewSignal() {
        const signalName = document.getElementById('new-signal-name').value.trim();
        const description = document.getElementById('new-signal-description').value.trim();

        if (!signalName) {
            this.showNotification('Please enter signal name', 'error');
            document.getElementById('new-signal-name').focus();
            return;
        }

        try {
            this.showLoading('Creating signal...');

            // Prepare signal data
            const signalData = {
                signal_name: signalName
            };

            if (description) {
                signalData.description = description;
            }

            // Call API to create signal
            const result = await ipcRenderer.invoke('create-signal', signalData);

            if (result.success) {
                // Set the newly created signal as selected
                const input = document.getElementById('popup-signal');
                input.value = result.data.signal_name;
                input.dataset.value = result.data.id;
                
                // Hide create form
                this.hideCreateSignalForm();
                
                // Show success
                this.showNotification(`Signal "${signalName}" created successfully!`, 'success');
            } else {
                this.showNotification('Failed to create signal: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Error creating signal: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    setupKeyboardShortcuts() {
        // Remove existing event listener if any
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        this.keyboardHandler = (e) => {
            // Check if screenshot popup is visible
            const popup = document.getElementById('screenshot-popup');
            const isPopupVisible = popup && !popup.classList.contains('hidden');
            
            // Check if error popup is visible - always check fresh from DOM
            const allErrorPopups = document.querySelectorAll('.error-popup-fullscreen');
            const isErrorPopupVisible = allErrorPopups.length > 0;
            
            // Handle Escape key - prioritize error popup if both are visible
            if (e.key === 'Escape') {
                if (isErrorPopupVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Escape pressed - Closing error popup(s)');
                    // Find all error popups and remove them
                    allErrorPopups.forEach(errorPopup => {
                        console.log('Removing error popup:', errorPopup);
                        errorPopup.remove();
                    });
                    // Double check and remove any remaining
                    const remainingPopups = document.querySelectorAll('.error-popup-fullscreen');
                    if (remainingPopups.length > 0) {
                        remainingPopups.forEach(p => p.remove());
                    }
                    return;
                } else if (isPopupVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Escape pressed - Canceling screenshot');
                    this.cancelScreenshot();
                    return;
                }
            }
            
            // Handle other shortcuts only for screenshot popup
            if (isPopupVisible) {
                // Ctrl+Shift+U = Upload Screenshot
                if (e.ctrlKey && e.shiftKey && e.key === 'U') {
                    e.preventDefault();
                    console.log('Ctrl+Shift+U pressed - Uploading screenshot');
                    this.uploadScreenshot();
                }
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
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
    }


    async startSession() {
        const regionInput = document.getElementById('region');
        const sportInput = document.getElementById('sport');
        
        // Get values from input fields (we need to track the actual IDs)
        const regionId = regionInput.dataset.value || regionInput.value;
        const sportId = sportInput.dataset.value || sportInput.value;

        // Get social media platform selection from radio buttons
        const selectedRadio = document.querySelector('input[name="social-media-platform"]:checked');
        let socialMediaTypeId = null;
        let socialMediaType = null;
        
        if (selectedRadio) {
            socialMediaTypeId = selectedRadio.value;
            socialMediaType = selectedRadio.dataset.type || '';
        }

        console.log('Start session - Region ID:', regionId, 'Sport ID:', sportId, 'Social Media Type ID:', socialMediaTypeId, 'Type:', socialMediaType);
        console.log('Region input value:', regionInput.value, 'dataset:', regionInput.dataset.value);
        console.log('Sport input value:', sportInput.value, 'dataset:', sportInput.dataset.value);

        if (!regionId || !sportId) {
            this.showNotification('Please select region and sport', 'error');
            return;
        }

        if (!socialMediaTypeId) {
            this.showNotification('Please select a social media platform', 'error');
            return;
        }

        try {
            // Get region name for default bucket name
            const regionInput = document.getElementById('region');
            const regionValue = regionInput.value || '';
            const regionName = regionValue.includes(' - ') ? regionValue.split(' - ')[0] : regionValue;
            
            // Use stored sport data for bucket name
            let sportInfo = '';
            const sportInput = document.getElementById('sport');
            const sportValue = sportInput.value || '';
            
            if (this.currentLeague && this.currentMatchName) {
                sportInfo = `${this.currentLeague} ${this.currentMatchName}`;
                console.log('🏈 Using stored sport data:', {
                    league: this.currentLeague,
                    matchName: this.currentMatchName,
                    sportInfo: sportInfo
                });
            } else if (sportValue) {
                // If no stored data but sport input has value, try to parse it
                console.log('⚠️ No stored sport data, parsing from sport input:', sportValue);
                this.parseAndStoreSportData(sportValue);
                
                if (this.currentLeague && this.currentMatchName) {
                    // Successfully parsed, use parsed data
                    sportInfo = `${this.currentLeague} ${this.currentMatchName}`;
                    console.log('✅ Parsed sport data:', {
                        league: this.currentLeague,
                        matchName: this.currentMatchName,
                        sportInfo: sportInfo
                    });
                } else {
                    // Failed to parse, use raw value but remove date format if present
                    // Format: "league - date - match" -> "league match"
                    if (sportValue.includes(' - ')) {
                        const parts = sportValue.split(' - ');
                        if (parts.length >= 3) {
                            // Remove date part (usually index 1) and join league + match
                            sportInfo = `${parts[0].trim()} ${parts.slice(2).join(' - ').trim()}`;
                            console.log('📝 Cleaned sport value (removed date):', sportInfo);
                        } else {
                            sportInfo = sportValue;
                        }
                    } else {
                        sportInfo = sportValue;
                    }
                }
            }
            
            // Generate default bucket name: region/DD-MM-YYYY/league match_name
            const today = new Date();
            const day = today.getDate().toString().padStart(2, '0');
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const year = today.getFullYear().toString();
            const dateStr = `${day}-${month}-${year}`;
            
            // Build final bucket name
            let defaultBucketName = `${regionName}/${dateStr}`;
            if (sportInfo) {
                defaultBucketName += `/${sportInfo}`;
            }
            
            // Always set bucket name when starting session (fix bug: regenerate on each start)
            const bucketInput = document.getElementById('bucket-name');
            bucketInput.value = defaultBucketName;
            
            // Get sport name for session - use stored data or parsed data
            const sportNameForSession = sportInfo || sportValue;
            
            console.log('DEBUG: sportName extracted:', sportNameForSession);
            
            // Use session service to start session (with social_media_type_id and type)
            const result = this.sessionService.startSession(regionId, sportId, sportNameForSession, socialMediaTypeId, socialMediaType);
            
            if (result.success) {
                // Highlight selected fields to show active session parameters
                this.highlightSessionFields(true);
                
                // Update UI
                this.updateSessionStatus('active');
                this.showNotification('Session started! Press Ctrl+Shift+Q to take screenshots.', 'success');
                
                // Send session data to main process for global shortcuts
                const sessionData = this.sessionService.getSessionData();
                await ipcRenderer.invoke('set-session-data', sessionData);
                console.log('✅ Session data sent to main process:', sessionData);
            } else {
                this.showNotification('Failed to start session: ' + result.error, 'error');
            }
            
        } catch (error) {
            this.showNotification('Failed to start session: ' + error.message, 'error');
        }
    }

    highlightSessionFields(active) {
        // Get selected fields
        const regionInput = document.getElementById('region');
        const sportInput = document.getElementById('sport');
        const bucketInput = document.getElementById('bucket-name');
        
        // Get parent form groups
        const regionGroup = regionInput?.closest('.form-group');
        const sportGroup = sportInput?.closest('.form-group');
        const bucketGroup = bucketInput?.closest('.form-group');
        
        if (active) {
            // Add highlight classes
            if (regionInput) {
                regionInput.classList.add('session-active');
            }
            if (regionGroup) {
                regionGroup.classList.add('session-active');
            }
            
            if (sportInput) {
                sportInput.classList.add('session-active');
            }
            if (sportGroup) {
                sportGroup.classList.add('session-active');
            }
            
            if (bucketInput) {
                bucketInput.classList.add('session-active');
            }
            if (bucketGroup) {
                bucketGroup.classList.add('session-active');
            }
            
            // Highlight selected social media radio button
            const selectedRadio = document.querySelector('input[name="social-media-platform"]:checked');
            if (selectedRadio) {
                const radioLabel = selectedRadio.closest('label');
                if (radioLabel) {
                    radioLabel.style.cssText = 'display: flex; align-items: center; cursor: pointer; padding: 8px; border-radius: 6px; background: #e8f5e9 !important; border: 2px solid #27ae60; font-weight: 600;';
                }
            }
        } else {
            // Remove highlight classes
            if (regionInput) {
                regionInput.classList.remove('session-active');
            }
            if (regionGroup) {
                regionGroup.classList.remove('session-active');
            }
            
            if (sportInput) {
                sportInput.classList.remove('session-active');
            }
            if (sportGroup) {
                sportGroup.classList.remove('session-active');
            }
            
            if (bucketInput) {
                bucketInput.classList.remove('session-active');
            }
            if (bucketGroup) {
                bucketGroup.classList.remove('session-active');
            }
            
            // Reset all social media radio button labels
            const allRadioLabels = document.querySelectorAll('#social-media-radio-container label');
            allRadioLabels.forEach(label => {
                label.style.cssText = 'display: flex; align-items: center; cursor: pointer; padding: 8px; border-radius: 4px; transition: background-color 0.15s;';
            });
        }
    }

    stopSession() {
        try {
            // Use session service to stop session
            const result = this.sessionService.stopSession();
            
            if (result.success) {
                // Remove highlight from fields
                this.highlightSessionFields(false);
                
                // Clear stored sport data
                this.currentLeague = null;
                this.currentMatchName = null;
                console.log('🧹 Cleared stored sport data');
                
                // Clear URL check cache if exists
                if (this.apiService) {
                    this.apiService.clearCache();
                }
                
                // Update UI
                this.updateSessionStatus('Not Started');
                this.showNotification('Session stopped. You can start a new session.', 'info');
            } else {
                this.showNotification('Failed to stop session: ' + result.error, 'error');
            }
            
        } catch (error) {
            this.showNotification('Failed to stop session: ' + error.message, 'error');
        }
    }

    async takeScreenshot() {
        if (!this.sessionService.isSessionActive()) {
            this.showNotification('Please start a session first', 'error');
            return;
        }

        try {
            // Ultra-fast UI feedback
            this.showLoading('Taking screenshot...');
            
            // Call main process to take screenshot (non-blocking)
            const result = await ipcRenderer.invoke('take-screenshot');
            
            if (result.success) {
                // Store screenshot data for upload
                this.screenshotData = result.data;
                this.showScreenshotPreview();
                this.showNotification('Screenshot taken! Ready to upload.', 'success');
            } else {
                this.showNotification('Screenshot failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('Screenshot failed: ' + error.message, 'error');
        } finally {
            // Hide loading immediately for better UX
            setTimeout(() => this.hideLoading(), 100);
        }
    }

    async detectUrl() {
        try {
            this.showLoading('Detecting URL...');
            
            // Call main process to detect URL
            const result = await ipcRenderer.invoke('detect-url');
            
            if (result.success) {
                this.showNotification('URL detection started...', 'info');
            } else {
                this.showNotification('URL detection failed: ' + result.error, 'error');
            }
        } catch (error) {
            this.showNotification('URL detection failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async detectUrlFromClipboard() {
        try {
            this.showLoading('Checking clipboard...');
            
            // Get URL from clipboard via main process
            const result = await ipcRenderer.invoke('get-url-from-clipboard');
            
            if (result.success && result.url) {
                document.getElementById('url').value = result.url;
                this.showNotification('URL detected from clipboard!', 'success');
            } else {
                this.showNotification('No URL found in clipboard. Please copy a URL first.', 'error');
            }
        } catch (error) {
            this.showNotification('Clipboard detection failed: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async triggerExtensionUrlDetection() {
        try {
            console.log('Triggering browser extension to send URL...');
            
            // Just show a notification to user
            this.showNotification('Requesting URL from browser extension...', 'info');
            
        } catch (error) {
            console.error('Error triggering extension:', error);
        }
    }

    showScreenshotPreview() {
        this.uiService.showScreenshotPreview(this.screenshotData);
    }

    async uploadScreenshot() {
        // Check if popup is visible to determine which signal to use
        const popup = document.getElementById('screenshot-popup');
        const isPopupVisible = !popup.classList.contains('hidden');
        
        let signalId, url, bucketName;
        
        if (isPopupVisible) {
            // Use popup-specific method
            this.uploadScreenshotFromPopup();
            return;
        } else {
            // Use main page signal and data
            const signalInput = document.getElementById('signal');
            signalId = signalInput.dataset.value || signalInput.value;
            url = document.getElementById('url').value;
            bucketName = document.getElementById('bucket-name').value;
        }

        if (!signalId) {
            this.showNotification('Please select a signal', 'error');
            return;
        }

        if (!url) {
            this.showNotification('Please enter or detect URL', 'error');
            return;
        }

        if (!bucketName) {
            this.showNotification('Please enter storage folder name', 'error');
            return;
        }

        if (!this.screenshotData || !this.screenshotData.path) {
            this.showNotification('No screenshot available', 'error');
            return;
        }

        // QUEUE UPLOAD (background processing) - immediate feedback
        const signalName = document.getElementById('signal').value;
        
        // Use current URL from input field (most up-to-date)
        const currentUrl = document.getElementById('url').value;
        console.log('📤 Adding to queue with URL:', currentUrl);
        
        // Get session and user data
        const sessionData = this.sessionService.getSessionData();
        const userData = this.sessionService.getCurrentUser();
        
        // Add to upload queue for background processing
        const queueId = this.uiService.addToUploadQueue(signalId, currentUrl, bucketName, signalName, this.screenshotData, sessionData, userData);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideAppToBackground();
        }
    }


    hideAppToBackground() {
        // Hide main window to background
        ipcRenderer.invoke('minimize-window');
        
        // Clear form for next screenshot
        this.clearForm();
        this.hideScreenshotPreview();
    }

    showSuccessNotification(message) {
        // Show success notification without bringing app to front
        this.showNotification(message, 'success');
    }

    cancelScreenshot() {
        // Check if popup is visible
        const popup = document.getElementById('screenshot-popup');
        const isPopupVisible = !popup.classList.contains('hidden');
        
        if (isPopupVisible) {
            // Handle popup cancel
            this.handlePopupCancel();
        } else {
            // Handle main page cancel
        this.hideScreenshotPreview();
        this.screenshotData = null;
        this.showNotification('Screenshot cancelled', 'info');
        }
    }

    confirmUpload() {
        this.uploadScreenshot();
    }

    cancelUpload() {
        this.hideScreenshotPreview();
        this.screenshotData = null;
    }

    hideScreenshotPreview() {
        this.uiService.hideScreenshotPreview();
    }

    clearForm() {
        document.getElementById('signal').value = '';
        // Keep URL and bucket-name for next screenshot
        // document.getElementById('url').value = ''; // DON'T clear URL!
    }

    resetSession() {
        // Reset session data
        this.currentSession = null;
        this.screenshotData = null;
        
        // Reset UI
        document.getElementById('region').disabled = false;
        document.getElementById('sport').disabled = false;
        document.getElementById('start-session-btn').disabled = false;
        document.getElementById('stop-session-btn').classList.add('hidden');
        
        // Clear form fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        document.getElementById('url').value = '';
        document.getElementById('bucket-name').value = '';
        
        // Clear input fields
        document.getElementById('region').value = '';
        document.getElementById('sport').value = '';
        document.getElementById('signal').value = '';
        
        // Clear dataset values
        document.getElementById('region').dataset.value = '';
        document.getElementById('sport').dataset.value = '';
        document.getElementById('signal').dataset.value = '';
        
        // Hide dropdowns
        document.getElementById('region-dropdown').classList.add('hidden');
        document.getElementById('sport-dropdown').classList.add('hidden');
        document.getElementById('signal-dropdown').classList.add('hidden');
        
        // Update status
        this.updateSessionStatus('Not Started');
    }

    handleScreenshotTaken(data) {
        this.screenshotData = data;
        // Don't auto detect URL - only use manual input or extension
        this.showScreenshotPopup(data);
        this.showNotification('Screenshot taken via hotkey!', 'success');
    }

    handleUrlDetectionRequest(data) {
        this.showNotification(data.message, 'warning');
    }

    handleUrlAlreadyExists(data) {
        this.showErrorPopup(data.message);
    }

    showErrorPopup(message) {
        // 1. Tạo system notification trước
        this.showSystemNotification();
        
        // 2. Xóa error popup cũ nếu có
        const existingErrorPopups = document.querySelectorAll('.error-popup-fullscreen');
        existingErrorPopups.forEach(popup => popup.remove());
        
        // 3. Tạo popup báo lỗi toàn màn hình
        const popup = document.createElement('div');
        popup.className = 'error-popup-fullscreen';
        popup.tabIndex = -1; // Cho phép popup nhận focus
        popup.innerHTML = `
            <div class="error-popup-content-fullscreen">
                <div class="error-popup-header-fullscreen">
                    <span class="error-icon-fullscreen">⚠️</span>
                    <h2>URL Already Exists!</h2>
                </div>
                <div class="error-popup-body-fullscreen">
                    <p class="error-message">${message}</p>
                    <div class="error-details">
                        <p>🔍 <strong>What happened?</strong></p>
                        <p>The URL you're trying to capture already exists in our database.</p>
                        <p>📝 <strong>What to do?</strong></p>
                        <p>Please navigate to a different URL and try again.</p>
                    </div>
                </div>
                <div class="error-popup-footer-fullscreen">
                    <button class="error-popup-btn-fullscreen" onclick="this.closest('.error-popup-fullscreen').remove()">
                        Got it! I'll try a different URL
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Focus vào popup để có thể nhận keyboard events
        popup.focus();
        
        // 3. Sử dụng global keyboard shortcut thay vì event listener
        const escHandler = (e) => {
            console.log('Global ESC handler triggered, key:', e.key, 'target:', e.target);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Global ESC key pressed - removing error popup');
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                return false;
            }
        };
        
        // Thêm global event listener
        document.addEventListener('keydown', escHandler);
        
        // 6. Thêm IPC listener để nhận ESC key từ main process
        const ipcEscHandler = () => {
            console.log('IPC ESC key received - removing error popup');
            popup.remove();
            document.removeEventListener('keydown', escHandler);
            document.removeEventListener('click', clickHandler);
            ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
        };
        ipcRenderer.on('close-error-popup', ipcEscHandler);
        
        // 4. Thêm click listener để đóng popup khi click outside
        const clickHandler = (e) => {
            if (e.target === popup) {
                console.log('Clicked outside error popup - closing');
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                document.removeEventListener('click', clickHandler);
            }
        };
        document.addEventListener('click', clickHandler);
        
        // 5. Thêm ESC key listener trực tiếp vào popup element
        popup.addEventListener('keydown', (e) => {
            console.log('Popup ESC key, key:', e.key);
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Popup ESC key pressed - removing popup');
                popup.remove();
                return false;
            }
        });
        
        // 4. Thêm hiệu ứng âm thanh
        this.playErrorSound();
        
        // 5. Flash window để thu hút sự chú ý
        this.flashWindow();
        
        // 7. Auto remove after 10 seconds (lâu hơn để user đọc)
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                document.removeEventListener('click', clickHandler);
                ipcRenderer.removeListener('close-error-popup', ipcEscHandler);
            }
        }, 10000);
    }

    showSystemNotification() {
        // Tạo system notification
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
        // Flash window để thu hút sự chú ý
        try {
            // Gửi message đến main process để flash window
            ipcRenderer.send('flash-window');
        } catch (e) {
            console.log('Could not flash window:', e);
        }
    }

    playErrorSound() {
        // Tạo âm thanh báo lỗi
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
            // Fallback: sử dụng system beep
            console.log('\a'); // ASCII bell character
        }
    }

    async handleUrlDetected(url) {
        document.getElementById('url').value = url;
        this.showNotification('URL detected via hotkey!', 'success');
        
        // Update screenshot data with new URL if it exists
        if (this.screenshotData) {
            this.screenshotData.url = url;
            console.log('🔄 Updated screenshot data with new URL:', url);
        }
        
        // Update any pending queue items with new URL
        if (this.uploadQueue && Array.isArray(this.uploadQueue)) {
            this.uploadQueue.forEach(item => {
                if (item.status === 'uploading') {
                    console.log('🔄 Updating queue item URL from', item.url, 'to', url);
                    item.url = url;
                }
            });
        }
        
        // URL check will be done only when creating detected link (during upload)
        // No need to check here to avoid spam requests
    }

    showScreenshotPopup(data) {
        this.uiService.showScreenshotPopup(data);
    }

    hideScreenshotPopup() {
        this.uiService.hideScreenshotPopup();
    }

    handlePopupOk() {
        const signalInput = document.getElementById('popup-signal');
        const selectedSignal = signalInput.dataset.value || signalInput.value;

        if (!selectedSignal) {
            this.showNotification('Please select a signal', 'error');
            return;
        }

        if (!this.screenshotData || !this.screenshotData.path) {
            this.showNotification('No screenshot available', 'error');
            return;
        }

        // Check if platform is facebook and validate view field
        const socialMediaType = this.sessionService.getSocialMediaType();
        const isFacebook = socialMediaType && socialMediaType.toLowerCase() === 'facebook';
        if (isFacebook) {
            const viewInput = document.getElementById('popup-view');
            const viewValue = viewInput?.value?.trim();
            
            if (!viewValue) {
                this.showNotification('Please enter a view (required for Facebook platform)', 'error');
                viewInput?.focus();
                return;
            }
            
            // Validate view is a positive integer
            const viewInt = parseInt(viewValue, 10);
            if (isNaN(viewInt) || viewInt <= 0) {
                this.showNotification('View must be a positive number', 'error');
                viewInput?.focus();
                return;
            }
        }

        // Upload screenshot
        this.uploadScreenshotFromPopup();
    }

    handlePopupCancel() {
        this.hideScreenshotPopup();
        
        // Clean up screenshot file
        if (this.screenshotData && this.screenshotData.path) {
            console.log('Screenshot cancelled, deleting file:', this.screenshotData.path);
            // Delete the screenshot file
            ipcRenderer.invoke('delete-file', this.screenshotData.path).then(() => {
                console.log('Screenshot file deleted successfully');
            }).catch(error => {
                console.error('Failed to delete screenshot file:', error);
            });
        }
        
        this.screenshotData = null;
        this.showNotification('Screenshot cancelled', 'info');
    }

    openScreenshotLocation() {
        if (this.screenshotData && this.screenshotData.path) {
            console.log('Opening screenshot file:', this.screenshotData.path);
            
            // Open the specific screenshot file
            ipcRenderer.invoke('open-file', this.screenshotData.path).then(() => {
                console.log('Screenshot file opened successfully');
            }).catch(error => {
                console.error('Failed to open screenshot file:', error);
                this.showNotification('Failed to open screenshot file', 'error');
            });
        } else {
            this.showNotification('No screenshot data available', 'warning');
        }
    }

    async uploadScreenshotFromPopup() {
        console.log('=== POPUP UPLOAD DEBUG ===');
        console.log('Screenshot data:', this.screenshotData);
        console.log('Main page URL:', document.getElementById('url').value);
        
        const signalInput = document.getElementById('popup-signal');
        const selectedSignal = signalInput.dataset.value || signalInput.value;
        // Use main page URL instead of screenshotData.url
        const url = document.getElementById('url').value;
        const bucketName = document.getElementById('bucket-name').value;

        // Get view value if social media type is facebook
        const socialMediaType = this.sessionService.getSocialMediaType();
        const isFacebook = socialMediaType && socialMediaType.toLowerCase() === 'facebook';
        const viewInput = document.getElementById('popup-view');
        let view = null;
        
        if (isFacebook && viewInput && viewInput.value.trim()) {
            const viewValue = viewInput.value.trim();
            // Validate view is a positive integer
            const viewInt = parseInt(viewValue, 10);
            if (isNaN(viewInt) || viewInt <= 0) {
                this.showNotification('View must be a positive number', 'error');
                viewInput.focus();
                return;
            }
            view = viewInt; // Store as integer
        }

        console.log('URL check:', url);
        console.log('Bucket name:', bucketName);
        console.log('Selected signal:', selectedSignal);
        console.log('Social Media Type:', socialMediaType);
        console.log('Is Facebook:', isFacebook);
        console.log('View:', view);

        if (!url || url === 'No URL detected') {
            console.log('❌ No URL available for upload');
            this.showNotification('No URL available for upload', 'error');
            return;
        }

        if (!bucketName) {
            this.showNotification('Please enter storage folder name', 'error');
                return;
        }

        if (!selectedSignal) {
            this.showNotification('Please select a signal', 'error');
                return;
            }

        // Validate view for facebook platform
        if (isFacebook && !view) {
            this.showNotification('Please enter a view (required for Facebook platform)', 'error');
            viewInput?.focus();
            return;
        }
            
        // QUEUE UPLOAD (background processing) - immediate feedback
        const signalName = document.getElementById('popup-signal').value;
        
        // Use current URL from input field (most up-to-date)
        const currentUrl = document.getElementById('url').value;
        console.log('📤 Adding to queue with URL (popup):', currentUrl);
        
        // Get session and user data
        const sessionData = this.sessionService.getSessionData();
        const userData = this.sessionService.getCurrentUser();
        
        // Add to upload queue for background processing (with view if facebook)
        const queueId = this.uiService.addToUploadQueue(selectedSignal, currentUrl, bucketName, signalName, this.screenshotData, sessionData, userData, view);
        
        if (queueId) {
            // Immediate feedback - no waiting for API
            this.showNotification('📤 Upload added to queue! Processing in background...', 'success');
            this.hideScreenshotPreview();
            this.clearForm();
            this.hideScreenshotPopup();
        }
    }

    updateSessionStatus(status) {
        this.uiService.updateSessionStatus(status);
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showNotification(message, type = 'info') {
        this.uiService.showNotification(message, type);
    }

    showLoading(message) {
        this.uiService.showLoading(message);
    }

    hideLoading() {
        this.uiService.hideLoading();
    }

    async apiCall(method, endpoint, data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (Array.isArray(errorData)) {
                        errorMessage = errorData.map(err => err.msg || err.message || err).join(', ');
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw new Error(`API call failed: ${error.message}`);
        }
    }

    async apiCallWithAuth(method, endpoint, data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (Array.isArray(errorData)) {
                        errorMessage = errorData.map(err => err.msg || err.message || err).join(', ');
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw new Error(`API call failed: ${error.message}`);
        }
    }

}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new TestAutomationDesktopApp();
    
    // Add event listeners for new events
    ipcRenderer.on('url-detection-request', (event, data) => {
        app.handleUrlDetectionRequest(data);
    });
    
});

// Handle notification close
document.getElementById('notification-close').addEventListener('click', () => {
    document.getElementById('notification').classList.add('hidden');
});
