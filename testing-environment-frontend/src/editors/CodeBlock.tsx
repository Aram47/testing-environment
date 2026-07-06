function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightJson(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="text-sky-300">$1</span>$2')
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-emerald-300">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="text-amber-300">$1</span>')
    .replace(/:\s*(-?\d+(?:\.\d+)?)/g, ': <span class="text-violet-300">$1</span>');
}

export function CodeBlock({ value, language = 'json' }: { value: unknown; language?: 'json' | 'text' }) {
  const text =
    typeof value === 'string'
      ? value
      : JSON.stringify(value ?? {}, null, 2);

  if (language === 'text') {
    return (
      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {text}
      </pre>
    );
  }

  return (
    <pre
      className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100"
      dangerouslySetInnerHTML={{ __html: highlightJson(text) }}
    />
  );
}
