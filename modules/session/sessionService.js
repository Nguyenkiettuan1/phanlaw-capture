// Session Service Module - Handles session management
class SessionService {
    constructor() {
        this.currentSession = null;
        this.currentUser = null;
    }

    setCurrentUser(user) {
        this.currentUser = user;
    }

    getCurrentUser() {
        return this.currentUser;
    }
    
    startSession(regionId, sportId, sportName, socialMediaTypeId, socialMediaType, regionName = null, league = null, matchName = null) {
        try {
            // Lock UI state (no API call needed)
            this.currentSession = { 
                regionId, 
                sportId, 
                sportName, 
                socialMediaTypeId,
                socialMediaType, // Store type to check if it's facebook
                regionName, // Store region name for filename
                league, // Store league for filename
                matchName // Store match name for filename
            };
            
            // Disable region, sport, and social media radio buttons
            document.getElementById('region').disabled = true;
            document.getElementById('sport').disabled = true;
            document.getElementById('start-session-btn').disabled = true;
            
            // Disable all social media radio buttons
            const socialMediaRadios = document.querySelectorAll('input[name="social-media-platform"]');
            socialMediaRadios.forEach(radio => {
                radio.disabled = true;
            });
            
            // Disable bucket name input
            const bucketInput = document.getElementById('bucket-name');
            if (bucketInput) {
                bucketInput.disabled = true;
            }
            
            // Show stop session button
            document.getElementById('stop-session-btn').classList.remove('hidden');
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    stopSession() {
        try {
            // Reset session data
            this.currentSession = null;
            
            // Enable region, sport, and social media radio buttons
            document.getElementById('region').disabled = false;
            document.getElementById('sport').disabled = false;
            document.getElementById('start-session-btn').disabled = false;
            
            // Enable all social media radio buttons
            const socialMediaRadios = document.querySelectorAll('input[name="social-media-platform"]');
            socialMediaRadios.forEach(radio => {
                radio.disabled = false;
            });
            
            // Enable bucket name input (though it's readonly)
            const bucketInput = document.getElementById('bucket-name');
            if (bucketInput) {
                bucketInput.disabled = false;
            }
            
            // Hide stop session button
            document.getElementById('stop-session-btn').classList.add('hidden');
            
            // Clear bucket name
            document.getElementById('bucket-name').value = '';
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getCurrentSession() {
        return this.currentSession;
    }

    isSessionActive() {
        return this.currentSession !== null;
    }

    getSessionData() {
        if (!this.currentSession) {
            return null;
        }

        return {
            regionId: this.currentSession.regionId,
            sportId: this.currentSession.sportId,
            sportName: this.currentSession.sportName,
            socialMediaTypeId: this.currentSession.socialMediaTypeId,
            socialMediaType: this.currentSession.socialMediaType,
            userId: this.currentUser?.id,
            regionName: this.currentSession.regionName,
            league: this.currentSession.league,
            matchName: this.currentSession.matchName
        };
    }

    getPlatform() {
        // Return type for backward compatibility (check if it's facebook)
        return this.currentSession?.socialMediaType?.toLowerCase() === 'facebook' ? 'facebook' : null;
    }

    getSocialMediaTypeId() {
        return this.currentSession?.socialMediaTypeId || null;
    }

    getSocialMediaType() {
        return this.currentSession?.socialMediaType || null;
    }

    resetSession() {
        // Reset session data
        this.currentSession = null;
        
        // Reset UI
        document.getElementById('region').disabled = false;
        document.getElementById('sport').disabled = false;
        document.getElementById('start-session-btn').disabled = false;
        document.getElementById('stop-session-btn').classList.add('hidden');
        
        // Enable social media radio buttons
        const socialMediaRadios = document.querySelectorAll('input[name="social-media-platform"]');
        socialMediaRadios.forEach(radio => {
            radio.disabled = false;
            radio.checked = false;
        });
        
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
    }
}

module.exports = SessionService;
