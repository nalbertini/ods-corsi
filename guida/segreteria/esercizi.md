# Segreteria · Esercizi

← [Torna alla segreteria](README.md)

Sopra l'elenco ci sono **LE DISCIPLINE** della palestra: Judo, Lotta, Pilates,
Yoga. Si aggiunge una disciplina scrivendone il nome; toccandone una si
rinomina, si sposta (‹ ›) o si toglie. Togliere una disciplina non toglie
niente: gli esercizi, i timer e le liste di musica che la nominavano restano,
senza disciplina. **Tutte** non è nella lista e non si tocca: è per le voci
comuni a ogni disciplina (il riscaldamento, il core…), e compare sotto ognuna.
È la segreteria a tenere la lista; istruttori e tablet la usano per filtrare.
Se togli una disciplina e poi ne aggiungi una con lo stesso nome, le voci che la
nominavano e non sono ancora state risalvate tornano ad averla.
Serve `40-discipline.sql` sul database: finché non c'è, la lista non si salva.

L'elenco degli esercizi che i tablet propongono scrivendo un timer, e i nomi
che la voce incisa sa dire. Finché non c'è, ogni tablet usa il suo: si parte
da **PARTI DA QUELLO DI BASE** (un elenco per una palestra di judo) o da
**PARTI DA ZERO**.

Un esercizio si tocca per cambiargli nome, categoria o disciplina, o per toglierlo.
Una disciplina sola per esercizio, o nessuna; **Ogni disciplina** nella barra
sopra mostra tutti. Sotto,
uno nuovo con la sua categoria, oppure **INCOLLA UN ELENCO**: uno per riga, o
separati da virgola, tutti nella categoria scelta; quelli che ci sono già si
saltano. Rinominare qui non cambia i timer già salvati. Chi usa il timer dal
suo telefono tiene il suo elenco.
