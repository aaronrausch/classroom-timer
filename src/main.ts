import { AudioPlayer } from './core/audio';
import { systemClock } from './core/clock';
import type { AppData, Preset, VisualizationId } from './core/presets';
import { formatDuration, Timer } from './core/timer';
import type { TimerPhase, TimerSnapshot, WarningThreshold } from './core/timer';
import { Store } from './core/storage';
import { Controls } from './ui/controls';
import { FullscreenController } from './ui/fullscreen';
import { PresetList } from './ui/presetList';
import { Sidebar } from './ui/sidebar';
import { Stage } from './ui/stage';
import { MotionPreference, ThemeController } from './ui/theme';
import type { RenderState } from './views/types';
import './styles/app.css';

/**
 * The wiring (SPEC §9.2).
 *
 * `core/` decides what is true, `views/` decide what it looks like, and this
 * file is the only place the two meet. It owns exactly three things: the
 * working configuration, the animation loop, and when to write to storage.
 */

interface WorkingConfig {
  name: string;
  durationSeconds: number;
  visualization: VisualizationId;
  palette: string;
  readout: boolean;
  warning: WarningThreshold;
}

/** The warning cross-fade: smooth, never a jump and never a flash (SPEC §5.5). */
const WARNING_FADE_MS = 600;

/** The control bar only needs to keep up with a person, not with a screen. */
const CHROME_UPDATE_MS = 200;

function boot(): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app');

  const store = new Store();
  const loaded = store.load();
  let data: AppData = loaded.data;

  // Said once, quietly, and never again. A teacher cannot fix a locked-down
  // browser profile mid-lesson, and the timer itself works regardless. Shown
  // inside the sidebar rather than as a page banner, so it never sits over the
  // stage a class is meant to be reading.
  const storageNotice = noticeFor(loaded.status);

  const theme = new ThemeController();
  const motion = new MotionPreference();
  const fullscreen = new FullscreenController();
  const audio = new AudioPlayer(import.meta.env.BASE_URL);
  const clock = systemClock;
  const timer = new Timer(clock, 300);

  theme.set(data.settings.theme);
  audio.setVolume(data.settings.volume);

  const config: WorkingConfig = {
    name: 'Timer',
    durationSeconds: 300,
    visualization: 'circle',
    palette: 'teal',
    readout: true,
    warning: { type: 'seconds', value: 60 },
  };
  timer.setDurationSeconds(config.durationSeconds);
  timer.setWarning(config.warning);

  // ------------------------------------------------------------------ layout
  //
  // Two columns: a collapsible sidebar (saved timers plus every setting), and
  // a main column holding the stage and the toolbar beneath it. Wrapped in
  // `.layout` so the CSS grid has one element to collapse instead of juggling
  // three siblings.
  const layout = document.createElement('div');
  layout.className = 'layout';

  const main = document.createElement('div');
  main.className = 'layout-main';

  const stage = new Stage({
    circleStyle: data.settings.circleStyle,
    circleTicks: data.settings.circleTicks,
    showTenths: data.settings.showTenths,
  });
  stage.setVisualization(config.visualization);
  stage.setDismissHandler(() => timer.reset());

  const controls = new Controls({
    onToggle: () => {
      // The audio context is created and unlocked here, inside the user gesture
      // that starts a timer. Anywhere else and the chime silently never plays
      // (SPEC §5.7).
      if (timer.state === 'idle' || timer.state === 'paused') audio.unlock(data.settings.soundId);
      timer.toggle();
    },
    onReset: () => timer.reset(),
    onAddTime: (seconds) => {
      timer.addTime(seconds);
      config.durationSeconds = timer.durationSeconds;
    },
    onSetDuration: (seconds) => {
      timer.setDurationSeconds(seconds);
      config.durationSeconds = timer.durationSeconds;
    },
    onFullscreen: () => void fullscreen.toggle(),
    onVisualization: (id) => {
      config.visualization = id;
      stage.setVisualization(id);
    },
    onToggleReadout: () => {
      config.readout = !config.readout;
    },
    onToggleTheme: () => {
      data = { ...data, settings: { ...data.settings, theme: theme.toggle() } };
      persist();
    },
    onToggleSidebar: () => setSidebarCollapsed(!data.settings.sidebarCollapsed),
    onEscape: () => {
      if (fullscreen.isFullscreen || document.documentElement.dataset['projector'] === 'true') {
        void fullscreen.exit();
      } else if (timer.state === 'finished') {
        timer.reset();
      }
    },
  });

  const presetList = new PresetList({
    onLaunch: (preset) => launch(preset),
    onPresetsChanged: (presets) => {
      data = { ...data, presets };
      persist();
    },
    colorsFor: (paletteId) => theme.colorsFor(paletteId),
  });

  const sidebar = new Sidebar(presetList, {
    onSettingsChange: (settings) => {
      data = { ...data, settings };
      theme.set(settings.theme);
      audio.setVolume(settings.volume);
      stage.setOptions({
        circleStyle: settings.circleStyle,
        circleTicks: settings.circleTicks,
        showTenths: settings.showTenths,
      });
      persist();
    },
    onPreviewChime: (soundId) => {
      audio.unlock(soundId);
      audio.playChime(soundId);
    },
    onImport: (imported) => {
      data = imported;
      theme.set(data.settings.theme);
      audio.setVolume(data.settings.volume);
      stage.setOptions({
        circleStyle: data.settings.circleStyle,
        circleTicks: data.settings.circleTicks,
        showTenths: data.settings.showTenths,
      });
      presetList.render(data.presets);
      applySidebarCollapsed();
      sidebar.refresh();
      persist();
    },
    onCreatePreset: () => presetList.openEditor({ ...config }),
    onCollapse: () => setSidebarCollapsed(true),
    getData: () => data,
    storageNotice: () => storageNotice,
  });

  main.append(stage.element, controls.element);
  // Main first, sidebar second: the sidebar renders on the right, matching
  // where its own toggle button sits in the toolbar's rightmost group.
  layout.append(main, sidebar.element);
  root.append(layout);
  presetList.render(data.presets);
  controls.bindKeyboard();
  applySidebarCollapsed();
  sidebar.refresh();

  function setSidebarCollapsed(collapsed: boolean): void {
    if (data.settings.sidebarCollapsed === collapsed) return;
    data = { ...data, settings: { ...data.settings, sidebarCollapsed: collapsed } };
    applySidebarCollapsed();
    persist();
  }

  function applySidebarCollapsed(): void {
    const collapsed = data.settings.sidebarCollapsed;
    layout.classList.toggle('layout-sidebar-collapsed', collapsed);
    // A width-0 panel is still in the tab order without this: a keyboard or
    // screen-reader user could tab straight into controls nobody can see
    // (SPEC §8).
    sidebar.element.toggleAttribute('inert', collapsed);
  }

  // Repaint the tiles when the theme flips: every swatch is theme-specific.
  theme.onChange(() => presetList.render(data.presets));

  function persist(): void {
    store.save({ ...data, schemaVersion: data.schemaVersion });
  }

  function launch(preset: Preset): void {
    config.name = preset.name;
    config.durationSeconds = preset.durationSeconds;
    config.visualization = preset.visualization;
    config.palette = preset.palette;
    config.readout = preset.readout;
    config.warning = preset.warning;

    // `setDurationSeconds` and `start` are both no-ops while a timer is
    // already RUNNING (SPEC §5.1 treats the duration as fixed mid-run; you
    // extend with addTime, you don't retarget it). A teacher picking a
    // different preset mid-countdown means "switch to this one now", so reset
    // first — from any state — to guarantee the new preset actually takes.
    // Without this, the config (and so the palette and hint text) would
    // switch to the new preset while the running countdown silently kept
    // counting down the old one underneath it.
    timer.reset();
    stage.setVisualization(preset.visualization);
    timer.setDurationSeconds(preset.durationSeconds);
    timer.setWarning(preset.warning);
    audio.unlock(data.settings.soundId);
    timer.start();
    void fullscreen.enter();
  }

  // --------------------------------------------------------------- the loop
  //
  // Rendering is driven by requestAnimationFrame and reads the timer's
  // deadline every frame. Nothing accumulates, so a dropped frame or a
  // throttled tab costs the countdown nothing (SPEC §5.2).

  let warningMix = 0;
  let warningEnteredAt: number | null = null;
  let lastPhase: TimerPhase = 'normal';
  let lastState = timer.state;
  let lastChromeUpdate = 0;
  let chimePlayed = false;
  let warningCuePlayed = false;

  function renderStateFrom(snapshot: TimerSnapshot, now: number): RenderState {
    const reducedMotion = motion.reduced;

    if (snapshot.phase !== 'normal' && lastPhase === 'normal') {
      warningEnteredAt = now;
    } else if (snapshot.phase === 'normal') {
      warningEnteredAt = null;
    }
    lastPhase = snapshot.phase;

    if (reducedMotion) {
      warningMix = snapshot.phase === 'normal' ? 0 : 1;
    } else if (warningEnteredAt === null) {
      warningMix = 0;
    } else {
      warningMix = Math.min(1, (now - warningEnteredAt) / WARNING_FADE_MS);
    }

    return {
      remainingMs: snapshot.remainingMs,
      totalMs: snapshot.totalMs,
      fraction: snapshot.fraction,
      state: snapshot.state,
      phase: snapshot.phase,
      colors: theme.colorsFor(config.palette),
      readout: config.readout,
      reducedMotion,
      warningMix,
    };
  }

  function frame(now: number): void {
    const snapshot = timer.sample();
    const renderState = renderStateFrom(snapshot, now);
    stage.render(renderState);

    if (snapshot.state !== lastState) {
      onStateChange(lastState, snapshot);
      lastState = snapshot.state;
    }

    if (snapshot.state === 'running' && snapshot.phase === 'warning' && !warningCuePlayed) {
      warningCuePlayed = true;
      if (data.settings.soundEnabled) audio.playWarningCue();
    }

    if (now - lastChromeUpdate > CHROME_UPDATE_MS) {
      lastChromeUpdate = now;
      controls.update(
        snapshot,
        {
          durationSeconds: config.durationSeconds,
          visualization: config.visualization,
          readout: config.readout,
          isFullscreen: fullscreen.isFullscreen,
          sidebarCollapsed: data.settings.sidebarCollapsed,
        },
        stage.supportsReadout,
      );
    }

    requestAnimationFrame(frame);
  }

  function onStateChange(previous: string, snapshot: TimerSnapshot): void {
    document.documentElement.dataset['timerState'] = snapshot.state;
    fullscreen.setAutoHide(snapshot.state === 'running');

    switch (snapshot.state) {
      case 'running':
        chimePlayed = false;
        if (previous === 'paused') {
          stage.announce('Resumed');
        } else {
          warningCuePlayed = false;
          stage.announce(`Started, ${formatDuration(Math.round(snapshot.totalMs / 1000))}`);
        }
        break;
      case 'paused':
        stage.announce(`Paused, ${formatDuration(Math.ceil(snapshot.remainingMs / 1000))} left`);
        break;
      case 'finished':
        stage.announce('Time is up');
        if (data.settings.soundEnabled && !chimePlayed) {
          chimePlayed = true;
          audio.playChime(data.settings.soundId);
        }
        break;
      default:
        warningCuePlayed = false;
        chimePlayed = false;
        stage.announce('Ready');
    }
  }

  // A backgrounded tab is throttled to roughly one callback a second, and a
  // sleeping machine gets none at all. Recompute from the deadline the instant
  // the tab is visible again; a timer that ran out while hidden resolves to
  // finished immediately rather than counting down from where it was left.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') timer.sample();
  });
  window.addEventListener('focus', () => timer.sample());
  window.addEventListener('pageshow', () => timer.sample());

  document.documentElement.dataset['timerState'] = timer.state;
  requestAnimationFrame(frame);
  registerServiceWorker();
}

function noticeFor(status: string): string | null {
  switch (status) {
    case 'unavailable':
      return 'This browser will not let the timer remember anything. Everything still works — your timers just will not be here next time.';
    case 'corrupt':
      return 'Saved timers could not be read, so the starter set is back. The old data has been kept in case it can be recovered.';
    case 'future-version':
      return 'Saved timers were created by a newer version of this app. They have been left untouched, and changes made now will not be saved.';
    default:
      return null;
  }
}

/**
 * Offline support (SPEC §5.13). Registered after first paint so it never
 * competes with getting a timer on the wall.
 *
 * The worker deliberately does not call `skipWaiting`: a new version activates
 * on the next load, never underneath a timer that is currently running.
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch(() => {
      // Offline support is a bonus, not a precondition.
    });
  });
}

boot();
