import { Directive, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';

@Directive({
  selector: 'form[appFormValidation]',
  standalone: true
})
export class FormValidationDirective implements OnInit, OnChanges, OnDestroy {
  @Input() appFormValidationError = '';
  @Output() readonly appFormValidationDismiss = new EventEmitter<void>();

  private readonly form: HTMLFormElement;
  private readonly submitListener: (event: Event) => void;
  private readonly keydownListener: (event: KeyboardEvent) => void;
  private readonly pasteListener: (event: ClipboardEvent) => void;
  private readonly observer: MutationObserver;
  private messageElement?: HTMLDivElement;
  private timeoutId?: number;

  constructor(element: ElementRef<HTMLFormElement>) {
    this.form = element.nativeElement;
    this.form.noValidate = true;
    this.submitListener = event => this.handleSubmit(event);
    this.keydownListener = event => this.handleNumericKeydown(event);
    this.pasteListener = event => this.handleNumericPaste(event);
    this.observer = new MutationObserver(() => this.markRequiredLabels());
  }

  ngOnInit(): void {
    this.form.addEventListener('submit', this.submitListener, true);
    this.form.addEventListener('keydown', this.keydownListener, true);
    this.form.addEventListener('paste', this.pasteListener, true);
    this.markRequiredLabels();
    this.observer.observe(this.form, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['required', 'disabled']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appFormValidationError']) {
      if (this.appFormValidationError) this.showMessage(this.appFormValidationError);
      else this.removeMessage();
    }
  }

  ngOnDestroy(): void {
    this.form.removeEventListener('submit', this.submitListener, true);
    this.form.removeEventListener('keydown', this.keydownListener, true);
    this.form.removeEventListener('paste', this.pasteListener, true);
    this.observer.disconnect();
    this.clearTimeout();
  }

  private handleNumericKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLInputElement | null;
    if (target?.type !== 'number') return;
    if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
  }

  private handleNumericPaste(event: ClipboardEvent): void {
    const target = event.target as HTMLInputElement | null;
    if (target?.type !== 'number') return;
    const value = event.clipboardData?.getData('text') ?? '';
    if (!/^\d*(?:[.,]\d*)?$/.test(value)) event.preventDefault();
  }

  private handleSubmit(event: Event): void {
    if (this.form.checkValidity()) {
      if (this.appFormValidationError) this.appFormValidationDismiss.emit();
      this.removeMessage();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.showMessage('Completa los campos obligatorios y verifica que los datos tengan un formato válido.');
    this.form.querySelector<HTMLElement>(':invalid')?.focus();
  }

  private markRequiredLabels(): void {
    const requiredControls = this.form.querySelectorAll<HTMLElement>(
      'input[required]:not(:disabled), select[required]:not(:disabled), textarea[required]:not(:disabled)'
    );

    this.form.querySelectorAll('label').forEach(label => {
      if (!label.textContent?.trim().endsWith('*')) return;
      const field = label.closest('.form-group, .module-field');
      const associatedControl = (label as HTMLLabelElement).control as HTMLElement | null;
      const controls = associatedControl
        ? [associatedControl]
        : label.htmlFor
          ? Array.from(this.form.querySelectorAll<HTMLElement>('input, select, textarea'))
            .filter(control => control.id === label.htmlFor)
          : Array.from(field?.querySelectorAll<HTMLElement>('input, select, textarea') ?? []);
      controls.forEach(control => {
        const requiredControl = control as HTMLInputElement;
        if (!requiredControl.disabled && !requiredControl.required) requiredControl.required = true;
      });
    });

    requiredControls.forEach(control => {
      const field = control.closest('.form-group, .module-field');
      const fieldLabel = field?.querySelector('label');
      const label = fieldLabel ?? Array.from(this.form.querySelectorAll('label'))
        .find(candidate => candidate.htmlFor === control.id && control.id !== '');

      if (!label || label.querySelector('.required-marker') || label.textContent?.trim().endsWith('*')) return;

      const marker = document.createElement('span');
      marker.className = 'required-marker';
      marker.textContent = ' *';
      marker.setAttribute('aria-hidden', 'true');
      label.append(marker);
    });
  }

  private showMessage(message: string): void {
    this.removeMessage();
    const alert = document.createElement('div');
    alert.className = 'form-validation-alert';
    alert.setAttribute('role', 'alert');

    const text = document.createElement('span');
    text.textContent = message;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'form-validation-close';
    close.setAttribute('aria-label', 'Cerrar mensaje');
    close.textContent = '×';
    close.addEventListener('click', () => {
      this.removeMessage();
      this.appFormValidationDismiss.emit();
    });

    alert.append(text, close);
    this.form.prepend(alert);
    this.messageElement = alert;
    this.timeoutId = window.setTimeout(() => this.removeMessage(), 10_000);
  }

  private removeMessage(): void {
    this.messageElement?.remove();
    this.messageElement = undefined;
    this.clearTimeout();
  }

  private clearTimeout(): void {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
