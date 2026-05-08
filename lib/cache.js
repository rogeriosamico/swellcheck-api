const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_FILE = path.join(os.tmpdir(), 'swell-check-cache.json');

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const stored = JSON.parse(raw);
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(stored).filter(([, v]) => v && v.expiresAt > now)
    );
  } catch {
    return {};
  }
}

const cache = loadFromDisk();

function saveToDisk() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch {
    // silent fail em filesystems read-only (ex: alguns deploys serverless)
  }
}

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function get6hTTL() {
  return Date.now() + 6 * 60 * 60 * 1000;
}

module.exports = { cache, isCacheValid, get6hTTL, saveToDisk };
