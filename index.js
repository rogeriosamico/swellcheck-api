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
const TIDE_HARBOR = "pe03"; // Porto de Suape — mais próximo de todas as praias

const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
}

// Energia da onda (Kj) — fórmula calibrada com Surfguru
// E = H² × T × 100
function calcSwellEnergy(swellHeight, swellPeriod) {
  if (!swellHeight || !swellPeriod) return { score: 0, kj: 0 };
  const kj = Math.round(Math.pow(swellHeight, 2) * swellPeriod * 100);

  // Normaliza para escala 0-10
  // <100 Kj fraco, 100-300 moderado, 300-800 forte, >800 muito forte
  let score;
  if (kj <= 100)  score = Math.round((kj / 100) * 3);
  else if (kj <= 300) score = Math.round(3 + ((kj - 100) / 200) * 2);
  else if (kj <= 800) score = Math.round(5 + ((kj - 300) / 500) * 3);
  else score = Math.min(10, Math.round(8 + ((kj - 800) / 400) * 2));

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

app.get("/clear-cache", (req, res) => {
  const count = Object.keys(cache).length;
  for (const key in cache) delete cache[key];
  res.json({ cleared: count });
});

// Rota de previsão de surf
app.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;
  if (!beach || !BEACHES[beach]) return res.status(400).json({ error: "Praia inválida." });
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const cacheKey = `forecast|${beach}|${date}`;
  if (isCacheValid(cache[cacheKey])) return res.json({ ...cache[cacheKey].data, cached: true });

  const { lat, lng } = BEACHES[beach];
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;
  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  try {
    const [marineRes, windRes] = await Promise.all([fetch(marineUrl), fetch(windUrl)]);
    const marineJson = await marineRes.json();
    const windJson   = await windRes.json();

    if (!marineJson.hourly || !windJson.hourly) return res.status(502).json({ error: "Sem dados para essa data." });

    const hours = marineJson.hourly.time;
    const dayIdx = hours.reduce((acc, t, i) => {
      const h = new Date(t).getHours();
      if (h >= 6 && h <= 18) acc.push(i);
      return acc;
    }, []);

    const avg = (arr) => {
      if (!arr) return null;
      const vals = dayIdx.map(i => arr[i]).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const waveHeight  = avg(marineJson.hourly.wave_height);
    const wavePeriod  = avg(marineJson.hourly.wave_period);
    const swellHeight = avg(marineJson.hourly.swell_wave_height);
    const swellPeriod = avg(marineJson.hourly.swell_wave_period);
    const swellDirDeg = avg(marineJson.hourly.swell_wave_direction);
    const windSpeed   = avg(windJson.hourly.wind_speed_10m);
    const windDirDeg  = avg(windJson.hourly.wind_direction_10m);

    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const windDir  = windDirDeg  != null ? dirs[Math.round(windDirDeg  / 45) % 8] : "—";
    const swellDir = swellDirDeg != null ? dirs[Math.round(swellDirDeg / 45) % 8] : "—";

    const windType = getWindType(windDirDeg, swellDirDeg);
    const { score: swellEnergy, kj: swellKj } = calcSwellEnergy(swellHeight, swellPeriod);
    const cond = classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType });

    const data = {
      beach, date, cond,
      height:      waveHeight  ? waveHeight.toFixed(1)  : "0.0",
      swellHeight: swellHeight ? swellHeight.toFixed(1) : "0.0",
      swellPeriod: swellPeriod ? Math.round(swellPeriod) : 0,
      swellDir, swellEnergy, swellKj,
      windSpeed:   windSpeed   ? Math.round(windSpeed)  : 0,
      windDir, windType,
      period:      wavePeriod  ? Math.round(wavePeriod) : 0,
    };

    cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

// Rota de maré
app.get("/tide", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const cacheKey = `tide|${date}`;
  if (isCacheValid(cache[cacheKey])) return res.json({ ...cache[cacheKey].data, cached: true });

  const d = new Date(date + "T12:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();

  try {
    const response = await fetch(`${TIDE_API}/tabua-mare/${TIDE_HARBOR}/${month}/[${day}]`);
    const json = await response.json();

    const hours = json?.data?.[0]?.months?.[0]?.days?.[0]?.hours;
    if (!hours) return res.status(502).json({ error: "Sem dados de maré para essa data." });

    const tides = hours.map(h => ({
      hour: h.hour.substring(0, 5),
      level: parseFloat(h.level.toFixed(2)),
    }));

    const data = { date, tides };
    cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados de maré." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
