'use client';

/**
 * TEMPORARY diagnostics probe for the "every ~60s the page reloads" bug.
 *
 * Reloads wipe the JS context and the console, so this writes a ring-buffer log
 * to localStorage that SURVIVES reloads, plus a small on-screen overlay with a
 * "Copy" button. The goal is to capture *what* triggers each reload:
 *   - navigation type of each load (reload / navigate / back_forward)
 *   - redirectCount + Clerk handshake markers (points at a Clerk re-auth bounce)
 *   - Clerk session-listener fires (to correlate with the token-refresh cadence)
 *   - a stack trace whenever something calls location.reload()/assign()/replace()
 *   - page lifetime + the gap between instances (how long each page lived)
 *
 * Remove this component (and its mount in app/layout.tsx) once the cause is found.
 */

import { useEffect, useRef, useState } from 'react';

const LS_LOG = 'pc:diag:log';
const LS_START = 'pc:diag:pageStart';
const LS_BEAT = 'pc:diag:lastBeat';
const SS_LOADS = 'pc:diag:loadCount';
const MAX_ENTRIES = 400;

type Entry = { t: number; iso: string; ev: string; data?: unknown };

function now() {
  // Date.now via performance origin to avoid relying on wall clock alone.
  return Date.now();
}

function readLog(): Entry[] {
  try {
    const raw = localStorage.getItem(LS_LOG);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries: Entry[]) {
  try {
    localStorage.setItem(LS_LOG, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // storage full / unavailable — drop silently
  }
}

function record(ev: string, data?: unknown) {
  const t = now();
  const entry: Entry = { t, iso: new Date(t).toISOString(), ev, data };
  const log = readLog();
  log.push(entry);
  writeLog(log);
  // Also echo to console for anyone watching with "Preserve log" on.
  // eslint-disable-next-line no-console
  console.log(`%c[pc-diag] ${ev}`, 'color:#0a7', data ?? '');
  return entry;
}

export function DiagnosticsProbe() {
  const [open, setOpen] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [tick, setTick] = useState(0); // forces overlay re-read of the log
  const startedRef = useRef<number>(0);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const startedAt = now();
    startedRef.current = startedAt;

    // --- Reconstruct what happened to the PREVIOUS page instance ---
    let priorLifetimeMs: number | null = null;
    let gapMs: number | null = null;
    try {
      const prevStart = Number(localStorage.getItem(LS_START) || 0);
      const prevBeat = Number(localStorage.getItem(LS_BEAT) || 0);
      if (prevStart) priorLifetimeMs = prevBeat ? prevBeat - prevStart : null;
      if (prevBeat) gapMs = startedAt - prevBeat;
    } catch {
      /* ignore */
    }

    // --- Navigation Timing: how did THIS load happen? ---
    let navType = 'unknown';
    let redirectCount = 0;
    try {
      const navEntry = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming | undefined;
      if (navEntry) {
        navType = navEntry.type; // 'reload' | 'navigate' | 'back_forward' | 'prerender'
        redirectCount = navEntry.redirectCount;
      }
    } catch {
      /* ignore */
    }

    // --- Clerk handshake markers (a server-side re-auth bounce) ---
    const url = new URL(window.location.href);
    const handshakeParams = [
      '__clerk_handshake',
      '__clerk_status',
      '__clerk_db_jwt',
      '__clerk_handshake_nonce',
    ].filter((p) => url.searchParams.has(p));
    const referrer = document.referrer || null;
    const referrerIsClerk = referrer ? /clerk|accounts\./i.test(referrer) : false;

    // --- Per-tab reload counter (sessionStorage survives reloads, not tab close) ---
    let loadCount = 1;
    try {
      loadCount = Number(sessionStorage.getItem(SS_LOADS) || 0) + 1;
      sessionStorage.setItem(SS_LOADS, String(loadCount));
    } catch {
      /* ignore */
    }

    record('LOAD', {
      path: window.location.pathname + window.location.search,
      navType,
      redirectCount,
      priorLifetimeMs,
      gapSincePrevBeatMs: gapMs,
      tabLoadCount: loadCount,
      handshakeParams: handshakeParams.length ? handshakeParams : undefined,
      referrer,
      referrerIsClerk: referrerIsClerk || undefined,
      visibility: document.visibilityState,
    });

    // Mark this instance's start; heartbeat keeps lastBeat fresh so the NEXT
    // load can compute how long we lived and how long the gap was.
    try {
      localStorage.setItem(LS_START, String(startedAt));
      localStorage.setItem(LS_BEAT, String(startedAt));
    } catch {
      /* ignore */
    }

    const heartbeat = window.setInterval(() => {
      try {
        localStorage.setItem(LS_BEAT, String(now()));
      } catch {
        /* ignore */
      }
      setUptime(now() - startedRef.current);
      setTick((n) => n + 1);
    }, 1000);

    // --- Lifecycle listeners: catch the moment the page is torn down ---
    const onPageHide = (e: PageTransitionEvent) => {
      record('pagehide', {
        aliveMs: now() - startedRef.current,
        persisted: e.persisted, // true => going into bfcache, not a hard reload
        path: window.location.pathname,
      });
    };
    const onBeforeUnload = () => {
      record('beforeunload', { aliveMs: now() - startedRef.current });
    };
    const onVisibility = () => {
      record('visibility', { state: document.visibilityState });
    };
    const onError = (e: ErrorEvent) => {
      record('window.error', { message: e.message, source: e.filename, line: e.lineno });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      record('unhandledrejection', { reason: String(e.reason) });
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // --- Navigation API: see programmatic navigations + reloads (Chromium) ---
    let removeNavListener: (() => void) | null = null;
    try {
      const navigation = (
        w as { navigation?: { addEventListener: (t: string, cb: (e: Event) => void) => void; removeEventListener: (t: string, cb: (e: Event) => void) => void } }
      ).navigation;
      if (navigation) {
        const onNavigate = (e: Event) => {
          const ev = e as Event & {
            navigationType?: string;
            userInitiated?: boolean;
            hashChange?: boolean;
            destination?: { url?: string };
          };
          record('navigate', {
            navigationType: ev.navigationType,
            userInitiated: ev.userInitiated,
            hashChange: ev.hashChange,
            to: ev.destination?.url,
            // For JS-initiated nav this stack often includes the caller.
            stack: new Error('navigate-trigger').stack,
          });
        };
        navigation.addEventListener('navigate', onNavigate);
        removeNavListener = () => navigation.removeEventListener('navigate', onNavigate);
      }
    } catch {
      /* ignore */
    }

    // --- Wrap location.reload/assign/replace to capture the trigger stack ---
    // (May be non-configurable in some browsers; guarded.)
    const patches: Array<() => void> = [];
    try {
      const loc = window.location;
      const origReload = loc.reload.bind(loc);
      const wrappedReload = function (this: unknown) {
        record('location.reload() called', { stack: new Error('reload').stack });
        return origReload();
      };
      const locRef = loc as unknown as { reload: () => void };
      locRef.reload = wrappedReload;
      patches.push(() => {
        locRef.reload = origReload;
      });
    } catch {
      /* reload not overridable here */
    }

    // --- Clerk: log session-listener fires to correlate with the token cycle ---
    let clerkUnsub: (() => void) | null = null;
    let clerkPoll: number | null = null;
    const attachClerk = () => {
      try {
        const clerk = (
          w as {
            Clerk?: {
              addListener?: (cb: (p: unknown) => void) => () => void;
              session?: { id?: string; status?: string } | null;
            };
          }
        ).Clerk;
        if (clerk?.addListener) {
          clerkUnsub = clerk.addListener((payload) => {
            const p = payload as { session?: { id?: string; status?: string } | null };
            record('clerk:listener', {
              sessionId: p?.session?.id ?? null,
              status: p?.session?.status ?? null,
            });
          });
          record('clerk:attached', { sessionId: clerk.session?.id ?? null });
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };
    if (!attachClerk()) {
      // Clerk loads async; poll briefly until it's available.
      let attempts = 0;
      clerkPoll = window.setInterval(() => {
        attempts += 1;
        if (attachClerk() || attempts > 40) {
          if (clerkPoll) window.clearInterval(clerkPoll);
          clerkPoll = null;
        }
      }, 250);
    }

    // --- Expose helpers for console use ---
    w.__pcDiag = () => readLog();
    w.__pcDiagClear = () => {
      writeLog([]);
      try {
        sessionStorage.removeItem(SS_LOADS);
      } catch {
        /* ignore */
      }
      return 'cleared';
    };

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      if (removeNavListener) removeNavListener();
      if (clerkUnsub) clerkUnsub();
      if (clerkPoll) window.clearInterval(clerkPoll);
      patches.forEach((undo) => undo());
    };
  }, []);

  const log = typeof window !== 'undefined' ? readLog() : [];
  const recent = log.slice(-7).reverse();
  void tick; // dependency to re-read log each heartbeat

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(readLog(), null, 2));
      record('diag:copied', { entries: readLog().length });
    } catch {
      // Fallback: select-less prompt
      // eslint-disable-next-line no-alert
      window.prompt('Copy diagnostics:', JSON.stringify(readLog()));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 8,
        bottom: 8,
        zIndex: 99999,
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.35,
        maxWidth: open ? 360 : 'auto',
        background: 'rgba(17,17,17,0.92)',
        color: '#e6e6e6',
        border: '1px solid #444',
        borderRadius: 6,
        padding: open ? '8px 10px' : '4px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <strong style={{ color: '#5fd' }}>
          pc-diag · up {Math.floor(uptime / 1000)}s
        </strong>
        <span style={{ display: 'flex', gap: 6 }}>
          {open && (
            <>
              <button type="button" onClick={copyAll} style={btn}>
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  (window as unknown as { __pcDiagClear?: () => void }).__pcDiagClear?.();
                  setTick((n) => n + 1);
                }}
                style={btn}
              >
                Clear
              </button>
            </>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} style={btn}>
            {open ? '–' : '▲'}
          </button>
        </span>
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          {recent.map((e, i) => (
            <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: '#888' }}>{e.iso.slice(11, 19)}</span>{' '}
              <span style={{ color: e.ev === 'LOAD' ? '#fd6' : '#9cf' }}>{e.ev}</span>
            </div>
          ))}
          {!recent.length && <div style={{ color: '#888' }}>no events yet…</div>}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: '#2a2a2a',
  color: '#ddd',
  border: '1px solid #555',
  borderRadius: 4,
  fontSize: 10,
  padding: '1px 6px',
  cursor: 'pointer',
  fontFamily: 'monospace',
};
