import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const days = Math.floor(h / 24);
    if (days === 1) return 'hier';
    if (days < 7) return `il y a ${days} j`;
    return d.toLocaleDateString('fr-FR');
  }
}
