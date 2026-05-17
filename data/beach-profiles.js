// Perfis de praia para calibração da classificação de condições.
// Cada perfil modifica o resultado base do classify() com base na direção do swell.
// Praias sem perfil usam apenas o classificador genérico (fallback).
//
// idealSwellDirs: direções que geram boost de +1 nível (se período >= minPeriod)
// minPeriod: período mínimo (segundos) para o boost ser aplicado
// badSwellDirs: direções que geram penalização de -1 nível

const BEACH_PROFILES = {
  // Praia voltada para norte — fundo misto reef + areia (laje no outside + banco de areia)
  // Fontes: Guia Waves, surf-forecast.com, experiência real 14-15/mai/2026
  "Madeiro": {
    idealSwellDirs: ["N", "NE"],
    minPeriod: 10,          // swell primário precisa de groundswell para ativar a laje
    minPeriodSecondary: 8,  // swell secundário de N/NE com 8s já trabalha no banco de areia
    badSwellDirs: ["S", "SE"],
  },

  // Praia voltada para leste/nordeste — fundo areia, referência de calibragem do classificador
  // Fontes: geografia de Cabo de Santo Agostinho, calibragem histórica do app
  "Paiva": {
    idealSwellDirs: ["SE", "E"],
    minPeriod: 8,
    badSwellDirs: ["N", "NO"],
  },
};

module.exports = { BEACH_PROFILES };
