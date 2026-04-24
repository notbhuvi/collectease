'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-700">Dashboard failed to load</h2>
      <p className="mt-2 text-sm text-red-600">
        The invoice dashboard hit a runtime issue. The page can be retried without signing out.
      </p>
      {error?.message && (
        <p className="mt-2 text-xs text-red-500 break-words">{error.message}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  )
}
