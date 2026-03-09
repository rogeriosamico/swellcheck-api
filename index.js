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

// Cache em memória: chave = "beach|date", valor = { data, expiresAt }
const cache = {};

function isCacheValid(entry) {
  return entry && Date.now() < entry.expiresAt;
}

function getMidnightUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime();
}

app.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;

  if (!beach || !BEACHES[beach]) {
    return res.status(400).json({ error: "Praia inválida." });
  }
  if (!date) {
    return res.status(400).json({ error: "Data obrigatória." });
  }

  const cacheKey = `${beach}|${date}`;

  if (isCacheValid(cache[cacheKey])) {
    console.log(`Cache hit: ${cacheKey}`);
    return res.json({ ...cache[cacheKey].data, cached: true });
  }

  console.log(`Cache miss: ${cacheKey} — chamando Open-Meteo`);

  const { lat, lng } = BEACHES[beach];

  // Open-Meteo Marine API — dados de onda
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  // Open-Meteo Weather API — dados de vento
  const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&timezone=America%2FRecife&start_date=${date}&end_date=${date}`;

  try {
    const [marineRes, windRes] = await Promise.all([
      fetch(marineUrl),
      fetch(windUrl),
    ]);

    const marineJson = await marineRes.json();
    const windJson   = await windRes.json();

    if (!marineJson.hourly || !windJson.hourly) {
      return res.status(502).json({ error: "Sem dados para essa data." });
    }

    // Pega horas do período diurno (6h às 18h)
    const hours = marineJson.hourly.time;
    const dayIndexes = hours.reduce((acc, t, i) => {
      const h = new Date(t).getHours();
      if (h >= 6 && h <= 18) acc.push(i);
      return acc;
    }, []);

    const avg = (arr) => {
      const vals = dayIndexes.map(i => arr[i]).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const waveHeight = avg(marineJson.hourly.wave_height);
    const wavePeriod = avg(marineJson.hourly.wave_period);
    const windSpeed  = avg(windJson.hourly.wind_speed_10m);
    const windDirDeg = avg(windJson.hourly.wind_direction_10m);

    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const windDir = windDirDeg != null ? dirs[Math.round(windDirDeg / 45) % 8] : "—";

    let cond;
    if (waveHeight === null)    cond = "flat";
    else if (waveHeight < 0.3)  cond = "flat";
    else if (waveHeight < 0.8)  cond = "marola";
    else if (waveHeight < 1.6)  cond = "bom";
    else                        cond = "storm";

    const data = {
      beach,
      date,
      cond,
      height: waveHeight ? waveHeight.toFixed(1) : "0.0",
      period: wavePeriod ? Math.round(wavePeriod) : 0,
      windSpeed: windSpeed ? Math.round(windSpeed) : 0, // Open-Meteo já retorna km/h
      windDir,
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
