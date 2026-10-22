# Compenso extra · proposta

A volte un tecnico fa un'attività fuori dalle lezioni (uno stage, un
arbitraggio, un evento). Oggi COMPENSI fa una sola ricevuta per tecnico e
mese, fatta di corso × ore × tariffa: non c'è dove scriverla.

| Tavola | Cosa mostra |
|---|---|
| `CompensiOggi` | COMPENSI com'è |
| `CompensiProposta` | Il tasto «+ Compenso extra» accanto a «Prepara e stampa» e, a riga aperta, «+ Compenso extra per …»; le ricevute extra sotto il loro tecnico col tag EXTRA, che non cambiano lo stato del mese; chi ha solo extra (`solo-extra`); il filtro «Extra» |
| `DialogoExtra` | TECNICO, MESE (quello in cui si paga), PER COSA, IMPORTO, la QUALIFICA della ricevuta del mese; «Fai e stampa la ricevuta» |
| `CompensiPropostaTelefono`, `DialogoExtraTelefono` | Le stesse sul telefono |

Libreria: `RigaExtra` nuova; `RigaCompenso` ha lo stato `solo-extra`.
