import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

export const SCENE_W = 360;
export const SCENE_H = 740;
export const STONES = [
  { x: 180, y: 655 }, { x: 98, y: 572 }, { x: 252, y: 490 }, { x: 116, y: 405 },
  { x: 246, y: 322 }, { x: 128, y: 245 }, { x: 214, y: 178 },
];
const GREENS = ['#B7F28F', '#34A853'];
const g = (id: string, a: string, b: string, v = true) => (
  <LinearGradient id={id} x1="0" y1="0" x2={v ? '0' : '1'} y2={v ? '1' : '0'}><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient>
);

function Bamboo({ x, y, h, s = 1 }: { x: number; y: number; h: number; s?: number }) {
  const nodes = Array.from({ length: Math.floor(h / 34) }, (_, i) => y + 30 + i * 34);
  return <G>
    <Rect x={x} y={y} width={11 * s} height={h} rx={5} fill="url(#bam)" stroke="#2F7A3A" strokeWidth={1.5} />
    {nodes.map((ny) => <Rect key={ny} x={x - 1} y={ny} width={13 * s} height={4} rx={2} fill="#2F7A3A" />)}
    <Path d={`M${x + 6} ${y + 52} Q${x + 40} ${y + 30} ${x + 62} ${y + 54} Q${x + 36} ${y + 60} ${x + 6} ${y + 52}Z M${x + 5} ${y + 92} Q${x - 28} ${y + 70} ${x - 52} ${y + 96} Q${x - 26} ${y + 104} ${x + 5} ${y + 92}Z`} fill="#56B947" stroke="#2F7A3A" strokeWidth={1.2} />
  </G>;
}

function Drum({ n, x, y, state }: { n: number; x: number; y: number; state: 'done' | 'now' | 'next' }) {
  const body = state === 'done' ? 'url(#dDone)' : state === 'now' ? 'url(#dNow)' : 'url(#dNext)';
  return <G opacity={state === 'next' ? 0.78 : 1}>
    <Ellipse cx={x} cy={y + 32} rx={44} ry={12} fill="#FFFFFF" opacity={0.22} />
    <Ellipse cx={x} cy={y + 32} rx={34} ry={8} fill="none" stroke="#FFFFFF" strokeWidth={2} opacity={0.4} />
    <Path d={`M${x - 27} ${y - 8} L${x - 27} ${y + 22} Q${x} ${y + 38} ${x + 27} ${y + 22} L${x + 27} ${y - 8}Z`} fill={body} stroke={state === 'now' ? '#F7C948' : '#1F6B46'} strokeWidth={state === 'now' ? 3.5 : 2.5} />
    <Path d={`M${x - 27} ${y + 4} Q${x} ${y + 17} ${x + 27} ${y + 4} M${x - 27} ${y + 15} Q${x} ${y + 28} ${x + 27} ${y + 15}`} fill="none" stroke="#DDB67C" strokeWidth={4.5} strokeLinecap="round" />
    <Ellipse cx={x} cy={y - 8} rx={28} ry={11} fill="#F8EDD3" stroke="#CDB78A" strokeWidth={2} />
    <Ellipse cx={x - 3} cy={y - 10} rx={17} ry={5} fill="#FFFFFF" opacity={0.6} />
    <Circle cx={x} cy={y + 12} r={11.5} fill={state === 'done' ? '#F7C948' : '#B7793F'} stroke="#FFF1C2" strokeWidth={2.5} />
    {state === 'done'
      ? <Path d={`M${x - 5} ${y + 12} L${x - 1} ${y + 16.5} L${x + 6} ${y + 7}`} fill="none" stroke="#7A4B12" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      : <SvgText x={x} y={y + 17} fontSize={14} fontWeight="bold" fill="#FFF8E6" textAnchor="middle">{n}</SvgText>}
  </G>;
}

function Gift({ x, y, w, h, c, r }: { x: number; y: number; w: number; h: number; c: string; r: string }) {
  return <G>
    <Rect x={x} y={y} width={w} height={h} rx={4} fill={c} stroke="#00000033" strokeWidth={1.5} />
    <Rect x={x + w / 2 - 4} y={y} width={8} height={h} fill={r} />
    <Rect x={x} y={y + h / 2 - 4} width={w} height={8} fill={r} opacity={0.9} />
    <Path d={`M${x + w / 2} ${y} q-14 -14 -16 -2 q8 8 16 2 q8 6 16 -2 q-2 -12 -16 2z`} fill={r} stroke="#00000022" strokeWidth={1} />
  </G>;
}

export function SceneArt({ step, completed }: { step: number; completed: boolean }) {
  const cur = completed ? 7 : step;
  const stateOf = (i: number) => (i < step || completed ? 'done' : i === cur ? 'now' : 'next') as 'done' | 'now' | 'next';
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => `Q${(a.x + b.x) / 2 + (a.x > b.x ? 22 : -22)} ${(a.y + b.y) / 2} ${b.x} ${b.y + 12}`;
  const seg = (i: number) => `M${STONES[i].x} ${STONES[i].y + 12} ${mid(STONES[i], STONES[i + 1])}`;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid meet">
      <Defs>
        {g('water', '#8CF0E4', '#0A78A8')}
        {g('bank', '#C9F0A0', '#3F9A5E', false)}
        {g('bam', '#A9E07A', '#4C9A3C', false)}
        {g('dDone', GREENS[0], GREENS[1])}
        {g('dNow', '#E6FF8A', '#6FCF3C')}
        {g('dNext', '#A9C9CC', '#5D8794')}
        {g('wood', '#F0B85A', '#B7742A')}
        <RadialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><Stop offset="0" stopColor="#FFE9A0" stopOpacity={0.95} /><Stop offset="1" stopColor="#FFE9A0" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="sun" cx="0.5" cy="0" r="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></RadialGradient>
      </Defs>
      <Rect width={SCENE_W} height={SCENE_H} fill="url(#water)" />
      <Rect width={SCENE_W} height={330} fill="url(#sun)" />
      <G fill="none" stroke="#E8FFFF" strokeWidth={2.5} opacity={0.3} strokeLinecap="round">
        <Path d="M30 120 q40 -14 80 0 t80 0 t80 0" /><Path d="M20 262 q40 -14 80 0 t80 0 t90 0" />
        <Path d="M40 400 q40 -14 80 0 t80 0 t80 0" /><Path d="M16 545 q40 -14 80 0 t80 0 t90 0" /><Path d="M60 700 q40 -14 80 0 t80 0 t60 0" />
      </G>
      <G fill="#FFFFFF" opacity={0.7}>{[[70, 205, 2.5], [300, 150, 2], [40, 330, 2], [320, 440, 2.5], [210, 600, 2], [330, 640, 2], [60, 690, 2.5], [160, 120, 2]].map(([cx, cy, r], i) => <Circle key={i} cx={cx} cy={cy} r={r} />)}</G>
      <Path d="M0 0 L66 0 C44 90 88 170 44 260 C14 330 62 392 26 470 C0 530 42 610 0 740Z" fill="url(#bank)" stroke="#2F7A3A" strokeWidth={3} />
      <Path d="M360 0 L292 0 C318 96 272 176 320 266 C350 330 300 396 336 474 C360 534 320 612 360 740Z" fill="url(#bank)" stroke="#2F7A3A" strokeWidth={3} />
      <Bamboo x={12} y={96} h={170} /><Bamboo x={34} y={150} h={120} s={0.9} /><Bamboo x={338} y={110} h={170} /><Bamboo x={316} y={170} h={110} s={0.9} />
      <Bamboo x={10} y={500} h={190} /><Bamboo x={340} y={520} h={170} />
      <G>
        <Ellipse cx={78} cy={470} rx={22} ry={7} fill="#4DB04F" stroke="#2F7A3A" strokeWidth={1.5} /><Circle cx={80} cy={466} r={5} fill="#FF9EC4" />
        <Ellipse cx={296} cy={398} rx={22} ry={7} fill="#4DB04F" stroke="#2F7A3A" strokeWidth={1.5} /><Circle cx={298} cy={394} r={5} fill="#FFFFFF" />
        <Ellipse cx={300} cy={610} rx={20} ry={6} fill="#4DB04F" stroke="#2F7A3A" strokeWidth={1.5} /><Circle cx={302} cy={606} r={5} fill="#FF9EC4" />
      </G>
      {STONES.slice(0, -1).map((_, i) => <Path key={`l${i}`} d={seg(i)} fill="none" stroke={i < step || completed ? '#FFD45E' : '#FFFFFF'} strokeWidth={i < step || completed ? 4 : 3} strokeDasharray={i < step || completed ? undefined : '2 9'} strokeLinecap="round" opacity={i < step || completed ? 0.95 : 0.7} />)}
      <Path d={`M${STONES[6].x} ${STONES[6].y + 12} Q${STONES[6].x} 150 180 128`} fill="none" stroke={completed ? '#FFD45E' : '#FFFFFF'} strokeWidth={3} strokeDasharray={completed ? undefined : '2 9'} strokeLinecap="round" opacity={0.8} />
      <G>
        <Circle cx={180} cy={62} r={118} fill="url(#glow)" />
        <Ellipse cx={180} cy={104} rx={128} ry={34} fill="#9A5B22" /><Ellipse cx={180} cy={98} rx={128} ry={32} fill="url(#wood)" stroke="#7A4515" strokeWidth={3} />
        <Path d="M70 98 q110 28 220 0 M92 80 q88 22 176 0" fill="none" stroke="#7A4515" strokeWidth={2} opacity={0.5} />
        {[64, 296].map((px) => <G key={px}><Rect x={px - 7} y={44} width={14} height={60} rx={4} fill="#D63B2F" stroke="#7B1F18" strokeWidth={2} /><Circle cx={px} cy={44} r={9} fill="#F7C948" stroke="#7A4B12" strokeWidth={2} /></G>)}
        <Path d="M64 58 Q180 86 296 58" fill="none" stroke="#D63B2F" strokeWidth={6} strokeLinecap="round" />
        <Gift x={126} y={46} w={50} h={42} c="#E5483C" r="#FFD45E" /><Gift x={176} y={52} w={44} h={36} c="#4C9BE8" r="#FFFFFF" /><Gift x={104} y={62} w={32} h={28} c="#58B368" r="#FFE8A0" />
        {[[232, 86], [246, 92], [150, 94], [268, 88]].map(([cx, cy], i) => <G key={i}><Circle cx={cx} cy={cy} r={9} fill="#F7C948" stroke="#9A6A12" strokeWidth={2} /><Path d={`M${cx - 3} ${cy - 3} L${cx + 3} ${cy + 3} M${cx + 3} ${cy - 3} L${cx - 3} ${cy + 3}`} stroke="#9A6A12" strokeWidth={1.8} /></G>)}
        <Rect x={72} y={116} width={216} height={34} rx={17} fill="#6B3E2B" stroke="#F4D28C" strokeWidth={3} />
        <SvgText x={180} y={129} fontSize={11} fontWeight="bold" fill="#FFE9A8" textAnchor="middle">GRANDE RECOMPENSA</SvgText>
        <SvgText x={180} y={143} fontSize={11} fill="#FFFFFF" textAnchor="middle">1 peça bônus no quebra-cabeça</SvgText>
      </G>
      {STONES.map((s, i) => <Drum key={i} n={i + 1} x={s.x} y={s.y} state={stateOf(i)} />)}
    </Svg>
  );
}
