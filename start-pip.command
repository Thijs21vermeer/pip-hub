#!/bin/bash
# Dubbelklik om Pip op je Google Hub te starten. De eerste keer worden de benodigdheden geïnstalleerd.
cd "$(dirname "$0")" || exit 1
if [ ! -x .venv/bin/python ]; then
  echo "Eerste keer: benodigdheden installeren…"
  if ! { python3 -m venv .venv && .venv/bin/pip install --quiet pychromecast; }; then
    rm -rf .venv
    echo "Installeren is mislukt. Staat Python 3 op je Mac?"
    exit 1
  fi
fi
# caffeinate houdt de Mac wakker zolang dit script draait.
caffeinate -i .venv/bin/python start_pip.py "$@"
