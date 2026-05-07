const express = require("express");
const router = express.Router();
const { getForecastData } = require("../services/forecast");
const { getBeach, BEACHES } = require("../data/beaches");

router.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;
  if (!beach || !getBeach(beach)) return res.status(400).json({ error: "Praia inválida." });
  if (!date) return res.status(400).json({ error: "Data obrigatória." });
  try {
    const data = await getForecastData(beach, date);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

router.get("/forecast-all", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });
  const results = await Promise.allSettled(
    Object.keys(BEACHES).map(beach => getForecastData(beach, date))
  );
  const data = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
  res.json({ date, beaches: data });
});

module.exports = router;
