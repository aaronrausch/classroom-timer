/**
 * Chime playback (SPEC §5.7).
 *
 * Two things make this module worth its own file rather than four lines in the
 * UI layer:
 *
 * 1. **Unlock.** Browsers refuse to play audio until a user gesture has
 *    occurred, and an `AudioContext` created before one starts life suspended.
 *    The context is therefore created and resumed on the *first Start press* of
 *    each page load. Get this wrong and the chime fails silently — the single
 *    most likely "it's broken" report this project will receive.
 *
 * 2. **Silent degradation.** Every failure path here ends in no sound and no
 *    error surfaced. A teacher mid-lesson must never see a browser audio error,
 *    and the visual completion state is the real signal regardless.
 */

export interface ChimeOption {
  id: string;
  /** Shown only in settings, where the teacher is choosing deliberately. */
  label: string;
  file: string;
}

export const CHIMES: readonly ChimeOption[] = [
  { id: 'gentle', label: 'Gentle', file: 'gentle.wav' },
  { id: 'neutral', label: 'Neutral', file: 'neutral.wav' },
  { id: 'assertive', label: 'Assertive', file: 'assertive.wav' },
];

const WARNING_CUE_FILE = 'warning.wav';

type AudioContextCtor = typeof AudioContext;

function resolveAudioContext(): AudioContextCtor | null {
  const w = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export class AudioPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private unlockAttempted = false;
  private volume = 0.6;
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  /** True once a context exists and is running. Purely informational. */
  get ready(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gain && this.context) {
      this.gain.gain.setValueAtTime(this.volume, this.context.currentTime);
    }
  }

  /**
   * Call from within the user gesture that starts a timer. Safe to call every
   * time; the work happens once. Never throws.
   */
  unlock(soundId?: string): void {
    try {
      if (!this.context) {
        const Ctor = resolveAudioContext();
        if (!Ctor) return;
        this.context = new Ctor();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.volume;
        this.gain.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') {
        void this.context.resume().catch(() => undefined);
      }
      if (!this.unlockAttempted) {
        this.unlockAttempted = true;
        // A zero-length silent buffer satisfies the stricter mobile unlock rules.
        const blip = this.context.createBuffer(1, 1, this.context.sampleRate);
        const source = this.context.createBufferSource();
        source.buffer = blip;
        source.connect(this.gain as GainNode);
        source.start(0);
      }
      // Warm the cache while the teacher watches the timer, not at zero.
      if (soundId) void this.buffer(this.fileFor(soundId));
      void this.buffer(WARNING_CUE_FILE);
    } catch {
      // No audio in this environment. Visual-only is a complete experience.
    }
  }

  playChime(soundId: string): void {
    void this.play(this.fileFor(soundId), 1);
  }

  /** The optional quiet cue at the warning threshold, deliberately softer. */
  playWarningCue(): void {
    void this.play(WARNING_CUE_FILE, 0.45);
  }

  private fileFor(soundId: string): string {
    const chime = CHIMES.find((option) => option.id === soundId) ?? CHIMES[0];
    return chime.file;
  }

  private async play(file: string, gainScale: number): Promise<void> {
    try {
      if (!this.context || !this.gain) return;
      if (this.context.state === 'suspended') {
        await this.context.resume().catch(() => undefined);
      }
      const buffer = await this.buffer(file);
      if (!buffer || !this.context || !this.gain) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      if (gainScale === 1) {
        source.connect(this.gain);
      } else {
        const scaled = this.context.createGain();
        scaled.gain.value = gainScale;
        scaled.connect(this.gain);
        source.connect(scaled);
      }
      source.start(0);
    } catch {
      // Silent by design.
    }
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(file);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.pending.get(file);
    if (inFlight) return inFlight;

    const request = (async (): Promise<AudioBuffer | null> => {
      try {
        if (!this.context) return null;
        // Same-origin, bundled, and precached by the service worker: this is a
        // cache read at play time, not a network fetch (SPEC §5.7, §8.1).
        const response = await fetch(`${this.baseUrl}sounds/${file}`);
        if (!response.ok) return null;
        const bytes = await response.arrayBuffer();
        const decoded = await this.context.decodeAudioData(bytes);
        this.buffers.set(file, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.pending.delete(file);
      }
    })();

    this.pending.set(file, request);
    return request;
  }
}
