/**
 * One icon set, authored here, bundled as inline SVG (SPEC §7.4).
 *
 * No icon font and no CDN: a font that fails to load leaves a row of tofu
 * boxes where the controls were, and a CDN is a network request this app has
 * promised never to make (SPEC §8.1).
 *
 * Icon-only is a *visual* minimalism goal. It is never a reason for an
 * unlabelled control in the accessibility tree — every button built from these
 * carries a real accessible name (see `iconButton`).
 */

const PATHS: Record<string, string> = {
  // Conventional and unambiguous: triangle, double bar, circular arrow (§7.4).
  play: '<path d="M8 5.1 L18.7 12 L8 18.9 Z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="7.4" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>' +
    '<rect x="13" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  reset:
    '<path d="M14.4 5.4 A7 7 0 1 1 9.6 5.4"/>' +
    '<path d="M10.7 2.1 L10.7 8.7 L5.4 5.4 Z" fill="currentColor" stroke="none"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  collapse: '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M4.5 12.6 L9.8 17.9 L19.5 6.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20v-4.2L15.6 4.2 19.8 8.4 8.2 20Z"/><path d="M13.6 6.2l4.2 4.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 10.5v6M13.5 10.5v6"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2.1"/><circle cx="15" cy="12" r="2.1"/><circle cx="8" cy="17" r="2.1"/>',
  presets: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/>',
  // A panel with a distinct left column: the sidebar toggle in the toolbar.
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M9.5 4v16"/>',
  save: '<path d="M5 5h11l3 3v11H5Z"/><path d="M8.5 5v5h7V5"/><rect x="8.5" y="13" width="7" height="6"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.6h.01M8.5 13.6h7M18 13.6h.01"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>',
  moon: '<path d="M20 14.4A8.6 8.6 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4Z"/>',
  soundOn: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.3 6.5a7.8 7.8 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  // Nought, one and two arcs, so the three chimes are distinguishable before
  // they are heard — three identical speakers would be a menu of nothing.
  soundLow: '<path d="M5.5 9.5H9l4.5-4v13L9 14.5H5.5Z"/>',
  soundMed: '<path d="M4.5 9.5H8l4.5-4v13L8 14.5H4.5Z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6"/>',
  soundHigh:
    '<path d="M3.5 9.5H7l4.5-4v13L7 14.5H3.5Z"/><path d="M14.8 9.2a4 4 0 0 1 0 5.6M17.6 6.5a7.8 7.8 0 0 1 0 11"/>',
  chevronUp: '<path d="M6 14.5 12 8.5l6 6"/>',
  chevronDown: '<path d="M6 9.5 12 15.5l6-6"/>',
  back: '<path d="M19 12H5.5"/><path d="M11 5.5 4.5 12 11 18.5"/>',
  forward: '<path d="M5 12h13.5"/><path d="M13 5.5 19.5 12 13 18.5"/>',
  // Visualization modes.
  vizCircle: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8a8.2 8.2 0 0 1 8.2 8.2" stroke-width="3.6"/>',
  vizBar: '<rect x="2.5" y="8.5" width="19" height="7" rx="1.6"/><path d="M2.5 12h11" stroke-width="6" stroke-linecap="butt"/>',
  vizDots: '<circle cx="6" cy="8.5" r="2.4"/><circle cx="12" cy="8.5" r="2.4"/><circle cx="18" cy="8.5" r="2.4"/><circle cx="6" cy="15.5" r="2.4"/><circle cx="12" cy="15.5" r="2.4"/><circle cx="18" cy="15.5" r="2.4"/>',
  vizDigits: '<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M7 9v6M17 9v6"/><path d="M12 10h.01M12 14h.01"/>',
  // Circle tick styles: no ticks, twelve clock-face marks (one line per hour,
  // rotated with `transform` rather than hand-plotted, exactly like the real
  // ticks circle.ts draws), marks derived from the timer's own duration
  // (irregular angles and lengths, so it reads as "measured", not "clock",
  // at a glance).
  ticksNone: '<circle cx="12" cy="12" r="8.5"/>',
  // A solid disc, for the "Filled" circle style — distinct from the dot-grid
  // icon, which is a different mode entirely and was a confusing stand-in.
  circleFilled: '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none"/>',
  ticksClock:
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="4.9" stroke-width="2.3"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(30 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(60 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="4.9" stroke-width="2.3" transform="rotate(90 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(120 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(150 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="4.9" stroke-width="2.3" transform="rotate(180 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(210 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(240 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="4.9" stroke-width="2.3" transform="rotate(270 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(300 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="1.2" transform="rotate(330 12 12)"/>',
  ticksInterval:
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="2.1"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.7" stroke-width="1.1" transform="rotate(40 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.7" stroke-width="1.1" transform="rotate(75 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="2.1" transform="rotate(130 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.7" stroke-width="1.1" transform="rotate(195 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.4" stroke-width="2.1" transform="rotate(250 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.7" stroke-width="1.1" transform="rotate(300 12 12)"/>' +
    '<line x1="12" y1="3.1" x2="12" y2="5.7" stroke-width="1.1" transform="rotate(340 12 12)"/>',
  // The numeric-overlay toggle: a plain "12" glyph. Deliberately unrelated to
  // vizDigits (a rectangle standing in for the digits *mode*) — this toggles
  // a numeral overlay on top of whichever graphical mode is active, a
  // different control that used to share vizDigits's icon and read as the
  // same button twice.
  readoutNumbers: '<path d="M6.4 9.3 8.6 7.4V16.6"/><path d="M13.2 9.6a2.6 2.6 0 1 1 4.6 1.7L13.3 16.6h4.9"/>',
};

export type IconName = keyof typeof PATHS | string;

export function icon(name: IconName, size = 24): SVGSVGElement {
  const markup = PATHS[name];
  if (!markup) throw new Error(`Unknown icon: ${name}`);
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  element.setAttribute('viewBox', '0 0 24 24');
  element.setAttribute('width', String(size));
  element.setAttribute('height', String(size));
  element.setAttribute('fill', 'none');
  element.setAttribute('stroke', 'currentColor');
  element.setAttribute('stroke-width', '2');
  element.setAttribute('stroke-linecap', 'round');
  element.setAttribute('stroke-linejoin', 'round');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  element.classList.add('icon');
  element.innerHTML = markup;
  return element;
}

export interface IconButtonOptions {
  /** The accessible name. Never optional — this is what makes icon-only honest. */
  label: string;
  name: IconName;
  className?: string;
  size?: number;
  /** Shown under the icon on large targets, e.g. the primary start button. */
  onClick?: (event: MouseEvent) => void;
}

export function iconButton(options: IconButtonOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['icon-button', options.className].filter(Boolean).join(' ');
  button.setAttribute('aria-label', options.label);
  // A tooltip for sighted mouse users, never required for operation (§5.10).
  button.title = options.label;
  button.append(icon(options.name, options.size ?? 24));
  if (options.onClick) button.addEventListener('click', options.onClick);
  return button;
}

export function setButtonIcon(button: HTMLButtonElement, name: IconName, label: string, size = 24): void {
  button.replaceChildren(icon(name, size));
  button.setAttribute('aria-label', label);
  button.title = label;
}
