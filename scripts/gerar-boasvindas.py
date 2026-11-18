#!/usr/bin/env python3
"""Gera as cenas de boas-vindas (sem texto) em assets/boasvindas/*.webp.
Uso (na raiz do repositório): python3 scripts/gerar-boasvindas.py
Requer: Pillow e (cairosvg OU rsvg-convert). O mascote vem de assets/images/mascot/."""
import base64, math, os, random, subprocess, sys, tempfile
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'assets', 'boasvindas'); os.makedirs(OUT, exist_ok=True)
W, H = 540, 1170

def b64(name):
    return base64.b64encode(open(os.path.join(ROOT, 'assets/images/mascot', f'clock-{name}.png'), 'rb').read()).decode()

def cloud(x, y, s=1, o=.8):
    return f'<g transform="translate({x},{y}) scale({s})" opacity="{o}" fill="#fff"><ellipse rx="46" ry="20"/><circle cx="-18" cy="-14" r="20"/><circle cx="14" cy="-20" r="26"/></g>'
def heart(x, y, s, c, o=.9):
    return f'<path transform="translate({x},{y}) scale({s})" d="M0 8 C-14 -4 -16 -18 -6 -20 C-2 -21 0 -18 0 -16 C0 -18 2 -21 6 -20 C16 -18 14 -4 0 8Z" fill="{c}" opacity="{o}"/>'
def star(x, y, s, c, o=.9):
    pts = []
    for i in range(10):
        r = 10 if i % 2 == 0 else 4.2; a = -math.pi/2 + i*math.pi/5
        pts.append(f'{x+r*s*math.cos(a):.1f},{y+r*s*math.sin(a):.1f}')
    return f'<polygon points="{" ".join(pts)}" fill="{c}" opacity="{o}"/>'
def leaf(x, y, rot, c):
    return f'<path transform="translate({x},{y}) rotate({rot})" d="M0 0 C18 -18 40 -14 50 0 C34 14 14 16 0 0Z" fill="{c}" opacity=".85"/>'
def confetti(seed, n, avoid=True):
    random.seed(seed); s = ''
    for _ in range(n):
        x = random.randint(20, 520); y = random.randint(560, 1100)
        if avoid and 330 < y < 980 and 130 < x < 410: continue
        c = random.choice(['#FF6B6B', '#4ECDC4', '#FFD166', '#7C9CF5', '#F78FB3'])
        s += f'<rect x="{x}" y="{y}" width="12" height="7" rx="2" fill="{c}" transform="rotate({random.randint(0,180)} {x} {y})" opacity=".9"/>'
    return s
def puzzle(x, y, c):
    return f'<g transform="translate({x},{y})"><rect x="-34" y="-34" width="68" height="68" rx="10" fill="{c}"/><circle cx="34" r="11" fill="{c}"/><circle cy="-34" r="11" fill="{c}"/><circle cx="-34" r="11" fill="#E8F6F4"/></g>'
def snow(seed, n):
    random.seed(seed)
    return ''.join(f'<circle cx="{random.randint(10,530)}" cy="{random.randint(540,1120)}" r="{random.choice([3,4,5,7])}" fill="#fff" opacity=".9"/>' for _ in range(n))
def pine(x, y, s=1):
    return f'<g transform="translate({x},{y}) scale({s})"><rect x="-6" y="0" width="12" height="18" fill="#8D5A3B"/><polygon points="0,-70 -34,-14 34,-14" fill="#2F9E6E"/><polygon points="0,-48 -42,8 42,8" fill="#37B07C"/><circle cx="-14" cy="-6" r="4" fill="#FF6B6B"/><circle cx="16" cy="0" r="4" fill="#FFD166"/></g>'
def gift(x, y, c):
    return f'<g transform="translate({x},{y})"><rect x="-26" y="-22" width="52" height="44" rx="6" fill="{c}"/><rect x="-5" y="-22" width="10" height="44" fill="#fff" opacity=".85"/><rect x="-26" y="-4" width="52" height="8" fill="#fff" opacity=".85"/></g>'
def burst(x, y, c, r=46):
    return ''.join(f'<line x1="{x+14*math.cos(k*math.pi/6):.0f}" y1="{y+14*math.sin(k*math.pi/6):.0f}" x2="{x+r*math.cos(k*math.pi/6):.0f}" y2="{y+r*math.sin(k*math.pi/6):.0f}" stroke="{c}" stroke-width="5" stroke-linecap="round"/>' for k in range(12))
def bunting(y0):
    cols = ['#E4572E', '#F2A900', '#2A9D8F', '#E0607E', '#5B6CDB']
    s = f'<path d="M-10 {y0} Q270 {y0+60} 550 {y0}" fill="none" stroke="#8D5A3B" stroke-width="3"/>'
    for i in range(9):
        t = (i+.5)/9; x = -10 + 560*t; y = y0 + 4*(1-(2*t-1)**2)*15
        s += f'<polygon points="{x-20:.0f},{y:.0f} {x+20:.0f},{y:.0f} {x:.0f},{y+38:.0f}" fill="{cols[i%5]}"/>'
    return s
def streamers():
    s = ''
    for i, c in enumerate(['#F78FB3', '#4ECDC4', '#FFD166', '#7C9CF5']):
        x = 40 + i*150
        s += f'<path d="M{x} 560 q30 40 0 80 t0 80 t0 80" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round" opacity=".85"/>'
    return s

# id: (cor1, cor2, mascote, props)
SCENES = {
 'bem-estar': ('#E3F7EE', '#BCE4F3', 'base', lambda: cloud(90,640,1.1)+cloud(460,720,.8)+cloud(430,560,.6,.6)+leaf(60,980,-30,'#7BCFA8')+leaf(80,1000,-70,'#52B788')+leaf(440,990,200,'#7BCFA8')+leaf(470,1010,235,'#52B788')+'<g transform="translate(420,860)"><rect x="-26" width="52" height="46" rx="10" fill="#fff"/><path d="M26 10 q18 2 14 18 q-4 12 -14 12" fill="none" stroke="#fff" stroke-width="7"/><path d="M-10 -8 q-8 -14 0 -26 M6 -8 q-8 -14 0 -26" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/></g>'),
 'motivacao': ('#FFF1D6', '#FFC98A', 'base', lambda: '<circle cx="270" cy="780" r="190" fill="#FFE29A" opacity=".55"/><circle cx="270" cy="780" r="130" fill="#FFD166" opacity=".6"/>'+''.join(f'<line x1="{270+210*math.cos(k*math.pi/6):.0f}" y1="{780+210*math.sin(k*math.pi/6):.0f}" x2="{270+260*math.cos(k*math.pi/6):.0f}" y2="{780+260*math.sin(k*math.pi/6):.0f}" stroke="#FFD166" stroke-width="8" stroke-linecap="round" opacity=".6"/>' for k in range(12))+'<path d="M0 1010 Q130 930 260 990 T540 960 V1170 H0Z" fill="#F4A261" opacity=".55"/><path d="M0 1050 Q160 990 300 1040 T540 1020 V1170 H0Z" fill="#E76F51" opacity=".45"/><g transform="translate(440,930)"><line y2="-80" stroke="#8D5A3B" stroke-width="6" stroke-linecap="round"/><path d="M0 -80 L46 -64 L0 -48Z" fill="#E4572E"/></g>'),
 'organizacao': ('#F0EAFF', '#CFE0FF', 'base', lambda: ''.join(f'<g transform="translate({x},{y}) rotate({r})"><rect x="-44" y="-30" width="88" height="60" rx="10" fill="#fff" opacity=".9"/><rect x="-30" y="-16" width="14" height="14" rx="3" fill="#8FA2F5"/><path d="M-27 -9 l4 4 l8 -9" stroke="#fff" stroke-width="3" fill="none"/><rect x="-8" y="-14" width="42" height="6" rx="3" fill="#CFD6F7"/><rect x="-30" y="8" width="64" height="6" rx="3" fill="#E4E8FA"/></g>' for x,y,r in [(70,660,-8),(470,700,7),(450,900,-5)])+'<g transform="translate(75,930) rotate(-40)"><rect x="-6" y="-60" width="12" height="90" rx="3" fill="#F7B267"/><polygon points="-6,30 6,30 0,46" fill="#F4845F"/><rect x="-6" y="-70" width="12" height="12" rx="3" fill="#E76F51"/></g>'+star(120,600,1.2,'#fff',.8)+star(430,600,1,'#fff',.8)),
 'gratidao': ('#FFE6EA', '#FFF3DC', 'base', lambda: ''.join(heart(x,y,s,c) for x,y,s,c in [(70,640,1.6,'#F28AA5'),(470,670,1.2,'#F7A8BC'),(90,900,1.0,'#F7A8BC'),(455,940,1.7,'#F28AA5'),(250,610,.9,'#F7A8BC'),(380,590,.7,'#F28AA5')])+''.join(f'<g transform="translate({x},{y})"><circle r="7" fill="#FFD166"/>'+''.join(f'<circle cx="{16*math.cos(k*math.pi/3):.0f}" cy="{16*math.sin(k*math.pi/3):.0f}" r="9" fill="#fff"/>' for k in range(6))+'<circle r="7" fill="#FFD166"/></g>' for x,y in [(60,1010),(470,1020)])),
 'humor': ('#FFF7BF', '#C9F1DE', 'base', lambda: confetti(4,46)+star(80,700,1.6,'#FFD166')+star(470,760,1.3,'#FF6B6B',.8)+star(100,960,1.1,'#4ECDC4')),
 'ponto': ('#D9F2F0', '#F1FAF8', 'base', lambda: ''.join(puzzle(x,y,c) for (x,y),c in zip([(70,650),(470,690),(90,930),(460,960)],['#7ACFC6','#9BDCD4','#B7E8E2','#7ACFC6']))),
 'natal': ('#E6F4EC', '#FFE1E1', 'christmas', lambda: snow(7,40)+pine(70,930,1.2)+pine(470,950,1)+gift(120,1010,'#E4572E')+gift(420,1020,'#2A9D8F')+star(90,640,1.4,'#FFD166')+star(460,620,1.1,'#FFD166')),
 'anonovo': ('#EDE7FF', '#FFF1C9', 'newyear', lambda: burst(90,660,'#F2A900')+burst(450,640,'#E0607E',40)+burst(430,900,'#5B6CDB',36)+confetti(9,40)+star(110,930,1.5,'#FFD166')+star(280,590,1.1,'#FFD166')),
 'carnaval': ('#FFE0F0', '#D5F0FF', 'carnival', lambda: streamers()+confetti(11,60)+star(80,950,1.2,'#FFD166')+star(470,900,1.2,'#F78FB3')),
 'junina': ('#FFF0D0', '#FFD3B0', 'junina', lambda: bunting(560)+'<g transform="translate(75,960)"><path d="M0 0 Q-30 -40 0 -70 Q30 -40 0 0Z" fill="#E4572E"/><path d="M0 -8 Q-14 -30 0 -48 Q14 -30 0 -8Z" fill="#FFD166"/><rect x="-30" y="2" width="60" height="9" rx="4" fill="#8D5A3B"/></g>'+confetti(13,24)),
}

def scene(c1, c2, mascot, props):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>{props()}
<circle cx="270" cy="800" r="230" fill="url(#glow)"/>
<ellipse cx="270" cy="940" rx="105" ry="13" fill="#0B4F5C" opacity=".14"/>
<image x="95" y="620" width="350" height="350" xlink:href="data:image/png;base64,{b64(mascot)}"/></svg>'''

def render(svg_path, png_path):
    try:
        import cairosvg; cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=1080); return
    except ImportError:
        pass
    subprocess.run(['rsvg-convert', '-w', '1080', svg_path, '-o', png_path], check=True)

if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as tmp:
        for sid, (c1, c2, m, p) in SCENES.items():
            sp = os.path.join(tmp, sid + '.svg'); pp = os.path.join(tmp, sid + '.png')
            open(sp, 'w').write(scene(c1, c2, m, p)); render(sp, pp)
            Image.open(pp).convert('RGB').save(os.path.join(OUT, sid + '.webp'), 'WEBP', quality=82, method=6)
            print('ok', sid, os.path.getsize(os.path.join(OUT, sid + '.webp')) // 1024, 'KB')
