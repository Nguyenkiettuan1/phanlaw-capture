#!/usr/bin/env node

/**
 * Release Helper Script
 * Builds Windows, Linux, macOS via GitHub Actions and publishes to both repos.
 *
 * Usage:
 *   node release.js patch   (1.0.0 → 1.0.1)
 *   node release.js minor   (1.0.0 → 1.1.0)
 *   node release.js major   (1.0.0 → 2.0.0)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const RELEASE_REPOS = [
    'Nguyenkiettuan1/electron_desktop_app',
    'phanlaw/electron_desktop_app',
];

const WORKFLOW_NAME = 'Build and Release';
const PRIMARY_REPO = RELEASE_REPOS[0];
const PRIMARY_GIT_REMOTE = `https://github.com/${PRIMARY_REPO}.git`;

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, silent = false) {
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
        return (output || '').trim();
    } catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
        process.exit(1);
    }
}

function execSafe(command) {
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        return { success: true, output: output.trim() };
    } catch (error) {
        return { success: false, error: error.message, output: (error.stdout || '').trim() };
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

function sleepMs(ms) {
    execSync(`powershell -Command "Start-Sleep -Seconds ${Math.ceil(ms / 1000)}"`, { stdio: 'ignore' });
}

function waitForWorkflowRun(tagName) {
    log(`\n⏳ Waiting for GitHub Actions (${WORKFLOW_NAME}) for ${tagName}...`, 'cyan');
    log('This builds Windows, Linux, and macOS. It may take 10-20 minutes.', 'yellow');

    let runId = null;
    const maxAttempts = 90;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const listResult = execSafe(
            `gh run list --repo "${PRIMARY_REPO}" --workflow "${WORKFLOW_NAME}" --limit 20 --json databaseId,headBranch,status,conclusion`
        );

        if (listResult.success) {
            const runs = JSON.parse(listResult.output || '[]');
            const matched = runs.find((run) => run.headBranch === tagName);
            if (matched?.databaseId) {
                runId = matched.databaseId;
                break;
            }
        }

        sleepMs(10000);
    }

    if (!runId) {
        log('❌ Timed out waiting for GitHub Actions workflow to start', 'red');
        process.exit(1);
    }

    exec(`gh run watch ${runId} --repo "${PRIMARY_REPO}" --exit-status`, true);
    log(`✅ Workflow completed: run ${runId}`, 'green');
    return runId;
}

function downloadReleaseArtifacts(runId, version) {
    const downloadDir = path.join(__dirname, 'release-download', `v${version}`);
    if (fs.existsSync(downloadDir)) {
        fs.rmSync(downloadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(downloadDir, { recursive: true });

    exec(`gh run download ${runId} --repo "${PRIMARY_REPO}" -n release-dist -D "${downloadDir}"`);
    return downloadDir;
}

function collectReleaseFiles(downloadDir) {
    if (!fs.existsSync(downloadDir)) {
        return [];
    }

    return fs.readdirSync(downloadDir)
        .map((name) => path.join(downloadDir, name))
        .filter((filePath) => fs.statSync(filePath).isFile());
}

function validateReleaseFiles(files, version) {
    const names = files.map((f) => path.basename(f));
    const requiredPatterns = [
        /^extension\.zip$/i,
        /\.exe$/i,
        /\.AppImage$/i,
        /\.dmg$/i,
        /^latest\.yml$/i,
        /^latest-linux\.yml$/i,
        /^latest-mac\.yml$/i,
    ];

    log('\n📝 Validating release files...', 'cyan');
    files.forEach((filePath) => {
        const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
        log(`  ✅ ${path.basename(filePath)} (${sizeMB} MB)`, 'green');
    });

    const missing = requiredPatterns.filter((pattern) => !names.some((name) => pattern.test(name)));
    if (missing.some((pattern) => pattern.source === '^extension\\.zip$')) {
        log('\n❌ extension.zip is required but missing from CI artifacts.', 'red');
        process.exit(1);
    }

    if (missing.length) {
        log(`\n⚠️  Some expected auto-update artifacts are missing for v${version}.`, 'yellow');
        log('   Release will continue with available files.', 'yellow');
    }
}

function createGitHubReleases(version, files, releaseNotes) {
    const tagName = `v${version}`;
    const escapedNotes = releaseNotes.replace(/"/g, '\\"');
    const fileArgs = files.map((filePath) => `"${filePath}"`).join(' ');

    for (const repo of RELEASE_REPOS) {
        const existing = execSafe(`gh release view ${tagName} --repo "${repo}"`);
        if (existing.success) {
            log(`♻️  Deleting existing release ${tagName} on ${repo} before re-upload...`, 'yellow');
            execSafe(`gh release delete ${tagName} --repo "${repo}" --yes`);
        }

        const releaseCmd = `gh release create ${tagName} ${fileArgs} ` +
            `--repo "${repo}" ` +
            `--title "Version ${version}" ` +
            `--notes "${escapedNotes}"`;
        exec(releaseCmd);
        log(`✅ GitHub Release published on ${repo}`, 'green');
        log(`🔗 https://github.com/${repo}/releases/tag/${tagName}`, 'blue');
    }
}

function main() {
    log('\n🚀 Release Helper for Test Automation Screen Auto\n', 'cyan');

    const versionType = process.argv[2];
    if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
        log('Usage: node release.js [patch|minor|major]', 'yellow');
        process.exit(1);
    }

    const ghCheck = execSafe('gh auth status');
    if (!ghCheck.success) {
        log('❌ GitHub CLI is not authenticated. Run: gh auth login', 'red');
        process.exit(1);
    }

    const pkg = getPackageJson();
    const oldVersion = pkg.version;
    const newVersion = incrementVersion(oldVersion, versionType);
    const tagName = `v${newVersion}`;

    log(`📦 Current version: ${oldVersion}`, 'blue');
    log(`📦 New version: ${newVersion}`, 'green');
    log('🧱 Platforms: Windows + Linux + macOS (via GitHub Actions)', 'cyan');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    readline.question(`\n❓ Continue with release ${tagName}? (y/n) `, (answer) => {
        readline.close();
        if (answer.toLowerCase() !== 'y') {
            log('\n❌ Release cancelled', 'red');
            process.exit(0);
        }
        performRelease(pkg, oldVersion, newVersion);
    });
}

function performRelease(pkg, oldVersion, newVersion) {
    const tagName = `v${newVersion}`;

    try {
        log('\n📝 Step 1: Updating package.json...', 'cyan');
        pkg.version = newVersion;
        savePackageJson(pkg);
        log(`✅ Version updated: ${oldVersion} → ${newVersion}`, 'green');

        log('\n📝 Step 2: Creating git commit and tag...', 'cyan');
        exec('git add package.json');
        exec(`git commit --no-verify -m "Release ${tagName}"`);
        exec(`git tag ${tagName}`);
        log(`✅ Git commit and tag created: ${tagName}`, 'green');

        log('\n📝 Step 3: Pushing to GitHub (primary repo only)...', 'cyan');
        log(`   Git remote: ${PRIMARY_GIT_REMOTE}`, 'blue');
        log('   phanlaw repo will receive release files only (not git push)', 'blue');
        exec(`git push ${PRIMARY_GIT_REMOTE} main`);
        exec(`git push ${PRIMARY_GIT_REMOTE} ${tagName}`);
        log('✅ Pushed main + tag (triggers multi-platform CI build)', 'green');

        const runId = waitForWorkflowRun(tagName);

        log('\n📝 Step 4: Downloading built artifacts...', 'cyan');
        const downloadDir = downloadReleaseArtifacts(runId, newVersion);
        const releaseFiles = collectReleaseFiles(downloadDir);

        if (!releaseFiles.length) {
            log('❌ No release files downloaded from CI', 'red');
            process.exit(1);
        }

        validateReleaseFiles(releaseFiles, newVersion);

        log('\n📝 Step 5: Release Notes', 'cyan');
        log('Enter release notes (or press Enter for default):', 'yellow');

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        readline.question('', (notes) => {
            readline.close();

            const releaseNotes = notes || [
                `Release ${tagName}`,
                '',
                '### Downloads',
                '- Windows: Setup + Portable (.exe)',
                '- Linux: AppImage',
                '- macOS: DMG',
                '- Browser Extension: extension.zip',
                '',
                '### Auto-update',
                '- Windows: latest.yml',
                '- Linux: latest-linux.yml',
                '- macOS: latest-mac.yml',
            ].join('\n');

            log('\n📝 Step 6: Publishing GitHub Releases (both repositories)...', 'cyan');
            createGitHubReleases(newVersion, releaseFiles, releaseNotes);

            log('\n🎉 Release completed successfully!', 'green');
            log(`📦 Users on Windows/Linux/macOS can install v${newVersion}`, 'cyan');
            log('🔄 Auto-update metadata included for all supported platforms', 'cyan');
        });
    } catch (error) {
        log(`\n❌ Release failed: ${error.message}`, 'red');
        log('Rolling back local version/tag changes...', 'yellow');

        pkg.version = oldVersion;
        savePackageJson(pkg);
        execSafe('git reset --hard HEAD~1');
        execSafe(`git tag -d ${tagName}`);

        log('✅ Rolled back to previous local state', 'green');
        process.exit(1);
    }
}

main();
