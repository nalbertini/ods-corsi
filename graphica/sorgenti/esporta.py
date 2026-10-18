"""Esporta un pittogramma SVG in PNG trasparenti 32/64/128 con VectorCraft (app aperta con --control).
Uso: python3 esporta.py <svg> <nome> <cartella-uscita> [porta]
VectorCraft scrive solo dentro la sua radice di scrittura: lancia l'app con
--automation-read-root e --automation-write-root su una cartella di lavoro e usa quella."""
import json, socket, sys, shutil, os, time

def chiama(metodo, params, porta):
    s = socket.create_connection(("127.0.0.1", porta), timeout=70)
    s.sendall((json.dumps({"id": 1, "method": metodo, "params": params}) + "\n").encode())
    b = b""
    while not b.endswith(b"\n"):
        b += s.recv(65536)
    r = json.loads(b)
    if not r.get("ok"):
        sys.exit(f"VectorCraft: {metodo} fallito: {r.get('error')}")
    return r

svg, nome, uscita = sys.argv[1:4]
porta = int(sys.argv[4]) if len(sys.argv) > 4 else 7979
radice = os.environ.get("VC_RADICE", "/private/tmp/claude-501/vc")
copia = f"{radice}/{nome}.svg"
shutil.copy(svg, copia)
chiama("app.open", {"path": copia}, porta)
for lato in (32, 64, 128):
    dest = f"{radice}/{nome}-{lato}.png"
    if os.path.exists(dest): os.remove(dest)
    chiama("app.export", {"path": dest, "format": "png", "background": "transparent", "ppi": 72 * lato / 128}, porta)
    for _ in range(40):  # l'export è in background
        if os.path.exists(dest) and os.path.getsize(dest) > 0: break
        time.sleep(0.25)
    time.sleep(0.3)
    shutil.copy(dest, f"{uscita}/{nome}-{lato}.png")
