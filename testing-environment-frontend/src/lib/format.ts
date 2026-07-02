export class Format {
  static date(value?: string): string {
    if (!value) {
      return '—';
    }
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  static duration(ms?: number): string {
    if (!ms) {
      return '—';
    }
    if (ms < 1000) {
      return `${ms} ms`;
    }
    return `${(ms / 1000).toFixed(1)} s`;
  }

  static percent(current: number, max: number): number {
    return max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  }
}
