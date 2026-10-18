#!/bin/bash
# Sviluppo da COPIA con lightcraft-cli render: gli originali in ~/Downloads/Officine dello Sport non si toccano,
# nessuna scrittura nella libreria LightCraft né sidecar .xmp. Uso: ./sviluppa.sh   (da questa cartella)
L=/Users/nicola/Developer/lightcraft/target/release/lightcraft-cli
R="/Users/nicola/Downloads/Officine dello Sport"
cd "$(dirname "$0")"
# nome | file sorgente | lato lungo | impostazioni (--set ...)
while IFS='|' read -r nome src size sets; do
  [ -z "$nome" ] && continue
  "$L" render "$R/$src" -o "originali/$nome.jpg" --size "$size" --quality 82 --opt metadata=none >/dev/null
  # shellcheck disable=SC2086
  "$L" render "$R/$src" -o "migliorate/$nome.jpg" --size "$size" --quality 82 --opt metadata=none $sets >/dev/null && echo "ok $nome"
done < sviluppo.txt
