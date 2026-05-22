const express = require("express");
const router = express.Router();
const { getForecastData } = require("../services/forecast");
const { getBeach, BEACHES } = require("../data/beaches");
const { cache, isCacheValid, get6hTTL, saveToDisk } = require("../lib/cache");

router.get("/forecast", async (req, res) => {
  const { beach, date } = req.query;
  if (!beach || !getBeach(beach)) return res.status(400).json({ error: "Praia inválida." });
  if (!date) return res.status(400).json({ error: "Data obrigatória." });
  try {
    const debug = req.query.debug === "1";
    const data = await getForecastData(beach, date, { debug });
    if (!debug) saveToDisk();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados." });
  }
});

async function allSettledInBatches(items, fn, batchSize = 4) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

router.get("/forecast-all", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });

  const listKey = `forecast-all|${date}`;
  if (isCacheValid(cache[listKey])) {
    return res.json(cache[listKey].data);
  }

  const beachNames = Object.keys(BEACHES);
  const results = await allSettledInBatches(beachNames, beach => getForecastData(beach, date), 4);
  const data = results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);

  const response = { date, beaches: data, total: beachNames.length, loaded: data.length };

  if (data.length === beachNames.length) {
    cache[listKey] = { data: response, expiresAt: get6hTTL() };
  }
  if (data.length > 0) {
    saveToDisk();
  }

  res.json(response);
});

module.exports = router;
