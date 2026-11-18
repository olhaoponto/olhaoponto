#!/usr/bin/env python3
"""Gera assets/mapa/cenario1..3.webp (540x960), estilo flat/pastel.
Uso: python3 scripts/gerar-cenarios.py   (requer Pillow e rsvg-convert OU cairosvg)"""
import math, random, subprocess, io, os, sys
from PIL import Image
W, H = 540, 960
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'mapa')
if len(sys.argv) > 1: OUT = sys.argv[1]
def cloud(x, y, s=1, o=.9):
    return f'<g transform="translate({x},{y}) scale({s})" opacity="{o}" fill="#fff"><ellipse rx="46" ry="18"/><circle cx="-18" cy="-12" r="18"/><circle cx="12" cy="-18" r="22"/></g>'
def tree(x, y, s=1, c='#5FAE7E', c2='#7CC596'):
    return f'<g transform="translate({x},{y}) scale({s})"><rect x="-4" y="0" width="8" height="26" rx="3" fill="#A07B5A"/><circle cy="-8" r="22" fill="{c}"/><circle cx="-12" cy="2" r="14" fill="{c2}"/><circle cx="13" cy="0" r="15" fill="{c2}"/></g>'
def pine(x, y, s=1, c='#4E9A8B', snow=False):
    t = f'<g transform="translate({x},{y}) scale({s})"><rect x="-4" y="0" width="8" height="18" fill="#8D6B52"/><path d="M0 -62 L24 -22 H-24Z" fill="{c}"/><path d="M0 -42 L30 4 H-30Z" fill="{c}"/>'
    if snow: t += '<path d="M0 -62 L10 -45 Q0 -41 -10 -45Z" fill="#fff"/><path d="M0 -42 L14 -22 Q0 -17 -14 -22Z" fill="#fff"/>'
    return t + '</g>'
def flower(x, y, c):
    return f'<g transform="translate({x},{y})"><circle r="6" fill="{c}"/><circle r="2.5" fill="#FFD166"/></g>'
def flake(x, y, s):
    return f'<g transform="translate({x},{y}) scale({s})" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M0 -8V8M-7 -4L7 4M-7 4L7 -4"/></g>'
def hills(c1, c2, y1, y2):
    return (f'<path d="M0 {y1} Q130 {y1-60} 270 {y1-10} T540 {y1-30} V{H} H0Z" fill="{c1}"/>'
            f'<path d="M0 {y2} Q150 {y2-50} 300 {y2} T540 {y2-20} V{H} H0Z" fill="{c2}"/>')
def campo():
    random.seed(1); s = '<rect width="540" height="960" fill="#CFEFF5"/>'
    s += '<circle cx="450" cy="120" r="46" fill="#FFE29A" opacity=".9"/>' + cloud(110, 110, 1.3) + cloud(400, 260, .9) + cloud(60, 330, .7, .7)
    s += hills('#BFE5B5', '#A6D9A0', 430, 650)
    s += '<path d="M0 780 Q150 740 300 780 T540 760 V960 H0Z" fill="#8FCB93"/>'
    for x, y, sc in [(40, 470, 1), (500, 500, 1.1), (30, 700, 1.2), (505, 720, 1)]: s += tree(x, y, sc)
    for x, y, sc in [(60, 880, 1.3), (480, 890, 1.2)]: s += tree(x, y, sc, '#4F9E6F', '#6DB886')
    for _ in range(26):
        x = random.choice([random.randint(10, 100), random.randint(440, 530)]); y = random.randint(540, 930)
        s += flower(x, y, random.choice(['#F28AA5', '#FFFFFF', '#FFB36B', '#B79CFF']))
    return s
def praia():
    random.seed(2); s = '<rect width="540" height="960" fill="#D8F1F3"/>'
    s += '<circle cx="90" cy="110" r="48" fill="#FFE29A"/>' + cloud(380, 120, 1.2) + cloud(470, 300, .8, .7)
    s += '<rect y="330" width="540" height="300" fill="#A8DDE6"/><rect y="330" width="540" height="40" fill="#BDE8EE"/>'
    for i in range(7): s += f'<path d="M{random.randint(20,420)} {random.randint(390,610)} q20 -10 40 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>'
    s += '<path d="M0 600 Q135 570 270 610 T540 590 V960 H0Z" fill="#F6E7C6"/><path d="M0 640 Q135 612 270 650 T540 632 V960 H0Z" fill="#F2DDB0"/>'
    s += '<path d="M0 600 Q135 570 270 610 T540 590" stroke="#fff" stroke-width="8" fill="none" opacity=".9" stroke-linecap="round"/>'
    for x, y, sc in [(36, 760, 1.3), (505, 800, 1.2)]:
        s += f'<g transform="translate({x},{y}) scale({sc})"><path d="M0 40 Q4 0 -4 -40" stroke="#A07B5A" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M-4 -40 q-28 -6 -38 14 M-4 -40 q-4 -26 -34 -20 M-4 -40 q26 -14 40 6 M-4 -40 q16 -24 -6 -34" stroke="#5FAE7E" stroke-width="9" fill="none" stroke-linecap="round"/></g>'
    s += '<g transform="translate(470,900)"><path d="M0 0 a30 30 0 0 1 60 0Z" fill="#E58F7B"/><path d="M0 0 a30 30 0 0 1 30 -26 v26Z" fill="#fff" opacity=".6"/><rect x="29" y="0" width="3" height="34" fill="#8D6B52"/></g>'
    for x, y in [(70, 880), (60, 920), (150, 930)]: s += f'<g transform="translate({x},{y})"><path d="M0 0 q10 -16 22 0 q-8 6 -22 0Z" fill="#F0AA9A"/><circle cx="11" cy="-6" r="2" fill="#fff"/></g>'
    return s
def neve():
    random.seed(3); s = '<rect width="540" height="960" fill="#DCE8FA"/>'
    s += '<circle cx="440" cy="120" r="40" fill="#FFF3C9"/>' + cloud(110, 130, 1.2, .95) + cloud(380, 280, .8, .8)
    s += '<path d="M-20 520 L120 330 L230 470 L330 300 L470 470 L560 380 V960 H-20Z" fill="#C3D3EE"/>'
    s += '<path d="M120 330 L152 372 L130 366 L110 376Z M330 300 L366 350 L342 344 L318 356Z" fill="#fff"/>'
    s += '<path d="M0 560 Q150 520 300 570 T540 550 V960 H0Z" fill="#E9F0FC"/><path d="M0 700 Q160 660 320 705 T540 690 V960 H0Z" fill="#D9E4F7"/>'
    for x, y, sc in [(40, 640, 1.2), (500, 650, 1.1), (30, 820, 1.3), (505, 860, 1.2)]: s += pine(x, y, sc, snow=True)
    s += '<g transform="translate(70,930)"><circle cy="-12" r="18" fill="#fff" stroke="#C3D3EE" stroke-width="2"/><circle cy="-38" r="12" fill="#fff" stroke="#C3D3EE" stroke-width="2"/><circle cx="-4" cy="-40" r="1.5" fill="#333"/><circle cx="4" cy="-40" r="1.5" fill="#333"/><path d="M0 -37 l8 3 l-8 1Z" fill="#F4A261"/></g>'
    for _ in range(40): s += flake(random.randint(10, 530), random.randint(10, 940), random.uniform(.6, 1.2)) 
    return s
def render(body, name):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{body}</svg>'
    try:
        import cairosvg; png = cairosvg.svg2png(bytestring=svg.encode())
    except Exception:
        png = subprocess.run(['rsvg-convert', '-w', str(W), '-h', str(H)], input=svg.encode(), capture_output=True, check=True).stdout
    Image.open(io.BytesIO(png)).convert('RGB').save(os.path.join(OUT, name), 'WEBP', quality=82, method=6)
os.makedirs(OUT, exist_ok=True)
for fn, n in [(campo, 'cenario1.webp'), (praia, 'cenario2.webp'), (neve, 'cenario3.webp')]: render(fn(), n)
print('ok', OUT)
