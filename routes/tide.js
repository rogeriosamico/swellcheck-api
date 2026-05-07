const express = require("express");
const router = express.Router();
const { getTideData } = require("../services/tide");

router.get("/tide", async (req, res) => {
  const { date, beach } = req.query;
  if (!date) return res.status(400).json({ error: "Data obrigatória." });
  try {
    const data = await getTideData(date, beach);
    if (!data) return res.status(404).json({ error: "Sem dados de maré para essa data." });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar dados de maré." });
  }
});

module.exports = router;
