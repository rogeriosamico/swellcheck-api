const express = require("express");
const router = express.Router();
const { cache } = require("../lib/cache");

router.get("/clear-cache", (req, res) => {
  const count = Object.keys(cache).length;
  for (const key in cache) delete cache[key];
  res.json({ cleared: count });
});

module.exports = router;
