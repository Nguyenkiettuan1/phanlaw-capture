// Test Automation Screen Auto - Application Configuration
const fs = require('fs');
const path = require('path');

function loadDotEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function normalizeHost(hostValue) {
  const value = (hostValue || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, '');
  }
  return `http://${value.replace(/\/+$/, '')}`;
}

function normalizePath(pathValue) {
  const value = (pathValue || '').trim().replace(/^\/+|\/+$/g, '');
  return value || 'api/v1';
}

const fileEnv = loadDotEnvFile();
const isDev = process.argv.includes('--dev');

const defaultHost = isDev
  ? 'http://127.0.0.1:8000'
  : 'https://phanlaw-backend-app.greenwave-0b23b187.southeastasia.azurecontainerapps.io';

const backendHost = normalizeHost(process.env.BACKEND_HOST || fileEnv.BACKEND_HOST || defaultHost);
const backendPath = normalizePath(process.env.BACKEND_PATH || fileEnv.BACKEND_PATH || 'api/v1');
const apiBaseUrl = `${backendHost}/${backendPath}`;

module.exports = {
  // API Configuration
  apiBaseUrl,
  healthUrl: `${backendHost}/health`,

  // Development/Production Mode
  nodeEnv: process.env.NODE_ENV || fileEnv.NODE_ENV || (isDev ? 'development' : 'production'),

  // Backend Server Configuration
  backendHost,
  backendPath,

  // HTTP Server Configuration (for browser extension)
  httpServerPort: Number(process.env.HTTP_SERVER_PORT || fileEnv.HTTP_SERVER_PORT || 3000),
  httpServerHost: process.env.HTTP_SERVER_HOST || fileEnv.HTTP_SERVER_HOST || 'localhost',

  // Screenshot Configuration
  screenshotSavePath: process.env.SCREENSHOT_SAVE_PATH || fileEnv.SCREENSHOT_SAVE_PATH || './screenshots',
  screenshotQuality: Number(process.env.SCREENSHOT_QUALITY || fileEnv.SCREENSHOT_QUALITY || 90),

  // Logging Configuration
  logLevel: process.env.LOG_LEVEL || fileEnv.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  logFile: process.env.LOG_FILE || fileEnv.LOG_FILE || './logs/app.log',
};
