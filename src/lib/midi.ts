// Minimal Standard MIDI File parser — enough to drive the lessons highway.
//
// A lesson MIDI may hold several tracks. Their role is decided by the track
// name (FF 03 meta) and channel:
//   - "drums", or any track on the percussion channel (10) -> PLAYABLE:
//     these notes are shown on the highway and scored.
//   - "family:id" (e.g. "bass:lately")               -> BACKING:
//     auto-played from static/<family>/<id>/<note>.oga, never shown or scored.
//   - "count-in"                                     -> COUNT-IN:
//     the stick clicks that lead the student in — audible on the lesson's own
//     kit, never shown or scored. Checked before the percussion-channel rule,
//     which it would otherwise trip.
//   - "guide"                                        -> GUIDE:
//     the hi-hat a hatless lesson borrows to keep time against — audible on the
//     lesson's own kit, never shown or scored. Same exemption from the
//     percussion-channel rule as the count-in, and for the same reason.

/** Beats of lead-in before a lesson's beat 0 — the bar the count-in lives in. */
export const COUNT_IN_BEATS = 4;

/**
 * How long the transport keeps running past the last note in the file.
 *
 * One beat: enough for the closing hit to sit inside its own match window and
 * be scored on its merits, and for the bass's resolving tonic to ring before
 * the result screen arrives. Patterns whose last note is not on a bar line are
 * unaffected — bar rounding already carries them further than this.
 */
const TAIL_BEATS = 1;

// `vel` is MIDI velocity 1-127, carried only where it is used: backing tracks
// play it as loudness. Playable notes are scored on timing alone, so nothing
// on that path reads it.
export type MidiNote = { beat: number; note: number; vel?: number };
export type BackingTrack = { family: string; id: string; notes: MidiNote[] };

export type ParsedMidi = {
  ppq: number;
  bpm: number;
  notes: MidiNote[]; // playable (scored) notes
  backing: BackingTrack[]; // auto-played accompaniment
  /**
   * Count-in clicks, already shifted onto the transport's beat axis: the track
   * is written in its own lead-in bar, so these come back at negative beats
   * (-3, -2, -1). Beat 0 is deliberately silent — it belongs to the student.
   */
  countIn: MidiNote[];
  /**
   * The borrowed hi-hat, on the pattern's own beat axis (0 upward). Present
   * only for lessons whose pattern has no hat of its own. Carries `vel`, which
   * the drum player applies as gain so it sits under the student's playing.
   */
  guide: MidiNote[];
  /**
   * One pass of the pattern, in whole bars — the lesson minus its closing
   * down-beat. What `loopMidi` tiles by: pass k+1 opens exactly where pass k's
   * closing hit would have fallen.
   */
  loopBeats: number;
  lengthBeats: number;
};

export function parseMidi(buf: ArrayBuffer): ParsedMidi {
  const d = new DataView(buf);
  let p = 0;

  const tag = () =>
    String.fromCharCode(
      d.getUint8(p++),
      d.getUint8(p++),
      d.getUint8(p++),
      d.getUint8(p++),
    );
  const u32 = () => {
    const v = d.getUint32(p);
    p += 4;
    return v;
  };
  const u16 = () => {
    const v = d.getUint16(p);
    p += 2;
    return v;
  };

  if (tag() !== "MThd") throw new Error("Not a MIDI file");
  u32(); // header length (always 6)
  u16(); // format
  const ntracks = u16();
  const ppq = u16(); // assume metrical timing (positive)

  function varlen() {
    let v = 0;
    for (;;) {
      const b = d.getUint8(p++);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  }

  const playable: MidiNote[] = [];
  const backing: BackingTrack[] = [];
  let countIn: MidiNote[] = [];
  let guide: MidiNote[] = [];
  let bpm = 120;
  let maxTick = 0;

  for (let t = 0; t < ntracks; t++) {
    if (tag() !== "MTrk") break;
    const len = u32();
    const end = p + len;
    let tick = 0;
    let running = 0;
    let name = "";
    let usesPercussion = false;
    let trackMax = 0;
    const trackNotes: MidiNote[] = [];

    while (p < end) {
      tick += varlen();
      let statusByte = d.getUint8(p);
      if (statusByte & 0x80) p++;
      else statusByte = running; // running status
      running = statusByte;

      const cmd = statusByte & 0xf0;
      const chan = statusByte & 0x0f;
      if (statusByte === 0xff) {
        const type = d.getUint8(p++);
        const mlen = varlen();
        if (type === 0x03) {
          let s = "";
          for (let k = 0; k < mlen; k++)
            s += String.fromCharCode(d.getUint8(p + k));
          name = s;
        } else if (type === 0x51 && mlen === 3) {
          const us =
            (d.getUint8(p) << 16) |
            (d.getUint8(p + 1) << 8) |
            d.getUint8(p + 2);
          bpm = Math.round(60_000_000 / us);
        }
        p += mlen;
      } else if (statusByte === 0xf0 || statusByte === 0xf7) {
        p += varlen();
      } else if (cmd === 0x90) {
        const note = d.getUint8(p++);
        const vel = d.getUint8(p++);
        if (chan === 9) usesPercussion = true;
        if (vel > 0) trackNotes.push({ beat: tick / ppq, note, vel });
        if (tick > trackMax) trackMax = tick;
      } else if (cmd === 0x80 || cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {
        p += 2;
      } else if (cmd === 0xc0 || cmd === 0xd0) {
        p += 1;
      } else {
        p++; // unknown — skip a byte defensively
      }
    }
    p = end;

    if (!trackNotes.length) continue;

    // The count-in lives in the bar BEFORE the pattern, so it neither counts
    // toward the pattern's length nor belongs on the percussion/playable path.
    if (name.trim() === "count-in") {
      countIn = trackNotes
        .map((n) => ({ beat: n.beat - COUNT_IN_BEATS, note: n.note }))
        .sort((a, b) => a.beat - b.beat);
      continue;
    }

    // The guide runs the length of the pattern and no further, so it cannot
    // extend the lesson — but it is still percussion on channel 10, so it has
    // to be claimed here or the rule below would put it on the highway.
    if (name.trim() === "guide") {
      guide = trackNotes.sort((a, b) => a.beat - b.beat);
      continue;
    }

    if (trackMax > maxTick) maxTick = trackMax;
    const colon = name.indexOf(":");
    if (colon > 0 && !usesPercussion) {
      // backing track: "family:id"
      backing.push({
        family: name.slice(0, colon).trim(),
        id: name.slice(colon + 1).trim(),
        notes: trackNotes.sort((a, b) => a.beat - b.beat),
      });
    } else {
      playable.push(...trackNotes);
    }
  }

  playable.sort((a, b) => a.beat - b.beat);
  const lastBeat = maxTick / ppq;
  // Round the length up to a whole bar (4 beats) so the loop stays musical.
  const barRounded = Math.max(4, Math.ceil(lastBeat / 4) * 4);
  // A lesson closes ON the bar line that follows it — the pattern's down-beat
  // struck once more, with the bass resolving onto the same beat. Bar rounding
  // alone would end the transport on that very beat: the closing note would
  // fall outside its own match window and be scored a miss no matter how well
  // it was played, and the resolution would be cut off as the report appeared.
  // So the run always outlasts its last note.
  const lengthBeats = Math.max(barRounded, lastBeat + TAIL_BEATS);
  return {
    ppq,
    bpm,
    notes: playable,
    backing,
    countIn,
    guide,
    loopBeats: barRounded,
    lengthBeats,
  };
}

/** How many times a run may play its lesson back to back. */
export const LOOP_COUNTS = [1, 2, 4, 8, 16, 32, 64] as const;

/**
 * The lesson played `times` times back to back, as one longer lesson.
 *
 * Seamless because every lesson ends ON the next bar line: its closing
 * down-beat is the same hit as its beat 0, so tiling the body (everything
 * before `loopBeats`) and keeping the closing hit only after the last pass
 * lands each seam exactly where the next pass's beat 0 already sounds — no
 * doubled note, no gap. The count-in leads in once and is left alone.
 */
export function loopMidi(m: ParsedMidi, times: number): ParsedMidi {
  if (times <= 1) return m;
  const period = m.loopBeats;
  const lastOffset = (times - 1) * period;
  const tile = (notes: MidiNote[]): MidiNote[] => {
    const body = notes.filter((n) => n.beat < period);
    const out: MidiNote[] = [];
    for (let k = 0; k < times; k++)
      for (const n of body) out.push({ ...n, beat: n.beat + k * period });
    for (const n of notes)
      if (n.beat >= period) out.push({ ...n, beat: n.beat + lastOffset });
    return out;
  };
  return {
    ...m,
    notes: tile(m.notes),
    backing: m.backing.map((t) => ({ ...t, notes: tile(t.notes) })),
    guide: tile(m.guide),
    lengthBeats: m.lengthBeats + lastOffset,
  };
}
