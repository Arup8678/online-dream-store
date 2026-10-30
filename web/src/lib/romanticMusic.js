/**
 * Soft romantic background music, synthesised live with the Web Audio API
 * (no audio files, nothing to license or download).
 *
 *  - warm pad on a slow I – vi – IV – V progression (Cmaj7, Am7, Fmaj7, G6)
 *  - gentle music-box arpeggio + an occasional high melody note
 *  - procedural reverb, slow fade in / out
 *
 * Browsers only allow sound after a user gesture, so start() must be called from one.
 */
const CHORDS = [
  [48, 55, 59, 64, 67, 71], // Cmaj7  (root, 5th, 7th, then upper voices)
  [45, 52, 55, 60, 64, 67], // Am7
  [41, 48, 52, 57, 60, 64], // Fmaj7
  [43, 50, 55, 59, 62, 64], // G6
];
const BPM = 62;
const EIGHTH = 60 / BPM / 2;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

let ctx = null, master = null, reverb = null, timer = null, nextTime = 0, step = 0, playing = false;

function makeReverb(ac) {
  const len = ac.sampleRate * 3.2;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  const conv = ac.createConvolver();
  conv.buffer = buf;
  return conv;
}

function tone(freq, t, dur, { type = 'sine', gain = 0.2, attack = 0.01, release = 0.4, detune = 0, lp = 0, dest } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  let node = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
  node.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + release + 0.05);
}

function scheduleStep(i, t) {
  const bar = Math.floor(i / 8) % CHORDS.length;
  const pos = i % 8;
  const chord = CHORDS[bar];
  if (pos === 0) { // pad + bass on the downbeat of each bar
    const barLen = EIGHTH * 8;
    chord.slice(0, 5).forEach((n, k) => {
      tone(midi(n), t, barLen * 0.9, { type: 'triangle', gain: k === 0 ? 0.13 : 0.06, attack: 1.1, release: 1.6, detune: k % 2 ? 6 : -6, lp: 900, dest: reverb });
    });
    tone(midi(chord[0] - 12), t, barLen * 0.8, { type: 'sine', gain: 0.16, attack: 0.08, release: 1.2 });
  }
  // music-box arpeggio over the upper chord tones
  const pattern = [2, 3, 4, 5, 4, 3, 4, 2];
  tone(midi(chord[pattern[pos]] + 12), t, 0.12, { type: 'sine', gain: 0.11, attack: 0.005, release: 1.3, dest: reverb });
  tone(midi(chord[pattern[pos]] + 24), t, 0.05, { type: 'triangle', gain: 0.025, attack: 0.005, release: 0.6, dest: reverb });
  // sparse lyrical melody
  if ((pos === 1 || pos === 5) && Math.random() < 0.55) {
    const n = chord[3 + Math.floor(Math.random() * 3)] + 24;
    tone(midi(n), t + 0.02, 0.35, { type: 'sine', gain: 0.07, attack: 0.03, release: 1.8, dest: reverb });
  }
}

function pump() {
  while (nextTime < ctx.currentTime + 0.5) {
    scheduleStep(step, nextTime);
    nextTime += EIGHTH;
    step += 1;
  }
}

export const isPlaying = () => playing;

export async function start() {
  if (playing) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0;
      reverb = makeReverb(ctx);
      const wet = ctx.createGain(); wet.gain.value = 0.9;
      reverb.connect(wet); wet.connect(master);
      master.connect(ctx.destination);
    }
    await ctx.resume();
    playing = true;
    step = 0; nextTime = ctx.currentTime + 0.15;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3); // gentle fade in
    pump();
    timer = setInterval(pump, 120);
    return true;
  } catch { playing = false; return false; }
}

export function stop() {
  if (!ctx || !playing) return;
  playing = false;
  clearInterval(timer);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2); // fade out
  const c = ctx;
  setTimeout(() => { if (!playing && c.state === 'running') c.suspend(); }, 1500);
}
