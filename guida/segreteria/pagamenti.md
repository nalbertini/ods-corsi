# Segreteria · Pagamenti

← [Torna alla segreteria](README.md)

Tutto quello che è stato pagato, di tutti, in un posto solo: i pagamenti delle
ricevute e quelli registrati a mano senza ricevuta. Serve a rispondere a «ma
Rossi ha pagato?» e a sapere chi richiamare. Si guarda e basta: un pagamento
si registra o si annulla dalla [scheda della persona](iscritti.md#un-pagamento-e-la-sua-ricevuta).
La stessa pagina la vede anche chi ha il ruolo di [amministrazione](../amministrazione/pagamenti.md), senza i contatti, e da lì registra e annulla i pagamenti senza aprire la scheda.

## I quattro numeri

| | |
|---|---|
| **INCASSATO** | quanto è stato pagato nel periodo scelto, con i filtri accesi |
| **PAGAMENTI** | quanti sono, e quanti senza ricevuta |
| **CONTANTI** | i contanti del periodo, e quanto è arrivato in altri modi |
| **DA INCASSARE** | quanto manca sulle ricevute non saldate, di tutte le persone |

## La tabella

Una riga per **pagamento**: data, chi, a cosa serve, come, numero della ricevuta
(o **Senza ricevuta** se è stato registrato a mano) e importo. Dal più recente.
Si può ordinare toccando il nome di una colonna. Toccando una riga si apre la
scheda della persona. Gli elenchi lunghi vanno a pagine di 50: il **TOTALE DEL
PERIODO** sotto vale su tutti i pagamenti trovati, non solo sulla pagina.

- **Cerca**: per nome (nome e cognome in qualunque ordine, senza badare ad accenti e maiuscole), o per numero di ricevuta, anche con l'anno
  («12» o «12/2026»: «12» non trova la 112). Non cerca nella voce né nella nota.
- **Il periodo**: il mese in corso, il mese scorso, **Tutto l’anno**, **Tutto**,
  o **Dal – al** con due date. Si parte da **Tutto l’anno**.
- **Il modo di pagare**: contanti, bonifico, POS, Satispay, assegno.
- **Senza ricevuta**: solo i pagamenti registrati a mano.
- **Annullati**: mostra anche quelli annullati, barrati. Non entrano mai nei
  totali.
- **Esporta CSV**: un foglio da aprire con Excel (punto e virgola, importi
  all'italiana) con i pagamenti trovati, per il commercialista. Senza gli
  annullati.

## Chi deve ancora pagare

**Con residuo da pagare** cambia la tabella: una riga per **ricevuta non
saldata**, con totale, pagato, quanto **MANCA** e il telefono (o l'email) per
richiamare. Dalla più grande. Le ricevute annullate non ci sono. La ricerca per
nome o numero vale anche qui; il periodo e il modo di pagare no.

## Cosa non c'è

- I pagamenti dei **corsi** fuori dall'app che nessuno ha registrato: se non
  sono nella scheda, qui non ci sono.
- Gli ordini del **vestiario**, che hanno la loro pagina.
- **STATISTICHE** conta gli incassi per mese **della ricevuta**, e non i
  pagamenti a mano: i due numeri possono non coincidere.
