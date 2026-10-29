// Instellingen voor Pip. Pas dit bestand aan en zet het daarna opnieuw online.
window.PIP_CONFIG = {
  // App-ID uit de Google Cast Developer Console (8 tekens, bijvoorbeeld "A1B2C3D4").
  castAppId: "6E3BD9DA",

  // Naam van je Nest Hub zoals in de Google Home-app. Leeg laten = de enige Hub in huis.
  hubName: "hub",

  // Wie kan een taak afvinken? Met één naam wordt een taak direct afgevinkt.
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

  // Voorraad. amount = beginvoorraad, low = vanaf dit aantal staat er "Bijna op".
  stock: [
    { id: "natvoer", title: "Natvoer", units: ["zakje", "zakjes"], amount: 14, low: 4 },
    { id: "brokjes", title: "Brokjes", units: ["zak", "zakken"], amount: 1, low: 1 },
    { id: "korrels", title: "Kattenbakkorrels", units: ["zak", "zakken"], amount: 2, low: 1 },
  ],
};
