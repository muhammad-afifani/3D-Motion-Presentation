#!/bin/sh
# start.sh — jalankan server presentasi offline (macOS/Linux) lalu buka browser.
# Urutan: Node (server.mjs) → Python 3 (server.py). Keduanya memakai MIME type eksplisit.
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then exec node server.mjs --open "$@"; fi
if command -v python3 >/dev/null 2>&1; then exec python3 server.py --open "$@"; fi
echo "Node dan Python 3 tidak ditemukan. Pasang salah satu, lalu jalankan lagi (lihat BACA-SAYA.txt)."
exit 1
