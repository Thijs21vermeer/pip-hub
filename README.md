# Pip op de Google Hub

Een checklist voor Pip op je Google Nest Hub: taken afvinken (wie en hoe laat), de voorraad bijhouden, en een klok. De app houdt zichzelf wakker, zodat hij niet na 10 minuten van het scherm verdwijnt.

## Wat zit erin

| Bestand | Wat het doet |
|---|---|
| `index.html`, `app.js`, `style.css` | Het Pip-scherm op de Google Hub (1024×600, 's avonds donker) |
| `cast.js` | Maakt er een Cast-app van en houdt hem wakker |
| `config.js` | **Hier pas je alles aan:** taken, namen, voorraad, App-ID |
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

## Foto's en geluid

**Fotolijst in de ruststand.** De ruststand wisselt tussen jullie foto's van Pip. Alles regel je op de fotopagina `fotos.html`, op je telefoon:

- **Erheen:** tik in de ruststand op de Google Hub linksonder op het QR-knopje en scan de code. Je telefoon is dan meteen gekoppeld, en de fotopagina gaat open. Via de startpagina kan het ook: **Foto's van Pip → Foto's beheren**.
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
  - `remind: "22:00"` geeft een seintje als hij dan nog open staat (alleen dagtaken, één keer per dag, tot 2 uur na die tijd).
  - In **Alle taken → Bewerken** zie je het als "seintje 22:00".
- **De meldingen gaan via ntfy.sh** naar een geheim onderwerp: `NTFY_TOPIC` in Netlify, en op de Mac in `~/.config/pip/ntfy-topic.txt`. Wie dat onderwerp kent, kan meelezen; zet het dus niet in GitHub.

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
- **Opslag:** de vinkjes en de voorraad worden op de Google Hub zelf bewaard. Je telefoon ziet ze niet, en bij een herstart van de Google Hub kunnen ze kwijt zijn. Synchroniseren met je telefoon vraagt een online database (bijvoorbeeld Supabase).
