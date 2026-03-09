const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));

const BEACHES = {
  "Paiva":             { lat: -8.3108, lng: -34.9700 },
  "Itapuama":          { lat: -8.3989, lng: -35.0286 },
  "Porto de Galinhas": { lat: -8.5075, lng: -35.0028 },
  "Maracaípe":         { lat: -8.5328, lng: -35.0072 },
};

// Cache em memória
const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
}

// Detecta se o vento é onshore ou offshore baseado na direção da onda e do vento
// Retorna: "offshore", "cross", "onshore"
function getWindType(windDirDeg, swellDirDeg) {
  if (windDirDeg == null || swellDirDeg == null) return "cross";
  let diff = Math.abs(windDirDeg - swellDirDeg);
  if (diff > 180) diff = 360 - diff;
  // Vento vindo na mesma direção da onda = onshore
  // Vento vindo em direção oposta = offshore
  if (diff < 45) return "onshore";
  if (diff > 135) return "offshore";
  return "cross";
}

// Lógica de classificação combinando swell, período, vento e altura total
function classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType }) {
  // Sem swell e onda fraca = flat
  if ((swellHeight == null || swellHeight < 0.2) && (waveHeight == null || waveHeight < 0.3)) {
    return "flat";
  }

  // Usa swell como referência principal, fallback para wave height
  const h = swellHeight || waveHeight || 0;
  const period = swellPeriod || 0;
  const wind = windSpeed || 0;

  // Classifica condição base pela altura do swell
  let base;
  if (h < 0.3)       base = "flat";
  else if (h < 0.8)  base = "marola";
  else if (h < 1.6)  base = "bom";
  else               base = "storm";

  const order = ["flat", "marola", "bom", "storm"];

  // Ajuste por período do swell
  // Período longo (10s+) melhora a condição, período muito curto piora
  if (period >= 10 && base === "marola") base = "bom";
  if (period < 6 && base === "bom")     base = "marola";

  // Ajuste por vento
  if (windType === "onshore") {
    if (wind > 25) {
      // Vento onshore forte: rebaixa 2 níveis ou vai para storm se onda grande
      const idx = order.indexOf(base);
      if (base === "bom" || base === "storm") base = "storm";
      else base = order[Math.max(0, idx - 2)];
    } else if (wind > 15) {
      // Vento onshore moderado: rebaixa 1 nível
      const idx = order.indexOf(base);
      base = order[Math.max(0, idx - 1)];
    }
  } else if (windType === "offshore" && wind < 20) {
    // Vento offshore leve: melhora 1 nível (até bom)
    const idx = order.indexOf(base);
    if (base !== "storm") base = order[Math.min(2, idx + 1)];
  }

  return base;
}

app.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;

  if (!beach || !BEACHES[beach]) return res.status(400).json({ error: "Praia inválida." });
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const cacheKey = `${beach}|${date}`;
  if (isCacheValid(cache[cacheKey])) {
    return res.json({ ...cache[cacheKey].data, cached: true });
  }

  const { lat, lng } = BEACHES[beach];

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;
  const windUrl   = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  try {
    const [marineRes, windRes] = await Promise.all([fetch(marineUrl), fetch(windUrl)]);
    const marineJson = await marineRes.json();
    const windJson   = await windRes.json();

    if (!marineJson.hourly || !windJson.hourly) {
      return res.status(502).json({ error: "Sem dados para essa data." });
    }

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

    const waveHeight   = avg(marineJson.hourly.wave_height);
    const wavePeriod   = avg(marineJson.hourly.wave_period);
    const swellHeight  = avg(marineJson.hourly.swell_wave_height);
    const swellPeriod  = avg(marineJson.hourly.swell_wave_period);
    const swellDirDeg  = avg(marineJson.hourly.swell_wave_direction);
    const windSpeed    = avg(windJson.hourly.wind_speed_10m);
    const windDirDeg   = avg(windJson.hourly.wind_direction_10m);

    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const windDir  = windDirDeg  != null ? dirs[Math.round(windDirDeg  / 45) % 8] : "—";
    const swellDir = swellDirDeg != null ? dirs[Math.round(swellDirDeg / 45) % 8] : "—";

    const windType = getWindType(windDirDeg, swellDirDeg);

    const cond = classify({ swellHeight, swellPeriod, waveHeight, windSpeed, windType });

    const data = {
      beach, date, cond,
      height:     waveHeight  ? waveHeight.toFixed(1)  : "0.0",
      swellHeight: swellHeight ? swellHeight.toFixed(1) : "0.0",
      swellPeriod: swellPeriod ? Math.round(swellPeriod) : 0,
      swellDir,
      windSpeed:  windSpeed   ? Math.round(windSpeed)  : 0,
      windDir,
      windType,
      period:     wavePeriod  ? Math.round(wavePeriod) : 0,
    };

    cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
