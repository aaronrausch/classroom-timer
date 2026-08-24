/**
 * Projector mode (SPEC §5.11).
 *
 * Three jobs, all of which are the difference between a demo and something a
 * teacher uses every day:
 *
 * - One press to full-screen, and a graceful fallback when the Fullscreen API
 *   is blocked — which it is, routinely, in the embedded browsers on
 *   interactive whiteboards.
 * - Chrome that gets out of the way after a moment of stillness while a
 *   timer runs, leaving the visualization and nothing else, and comes straight
 *   back on any movement or key press.
 * - A wake lock, so a forty-minute silent reading timer is not interrupted by
 *   the classroom PC deciding it is bored.
 */

const IDLE_MS = 1500;

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export class FullscreenController {
  private idleTimer: number | null = null;
  private idle = false;
  private shouldAutoHide = false;
  private wakeLock: WakeLockSentinelLike | null = null;
  private readonly listeners = new Set<(active: boolean) => void>();

  constructor(private readonly root: HTMLElement = document.documentElement) {
    document.addEventListener('fullscreenchange', () => this.notify());
    document.addEventListener('webkitfullscreenchange', () => this.notify());

    const wake = (): void => this.wake();
    document.addEventListener('pointermove', wake, { passive: true });
    document.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('keydown', wake);
    document.addEventListener('wheel', wake, { passive: true });

    // A wake lock is dropped whenever the tab is hidden. Reacquire on return,
    // or a timer survives exactly one alt-tab before the screen sleeps again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.shouldAutoHide) void this.acquireWakeLock();
    });
  }

  get isFullscreen(): boolean {
    const doc = document as FullscreenCapableDocument;
    return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
  }

  get supported(): boolean {
    const element = this.root as FullscreenCapableElement;
    return typeof element.requestFullscreen === 'function' || typeof element.webkitRequestFullscreen === 'function';
  }

  onChange(listener: (active: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async toggle(): Promise<void> {
    if (this.isFullscreen) {
      await this.exit();
    } else {
      await this.enter();
    }
  }

  async enter(): Promise<void> {
    const element = this.root as FullscreenCapableElement;
    try {
      if (typeof element.requestFullscreen === 'function') {
        await element.requestFullscreen({ navigationUI: 'hide' });
      } else if (typeof element.webkitRequestFullscreen === 'function') {
        await element.webkitRequestFullscreen();
      }
    } catch {
      // Blocked by policy or unsupported. The maximised in-page layout below is
      // the fallback, and it is a perfectly usable projector display.
    }
    // Set regardless of whether the API succeeded: the CSS fallback keys off
    // this attribute, so a blocked API still yields a full-bleed timer.
    this.root.dataset['projector'] = 'true';
    this.notify();
  }

  async exit(): Promise<void> {
    const doc = document as FullscreenCapableDocument;
    try {
      if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // Nothing useful to do; fall through to clearing the fallback layout.
    }
    delete this.root.dataset['projector'];
    this.notify();
  }

  /** Chrome hides only while a timer is actually running (SPEC §5.11). */
  setAutoHide(enabled: boolean): void {
    if (this.shouldAutoHide === enabled) return;
    this.shouldAutoHide = enabled;
    if (enabled) {
      this.wake();
      void this.acquireWakeLock();
    } else {
      this.clearIdleTimer();
      this.setIdle(false);
      void this.releaseWakeLock();
    }
  }

  private wake(): void {
    this.setIdle(false);
    this.clearIdleTimer();
    if (!this.shouldAutoHide) return;
    this.idleTimer = window.setTimeout(() => this.setIdle(true), IDLE_MS);
  }

  private setIdle(idle: boolean): void {
    if (this.idle === idle) return;
    this.idle = idle;
    this.root.dataset['chrome'] = idle ? 'hidden' : 'visible';
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async acquireWakeLock(): Promise<void> {
    try {
      const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
      if (!wakeLock || this.wakeLock) return;
      this.wakeLock = await wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch {
      // Unsupported, or refused because the document is hidden. Degrade
      // silently: the timer is still correct, the screen may just dim.
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      // Already gone.
    }
    this.wakeLock = null;
  }

  private notify(): void {
    if (!this.isFullscreen && this.root.dataset['projector'] === 'true' && document.fullscreenEnabled) {
      // The user left full-screen with Escape or the browser UI.
      delete this.root.dataset['projector'];
    }
    for (const listener of this.listeners) listener(this.isFullscreen);
  }
}
