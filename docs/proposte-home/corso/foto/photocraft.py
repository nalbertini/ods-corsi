# Confronto PhotoCraft: stesse regolazioni di sviluppo.txt (temperatura 5700 K -> -20, scala del filtro Camera Raw). Uso: python3 photocraft.py (da questa cartella)
import re, subprocess, json
m = {'wb.temp': lambda v: ('temperature', round((v - 6500) / 40)), 'wb.tint': lambda v: ('tint', round(v * 2 / 3)), 'light.exposure': lambda v: ('exposure', v), 'light.contrast': lambda v: ('contrast', v), 'light.highlights': lambda v: ('highlights', v), 'light.shadows': lambda v: ('shadows', v), 'light.whites': lambda v: ('whites', v), 'color.vibrance': lambda v: ('vibrance', v), 'color.saturation': lambda v: ('saturation', v), 'detail.sharpenAmount': lambda v: ('sharpenAmount', v), 'detail.nrLuminance': lambda v: ('noiseLuminance', v)}
for l in open('sviluppo.txt'):
    n, src, size, sets = l.rstrip('\n').split('|')
    p = dict(m[k](float(v)) for k, v in re.findall(r'--set (\S+)=(\S+)', sets))
    subprocess.run(['photocraft-cli', 'run', f'originali/{n}.jpg', '--cmd', 'filter.cameraRaw', '--params', json.dumps(p), '--out', f'photocraft/{n}.jpg', '--quality', '82'], capture_output=True)
    print(n)
