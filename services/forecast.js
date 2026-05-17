const fetch = require("node-fetch");
const { getBeach } = require("../data/beaches");
const { BEACH_PROFILES } = require("../data/beach-profiles");
const { cache, isCacheValid, get6hTTL } = require("../lib/cache");

const COND_ORDER = ["flat", "marola", "bom", "storm"];

function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function calcSwellEnergy(swellHeight, swellPeriod) {
  if (!swellHeight || !swellPeriod) return { score: 0, kj: 0 };
  const kj = Math.round(Math.pow(swellHeight, 2) * swellPeriod * 100);
  let score;
  if (kj < 500)        score = Math.round((kj / 500) * 2);
  else if (kj < 1000)  score = Math.round(2 + ((kj - 500) / 500) * 2);
  else if (kj < 2000)  score = Math.round(4 + ((kj - 1000) / 1000) * 2);
  else if (kj < 3000)  score = Math.round(6 + ((kj - 2000) / 1000) * 2);
  else                 score = Math.min(10, Math.round(8 + ((kj - 3000) / 1000) * 2));
  return { score, kj };
}

function getWindType(windDirDeg, swellDirDeg) {
  if (windDirDeg == null || swellDirDeg == null) return "cross";
  let diff = Math.abs(windDirDeg - swellDirDeg);
  if (diff > 180) diff = 360 - diff;
  if (diff < 45)  return "onshore";
  if (diff > 135) return "offshore";
  return "cross";
}

function classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType }) {
  if ((swellHeight == null || swellHeight < 0.2) && (waveHeight == null || waveHeight < 0.3)) return "flat";
  const h      = swellHeight || waveHeight || 0;
  const period = swellPeriod || 0;
  const wind   = windSpeed   || 0;
  let base;
  if (h < 0.3)      base = "flat";
  else if (h < 0.8) base = "marola";
  else if (h < 1.6) base = "bom";
  else              base = "storm";
  if (period >= 10 && base === "marola") base = "bom";
  if (period < 6  && base === "bom")    base = "marola";
  if (windType === "onshore") {
    if (wind > 25) {
      if (base === "bom" || base === "storm") base = "storm";
      else base = COND_ORDER[Math.max(0, COND_ORDER.indexOf(base) - 2)];
    } else if (wind > 15) {
      base = COND_ORDER[Math.max(0, COND_ORDER.indexOf(base) - 1)];
    }
  } else if (windType === "offshore" && wind < 20) {
    if (base !== "storm") base = COND_ORDER[Math.min(2, COND_ORDER.indexOf(base) + 1)];
  }
  return base;
}

function applyBeachProfile(baseCond, swellDir, swellPeriod, swell2Dir, swell2Period, profile) {
  if (!profile) return baseCond;
  const idx = COND_ORDER.indexOf(baseCond);
  if (idx === -1) return baseCond;

  const isIdeal = (dir, per, minPer) =>
    dir && dir !== "—" && profile.idealSwellDirs?.includes(dir) && per >= minPer && baseCond !== "storm";

  const boost1 = isIdeal(swellDir,  swellPeriod,  profile.minPeriod          ?? 0);
  const boost2 = isIdeal(swell2Dir, swell2Period, profile.minPeriodSecondary ?? profile.minPeriod ?? 0);

  if (boost1 || boost2) return COND_ORDER[Math.min(2, idx + 1)];

  // penaliza só pelo swell primário — o dominante define o humor do mar
  if (swellDir && swellDir !== "—" && profile.badSwellDirs?.includes(swellDir)) {
    return COND_ORDER[Math.max(0, idx - 1)];
  }
  return baseCond;
}

async function getForecastData(beach, date) {
  const cacheKey = `forecast|${beach}|${date}`;
  if (isCacheValid(cache[cacheKey])) return { ...cache[cacheKey].data, cached: true };

  const { lat, lng } = getBeach(beach);
  const beachProfile = BEACH_PROFILES[beach] ?? null;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;
  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  const [marineRes, windRes] = await Promise.all([fetchWithTimeout(marineUrl), fetchWithTimeout(windUrl)]);
  const marineJson = await marineRes.json();
  const windJson   = await windRes.json();

  if (!marineJson.hourly || !windJson.hourly) throw new Error("Sem dados para essa data.");

  const dirs  = ["N","NE","E","SE","S","SO","O","NO"];
  const hours = [];

  for (let i = 0; i < 24; i++) {
    const waveHeight  = marineJson.hourly.wave_height?.[i]          ?? null;
    const wavePeriod  = marineJson.hourly.wave_period?.[i]          ?? null;
    const swellHeight = marineJson.hourly.swell_wave_height?.[i]    ?? null;
    const swellPeriod = marineJson.hourly.swell_wave_period?.[i]    ?? null;
    const swellDirDeg  = marineJson.hourly.swell_wave_direction?.[i]           ?? null;
    const swell2Height = marineJson.hourly.secondary_swell_wave_height?.[i]   ?? null;
    const swell2Period = marineJson.hourly.secondary_swell_wave_period?.[i]   ?? null;
    const swell2DirDeg = marineJson.hourly.secondary_swell_wave_direction?.[i] ?? null;
    const windSpeed    = windJson.hourly.wind_speed_10m?.[i]                   ?? null;
    const windDirDeg  = windJson.hourly.wind_direction_10m?.[i]     ?? null;
    const temperature = windJson.hourly.temperature_2m?.[i]         ?? null;
    const weatherCode = windJson.hourly.weather_code?.[i]           ?? null;

    const windDir  = windDirDeg  != null ? dirs[Math.round(windDirDeg  / 45) % 8] : "—";
    const swellDir = swellDirDeg != null ? dirs[Math.round(swellDirDeg / 45) % 8] : "—";
    const swell2Dir = swell2DirDeg != null ? dirs[Math.round(swell2DirDeg / 45) % 8] : "—";
    const windType = getWindType(windDirDeg, swellDirDeg);
    const isEffective2 = beachProfile &&
      swell2Dir && swell2Dir !== "—" &&
      beachProfile.idealSwellDirs?.includes(swell2Dir) &&
      swell2Period >= (beachProfile.minPeriodSecondary ?? beachProfile.minPeriod ?? 0);
    const energyHeight = isEffective2 ? swell2Height : swellHeight;
    const energyPeriod = isEffective2 ? swell2Period  : swellPeriod;
    const { score: swellEnergy, kj: swellKj } = calcSwellEnergy(energyHeight, energyPeriod);
    const baseCond = classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType });
    const cond = applyBeachProfile(baseCond, swellDir, swellPeriod, swell2Dir, swell2Period, beachProfile);

    hours.push({
      hour: i,
      cond,
      height:      waveHeight  ? waveHeight.toFixed(1)   : "0.0",
      swellHeight: swellHeight ? swellHeight.toFixed(1)  : "0.0",
      swellPeriod: swellPeriod ? Math.round(swellPeriod) : 0,
      swellDir,
      swellEnergy,
      swellKj,
      swell2Height: swell2Height ? swell2Height.toFixed(1) : null,
      swell2Period: swell2Period ? Math.round(swell2Period) : null,
      swell2Dir:    swell2Dir !== "—" ? swell2Dir : null,
      windSpeed:    windSpeed   ? Math.round(windSpeed)   : 0,
      windDir,
      windType,
      period:       wavePeriod  ? Math.round(wavePeriod)  : 0,
      temperature:  temperature != null ? Math.round(temperature) : null,
      weatherCode:  weatherCode ?? null,
    });
  }

  const dayHours  = hours.filter(h => h.hour >= 6 && h.hour <= 18);
  const condOrder = { storm: 0, bom: 1, marola: 2, flat: 3 };

  const bestCond = dayHours.reduce((best, h) =>
    (condOrder[h.cond] ?? 99) < (condOrder[best.cond] ?? 99) ? h : best
  , dayHours[0]).cond;

  const MIN_WINDOW = 3;
  let maxRun = 0, curRun = 0;
  for (const h of dayHours) {
    if (["bom", "storm"].includes(h.cond)) { curRun++; maxRun = Math.max(maxRun, curRun); }
    else curRun = 0;
  }
  const hasGoodWindow = maxRun >= MIN_WINDOW;
  const dayCond = hasGoodWindow ? bestCond : (["bom", "storm"].includes(bestCond) ? "marola" : bestCond);

  let bestStart = null, bestEnd = null, curStart = null;
  dayHours.forEach(h => {
    if (h.cond === "bom" || h.cond === "storm") {
      if (curStart === null) curStart = h.hour;
      bestStart = curStart; bestEnd = h.hour;
    } else { curStart = null; }
  });

  const data = { beach, date, cond: dayCond, bestStart, bestEnd, hours };
  cache[cacheKey] = { data, expiresAt: get6hTTL() };
  return { ...data, cached: false };
}

module.exports = { getForecastData };
