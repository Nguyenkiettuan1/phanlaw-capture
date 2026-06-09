#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const EXTENSION_FILES = [
    'background.js',
    'content.js',
    'popup.js',
    'popup.html',
    'manifest.json',
];

function log(message) {
    console.log(message);
}

async function createZip(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
            log(`✅ Extension zip created: ${path.basename(outputPath)} (${sizeMB} MB)`);
            resolve(outputPath);
        });

        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function buildExtensionZip(outputDir = path.join(__dirname, 'dist')) {
    const extensionSrc = path.join(__dirname, 'browser_extension');
    const extensionDist = path.join(__dirname, 'extension-dist');

    if (!fs.existsSync(extensionSrc)) {
        throw new Error('browser_extension folder not found');
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    if (fs.existsSync(extensionDist)) {
        fs.rmSync(extensionDist, { recursive: true, force: true });
    }
    fs.mkdirSync(extensionDist, { recursive: true });

    let copiedCount = 0;
    for (const file of EXTENSION_FILES) {
        const src = path.join(extensionSrc, file);
        const dst = path.join(extensionDist, file);
        if (!fs.existsSync(src)) {
            throw new Error(`Missing extension file: ${file}`);
        }
        fs.copyFileSync(src, dst);
        copiedCount++;
    }

    if (copiedCount === 0) {
        throw new Error('No extension files copied');
    }

    const extensionZip = path.join(outputDir, 'extension.zip');
    await createZip(extensionDist, extensionZip);
    return extensionZip;
}

if (require.main === module) {
    buildExtensionZip()
        .then((zipPath) => {
            log(`📦 Browser extension packaged at: ${zipPath}`);
        })
        .catch((error) => {
            console.error(`❌ Failed to build extension.zip: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { buildExtensionZip };
