#!/usr/bin/env python3
"""Start Pip op je Google Hub vanaf je Mac, of laat de NAS hem steeds terugzetten.

  ./start-pip.command           Pip één keer starten
  ./start-pip.command --blijf   blijven draaien en Pip terugzetten zodra de Google Hub vrij is
  ./start-pip.command --zoek    alle Cast-apparaten in je netwerk tonen

Op de NAS draait --blijf in een container (nas/docker-compose.yml). Daar komen de
instellingen uit omgevingsvariabelen:
  PIP_KATTENBAK_CODE   kattenbak-code (op de Mac: ~/.config/pip/kattenbak-code.txt)
  PIP_VOERRAAD_CODE    Voerraad-koppelcode, niet nodig (Pip haalt hem van het servertje)
  PIP_HUB_HOST         IP-adres van de Google Hub, als zoeken in het netwerk niet lukt
  PIP_TZ               tijdzone voor 07:00-23:00, standaard Europe/Amsterdam
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pychromecast
from pychromecast.controllers import BaseController
from pychromecast.error import PyChromecastError

CONFIG_FILE = Path(__file__).with_name("config.js")
# Koppelcodes: niet in config.js (die is openbaar). Op de Mac in deze bestanden,
# op de NAS in de omgevingsvariabelen van CODE_ENV.
CODE_FILES = {
    "voerraad-code": Path(__file__).with_name("voerraad-code.txt"),
    # Gemaakt bij het opzetten van het kattenbak-servertje; staat buiten deze map.
    "kattenbak-code": Path.home() / ".config" / "pip" / "kattenbak-code.txt",
}
CODE_ENV = {"voerraad-code": "PIP_VOERRAAD_CODE", "kattenbak-code": "PIP_KATTENBAK_CODE"}
# Een container kent de Nederlandse tijd niet vanzelf.
TIMEZONE = ZoneInfo(os.environ.get("PIP_TZ") or "Europe/Amsterdam")
# Servertijd min de klok van dit apparaat. De klok van een NAS kan minuten
# achterlopen; dan kwam Pip na een pauze te laat terug.
clock_offset = 0.0
NAMESPACE = "urn:x-cast:nl.pip.hub"
IDLE_APP_IDS = {None, "E8C28D3C"}  # E8C28D3C is de fotolijst ("Backdrop")
CHECK_EVERY_SECONDS = 30
ACTIVE_HOURS = (7, 23)  # met --blijf alleen tussen 07:00 en 23:00 terugzetten
# Pip weg zonder de knop "Google Hub" (Hé Google, een timer, weggeveegd): zo lang
# de Google Hub met rust laten voordat Pip terugkomt.
GRACE_SECONDS = 5 * 60
HEARTBEAT_SECONDS = 5 * 60  # zo vaak laat het script het servertje weten dat het draait
DISCOVERY_SECONDS = 10


def read_setting(key):
    """Leest een tekstwaarde zoals castAppId: "..." uit config.js."""
    match = re.search(rf'{key}\s*:\s*"([^"]*)"', CONFIG_FILE.read_text(encoding="utf-8"))
    return match.group(1).strip() if match else ""


def read_code(kind):
    """Koppelcode uit de omgevingsvariabele (NAS) of uit het bestand (Mac); "" als er geen is."""
    code = os.environ.get(CODE_ENV[kind], "").strip()
    path = CODE_FILES[kind]
    if not code and path.exists():
        code = path.read_text(encoding="utf-8").strip()
    return code


def settings_request(body=None):
    """Praat met het servertje (settings.url in config.js), met de kattenbak-code.

    Geeft de instellingen terug, of {} als dat niet lukt.
    """
    match = re.search(r'settings\s*:\s*\{\s*url\s*:\s*"([^"]+)"', CONFIG_FILE.read_text(encoding="utf-8"))
    code = read_code("kattenbak-code")
    if not match or not code:
        return {}
    headers = {"Authorization": f"Bearer {code}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    request = urllib.request.Request(match.group(1), data=data, headers=headers, method="PUT" if data else "GET")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            global clock_offset
            if response.headers.get("Date"):
                clock_offset = parsedate_to_datetime(response.headers["Date"]).timestamp() - time.time()
            return json.load(response)
    except (OSError, ValueError):
        return {}


def away_until():
    """Tot wanneer Pip weg moet blijven (knop "Google Hub"), op de klok van dit apparaat; 0 = geen pauze."""
    away = settings_request().get("away") or {}
    until = away.get("until", 0) / 1000
    return until - clock_offset if until else 0


def local_now():
    """De echte tijd hier, ook als de klok van dit apparaat afwijkt."""
    return datetime.fromtimestamp(time.time() + clock_offset, TIMEZONE)


def now():
    return local_now().strftime("%H:%M")


def list_devices(casts):
    if not casts:
        print("Geen Cast-apparaten gevonden. Zit je Mac op hetzelfde wifi als de Google Hub?")
    for cast in sorted(casts, key=lambda c: c.cast_info.friendly_name):
        info = cast.cast_info
        print(f"  - {info.friendly_name}  ({info.model_name}, {info.host})")


def pick_hub(casts, name):
    if name:
        matches = [c for c in casts if c.cast_info.friendly_name.casefold() == name.casefold()]
        problem = f'Geen apparaat met de naam "{name}" gevonden. Gevonden apparaten:'
    else:
        matches = [c for c in casts if "hub" in (c.cast_info.model_name or "").casefold()]
        problem = "Geen of meerdere Nest Hubs gevonden. Zet de naam van je Google Hub bij hubName in config.js:"
    if len(matches) == 1:
        return matches[0]
    print(problem)
    list_devices(casts)
    return None


class PipController(BaseController):
    """Praat met Pip op de Google Hub over het eigen kanaal (voor de Voerraad-koppelcode)."""

    def __init__(self, app_id):
        super().__init__(NAMESPACE, app_id)

    def receive_message(self, _message, _data):
        return True


def send_codes(hub, pip):
    """Stuurt de koppelcodes naar Pip, voor zover die er zijn (zie read_code)."""
    codes = {kind: read_code(kind) for kind in CODE_FILES}
    codes = {kind: code for kind, code in codes.items() if code}
    if not codes:
        return
    # Pip luistert pas als de pagina geladen is; wacht tot het kanaal er is.
    deadline = time.time() + 20
    while NAMESPACE not in (hub.status.namespaces if hub.status else []) and time.time() < deadline:
        time.sleep(0.5)
    try:
        for kind, code in codes.items():
            pip.send_message({"type": kind, "code": code})
        time.sleep(1)  # de socket even de tijd geven voordat het script stopt
        print(f"Koppelcodes naar de Google Hub gestuurd: {', '.join(codes)}.")
    except PyChromecastError as error:
        print(f"Koppelcodes versturen lukte niet ({error!r}).")


def launch(hub, app_id, pip):
    name = hub.cast_info.friendly_name
    if hub.app_id == app_id:
        print(f"Het overzicht staat al aan op {name}.")
    else:
        print(f"Overzicht starten op {name}…")
        try:
            hub.start_app(app_id)
        except PyChromecastError as error:
            print(f"Starten lukte niet ({error!r}).")
            print("Is je Google Hub geregistreerd in de Cast Developer Console en daarna herstart? Zie README.")
            return False
        print("Klaar.")
    send_codes(hub, pip)
    return True


def keep_pip_on(hub, app_id, pip):
    start, end = ACTIVE_HOURS
    print(f"Overzicht blijft aan op {hub.cast_info.friendly_name} tussen {start}:00 en {end}:00.")
    if sys.stdout.isatty():  # niet in het log van de NAS of de achtergrond-versie
        print("Laat dit venster open; sluit het om te stoppen.")
    was_on = hub.app_id == app_id
    wait_until = 0  # Pip niet eerder terugzetten dan dit moment
    told_pause = 0
    last_heartbeat = 0
    while True:
        if time.time() - last_heartbeat >= HEARTBEAT_SECONDS:
            settings_request({"watcher": True})  # Pip weet dan dat hij terug kan komen
            last_heartbeat = time.time()
        on = hub.app_id == app_id
        if was_on and not on:
            # Via de knop "Google Hub" staat er een pauze op het servertje; zonder
            # knop (Hé Google, een timer, weggeveegd) geldt de gewone wachttijd.
            wait_until = time.time() + GRACE_SECONDS
            print(f"{now()} Overzicht is weg, de Google Hub krijgt even de ruimte.")
        was_on = on
        if not on and start <= local_now().hour < end and hub.app_id in IDLE_APP_IDS:
            away = away_until()
            back = max(wait_until, away)
            if time.time() >= back:
                print(f"{now()} Google Hub is vrij, overzicht wordt gestart.")
                try:
                    hub.start_app(app_id)
                    send_codes(hub, pip)
                except PyChromecastError as error:
                    print(f"{now()} Starten lukte niet ({error!r}), zo meteen opnieuw.")
            elif away > time.time() and away != told_pause:
                back_at = datetime.fromtimestamp(away + clock_offset, TIMEZONE)
                print(f"{now()} Pauze via de knop: overzicht komt om {back_at:%H:%M} terug.")
                told_pause = away
        time.sleep(CHECK_EVERY_SECONDS)


def main():
    parser = argparse.ArgumentParser(description="Start Pip op je Google Hub.")
    parser.add_argument("--blijf", action="store_true", help="blijf draaien en zet Pip terug als de Google Hub vrij is")
    parser.add_argument("--zoek", action="store_true", help="toon alle Cast-apparaten in je netwerk")
    args = parser.parse_args()

    print("Zoeken naar Cast-apparaten…")
    # Met PIP_HUB_HOST ook rechtstreeks op dat adres kijken (als zoeken niet lukt).
    known_hosts = [host.strip() for host in os.environ.get("PIP_HUB_HOST", "").split(",") if host.strip()]
    casts, browser = pychromecast.get_chromecasts(timeout=DISCOVERY_SECONDS, known_hosts=known_hosts or None)
    try:
        if args.zoek:
            list_devices(casts)
            return 0

        app_id = read_setting("castAppId")
        if not app_id:
            print("Vul eerst castAppId in config.js in (zie README).")
            return 1

        hub = pick_hub(casts, read_setting("hubName"))
        if hub is None:
            return 1
        hub.wait(timeout=10)
        pip = PipController(app_id)
        hub.register_handler(pip)

        if args.blijf:
            keep_pip_on(hub, app_id, pip)
        return 0 if launch(hub, app_id, pip) else 1
    except KeyboardInterrupt:
        print("\nGestopt.")
        return 0
    finally:
        browser.stop_discovery()


if __name__ == "__main__":
    sys.exit(main())
