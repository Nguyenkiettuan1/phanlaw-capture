// Screenshot Service Module - Handles all screenshot operations
const { desktopCapturer, screen } = require('electron');
const fs = require('fs');
const path = require('path');

class ScreenshotService {
    constructor() {
        this.screenshotPath = null;
        this.currentUrl = null;
        this.currentUser = null;
        this.preloadedSources = null;
        this.sessionData = null;
    }

    setCurrentUser(user) {
        this.currentUser = user;
    }

    setCurrentUrl(url) {
        this.currentUrl = url;
    }

    setSessionData(sessionData) {
        this.sessionData = sessionData;
    }

    extractDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let domain = urlObj.hostname;
            
            // Remove www prefix
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }
            
            // Remove subdomain if it's a common one
            const commonSubdomains = ['m.', 'mobile.', 'app.', 'api.'];
            for (const subdomain of commonSubdomains) {
                if (domain.startsWith(subdomain)) {
                    domain = domain.substring(subdomain.length);
                    break;
                }
            }
            
            // Replace dots with underscores for filename
            return domain.replace(/\./g, '_');
        } catch (error) {
            console.error('Error extracting domain:', error);
            return 'unknown';
        }
    }

    sanitizeFilename(str) {
        if (!str) return 'unknown';
        
        // Replace invalid filename characters with underscores
        return str
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_{2,}/g, '_') // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
            .substring(0, 50); // Limit length to 50 chars
    }

    async preloadScreenshotSources() {
        try {
            // Preload screenshot sources for ultra-fast capture
            this.preloadedSources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 },
                fetchWindowIcons: false,
                fetchWindowBounds: false
            });
            console.log('Screenshot sources preloaded for ultra-fast capture');
        } catch (error) {
            console.log('Preload failed, will load on demand:', error.message);
        }
    }

    async captureScreenshot() {
        try {
            // Wait for screen to stabilize
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Get display info
            try {
                const displays = screen.getAllDisplays();
                console.log('Available displays:', displays.length);
            } catch (error) {
                console.log('Could not get display info:', error.message);
            }
            
            // Capture fresh screen
            console.log('📸 Capturing current screen...');
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 },
                fetchWindowIcons: false,
                fetchWindowBounds: false
            });
            console.log('📱 Screen sources found:', sources.length);
            
            if (sources.length > 0) {
                console.log('=== AVAILABLE SCREENS ===');
                sources.forEach((source, index) => {
                    console.log(`${index}: ${source.name} (ID: ${source.id})`);
                });
                
                // Find the primary screen
                let primarySource = sources[0];
                
                if (sources.length > 1) {
                    const primaryScreen = sources.find(source => 
                        source.name.toLowerCase().includes('primary') ||
                        source.name.toLowerCase().includes('main') ||
                        source.name.toLowerCase().includes('display 1') ||
                        source.name.toLowerCase().includes('screen 1')
                    );
                    
                    if (primaryScreen) {
                        primarySource = primaryScreen;
                        console.log('Found primary screen:', primaryScreen.name);
                    } else {
                        console.log('No primary screen found, using first screen');
                    }
                }
                
                console.log('🎯 Using screen source:', primarySource.name);
                console.log('🖼️  Screenshot dimensions:', primarySource.thumbnail.getSize());
                const screenshot = primarySource.thumbnail;
                
                // Generate filename: YYYYMMDD_region_league_match_domain.png
                const now = new Date();
                const year = now.getFullYear().toString();
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const day = now.getDate().toString().padStart(2, '0');
                const dateStr = `${year}${month}${day}`;
                
                // Get region name (sanitize for filename)
                const regionName = this.sanitizeFilename(this.sessionData?.regionName || 'unknown');
                
                // Get league (sanitize for filename)
                const league = this.sanitizeFilename(this.sessionData?.league || 'unknown');
                
                // Get match name (sanitize for filename)
                const matchName = this.sanitizeFilename(this.sessionData?.matchName || 'unknown');
                
                // Get domain from URL
                const domain = this.extractDomainFromUrl(this.currentUrl || 'unknown');
                
                // Build filename: YYYYMMDD_region_league_match_domain.png
                const filename = `${dateStr}_${regionName}_${league}_${matchName}_${domain}.png`;
                
                console.log('📝 Generated filename:', filename);
                console.log('📅 Date:', dateStr);
                console.log('🌍 Region:', regionName);
                console.log('🏆 League:', league);
                console.log('⚽ Match:', matchName);
                console.log('🌐 Domain:', domain);
                
                // Save screenshot to local project folder
                const projectDir = process.cwd();
                const screenshotsDir = path.join(projectDir, 'screenshots');
                
                console.log('📁 Project directory:', projectDir);
                console.log('📁 Screenshots directory:', screenshotsDir);
                
                // Create screenshots directory if it doesn't exist
                if (!fs.existsSync(screenshotsDir)) {
                    console.log('📁 Creating screenshots directory...');
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                    console.log('✅ Screenshots directory created');
                } else {
                    console.log('✅ Screenshots directory already exists');
                }
                
                this.screenshotPath = path.join(screenshotsDir, filename);
                console.log('💾 Full screenshot path:', this.screenshotPath);
                
                // Convert to buffer and save
                const buffer = screenshot.toPNG();
                fs.writeFileSync(this.screenshotPath, buffer);
                
                console.log('✅ Screenshot saved to:', this.screenshotPath);
                console.log('📁 Screenshots folder:', screenshotsDir);
                console.log('🖼️  Screenshot filename:', filename);
                
                const screenshotTimestamp = new Date().toISOString();
                
                return {
                    filename: filename,
                    path: this.screenshotPath,
                    timestamp: screenshotTimestamp
                };
                
            } else {
                console.error('No screen sources available');
                return null;
            }
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return null;
        }
    }

    getScreenshotPath() {
        return this.screenshotPath;
    }

    clearScreenshot() {
        this.screenshotPath = null;
    }
}

module.exports = ScreenshotService;
