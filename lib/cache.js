const fs = require('fs');
const path = require('path');
const os = require('os');

const CACHE_FILE = path.join(os.tmpdir(), 'ondina-cache.json');
// Incrementar quando a estrutura dos dados mudar — invalida o cache em disco automaticamente
const CACHE_VERSION = 2;

function loadFromDisk() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const stored = JSON.parse(raw);
    if (stored.__version !== CACHE_VERSION) return {};
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(stored).filter(([k, v]) => k !== '__version' && v && v.expiresAt > now)
    );
  } catch {
    return {};
  }
}

const cache = loadFromDisk();

function saveToDisk() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ __version: CACHE_VERSION, ...cache }), 'utf8');
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
