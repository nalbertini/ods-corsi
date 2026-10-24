# Contatti del sito: icone dei recapiti

Proposta da approvare prima di toccare il sito. Parte dalla libreria `../ods-design-system/`
(`SitoRecapito` con la nuova prop `icona`, `SitoTestata`, `SitoTitolo`, `SitoArrivo`).

| Tavola | Cosa è |
|---|---|
| `ContattiIcone` (1440) | Pagina Contatti: le quattro tessere con l'icona sopra il titolo, poi «Come arrivare» |
| `ContattiIconeTelefono` (375) | Lo stesso sul telefono, una tessera per riga |
| `IconeScelta` | Le sei icone (telefono, Instagram, Facebook, indirizzo, email, orologio) |

Regole: icone a tratto 24px come `src/components/Icons.tsx`, 32px a schermo, `aria-hidden`,
colore del testo (stesso contrasto); si scelgono dal link d'azione, mai dal titolo. Email e orari
oggi non sono in pagina (C1 deciso): sono nella tavola 3 solo per scegliere.
