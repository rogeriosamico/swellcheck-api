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

const API_KEY = process.env.STORMGLASS_API_KEY;

app.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;

  if (!beach || !BEACHES[beach]) {
    return res.status(400).json({ error: "Praia inválida." });
  }
  if (!date) {
    return res.status(400).json({ error: "Data obrigatória." });
  }

  const { lat, lng } = BEACHES[beach];
  const start = new Date(date + "T06:00:00Z").toISOString();
  const end   = new Date(date + "T18:00:00Z").toISOString();

  const params = "waveHeight,wavePeriod,windSpeed,windDirection";
  const url = `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${params}&start=${start}&end=${end}&source=sg`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: API_KEY },
    });
    const json = await response.json();

    if (!json.hours || json.hours.length === 0) {
      return res.status(502).json({ error: "Sem dados para essa data.", debug: json });
    }

    // Média dos valores do dia
    const avg = (key) => {
      const vals = json.hours.map(h => h[key]?.sg).filter(v => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const waveHeight   = avg("waveHeight");
    const wavePeriod   = avg("wavePeriod");
    const windSpeed    = avg("windSpeed");
    const windDirDeg   = avg("windDirection");

    // Converte graus em direção cardinal
    const dirs = ["N","NE","E","SE","S","SO","O","NO"];
    const windDir = windDirDeg != null
      ? dirs[Math.round(windDirDeg / 45) % 8]
      : "—";

    // Define condição baseada na altura da onda
    let cond;
    if (waveHeight === null)      cond = "flat";
    else if (waveHeight < 0.3)    cond = "flat";
    else if (waveHeight < 0.8)    cond = "marola";
    else if (waveHeight < 1.6)    cond = "bom";
    else                          cond = "storm";

    res.json({
      beach,
      date,
      cond,
      height: waveHeight ? waveHeight.toFixed(1) : "0.0",
      period: wavePeriod ? Math.round(wavePeriod) : 0,
      windSpeed: windSpeed ? Math.round(windSpeed * 3.6) : 0, // m/s → km/h
      windDir,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
