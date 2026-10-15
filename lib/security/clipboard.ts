export interface ClipboardLike {
  writeText: (value: string) => Promise<void>;
  readText?: () => Promise<string>;
}

export async function copyText(
  value: string,
  clipboard: ClipboardLike,
  options?: {
    delayMs?: number;
    schedule?: (callback: () => void, ms: number) => void;
  },
): Promise<void> {
  const delayMs = options?.delayMs ?? 30_000;
  const schedule = options?.schedule ?? ((callback, ms) => setTimeout(callback, ms));
  await clipboard.writeText(value);
  schedule(() => {
    void (async () => {
      try {
        if (!clipboard.readText) return;
        const current = await clipboard.readText();
        if (current === value) await clipboard.writeText("");
      } catch {
        // Some operating systems block clipboard reads or clears. This is best effort only.
      }
    })();
  }, delayMs);
}
