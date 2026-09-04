import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty">
      <div class="empty-icon">@if (icon) { {{ icon }} }</div>
      <p class="empty-title">{{ title }}</p>
      @if (hint) { <p class="empty-hint">{{ hint }}</p> }
    </div>
  `,
  styles: [
    `
      .empty { text-align: center; padding: 2.5rem 1rem; color: var(--muted); }
      .empty-icon { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.7; }
      .empty-title { font-weight: 600; margin: 0 0 0.25rem; }
      .empty-hint { font-size: 0.85rem; margin: 0; }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon?: string;
  @Input() title = 'Aucun contenu';
  @Input() hint?: string;
}
