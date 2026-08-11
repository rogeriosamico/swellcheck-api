const fetch = require("node-fetch");
const { getBeach } = require("../data/beaches");
const { BEACH_PROFILES } = require("../data/beach-profiles");
const { cache, isCacheValid, get6hTTL } = require("../lib/cache");
const { getTideData } = require("./tide");

// ─── Parâmetros centralizados ────────────────────────────────────────────────
// Todos os thresholds numéricos do classificador vivem aqui.
// Ajuste aqui para calibrar sem precisar vasculhar a lógica.
const SURF_CONFIG = {
  // Alturas de transição de veredito (metros)
  heights: { flat: 0.30, marola: 0.70, bom: 1.40 },  // > 1.40 = storm

  // Período para promoção/rebaixamento
  period: { upgradeMin: 8, downgradeMax: 6 },

  // Thresholds de vento (km/h)
  wind: {
    weakOnshore:     18,  // abaixo: -1 nível mas piso em "marola"
    moderateOnshore: 25,  // abaixo: -1 nível normal (pode virar flat)
    offshoreMax:     30,  // bônus offshore só abaixo desse valor (20-30 km/h offshore ainda limpa a onda)
  },

  // Janelas para o veredito do dia
  day: { minGoodWindow: 2, minGreatWindow: 3 },

  // Combinação de swells
  swells: {
    chopPeriod:      6,    // período abaixo disso = chop — ignorado no blend
    comparableRatio: 2.0,  // energia dominante/secundária acima disso: usa só o dominante
  },

  // Maré — thresholds de fase (nível normalizado 0–1)
  tide: {
    lowThreshold:  0.25,
    highThreshold: 0.75,
    genericIdeal: ["low", "mid"],  // ideal genérico para qualquer praia
    genericBad:   ["high"],        // maré cheia penaliza
  },
};

const COND_ORDER = ["flat", "marola", "bom", "storm"];
// Índice máximo que boosts de perfil/maré podem atingir. Storm só vem de altura de onda, nunca de ajuste.
const BOOST_CAP_IDX = COND_ORDER.indexOf("bom"); // 2

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// Retorna altura efetiva combinando swell dominante + secundário.
// Se o secundário é chop (período curto) ou a energia dominante é bem maior,
// usa só o dominante. Caso contrário, faz média ponderada pela energia.
function calcEffectiveHeight(domH, domKj, secH, secKj, secPeriod) {
  if (!secH || !secPeriod || secPeriod < SURF_CONFIG.swells.chopPeriod) return domH || 0;
  if (!secKj) return domH || 0;
  const ratio = (domKj || 0) / secKj;
  if (ratio >= SURF_CONFIG.swells.comparableRatio) return domH || 0;
  return ((domH || 0) * (domKj || 0) + secH * secKj) / ((domKj || 0) + secKj);
}

// ─── Classificação por hora ───────────────────────────────────────────────────

function classify({ swellHeight, swellPeriod, effectiveHeight, windSpeed, windType }) {
  const h = Math.max(swellHeight || 0, effectiveHeight || 0);
  const { flat, marola, bom } = SURF_CONFIG.heights;
  const { upgradeMin, downgradeMax } = SURF_CONFIG.period;
  const { weakOnshore, moderateOnshore, offshoreMax } = SURF_CONFIG.wind;

  if (h < flat) return "flat";
  let base = h < marola ? "marola" : h < bom ? "bom" : "storm";

  // Ajuste por período
  if (swellPeriod >= upgradeMin && base === "marola") base = "bom";
  if (swellPeriod <  downgradeMax && base === "bom")  base = "marola";

  // Ajuste por vento
  const wind = windSpeed || 0;
  const idx  = () => COND_ORDER.indexOf(base);

  if (windType === "onshore") {
    if (wind > moderateOnshore) {
      // onshore forte: -2 níveis em todos os casos
      base = COND_ORDER[Math.max(0, idx() - 2)];
    } else if (wind > weakOnshore) {
      // onshore moderado: -1 nível, pode virar flat
      base = COND_ORDER[Math.max(0, idx() - 1)];
    } else if (wind > 0) {
      // onshore fraco: -1 nível mas piso em "marola"
      base = COND_ORDER[Math.max(COND_ORDER.indexOf("marola"), idx() - 1)];
    }
  } else if (windType === "offshore" && wind < offshoreMax) {
    if (base !== "storm") base = COND_ORDER[Math.min(BOOST_CAP_IDX, idx() + 1)];
  }

  return base;
}

function applyBeachProfile(baseCond, swellDir, swellPeriod, swell2Dir, swell2Period, profile, dominantPeriod) {
  if (!profile) return baseCond;
  const idx = COND_ORDER.indexOf(baseCond);
  if (idx === -1) return baseCond;

  // Quando o swell dominante é chop, não aplica boosts — período curto degradou a
  // qualidade e perfil de praia não deve resgatar essa condição.
  const dominantIsChop = (dominantPeriod ?? swellPeriod ?? 0) < SURF_CONFIG.period.downgradeMax;

  const isIdeal = (dir, per, minPer) =>
    dir && dir !== "—" && profile.idealSwellDirs?.includes(dir) && per >= minPer && baseCond !== "storm";

  if (!dominantIsChop) {
    const boost1 = isIdeal(swellDir,  swellPeriod,  profile.minPeriod          ?? 0);
    const boost2 = isIdeal(swell2Dir, swell2Period, profile.minPeriodSecondary ?? profile.minPeriod ?? 0);
    if (boost1 || boost2) return COND_ORDER[Math.min(BOOST_CAP_IDX, idx + 1)];
  }

  if (swellDir && swellDir !== "—" && profile.badSwellDirs?.includes(swellDir)) {
    return COND_ORDER[Math.max(0, idx - 1)];
  }
  return baseCond;
}

// ─── Maré ────────────────────────────────────────────────────────────────────

// Interpola nível de maré linearmente entre os pontos disponíveis.
function interpolateTideLevel(tidePts, targetHour) {
  const pts = tidePts.map(t => {
    const [h, m] = t.hour.split(":").map(Number);
    return { h: h + m / 60, level: t.level };
  });
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].h <= targetHour && pts[i + 1].h >= targetHour) {
      const frac = (targetHour - pts[i].h) / (pts[i + 1].h - pts[i].h);
      return pts[i].level + frac * (pts[i + 1].level - pts[i].level);
    }
  }
  if (targetHour <= pts[0].h) return pts[0].level;
  return pts[pts.length - 1].level;
}

// Converte nível de maré normalizado (0–1) em fase: "low" | "mid" | "high"
function getTidePhase(level, dayMin, dayMax) {
  if (dayMax <= dayMin) return "mid";
  const norm = (level - dayMin) / (dayMax - dayMin);
  if (norm < SURF_CONFIG.tide.lowThreshold)  return "low";
  if (norm > SURF_CONFIG.tide.highThreshold) return "high";
  return "mid";
}

// Aplica +1 ou -1 com base na fase da maré e no perfil da praia.
// Só atua em praias com idealTide/badTide explícito — não aplica regra genérica
// em praias sem perfil calibrado (evita penalizar erroneamente 33 praias).
// O boost exige dominante com período decente (não chop).
function applyTideAdjustment(cond, tidePhase, profile, dominantPeriod) {
  if (!tidePhase) return cond;
  if (!profile?.idealTide && !profile?.badTide) return cond;
  const idealTide = profile.idealTide;
  const badTide   = profile.badTide;
  const idx = COND_ORDER.indexOf(cond);
  if (idx === -1) return cond;
  const dominantIsChop = (dominantPeriod ?? 0) < SURF_CONFIG.period.downgradeMax;
  if (!dominantIsChop && idealTide?.includes(tidePhase) && cond !== "storm") {
    return COND_ORDER[Math.min(BOOST_CAP_IDX, idx + 1)];
  }
  if (badTide?.includes(tidePhase)) return COND_ORDER[Math.max(0, idx - 1)];
  return cond;
}

// ─── Veredito do dia ──────────────────────────────────────────────────────────

// Encontra a janela mais longa de horas consecutivas "bom"/"storm" e retorna
// { startHour, endHour, cond } com a melhor condição da janela.
function findBestWindow(dayHours) {
  const windows = [];
  let curStart = null;
  let curBestCond = null;

  for (const h of dayHours) {
    if (h.cond === "bom" || h.cond === "storm") {
      if (curStart === null) { curStart = h.hour; curBestCond = h.cond; }
      else if (h.cond === "storm") curBestCond = "storm";
    } else {
      if (curStart !== null) {
        windows.push({ startHour: curStart, endHour: h.hour - 1, cond: curBestCond });
        curStart = null; curBestCond = null;
      }
    }
  }
  if (curStart !== null) {
    windows.push({ startHour: curStart, endHour: dayHours[dayHours.length - 1].hour, cond: curBestCond });
  }
  if (!windows.length) return null;

  // Ordena pela janela mais longa, depois pela melhor condição
  const condRank = { storm: 0, bom: 1 };
  windows.sort((a, b) => {
    const lenDiff = (b.endHour - b.startHour) - (a.endHour - a.startHour);
    if (lenDiff !== 0) return lenDiff;
    return (condRank[a.cond] ?? 2) - (condRank[b.cond] ?? 2);
  });
  return windows[0];
}

// ─── Calibração ──────────────────────────────────────────────────────────────

// Registra uma observação de campo para calibração futura dos thresholds.
// Uso: logObservation({ beach: "Madeiro", hour: 8, predicted: "marola", observed: "bom" })
function logObservation({ hour, beach, predicted, observed, notes = "" }) {
  console.log("[CALIBRATION]", JSON.stringify({
    ts: new Date().toISOString(), beach, hour, predicted, observed,
    match: predicted === observed, notes,
  }));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function getForecastData(beach, date, { debug = false } = {}) {
  const cacheKey = `forecast|${beach}|${date}`;
  if (!debug && isCacheValid(cache[cacheKey])) return { ...cache[cacheKey].data, cached: true };

  const { lat, lng } = getBeach(beach);
  const beachProfile = BEACH_PROFILES[beach] ?? null;

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;
  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code&daily=sunrise,sunset&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  const [marineRes, windRes] = await Promise.all([fetchWithTimeout(marineUrl), fetchWithTimeout(windUrl)]);
  const marineJson = await marineRes.json();
  const windJson   = await windRes.json();

  if (!marineJson.hourly || !windJson.hourly) throw new Error("Sem dados para essa data.");

  const sunriseHour = windJson.daily?.sunrise?.[0]
    ? new Date(windJson.daily.sunrise[0]).getHours() : 6;
  const sunsetHour = windJson.daily?.sunset?.[0]
    ? new Date(windJson.daily.sunset[0]).getHours() : 18;

  // Maré: tenta carregar pontos do dia; ignora erros silenciosamente
  let tidePts = null;
  let tideMin = 0, tideMax = 1;
  try {
    const tideData = await getTideData(date, beach);
    if (tideData?.tides?.length >= 2) {
      tidePts = tideData.tides;
      const levels = tidePts.map(t => t.level);
      tideMin = Math.min(...levels);
      tideMax = Math.max(...levels);
    }
  } catch (_) { /* praia sem harbor ou SQLite indisponível — continua sem maré */ }

  const dirs  = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const hours = [];

  for (let i = 0; i < 24; i++) {
    const waveHeight  = marineJson.hourly.wave_height?.[i]                         ?? null;
    const wavePeriod  = marineJson.hourly.wave_period?.[i]                         ?? null;
    const swellHeight = marineJson.hourly.swell_wave_height?.[i]                   ?? null;
    const swellPeriod = marineJson.hourly.swell_wave_period?.[i]                   ?? null;
    const swellDirDeg  = marineJson.hourly.swell_wave_direction?.[i]               ?? null;
    const swell2Height = marineJson.hourly.secondary_swell_wave_height?.[i]        ?? null;
    const swell2Period = marineJson.hourly.secondary_swell_wave_period?.[i]        ?? null;
    const swell2DirDeg = marineJson.hourly.secondary_swell_wave_direction?.[i]     ?? null;
    const windSpeed    = windJson.hourly.wind_speed_10m?.[i]                       ?? null;
    const windDirDeg  = windJson.hourly.wind_direction_10m?.[i]                   ?? null;
    const temperature = windJson.hourly.temperature_2m?.[i]                       ?? null;
    const weatherCode = windJson.hourly.weather_code?.[i]                         ?? null;

    const windDir   = windDirDeg   != null ? dirs[Math.round(windDirDeg   / 45) % 8] : "—";
    const swellDir  = swellDirDeg  != null ? dirs[Math.round(swellDirDeg  / 45) % 8] : "—";
    const swell2Dir = swell2DirDeg != null ? dirs[Math.round(swell2DirDeg / 45) % 8] : "—";

    const { score: energy1, kj: kj1 } = calcSwellEnergy(swellHeight, swellPeriod);
    const { score: energy2, kj: kj2 } = calcSwellEnergy(swell2Height, swell2Period);

    const useSwell2      = kj2 > kj1;
    const dominantHeight = useSwell2 ? swell2Height : swellHeight;
    const dominantPeriod = useSwell2 ? swell2Period : swellPeriod;
    const dominantDir    = useSwell2 ? swell2Dir    : swellDir;
    const dominantDirDeg = useSwell2 ? swell2DirDeg : swellDirDeg;
    const secHeight      = useSwell2 ? swellHeight  : swell2Height;
    const secPeriod      = useSwell2 ? swellPeriod  : swell2Period;
    const secDir         = useSwell2 ? swellDir     : swell2Dir;
    const secKj          = useSwell2 ? kj1          : kj2;
    const domKj          = useSwell2 ? kj2          : kj1;

    const swellEnergy = useSwell2 ? energy2 : energy1;
    const swellKj     = useSwell2 ? kj2     : kj1;

    const effectiveHeight = calcEffectiveHeight(dominantHeight, domKj, secHeight, secKj, secPeriod);
    const windType = getWindType(windDirDeg, dominantDirDeg);

    const baseCond = classify({
      swellHeight: dominantHeight,
      swellPeriod: dominantPeriod,
      effectiveHeight,
      windSpeed,
      windType,
    });

    const condAfterProfile = applyBeachProfile(baseCond, dominantDir, dominantPeriod, secDir, secPeriod, beachProfile, dominantPeriod);

    // Maré
    let tideLevel = null;
    let tidePhase = null;
    if (tidePts) {
      tideLevel = interpolateTideLevel(tidePts, i);
      tidePhase = getTidePhase(tideLevel, tideMin, tideMax);
    }
    const cond = applyTideAdjustment(condAfterProfile, tidePhase, beachProfile, dominantPeriod);

    const entry = {
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
      isDay:        i >= sunriseHour && i < sunsetHour,
    };

    if (debug) {
      entry._debug = {
        kj1, kj2,
        dominantSwell: useSwell2 ? "secondary" : "primary",
        dominantHeight, dominantPeriod, dominantDir,
        effectiveHeight: parseFloat(effectiveHeight.toFixed(2)),
        baseCond, condAfterProfile,
        tideLevel: tideLevel != null ? parseFloat(tideLevel.toFixed(2)) : null,
        tidePhase,
        windType,
        windSpeed: windSpeed ? Math.round(windSpeed) : 0,
      };
    }

    hours.push(entry);
  }

  // ── Veredito do dia ───────────────────────────────────────────────────────
  const dayHours  = hours.filter(h => h.hour >= sunriseHour && h.hour <= sunsetHour);
  const condOrder = { storm: 0, bom: 1, marola: 2, flat: 3 };

  const bestCond = dayHours.reduce((best, h) =>
    (condOrder[h.cond] ?? 99) < (condOrder[best.cond] ?? 99) ? h : best
  , dayHours[0]).cond;

  const bestWindow = findBestWindow(dayHours);
  const windowLen  = bestWindow ? (bestWindow.endHour - bestWindow.startHour + 1) : 0;
  const hasGoodWindow = windowLen >= SURF_CONFIG.day.minGoodWindow;
  // Veredito usa a melhor condição DENTRO da janela, não o absoluto do dia.
  // Storm exige janela >= minGreatWindow para não inflar vereditos pontuais.
  const windowCond = bestWindow?.cond ?? bestCond;
  const stormNeedsDowngrade = windowCond === "storm" && windowLen < SURF_CONFIG.day.minGreatWindow;
  const dayCond = hasGoodWindow
    ? (stormNeedsDowngrade ? "bom" : windowCond)
    : (["bom", "storm"].includes(bestCond) ? "marola" : bestCond);

  const data = {
    beach, date, cond: dayCond,
    bestStart:  bestWindow?.startHour ?? null,
    bestEnd:    bestWindow?.endHour   ?? null,
    bestWindow: bestWindow ?? null,
    hours,
  };
  if (!debug) cache[cacheKey] = { data, expiresAt: get6hTTL() };
  return { ...data, cached: false };
}

module.exports = { getForecastData, logObservation };
