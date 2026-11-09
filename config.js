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
  // wijzigen en verplaatsen; die lijst komt dan van het servertje. Alle taken
  // staan op het startscherm; bij meer taken worden de tegels kleiner.
  // icon: sun, moon, drop, bowl, box, heart, paw, pill, scissors of ball.
  // stock: haalt bij afvinken automatisch iets van de voorraad af.
  tasks: [
    { id: "ontbijt", title: "Ontbijt", icon: "sun", stock: { id: "natvoer", amount: 1 } },
    { id: "avondeten", title: "Avondeten", icon: "moon", stock: { id: "natvoer", amount: 1 } },
    { id: "water", title: "Water verversen", icon: "drop" },
    { id: "brokjes", title: "Brokjes bijvullen", icon: "bowl" },
  ],

  // Acties: knoppen voor de kattenbak en de voerbak, via het servertje op
  // Netlify (netlify/functions/kattenbak.mjs). id = actie op dat servertje.
  // "feed" vraagt eerst hoeveel porties; "odourless" (ontgeuren) kan ook nog.
  actions: [
    { id: "clean", title: "Kattenbak draaien", icon: "box", confirm: "Kattenbak nu laten draaien?", button: "Ja, draaien" },
    { id: "feed", title: "Voeren", icon: "bowl" },
  ],

  // Adres van dat servertje. De code om het te gebruiken staat NIET hier (deze
  // map is openbaar): die vul je in op de startpagina.
  kattenbak: { url: "https://pip-kattenbak.netlify.app/api/kattenbak", refreshMinutes: 15 },

  // Waar de Hub zijn takenlijst en huisgenoten bewaart (zelfde servertje en code),
  // zodat ze een herstart van de Hub overleven.
  settings: { url: "https://pip-kattenbak.netlify.app/api/pip-settings" },

  // Jaarlog voor het scoreboard en Pip Wrapped (zelfde servertje en code).
  jaarlog: { url: "https://pip-kattenbak.netlify.app/api/jaarlog", refreshMinutes: 30 },

  // Muziek onder Pip Wrapped: per scherm een nummer met een knipoog, als fragment
  // van 30 seconden van Apple Music dat de Hub tijdens het afspelen ophaalt (hier
  // staan alleen de titels). id = nummer in de Nederlandse iTunes Store
  // (itunes.apple.com/lookup?id=…&country=NL); slides = bij welk scherm; when =
  // alleen bij dit kattentype; start = seconde in het fragment waar de zin van het
  // refrein begint (opgezocht met spraakherkenning; een scherm duurt 12 seconden,
  // dus start hooguit 17,5). Leeg laten = zonder muziek.
  wrappedMusic: [
    { id: 355893936, start: 17.5, artist: "Tight Fit", title: "The Lion Sleeps Tonight", slides: ["intro"] }, // Pip slaapt op de foto
    { id: 1842582544, start: 3, artist: "Willeke Alberti", title: "Samen zijn", slides: ["total"] }, // samen voor Pip
    { id: 338349243, start: 0, artist: "Darude", title: "Sandstorm", slides: ["box"] }, // de zandbak (meteen vol)
    { id: 193084947, start: 0, artist: "Wham!", title: "Wake Me Up Before You Go-Go", slides: ["type"], when: "De Ochtendkat" },
    { id: 576670462, start: 3.5, artist: "Bruno Mars", title: "The Lazy Song", slides: ["type"], when: "De Uitslaper" },
    { id: 1441164589, start: 0.5, artist: "The Beatles", title: "Here Comes the Sun", slides: ["type"], when: "De Middagkat" },
    { id: 1444052008, start: 2.5, artist: "Boudewijn de Groot", title: "Avond", slides: ["type"], when: "De Avondkat" },
    { id: 285337761, start: 2, artist: "Guus Meeuwis", title: "Het is een nacht", slides: ["type"], when: "De Nachtkat" },
    { id: 693610779, start: 6, artist: "Duran Duran", title: "Hungry Like the Wolf", slides: ["food"] }, // eten
    { id: 697417501, start: 8.5, artist: "The Hollies", title: "He Ain't Heavy, He's My Brother", slides: ["weight"] }, // gewicht
    { id: 283305973, start: 0, artist: "Dolly Parton", title: "9 to 5", slides: ["top"] }, // de klusjes (het fragment begint met "…nine to five")
    { id: 1576849672, start: 4, artist: "André Hazes", title: "Zij gelooft in mij", slides: ["human"] }, // favoriete baasje
    { id: 6781080602, start: 2, artist: "Queen", title: "We Are the Champions", slides: ["records"] }, // records
    { id: 1440816971, start: 0.5, artist: "ABBA", title: "Money, Money, Money", slides: ["costs"] }, // kosten
    { id: 1747957549, start: 10.5, artist: "Ed Sheeran", title: "Photograph", slides: ["photos"] }, // fotolijst
    { id: 1440816992, start: 6, artist: "ABBA", title: "Thank You for the Music", slides: ["outro"] }, // bedankt
  ],

  // Foto's van Pip voor de ruststand (fotos.html). Zelfde servertje en code als
  // de kattenbak.
  // Hoe de fotolijst wisselt (tempo, volgorde, zoom) stel je in op fotos.html.
  photos: {
    url: "https://pip-kattenbak.netlify.app/api/fotos",
    styleUrl: "https://pip-kattenbak.netlify.app/api/fotolijst",
  },

  // Profielfoto's van de baasjes (Scores, held van de week, Pip Wrapped). Je zet
  // ze erop onder Baasjes op fotos.html. Zelfde servertje en code.
  baasjes: { url: "https://pip-kattenbak.netlify.app/api/baasjes" },

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
