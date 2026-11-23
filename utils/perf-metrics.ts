type Counter = { count: number; windowStartedAt: number };

const requests = new Map<string, Counter>();
const responseTimes = new Map<string, number[]>();
let homeRenders = 0;
let authSessionCalls = 0;
let cacheFirstCount = 0;
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

export function recordSupabaseResponse(url: string, elapsedMs: number) {
  if (!enabled()) return;
  const table = url.match(/\/rest\/v1\/([^?]+)/)?.[1] ?? 'unknown';
  responseTimes.set(table, [...(responseTimes.get(table) ?? []), Math.round(elapsedMs)]);
  startReporter();
}

export function recordAuthSessionCall() {
  if (!enabled()) return;
  authSessionCalls += 1;
  startReporter();
}

export function recordCacheFirst() {
  if (!enabled()) return;
  cacheFirstCount += 1;
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
    const tableCounts = [...requests.entries()].map(([table, value]) => `${table}=${value.count}`).join(', ');
    const timings = [...responseTimes.entries()].map(([table, values]) => {
      const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      return `${table}=${average}ms`;
    }).join(', ');
    console.debug(`[perf] requests/min ${tableCounts || 'nenhuma'}; network avg ${timings || 'nenhuma'}; getSession/min ${authSessionCalls}; cache-first/min ${cacheFirstCount}; Home renders/min ${homeRenders}`);
    requests.clear();
    responseTimes.clear();
    authSessionCalls = 0;
    cacheFirstCount = 0;
    homeRenders = 0;
  }, 60_000);
}
