import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div class="avatar" [class.sm]="size === 'sm'" [class.lg]="size === 'lg'">
      @if (src) {
        <img [src]="src" [alt]="name || ''" loading="lazy" />
      } @else {
        <span>{{ initials }}</span>
      }
    </div>
  `,
  styles: [
    `
      .avatar {
        width: 42px; height: 42px; border-radius: 50%;
        background: var(--surface-2); display: flex; align-items: center;
        justify-content: center; overflow: hidden; flex-shrink: 0;
        font-weight: 700; color: var(--primary); user-select: none;
      }
      .avatar.sm { width: 30px; height: 30px; font-size: 0.8rem; }
      .avatar.lg { width: 64px; height: 64px; font-size: 1.4rem; }
      img { width: 100%; height: 100%; object-fit: cover; }
    `,
  ],
})
export class AvatarComponent {
  @Input() name?: string;
  @Input() src?: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get initials(): string {
    if (!this.name) return '?';
    return this.name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
