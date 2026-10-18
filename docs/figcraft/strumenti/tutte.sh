#!/bin/zsh
cd "$(dirname "$0")"
typeset -A N
N=(corsi "Corsi" chi-siamo "Chi siamo" contatti "Contatti" istruttori "Istruttori" judo "Judo" lotta "Lotta" aikido "Aikido" pre-pugilistica "Pre pugilistica" mga-metodo-globale-di-autodifesa "Metodo Globale di Autodifesa" preparazione-atletica "Preparazione atletica" sollevamenti-pesi "Sollevamenti pesi" giocomotricita-e-psicomotricita "Giocomotricità e psicomotricità" avviamento-alle-arti-marziali "Avviamento alle arti marziali" fabio-berta "Fabio Berta" maurizio-innella "Maurizio Innella" contributi-pubblici "Contributi pubblici" privacy "Privacy" cookie "Cookie")
for s in ${(k)N}; do for m in desktop telefono; do ./verifica.sh "$s" "${N[$s]}" $m; done; done
