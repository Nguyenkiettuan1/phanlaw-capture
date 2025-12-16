#!/usr/bin/env node

/**
 * Release Portable App - Theo cách cũ nhưng có auto-update
 * 
 * Usage:
 *   node release-portable.js patch
 *   node release-portable.js minor
 *   node release-portable.js major
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
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

function execSafe(command, silent = false) {
    try {
        const output = execSync(command, { encoding: 'utf8' });
        if (!silent) console.log(output);
        return { success: true, output: output.trim() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getPackageJson() {
    return JSON.parse(fs.readFileSync('package.json', 'utf8'));
}

function savePackageJson(pkg) {
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
}

function incrementVersion(version, type) {
    const parts = version.split('.').map(Number);
    
    switch (type) {
        case 'patch': parts[2]++; break;
        case 'minor': parts[1]++; parts[2] = 0; break;
        case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
        default: throw new Error('Invalid version type');
    }
    
    return parts.join('.');
}

function main() {
    log('\n🚀 Portable Release Helper\n', 'cyan');
    
    const versionType = process.argv[2];
    if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
        log('Usage: node release-portable.js [patch|minor|major]', 'yellow');
        process.exit(1);
    }
    
    const pkg = getPackageJson();
    const oldVersion = pkg.version;
    const newVersion = incrementVersion(oldVersion, versionType);
    
    log(`📦 ${oldVersion} → ${newVersion}`, 'blue');
    
    // Confirm
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    readline.question('Continue? (y/n): ', (answer) => {
        readline.close();
        
        if (answer.toLowerCase() !== 'y') {
            log('❌ Cancelled', 'red');
            process.exit(0);
        }
        
        performRelease(pkg, oldVersion, newVersion);
    });
}

function performRelease(pkg, oldVersion, newVersion) {
    try {
        // Step 1: Update version
        log('\n📝 Step 1: Updating version...', 'cyan');
        pkg.version = newVersion;
        savePackageJson(pkg);
        log(`✅ Version: ${oldVersion} → ${newVersion}`, 'green');
        
        // Step 2: Git commit and tag
        log('\n📝 Step 2: Git commit and tag...', 'cyan');
        exec('git add package.json');
        exec(`git commit -m "Release v${newVersion}"`);
        
        // Check if tag already exists and delete it
        const tagCheck = execSafe(`git tag -l v${newVersion}`, true);
        if (tagCheck.success && tagCheck.output && tagCheck.output.includes(`v${newVersion}`)) {
            log(`  ⚠️  Tag v${newVersion} already exists, deleting old tag...`, 'yellow');
            
            // Delete local tag
            const deleteLocal = execSafe(`git tag -d v${newVersion}`, true);
            if (deleteLocal.success) {
                log(`  ✅ Deleted local tag v${newVersion}`, 'green');
            }
            
            // Try to delete from remote
            const deleteRemote = execSafe(`git push origin :refs/tags/v${newVersion}`, true);
            if (deleteRemote.success) {
                log(`  ✅ Deleted remote tag v${newVersion}`, 'green');
            }
        }
        
        // Create new tag (or recreate if was deleted)
        exec(`git tag v${newVersion}`);
        exec('git push origin main --tags');
        log('✅ Git updated', 'green');
        
        // Step 3: Build portable app
        log('\n📝 Step 3: Building portable app...', 'cyan');
        exec('npm run build-portable');
        
        // Step 4: Check files
        log('\n📝 Step 4: Verifying files...', 'cyan');
        const zipFile = `dist/test-automation-screen-auto-portable-${newVersion}.zip`;
        const ymlFile = 'dist/latest.yml';
        const appDir = `dist/test-automation-screen-auto-win32-x64`;
        const appUpdateYmlFile = path.join(appDir, 'resources', 'app-update.yml');
        
        if (!fs.existsSync(zipFile)) {
            log(`❌ Zip file not found: ${zipFile}`, 'red');
            process.exit(1);
        }
        
        if (!fs.existsSync(ymlFile)) {
            log(`❌ Update file not found: ${ymlFile}`, 'red');
            process.exit(1);
        }
        
        if (!fs.existsSync(appUpdateYmlFile)) {
            log(`⚠️  app-update.yml not found in app resources: ${appUpdateYmlFile}`, 'yellow');
            log('   This file should be included in the zip for auto-update to work', 'yellow');
        } else {
            log('✅ app-update.yml found in app resources', 'green');
        }
        
        const zipStats = fs.statSync(zipFile);
        const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
        log(`✅ Zip file: ${zipSizeMB} MB`, 'green');
        log('✅ Update metadata ready', 'green');
        
        // Step 5: Get release notes
        log('\n📝 Step 5: Release notes...', 'cyan');
        const readline2 = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline2.question('Enter release notes (or Enter for default): ', (notes) => {
            readline2.close();
            
            const releaseNotes = notes || `## 📦 Portable Release v${newVersion}

### Download & Install
1. Download the zip file below
2. Extract to any folder
3. Run \`test-automation-screen-auto.exe\`
4. App supports auto-update!

### Changes
- Bug fixes and improvements`;
            
            // Step 6: Create GitHub Release
            log('\n📝 Step 6: Creating GitHub Release...', 'cyan');
            
            // Check if GitHub CLI is authenticated
            const ghAuthCheck = execSafe('gh auth status', true);
            if (!ghAuthCheck.success) {
                log('⚠️  GitHub CLI not authenticated', 'yellow');
                log('Please run: gh auth login', 'yellow');
                log('\n📝 Manual upload instructions:', 'cyan');
                log(`  1. Go to: https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/new`, 'yellow');
                log(`  2. Tag: v${newVersion}`, 'yellow');
                log(`  3. Title: Version ${newVersion} - Portable`, 'yellow');
                log(`  4. Upload files:`, 'yellow');
                log(`     - ${zipFile}`, 'yellow');
                log(`     - ${ymlFile}`, 'yellow');
                log(`  5. Release notes:`, 'yellow');
                log(`     ${releaseNotes.replace(/\n/g, '\n     ')}`, 'yellow');
                return; // Continue anyway, files are ready
            }
            
            try {
                const releaseCmd = `gh release create v${newVersion} ` +
                    `"${zipFile}" ` +
                    `"${ymlFile}" ` +
                    `--title "Version ${newVersion} - Portable" ` +
                    `--notes "${releaseNotes}"`;
                
                exec(releaseCmd);
                
                log('\n🎉 Release completed!', 'green');
                log(`🔗 https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/tag/v${newVersion}`, 'blue');
                log('\n📦 Users can now:', 'cyan');
                log('  1. Download zip file', 'yellow');
                log('  2. Extract and run', 'yellow');
                log('  3. Auto-update will work! ✅', 'yellow');
                
            } catch (error) {
                log('\n❌ GitHub Release failed', 'red');
                log('Create manually:', 'yellow');
                log(`  1. Go to: https://github.com/Nguyenkiettuan1/phanlaw-capture/releases/new`, 'yellow');
                log(`  2. Tag: v${newVersion}`, 'yellow');
                log(`  3. Upload: ${zipFile} and ${ymlFile}`, 'yellow');
            }
        });
        
    } catch (error) {
        log(`\n❌ Release failed: ${error.message}`, 'red');
        
        // Rollback
        log('Rolling back...', 'yellow');
        pkg.version = oldVersion;
        savePackageJson(pkg);
        exec('git reset --hard HEAD~1', true);
        try {
            exec(`git tag -d v${newVersion}`, true);
        } catch (error) {
            // Tag might not exist, ignore
        }
        
        log('✅ Rolled back', 'green');
        process.exit(1);
    }
}

main();

