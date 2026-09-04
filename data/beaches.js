const BEACHES = {
  "Paiva":             { lat: -8.3108,  lng: -34.9700, state: "pe", harbor: "pe03", timezone: "America/Recife" },
  "Itapuama":          { lat: -8.3989,  lng: -35.0286, state: "pe", harbor: "pe03", timezone: "America/Recife" },
  "Porto de Galinhas": { lat: -8.5075,  lng: -35.0028, state: "pe", harbor: "pe03", timezone: "America/Recife" },
  "Maracaípe":         { lat: -8.5328,  lng: -35.0072, state: "pe", harbor: "pe03", timezone: "America/Recife" },
  "Madeiro":           { lat: -6.2283,  lng: -35.0508, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "Baía Formosa":      { lat: -6.3728,  lng: -35.0089, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "Cacimba do Padre":  { lat: -3.8397,  lng: -32.4203, state: "pe", harbor: "pe01", timezone: "America/Recife" },
  "Jericoacoara":      { lat: -2.7975,  lng: -40.5128, state: "ce", harbor: "ce01", timezone: "America/Recife" },
  "Tourinhos":         { lat: -5.1089,  lng: -35.4908, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "Janga":             { lat: -7.9508,  lng: -34.8267, state: "pe", harbor: "pe02", timezone: "America/Recife" },
  "Olinda":            { lat: -7.9908,  lng: -34.8416, state: "pe", harbor: "pe02", timezone: "America/Recife" },
  "Ponta Negra":            { lat: -5.8906,  lng: -35.1778, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "Praia do Francês":       { lat: -9.6617,  lng: -35.8406, state: "al", harbor: "al01", timezone: "America/Recife" },
  "Japaratinga":            { lat: -9.0839,  lng: -35.2489, state: "al", harbor: "al01", timezone: "America/Recife" },
  "Preá":                   { lat: -2.5739,  lng: -40.4761, state: "ce", harbor: "ce01", timezone: "America/Recife" },
  "Taíba":                  { lat: -3.4685,  lng: -39.0244, state: "ce", harbor: "ce01", timezone: "America/Recife" },
  "Flecheiras":             { lat: -3.2189,  lng: -39.5506, state: "ce", harbor: "ce01", timezone: "America/Recife" },
  "Canoa Quebrada":         { lat: -4.5222,  lng: -37.6675, state: "ce", harbor: "ce02", timezone: "America/Recife" },
  "Praia do Futuro":        { lat: -3.7411,  lng: -38.4525, state: "ce", harbor: "ce02", timezone: "America/Recife" },
  "Ponta Grossa":           { lat: -4.8264,  lng: -37.3975, state: "ce", harbor: "ce02", timezone: "America/Recife" },
  "Tiririca":               { lat: -14.2783, lng: -38.9978, state: "ba", harbor: "ba04", timezone: "America/Recife" },
  "Engenhoca":              { lat: -14.2444, lng: -39.0158, state: "ba", harbor: "ba04", timezone: "America/Recife" },
  "Itacarezinho":           { lat: -14.2039, lng: -38.9839, state: "ba", harbor: "ba04", timezone: "America/Recife" },
  "Praia do Forte":         { lat: -12.5778, lng: -37.9742, state: "ba", harbor: "ba01", timezone: "America/Recife" },
  "Prado - Corumbau":       { lat: -17.3428, lng: -39.2178, state: "ba", harbor: "ba04", timezone: "America/Recife" },
  "Serrambi":               { lat: -8.7822,  lng: -35.0386, state: "pe", harbor: "pe03", timezone: "America/Recife" },
  "Praia da Conceição":     { lat: -3.8553,  lng: -32.4103, state: "pe", harbor: "pe01", timezone: "America/Recife" },
  "Praia do Amor":          { lat: -6.1886,  lng: -35.0878, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "São Miguel do Gostoso":  { lat: -5.1236,  lng: -35.6411, state: "rn", harbor: "rn04", timezone: "America/Recife" },
  "Intermares":             { lat: -6.9786,  lng: -34.8261, state: "pb", harbor: "pb01", timezone: "America/Recife" },
  "Bessa":                  { lat: -7.0808,  lng: -34.8189, state: "pb", harbor: "pb01", timezone: "America/Recife" },
  "Praia de Campina":       { lat: -6.9283,  lng: -34.8664, state: "pb", harbor: "pb01", timezone: "America/Recife" },
  "Barra de Camaratuba":    { lat: -6.5997,  lng: -35.0578, state: "pb", harbor: "pb01", timezone: "America/Recife" },
  "Pedra do Sal":           { lat: -2.9106,  lng: -41.4733, state: "pi", harbor: "pi01", timezone: "America/Recife" },

  // ─── Portugal (teste de viagem — sem harbor, maré via Open-Meteo) ──────────
  "Ribeira d'Ilhas":   { lat: 38.9714, lng: -9.4193, state: "Lisboa", timezone: "Europe/Lisbon" },
  "Supertubos":        { lat: 39.3402, lng: -9.3607, state: "Leiria", timezone: "Europe/Lisbon" },
  "Nazaré":            { lat: 39.6033, lng: -9.0802, state: "Leiria", timezone: "Europe/Lisbon" },
  "Praia Grande":      { lat: 38.8130, lng: -9.4720, state: "Lisboa", timezone: "Europe/Lisbon" },
  "Praia das Maçãs":   { lat: 38.8064, lng: -9.4694, state: "Lisboa", timezone: "Europe/Lisbon" },
  "Praia do Magoito":  { lat: 38.8385, lng: -9.4805, state: "Lisboa", timezone: "Europe/Lisbon" },

  // ─── Holanda (teste de viagem — sem harbor, maré via Open-Meteo) ───────────
  "Scheveningen":      { lat: 52.1092, lng: 4.2727, state: "Zuid-Holland", timezone: "Europe/Amsterdam" },
};

function getBeach(name) {
  return BEACHES[name];
}

module.exports = { BEACHES, getBeach };
