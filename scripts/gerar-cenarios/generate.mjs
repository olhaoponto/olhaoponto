import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });
const out = new URL('../../assets/mapa/', import.meta.url).pathname;
const esc = (s) => s;
function scene(kind) {
  const winter = kind === 'winter';
  const bg = winter ? '#EAF1FA' : '#E4F0D8';
  const bands = winter ? ['#F4F8FD','#DDE8F4','#CCDFEE','#DDE8F4','#F4F8FD'] : ['#DCEBC8','#C5E2B0','#A9D6A0','#C5E2B0','#DCEBC8'];
  const accents = winter ? ['#A9BAC4','#C8D5DC','#F0AA9A','#F7DA8C'] : ['#63B283','#8ACBA0','#E58F7B','#F7DA8C'];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="1080" height="1920" fill="${bg}"/>`;
  if (winter) svg += '<path d="M0 210 Q240 50 520 210 T1080 170 V0 H0Z" fill="#9fd4bc" opacity=".28"/><path d="M0 300 Q260 110 600 270 T1080 180" fill="none" stroke="#f0b4c0" stroke-width="50" opacity=".14"/>';
  for (let i=0;i<5;i++) { const y=300+i*330; const c=bands[i]; svg += `<path d="M0 ${y} Q170 ${y-85} 360 ${y+5} T720 ${y-20} T1080 ${y+10} V${y+330} H0Z" fill="${c}"/><path d="M0 ${y} Q170 ${y-85} 360 ${y+5} T720 ${y-20} T1080 ${y+10}" fill="none" stroke="#fff" stroke-opacity=".52" stroke-width="9"/><ellipse cx="540" cy="${y+150}" rx="330" ry="95" fill="#fff" opacity=".12"/>`; }
  if (!winter) svg += '<path d="M90 1690 Q350 1500 520 1610 T990 1400" fill="none" stroke="#f7f0dc" stroke-width="38" opacity=".8"/><path d="M90 1690 Q350 1500 520 1610 T990 1400" fill="none" stroke="#c9ad78" stroke-width="8" opacity=".7"/>';
  const shadow=(x,y,w=150)=>`<ellipse cx="${x}" cy="${y}" rx="${w}" ry="28" fill="#42605a" opacity=".18" filter="url(#blur)"/>`;
  const tree=(x,y,s=1)=>`${shadow(x,y+110,95*s)}<rect x="${x-14*s}" y="${y+35*s}" width="28" height="90" rx="12" fill="#84634A"/><circle cx="${x-48*s}" cy="${y+20*s}" r="58" fill="${accents[0]}"/><circle cx="${x+35*s}" cy="${y+10*s}" r="66" fill="${accents[1]}"/><circle cx="${x}" cy="${y-32*s}" r="62" fill="${accents[0]}"/>`;
  const pine=(x,y,s=1)=>`${shadow(x,y+150,70*s)}<path d="M${x} ${y-120*s} L${x-75*s} ${y+90*s} H${x+75*s}Z" fill="${winter?'#8fc5b1':'#63B283'}"/><path d="M${x} ${y-45*s} L${x-95*s} ${y+135*s} H${x+95*s}Z" fill="${winter?'#72a99d':'#4d986d'}"/><rect x="${x-14*s}" y="${y+100*s}" width="28" height="60" fill="#84634A"/>`;
  const house=(x,y)=>`${shadow(x,y+155,125)}<path d="M${x-125} ${y} L${x} ${y-105} L${x+125} ${y}Z" fill="#E58F7B"/><rect x="${x-105}" y="${y}" width="210" height="145" rx="18" fill="#FCF4E2"/><rect x="${x-70}" y="${y+48}" width="48" height="48" rx="8" fill="#F7DA8C"/><rect x="${x+22}" y="${y+48}" width="48" height="48" rx="8" fill="#F7DA8C"/><rect x="${x-20}" y="${y+70}" width="40" height="75" rx="8" fill="#84634A"/>`;
  svg += house(170,420)+tree(820,550,1.2)+pine(950,850,.8)+house(900,1170)+tree(180,1350,1.1)+pine(90,1570,.75)+pine(950,1650,.9);
  if (winter) svg += `<path d="M120 930 Q540 760 960 920 L960 1190 Q540 1300 120 1170Z" fill="#c8dce8" opacity=".9"/><path d="M150 980 Q400 830 600 910 T940 960" fill="none" stroke="#fff" stroke-width="12" opacity=".8"/><circle cx="500" cy="1050" r="48" fill="#fff"/><circle cx="500" cy="970" r="35" fill="#fff"/><circle cx="488" cy="965" r="5"/><circle cx="512" cy="965" r="5"/><path d="M480 985 L520 985" stroke="#E58F7B" stroke-width="8"/>`;
  else svg += `<path d="M430 850 Q520 760 610 850 Q690 920 760 820" fill="none" stroke="#7dc7dd" stroke-width="40" opacity=".9"/><ellipse cx="650" cy="1120" rx="150" ry="70" fill="#8fd1df" opacity=".8"/><path d="M560 1090 Q650 1020 740 1090" fill="none" stroke="#fff" stroke-width="8" opacity=".8"/>`;
  for (let i=0;i<16;i++){const x=70+(i*173)%940,y=180+(i*257)%1540; svg+=`<circle cx="${x}" cy="${y}" r="${4+i%4}" fill="${accents[i%accents.length]}" opacity=".8"/>`;}
  svg += '<rect width="1080" height="1920" fill="url(#light)" opacity=".45"/></svg>'; return svg;
}
for (const [kind,name] of [['field','cenario1'],['winter','cenario3']]) {
  const svgPath=`${dir}${name}.svg`; const pngPath=`${dir}${name}.png`; const webpPath=`${out}${name}.webp`; fs.writeFileSync(svgPath, scene(kind));
  execFileSync('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu',`--screenshot=${pngPath}`,'--window-size=1080,1920',`file://${svgPath}`],{stdio:'ignore'});
  execFileSync('python3',['-c',`from PIL import Image; Image.open(r'${pngPath}').convert('RGB').save(r'${webpPath}', 'WEBP', quality=82, method=6)`]);
  fs.unlinkSync(svgPath); fs.unlinkSync(pngPath);
}
fs.copyFileSync('/tmp/cenario2-anexo.webp', `${out}cenario2.webp`);
console.log('generated scenarios');
