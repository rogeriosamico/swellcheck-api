// Perfis de praia para calibração da classificação de condições.
// Cada perfil modifica o resultado base do classify() com base na direção do swell e maré.
// Praias sem perfil usam apenas o classificador genérico (fallback).
//
// idealSwellDirs: direções que geram boost de +1 nível (se período >= minPeriod)
// badSwellDirs:   direções que geram penalização de -1 nível
// idealTide:      fases de maré que geram boost de +1 nível — ["low", "mid", "high"]
// badTide:        fases de maré que geram penalização de -1 nível
//
// Fase de maré é calculada por nível normalizado no dia (0=baixa, 1=cheia):
//   "low"  → < 25% do range diário
//   "mid"  → 25–75%
//   "high" → > 75%

const BEACH_PROFILES = {

  // ─── Pernambuco ────────────────────────────────────────────────────────────

  // Praia voltada para norte — fundo misto reef + areia (laje no outside + banco de areia)
  // Fontes: Guia Waves, surf-forecast.com, experiência real 14-15/mai/2026
  "Madeiro": {
    idealSwellDirs: ["N", "NE"],
    minPeriod: 10,          // swell primário precisa de groundswell para ativar a laje
    minPeriodSecondary: 8,  // swell secundário de N/NE com 8s já trabalha no banco de areia
    badSwellDirs: ["S", "SE"],
    idealTide: ["low", "mid"],  // reef funciona melhor com água mais rasa
    badTide:   ["high"],
  },

  // Praia voltada para leste/nordeste — fundo areia, referência de calibragem do classificador
  // Fontes: geografia de Cabo de Santo Agostinho, calibragem histórica do app
  "Paiva": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],  // banco de areia funciona melhor na meia maré (secando ou enchendo)
    badTide:   ["high"],
  },

  // Vizinha do Paiva, mesma costa SE — beach break de areia
  // Fonte: localização (lat -8.3989), comportamento esperado igual ao Paiva
  "Itapuama": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Costa SE de Ipojuca — mix de ground e windswell, mid tide documentada
  // Fonte: surf-forecast.com, waves.com.br
  "Porto de Galinhas": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // Beach break muito consistente, mesma costa SE que Porto de Galinhas
  // Fonte: guia.waves.com.br — SE/E ideal, funciona em quase qualquer maré
  "Maracaípe": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break voltado para SE, inverno como melhor época
  // Fonte: surf-forecast.com — SE ideal, WNW offshore
  "Serrambi": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break de Paulista, costa leste
  // Fonte: localização (lat -7.9508), padrão típico do litoral PE leste
  "Janga": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Próxima a recifes — janela de maré mais estreita que beach break puro
  // Fonte: localização (lat -7.9908), influência dos recifes de Olinda
  "Olinda": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // ─── Fernando de Noronha ───────────────────────────────────────────────────

  // Costa norte do arquipélago (Mar de Dentro) — maior tubo do Brasil
  // Fundo areia + rocha; high tide favorece; precisa de swell N/NNW de groundswell pesado
  // Fonte: surf-forecast.com, topologica.co, Guia Waves — temporada nov–abr
  "Cacimba do Padre": {
    idealSwellDirs: ["N", "NO"],
    minPeriod: 12,
    badSwellDirs: ["S", "SE"],
    idealTide: ["high"],
    badTide:   ["low"],
  },

  // Mesma enseada da Cacimba do Padre — orientação e maré idênticas, período ligeiramente menor
  // Fonte: surf-forecast.com, stormrider.surf
  "Praia da Conceição": {
    idealSwellDirs: ["N", "NO"],
    minPeriod: 10,
    badSwellDirs: ["S", "SE"],
    idealTide: ["high"],
    badTide:   ["low"],
  },

  // ─── Rio Grande do Norte ───────────────────────────────────────────────────

  // Costa norte, reef ativa com maré subindo/cheia
  // Fonte: ranchogostoso.com.br, localização (lat -5.1089)
  "Tourinhos": {
    idealSwellDirs: ["N", "NE"],
    minPeriod: 9,
    badSwellDirs: ["S", "SE"],
    idealTide: ["mid", "high"],
    badTide:   ["low"],
  },

  // Beach break voltado para norte, melhor out–dez com chegada de ondulação N/NE
  // Fonte: ranchogostoso.com.br — swell N/NE, melhor outubro a dezembro
  "São Miguel do Gostoso": {
    idealSwellDirs: ["N", "NE"],
    minPeriod: 8,
    badSwellDirs: ["S", "SE"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break de Natal, costa leste
  // Fonte: surfguru.com.br, localização (lat -5.8906)
  "Ponta Negra": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break de Pipa — SE é a direção documentada como ideal
  // Fonte: guia.waves.com.br (Pipa Amor): SE ideal, WSW offshore
  "Praia do Amor": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Pontal tem reef que funciona melhor com maré subindo/cheia; SE/E no inverno
  // Fonte: surf-forecast.com (Baia Formosa), baiaformosa.com.br
  "Baía Formosa": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["mid", "high"],
    badTide:   ["low"],
  },

  // ─── Ceará ─────────────────────────────────────────────────────────────────

  // Beach break voltado para NO/N — melhor dez–abr quando chega swell NE
  // Fonte: vivajeri.com.br, surfline.com
  "Jericoacoara": {
    idealSwellDirs: ["NE", "N"],
    minPeriod: 8,
    badSwellDirs: ["S", "SE"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Costa NO do Ceará — NE ideal confirmado por surf-forecast (Tabinha/Preá), mid tide
  // Fonte: surf-forecast.com (break Tabinha)
  "Preá": {
    idealSwellDirs: ["NE", "N"],
    minPeriod: 7,
    badSwellDirs: ["S", "SE"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // Beach break na costa NO do CE, campeonatos regionais de NE swell
  // Fonte: ceara.gov.br, localização (lat -3.4685)
  "Taíba": {
    idealSwellDirs: ["NE", "N"],
    minPeriod: 7,
    badSwellDirs: ["S", "SE"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break costa NO do CE, mesma exposição de Taíba e Preá
  // Fonte: surfguru.com.br, localização (lat -3.2189)
  "Flecheiras": {
    idealSwellDirs: ["NE", "N"],
    minPeriod: 7,
    badSwellDirs: ["S", "SE"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break de Fortaleza, costa NE do CE — NE swell com WNW offshore
  // Fonte: surf-forecast.com (Praia do Futuro)
  "Praia do Futuro": {
    idealSwellDirs: ["NE", "E"],
    minPeriod: 8,
    badSwellDirs: ["S", "SO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Costa SE do CE (perto da divisa com RN) — SE/E swell, beach break
  // Fonte: surfguru.com.br, localização (lat -4.5222)
  "Canoa Quebrada": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Próxima a Canoa Quebrada, influência de reef lateral — janela de maré estreita
  // Fonte: localização (lat -4.8264), guias regionais
  "Ponta Grossa": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // ─── Alagoas ───────────────────────────────────────────────────────────────

  // Beach break voltado para S/SE — tubos famosos, S swell documentado
  // Fonte: surfline.com, reservasdesurf.org.br
  "Praia do Francês": {
    idealSwellDirs: ["S", "SE"],
    minPeriod: 9,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Mesma exposição S/SE que Praia do Francês, mais ao norte da costa AL
  // Fonte: surf-forecast.com (Japaratinga) — S/SE, WNW offshore
  "Japaratinga": {
    idealSwellDirs: ["S", "SE"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // ─── Bahia ─────────────────────────────────────────────────────────────────

  // Principal pico de Itacaré — rápida, oca, intermediário/avançado, SE/E ideal
  // Fonte: essaeminhaonda.com, guia.waves.com.br (Tiririca)
  "Tiririca": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 9,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Principal pico de longboard de Itacaré — protegida do NE, precisa de mais água
  // Fonte: itacare.surf, itacare.com — SE/S ideal, protegida do NE, mid/high tide
  "Engenhoca": {
    idealSwellDirs: ["SE", "S"],
    minPeriod: 8,
    badSwellDirs: ["N", "NE"],
    idealTide: ["mid", "high"],
    badTide:   ["low"],
  },

  // Beach break com bancos de areia em Itacaré — SE/E, similar à Tiririca
  // Fonte: itacare.surf — SE/E, beach break com canais
  "Itacarezinho": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Recifes de coral na costa NE da Bahia — reef prefere maré enchendo/cheia
  // Fonte: surfbahia.com.br, localização (lat -12.5778)
  "Praia do Forte": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["mid", "high"],
    badTide:   ["low"],
  },

  // Sul da Bahia, costa aberta S/SE — beach break sem proteção
  // Fonte: localização (lat -17.3428), mesmo padrão do litoral sul BA
  "Prado - Corumbau": {
    idealSwellDirs: ["S", "SE"],
    minPeriod: 9,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // ─── Paraíba ───────────────────────────────────────────────────────────────

  // Beach break de Cabedelo — ESE ideal documentado, WNW offshore
  // Fonte: surf-forecast.com (Intermares)
  "Intermares": {
    idealSwellDirs: ["E", "SE"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Beach break de João Pessoa — E/SE, 2–4 pés, mid tide
  // Fonte: waves.com.br (Bessa)
  "Bessa": {
    idealSwellDirs: ["E", "SE"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Costa leste ao norte de JP — windswells e groundswells E/SE
  // Fonte: localização (lat -6.9283), padrão do litoral PB leste
  "Praia de Campina": {
    idealSwellDirs: ["E", "SE"],
    minPeriod: 7,
    badSwellDirs: ["N", "NO"],
    idealTide: ["low", "mid"],
    badTide:   ["high"],
  },

  // Costa norte da PB (Mataraca) — swell N/NE; foz de rio, janela de maré estreita
  // Fonte: paraibatrip, localização (lat -6.5997, lng -35.0578)
  "Barra de Camaratuba": {
    idealSwellDirs: ["N", "NE"],
    minPeriod: 9,
    badSwellDirs: ["S", "SE"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // ─── Piauí ─────────────────────────────────────────────────────────────────

  // Parnaíba/PI, costa voltada N/NO — fundo rochoso, janela de maré estreita
  // Fonte: surfmappers.com, deltarioparnaiba.com.br — NE swell, kitesurf + surf
  "Pedra do Sal": {
    idealSwellDirs: ["NE", "N"],
    minPeriod: 8,
    badSwellDirs: ["S", "SE"],
    idealTide: ["mid"],
    badTide:   ["low", "high"],
  },

  // ─── Portugal ──────────────────────────────────────────────────────────────
  // Não validado (baseado em surf guides públicos, sem monitoramento local).

  // Reef/point break de Ericeira — a mais consistente das praias de teste
  // Fonte: surf-forecast.com, guia de Ericeira — NO/O ideal, offshore de leste, funciona em quase toda maré
  "Ribeira d'Ilhas": {
    idealSwellDirs: ["NO", "O"],
    minPeriod: 10,
    idealTide: ["mid"],
  },

  // Beach break de Peniche — um dos barrels mais fortes da Europa
  // Fonte: surf-forecast.com, reservasdesurf — S/SO/O ideal, swell muito de N fica na sombra
  "Supertubos": {
    idealSwellDirs: ["SO", "O"],
    minPeriod: 9,
    badSwellDirs: ["NO"],
    idealTide: ["mid"],
  },

  // Big-wave spot amplificado pelo Canhão da Nazaré — ver ressalva em DISCOVERY_PORTUGAL.md/BEACHES.md
  // Fonte: surfline.com, praiadonorte.pt — NO, período longo, maré baixa
  "Nazaré": {
    idealSwellDirs: ["NO"],
    minPeriod: 14,
    idealTide: ["low"],
  },

  // Beach break grande e versátil de Colares — a mais consistente da região, absorve swell de várias direções
  // Fonte: surf-forecast.com, wannasurf — NO/O ideal, offshore de leste, várias escolas de surf na praia
  "Praia Grande": {
    idealSwellDirs: ["NO", "O"],
    minPeriod: 8,
    idealTide: ["mid"],
  },

  // Vizinha da Praia Grande, mais protegida — perfil clássico de iniciante/longboard, várias escolas de surf
  // Fonte: surf-forecast.com, guias de escolas de surf de Sintra — NO/O ideal, funciona bem em maré baixa/média
  "Praia das Maçãs": {
    idealSwellDirs: ["NO", "O"],
    minPeriod: 8,
    idealTide: ["low", "mid"],
  },

  // Beach break protegido por falésias ao norte de Colares — bom para longboard/iniciante, escola de surf local
  // Fonte: surf-forecast.com, wannasurf — NO/O ideal, mid tide evita expor pedras do banco
  "Praia do Magoito": {
    idealSwellDirs: ["NO", "O"],
    minPeriod: 8,
    idealTide: ["mid"],
  },

  // ─── Holanda ───────────────────────────────────────────────────────────────
  // Não validado (baseado em surf guides públicos, sem monitoramento local).

  // Beach/pier break do Mar do Norte — swell curto de windswell local, não groundswell atlântico
  // Fonte: surf-forecast.com (Scheveningen Pier) — NO ideal, offshore de SE, melhor perto da maré cheia
  "Scheveningen": {
    idealSwellDirs: ["NO"],
    minPeriod: 6,
    idealTide: ["high"],
  },

};

module.exports = { BEACH_PROFILES };
