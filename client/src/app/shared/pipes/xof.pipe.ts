import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'xof', standalone: true })
export class XofPipe implements PipeTransform {
  transform(value: number | null | undefined, currency = 'XOF'): string {
    if (value == null) return '—';
    const n = new Intl.NumberFormat('fr-FR').format(value);
    return `${n} ${currency}`;
  }
}
