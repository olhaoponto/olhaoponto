import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAvatar } from '@dicebear/core';
import {
  adventurer,
  avataaars,
  bigSmile,
  bottts,
  funEmoji,
  lorelei,
  micah,
  notionists,
  openPeeps,
  pixelArt,
  toonHead,
} from '@dicebear/collection';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'assets', 'avatares');
const catalogPath = path.join(root, 'utils', 'avatar-catalog.ts');
const backgrounds = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c1f0d0', 'fde68a', 'a7f3d0'];
const AVATARS_TOTAL = 69;
const styles = [
  { key: 'openPeeps', label: 'Open Peeps', style: openPeeps, count: 10, names: ['Marina Raio de Sol', 'Bento Pé de Vento', 'Lia Jardim Azul', 'Caio Horizonte', 'Nina Folha Serena', 'Theo Nuvem Boa', 'Bia Riso Leve', 'Ravi Caminho Claro', 'Cora Brisa Mansa', 'Davi Ponto de Luz'] },
  { key: 'micah', label: 'Micah', style: micah, count: 8, names: ['Malu Cacto Feliz', 'Noah Céu de Algodão', 'Iara Cor de Mel', 'Luca Vaga-Lume', 'Tainá Manhã Clara', 'Ícaro Sol de Inverno', 'Jade Pétala Viva', 'Téo Maré Mansa'] },
  { key: 'adventurer', label: 'Adventurer', style: adventurer, count: 8, names: ['Ayla Passo Valente', 'Breno Trilha Doce', 'Maya Estrela Guia', 'Nilo Pé na Estrada', 'Sofia Vento Norte', 'Gael Rumo Livre', 'Luma Mochila Solar', 'Enzo Pico Azul'] },
  { key: 'toonHead', label: 'Toon Head', style: toonHead, count: 6, names: ['Pipa Girassol', 'Zeca Rabisco', 'Tuti Balão Roxo', 'Mimi Confete', 'Beto Giz de Cera', 'Lolo Lua Nova'] },
  { key: 'bigSmile', label: 'Big Smile', style: bigSmile, count: 6, names: ['Rosa Gargalhada', 'Tito Sorriso Largo', 'Duda Alegria', 'Kiko Bom Humor', 'Lara Risada Solta', 'Joca Céu Aberto'] },
  { key: 'avataaars', label: 'Avataaars', style: avataaars, count: 4, names: ['Mila Coragem', 'Otto Sereno', 'Lena Horizonte Rosa', 'Pablo Café Quente'] },
  { key: 'lorelei', label: 'Lorelei', style: lorelei, count: 4, names: ['Íris Pétala', 'Cecília Aurora', 'Amora Calmaria', 'Elisa Maré Azul'] },
  { key: 'notionists', label: 'Notionists', style: notionists, count: 4, names: ['Rui Ideia Boa', 'Bela Linha Fina', 'Sami Plano Leve', 'Nara Lista Feliz'] },
  { key: 'bottts', label: 'Bottts', style: bottts, count: 6, names: ['Robô Zen', 'Pixelzinho', 'Byte Brilhante', 'Nuvem Binária', 'Circuito Doce', 'Turbina Tranquila'] },
  { key: 'pixelArt', label: 'Pixel Art', style: pixelArt, count: 4, names: ['Capitão Pixel', 'Nina 8-Bits', 'Mestre Quadradinho', 'Luz de Arcade'] },
  { key: 'funEmoji', label: 'Fun Emoji', style: funEmoji, count: 4, names: ['Pudim Sorridente', 'Bolinha Feliz', 'Chamego Colorido', 'Pipoca Estelar'] },
];
const legendary = [
  { id: 'av-65', nome: 'Relógio Raiz', source: '../assets/images/mascot/clock-base.png', unlock: { tipo: 'ciclos', valor: 1 } },
  { id: 'av-66', nome: 'Relógio Carnavalesco', source: '../assets/images/mascot/clock-carnival.png', unlock: { tipo: 'puzzles', valor: 1 } },
  { id: 'av-67', nome: 'Relógio Junino', source: '../assets/images/mascot/clock-junina.png', unlock: { tipo: 'ciclos', valor: 3 } },
  { id: 'av-68', nome: 'Relógio Natalino', source: '../assets/images/mascot/clock-christmas.png', unlock: { tipo: 'puzzles', valor: 2 } },
  { id: 'av-69', nome: 'Relógio Ano Novo', source: '../assets/images/mascot/clock-newyear.png', unlock: { tipo: 'ciclos', valor: 5 } },
];

function rarityFor(index) {
  if (index < 24) return 'comum';
  if (index < 46) return 'raro';
  return 'epico';
}
function unlockFor(index) {
  if (index < 24) return { tipo: 'pecas', valor: 1 + 6 * index };
  if (index < 46) return { tipo: 'pecas', valor: 139 + 12 * (index - 24 + 1) };
  return { tipo: 'pecas', valor: 403 + 16 * (index - 46 + 1) };
}
function funEmojiOptions() {
  return { mouth: ['cute', 'lilSmile', 'smileLol', 'smileTeeth', 'tongueOut', 'wideSmile', 'kissHeart'], eyes: ['closed', 'closed2', 'cute', 'glasses', 'love', 'plain', 'shades', 'stars', 'wink', 'wink2'] };
}
function catalogEntry(id, nome, raridade, source, unlock) {
  return `  { id: '${id}', nome: '${nome}', raridade: '${raridade}', source: require('${source}'), unlock: { tipo: '${unlock.tipo}', valor: ${unlock.valor} } },`;
}

await mkdir(outputDir, { recursive: true });
const generated = [];
for (let round = 0; round < Math.max(...styles.map((item) => item.count)); round += 1) {
  for (const item of styles) {
    if (round >= item.count) continue;
    generated.push({ ...item, seed: `op${round}`, nome: item.names[round] });
  }
}
if (generated.length !== 64) throw new Error(`Esperados 64 avatares, gerados ${generated.length}`);
for (const [index, item] of generated.entries()) {
  const id = `av-${String(index + 1).padStart(2, '0')}`;
  const options = { seed: [item.seed], size: 256, backgroundColor: [backgrounds[index % backgrounds.length]], ...(item.key === 'funEmoji' ? funEmojiOptions() : {}) };
  const svg = createAvatar(item.style, options).toString();
  await sharp(Buffer.from(svg)).resize(256, 256).webp({ quality: 82 }).toFile(path.join(outputDir, `${id}.webp`));
}

const entries = generated.map((item, index) => catalogEntry(`av-${String(index + 1).padStart(2, '0')}`, item.nome, rarityFor(index), `../assets/avatares/av-${String(index + 1).padStart(2, '0')}.webp`, unlockFor(index)));
for (const item of legendary) entries.push(catalogEntry(item.id, item.nome, 'lendario', item.source, item.unlock));
const catalog = `/* Gerado por scripts/gerar-avatares.mjs. Não edite manualmente. */
export { isUnlocked } from './avatar-unlock';
export type AvatarRarity = 'comum' | 'raro' | 'epico' | 'lendario';
export type AvatarUnlock = { tipo: 'pecas' | 'ciclos' | 'puzzles'; valor: number };
export type Avatar = { id: string; nome: string; raridade: AvatarRarity; source: number; unlock: AvatarUnlock };
export type AvatarProgress = { pecas: number; ciclos: number; puzzles: number };

export const AVATARS: Avatar[] = [
${entries.join('\n')}
];

export function getAvatar(id: string): Avatar | undefined {
  return AVATARS.find((avatar) => avatar.id === id);
}

`;
await writeFile(catalogPath, catalog);
console.log(`Gerados ${generated.length} avatares DiceBear e catálogo com ${AVATARS_TOTAL} entradas.`);
