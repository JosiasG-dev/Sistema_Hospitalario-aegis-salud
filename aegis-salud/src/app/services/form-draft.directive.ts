import { AfterViewInit, Directive, Input, OnDestroy, Optional, Self } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FormDraftService } from './form-draft.service';

@Directive({
  selector: 'form[appFormDraft]',
  standalone: true
})
export class FormDraftDirective implements AfterViewInit, OnDestroy {
  @Input({ required: true }) appFormDraft = '';
  private changes?: Subscription;

  constructor(
    @Optional() @Self() private readonly ngForm: NgForm | null,
    private readonly drafts: FormDraftService
  ) {}

  ngAfterViewInit(): void {
    if (!this.ngForm || !this.appFormDraft) return;
    const saved = this.drafts.load(this.appFormDraft);
    if (saved) this.ngForm.form.patchValue(saved, { emitEvent: false });
    this.changes = this.ngForm.form.valueChanges.subscribe(value => {
      this.drafts.save(this.appFormDraft, value);
    });
  }

  ngOnDestroy(): void {
    this.changes?.unsubscribe();
  }

  clearDraft(): void {
    this.drafts.clear(this.appFormDraft);
  }
}
