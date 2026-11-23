type Counter = { count: number; windowStartedAt: number };

const requests = new Map<string, Counter>();
let homeRenders = 0;
let reportTimer: ReturnType<typeof setInterval> | null = null;

function enabled() { return typeof __DEV__ !== 'undefined' && __DEV__; }

export function recordSupabaseRequest(url: string) {
  if (!enabled()) return;
  const table = url.match(/\/rest\/v1\/([^?]+)/)?.[1] ?? 'unknown';
  const current = requests.get(table) ?? { count: 0, windowStartedAt: Date.now() };
  current.count += 1;
  requests.set(table, current);
  startReporter();
}

export function recordHomeRender() {
  if (!enabled()) return;
  homeRenders += 1;
  startReporter();
}

function startReporter() {
  if (reportTimer) return;
  reportTimer = setInterval(() => {
    const now = Date.now();
    const tableCounts = [...requests.entries()].map(([table, value]) => `${table}=${value.count}`).join(', ');
    console.debug(`[perf] requests/min ${tableCounts || 'nenhuma'}; Home renders/min ${homeRenders}`);
    requests.clear();
    homeRenders = 0;
  }, 60_000);
}
