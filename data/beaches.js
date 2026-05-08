const BEACHES = {
  "Paiva":             { lat: -8.3108,  lng: -34.9700, state: "pe", harbor: "pe03" },
  "Itapuama":          { lat: -8.3989,  lng: -35.0286, state: "pe", harbor: "pe03" },
  "Porto de Galinhas": { lat: -8.5075,  lng: -35.0028, state: "pe", harbor: "pe03" },
  "Maracaípe":         { lat: -8.5328,  lng: -35.0072, state: "pe", harbor: "pe03" },
  "Madeiro":           { lat: -6.2283,  lng: -35.0508, state: "rn", harbor: "rn04" },
  "Baía Formosa":      { lat: -6.3728,  lng: -35.0089, state: "rn", harbor: "rn04" },
  "Cacimba do Padre":  { lat: -3.8397,  lng: -32.4203, state: "pe", harbor: "pe01" },
  "Jericoacoara":      { lat: -2.7975,  lng: -40.5128, state: "ce", harbor: "ce01" },
  "Tourinhos":         { lat: -5.1089,  lng: -35.4908, state: "rn", harbor: "rn04" },
  "Janga":             { lat: -7.9508,  lng: -34.8267, state: "pe", harbor: "pe02" },
  "Olinda":            { lat: -7.9908,  lng: -34.8416, state: "pe", harbor: "pe02" },
};

function getBeach(name) {
  return BEACHES[name];
}

module.exports = { BEACHES, getBeach };
