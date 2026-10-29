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

- **Android of Mac (Chrome):** open `https://thijs21vermeer.github.io/pip-hub/start.html`, tik op **Start Pip** en kies je Google Hub. Op Android kun je de pagina via het menu aan je startscherm toevoegen, dan is het één tik.
- **Mac:** dubbelklik op `start-pip.command`. De eerste keer installeert hij wat nodig is (duurt even).
- **Pip steeds terugzetten:** dubbelklik op `houd-pip-aan.command`. Zolang dat venster openstaat en je Mac wakker is, kijkt hij elke minuut of de Google Hub vrij is en zet hij Pip terug (tussen 07:00 en 23:00).
- **iPhone:** Safari kan niet casten naar eigen apps. Start Pip vanaf je Mac.

### Wisselen tussen Pip en de Google Hub

Pip draait gewoon zonder Mac of ander apparaat dat aan moet blijven. Alleen terugkomen nadat Pip weg is gegaan, kan niet vanuit de cloud: Google laat een eigen Cast-app alleen starten door een apparaat in je eigen wifi. Daarom zijn er twee standen.

- **Zonder apparaat (standaard):** Pip blijft staan tot iets hem wegdrukt: muziek, een video die je naar de Hub stuurt, soms een timer of "Hé Google". Dan start je Pip zelf weer met **Start Pip** op je telefoon (Android) of `start-pip.command` op de Mac. De knop **Google Hub** staat er dan niet, zodat niemand Pip per ongeluk wegtikt.
- **Met het script (optioneel):** draait het script op de NAS (zie hieronder) of met `pip-altijd-aan.command` op een Mac, dan verschijnt de knop **Google Hub** en komt Pip vanzelf terug. Hieronder hoe dat werkt.

#### Pip op de NAS (QNAP TS-251D)

De NAS staat toch altijd aan, dus daar draait het script het handigst. Het draait in een container met Container Station.

1. **Container Station:** open op de NAS het **App Center** en installeer **Container Station**, als die er nog niet staat.
2. **Applicatie maken:** ga in Container Station naar **Applicaties → Maken**, noem hem `pip-blijf` en plak de inhoud van `nas/docker-compose.yml`.
3. **Code invullen:** vervang `PLAK-HIER-DE-KATTENBAK-CODE` door de kattenbak-code (op de Mac: `~/.config/pip/kattenbak-code.txt`). Zet die code niet in GitHub.
4. **Maken:** de eerste keer haalt hij Python en het script op; dat duurt een minuut.
5. **Controleren:** bij de container `pip-blijf` → **Logs** moet staan: "Pip blijft aan op hub tussen 7:00 en 23:00". Binnen 10 minuten verschijnt de knop **Google Hub** op Pip.

Goed om te weten:

- **Bijwerken:** bij elke herstart van de container haalt hij `start_pip.py` en `config.js` opnieuw van GitHub. Na een wijziging is een herstart van de container genoeg.
- **Google Hub niet gevonden:** vul bij `PIP_HUB_HOST` het IP-adres van de Google Hub in. Dat staat in de Google Home-app bij de apparaatinformatie.
- **Uitzetten:** stop de container `pip-blijf` in Container Station. De knop **Google Hub** verdwijnt dan binnen ongeveer 20 minuten van Pip.

- **Naar Google:** tik rechtsboven op **Google Hub** en kies wanneer Pip terugkomt: over 15 minuten, over 1 uur of morgenochtend. Pip gaat aan de kant en je ziet meteen het scherm van Google (timers, weer, fotolijst).
- **Zelf kiezen:** onder de vaste tijden stel je met −1 uur, −15 min, +15 min en +1 uur zelf een tijdstip in (tussen 5 minuten en 24 uur vooruit). Valt dat na 23:00, dan komt Pip de volgende ochtend om 07:00 terug.
- **Terug naar Pip:** dat gaat vanzelf als de pauze voorbij is en de Google Hub niets anders speelt. Eerder terug? Tik op **Start Pip** op je telefoon.
- **Zonder de knop:** zegt iemand "Hé Google", loopt er een timer af of veegt iemand Pip weg? Dan komt Pip 5 minuten nadat de Google Hub weer vrij is terug. Speelt er muziek of een video, dan wacht Pip tot die klaar is.
- **Daarvoor moet het script op de Mac draaien:** dubbelklik één keer op `pip-altijd-aan.command`. Het draait dan op de achtergrond, ook na een herstart van de Mac, zolang de Mac wakker is. Nog een keer dubbelklikken zet het uit. Wat het doet staat in `~/Library/Logs/pip-blijf.log`.
- **Script uit?** Dan verdwijnt de knop binnen ongeveer 20 minuten. Wie hem in de tussentijd gebruikt, krijgt te zien dat Pip niet vanzelf terugkomt.
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

- **Op het startscherm** staan de eerste 4 taken. Zijn het er meer, dan staat naast "Taken" bijvoorbeeld **+2 meer ›**; anders staat er **Beheren ›**.
- **Daarachter** zit de pagina **Alle taken**: daar vink je alle taken af. Met **Bewerken** wijzig, verplaats of verwijder je een taak, of voeg je er een toe (maximaal 12).
- **Typen** gaat met het schermtoetsenbord van Pip, want de Google Hub heeft geen eigen toetsenbord. Er staan ook suggesties klaar, zoals "Nagels knippen" of "Medicijn geven".
- **Volgorde:** met ‹ en › verplaats je een taak. Wat op plek 1 t/m 4 staat, komt op het startscherm.
- **Hoe vaak en welke dag:** kies elke dag, week, om de week, maand of kwartaal. Bij week-taken kun je een vaste dag kiezen ("om de week op zaterdag"), bij maand- en kwartaaltaken een datum ("elke maand op de 15e").
  - De taak gaat op die dag open en blijft open tot hij gedaan is ("Vandaag", "Sinds za 1 nov").
  - Een dag eerder gedaan telt ook mee.
  - Kies je een dag die nog moet komen, dan staat er eerst "Op za 1 nov". Tot die dag telt de taak niet mee in "x van y gedaan".
- **Opslag:** de lijst wordt op de Google Hub bewaard en op het servertje (`/api/pip-settings`, Netlify Blobs), met dezelfde kattenbak-code. Zo overleeft hij een herstart van de Google Hub. Ook de huisgenoten van de startpagina komen daar terecht.
- `config.js` bevat alleen de standaardlijst voor als er nog niets is opgeslagen.

## Acties: kattenbak draaien en ontgeuren

Onder **Acties** staan twee knoppen voor de Viervoeter-kattenbak (Smart Life / Tuya): **Kattenbak draaien** en **Ontgeuren**. Ze tonen ook Pips gewicht, het aantal bezoeken vandaag en of de opvangbak vol is.

- **Hoe het werkt:** Pip praat met een klein servertje op Netlify (`netlify/functions/kattenbak.mjs`, site `pip-kattenbak`). Dat servertje heeft de Tuya-sleutels en stuurt de kattenbak aan. Pip zelf kent die sleutels niet.
- **Veiligheid:** draaien kan niet als er een kat in de bak zit, en niet twee keer binnen 2 minuten. "Alle korrels verversen" zit er bewust niet in.
- **De code:** het servertje reageert alleen op de kattenbak-code. Die staat op je Mac in `~/.config/pip/kattenbak-code.txt` en in de Netlify-instellingen (`PIP_ACTION_CODE`). Plak hem op de startpagina bij **Kattenbak koppelen**, of start Pip met `start-pip.command`: dat stuurt hem automatisch mee.
- **Tuya-abonnement:** het gratis IoT Core-abonnement van Tuya moet je ongeveer elke 6 maanden verlengen (platform.tuya.com → Cloud Services → IoT Core → Extend Trial Period). Is het verlopen, dan staat er op de knop "Tuya-abonnement verlopen".
- **Servertje aanpassen:** na een wijziging in `netlify/functions` zet je het opnieuw online met:

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
