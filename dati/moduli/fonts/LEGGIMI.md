# Font dei fogli PDF

Big Shoulders Display 800 e Inter (Regular 400, Bold 700), in TrueType: un PDF incorpora i byte del
font così come sono e non legge i `woff2` di `public/fonts/`. Derivati da quei file (licenza OFL, vedi
`public/fonts/OFL-*.txt`): il `woff2` decompresso e, per Inter, due istanze statiche del font variabile
(`fontTools.varLib.instancer`, wght 400 e 700).
