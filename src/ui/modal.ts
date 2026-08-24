import { iconButton } from './icons';

/**
 * A modal built on `<dialog>` where it exists, with a hand-rolled fallback for
 * the embedded whiteboard browsers that predate it (SPEC §11.2).
 *
 * Focus handling matters more here than it looks: these dialogs are operated
 * with a stylus on a projected display, and a teacher who loses focus into the
 * page behind a dialog has no visible way to get it back.
 */
export class Modal {
  readonly element: HTMLDialogElement;
  readonly body: HTMLElement;
  private readonly native: boolean;
  private lastFocused: Element | null = null;
  private readonly onClose: (() => void) | undefined;

  constructor(title: string, options: { onClose?: () => void } = {}) {
    this.onClose = options.onClose;
    this.element = document.createElement('dialog');
    this.element.className = 'modal';
    this.native = typeof this.element.showModal === 'function';

    const header = document.createElement('div');
    header.className = 'modal-header';

    const heading = document.createElement('h2');
    heading.className = 'modal-title';
    heading.textContent = title;

    const close = iconButton({
      label: 'Close',
      name: 'close',
      className: 'icon-button-quiet',
      onClick: () => this.close(),
    });

    header.append(heading, close);

    this.body = document.createElement('div');
    this.body.className = 'modal-body';

    this.element.append(header, this.body);
    this.element.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    // Click on the backdrop, which for a native dialog is the element itself.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) this.close();
    });
    this.element.addEventListener('keydown', (event) => {
      if (!this.native && event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
      if (event.key === 'Tab' && !this.native) this.trapFocus(event);
    });

    document.body.append(this.element);
  }

  get open(): boolean {
    return this.element.open;
  }

  show(): void {
    this.lastFocused = document.activeElement;
    if (this.native) {
      this.element.showModal();
    } else {
      this.element.setAttribute('open', '');
      this.element.classList.add('modal-fallback');
    }
    const first = this.focusable()[0];
    first?.focus();
  }

  close(): void {
    if (this.native) {
      this.element.close();
    } else {
      this.element.removeAttribute('open');
    }
    (this.lastFocused as HTMLElement | null)?.focus?.();
    this.onClose?.();
  }

  destroy(): void {
    this.element.remove();
  }

  private focusable(): HTMLElement[] {
    return Array.from(
      this.element.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));
  }

  private trapFocus(event: KeyboardEvent): void {
    const items = this.focusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/**
 * Deletion is confirmed, always (SPEC §5.8). A misclick on a
 * projector-mirrored display, with a stylus, is not a hypothetical — and a
 * preset library is weeks of a teacher's accumulated setup.
 */
export function confirmDialog(message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
      modal.destroy();
    };

    const modal = new Modal(message, { onClose: () => finish(false) });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => finish(false));

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'button button-danger';
    confirm.textContent = confirmLabel;
    confirm.addEventListener('click', () => finish(true));

    // Cancel first, and focused by default: the safe option is the easy one.
    actions.append(cancel, confirm);
    modal.body.append(actions);
    modal.show();
    cancel.focus();
  });
}
