#!/bin/zsh
# verifica.sh <slug|""> <Nome pagina> <desktop|telefono>  → % pixel diversi per fascia
cd "$(dirname "$0")"
slug="$1"; nome="$2"; mis="$3"
if [ "$mis" = desktop ]; then L=1440; M=0; E="Desktop 1440"; else L=390; M=1; E="Telefono 390"; fi
tag="${slug:-home}-$mis"
figcraft-cli export out/ods-sito.figcraft -o out/fc-$tag.png --format png --scale 0.5 --page "$nome" --node "$nome · $E" >/dev/null 2>&1
node scatta.mjs "$slug" $L $M 0.5 out/live-$tag.png >/dev/null
echo -n "$tag: "; node confronta.mjs out/live-$tag.png out/fc-$tag.png x 800
