# Genera REPORT.md dai testi qui sotto: conta le parole, così le tabelle non sbagliano. Uso: python3 genera.py
import re
n = lambda s: len(re.sub(r'\[DA CONFERMARE[^\]]*\]', '', s).split())
C = {}
def corso(k, **kw): C[k] = kw
corso('Judo', descr='Tecnica, disciplina e rispetto per crescere sul tatami, dai primi passi fino alle gare.',
 quando='Lunedì, mercoledì e venerdì; martedì e giovedì per gli agonisti',
 fa=('Un percorso educativo e sportivo che unisce tecnica, disciplina e relazione, per conoscere il proprio corpo e confrontarsi con gli altri in modo costruttivo. Si lavora su movimenti, cadute, prese e controllo del corpo, con esercizi adattati all’età e al livello.', 28+27),
 chi=('Per bambini, ragazzi e adulti, sia principianti sia agonisti, divisi in gruppi omogenei.', 13),
 asp=[('Ambiente educativo e regolato', None), ('Istruttori esperti e presenti', None), ('Percorsi progressivi e sicuri', None), ('Crescita personale, non solo sportiva', 'Attenzione alla crescita personale, non solo sportiva')],
 perche='Per imparare rispetto, autocontrollo e fiducia, dentro e fuori dal tatami.',
 tolto='«Le lezioni sono strutturate per sviluppare coordinazione, forza e attenzione» (il fatto che si lavori su coordinazione, forza e attenzione esce: da far rileggere a chi insegna); «il judo insegna a…» è stato fuso nella prima frase.')
corso('Lotta', descr='Gioco, movimento e rispetto per crescere insieme, dalla prima prova alla gara.',
 quando='Lunedì, mercoledì e venerdì; il martedì allenamento di preparazione atletica e pesistica',
 fa=('Uno sport completo che sviluppa forza, tecnica e strategia, basato sul confronto fisico controllato e guidato. Allenamenti che combinano esercizi tecnici, preparazione fisica e lavoro sul corpo a corpo, adattati all’età e all’esperienza.', 16+20),
 chi=('Per bambini, ragazzi e adulti, in gruppi divisi per anno di nascita.', 12),
 asp=[('Regole chiare e sicurezza', None), ('Allenamenti supervisionati', None), ('Controllo e tecnica', 'Attenzione al controllo e alla tecnica'), ('Ambiente educativo e sportivo', 'Un ambiente educativo e sportivo')],
 perche='Per crescere forti, consapevoli e capaci di gestire il confronto.', tolto='Niente.')
corso('Aikido', descr='Armonia, equilibrio e difesa, in una disciplina adatta anche a chi ha più anni.',
 quando='Lunedì e giovedì',
 fa=('Un’arte marziale basata sull’armonia del movimento e sulla gestione dell’energia. Si lavora su posture, spostamenti, tecniche fluide e coordinazione, migliorando equilibrio e concentrazione.', 10+13),
 chi=('Per ragazzi e adulti che cercano un’attività marziale non competitiva. [DA CONFERMARE Q8: la tessera dice «dai 7 anni»]', 10),
 asp=[('Ritmi progressivi', None), ('Clima calmo e concentrato', None), ('Postura e controllo', 'Attenzione alla postura e al controllo')],
 perche='Per migliorare corpo e mente attraverso movimenti consapevoli.', tolto='Niente.')
corso('Pre pugilistica', descr='Primi passi nella boxe: tecnica e coordinazione, per imparare i colpi in sicurezza.',
 quando='Mercoledì, dalle 19:00 alle 20:00',
 fa=('Un percorso propedeutico alla boxe che introduce ai fondamentali in un ambiente sicuro e strutturato, per sviluppare coordinazione, reattività e disciplina. Si lavora su schemi motori, guardia, spostamenti e colpi base, con carichi calibrati sull’età.', 33+21),
 chi=('Per ragazzi e ragazze nati dal 2015 in poi, che vogliono avvicinarsi alla boxe partendo dalle basi, in un gruppo omogeneo per età.', 22),
 asp=[('Sicuro, senza contatto pieno', 'Approccio propedeutico e sicuro, senza contatto pieno'), ('Istruttori qualificati nella boxe giovanile', None), ('Percorso graduale', 'Percorso graduale verso le discipline pugilistiche'), ('Crescita fisica e mentale', 'Attenzione allo sviluppo fisico e mentale, non solo tecnico')],
 perche='Per scoprire la boxe nel modo giusto: disciplina, controllo e rispetto, prima ancora della tecnica pura.',
 tolto='«preparando fisico e mente al lavoro sul ring» e «alternano condizionamento fisico e tecnica» (stessa idea in «Crescita fisica e mentale»). Refuso corretto: «dai 2015» → «nati dal 2015».')
corso('Metodo Globale di Autodifesa', descr='Autodifesa pratica e realistica, basata su situazioni reali, spiegata passo dopo passo.',
 quando='Venerdì, dalle 19:00 alle 20:00',
 fa=('Un sistema di autodifesa pratico e realistico, basato su situazioni reali. Tecniche semplici, lavoro sulla consapevolezza e sulla gestione dello stress.', 11+10),
 chi=('Per adulti che vogliono sentirsi più sicuri nella vita quotidiana. [DA CONFERMARE Q6: l’orario dice «da 2015 in poi»]', 10),
 asp=[('Approccio progressivo', None), ('Ambiente rispettoso', None), ('Nessuna esperienza richiesta', None)],
 perche='Per acquisire sicurezza e lucidità, non aggressività.', tolto='Niente.')
corso('Preparazione atletica', descr='Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione, anche per chi gareggia.',
 quando='Martedì e giovedì',
 fa=('Allenamenti mirati per migliorare forza, resistenza, velocità e coordinazione. Esercizi funzionali, lavoro a corpo libero e con attrezzi, adattati agli obiettivi individuali.', 9+13),
 chi=('Per ragazzi e adulti, sportivi e non, come percorso autonomo o di supporto.', 13),
 asp=[('Programmi strutturati', None), ('Progressioni controllate', None), ('Attenzione alla corretta esecuzione', None)],
 perche='Per allenarsi in modo efficace, sicuro e consapevole.', tolto='Niente.')
corso('Giocomotricità e psicomotricità', descr='Percorsi motori per crescere giocando e migliorare coordinazione e fiducia in sé.',
 quando='Martedì e giovedì (giocomotricità), venerdì (psicomotricità)',
 fa=('Un percorso per accompagnare i bambini nello sviluppo motorio ed emotivo, con attività guidate che uniscono gioco, movimento e relazione. I bambini corrono, saltano, rotolano e interagiscono con gli altri, in un clima sereno e stimolante.', 32+39),
 chi=('Per bambini in età prescolare [DA CONFERMARE Q7: 3-5 anni o fino ai primi anni della primaria?], sia alla prima esperienza di movimento sia bisognosi di rinforzare sicurezza e consapevolezza del corpo.', 35),
 asp=[('Un ambiente accogliente e protetto', None), ('Istruttori attenti a ogni bambino', 'Istruttori qualificati e attenti ai singoli bambini'), ('Attività strutturate ma mai competitive', None), ('Si cresce giocando', 'Un percorso che valorizza il gioco come strumento di crescita')],
 perche='Qui il movimento non è prestazione, ma esperienza: un primo passo nello sport che mette al centro il bambino.',
 tolto='«nel rispetto dei tempi di crescita di ciascuno» (c’è già in «Istruttori attenti»: «ogni bambino ha i suoi tempi»); «orientarsi nello spazio… migliorare coordinazione, equilibrio, percezione del corpo e attenzione» (restano coordinazione ed equilibrio nella descrizione).')
corso('Avviamento alle arti marziali', descr='Si scoprono le discipline, per aiutare i più piccoli a trovare la propria strada.',
 quando='Martedì e giovedì, dalle 17:00 alle 18:00',
 fa=('Un percorso introduttivo per i più piccoli: gioco e movimento per avvicinarsi alle arti marziali, senza legarsi a una disciplina. Si alternano esercizi di base delle diverse discipline, giochi di equilibrio e coordinazione e prime forme di contatto controllato.', 39+38),
 chi=('Per bambini e bambine nati tra il 2020 e il 2021, alle prime esperienze sportive, in un gruppo omogeneo per età.', 21),
 asp=[('Giocoso, sicuro, su misura', 'Un ambiente giocoso, sicuro e su misura per l’età'), ('Istruttori che osservano ogni bambino', 'Istruttori che osservano attitudini e inclinazioni di ogni bambino'), ('Aiuta a scegliere la disciplina', 'Un percorso che aiuta a scegliere la disciplina successiva'), ('Sviluppo, non prestazione', 'Attenzione allo sviluppo motorio e sociale, non alla prestazione')],
 perche='Per scoprire, provando, quale arte marziale appassiona davvero il proprio bambino, prima di scegliere un percorso.',
 tolto='«L’obiettivo è far provare approcci diversi, in modo ludico e sicuro, prima di scegliere un percorso specifico» (già in «Aiuta a scegliere la disciplina» e nella frase finale).')
corso('Sollevamento pesi', descr='Un percorso per imparare e perfezionare il sollevamento pesi, dai ragazzi agli adulti.',
 quando='Dal lunedì al venerdì, secondo il gruppo',
 fa=('Un percorso dedicato all’apprendimento e al perfezionamento della tecnica di sollevamento. Si lavora sulla corretta esecuzione dei gesti, sulla forza e sulla consapevolezza del corpo.', 11+14),
 chi=('Per ragazzi e adulti, principianti o avanzati.', 7),
 asp=[('Supervisione costante', None), ('Attenzione alla tecnica', None), ('Progressioni sicure', None)],
 perche='Per costruire forza partendo da basi solide.', tolto='Niente.')
tab = []
for k, c in C.items():
    t, prima = c['fa']
    tab.append(f"| {k} | {prima} → **{n(t)}** | {c['chi'][1]} → **{n(c['chi'][0])}** | {n(c['descr'])} | {len(c['asp'])} |")
out = ['# Pagina del corso: testi rivisti', '']
out += open('intro.md').read().split('\n')
out += ['', '## Lunghezze: prima e dopo', '', 'Parole per tessera. «Cosa si fa» = «Cos’è il corso» + «Cosa si fa durante le lezioni» uniti. Contate con lo script `genera.py` (spazio = separatore; i segnaposto [DA CONFERMARE] non contano).', '',
        '| Corso | Cos’è + Cosa si fa (prima → dopo) | A chi è rivolto (prima → dopo) | Descrizione (parole) | Tessere «Cosa aspettarsi» |', '|---|---|---|---|---|'] + tab
out += ['', 'Prima: «Cos’è + Cosa si fa» da **21 a 77** parole (3,7 volte tra la più corta e la più lunga) e «Per chi è pensato» da 7 a 35. Dopo: **21-41** e **7-23**; i casi lunghi (Avviamento 77, Giocomotricità 71, Judo 55, Pre pugilistica 54) scendono a 35-41; le pagine corte restano corte perché non si inventano fatti: la domanda è in fondo.', '']
for k, c in C.items():
    t, prima = c['fa']
    out += [f'## {k}', '', f"- **Descrizione** ({n(c['descr'])}): {c['descr']}", f"- **Per chi · Quando · Dove · Per iniziare**: invariati, tranne **Quando** → «{c['quando']}»",
            f"- **Cosa si fa** ({n(t)}): {t}", f"- **A chi è rivolto** ({n(c['chi'][0])}): {c['chi'][0]}", '- **Cosa aspettarsi** (titoli ≤ 5 parole, testi invariati):']
    for nuovo, vecchio in c['asp']:
        out.append(f"  - {nuovo} ({len(nuovo.split())})" + (f" ← era «{vecchio}» ({len(vecchio.split())})" if vecchio else ' (invariato)'))
    out += [f"- **Frase del «Perché sceglierlo»** ({len(c['perche'])} caratteri) → va sotto il titolo della chiamata finale: {c['perche']}", f"- **Tolto** (da far rileggere): {c['tolto']}", '']
out += open('domande.md').read().split('\n')
open('REPORT.md', 'w').write('\n'.join(out) + '\n')
print('\n'.join(tab))
