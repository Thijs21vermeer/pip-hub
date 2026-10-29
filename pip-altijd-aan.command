#!/bin/bash
# Dubbelklik: Pip altijd terugzetten, ook zonder open venster en na een herstart
# van je Mac (zolang de Mac wakker is). Nodig voor de knop "Google Hub" op Pip:
# na de pauze zet dit Pip vanzelf terug. Nog een keer dubbelklikken = weer uit.
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
LABEL="nl.pip.blijf"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/pip-blijf.log"

if [ -f "$PLIST" ]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  echo "Uit: Pip wordt niet meer vanzelf teruggezet."
  exit 0
fi

if [ ! -x .venv/bin/python ]; then
  echo "Dubbelklik eerst één keer op start-pip.command (die installeert wat nodig is)."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>$DIR/.venv/bin/python</string>
    <string>-u</string>
    <string>$DIR/start_pip.py</string>
    <string>--blijf</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Aan: Pip wordt vanaf nu vanzelf teruggezet (tussen 07:00 en 23:00)."
echo "Wat er gebeurt staat in $LOG"
echo "Uitzetten: dubbelklik nog een keer op dit bestand."
