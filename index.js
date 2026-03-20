const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));

const BEACHES = {
  "Paiva":             { lat: -8.3108,  lng: -34.9700, state: "pe", harbor: "pe03" },
  "Itapuama":          { lat: -8.3989,  lng: -35.0286, state: "pe", harbor: "pe03" },
  "Porto de Galinhas": { lat: -8.5075,  lng: -35.0028, state: "pe", harbor: "pe03" },
  "Maracaípe":         { lat: -8.5328,  lng: -35.0072, state: "pe", harbor: "pe03" },
  "Madeiro":           { lat: -6.2283,  lng: -35.0508, state: "rn", harbor: "rn04" },
  "Baía Formosa":      { lat: -6.3728,  lng: -35.0089, state: "rn", harbor: "rn04" },
  "Cacimba do Padre":  { lat: -3.8397,  lng: -32.4203, state: "pe", harbor: "pe01" },
  "Jericoacoara":      { lat: -2.7975,  lng: -40.5128, state: "ce", harbor: "ce01" },
  "Tourinhos":         { lat: -5.1089,  lng: -35.4908, state: "rn", harbor: "rn04" },
};

const TIDE_API = "https://tabuamare.devtu.qzz.io/api/v2";
const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
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
  if (diff < 45) return "onshore";
  if (diff > 135) return "offshore";
  return "cross";
}

function classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType }) {
  if ((swellHeight == null || swellHeight < 0.2) && (waveHeight == null || waveHeight < 0.3)) return "flat";
  const h = swellHeight || waveHeight || 0;
  const period = swellPeriod || 0;
  const wind = windSpeed || 0;
  let base;
  if (h < 0.3)       base = "flat";
  else if (h < 0.8)  base = "marola";
  else if (h < 1.6)  base = "bom";
  else               base = "storm";
  const order = ["flat", "marola", "bom", "storm"];
  if (period >= 10 && base === "marola") base = "bom";
  if (period < 6 && base === "bom")     base = "marola";
  if (windType === "onshore") {
    if (wind > 25) {
      if (base === "bom" || base === "storm") base = "storm";
      else base = order[Math.max(0, order.indexOf(base) - 2)];
    } else if (wind > 15) {
      base = order[Math.max(0, order.indexOf(base) - 1)];
    }
  } else if (windType === "offshore" && wind < 20) {
    if (base !== "storm") base = order[Math.min(2, order.indexOf(base) + 1)];
  }
  return base;
}

// ─── Lógica de forecast extraída para reuso ──────────────────────────────────
async function getForecastData(beach, date) {
  const cacheKey = `forecast|${beach}|${date}`;
  if (isCacheValid(cache[cacheKey])) return cache[cacheKey].data;

  const { lat, lng } = BEACHES[beach];
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;
  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  const [marineRes, windRes] = await Promise.all([fetch(marineUrl), fetch(windUrl)]);
  const marineJson = await marineRes.json();
  const windJson   = await windRes.json();

  if (!marineJson.hourly || !windJson.hourly) throw new Error("Sem dados para essa data.");

  const dirs = ["N","NE","E","SE","S","SO","O","NO"];
  const hours = [];

  for (let i = 0; i < 24; i++) {
    const waveHeight  = marineJson.hourly.wave_height?.[i] ?? null;
    const wavePeriod  = marineJson.hourly.wave_period?.[i] ?? null;
    const swellHeight = marineJson.hourly.swell_wave_height?.[i] ?? null;
    const swellPeriod = marineJson.hourly.swell_wave_period?.[i] ?? null;
    const swellDirDeg = marineJson.hourly.swell_wave_direction?.[i] ?? null;
    const windSpeed   = windJson.hourly.wind_speed_10m?.[i] ?? null;
    const windDirDeg  = windJson.hourly.wind_direction_10m?.[i] ?? null;

    const windDir  = windDirDeg  != null ? dirs[Math.round(windDirDeg  / 45) % 8] : "—";
    const swellDir = swellDirDeg != null ? dirs[Math.round(swellDirDeg / 45) % 8] : "—";
    const windType = getWindType(windDirDeg, swellDirDeg);
    const { score: swellEnergy, kj: swellKj } = calcSwellEnergy(swellHeight, swellPeriod);
    const cond = classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType });

    hours.push({
      hour: i,
      cond,
      height:      waveHeight  ? waveHeight.toFixed(1)  : "0.0",
      swellHeight: swellHeight ? swellHeight.toFixed(1) : "0.0",
      swellPeriod: swellPeriod ? Math.round(swellPeriod) : 0,
      swellDir,
      swellEnergy,
      swellKj,
      windSpeed:   windSpeed   ? Math.round(windSpeed)  : 0,
      windDir,
      windType,
      period:      wavePeriod  ? Math.round(wavePeriod) : 0,
    });
  }

  const dayHours = hours.filter(h => h.hour >= 6 && h.hour <= 18);
  const condOrder = { storm: 0, bom: 1, marola: 2, flat: 3 };

  const bestCond = dayHours.reduce((best, h) =>
  (condOrder[h.cond] ?? 99) < (condOrder[best.cond] ?? 99) ? h : best
  , dayHours[0]).cond;

  // Só classifica como Bom/Storm se houver janela mínima de 3h consecutivas
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
  cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
  return data;
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

app.get("/clear-cache", (req, res) => {
  const count = Object.keys(cache).length;
  for (const key in cache) delete cache[key];
  res.json({ cleared: count });
});

app.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;
  if (!beach || !BEACHES[beach]) return res.status(400).json({ error: "Praia inválida." });
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  try {
    const data = await getForecastData(beach, date);
    const cached = isCacheValid(cache[`forecast|${beach}|${date}`]);
    res.json({ ...data, cached });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

// ─── /forecast-all ───────────────────────────────────────────────────────────
app.get("/forecast-all", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const results = await Promise.allSettled(
    Object.keys(BEACHES).map(beach => getForecastData(beach, date))
  );

  const data = results
    .map((r, i) => r.status === "fulfilled" ? r.value : null)
    .filter(Boolean);

  res.json({ date, beaches: data });
});

// ─── /tide ───────────────────────────────────────────────────────────────────
app.get("/tide", async (req, res) => {
  const { date, beach } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const harbor = (beach && BEACHES[beach]) ? BEACHES[beach].harbor : "pe03";
  const cacheKey = `tide|${harbor}|${date}`;
  if (isCacheValid(cache[cacheKey])) return res.json({ ...cache[cacheKey].data, cached: true });

  const dateObj = new Date(date + "T12:00:00");
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();

  try {
    const response = await fetch(`${TIDE_API}/tabua-mare/${harbor}/${month}/[${day}]`);
    const json = await response.json();
    const tideHours = json?.data?.[0]?.months?.[0]?.days?.[0]?.hours;
    if (!tideHours) return res.status(502).json({ error: "Sem dados de maré para essa data." });

    const tides = tideHours.map(h => ({
      hour: h.hour.substring(0, 5),
      level: parseFloat(h.level.toFixed(2)),
    }));

    const data = { date, harbor, tides };
    cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados de maré." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
