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
};

module.exports = { BEACH_PROFILES };
