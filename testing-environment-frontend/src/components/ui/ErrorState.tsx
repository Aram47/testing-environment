import { ErrorPresenter } from '../../lib/errors';

export function ErrorState({ error }: { error: unknown }) {
  return (
    <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
      <h2 className="font-semibold">Unable to load data</h2>
      <p className="mt-1 text-sm">{ErrorPresenter.message(error)}</p>
    </section>
  );
}
