const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
}

module.exports = { cache, isCacheValid, getMidnightUTC };
