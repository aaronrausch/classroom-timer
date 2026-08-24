/**
 * Generates the bundled chimes as small mono WAV files.
 *
 * They are generated rather than downloaded so the repository carries no
 * third-party asset with an unclear licence, and so a maintainer can change
 * the character of a chime by editing numbers rather than by finding a new
 * sound file (SPEC §5.7).
 *
 *   npm run gen:assets
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');
const RATE = 22050;

/** A struck-bell partial: a sine with an exponential decay. */
function partial(t, freq, amp, decay, delay = 0) {
  const local = t - delay;
  if (local < 0) return 0;
  return amp * Math.exp(-local * decay) * Math.sin(2 * Math.PI * freq * local);
}

function render(durationSeconds, voice) {
  const length = Math.floor(RATE * durationSeconds);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    samples[i] = voice(t);
  }
  // A short fade at both ends, so no chime begins or ends on a click.
  const fade = Math.floor(RATE * 0.006);
  for (let i = 0; i < fade; i += 1) {
    samples[i] *= i / fade;
    samples[length - 1 - i] *= i / fade;
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.82 / peak : 1;
  for (let i = 0; i < length; i += 1) samples[i] *= scale;
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Three chimes that are genuinely distinct in character, so the choice in
// settings means something in a real room (SPEC §5.7).
const VOICES = {
  // Gentle: a soft two-note fall, long decay. For a quiet classroom.
  gentle: [2.0, (t) =>
    partial(t, 587.33, 0.5, 3.1) +
    partial(t, 1174.66, 0.12, 4.4) +
    partial(t, 440.0, 0.45, 2.6, 0.34) +
    partial(t, 880.0, 0.1, 3.8, 0.34)],

  // Neutral: one clean struck bell, no melodic implication at all.
  neutral: [1.6, (t) =>
    partial(t, 784.0, 0.55, 4.0) +
    partial(t, 1568.0, 0.16, 6.0) +
    partial(t, 2350.0, 0.06, 9.0)],

  // Assertive: three short pulses. Cuts through a noisy room.
  assertive: [1.3, (t) => {
    let value = 0;
    for (const delay of [0, 0.22, 0.44]) {
      value += partial(t, 987.77, 0.5, 16, delay) + partial(t, 1975.5, 0.14, 20, delay);
    }
    return value;
  }],

  // The optional warning cue: deliberately softer and lower than any chime, so
  // it reads as "nearly" rather than "finished" (SPEC §5.7).
  warning: [0.7, (t) => partial(t, 523.25, 0.4, 6.5) + partial(t, 784.0, 0.08, 8.0)],
};

mkdirSync(OUT, { recursive: true });
for (const [name, [duration, voice]] of Object.entries(VOICES)) {
  const buffer = wav(render(duration, voice));
  writeFileSync(join(OUT, `${name}.wav`), buffer);
  console.log(`${name}.wav  ${(buffer.length / 1024).toFixed(1)} KB`);
}
