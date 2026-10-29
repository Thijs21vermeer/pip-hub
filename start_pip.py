#!/usr/bin/env python3
"""Start Pip op je Nest Hub vanaf je Mac (of later vanaf een Raspberry Pi).

  ./start-pip.command           Pip één keer starten
  ./start-pip.command --blijf   blijven draaien en Pip terugzetten zodra de Hub vrij is
  ./start-pip.command --zoek    alle Cast-apparaten in je netwerk tonen
"""

import argparse
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pychromecast
from pychromecast.error import PyChromecastError

CONFIG_FILE = Path(__file__).with_name("config.js")
IDLE_APP_IDS = {None, "E8C28D3C"}  # E8C28D3C is de fotolijst ("Backdrop")
CHECK_EVERY_SECONDS = 60
ACTIVE_HOURS = (7, 23)  # met --blijf alleen tussen 07:00 en 23:00 terugzetten
DISCOVERY_SECONDS = 10


def read_setting(key):
    """Leest een tekstwaarde zoals castAppId: "..." uit config.js."""
    match = re.search(rf'{key}\s*:\s*"([^"]*)"', CONFIG_FILE.read_text(encoding="utf-8"))
    return match.group(1).strip() if match else ""


def now():
    return datetime.now().strftime("%H:%M")


def list_devices(casts):
    if not casts:
        print("Geen Cast-apparaten gevonden. Zit je Mac op hetzelfde wifi als de Hub?")
    for cast in sorted(casts, key=lambda c: c.cast_info.friendly_name):
        info = cast.cast_info
        print(f"  - {info.friendly_name}  ({info.model_name}, {info.host})")


def pick_hub(casts, name):
    if name:
        matches = [c for c in casts if c.cast_info.friendly_name.casefold() == name.casefold()]
        problem = f'Geen apparaat met de naam "{name}" gevonden. Gevonden apparaten:'
    else:
        matches = [c for c in casts if "hub" in (c.cast_info.model_name or "").casefold()]
        problem = "Geen of meerdere Nest Hubs gevonden. Zet de naam van je Hub bij hubName in config.js:"
    if len(matches) == 1:
        return matches[0]
    print(problem)
    list_devices(casts)
    return None


def launch(hub, app_id):
    name = hub.cast_info.friendly_name
    if hub.app_id == app_id:
        print(f"Pip staat al aan op {name}.")
        return True
    print(f"Pip starten op {name}…")
    try:
        hub.start_app(app_id)
    except PyChromecastError as error:
        print(f"Starten lukte niet ({error!r}).")
        print("Is je Hub geregistreerd in de Cast Developer Console en daarna herstart? Zie README.")
        return False
    print("Klaar.")
    return True


def keep_pip_on(hub, app_id):
    start, end = ACTIVE_HOURS
    print(f"Pip blijft aan op {hub.cast_info.friendly_name} tussen {start}:00 en {end}:00.")
    print("Laat dit venster open; sluit het om te stoppen.")
    while True:
        if start <= datetime.now().hour < end and hub.app_id in IDLE_APP_IDS:
            print(f"{now()} Hub is vrij, Pip wordt gestart.")
            try:
                hub.start_app(app_id)
            except PyChromecastError as error:
                print(f"{now()} Starten lukte niet ({error!r}), over een minuut opnieuw.")
        time.sleep(CHECK_EVERY_SECONDS)


def main():
    parser = argparse.ArgumentParser(description="Start Pip op je Nest Hub.")
    parser.add_argument("--blijf", action="store_true", help="blijf draaien en zet Pip terug als de Hub vrij is")
    parser.add_argument("--zoek", action="store_true", help="toon alle Cast-apparaten in je netwerk")
    args = parser.parse_args()

    print("Zoeken naar Cast-apparaten…")
    casts, browser = pychromecast.get_chromecasts(timeout=DISCOVERY_SECONDS)
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

        if args.blijf:
            keep_pip_on(hub, app_id)
        return 0 if launch(hub, app_id) else 1
    except KeyboardInterrupt:
        print("\nGestopt.")
        return 0
    finally:
        browser.stop_discovery()


if __name__ == "__main__":
    sys.exit(main())
