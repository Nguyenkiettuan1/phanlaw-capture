// URL Service Module - Handles URL detection and management
const { clipboard } = require('electron');
const { exec } = require('child_process');
const os = require('os');

class UrlService {
    constructor() {
        this.currentUrl = null;
    }

    setCurrentUrl(url) {
        this.currentUrl = url;
    }

    getCurrentUrl() {
        return this.currentUrl;
    }

    async detectUrlFromClipboard() {
        try {
            const clipboardText = clipboard.readText();
            
            if (clipboardText && (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))) {
                console.log('URL detected from clipboard:', clipboardText);
                this.currentUrl = clipboardText;
                return clipboardText;
            }
            
            return null;
        } catch (error) {
            console.error('Clipboard detection failed:', error);
            return null;
        }
    }

    async detectUrlFromBrowser() {
        try {
            if (process.platform === 'win32') {
                // Windows: Use PowerShell
                return await this.detectUrlFromBrowserWindows();
            } else if (process.platform === 'darwin') {
                // macOS: Use AppleScript
                return await this.detectUrlFromBrowserMacOS();
            } else {
                // Linux: Not implemented yet
                console.log('Browser detection not implemented for this platform');
                return null;
            }
        } catch (error) {
            console.error('Browser detection failed:', error);
            return null;
        }
    }

    async detectUrlFromBrowserWindows() {
        try {
            const powershellScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                
                # Get active window
                $activeWindow = [System.Windows.Forms.Form]::ActiveForm
                if ($activeWindow -eq $null) {
                    # Try alternative method
                    $processes = Get-Process | Where-Object {$_.MainWindowTitle -ne ""}
                    $browserProcesses = $processes | Where-Object {
                        $_.ProcessName -match "chrome|edge|firefox|msedge" -or 
                        $_.MainWindowTitle -match "chrome|edge|firefox|microsoft"
                    }
                    
                    if ($browserProcesses) {
                        $browserProcesses[0].MainWindowTitle
                    }
                } else {
                    $activeWindow.Text
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const windowTitle = stdout.trim();
                    console.log('Active window title:', windowTitle);
                    
                    // Check if it's a browser
                    const browserIndicators = ['chrome', 'edge', 'firefox', 'microsoft'];
                    const isBrowser = browserIndicators.some(indicator => 
                        windowTitle.toLowerCase().includes(indicator)
                    );
                    
                    if (isBrowser) {
                        // Try to get URL using COM automation via PowerShell
                        this.getUrlFromBrowserViaPowerShell().then(resolve).catch(reject);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('Windows browser detection failed:', error);
            return null;
        }
    }

    async detectUrlFromBrowserMacOS() {
        try {
            // macOS: Use AppleScript to get URL from active browser
            // Try each browser one by one
            const browsers = [
                {
                    name: 'Google Chrome',
                    script: 'tell application "Google Chrome" to get URL of active tab of front window'
                },
                {
                    name: 'Safari',
                    script: 'tell application "Safari" to get URL of front document'
                },
                {
                    name: 'Microsoft Edge',
                    script: 'tell application "Microsoft Edge" to get URL of active tab of front window'
                },
                {
                    name: 'Firefox',
                    script: null // Firefox requires different approach
                }
            ];
            
            // Try Chrome, Safari, Edge first (direct AppleScript)
            for (const browser of browsers) {
                if (browser.script) {
                    try {
                        const url = await this.executeAppleScript(browser.script);
                        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                            console.log(`URL detected from ${browser.name}:`, url);
                            return url;
                        }
                    } catch (error) {
                        // Browser not running or not available, try next
                        continue;
                    }
                }
            }
            
            // Firefox: Use clipboard method (Cmd+L, Cmd+C, then read clipboard)
            try {
                const fs = require('fs');
                const tempScript = require('path').join(require('os').tmpdir(), 'get_firefox_url.scpt');
                const firefoxScript = `
                    tell application "System Events"
                        tell process "Firefox"
                            if frontmost is true then
                                keystroke "l" using command down
                                delay 0.2
                                keystroke "c" using command down
                                delay 0.2
                            end if
                        end tell
                    end tell
                `;
                
                fs.writeFileSync(tempScript, firefoxScript);
                await this.executeAppleScript(`run script file "${tempScript}"`);
                fs.unlinkSync(tempScript);
                
                // Read from clipboard
                await new Promise(resolve => setTimeout(resolve, 300));
                const clipboardUrl = await this.detectUrlFromClipboard();
                if (clipboardUrl) {
                    return clipboardUrl;
                }
            } catch (error) {
                // Firefox method failed
                console.log('Firefox URL detection failed:', error.message);
            }
            
            return null;
            
        } catch (error) {
            console.error('macOS browser detection failed:', error);
            return null;
        }
    }

    async executeAppleScript(script) {
        return new Promise((resolve, reject) => {
            // Use osascript with proper escaping
            const escapedScript = script.replace(/"/g, '\\"');
            exec(`osascript -e "${escapedScript}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                const result = stdout.trim();
                // Remove any error messages that might be in output
                if (result.includes('error:') || result.includes('execution error')) {
                    reject(new Error(result));
                    return;
                }
                resolve(result);
            });
        });
    }

    async getUrlFromBrowserViaPowerShell() {
        try {
            const powershellScript = `
                try {
                    # Try Chrome first
                    $chrome = New-Object -ComObject Chrome.Application
                    if ($chrome -and $chrome.Windows) {
                        $window = $chrome.Windows(0)
                        if ($window -and $window.ActiveTab) {
                            $url = $window.ActiveTab.Url
                            if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                Write-Output $url
                                exit 0
                            }
                        }
                    }
                } catch {
                    # Chrome failed, try Edge
                    try {
                        $edgeObjects = @("MicrosoftEdge.Application", "Edge.Application", "msedge.Application")
                        foreach ($edgeObj in $edgeObjects) {
                            try {
                                $edge = New-Object -ComObject $edgeObj
                                if ($edge -and $edge.Windows) {
                                    $window = $edge.Windows(0)
                                    if ($window -and $window.ActiveTab) {
                                        $url = $window.ActiveTab.Url
                                        if ($url -and ($url.StartsWith("http://") -or $url.StartsWith("https://"))) {
                                            Write-Output $url
                                            exit 0
                                        }
                                    }
                                }
                            } catch {
                                continue
                            }
                        }
                    } catch {
                        # All COM methods failed
                        Write-Output "NO_URL"
                    }
                }
            `;
            
            return new Promise((resolve, reject) => {
                exec(`powershell -Command "${powershellScript}"`, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    const url = stdout.trim();
                    if (url && url !== 'NO_URL' && (url.startsWith('http://') || url.startsWith('https://'))) {
                        resolve(url);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('PowerShell URL detection failed:', error);
            return null;
        }
    }

    async detectUrl() {
        try {
            console.log('Detecting URL...');
            
            // Method 1: Try to get URL from clipboard
            const clipboardUrl = await this.detectUrlFromClipboard();
            if (clipboardUrl) {
                this.currentUrl = clipboardUrl;
                return clipboardUrl;
            }
            
            // Method 2: Try to detect browser window and get URL using platform-specific API
            try {
                const browserUrl = await this.detectUrlFromBrowser();
                if (browserUrl) {
                    console.log('URL detected from browser:', browserUrl);
                    this.currentUrl = browserUrl;
                    return browserUrl;
                }
            } catch (error) {
                console.log('Browser detection failed:', error.message);
            }
            
            return null;
            
        } catch (error) {
            console.error('URL detection failed:', error);
            return null;
        }
    }
}

module.exports = UrlService;
