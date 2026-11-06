import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

export type AlertLevel = '8h' | '9h' | '9h30' | '9h45' | '9h50' | '10h';
export type Charge = { id: string; level: AlertLevel; caption: string; scene: string };

export const chargeCatalog: Charge[] = [
  { id: 'dev-coffee', level: '8h', caption: 'Jornada regular concluída. Planeje sua saída.', scene: 'dev' },
  { id: 'cool-coffee', level: '8h', caption: 'Oito horas registradas. Acompanhe o tempo adicional.', scene: 'coffee' },
  { id: 'cat-keyboard', level: '8h', caption: 'Lembrete: a jornada entrou no período de hora extra.', scene: 'cat' },
  { id: 'bug-server', level: '9h', caption: 'Você está em hora extra. Acompanhe o limite.', scene: 'server' },
  { id: 'battery', level: '9h', caption: 'Falta uma hora para o limite diário.', scene: 'battery' },
  { id: 'hourglass', level: '9h', caption: 'Organize o encerramento da jornada.', scene: 'hourglass' },
  { id: 'chasing-clock', level: '9h30', caption: 'Faltam 30 minutos para o limite diário.', scene: 'chase' },
  { id: 'roots-chair', level: '9h30', caption: 'Revise as atividades e prepare a saída.', scene: 'roots' },
  { id: 'traffic-light', level: '9h30', caption: 'Acompanhe o contador para encerrar a tempo.', scene: 'traffic' },
  { id: 'rocket-home', level: '9h45', caption: 'Faltam 15 minutos. Finalize o que for possível.', scene: 'rocket' },
  { id: 'go-home-sign', level: '9h45', caption: 'Prepare-se para registrar a saída dentro do limite.', scene: 'sign' },
  { id: 'bus-leaving', level: '9h45', caption: 'O limite está próximo. Conclua a jornada em breve.', scene: 'bus' },
  { id: 'robot-boss', level: '9h50', caption: 'Faltam 10 minutos. Encerre as atividades.', scene: 'robot' },
  { id: 'alarm-clock', level: '9h50', caption: 'Atenção: o limite diário está a 10 minutos.', scene: 'alarm' },
  { id: 'melting-dev', level: '9h50', caption: 'Registre a saída assim que concluir as atividades.', scene: 'meltdown' },
  { id: 'pizza-sofa', level: '10h', caption: 'Limite diário alcançado. Registre a saída.', scene: 'pizza' },
  { id: 'fire-server', level: '10h', caption: 'O teto da jornada foi atingido. Pare e registre a saída.', scene: 'fire' },
  { id: 'clock-champion', level: '10h', caption: 'Jornada no limite. A saída deve ser registrada agora.', scene: 'champion' },
];
export const charges = chargeCatalog;
export const captions = chargeCatalog.reduce<Record<string, string>>((all, charge) => { all[charge.id] = charge.caption; return all; }, {});

export function chooseCharge(level: AlertLevel, previousId?: string): Charge {
  const options = chargeCatalog.filter((charge) => charge.level === level);
  const alternatives = options.filter((charge) => charge.id !== previousId);
  const pool = alternatives.length ? alternatives : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

const palette = { ink: '#123E48', teal: '#12A99A', pale: '#DDF5EF', yellow: '#FFD45A', coral: '#F47767', white: '#FFFFFF', dark: '#16323B' };
const levelRank: Record<AlertLevel, number> = { '8h': 0, '9h': 1, '9h30': 2, '9h45': 3, '9h50': 4, '10h': 5 };

function Face({ x = 50, y = 43, worried = false }: { x?: number; y?: number; worried?: boolean }) {
  return <G><Circle cx={x - 7} cy={y} r="1.8" fill={palette.ink} /><Circle cx={x + 7} cy={y} r="1.8" fill={palette.ink} /><Path d={worried ? `M${x - 5} ${y + 9} Q${x} ${y + 3} ${x + 5} ${y + 9}` : `M${x - 5} ${y + 6} Q${x} ${y + 12} ${x + 5} ${y + 6}`} fill="none" stroke={palette.ink} strokeWidth="2" strokeLinecap="round" /></G>;
}
function Clock({ x = 50, y = 48, r = 27, urgent = false }: { x?: number; y?: number; r?: number; urgent?: boolean }) {
  return <G><Circle cx={x} cy={y} r={r} fill={palette.white} stroke={palette.ink} strokeWidth="4" /><Path d={`M${x} ${y - r + 8} V${y} L${x + 10} ${y + 7}`} fill="none" stroke={palette.ink} strokeWidth="3" strokeLinecap="round" /><Face x={x} y={y + 8} worried={urgent} /><Rect x={x - 10} y={y - r - 7} width="20" height="7" rx="3" fill={palette.coral} /></G>;
}
function Illustration({ scene }: { scene: string }) {
  const base = <><Rect x="8" y="104" width="104" height="8" rx="4" fill={palette.pale} /><Circle cx="100" cy="16" r="8" fill={palette.yellow} /></>;
  switch (scene) {
    case 'dev': return <>{base}<Rect x="17" y="69" width="50" height="32" rx="4" fill={palette.ink} /><Rect x="21" y="73" width="42" height="23" rx="2" fill={palette.pale} /><Path d="M27 80h12m-12 5h24m-24 5h16" stroke={palette.teal} strokeWidth="2" /><Circle cx="83" cy="67" r="16" fill={palette.yellow} /><Path d="M74 83h18l5 18H69z" fill={palette.coral} /><Path d="M77 56q6-9 12 0" fill="none" stroke={palette.ink} strokeWidth="3" /><Circle cx="86" cy="66" r="2" fill={palette.ink} /></>;
    case 'coffee': return <>{base}<Path d="M31 54h42v38q-21 10-42 0z" fill={palette.white} stroke={palette.ink} strokeWidth="3" /><Path d="M73 62h10q10 15-10 17" fill="none" stroke={palette.ink} strokeWidth="3" /><Path d="M40 49q-4-7 1-12m14 12q-4-7 1-12" fill="none" stroke={palette.coral} strokeWidth="2" /><Path d="M42 81h22" stroke={palette.teal} strokeWidth="4" /><Clock x={91} y={75} r={12} /></>;
    case 'cat': return <>{base}<Path d="M36 53 34 32l17 12 18-12-2 23q10 17-3 31H42Q29 70 36 53" fill={palette.coral} stroke={palette.ink} strokeWidth="3" /><Face x={52} y={59} /><Path d="M43 63 27 60m17 8-16 3m37-8 16-4m-16 9 16 3" stroke={palette.ink} strokeWidth="1.5" /><Rect x="20" y="87" width="69" height="11" rx="3" fill={palette.ink} /><Path d="M31 91h8m7 0h8m7 0h8m7 0h8" stroke={palette.yellow} strokeWidth="2" /></>;
    case 'server': case 'fire': return <>{base}<Rect x="24" y="26" width="59" height="69" rx="7" fill={palette.ink} /><Rect x="31" y="34" width="45" height="17" rx="3" fill={palette.pale} /><Rect x="31" y="57" width="45" height="17" rx="3" fill={palette.pale} /><Circle cx="39" cy="42" r="3" fill={palette.teal} /><Circle cx="39" cy="65" r="3" fill={palette.coral} /><Path d="M48 42h21M48 65h21" stroke={palette.ink} strokeWidth="2" />{scene === 'fire' ? <><Path d="M21 30q-13-12 0-22 1 9 8 10 9-11 8-17 17 19 2 29" fill={palette.coral} /><Path d="M80 31q-5-12 3-18 1 7 6 8 6-8 5-13 14 19-3 27" fill={palette.yellow} /></> : <Path d="M89 37l-7 11h8l-7 11 16-15h-9l7-7z" fill={palette.yellow} />}</>;
    case 'battery': return <>{base}<Rect x="28" y="39" width="65" height="37" rx="6" fill={palette.white} stroke={palette.ink} strokeWidth="4" /><Rect x="93" y="49" width="7" height="17" rx="2" fill={palette.ink} /><Rect x="34" y="45" width="13" height="25" rx="2" fill={palette.coral} /><Path d="M61 48l-8 12h8l-4 9 14-15h-8l4-6z" fill={palette.yellow} /><Face x={50} y={91} worried /></>;
    case 'hourglass': return <>{base}<Path d="M38 25h45M38 96h45M42 27q0 16 19 32Q42 76 42 94m37-67q0 16-18 32 18 17 18 35" fill="none" stroke={palette.ink} strokeWidth="4" /><Path d="M48 32h25q-2 10-12 19-10-9-13-19m0 54h25Q61 74 61 74 51 82 48 86" fill={palette.yellow} /><Path d="M61 54v14" stroke={palette.coral} strokeWidth="3" /></>;
    case 'chase': return <>{base}<Clock x={35} y={63} r={22} urgent /><Path d="M61 79q21-8 24-28" fill="none" stroke={palette.coral} strokeWidth="3" strokeDasharray="4 4" /><Path d="M81 52l6-5 2 8" fill="none" stroke={palette.coral} strokeWidth="3" /><Path d="M83 76l12-9m-9 15 14-4" stroke={palette.ink} strokeWidth="2" /></>;
    case 'roots': return <>{base}<Path d="M34 40h50v31H34z" fill={palette.coral} stroke={palette.ink} strokeWidth="3" /><Path d="M40 71v13m38-13v13M36 86h46" stroke={palette.ink} strokeWidth="4" /><Path d="M43 86q-9 9 0 15m11-15q-8 11 1 15m12-15q10 8 2 15m10-15q9 10 0 15" fill="none" stroke={palette.teal} strokeWidth="3" /><Face x={59} y={53} worried /></>;
    case 'traffic': return <>{base}<Rect x="39" y="20" width="39" height="77" rx="12" fill={palette.ink} /><Circle cx="58" cy="39" r="10" fill={palette.coral} opacity=".5" /><Circle cx="58" cy="59" r="10" fill={palette.yellow} opacity=".5" /><Circle cx="58" cy="79" r="10" fill={palette.teal} /><Path d="M91 78h13m-7-7 7 7-7 7" fill="none" stroke={palette.teal} strokeWidth="3" /></>;
    case 'rocket': return <>{base}<Path d="M61 21q25 11 16 48l-16 18-16-18Q36 32 61 21" fill={palette.white} stroke={palette.ink} strokeWidth="3" /><Circle cx="61" cy="51" r="8" fill={palette.teal} stroke={palette.ink} strokeWidth="2" /><Path d="M46 61 31 74l14 2m31-15 15 13-15 2M53 84l8 15 8-15" fill={palette.coral} stroke={palette.ink} strokeWidth="2" /><Path d="M56 91l5 10 5-10" fill={palette.yellow} /></>;
    case 'sign': return <>{base}<Path d="M61 32v65m-15 0h30" stroke={palette.ink} strokeWidth="5" /><Rect x="19" y="28" width="84" height="43" rx="7" fill={palette.yellow} stroke={palette.ink} strokeWidth="3" /><SvgText x="61" y="46" fontSize="9" fontWeight="bold" textAnchor="middle" fill={palette.ink}>HORA DE</SvgText><SvgText x="61" y="60" fontSize="12" fontWeight="bold" textAnchor="middle" fill={palette.ink}>IR!</SvgText><Face x={60} y={86} /></>;
    case 'bus': return <>{base}<Rect x="16" y="38" width="90" height="49" rx="12" fill={palette.yellow} stroke={palette.ink} strokeWidth="3" /><Rect x="24" y="46" width="22" height="17" rx="3" fill={palette.pale} /><Rect x="51" y="46" width="22" height="17" rx="3" fill={palette.pale} /><Rect x="78" y="46" width="20" height="17" rx="3" fill={palette.pale} /><Circle cx="36" cy="88" r="8" fill={palette.ink} /><Circle cx="87" cy="88" r="8" fill={palette.ink} /><Path d="M19 32h72" stroke={palette.coral} strokeWidth="3" strokeDasharray="4 5" /></>;
    case 'robot': return <>{base}<Rect x="29" y="34" width="64" height="53" rx="12" fill={palette.teal} stroke={palette.ink} strokeWidth="3" /><Rect x="40" y="43" width="42" height="23" rx="5" fill={palette.pale} /><Circle cx="51" cy="53" r="3" fill={palette.ink} /><Circle cx="70" cy="53" r="3" fill={palette.ink} /><Path d="M51 60h19M61 34V23m-7 0h14M29 51H19m74 0h10" stroke={palette.ink} strokeWidth="3" /><Rect x="17" y="89" width="88" height="17" rx="4" fill={palette.coral} /><SvgText x="61" y="101" textAnchor="middle" fontSize="10" fontWeight="bold" fill={palette.white}>VAI PRA CASA!</SvgText></>;
    case 'alarm': return <>{base}<Path d="M34 35q-4-12 5-17l12 13m27 4q4-12-5-17L61 31" fill={palette.coral} stroke={palette.ink} strokeWidth="3" /><Circle cx="60" cy="62" r="31" fill={palette.yellow} stroke={palette.ink} strokeWidth="4" /><Clock x={60} y={62} r={22} urgent /><Path d="M26 35 17 29m78 6 9-6m-78 51-8 7m79-7 8 7" stroke={palette.coral} strokeWidth="3" /></>;
    case 'meltdown': return <>{base}<Rect x="30" y="37" width="62" height="45" rx="5" fill={palette.ink} /><Rect x="35" y="42" width="52" height="31" rx="3" fill={palette.pale} /><Path d="M41 49h28m-28 7h35m-35 7h21" stroke={palette.coral} strokeWidth="2" /><Path d="M40 82q-6 8 0 12t0 9m21-21q-6 8 0 12t0 9m20-21q-6 8 0 12t0 9" fill="none" stroke={palette.teal} strokeWidth="4" /><Face x={62} y={27} worried /></>;
    case 'pizza': return <>{base}<Path d="M23 37 92 24 66 94z" fill={palette.yellow} stroke={palette.ink} strokeWidth="3" /><Path d="M29 41 85 30 64 84z" fill={palette.coral} /><Circle cx="51" cy="51" r="4" fill={palette.white} /><Circle cx="68" cy="45" r="4" fill={palette.white} /><Circle cx="58" cy="68" r="4" fill={palette.white} /><Path d="M78 82q15-13 28 0v17H75z" fill={palette.teal} stroke={palette.ink} strokeWidth="3" /><Face x={91} y={88} /></>;
    case 'champion': return <>{base}<Clock x={59} y={58} r={25} /><Path d="m40 27-13-12-2 25m56-13 13-12 2 25" fill={palette.yellow} stroke={palette.ink} strokeWidth="3" /><Path d="m22 31 9 3m57-3-9 3" stroke={palette.coral} strokeWidth="3" /><Path d="m61 20 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill={palette.yellow} stroke={palette.ink} strokeWidth="2" /><SvgText x="61" y="106" textAnchor="middle" fontSize="9" fontWeight="bold" fill={palette.ink}>GG, EXPEDIENTE!</SvgText></>;
    default: return <>{base}<Clock urgent /></>;
  }
}

export function ChargeIllustration({ chargeId, size = 240 }: { chargeId: string; size?: number }) {
  const charge = chargeCatalog.find((item) => item.id === chargeId) ?? chargeCatalog[0];
  const intensity = levelRank[charge.level];
  const motion = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || intensity === 0) { motion.value = 0; return; }
    const duration = Math.max(1100, 1700 - intensity * 90);
    motion.value = withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => { motion.value = 0; };
  }, [intensity, motion, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion || intensity === 0) return {};
    const amount = intensity >= 4 ? 0.8 : intensity >= 2 ? 0.55 : 0.3;
    return { transform: [{ translateY: motion.value * amount }] };
  }, [intensity, reduceMotion]);
  const style: ViewStyle = { width: size, height: size, alignItems: 'center', justifyContent: 'center' };
  return <View accessible accessibilityRole="image" accessibilityLabel={charge.caption} style={style}><Animated.View style={animatedStyle}><Svg width={size} height={size} viewBox="0 0 120 120"><Illustration scene={charge.scene} /></Svg></Animated.View></View>;
}

export default ChargeIllustration;
