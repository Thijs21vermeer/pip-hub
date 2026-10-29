// Instellingen voor Pip. Pas dit bestand aan en zet het daarna opnieuw online.
window.PIP_CONFIG = {
  // App-ID uit de Google Cast Developer Console (8 tekens, bijvoorbeeld "A1B2C3D4").
  castAppId: "6E3BD9DA",

  // Naam van je Nest Hub zoals in de Google Home-app. Leeg laten = de enige Hub in huis.
  hubName: "hub",

  // Wie kan een taak afvinken? Met één naam wordt een taak direct afgevinkt.
  // Dit is de standaard: op de startpagina pas je de huisgenoten aan.
  people: ["Thijs", "Huisgenoot"],

  // Hoe laat de lijst weer leeg begint (24-uursklok). 4 betekent om 04:00 's nachts.
  resetHour: 4,

  // Dagelijkse taken. icon: sun, moon, drop, box, bowl, heart of paw.
  // stock: haalt bij afvinken automatisch iets van de voorraad af.
  tasks: [
    { id: "ontbijt", title: "Ontbijt", icon: "sun", stock: { id: "natvoer", amount: 1 } },
    { id: "avondeten", title: "Avondeten", icon: "moon", stock: { id: "natvoer", amount: 1 } },
    { id: "water", title: "Water verversen", icon: "drop" },
    { id: "kattenbak", title: "Kattenbak aanzetten", icon: "box" },
    { id: "brokjes", title: "Brokjes bijvullen", icon: "bowl" },
    { id: "aandacht", title: "Spelen & borstelen", icon: "heart" },
  ],

  // Koppeling met Voerraad: zodra de Hub een koppelcode heeft, komt de voorraad
  // uit je Voerraad-account. De code zelf hoort NIET in dit bestand (deze map is
  // openbaar): je vult hem in op de startpagina of in voerraad-code.txt.
  voerraad: { url: "https://voerraad.nl", refreshMinutes: 15, maxItems: 4 },

  // Voorraad zonder Voerraad-koppeling. amount = beginvoorraad, low = vanaf dit
  // aantal staat er "Bijna op".
  stock: [
    { id: "natvoer", title: "Natvoer", units: ["zakje", "zakjes"], amount: 14, low: 4 },
    { id: "brokjes", title: "Brokjes", units: ["zak", "zakken"], amount: 1, low: 1 },
    { id: "korrels", title: "Kattenbakkorrels", units: ["zak", "zakken"], amount: 2, low: 1 },
  ],
};
