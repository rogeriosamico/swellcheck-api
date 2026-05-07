const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const { getBeach } = require("../data/beaches");
const { cache, isCacheValid, getMidnightUTC } = require("../lib/cache");

let db = null;

async function getDB() {
  if (db) return db;
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(path.join(__dirname, "../taubinha.sqlite"));
  db = new SQL.Database(buf);
  return db;
}

async function getTideFromSQLite(harbor, date) {
  const database = await getDB();
  const dateObj = new Date(date + "T12:00:00");
  const year  = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day   = dateObj.getDate();

  const stmt = database.prepare(`
    SELECT h.hour, h.level
    FROM hour_data h
    JOIN day_data d   ON h.day_data_id   = d.id
    JOIN month_data m ON d.month_data_id = m.id
    JOIN data_mare dm ON m.data_mare_id  = dm.id
    WHERE dm.id_harbor_state = :harbor AND dm.year = :year AND m.month = :month AND d.day = :day
    ORDER BY h.hour
  `);

  stmt.bind({ ':harbor': harbor, ':year': year, ':month': month, ':day': day });
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  if (!rows.length) return null;

  return rows.map(r => ({
    hour:  r.hour.substring(0, 5),
    level: parseFloat(r.level.toFixed(2)),
  }));
}

async function getTideData(date, beachName) {
  const beachData = beachName ? getBeach(beachName) : null;
  const harbor    = beachData ? beachData.harbor : "pe03";
  const cacheKey  = `tide|${harbor}|${date}`;

  if (isCacheValid(cache[cacheKey])) return { ...cache[cacheKey].data, cached: true };

  const tides = await getTideFromSQLite(harbor, date);
  if (!tides) return null;

  const data = { date, harbor, tides };
  cache[cacheKey] = { data, expiresAt: getMidnightUTC() };
  return data;
}

module.exports = { getTideData };
