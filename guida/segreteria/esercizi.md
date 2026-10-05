# Segreteria · Esercizi

← [Torna alla segreteria](README.md)

Sopra l'elenco ci sono **LE CATEGORIE** della palestra: Judo, Lotta, Pilates,
Yoga, e poi A corpo libero, Attrezzi, Core, Cardio, Mobilità. È l'unica
divisione degli esercizi, e la stessa dei timer e delle liste di musica. Si
aggiunge una categoria scrivendone il nome; toccandone una si rinomina, si
sposta (‹ ›) o si toglie. Togliere una categoria non toglie niente: gli
esercizi, i timer e le liste di musica che la nominavano restano, senza
categoria. **Tutte** non è nella lista e non si tocca: è per le voci comuni a
ogni categoria (il riscaldamento…), e compare sotto ognuna.
È la segreteria a tenere la lista; istruttori e tablet la usano per filtrare.
Se togli una categoria e poi ne aggiungi una con lo stesso nome, le voci che la
nominavano e non sono ancora state risalvate tornano ad averla.
Serve `40-discipline.sql` sul database: finché non c'è, la lista non si salva.
Gli esercizi che avevano una categoria e una disciplina (Randori: A corpo
libero e Judo) ora hanno la sola disciplina: **Judo**. Con `42-categorie-esercizi.sql`
la vecchia categoria si perde; quelli che avevano solo la categoria la tengono
come voce della lista.

L'elenco degli esercizi che i tablet propongono scrivendo un timer, e i nomi
che la voce incisa sa dire. Finché non c'è, ogni tablet usa il suo: si parte
da **PARTI DA QUELLO DI BASE** (un elenco per una palestra di judo) o da
**PARTI DA ZERO**.

Un esercizio si tocca per cambiargli nome o categoria, o per toglierlo.
Una categoria sola per esercizio, o nessuna; **Tutte le categorie** nel filtro
sopra mostra tutti, e gli esercizi sono divisi per gruppi, con **Senza categoria**
in fondo. Sotto,
uno nuovo con la sua categoria, oppure **INCOLLA UN ELENCO**: uno per riga, o
separati da virgola, tutti nella categoria scelta; quelli che ci sono già si
saltano. Rinominare qui non cambia i timer già salvati. Chi usa il timer dal
suo telefono tiene il suo elenco.
