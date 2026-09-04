const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { getBeach } = require("../data/beaches");
const { cache, isCacheValid, get6hTTL } = require("../lib/cache");

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

// Média móvel de 3 pontos (bordas replicam o valor da ponta) — usada só para achar
// ONDE estão os extremos reais, sem achatar o valor/hora reportado (ver findTideExtrema).
function smooth3(levels) {
  return levels.map((cur, i) => {
    const prev = levels[i - 1] ?? cur;
    const next = levels[i + 1] ?? cur;
    return (prev + cur + next) / 3;
  });
}

// Garante espaçamento mínimo entre extremos consecutivos — em costas com maré mais
// "irregular" (ex.: patamar/oscilação perto da baixa-mar na costa holandesa, fenômeno
// real chamado de "agger"), mesmo a série suavizada (smooth3) ainda pode ter dois ou
// três extremos genuínos a menos de 1h um do outro, o que sobrepõe os labels do
// TideChart. Quando dois pontos ficam mais perto que minGapHours, descarta o mais
// próximo da média do dia e mantém o mais extremo (mais provável de ser a preamar/
// baixa-mar real, não só uma oscilação local) — repete até todos os pontos restantes
// ficarem espaçados o suficiente pra caber os labels de hora sem sobrepor.
function enforceMinGap(points, levels, minGapHours = 3) {
  if (points.length < 2) return points;
  const valid = levels.filter(v => v != null);
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;

  const kept = points.slice();
  for (let i = 1; i < kept.length; ) {
    if (kept[i].hourFloat - kept[i - 1].hourFloat < minGapHours) {
      const devPrev = Math.abs(kept[i - 1].level - mean);
      const devCur  = Math.abs(kept[i].level - mean);
      kept.splice(devPrev >= devCur ? i : i - 1, 1);
      if (i > 1) i--; // re-check the new pair formed after removal
    } else {
      i++;
    }
  }
  return kept;
}

// Extrai só os picos/vales (preamar/baixa-mar) de uma série horária — mesmo formato
// das tábuas oficiais BR (poucos pontos por dia, não uma leitura por hora).
// Refina a hora de cada extremo por interpolação parabólica nos 3 pontos ao redor,
// pra imitar a precisão de minuto das tábuas ("02:47") em vez de horas cheias.
//
// A DETECÇÃO roda sobre a série suavizada (smooth3), não sobre os dados brutos: o
// Open-Meteo é maré MODELADA, e em alguns pontos do globo (ex.: Mar do Norte) a série
// horária tem pequenas ondulações de ruído do modelo — variações de poucos cm entre
// horas vizinhas que passam no teste de "vizinho é maior/menor" mas não são preamar/
// baixa-mar de verdade. Sem suavizar, isso gera extremos espúrios coladinhos (ex.: dois
// pontos a 40min de distância), o que quebra o TideChart (labels de hora se sobrepõem —
// ver BEACHES.md, seção "Como cadastrar uma nova praia com perfil"). A REFINAÇÃO
// (offset/nível parabólico) continua usando os valores brutos ao redor do índice
// encontrado, pra não perder precisão no número exibido. Por fim, enforceMinGap cobre
// os casos em que a suavização sozinha não é suficiente (ver comentário acima).
function findTideExtrema(levels) {
  const smoothed = smooth3(levels);
  const points = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    const sPrev = smoothed[i - 1], sCur = smoothed[i], sNext = smoothed[i + 1];
    if (sPrev == null || sCur == null || sNext == null) continue;
    const isMax = sCur > sPrev && sCur >= sNext;
    const isMin = sCur < sPrev && sCur <= sNext;
    if (!isMax && !isMin) continue;

    const prev = levels[i - 1], cur = levels[i], next = levels[i + 1];
    if (prev == null || cur == null || next == null) continue;

    const denom = prev - 2 * cur + next;
    const dx = denom !== 0 ? 0.5 * (prev - next) / denom : 0;
    const offset = Math.max(-0.5, Math.min(0.5, dx));
    const refinedHour  = i + offset;
    const refinedLevel = cur - 0.25 * (prev - next) * offset;

    points.push({ hourFloat: refinedHour, level: parseFloat(refinedLevel.toFixed(2)) });
  }
  return enforceMinGap(points, levels);
}

function hourFloatToStr(hourFloat) {
  const total = Math.round(hourFloat * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Maré modelada do Open-Meteo Marine API — usada para praias sem tábua BR (ex.: Portugal).
async function getTideFromOpenMeteo(lat, lng, timezone, date) {
  const tz = encodeURIComponent(timezone || "UTC");
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=sea_level_height_msl&timezone=${tz}&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  const json = await res.json();
  const levels = json?.hourly?.sea_level_height_msl;
  if (!Array.isArray(levels) || levels.filter(v => v != null).length < 2) return null;

  const extrema = findTideExtrema(levels);
  if (extrema.length < 2) return null;

  return extrema.map(p => ({ hour: hourFloatToStr(p.hourFloat), level: p.level }));
}

async function getTideData(date, beachName) {
  const beachData = beachName ? getBeach(beachName) : null;
  if (!beachData) return null;

  const harbor   = beachData.harbor;
  const cacheKey = harbor ? `tide|${harbor}|${date}` : `tide|om|${beachName}|${date}`;

  if (isCacheValid(cache[cacheKey])) return { ...cache[cacheKey].data, cached: true };

  const tides = harbor
    ? await getTideFromSQLite(harbor, date)
    : await getTideFromOpenMeteo(beachData.lat, beachData.lng, beachData.timezone, date);
  if (!tides) return null;

  const data = { date, harbor: harbor ?? null, tides };
  cache[cacheKey] = { data, expiresAt: get6hTTL() };
  return data;
}

module.exports = { getTideData };
