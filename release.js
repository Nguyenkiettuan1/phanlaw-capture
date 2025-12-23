#!/usr/bin/env node

/**
 * Release Helper Script
 * Automates the release process for the app
 * 
 * Usage:
 *   node release.js patch   (1.0.0 → 1.0.1)
 *   node release.js minor   (1.0.0 → 1.1.0)
 *   node release.js major   (1.0.0 → 2.0.0)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, silent = false) {
    try {
        const output = execSync(command, { encoding: 'utf8' });
        if (!silent) console.log(output);
        return output.trim();
    } catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

function getPackageJson() {
    const packagePath = path.join(__dirname, 'package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function savePackageJson(pkg) {
    const packagePath = path.join(__dirname, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function incrementVersion(version, type) {
    const parts = version.split('.').map(Number);
    
    switch (type) {
        case 'patch':
            parts[2]++;
            break;
        case 'minor':
            parts[1]++;
            parts[2] = 0;
            break;
        case 'major':
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
            break;
        default:
            throw new Error('Invalid version type. Use: patch, minor, or major');
    }
    
    return parts.join('.');
}

function main() {
    log('\n🚀 Release Helper for Test Automation Screen Auto\n', 'cyan');
    
    // Get version increment type
    const versionType = process.argv[2];
    
    if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
        log('Usage: node release.js [patch|minor|major]', 'yellow');
        log('  patch: 1.0.0 → 1.0.1 (bug fixes)', 'yellow');
        log('  minor: 1.0.0 → 1.1.0 (new features)', 'yellow');
        log('  major: 1.0.0 → 2.0.0 (breaking changes)', 'yellow');
        process.exit(1);
    }
    
    // Read package.json
    const pkg = getPackageJson();
    const oldVersion = pkg.version;
    const newVersion = incrementVersion(oldVersion, versionType);
    
    log(`📦 Current version: ${oldVersion}`, 'blue');
    log(`📦 New version: ${newVersion}`, 'green');
    
    // Confirm
    console.log(`\n❓ Continue with release v${newVersion}? (y/n)`);
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    readline.question('', (answer) => {
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            log('\n❌ Release cancelled', 'red');
            process.exit(0);
        }
        
        performRelease(pkg, oldVersion, newVersion);
    });
}

function performRelease(pkg, oldVersion, newVersion) {
    try {
        // Step 1: Update version in package.json
        log('\n📝 Step 1: Updating package.json...', 'cyan');
        pkg.version = newVersion;
        savePackageJson(pkg);
        log(`✅ Version updated: ${oldVersion} → ${newVersion}`, 'green');
        
        // Step 2: Git commit and tag
        log('\n📝 Step 2: Creating git commit and tag...', 'cyan');
        exec('git add package.json');
        exec(`git commit -m "Release v${newVersion}"`);
        exec(`git tag v${newVersion}`);
        log(`✅ Git commit and tag created: v${newVersion}`, 'green');
        
        // Step 3: Push to GitHub
        log('\n📝 Step 3: Pushing to GitHub...', 'cyan');
        exec('git push origin main');
        exec('git push origin --tags');
        log('✅ Pushed to GitHub', 'green');
        
        // Step 4: Build app
        log('\n📝 Step 4: Building app...', 'cyan');
        log('⏳ This may take a few minutes...', 'yellow');
        exec('npm run build-win');
        log('✅ App built successfully', 'green');
        
        // Step 5: Check files
        log('\n📝 Step 5: Checking build files...', 'cyan');
        const distDir = path.join(__dirname, 'dist');
        // Match actual file names from electron-builder
        const exeFile = `Test Automation Screen Auto-Setup-${newVersion}.exe`;
        const blockmapFile = `${exeFile}.blockmap`;
        const ymlFile = 'latest.yml';
        
        const files = [exeFile, blockmapFile, ymlFile];
        let allFilesExist = true;
        
        files.forEach(file => {
            const filePath = path.join(distDir, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                log(`  ✅ ${file} (${sizeMB} MB)`, 'green');
            } else {
                log(`  ❌ ${file} NOT FOUND!`, 'red');
                allFilesExist = false;
            }
        });
        
        if (!allFilesExist) {
            log('\n❌ Build failed: Missing files', 'red');
            process.exit(1);
        }
        
        // Step 6: Prompt for release notes
        log('\n📝 Step 6: Release Notes', 'cyan');
        log('Enter release notes (or press Enter for default):', 'yellow');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline.question('', (notes) => {
            readline.close();
            
            const releaseNotes = notes || `Release v${newVersion}\n\nBug fixes and improvements.`;
            
            // Step 7: Create GitHub Release
            log('\n📝 Step 7: Creating GitHub Release...', 'cyan');
            
            // Escape file paths with quotes for PowerShell/Windows
            const exePath = path.join(distDir, exeFile);
            const blockmapPath = path.join(distDir, blockmapFile);
            const ymlPath = path.join(distDir, ymlFile);
            
            // Use quotes around file paths to handle spaces
            const releaseCmd = `gh release create v${newVersion} ` +
                `"${exePath}" ` +
                `"${blockmapPath}" ` +
                `"${ymlPath}" ` +
                `--title "Version ${newVersion}" ` +
                `--notes "${releaseNotes.replace(/"/g, '\\"')}"`;
            
            try {
                exec(releaseCmd);
                log(`✅ GitHub Release created: v${newVersion}`, 'green');
                log(`🔗 https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/tag/v${newVersion}`, 'blue');
                
                log('\n🎉 Release completed successfully!', 'green');
                log(`\n📦 Users can now download v${newVersion}`, 'cyan');
                log(`🔄 Existing users will be notified to update automatically`, 'cyan');
                
            } catch (error) {
                log('\n❌ Failed to create GitHub Release', 'red');
                log('You can create it manually:', 'yellow');
                log(`  1. Go to: https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/new`, 'yellow');
                log(`  2. Tag: v${newVersion}`, 'yellow');
                log(`  3. Upload files from dist/ folder`, 'yellow');
            }
        });
        
    } catch (error) {
        log(`\n❌ Release failed: ${error.message}`, 'red');
        log('Rolling back changes...', 'yellow');
        
        // Rollback version
        pkg.version = oldVersion;
        savePackageJson(pkg);
        
        // Rollback git
        exec('git reset --hard HEAD~1', true);
        exec(`git tag -d v${newVersion}`, true);
        
        log('✅ Rolled back to previous state', 'green');
        process.exit(1);
    }
}

// Run
main();

