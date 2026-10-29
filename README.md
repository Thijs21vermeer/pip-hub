# Pip op de Nest Hub

Een checklist voor Pip op je Google Nest Hub: taken afvinken (wie en hoe laat), de voorraad bijhouden, en een klok. De app houdt zichzelf wakker, zodat hij niet na 10 minuten van het scherm verdwijnt.

## Wat zit erin

| Bestand | Wat het doet |
|---|---|
| `index.html`, `app.js`, `style.css` | Het Pip-scherm op de Hub (1024×600, 's avonds donker) |
| `cast.js` | Maakt er een Cast-app van en houdt hem wakker |
| `config.js` | **Hier pas je alles aan:** taken, namen, voorraad, App-ID |
| `start.html` | Startknop voor Chrome op Android of je Mac |
| `start-pip.command` | Dubbelklik op je Mac om Pip te starten |
| `houd-pip-aan.command` | Dubbelklik: zet Pip steeds terug zolang je Mac aan staat |
| `pip.png` | Icoon, ook gebruikt voor de wakker-houd-truc |

## 1. Online via GitHub Pages

De Hub laadt de app van https://thijs21vermeer.github.io/pip-hub/. Elke push naar `main` zet automatisch de nieuwe versie online (duurt ongeveer een minuut).

Let op: de repository is openbaar. Iedereen kan dus de namen in `config.js` zien. De afvinkjes zelf staan alleen op de Hub.

## 2. Registreer de app bij Google (eenmalig $5)

1. Ga naar [cast.google.com/publish](https://cast.google.com/publish), log in en betaal de eenmalige registratie van $5.
2. **Add new application → Custom Receiver.**
   - Name: `Pip`
   - Receiver Application URL: `https://thijs21vermeer.github.io/pip-hub/`
   - Klik op **Save**. Je krijgt een **App ID** van 8 tekens. Je hoeft de app niet te publiceren.
3. **Add new Device:** vul het serienummer van je Nest Hub in. Dat staat op de sticker aan de onderkant of achterkant, of in de Google Home-app bij de apparaatgegevens van de Hub.
4. Wacht 15 minuten (soms tot een uur). Herstart daarna de Hub: stekker eruit, 10 seconden wachten, stekker erin.

## 3. Vul de App-ID in

Zet in `config.js` je App-ID en de naam van je Hub (zoals in de Google Home-app):

```js
castAppId: "A1B2C3D4",
hubName: "Keuken",
```

Zet de map daarna opnieuw online.

## 4. Pip starten

- **Android of Mac (Chrome):** open `https://thijs21vermeer.github.io/pip-hub/start.html`, tik op **Start Pip** en kies je Hub. Op Android kun je de pagina via het menu aan je startscherm toevoegen, dan is het één tik.
- **Mac:** dubbelklik op `start-pip.command`. De eerste keer installeert hij wat nodig is (duurt even).
- **Pip steeds terugzetten:** dubbelklik op `houd-pip-aan.command`. Zolang dat venster openstaat en je Mac wakker is, kijkt hij elke minuut of de Hub vrij is en zet hij Pip terug (tussen 07:00 en 23:00).
- **iPhone:** Safari kan niet casten naar eigen apps. Start Pip vanaf je Mac.

Welke Cast-apparaten ziet je Mac? Dat check je in Terminal met:

```bash
./start-pip.command --zoek
```

## Voerraad koppelen

Met een koppeling laat het Voorraad-blok zien wat Voerraad weet: per product hoeveel dagen nog, "Bijna op" en "Besteld". Pip kan daar alleen lezen, niets wijzigen.

1. Ga in Voerraad naar **Instellingen → Huishouden → Scherm in huis** en tik op **Koppelcode maken**. Kopieer de code; je ziet hem maar één keer.
2. Geef de code aan Pip, op een van deze twee manieren:
   - **Startpagina:** open `start.html`, klap **Voerraad koppelen** open, plak de code en tik op **Code opslaan**. De pagina controleert de code bij Voerraad en stuurt hem bij elke start mee naar de Hub.
   - **Mac:** zet de code in een bestand `voerraad-code.txt` naast `start-pip.command`. Dat bestand gaat niet naar GitHub.
3. Start Pip. Het blok haalt de voorraad meteen op, en daarna elk kwartier.

De code hoort **nooit** in `config.js`: die map is openbaar. Code kwijt of uitgelekt? Maak in Voerraad een nieuwe code (de oude werkt dan niet meer) of kies **Ontkoppelen**.

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

## 5. Eerste test op de Hub

- [ ] Pip verschijnt op de Hub
- [ ] Tikken werkt (een taak afvinken, iemand kiezen)
- [ ] Na 15 minuten staat Pip er nog (de wakker-houd-truc)
- [ ] Pip blijft staan als je de startpagina op je telefoon sluit
- [ ] Na een herstart van de Hub en opnieuw starten staan de vinkjes er nog

## Aanpassen

Alles staat in `config.js`: taken (met icoon), wie er kan afvinken, de voorraad en hoe laat de lijst leeg begint (standaard 04:00). Na een wijziging zet je de map opnieuw online. De Hub laadt de nieuwe versie bij de volgende start.

Even lokaal bekijken op je Mac:

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000 in je browser.

## Start Pip niet?

- **"Starten lukte niet" / `NOT_FOUND`:** de Hub kent de app nog niet.
  - Kijk in de Cast Console bij **Cast Receiver Devices** of daar het **serienummer van de Hub** staat, en niet de App-ID.
  - Ook na "Ready For Testing" kan het nog 10 minuten of langer duren. Trek daarna de stekker van de Hub eruit en steek hem er weer in.
- **Serienummer zeker weten:** open [cast.google.com/publish](https://cast.google.com/publish) in Chrome, kies **Casten…** en dan je Hub. Het serienummer verschijnt op het scherm van de Hub.
- **Hub niet gevonden:** check met `./start-pip.command --zoek` of je Mac hem ziet. De Hub moet aan staan en op hetzelfde wifi zitten (geen gastnetwerk).

## Goed om te weten

- **Wakker houden:** de Hub sluit een cast-app na ongeveer 10 minuten als er geen media speelt. `cast.js` "speelt" daarom elke 9 minuten onzichtbaar `pip.png` af, dezelfde truc als Home Assistant Cast. Niet officieel, dus een update van Google kan dit breken.
- **Na een timer, muziek of "Hé Google"** verdwijnt Pip. Start hem dan opnieuw, of laat `houd-pip-aan.command` dat doen.
- **Opslag:** de vinkjes en de voorraad worden op de Hub zelf bewaard. Je telefoon ziet ze niet, en bij een herstart van de Hub kunnen ze kwijt zijn. Synchroniseren met je telefoon vraagt een online database (bijvoorbeeld Supabase).
