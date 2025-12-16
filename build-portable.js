#!/usr/bin/env node

/**
 * Build Portable App - Compatible với cách release cũ
 * Tạo folder portable + zip file như trước, nhưng có thêm auto-update support
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function log(message, color = '\x1b[0m') {
    console.log(`${color}${message}\x1b[0m`);
}

function exec(command) {
    try {
        const output = execSync(command, { encoding: 'utf8' });
        console.log(output);
        return output.trim();
    } catch (error) {
        log(`❌ Error: ${error.message}`, '\x1b[31m');
        process.exit(1);
    }
}

async function createZip(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            log(`✅ Zip created: ${path.basename(outputPath)} (${sizeMB} MB)`, '\x1b[32m');
            resolve();
        });

        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function buildExtension() {
    log('\n📦 Building Browser Extension...', '\x1b[36m');
    
    const extensionSrc = path.join(__dirname, 'browser_extension');
    const extensionDist = path.join(__dirname, 'extension-dist');
    const distDir = path.join(__dirname, 'dist');
    
    // Check if browser_extension folder exists
    if (!fs.existsSync(extensionSrc)) {
        log('  ⚠️  browser_extension folder not found, skipping...', '\x1b[33m');
        return;
    }
    
    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Copy extension files to extension-dist (if needed)
    if (!fs.existsSync(extensionDist)) {
        fs.mkdirSync(extensionDist, { recursive: true });
    }
    
    // Copy all extension files
    const filesToCopy = ['background.js', 'content.js', 'popup.js', 'popup.html', 'manifest.json'];
    let copiedCount = 0;
    filesToCopy.forEach(file => {
        const src = path.join(extensionSrc, file);
        const dst = path.join(extensionDist, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            log(`  ✅ Copied ${file}`, '\x1b[32m');
            copiedCount++;
        } else {
            log(`  ⚠️  File not found: ${file}`, '\x1b[33m');
        }
    });
    
    if (copiedCount === 0) {
        log('  ⚠️  No extension files found, skipping zip creation...', '\x1b[33m');
        return;
    }
    
    // Create extension.zip
    try {
    const extensionZip = path.join(distDir, 'extension.zip');
    await createZip(extensionDist, extensionZip);
    log('✅ Extension zip created: extension.zip', '\x1b[32m');
    } catch (error) {
        log(`  ⚠️  Failed to create extension zip: ${error.message}`, '\x1b[33m');
    }
}

async function main() {
    log('\n📦 Building Portable App with Auto-Update Support\n', '\x1b[36m');

    // Get version
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = pkg.version;
    log(`📦 Version: ${version}`, '\x1b[34m');

    // Step 0: Build extension first
    await buildExtension();

    // Step 1: Build with electron-packager (cách cũ)
    log('\n📝 Step 1: Building with electron-packager...', '\x1b[36m');
    try {
    exec('npm run pack');
    } catch (error) {
        log(`❌ Build failed: ${error.message}`, '\x1b[31m');
        process.exit(1);
    }

    // Step 2: Check output
    const distDir = path.join(__dirname, 'dist');
    const appDir = path.join(distDir, 'test-automation-screen-auto-win32-x64');
    
    // Wait a bit for file system to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!fs.existsSync(appDir)) {
        log('❌ Build failed: App directory not found', '\x1b[31m');
        log(`   Expected: ${appDir}`, '\x1b[31m');
        process.exit(1);
    }

    // Check if exe exists
    const exePath = path.join(appDir, 'test-automation-screen-auto.exe');
    if (!fs.existsSync(exePath)) {
        log('❌ Build failed: Executable not found', '\x1b[31m');
        log(`   Expected: ${exePath}`, '\x1b[31m');
        process.exit(1);
    }

    log('✅ Portable app built successfully', '\x1b[32m');

    // Step 3: Copy app-update.yml to app resources folder FIRST (before creating zip)
    log('\n📝 Step 3: Preparing update metadata in app resources...', '\x1b[36m');
    const resourcesDir = path.join(appDir, 'resources');
    const appUpdateYmlPath = path.join(resourcesDir, 'app-update.yml');
    
    // Ensure resources directory exists
    if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
        log('   Created resources directory', '\x1b[37m');
    }
    
    // Create a temporary latest.yml first (will be updated after zip is created)
    // This ensures app-update.yml exists in the zip file
    const tempYml = `version: ${version}
releaseDate: '${new Date().toISOString()}'
path: test-automation-screen-auto-portable-${version}.zip
sha512: placeholder
files:
  - url: test-automation-screen-auto-portable-${version}.zip
    sha512: placeholder
    size: 0
`;
    
    // Save temporary app-update.yml in resources folder
    fs.writeFileSync(appUpdateYmlPath, tempYml);
    log('✅ Update metadata placeholder created in app resources', '\x1b[32m');

    // Step 4: Create zip file (now includes app-update.yml)
    log('\n📝 Step 4: Creating zip file...', '\x1b[36m');
    const zipName = `test-automation-screen-auto-portable-${version}.zip`;
    const zipPath = path.join(distDir, zipName);
    
    try {
        await createZip(appDir, zipPath);
        log('✅ Zip file created (includes app-update.yml)', '\x1b[32m');
    } catch (error) {
        log(`❌ Failed to create zip: ${error.message}`, '\x1b[31m');
        process.exit(1);
    }

    // Step 5: Calculate SHA512 and create latest.yml for auto-update
    log('\n📝 Step 5: Creating update metadata...', '\x1b[36m');
    
    const crypto = require('crypto');
    const zipStats = fs.statSync(zipPath);
    const zipSize = zipStats.size;
    
    // Calculate SHA512 hash of zip file
    log('   Calculating SHA512 hash...', '\x1b[37m');
    const zipBuffer = fs.readFileSync(zipPath);
    const sha512 = crypto.createHash('sha512').update(zipBuffer).digest('hex');
    
    // Create latest.yml for electron-updater
    // Note: electron-updater for portable apps needs the zip file in GitHub releases
    // Format must match electron-updater requirements
    const latestYml = `version: ${version}
releaseDate: '${new Date().toISOString()}'
path: ${zipName}
sha512: ${sha512}
files:
  - url: ${zipName}
    sha512: ${sha512}
    size: ${zipSize}
`;

    // Save latest.yml in dist folder (for GitHub release)
    fs.writeFileSync(path.join(distDir, 'latest.yml'), latestYml);
    log('✅ Update metadata created in dist/', '\x1b[32m');
    
    // Update app-update.yml in resources folder with correct SHA512
    fs.writeFileSync(appUpdateYmlPath, latestYml);
    log('✅ Update metadata updated in app resources', '\x1b[32m');
    log(`   ${appUpdateYmlPath}`, '\x1b[37m');
    log(`   SHA512: ${sha512.substring(0, 16)}...`, '\x1b[37m');
    log(`   Size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`, '\x1b[37m');
    
    // Step 6: Recreate zip file with updated app-update.yml (optional but ensures consistency)
    log('\n📝 Step 6: Updating zip file with final metadata...', '\x1b[36m');
    try {
        await createZip(appDir, zipPath);
        log('✅ Zip file updated with final metadata', '\x1b[32m');
    } catch (error) {
        log(`⚠️  Failed to update zip: ${error.message} (continuing anyway)`, '\x1b[33m');
    }

    // Step 6: Summary
    log('\n🎉 Build completed!', '\x1b[32m');
    log('\n📦 Files created:', '\x1b[34m');
    log(`  📁 dist/test-automation-screen-auto-win32-x64/  (portable folder)`, '\x1b[37m');
    log(`  📦 dist/${zipName}  (zip file - ${(zipSize / 1024 / 1024).toFixed(2)} MB)`, '\x1b[37m');
    log(`  📄 dist/latest.yml  (update metadata for GitHub)`, '\x1b[37m');
    log(`  📄 dist/test-automation-screen-auto-win32-x64/resources/app-update.yml  (update metadata in app)`, '\x1b[37m');

    log('\n🚀 Ready to upload to GitHub:', '\x1b[36m');
    log(`  1. Create release: gh release create v${version}`, '\x1b[37m');
    log(`  2. Upload files:`, '\x1b[37m');
    log(`     - ${zipName}`, '\x1b[37m');
    log(`     - extension.zip`, '\x1b[37m');
    log(`     - latest.yml`, '\x1b[37m');
    log(`  3. Users download zip → extract → run .exe`, '\x1b[37m');
    log(`  4. Users install extension.zip in Chrome/Edge`, '\x1b[37m');
    log(`  5. Auto-update will work! ✅`, '\x1b[37m');
}

// Check if archiver is installed
try {
    require('archiver');
} catch (error) {
    log('❌ Missing dependency: archiver', '\x1b[31m');
    log('Installing archiver...', '\x1b[33m');
    exec('npm install archiver --save-dev');
    log('✅ Archiver installed', '\x1b[32m');
}

main().catch(error => {
    log(`❌ Build failed: ${error.message}`, '\x1b[31m');
    process.exit(1);
});

