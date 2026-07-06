export function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}
