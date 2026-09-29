// The metronome click, synthesised rather than sampled: a short sine blip in
// the classic electronic-metronome voice — higher on the bar's down-beat, lower
// on the others. Nothing to download, so it is ready the instant audio is.

const ACCENT_HZ = 1760; // down-beat
const BEAT_HZ = 1320; // every other beat
const DECAY_SEC = 0.05;

/** Schedule one click at audio time `when`. */
export function metronomeClick(
  ctx: AudioContext,
  when: number,
  accent: boolean,
  gain = 0.35,
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = accent ? ACCENT_HZ : BEAT_HZ;
  // Near-instant attack, exponential tail: the "tick" is all transient.
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(
    accent ? gain : gain * 0.7,
    when + 0.002,
  );
  env.gain.exponentialRampToValueAtTime(0.0001, when + DECAY_SEC);
  osc.connect(env).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + DECAY_SEC + 0.01);
}
