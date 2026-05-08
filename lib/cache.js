const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function get6hTTL() {
  return Date.now() + 6 * 60 * 60 * 1000;
}

module.exports = { cache, isCacheValid, get6hTTL };
