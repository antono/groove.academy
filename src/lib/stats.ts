// Practice history, kept in IndexedDB.
//
//   groove-master / sessions   one record per scored lesson run, keyed by autoIncrement
//                        id, indexed on `at` (finish time) and `lesson`.
//
// The pad configuration lives in localStorage (see config.ts), but a practice log
// grows without bound and carries per-lane detail, so it wants a real store with
// an index to scan in time order rather than a JSON blob that has to be parsed
// whole on every write.
//
// Everything here is best-effort. A browser with no IndexedDB — private mode,
// storage blocked by the user — must still play lessons, it just records nothing,
// so no call rejects: writes resolve silently and reads resolve empty.

export const DB_NAME = "groove-master";
// v2 adds `uuid`/`remoteSynced` to each run for Supabase cloud sync (see
// sync.ts): the uuid is the cloud primary key and dedup key, backfilled onto
// existing rows during the upgrade so a pre-sync history uploads exactly once.
const DB_VERSION = 2;
const STORE = "sessions";

/** A stable, origin-assigned id. Browser crypto with a defensive fallback. */
export function newUuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {
    // fall through
  }
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Per-pad accuracy for one run, as shown in the lesson's result table. */
export type LaneStat = {
  note: number;
  name: string;
  total: number;
  hits: number;
  avgMs: number;
};

/** One completed lesson run. Mirrors the lesson page's result report. */
export type SessionStat = {
  id?: number; // local autoIncrement key, assigned by the store on write
  /**
   * Stable client-generated id, the cloud primary key. Append-only sync counts a
   * run once by this uuid regardless of how many devices it lands on. Optional on
   * the type for back-compat with v1 rows; every new row and every migrated row
   * has one.
   */
  uuid?: string;
  /** Whether this run has been uploaded to Supabase. Local bookkeeping only. */
  remoteSynced?: boolean;
  at: number; // epoch ms, when the run finished
  /**
   * Local calendar day, `YYYY-MM-DD`. Stored rather than derived on read: the
   * heatmap buckets by the day the student experienced, and a run finished at
   * 00:30 local is the previous day in UTC.
   */
  day: string;
  lesson: string; // lesson id, e.g. "1.2"
  lessonName: string;
  bpm: number; // the tempo actually played, slider/?bpm= included

  /**
   * The controller the run was played on: the live Web MIDI port name, falling
   * back to the name saved with the device mapping. `null` when no input was
   * connected — the run still scores, it just has no hits to score.
   */
  device: string | null;
  /**
   * Web MIDI port id for that controller. Stored alongside the name because it
   * is what config.ts keys the pad mapping on, and because port *names* are not
   * stable across operating systems — grouping by id survives what grouping by
   * name would split.
   */
  deviceId: string | null;

  // note stats
  total: number;
  hits: number;
  perfect: number;
  good: number;
  off: number;
  miss: number;
  extra: number;
  accuracy: number; // hits / total, 0..1

  // ms stats
  avgAbsMs: number; // mean |timing error| over the notes that were hit
  early: number;
  late: number;

  /**
   * Milliseconds played — the transport time of the run, count-in included.
   *
   * Derived from the run's length in beats at its BPM rather than measured off
   * the wall clock, so a pause mid-lesson does not get banked as practice time.
   * A run that is abandoned never reaches the result screen and is never
   * recorded, so every stored duration is a lesson played end to end.
   */
  durationMs: number;

  grade: string;
  lanes: LaneStat[];
};

/** Local calendar day of a timestamp, as `YYYY-MM-DD`. */
export function dayKey(when: number | Date): string {
  const d = typeof when === "number" ? new Date(when) : when;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// One connection per page, opened lazily on first use. Cached as the promise, not
// the database, so concurrent callers share a single open request.
let dbPromise: Promise<IDBDatabase | null> | null = null;

// How long to wait for the open request before giving up on storage for this
// page load. Only a pathological upgrade takes this long; a request still
// pending after it is wedged, and a wedged promise is a blank page.
const OPEN_TIMEOUT_MS = 5000;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Firefox throws here instead of erroring the request when storage is off.
      return resolve(null);
    }

    // This promise MUST settle. /lessons and /stats both await the history
    // before they render, so an open request that never fires is not a missing
    // chart, it is an empty page. Giving up also clears the cached promise: the
    // condition is transient (another tab closes) and the next call retries.
    let settled = false;
    const giveUp = () => {
      if (settled) return;
      settled = true;
      dbPromise = null;
      resolve(null);
    };
    const timer = setTimeout(giveUp, OPEN_TIMEOUT_MS);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const store = db.objectStoreNames.contains(STORE)
        ? req.transaction!.objectStore(STORE)
        : (() => {
            const s = db.createObjectStore(STORE, {
              keyPath: "id",
              autoIncrement: true,
            });
            s.createIndex("at", "at");
            s.createIndex("lesson", "lesson");
            return s;
          })();

      // v1 → v2: index the cloud key and backfill it onto existing runs so a
      // pre-sync history uploads exactly once.
      if ((event.oldVersion ?? 0) < 2) {
        if (!store.indexNames.contains("uuid"))
          store.createIndex("uuid", "uuid");
        store.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>)
            .result;
          if (!cursor) return;
          const row = cursor.value as SessionStat;
          if (!row.uuid) {
            row.uuid = newUuid();
            row.remoteSynced = false;
            cursor.update(row);
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      // Stand aside for a version bump elsewhere. A connection left open here is
      // precisely what blocks the upgrade over there, and the page holding it
      // need not be one the student can see — a background tab, or one the
      // browser is keeping in bfcache, blocks just as well.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      // Already gave up on this request; don't leak the connection we no longer
      // wait on, and don't hand back a database nobody asked for.
      if (settled) return db.close();
      settled = true;
      resolve(db);
    };
    req.onerror = () => {
      // Storage is refused rather than busy — a permanent condition for this
      // page, so keep the cached null instead of retrying on every read.
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve(null);
    };
    // An older connection is still open at the previous version, so the upgrade
    // cannot start. Without this the request simply never fires again.
    req.onblocked = () => {
      clearTimeout(timer);
      giveUp();
    };
  });
  return dbPromise;
}

/**
 * Append a finished run to the history. Never throws — the caller is on the path
 * that shows the result screen, and a storage failure must not interrupt it.
 */
export async function recordSession(stat: SessionStat): Promise<void> {
  const db = await openDb();
  if (!db) return;
  // Stamp the cloud key at record time; the run is unsynced until sync.ts uploads it.
  const row: SessionStat = {
    ...stat,
    uuid: stat.uuid ?? newUuid(),
    remoteSynced: stat.remoteSynced ?? false,
  };
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch {
      return resolve();
    }
    tx.objectStore(STORE).add(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

/**
 * Runs not yet uploaded to the cloud — the implicit "outbox" for stats. Rather
 * than a second store to keep consistent, the source of truth is the flag on the
 * run itself: unsynced = never uploaded. Returns oldest first.
 */
export async function unsyncedSessions(): Promise<SessionStat[]> {
  const rows = await rawSessions();
  return rows.filter((r) => !r.remoteSynced);
}

/** The set of cloud uuids already present locally, for pull de-duplication. */
export async function localUuids(): Promise<Set<string>> {
  const rows = await rawSessions();
  return new Set(
    rows.map((r) => r.uuid).filter((u): u is string => Boolean(u)),
  );
}

/** Mark the given runs (by uuid) as uploaded, so they are not pushed again. */
export async function markSynced(uuids: Set<string>): Promise<void> {
  if (uuids.size === 0) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch {
      return resolve();
    }
    const store = tx.objectStore(STORE);
    store.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      const row = cursor.value as SessionStat;
      if (row.uuid && uuids.has(row.uuid) && !row.remoteSynced) {
        row.remoteSynced = true;
        cursor.update(row);
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

/**
 * Insert runs pulled from the cloud that the device has never seen. Already-synced
 * by definition (they came from the cloud), and skipped if the uuid is present.
 */
export async function insertRemoteSessions(
  incoming: SessionStat[],
): Promise<void> {
  if (incoming.length === 0) return;
  const db = await openDb();
  if (!db) return;
  const have = await localUuids();
  const fresh = incoming.filter((r) => r.uuid && !have.has(r.uuid));
  if (fresh.length === 0) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch {
      return resolve();
    }
    const store = tx.objectStore(STORE);
    for (const r of fresh) {
      // Drop the local autoIncrement id so this device assigns its own.
      const { id: _id, ...rest } = r;
      void _id;
      store.add({ ...rest, remoteSynced: true });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

/** Raw rows in `at` order, without legacy-id canonicalisation. */
async function rawSessions(): Promise<SessionStat[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readonly");
    } catch {
      return resolve([]);
    }
    const req = tx.objectStore(STORE).index("at").getAll();
    req.onsuccess = () => resolve((req.result as SessionStat[]) ?? []);
    req.onerror = () => resolve([]);
    tx.onabort = () => resolve([]);
  });
}

// A lesson's id used to be its number ("1.2"), so it changed whenever the
// curriculum was reordered. Ids are slugs now and never change, but runs
// recorded before that carry the old number — mapped here on read so a
// student's history stays attached to the lesson they actually played.
//
// Reading only: nothing new is ever written under a legacy id, and the stored
// `lessonName` already renders correctly, so this only matters for grouping.
const LEGACY_IDS: Record<string, string> = {
  "1.1": "kick-quarters",
  "1.2": "kick-hats-unison",
  "2.1": "four-on-the-floor",
  "2.2": "disco-open-hats",
  "3.1": "paradiddle-single",
};

/** The current slug for a lesson id, which for anything recent is itself. */
export function canonicalLesson(id: string): string {
  return LEGACY_IDS[id] ?? id;
}

/** Every recorded run, oldest first (the `at` index supplies the ordering). */
export async function allSessions(): Promise<SessionStat[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readonly");
    } catch {
      return resolve([]);
    }
    const req = tx.objectStore(STORE).index("at").getAll();
    req.onsuccess = () => {
      const rows = (req.result as SessionStat[]) ?? [];
      resolve(rows.map((r) => ({ ...r, lesson: canonicalLesson(r.lesson) })));
    };
    req.onerror = () => resolve([]);
    tx.onabort = () => resolve([]);
  });
}

/**
 * Has anything ever been recorded? Counted rather than fetched: the navigation
 * asks this on every page to decide whether to offer a statistics link at all,
 * and pulling the whole history to answer "any?" would grow with the student.
 *
 * Non-throwing like everything else here — a browser with no IndexedDB reports
 * no history rather than failing, which simply keeps the link hidden.
 */
export async function hasSessions(): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readonly");
    } catch {
      return resolve(false);
    }
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve((req.result ?? 0) > 0);
    req.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

/** Wipe the practice history. Used by the "Clear history" action on /stats. */
export async function clearSessions(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch {
      return resolve();
    }
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}
