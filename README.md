# Pip op de Google Hub

Een checklist voor Pip op je Google Nest Hub: taken afvinken (wie en hoe laat), de voorraad bijhouden, en een klok. De app houdt zichzelf wakker, zodat hij niet na 10 minuten van het scherm verdwijnt.

## Wat zit erin

| Bestand | Wat het doet |
|---|---|
| `index.html`, `app.js`, `style.css` | Het Pip-scherm op de Google Hub (1024×600, 's avonds donker) |
| `cast.js` | Maakt er een Cast-app van en houdt hem wakker |
| `config.js` | **Hier pas je alles aan:** taken, namen, voorraad, App-ID |
| `piprun.html`, `piprun/`, `missies.js` | Pip Run: het spel, met elke week vijf missies (1 punt per missie) |
| `start.html` | Startknop voor Chrome op Android of je Mac |
| `start-pip.command` | Dubbelklik op je Mac om Pip te starten |
| `houd-pip-aan.command` | Dubbelklik: zet Pip steeds terug zolang dat venster openstaat |
| `pip-altijd-aan.command` | Dubbelklik: zet Pip steeds terug op de achtergrond, ook na een herstart van de Mac (nog een keer = uit) |
| `pip.png` | Icoon, ook gebruikt voor de wakker-houd-truc |

## 1. Online via GitHub Pages

De Hub laadt de app van https://thijs21vermeer.github.io/pip-hub/. Elke push naar `main` zet automatisch de nieuwe versie online (duurt ongeveer een minuut).

Let op: de repository is openbaar. Iedereen kan dus de namen in `config.js` zien. De afvinkjes zelf staan alleen op de Google Hub.

## 2. Registreer de app bij Google (eenmalig $5)

1. Ga naar [cast.google.com/publish](https://cast.google.com/publish), log in en betaal de eenmalige registratie van $5.
2. **Add new application → Custom Receiver.**
   - Name: `Pip`
   - Receiver Application URL: `https://thijs21vermeer.github.io/pip-hub/`
   - Klik op **Save**. Je krijgt een **App ID** van 8 tekens. Je hoeft de app niet te publiceren.
3. **Add new Device:** vul het serienummer van je Google Hub in. Dat staat op de sticker aan de onderkant of achterkant, of in de Google Home-app bij de apparaatgegevens van de Google Hub.
4. Wacht 15 minuten (soms tot een uur). Herstart daarna de Google Hub: stekker eruit, 10 seconden wachten, stekker erin.

## 3. Vul de App-ID in

Zet in `config.js` je App-ID en de naam van je Google Hub (zoals in de Google Home-app):

```js
castAppId: "A1B2C3D4",
hubName: "Keuken",
```

Zet de map daarna opnieuw online.

## 4. Pip starten

- **Android of Mac (Chrome):** open `https://thijs21vermeer.github.io/pip-hub/start.html`, tik op **Start overzicht** en kies je Google Hub. Op Android kun je de pagina via het menu aan je startscherm toevoegen, dan is het één tik.
- **Mac:** dubbelklik op `start-pip.command`. De eerste keer installeert hij wat nodig is (duurt even).
- **Pip steeds terugzetten:** dubbelklik op `houd-pip-aan.command`. Zolang dat venster openstaat en je Mac wakker is, kijkt hij elke minuut of de Google Hub vrij is en zet hij Pip terug (tussen 07:00 en 23:00).
- **iPhone:** Safari kan niet casten naar eigen apps. Start Pip vanaf je Mac.

### Wisselen tussen Pip en de Google Hub

Pip draait gewoon zonder Mac of ander apparaat dat aan moet blijven. Alleen terugkomen nadat Pip weg is gegaan, kan niet vanuit de cloud: Google laat een eigen Cast-app alleen starten door een apparaat in je eigen wifi. Daarom zijn er twee standen.

- **Zonder apparaat (standaard):** het overzicht blijft staan tot iets het wegdrukt: muziek, een video die je naar de Hub stuurt, soms een timer of "Hé Google". Dan start je het zelf weer met **Start overzicht** op je telefoon (Android) of `start-pip.command` op de Mac. De knop **Google Hub** staat er dan niet, zodat niemand het overzicht per ongeluk wegtikt.
- **Met het script (optioneel):** draait het script op de NAS (zie hieronder) of met `pip-altijd-aan.command` op een Mac, dan verschijnt de knop **Google Hub** en komt Pip vanzelf terug. Hieronder hoe dat werkt.

#### Pip op de NAS (QNAP TS-251D)

De NAS staat toch altijd aan, dus daar draait het script het handigst. Het draait in een container met Container Station.

1. **Container Station:** open op de NAS het **App Center** en installeer **Container Station**, als die er nog niet staat.
2. **Applicatie maken:** ga in Container Station naar **Applicaties → Maken**, noem hem `pip-blijf` en plak de inhoud van `nas/docker-compose.yml`.
3. **Code invullen:** vervang `PLAK-HIER-DE-KATTENBAK-CODE` door de kattenbak-code (op de Mac: `~/.config/pip/kattenbak-code.txt`). Zet die code niet in GitHub.
4. **Maken:** de eerste keer haalt hij Python en het script op; dat duurt een minuut.
5. **Controleren:** bij de container `pip-blijf` → **Logs** moet staan: "Overzicht blijft aan op hub tussen 7:00 en 23:00". Binnen 10 minuten verschijnt de knop **Google Hub** op het overzicht.

Goed om te weten:

- **Bijwerken:** bij elke herstart van de container haalt hij `start_pip.py` en `config.js` opnieuw van GitHub. Na een wijziging is een herstart van de container genoeg.
- **Google Hub niet gevonden:** vul bij `PIP_HUB_HOST` het IP-adres van de Google Hub in. Dat staat in de Google Home-app bij de apparaatinformatie.
- **Uitzetten:** stop de container `pip-blijf` in Container Station. De knop **Google Hub** verdwijnt dan binnen ongeveer 20 minuten van Pip.

- **Naar Google:** tik rechtsboven op **Google Hub** en kies wanneer het overzicht terugkomt: over 15 minuten, over 1 uur of morgenochtend. Het overzicht gaat aan de kant en je ziet meteen het scherm van Google (timers, weer, fotolijst).
- **Zelf kiezen:** onder de vaste tijden stel je met − en + zelf een tijdstip in, per kwartier (ingedrukt houden gaat sneller), tussen 5 minuten en 24 uur vooruit. Valt dat na 23:00, dan komt het overzicht de volgende ochtend om 07:00 terug.
- **Terug naar het overzicht:** dat gaat vanzelf als de pauze voorbij is en de Google Hub niets anders speelt. Eerder terug? Tik op **Start overzicht** op je telefoon.
- **Zonder de knop:** zegt iemand "Hé Google", loopt er een timer af of veegt iemand het overzicht weg? Dan komt het 5 minuten nadat de Google Hub weer vrij is terug. Speelt er muziek of een video, dan wacht het tot die klaar is.
- **Daarvoor moet het script op de Mac draaien:** dubbelklik één keer op `pip-altijd-aan.command`. Het draait dan op de achtergrond, ook na een herstart van de Mac, zolang de Mac wakker is. Nog een keer dubbelklikken zet het uit. Wat het doet staat in `~/Library/Logs/pip-blijf.log`.
- **Script uit?** Dan verdwijnt de knop binnen ongeveer 20 minuten. Wie hem in de tussentijd gebruikt, krijgt te zien dat het overzicht niet vanzelf terugkomt.
- **Waarom op tijd en niet "zodra je klaar bent":** de Google Hub meldt in zijn eigen scherm altijd hetzelfde ("Backdrop"), of je hem nu gebruikt of niet. Het script kan dus niet zien of iemand nog met Google bezig is.

Welke Cast-apparaten ziet je Mac? Dat check je in Terminal met:

```bash
./start-pip.command --zoek
```

## Voerraad koppelen

Met een koppeling laat het Voorraad-blok zien wat Voerraad weet: per product hoeveel dagen nog, "Bijna op" en "Besteld". Pip kan daar alleen lezen, niets wijzigen.

1. Ga in Voerraad naar **Instellingen → Huishouden → Scherm in huis** en tik op **Koppelcode maken**. Kopieer de code; je ziet hem maar één keer.
2. Geef de code aan Pip, op een van deze twee manieren:
   - **Startpagina:** open `start.html`, klap **Voerraad koppelen** open, plak de code en tik op **Code opslaan**. De pagina controleert de code bij Voerraad en stuurt hem bij elke start mee naar de Google Hub.
   - **Mac:** zet de code in een bestand `voerraad-code.txt` naast `start-pip.command`. Dat bestand gaat niet naar GitHub.
3. Start Pip. Het blok haalt de voorraad meteen op, en daarna elk kwartier.

De code hoort **nooit** in `config.js`: die map is openbaar. Code kwijt of uitgelekt? Maak in Voerraad een nieuwe code (de oude werkt dan niet meer) of kies **Ontkoppelen**.

## Taken beheren op de Google Hub

- **Op het startscherm** staan alle taken. Het takenblok blijft even hoog: bij meer taken komt er afwisselend een kolom en een rij bij en worden de tegels kleiner.
  - 1–4 taken: 2 × 2
  - 5–6 taken: 3 × 2 (icoon boven de naam)
  - 7–9 taken: 3 × 3
  - 10–12 taken: 4 × 3
  - Op kleine tegels staat kortere tekst, zoals "Deze week" in plaats van "Deze week nog doen".
- **Beheren ›** naast "Taken" opent de pagina **Alle taken**. Met **Bewerken** wijzig, verplaats of verwijder je een taak, of voeg je er een toe (maximaal 12).
- **Typen** gaat met het schermtoetsenbord van Pip, want de Google Hub heeft geen eigen toetsenbord. Er staan ook suggesties klaar, zoals "Nagels knippen" of "Medicijn geven".
- **Volgorde:** met ‹ en › verplaats je een taak. In die volgorde staan ze op het startscherm.
- **Hoe vaak en welke dag:** kies elke dag, week, om de week, maand of kwartaal. Bij week-taken kun je een vaste dag kiezen ("om de week op zaterdag"), bij maand- en kwartaaltaken een datum ("elke maand op de 15e").
  - De taak gaat op die dag open en blijft open tot hij gedaan is ("Vandaag", "Sinds za 1 nov").
  - Een dag eerder gedaan telt ook mee.
  - Kies je een dag die nog moet komen, dan staat er eerst "Op za 1 nov". Tot die dag telt de taak niet mee in "x van y gedaan".
- **Opslag:** de lijst wordt op de Google Hub bewaard en op het servertje (`/api/pip-settings`, Netlify Blobs), met dezelfde kattenbak-code. Zo overleeft hij een herstart van de Google Hub. Ook de huisgenoten van de startpagina komen daar terecht.
- `config.js` bevat alleen de standaardlijst voor als er nog niets is opgeslagen.

### Spelen met Pip

Een taak met `play: true` (standaard "Spelen met Pip") kun je zo vaak doen als je wilt, ook met verschillende mensen. Elke keer spelen is 1 punt voor wie speelde.

- **Tik op de tegel** (Hub) of het schilderijtje (telefoon). Je kiest in drie groepen:
  - wie er speelt;
  - **Timer** of **Al gespeeld**;
  - hoe lang (10, 15, 30 of 45 minuten).
- **Timer:** de Hub toont hem groot, met een knop bovenin naast Scores. Op de telefoon staat een timerkaart boven de taken.
  - Is de tijd om, dan krijgt wie speelde het punt, gaat er een melding naar de telefoons en geeft de Hub een feestje.
  - **Klaar** telt het punt meteen, voor de minuten tot dan. **Stoppen** haalt de timer weg zonder punt (de Hub vraagt het eerst).
  - Er loopt één timer tegelijk. De telefoon ziet een Hub-timer zodra je Pip opent; de Hub ziet een telefoon-timer binnen 5 minuten.
- **Al gespeeld:** het punt telt meteen, zonder timer.
- Hoe vaker er vandaag gespeeld is, hoe groener de tegel (1× licht, 4× of vaker diepgroen). Voor "x van y gedaan" telt hij zodra iemand vandaag speelde.
- **Opslag:** de timer en de keren van vandaag staan in een eigen blob (`play`) op het servertje, zodat het terugschrijven van de vinkjes door de Hub ze nooit wegveegt. Elke keer komt met de minuten in het jaarlog (`min`, `play: true`).
- Stond niets open toen de tijd om was (Hub uit, telefoon dicht)? Dan geeft de planner van de herinneringen (elke 5 minuten) het punt alsnog, met de melding.
- Op de telefoon staat de foto `taken/hengel.jpg` in het lijstje.

## Foto's en geluid

**Telefoonpagina's.** Op je telefoon is `instellingen.html` het beginscherm (titel "Pip"), in dezelfde stijl als de pagina's erachter (`stijl.css`, gedeelde code in `telefoon.js`):

- **Bovenaan** wisselen jullie foto's van Pip elke 6 seconden, net als in de ruststand van de Hub.
- **Taken:** schilderijtjes aan de muur. Elke taak is een vierkant kunstwerkje (eigen kleur met een groot lijnicoon) in een klassieke lijst: goud, notenhout of ebbenhout met een parelrand en een passe-partout. Het bordje eronder staat in hetzelfde schreeflettertype als "Taken". Bij de spullen staat een foto in de lijst in plaats van een icoon (map `taken/`, gekozen op de naam van de taak in `PICTURES` in `instellingen.html`): de waterfontein bij "water" en "fontein", de kattenbak bij "kattenbak" en "bak", de voerbak bij "voerbak" en "brokjes", de doos natvoer bij "natvoer". Schoonmaaktaken krijgen er een goud rondje met een schrobborstel bij (Lucide-icoon). Ze hangen in rijen van twee op één ooghoogte; de belangrijkste van het paar groot, afwisselend links en rechts. Een leeg stickertje op de hoek van de lijst is nog doen: tik op het schilderij en kies wie het deed (het vinkje staat binnen 5 minuten op de Hub). Gedaan krijgt het schilderij een donkergroene waas, met een groen stickertje en wie het deed. Welke taak open is rekent `taken.js` uit, met dezelfde regels als de Hub (nieuwe dag om 04:00, week vanaf maandag).
- **Toch niet gedaan:** tik op een afgevinkt schilderijtje; dan zie je wie het deed en wanneer, en met **Toch niet gedaan** staat de taak weer open en gaan de punten eraf (`untick` in `pip-settings.mjs`, `removeTick` in het jaarlog). Het servertje onthoudt zo'n ongedaan vinkje een paar dagen (`undone`), zodat de Hub het ook weghaalt (met de voorraad terug) en het niet terugstuurt.
- **Acties:** een kaart onder de taken met **Bak draaien** en **Voeren** (lichte tegels met een foto en een oranjebruin pijltje; één regel naam en één regel stand, zoals "Gedraaid 13:15"). Bak draaien vraagt eerst of het mag; zit Pip erin, dan zegt hij dat en draait hij niet. Voeren vraagt hoeveel porties (1–10, de laatste keuze wordt onthouden). Het gaat via het servertje (`/api/kattenbak` met `source: "telefoon"`), dus ook onderweg; dat weigert zelf als Pip erin zit, iets offline is of het te snel na elkaar gaat. In Activiteit staat dan "via je telefoon", in het logboek op de Hub "via telefoon".
- **Activiteit:** een eigen kaart onder de taken met wat er vandaag gebeurde, nieuwste bovenaan: Pip op de kattenbak, gevoerd uit de voerbak, de bak gedraaid, en wat de baasjes deden (afgevinkt, met Pip gespeeld; gevuld bolletje). Op het thuisscherm de laatste 5; **Meer ›** opent `activiteit.html` met alles van de afgelopen 7 dagen, per dag. De lijst wordt gemaakt in `telefoon.js` (`activity`).
- **Pip Wrapped** staat er altijd als kaart onder Activiteit ("Het jaar tot nu toe"; in december en de eerste helft van januari "Nieuw"); tik erop voor `wrapped.html` (dezelfde cijfers en muziek als op de Hub, na een tik op Afspelen; Delen opent meteen de deelkaart). Staand heeft elk scherm een eigen opbouw onder elkaar, 400 px breed en zo hoog als de telefoon (`TALL` in `wrapped.js`); draai je de telefoon, dan wordt het scherm opnieuw getekend zoals op de Hub.
- **Scores:** de stand van deze week, met **Meer ›** naar `scores.html` (week, maand of jaar, badges en hoe de punten werken).
- **Instellen:** tegels naar **Foto's van Pip** (`fotos.html`) en **Baasjes** (`baasjes.html`). Een nieuwe pagina komt erbij door hem in `PAGES` in `telefoon.js` te zetten. Onderaan, achter **Gekoppeld met de Google Hub**, kopieer je de koppelcode of ontkoppel je de telefoon.

Elke pagina heeft linksboven **‹ Thuis**. Het beginscherm ververst elke minuut en als je terugkomt in Safari. **Meteen in beeld:** Thuis, Scores en Activiteit tonen eerst de stand van de vorige keer (bewaard op de telefoon, zonder de Voerraad-code) en verversen dan; de foto's van Pip en de profielfoto's staan in de Cache API van de telefoon. Alleen de allereerste keer staan er plaatshouders (lege lijstjes en grijze regels). Ontkoppelen wist dit allemaal (`remember`, `recall`, `mediaUrl` in `telefoon.js`). `telefoon.css` hoort bij de oude stijl en wordt alleen nog door `fotos.html` gebruikt. Zet je een pagina op het beginscherm (Safari: deel › Zet op beginscherm), dan krijgt hij een foto van Pip als icoon en de naam "Pip" (`apple-touch-icon.png`, `icoon-192.png`, `icoon-512.png`, `telefoon.webmanifest`). Vanaf het beginscherm opent hij als app, zonder adresbalk (`display: standalone`), met een effen statusbalk (`default`; onder de klok doorlopen geeft in iOS 26 een waas die je niet uit kunt zetten). iOS 26 neemt de kleur van die balk van een vaste laag bovenaan en kijkt alleen opnieuw als zo'n laag verschijnt; daarom zet `paintStatusBar` in `telefoon.js` bij elke nieuwe kleur een nieuw strookje (`.bar-strip`). Op Thuis is dat de gemiddelde kleur van de bovenrand van de foto (`topColorOf`), en als je voorbij de foto scrolt de kleur van de pagina. Let op: een app op het beginscherm onthoudt zijn statusbalk-stijl; na een wijziging van `apple-mobile-web-app-status-bar-style` moet je Pip van het beginscherm halen en opnieuw toevoegen. In Pip Wrapped krijgen de onderrand en de pagina steeds de kleur van het scherm (`paintEdges` in `wrapped.js`). Zo'n app heeft op een iPhone eigen opslag en kent de koppelcode van de browser niet: tik daarom eerst in de browser op Thuis bij Instellen op **Gekoppeld met de Google Hub** › **Kopieer koppelcode**, open Pip vanaf het beginscherm en tik op **Plak koppelcode** (of plak hem in het vak). De code wordt gecontroleerd bij het servertje en komt nooit in een adres te staan (`useCode` en `showPairing` in `telefoon.js`).

**Fotolijst in de ruststand.** De ruststand wisselt tussen jullie foto's van Pip. Alles regel je op de fotopagina `fotos.html`, op je telefoon:

- **Erheen:** tik in de ruststand op de Google Hub linksonder op het QR-knopje en scan de code. Je telefoon is dan meteen gekoppeld, en de fotopagina gaat open. Via de startpagina kan het ook: **Foto's en baasjes → Instellingen openen**.
  - De QR-code bevat de kattenbak-code, en daarmee kun je ook de kattenbak en de voerbak bedienen. Daarom staat hij alleen open als je erom vraagt; hij sluit vanzelf na 2 minuten, of als je erop tikt.
  - De code zit in de link achter het `#`. Dat deel gaat nooit naar een server, en de pagina haalt het meteen uit de adresbalk.
- **Toevoegen:** tik op **+ Foto's toevoegen**. Dat werkt ook op een iPhone. Foto's worden op je telefoon eerst verkleind (langste kant 1600 pixels); er passen er maximaal 40 op.
- **Per foto:** tik op een foto. Je ziet hoe hij op de Google Hub staat.
  - **Vullen** of **Hele foto** (met een vage uitvergroting van zichzelf erachter). Zonder keuze krijgen staande foto's vanzelf "Hele foto".
  - Bij **Vullen**: sleep de foto in het Hub-lijstje om hem te verschuiven, en knijp met twee vingers (of gebruik de schuif met − en +) om in te zoomen, tot 4×. **Terugzetten** zet hem weer op het geheel. Precies wat je in het lijstje ziet, staat straks op de Google Hub.
  - **Foto verwijderen.**
- **Stijl:**
  - wisselen elke 10 s, 20 s, 1 min of 5 min;
  - nieuwste eerst of door elkaar;
  - de standaardfoto wel of niet meenemen;
  - rustig inzoomen terwijl een foto in beeld is.
- **Bijwerken:** de Google Hub neemt wijzigingen binnen 5 minuten over.
- **Opslag:** de foto's en de stijl staan op het servertje (`/api/fotos`, `/api/fotolijst`, Netlify Blobs), en alleen wie de kattenbak-code heeft kan erbij.

**Geluid op de Google Hub** (tikken op de ruststand opent het overzicht stil)

- **Voersignaal:** na **Voeren** altijd dezelfde drie tonen. Pip leert zo dat dat geluid "eten" betekent.
- **Feestje:** vink je de laatste taak van de dag af, dan klinkt een vrolijk loopje en schieten twee confettikanonnen in de hoeken onderaan confetti over het scherm.
- **Volume:** vanaf 21:00 tot 07:00 zijn de geluiden zachter. Het volume zelf regel je op de Google Hub.

## Meldingen op je telefoon (ntfy)

Voor natvoer krijgt iedereen in huis een melding op de telefoon:

- **Om 22:00**, als nog niemand **Natvoer geven** heeft afgevinkt: "Nog doen: Natvoer geven".
- **Zodra iemand hem afvinkt**: "Gedaan: Natvoer geven · Bou om 22:03". Zo weet je wie het deed.

Hoe het werkt:

- **Geen apparaat thuis nodig.** Netlify kijkt elke 5 minuten (`netlify/functions/herinnering.mjs`), en de opslag (`pip-settings.mjs`) meldt een nieuw vinkje meteen.
- **Instellen per taak** gebeurt op het servertje, niet op de Google Hub:
  - `notify: true` geeft een melding als de taak gedaan is.
  - `remind: "22:00"` geeft een seintje als hij dan nog open staat (alleen dagtaken, één keer per dag, tot 2 uur na die tijd), en een tweede ("Half uur te laat") als hij een half uur later nog steeds open staat. Pip Wrapped telt hoe vaak dat tweede seintje nodig was.
  - In **Alle taken → Bewerken** zie je het als "seintje 22:00".
- **De meldingen gaan via ntfy.sh** naar een geheim onderwerp: `NTFY_TOPIC` in Netlify, en op de Mac in `~/.config/pip/ntfy-topic.txt`. Wie dat onderwerp kent, kan meelezen; zet het dus niet in GitHub.

**Meldingen van de Pip-app zelf.** Tik je op een ntfy-melding, dan opent ntfy; een iPhone opent een link uit een melding altijd in de browser, nooit in een app op het beginscherm. Daarom stuurt het servertje elke melding ook als melding van Pip zelf (web-push): tik je daarop, dan opent de Pip-app.

- **Aanzetten:** open Pip vanaf het beginscherm, tik op Thuis bij Instellen op **Meldingen** (groen bolletje = aan) en dan op **Zet meldingen aan**. Uitzetten kan op dezelfde plek. Werkt op een iPhone vanaf iOS 16.4, alleen in Pip op het beginscherm.
- **Hoe:** de telefoon meldt zich aan bij `/api/push` (`netlify/functions/push.mjs`, met de kattenbak-code); `notify` in `netlify/lib/notify.mjs` stuurt naar ntfy én naar elke aangemelde telefoon (`netlify/lib/push.mjs`, bibliotheek `web-push`); `sw.js` laat de melding zien en opent Pip bij een tik. Een aanmelding die niet meer bestaat, gaat vanzelf uit de lijst.
- **Sleutels:** `VAPID_PUBLIC_KEY` en `VAPID_PRIVATE_KEY` in de Netlify-instellingen (eenmalig gemaakt met `web-push`; een reservekopie staat op de Mac in `~/.config/pip/vapid.json`). Zonder die twee gaan er alleen ntfy-meldingen uit.
- **Dubbel?** Wie de Pip-meldingen aan heeft, kan zich in de ntfy-app afmelden voor het onderwerp; anders komt elke melding twee keer.

Meldingen aanzetten, op elke telefoon:

1. Installeer de app **ntfy** (App Store of Google Play).
2. Tik op **+**, vul het onderwerp in (laat de server op ntfy.sh staan) en tik op **Abonneren**.

## Acties: kattenbak draaien en voeren

Onder **Acties** staan twee knoppen:

- **Kattenbak draaien** voor de Viervoeter-kattenbak (Smart Life / Tuya). Eronder staan Pips gewicht en het aantal bezoeken vandaag.
- **Voeren** voor de voerbak (F14-W, Tuya-app). Je kiest eerst hoeveel porties (1 tot 10, met − en +). Eronder staat de laatste voerbeurt, ook die van het schema in de app: "Laatst 2 porties om 08:00".
  - Het servertje weigert te voeren als de voerbak offline is of net al voert, en niet twee keer binnen een minuut.
  - De voerbak staat in de Netlify-instellingen als `TUYA_FEEDER_ID`. Het Tuya-account van de app moet in het cloudproject gekoppeld zijn met **Read, Write and Manage**; anders staat er "Geen schrijfrechten in Tuya".
- **Ontgeuren** kan het servertje nog steeds. Wil je die knop terug, zet hem dan weer bij `actions` in `config.js`.

- **Hoe het werkt:** Pip praat met een klein servertje op Netlify (`netlify/functions/kattenbak.mjs`, site `pip-kattenbak`). Dat servertje heeft de Tuya-sleutels en stuurt de kattenbak aan. Pip zelf kent die sleutels niet.
- **Veiligheid:** draaien kan niet als er een kat in de bak zit, en niet twee keer binnen 2 minuten. "Alle korrels verversen" zit er bewust niet in.
- **De code:** het servertje reageert alleen op de kattenbak-code. Die staat op je Mac in `~/.config/pip/kattenbak-code.txt` en in de Netlify-instellingen (`PIP_ACTION_CODE`). Plak hem op de startpagina bij **Kattenbak koppelen**, of start Pip met `start-pip.command`: dat stuurt hem automatisch mee.
- **Tuya-abonnement:** het gratis IoT Core-abonnement van Tuya moet je ongeveer elke 6 maanden verlengen (platform.tuya.com → Cloud Services → IoT Core → Extend Trial Period). Is het verlopen, dan staat er op de knop "Tuya-abonnement verlopen".
- **Servertje aanpassen:** na een wijziging in `netlify/functions` zet je het opnieuw online. Draai eerst `npm ci`: zonder `node_modules` gaat `@netlify/blobs` niet mee en vallen de instellingen en het logboek uit (HTTP 502).

```bash
npm ci
```

```bash
NETLIFY_SITE_ID=e5487a3d-43b5-42e8-8d84-22ea7461b335 netlify deploy --prod --dir netlify/public --functions netlify/functions
```

- **Welke commando's kent de kattenbak?** `python3 tools/tuya_check.py` laat het zien. Dit script leest alleen.

## Scores en Pip Wrapped

- **Scores ›** (naast Taken) toont wie het meest voor Pip deed, per week, maand of jaar, met badges. Punten: dagtaak 1, weektaak of om de week 3, maand- of kwartaaltaak 5. De week begint maandag om 04:00.
- **Ruststand:** geen tussenstand (die staat alleen bij Scores). Zondag vanaf 20:00 staat er in het kaartje linksboven de held van de week (met confetti, zonder geluid), en komt er een ntfy-melding.
- **Pip Wrapped:** het jaar van Pip in schermen die vanzelf doorlopen (tik rechts voor verder, links voor terug). In december en de eerste helft van januari staat er een knop in de ruststand; via **Scores › Pip Wrapped** kan het altijd ("tot nu toe"). Een scherm zonder genoeg cijfers wordt overgeslagen.
- **Waar de cijfers vandaan komen:** het servertje houdt een jaarlog bij in Netlify Blobs (`netlify/lib/history.mjs`):
  - elk vinkje, met naam en tijd (`pip-settings.mjs`; "Toch niet gedaan" haalt het weer weg);
  - elke 3 uur per dag de kattenbakbezoeken (aantal, gewicht, per uur), het voeren en het draaien (`jaarlog.mjs`, want Tuya bewaart maar 7 dagen);
  - wanneer een herinnering ging (`herinnering.mjs`).
  De Hub haalt het op via `/api/jaarlog` en rekent zelf (`stats.js`); `wrapped.js` tekent de schermen.
- **Pips wc-ritme:** het uur waarop Pip het vaakst op de kattenbak zit (plassen en poepen), over het hele jaar opgeteld (minstens 10 bezoeken). Piek tussen 4 en 9 uur is De Ochtendkat, 9–12 De Uitslaper, 12–17 De Middagkat, 17–21 De Avondkat, anders De Nachtkat; eronder staat "Het vaakst op de pot …" (`CAT_TYPES` in `stats.js`; de muziek per type staat onder `when` in `config.js`). Een briefje over de klok knipoogt dat Pip 's avonds het drukst is met spelen.
- **Spelen met Pip** (na de top 5 taken, als er dit jaar gespeeld is): hoe lang er in totaal met Pip gespeeld is, hoe vaak, en per baasje de speeltijd met een balkje. Met een foto van Pip op een kaartje en "Pip wil nog een keer." Op de samenvatting staat "Gespeeld". Muziek: Reel 2 Real, I Like to Move It, vanaf het refrein.
- **Eén speler:** alle nummers spelen in één audiospeler die van fragment wisselt (`wrapped.js`). Zo klinken er nooit twee nummers tegelijk, ook niet op een iPhone bij het starten of snel doortikken.
- **Muziek op de telefoon:** `wrapped.html` haalt de fragmenten vooraf op en start ze bij de tik op Afspelen allemaal even stil (`unlockMusic`); een iPhone laat een nummer anders niet vanzelf beginnen als Wrapped naar het volgende scherm gaat. Een iPhone negeert het volume, dus in- en uitfaden gebeurt daar niet.
- **Wat telt als bezoek aan de kattenbak** (`netlify/lib/visits.mjs`, voor het logboek, de teller onder Kattenbak draaien en het jaarlog): het gewicht is minstens 60% van Pips gewone gewicht (dus niet als iemand de bak schoonmaakt), meldingen binnen 5 minuten na elkaar zijn één bezoek, en een bezoek duurt minstens 15 seconden.
- **Geschiedenis:** het jaarlog begint op 9 november 2026. Van daarvoor is alleen het laatste vinkje per taak bewaard, en Tuya bewaart de kattenbak en de voerbak maar 7 dagen (vanaf 3 november staat het erin).
- **Baasjes en profielfoto's:** op `baasjes.html` (Thuis › Baasjes) staat per baasje de foto, de naam en de punten van deze week. Tik op de foto om er een te kiezen, op de naam om hem te wijzigen (of de foto weg te halen), en op **Nieuw baasje** om er een toe te voegen (maximaal 6). Een nieuw baasje staat binnen 5 minuten op de Hub (die haalt de lijst elke 5 minuten op en stuurt hem alleen terug als hij op de Hub zelf is gewijzigd). De foto wordt vierkant en klein gemaakt en bewaard op het servertje (`netlify/functions/baasjes.mjs`). De Hub laat hem binnen 5 minuten zien bij Scores, bij de held van de week en op het podium in Pip Wrapped; zonder foto staat er de eerste letter.
- **Delen:** onder "Dat was het jaar van Pip." staat een knop Delen. De Hub laat een QR-code zien naar `deel.html`, met alleen de cijfers van de samenvatting in het adres (geen code). Op je telefoon wordt daar een foto van gemaakt (1080×1920), die je met het deelmenu stuurt of bewaart.
- **Kosten** in Wrapped komen uit Voerraad (aankopen, verzekering en wat je zelf aan de dierenarts betaalde, van dit jaar), via dezelfde koppelcode als de voorraad. Zonder die cijfers valt het kostenscherm weg. Eenmalige kosten die geen voorraad zijn (de startkosten: krabpaal, kattenbak, fontein …) staan niet in Voerraad maar op het servertje, in Netlify Blobs onder `history-<jaar>-extra-costs` (`{ list: [{ date, label, amount }] }`); het jaarlog stuurt ze mee en Wrapped telt ze op als "Startkosten". Speelgoed staat er altijd bovenaan als grapje: € ∞ (het echte bedrag telt wel mee in het totaal).
- **Muziek** onder Wrapped: per scherm een bekend nummer met een knipoog (Sandstorm bij de kattenbak, Hungry Like the Wolf bij het eten, Money, Money, Money bij de kosten; bij het wc-ritme hangt het nummer af van het type), als fragment van 30 seconden van Apple Music, vanaf de zin uit het refrein (`start` in `config.js`). Een scherm duurt 12 seconden. De Hub haalt ze op bij het openen; in deze map staan alleen de titels (`wrappedMusic` in `config.js`). Ander nummer? Zoek het `id` op met `https://itunes.apple.com/search?term=artiest+titel&country=NL&entity=song`.

## Pip Run

- **Het spel:** `piprun.html` (Thuis › Pip Run). Pip rent door de woonkamer weg voor de stofzuiger. De 3D-modellen, geluiden en muziek staan in `piprun/`. Brokjes, record en het rode pakje worden op de telefoon bewaard.
- **Missies:** elke maandag om 04:00 (net als de Scores) vijf nieuwe: twee makkelijke, twee gemiddelde en één moeilijke, voor iedereen in huis dezelfde. De lijst en de volgorde staan in `missies.js`; die gebruiken het spel, Thuis en het servertje alle drie. Een missie is "in één run" of "opgeteld over de week". Binnen een rondje door de lijst komt geen missie twee keer, en nooit twee weken achter elkaar.
- **Punten:** een gehaalde missie is 1 punt voor wie de telefoon gebruikt (de naam die je op Thuis kiest). Het spel stuurt hem naar `/api/piprun` (`netlify/functions/piprun.mjs`); dat controleert of de missie bij deze week hoort en telt elke missie één keer per persoon per week. In het jaarlog staat hij als vinkje met `game: true` (`recordMission` in `netlify/lib/history.mjs`): hij telt mee bij Scores en de held van de week, maar niet als taak voor Pip (net als de foto van de maand). Geen netwerk? Dan blijft het punt op de telefoon klaarstaan en gaat het later alsnog.
- **Op Thuis:** een kaart met de missies van deze week, een vinkje bij wat jij al haalde en de rondjes van wie ze ook haalde. In Activiteit staat "Missie gehaald in Pip Run".
- **Andere missies?** Pas `POOL` in `missies.js` aan en zet daarna ook het servertje opnieuw online (dat controleert met dezelfde lijst).

## 5. Eerste test op de Google Hub

- [ ] Pip verschijnt op de Google Hub
- [ ] Tikken werkt (een taak afvinken, iemand kiezen)
- [ ] Na 15 minuten staat Pip er nog (de wakker-houd-truc)
- [ ] Pip blijft staan als je de startpagina op je telefoon sluit
- [ ] Na een herstart van de Google Hub en opnieuw starten staan de vinkjes er nog

## Aanpassen

Alles staat in `config.js`: taken (met icoon), wie er kan afvinken, de voorraad en hoe laat de lijst leeg begint (standaard 04:00). Na een wijziging zet je de map opnieuw online. De Hub laadt de nieuwe versie bij de volgende start.

Even lokaal bekijken op je Mac:

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000 in je browser.

## Start Pip niet?

- **"Starten lukte niet" / `NOT_FOUND`:** de Google Hub kent de app nog niet.
  - Kijk in de Cast Console bij **Cast Receiver Devices** of daar het **serienummer van de Google Hub** staat, en niet de App-ID.
  - Ook na "Ready For Testing" kan het nog 10 minuten of langer duren. Trek daarna de stekker van de Google Hub eruit en steek hem er weer in.
- **Serienummer zeker weten:** open [cast.google.com/publish](https://cast.google.com/publish) in Chrome, kies **Casten…** en dan je Google Hub. Het serienummer verschijnt op het scherm van de Google Hub.
- **Hub niet gevonden:** check met `./start-pip.command --zoek` of je Mac hem ziet. De Hub moet aan staan en op hetzelfde wifi zitten (geen gastnetwerk).

## Goed om te weten

- **Wakker houden:** de Google Hub sluit een cast-app na ongeveer 10 minuten als er geen media speelt. `cast.js` "speelt" daarom elke 9 minuten onzichtbaar `pip.png` af, dezelfde truc als Home Assistant Cast. Niet officieel, dus een update van Google kan dit breken.
- **Na een timer, muziek of "Hé Google"** verdwijnt Pip. `pip-altijd-aan.command` (of `houd-pip-aan.command` met een open venster) zet hem terug; zie "Wisselen tussen Pip en de Google Hub".
- **Opslag:** de vinkjes, de taken en de baasjes staan op de Google Hub en op het servertje (`/api/pip-settings`). Een vinkje van je telefoon gaat als `{ tick: { id, by } }` naar het servertje en verandert alleen die ene taak; de Hub haalt elke 5 minuten de vinkjes op en voegt ze samen met die van hemzelf voordat hij iets terugstuurt, zodat hij elkaars vinkjes niet overschrijft. "Toch niet gedaan" op de Hub onthoudt hij, zodat zo'n vinkje niet terugkomt. De voorraad (de + en − op de Hub) staat alleen op de Hub zelf.
