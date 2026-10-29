#!/usr/bin/env python3
"""Kijk welke commando's je Smart Life-kattenbak kent, via de Tuya Cloud API.

    python3 tools/tuya_check.py

De eerste keer vraagt hij de Access ID en Access Secret van je Tuya-cloudproject.
Die bewaart hij alleen op deze Mac (~/.config/pip/tuya.json), nooit in deze map.
Dit script leest alleen: er wordt niets aangezet of schoongemaakt.
"""

import getpass
import hashlib
import hmac
import json
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CREDENTIALS = Path.home() / ".config" / "pip" / "tuya.json"
# Smart Life in Nederland valt onder het datacenter Central Europe.
REGIONS = {
    "eu": "https://openapi.tuyaeu.com",
    "eu-west": "https://openapi-weaz.tuyaeu.com",
    "us": "https://openapi.tuyaus.com",
}
EMPTY_BODY_HASH = hashlib.sha256(b"").hexdigest()

HINTS = {
    "1004": "Ondertekening klopt niet: controleer de Access Secret.",
    "1106": "Geen toegang: is je Smart Life-account gekoppeld (Devices → Link App Account)?",
    "2009": "De Access ID klopt niet, of het project staat in een ander datacenter dan Central Europe.",
    "28841002": "Het gratis abonnement op IoT Core is verlopen: verleng het in het Tuya-portaal.",
    "28841105": "Deze API staat nog niet aan voor je project: voeg de dienst IoT Core toe.",
}


def load_credentials():
    if CREDENTIALS.exists():
        return json.loads(CREDENTIALS.read_text())
    print("Plak de gegevens uit je Tuya-cloudproject (tab Overview).")
    creds = {
        "access_id": input("Access ID / Client ID: ").strip(),
        "access_secret": getpass.getpass("Access Secret / Client Secret (je ziet niets tijdens het plakken): ").strip(),
        "region": "eu",
    }
    if input("Bewaren op deze Mac voor later? [j/n] ").strip().lower().startswith("j"):
        CREDENTIALS.parent.mkdir(parents=True, exist_ok=True)
        CREDENTIALS.write_text(json.dumps(creds))
        CREDENTIALS.chmod(0o600)
        print(f"Bewaard in {CREDENTIALS}, alleen leesbaar voor jou.")
    return creds


class TuyaError(Exception):
    def __init__(self, code, message):
        super().__init__(f"{code}: {message}")
        self.code = str(code)


class Tuya:
    """Minimale Tuya OpenAPI-client (HMAC-SHA256-ondertekening, alleen standaardbibliotheek)."""

    def __init__(self, creds):
        self.client_id = creds["access_id"]
        self.secret = creds["access_secret"].encode()
        self.base = REGIONS[creds.get("region", "eu")]
        self.token = ""

    def _sign(self, method, url, body, t, nonce):
        content_hash = hashlib.sha256(body).hexdigest() if body else EMPTY_BODY_HASH
        string_to_sign = "\n".join([method, content_hash, "", url])
        message = self.client_id + self.token + t + nonce + string_to_sign
        return hmac.new(self.secret, message.encode(), hashlib.sha256).hexdigest().upper()

    def request(self, method, path, query=None, payload=None):
        url = f"{path}?{urlencode(sorted(query.items()))}" if query else path
        body = json.dumps(payload).encode() if payload is not None else b""
        t = str(int(time.time() * 1000))
        nonce = uuid.uuid4().hex
        headers = {
            "client_id": self.client_id,
            "t": t,
            "nonce": nonce,
            "sign_method": "HMAC-SHA256",
            "sign": self._sign(method, url, body, t, nonce),
            "Content-Type": "application/json",
        }
        if self.token:
            headers["access_token"] = self.token
        request = Request(self.base + url, data=body or None, method=method, headers=headers)
        with urlopen(request, timeout=15) as response:
            data = json.loads(response.read())
        if not data.get("success"):
            raise TuyaError(data.get("code"), data.get("msg"))
        return data["result"]

    def connect(self):
        self.token = self.request("GET", "/v1.0/token", {"grant_type": "1"})["access_token"]

    def devices(self):
        try:
            result = self.request("GET", "/v2.0/cloud/thing/device", {"page_size": "20"})
            return result if isinstance(result, list) else result.get("list", [])
        except TuyaError:
            result = self.request("GET", "/v1.0/iot-01/associated-users/devices", {"size": "20"})
            return result.get("devices", [])


def looks_like_litter_box(device):
    name = (device.get("name") or device.get("productName") or device.get("product_name") or "").lower()
    return device.get("category") == "msp" or any(w in name for w in ("katten", "litter", "toilet", "cat"))


def describe(tuya, device):
    device_id = device["id"]
    name = device.get("name") or device.get("productName") or "?"
    online = device.get("isOnline", device.get("online"))
    print(f"\nKattenbak: {name} (categorie {device.get('category', '?')}, {'online' if online else 'offline'})")

    # Het "model" heeft alle datapunten met naam en of je ze mag schrijven.
    try:
        model = json.loads(tuya.request("GET", f"/v2.0/cloud/thing/{device_id}/model")["model"])
        props = [p for service in model.get("services", []) for p in service.get("properties", [])]
    except (TuyaError, KeyError, ValueError):
        props = []
    try:
        values = {p["code"]: p.get("value") for p in tuya.request("GET", f"/v2.0/cloud/thing/{device_id}/shadow/properties")["properties"]}
    except (TuyaError, KeyError):
        values = {}

    if props:
        writable = [p for p in props if p.get("accessMode") in ("rw", "wr")]
        readonly = [p for p in props if p.get("accessMode") == "ro"]
        print("\nTe bedienen (hiermee kan Pip iets laten doen):")
        for p in writable:
            print(f"  {p['code']:<24} {p.get('typeSpec', {}).get('type', '?'):<8} {p.get('name', '')}  (nu: {values.get(p['code'])})")
        print("\nAlleen lezen (status, kan Pip laten zien):")
        for p in readonly:
            print(f"  {p['code']:<24} {p.get('typeSpec', {}).get('type', '?'):<8} {p.get('name', '')}  (nu: {values.get(p['code'])})")
    else:
        spec = tuya.request("GET", f"/v1.0/iot-03/devices/{device_id}/specification")
        print("\nTe bedienen:")
        for f in spec.get("functions", []):
            print(f"  {f['code']:<24} {f.get('type', '?')}  (nu: {values.get(f['code'])})")
        print("\nStatus:")
        for s in spec.get("status", []):
            print(f"  {s['code']:<24} {s.get('type', '?')}  (nu: {values.get(s['code'])})")


def main():
    tuya = Tuya(load_credentials())
    try:
        tuya.connect()
        devices = tuya.devices()
        if not devices:
            print("Geen apparaten gevonden. Is je Smart Life-account gekoppeld aan het project?")
            return 1
        print("Apparaten in je Smart Life-account:")
        for d in devices:
            print(f"  - {d.get('name') or d.get('productName')}  (categorie {d.get('category', '?')})")
        litter = [d for d in devices if looks_like_litter_box(d)] or devices[:1]
        for device in litter:
            describe(tuya, device)
        print("\nKlaar. Er is niets aangestuurd.")
        return 0
    except TuyaError as error:
        print(f"Tuya gaf een fout: {error}")
        print(HINTS.get(error.code, "Kijk in het Tuya-portaal of het project goed staat."))
        return 1
    except (HTTPError, URLError) as error:
        print(f"Kon Tuya niet bereiken: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
