// API Service Module - Handles all API communications
const axios = require('axios');
const { randomUUID } = require('crypto');
const config = require('../../app.config');

class ApiService {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.accessToken = null;
        this.currentUser = null;
    }

    setAccessToken(token, user) {
        this.accessToken = token;
        this.currentUser = user;
    }

    clearAuth() {
        this.accessToken = null;
        this.currentUser = null;
    }

    clearCache() {
        // Clear any URL check cache if implemented in the future
        // Currently no cache is implemented, but this method is here for future use
        console.log('🧹 Cache cleared (no cache currently implemented)');
    }

    buildAsyncHeaders() {
        return {
            'Idempotency-Key': randomUUID(),
            'X-Correlation-Id': randomUUID()
        };
    }

    buildAuthHeaders(extraHeaders = {}) {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            ...extraHeaders
        };
    }

    isAsyncAcceptedPayload(payload) {
        return Boolean(payload && payload.command_id && payload.status === 'accepted');
    }

    isCommandSuccessful(commandStatus) {
        const status = (commandStatus?.status || '').toLowerCase();
        return status === 'succeeded' || status === 'applied' || status === 'completed';
    }

    extractErrorMessage(error, fallback = 'Request failed') {
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim()) {
            return detail;
        }

        if (Array.isArray(detail) && detail.length > 0) {
            const firstDetail = detail[0];
            if (typeof firstDetail === 'string') {
                return firstDetail;
            }
            if (firstDetail?.msg) {
                return firstDetail.msg;
            }
        }

        return error?.response?.data?.message || error?.message || fallback;
    }

    async pollCommandStatus(commandId, options = {}) {
        const timeoutMs = options.timeoutMs || 120000;
        const intervalMs = options.intervalMs || 5000;
        const initialDelayMs = options.initialDelayMs ?? 5000;
        const startedAt = Date.now();

        if (initialDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, initialDelayMs));
        }

        let lastResponse = null;

        while (Date.now() - startedAt < timeoutMs) {
            const response = await axios.get(`${this.apiBaseUrl}/commands/${commandId}`, {
                headers: this.buildAuthHeaders()
            });

            lastResponse = response.data;

            if (lastResponse?.is_terminal) {
                return lastResponse;
            }

            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        throw new Error(`Async command timeout after ${timeoutMs}ms (command_id=${commandId})`);
    }

    async fetchDetectedLinkImageById(imageId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/detected_link_images/${imageId}`, {
                headers: this.buildAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.warn('⚠️ Could not fetch detected link image detail by id:', imageId);
            return null;
        }
    }

    async listDetectedLinkImages(detectedLinkId, page = 1, pageSize = 100) {
        try {
            const qs = new URLSearchParams({
                page: String(page),
                page_size: String(pageSize),
                detected_link_id: detectedLinkId
            });
            const response = await axios.get(`${this.apiBaseUrl}/detected_link_images/?${qs.toString()}`, {
                headers: this.buildAuthHeaders({ Accept: 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error listing detected link images:', error.response?.data || error.message);
            return {
                success: false,
                error: this.extractErrorMessage(error, 'Failed to list detected link images')
            };
        }
    }

    async getCommandStatusOnce(commandId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/commands/${commandId}`, {
                headers: this.buildAuthHeaders({ Accept: 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching command status:', error.response?.data || error.message);
            return {
                success: false,
                error: this.extractErrorMessage(error, 'Failed to fetch command status')
            };
        }
    }

    async login(credentials) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', credentials.username);
            formData.append('password', credentials.password);
            
            const response = await axios.post(`${this.apiBaseUrl}/auth/login`, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            });
            
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message);
            return { success: false, error: error.response?.data?.detail || error.message };
        }
    }

    async getCurrentUser() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/auth/me`, {
                headers: this.buildAuthHeaders()
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRegions(searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}`;
            
            // Add search params if provided (search by region_name)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&region_name=${search}`;
            }
            
            console.log('🌍 Fetching regions with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/regions/?${queryParams}`, {
                headers: this.buildAuthHeaders({ 'Accept': 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching regions:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async getSignals(searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}`;
            
            // Add search params if provided (search by signal_name)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&signal_name=${search}`;
            }
            
            console.log('🔔 Fetching signals with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/signals/?${queryParams}`, {
                headers: this.buildAuthHeaders({ 'Accept': 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching signals:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async getSports(regionId, searchQuery = '', page = 1, pageSize = 10) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}&region_id=${regionId}`;
            
            // OpenAPI v1.0.1: sports list uses `search` for broad text search.
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&search=${search}`;
            }
            
            console.log('🏆 Fetching sports with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/sports/?${queryParams}`, {
                headers: this.buildAuthHeaders({ 'Accept': 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching sports:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async getDetectedLink(detectedLinkId) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/detected_links/${detectedLinkId}`, {
                headers: this.buildAuthHeaders({ Accept: 'application/json' })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching detected link:', error.response?.data || error.message);
            return {
                success: false,
                error: this.extractErrorMessage(error, 'Failed to fetch detected link')
            };
        }
    }

    async checkUrlExists(url, sportId) {
        try {
            console.log('🔍 Checking URL existence:', { url, sportId });
            
            if (!this.accessToken) {
                console.log('❌ No access token, cannot check URL');
                return { success: false, exists: false, error: 'No access token available' };
            }
            
            if (!sportId) {
                console.log('❌ No sport ID provided, cannot check URL');
                return { success: false, exists: false, error: 'No sport ID provided' };
            }
            
            // Use new check-exists API instead of pagination
            const queryParams = `url=${encodeURIComponent(url)}&sport_id=${sportId}`;
            const response = await axios.post(`${this.apiBaseUrl}/detected_links/check-exists?${queryParams}`, {}, {
                headers: this.buildAuthHeaders({
                    'Content-Type': 'application/json'
                })
            });
            
            console.log('🔍 API Response:', response.data);
            
            if (response.data && typeof response.data === 'object') {
                // API returns {id: true} if exists, or {url: false} if not exists
                const keys = Object.keys(response.data);
                const values = Object.values(response.data);
                
                let exists = false;
                let detectedLinkId = null;
                
                if (keys.length > 0) {
                    const firstKey = keys[0];
                    const firstValue = values[0];
                    
                    // If value is true, URL exists and key is the detected_link_id
                    if (firstValue === true) {
                        exists = true;
                        detectedLinkId = firstKey;
                        console.log('🔍 URL ALREADY EXISTS in this sport! Detected link ID:', detectedLinkId);
                    } else if (firstValue === false) {
                        exists = false;
                        console.log('✅ URL is NEW for this sport');
                    }
                }
                
                return { 
                    success: true, 
                    exists: exists,
                    detectedLinkId: detectedLinkId 
                };
            } else {
                console.log('❌ Invalid response format, cannot determine URL existence');
                return { success: false, exists: false, error: 'Invalid response format from API' };
            }
            
        } catch (error) {
            console.error('❌ Error checking URL existence:', error);
            console.error('Error details:', error.response?.data || error.message);
            // Return error instead of assuming URL doesn't exist
            return { 
                success: false, 
                exists: false, 
                error: error.response?.data?.detail || error.message || 'Failed to check URL existence' 
            };
        }
    }

    async createDetectedLink(url, sportId, signalId, assignedUserId, socialMediaTypeId = null, view = null) {
        try {
            console.log('🔗 Creating detected link:', { url, sportId, signalId, assignedUserId, socialMediaTypeId, view });
            
            // Build request body
            const requestBody = {
                url: url,
                sport_id: sportId,
                signal_id: signalId,
                assigned_user_id: assignedUserId
            };
            
            // Add social_media_type_id if provided
            if (socialMediaTypeId) {
                requestBody.social_media_type_id = socialMediaTypeId;
            }
            
            // Add view if provided (must be integer)
            if (view !== null && view !== undefined) {
                const viewInt = parseInt(view, 10);
                if (!isNaN(viewInt) && viewInt > 0) {
                    requestBody.view = viewInt;
                } else {
                    console.warn('⚠️ Invalid view value, skipping:', view);
                }
            }
            
            console.log('📤 Request body:', requestBody);
            
            const response = await axios.post(`${this.apiBaseUrl}/detected_links`, requestBody, {
                headers: this.buildAuthHeaders({
                    'Content-Type': 'application/json'
                })
            });

            if (this.isAsyncAcceptedPayload(response.data)) {
                const commandId = response.data.command_id;
                console.log('⏳ Detected link command accepted:', commandId);
                const commandStatus = await this.pollCommandStatus(commandId);
                const normalizedStatus = commandStatus?.status;

                if (this.isCommandSuccessful(commandStatus)) {
                    if (commandStatus.aggregate_id) {
                        return { success: true, data: { id: commandStatus.aggregate_id, command: commandStatus } };
                    }
                    return { success: true, data: { command: commandStatus } };
                }

                return {
                    success: false,
                    error: commandStatus?.error_detail || commandStatus?.conflict_detail || `Command failed with status: ${normalizedStatus}`,
                    command: commandStatus
                };
            }

            console.log('✅ Detected link created:', response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error creating detected link:', error.response?.data || error.message);
            return {
                success: false,
                error: this.extractErrorMessage(error, 'Failed to create detected link')
            };
        }
    }

    async uploadScreenshot(filePath, detectedLinkId) {
        try {
            const FormData = require('form-data');
            const form = new FormData();

            form.append('file', require('fs').createReadStream(filePath));
            form.append('detected_link_id', detectedLinkId);

            const response = await axios.post(`${this.apiBaseUrl}/detected_link_images/upload`, form, {
                headers: this.buildAuthHeaders({
                    ...this.buildAsyncHeaders(),
                    ...form.getHeaders()
                })
            });

            if (this.isAsyncAcceptedPayload(response.data)) {
                const commandId = response.data.command_id;
                console.log('⏳ Upload command accepted:', commandId);
                const commandStatus = await this.pollCommandStatus(commandId);
                const normalizedStatus = commandStatus?.status;

                if (this.isCommandSuccessful(commandStatus)) {
                    let uploadData = { command: commandStatus };

                    if (commandStatus.aggregate_id) {
                        const detail = await this.fetchDetectedLinkImageById(commandStatus.aggregate_id);
                        if (detail) {
                            uploadData = { ...detail, command: commandStatus };
                        }
                    }

                    console.log('✅ Upload async command succeeded:', commandStatus);
                    return { success: true, data: uploadData };
                }

                return {
                    success: false,
                    error: commandStatus?.error_detail || commandStatus?.conflict_detail || `Upload command failed with status: ${normalizedStatus}`,
                    command: commandStatus
                };
            }

            console.log('✅ Upload response:', response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Upload error:', error.response?.data || error.message);
            return {
                success: false,
                error: this.extractErrorMessage(error, 'Failed to upload screenshot')
            };
        }
    }

    async createSignal(signalData) {
        try {
            console.log('🔔 Creating new signal:', signalData);
            const response = await axios.post(`${this.apiBaseUrl}/signals`, signalData, {
                headers: this.buildAuthHeaders({
                    'Content-Type': 'application/json'
                })
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error creating signal:', error.response?.data || error.message);
            return { 
                success: false, 
                error: this.extractErrorMessage(error, 'Failed to create signal')
            };
        }
    }

    async getSocialMedia(searchQuery = '', page = 1, pageSize = 10, type = null) {
        try {
            // Build query params
            let queryParams = `page=${page}&page_size=${pageSize}&order_by=type&order_desc=false`;
            
            // Add search params if provided (search by type)
            if (searchQuery && searchQuery.trim()) {
                const search = encodeURIComponent(searchQuery.trim());
                queryParams += `&type=${search}`;
            }
            
            // Add type filter if provided
            if (type) {
                queryParams += `&type=${encodeURIComponent(type)}`;
            }
            
            console.log('📱 Fetching social media with params:', queryParams);
            const response = await axios.get(`${this.apiBaseUrl}/social_media/?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Error fetching social media:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ApiService;
