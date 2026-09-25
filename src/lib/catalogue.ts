// The catalogue's own view of the curriculum: the manifest's shape, plus the
// read-time rollups the drill-down navigation needs. The lesson data model is
// owned by scripts/make-lessons.py and mirrored here as the app reads it.
//
// "tier" here is the journey level (Foundations … Mastery). A lesson slot also
// carries a `tier` field — plain/core/stretch — which is a different, narrower
// thing; they are never siblings, so the name is reused as it is in the manifest.

import { base } from "$app/paths";
import type { LessonProgress } from "./progress";

export type Tier = {
  slug: string;
  name: string;
  question: string;
  stages: number[];
};

export type Slot = {
  id: string;
  number: string;
  name: string;
  tier: string;
  planned: boolean;
};

export type Module = {
  slug: string;
  title: string;
  subtitle: string;
  lessons: Slot[];
};

export type Stage = {
  slug: string;
  // Global curriculum number — matches a stage to its tier and names its MIDI
  // directory. `tierNumber` is what the catalogue shows.
  number: number;
  tierNumber: number;
  title: string;
  goal: string;
  modules: Module[];
  closing: Slot | null;
};

export type Lesson = {
  id: string;
  number: string;
  name: string;
  file: string;
  bpm: number;
  bars: number;
  /**
   * The most scored hits this lesson lands on one instant — how many limbs it
   * asks for. Optional: a manifest generated before this existed has none, and
   * the catalogue marks nothing rather than failing.
   */
  voices?: number;
  summary?: string;
  description?: string;
};

export type Manifest = {
  // Optional: a manifest generated before this change has no tiers, and the
  // catalogue still has to render (D-fallback: one untitled grouping).
  tiers?: Tier[];
  stages: Stage[];
  lessons: Lesson[];
};

/** Fetch the lesson manifest. Throws on a failed request so a `load` can 500. */
export async function fetchManifest(
  fetch: typeof globalThis.fetch,
): Promise<Manifest> {
  const res = await fetch(`${base}/lessons/manifest.json`);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  return res.json();
}

/** How much of a scope is done: written lessons cleared, over written total. */
export type Rollup = { cleared: number; total: number };

/** Every written (non-planned) slot in a stage, checkpoint included. */
export function writtenSlots(stage: Stage): Slot[] {
  const slots = stage.modules
    .flatMap((m) => m.lessons)
    .filter((s) => !s.planned);
  if (stage.closing && !stage.closing.planned) slots.push(stage.closing);
  return slots;
}

/** Cleared-of-written for one stage. Planned slots never count toward `total`. */
export function stageRollup(
  stage: Stage,
  progress: Map<string, LessonProgress>,
): Rollup {
  const slots = writtenSlots(stage);
  const cleared = slots.filter(
    (s) => (progress.get(s.id)?.cleared ?? 0) > 0,
  ).length;
  return { cleared, total: slots.length };
}

/** The stages that belong to a tier, in curriculum order. */
export function stagesForTier(tier: Tier, manifest: Manifest): Stage[] {
  const inTier = new Set(tier.stages);
  return manifest.stages.filter((s) => inTier.has(s.number));
}

/** Cleared-of-written summed across a tier's stages. */
export function tierRollup(
  tier: Tier,
  manifest: Manifest,
  progress: Map<string, LessonProgress>,
): Rollup {
  return stagesForTier(tier, manifest).reduce(
    (acc, stage) => {
      const r = stageRollup(stage, progress);
      return { cleared: acc.cleared + r.cleared, total: acc.total + r.total };
    },
    { cleared: 0, total: 0 },
  );
}

/** A tier with no written lessons yet — shown as the road ahead, not navigable. */
export function tierLocked(
  tier: Tier,
  manifest: Manifest,
  progress: Map<string, LessonProgress>,
): boolean {
  return tierRollup(tier, manifest, progress).total === 0;
}

/**
 * Where "Continue" goes: the first written lesson, in curriculum order, the
 * history does not mark cleared; if all are cleared, the last written lesson;
 * with no lessons at all, null. `manifest.lessons` is already written-only and
 * in order, so this is a straight scan.
 */
export function continueTarget(
  manifest: Manifest,
  progress: Map<string, LessonProgress>,
): string | null {
  const lessons = manifest.lessons;
  if (!lessons.length) return null;
  const next = lessons.find((l) => (progress.get(l.id)?.cleared ?? 0) === 0);
  return (next ?? lessons[lessons.length - 1]).id;
}
