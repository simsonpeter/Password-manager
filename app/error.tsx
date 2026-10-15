"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-navy">Something went wrong</h1>
        <p className="text-muted">The page could not be shown. Codes and passphrases are not included in this message.</p>
        <button type="button" className="h-11 rounded-lg bg-navy px-4 font-semibold text-white" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
