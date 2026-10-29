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

  // Dagelijkse taken: de standaardlijst. Op de Hub zelf kun je taken toevoegen,
  // wijzigen en verplaatsen; die lijst komt dan van het servertje. De eerste 4
  // staan op het startscherm, de rest onder "meer".
  // icon: sun, moon, drop, bowl, box, heart, paw, pill, scissors of ball.
  // stock: haalt bij afvinken automatisch iets van de voorraad af.
  tasks: [
    { id: "ontbijt", title: "Ontbijt", icon: "sun", stock: { id: "natvoer", amount: 1 } },
    { id: "avondeten", title: "Avondeten", icon: "moon", stock: { id: "natvoer", amount: 1 } },
    { id: "water", title: "Water verversen", icon: "drop" },
    { id: "brokjes", title: "Brokjes bijvullen", icon: "bowl" },
  ],

  // Acties: knoppen die de kattenbak iets laten doen, via het servertje op
  // Netlify (netlify/functions/kattenbak.mjs). id = actie op dat servertje.
  actions: [
    { id: "clean", title: "Kattenbak draaien", icon: "box", confirm: "Kattenbak nu laten draaien?", button: "Ja, draaien" },
    { id: "odourless", title: "Ontgeuren", icon: "wind", confirm: "Kattenbak nu ontgeuren?", button: "Ja, ontgeuren" },
  ],

  // Adres van dat servertje. De code om het te gebruiken staat NIET hier (deze
  // map is openbaar): die vul je in op de startpagina.
  kattenbak: { url: "https://pip-kattenbak.netlify.app/api/kattenbak", refreshMinutes: 15 },

  // Waar de Hub zijn takenlijst en huisgenoten bewaart (zelfde servertje en code),
  // zodat ze een herstart van de Hub overleven.
  settings: { url: "https://pip-kattenbak.netlify.app/api/pip-settings" },

  // Koppeling met Voerraad: zodra de Hub een koppelcode heeft, komt de voorraad
  // uit je Voerraad-account. De code zelf hoort NIET in dit bestand (deze map is
  // openbaar): je vult hem in op de startpagina of in voerraad-code.txt.
  voerraad: { url: "https://voerraad.nl", refreshMinutes: 15, maxItems: 4 },

  // Welk dier uit Voerraad linksboven in beeld komt (met de profielfoto).
  petName: "Pip",

  // Voorraad zonder Voerraad-koppeling. amount = beginvoorraad, low = vanaf dit
  // aantal staat er "Bijna op".
  stock: [
    { id: "natvoer", title: "Natvoer", units: ["zakje", "zakjes"], amount: 14, low: 4 },
    { id: "brokjes", title: "Brokjes", units: ["zak", "zakken"], amount: 1, low: 1 },
    { id: "korrels", title: "Kattenbakkorrels", units: ["zak", "zakken"], amount: 2, low: 1 },
  ],
};
