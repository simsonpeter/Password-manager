import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./Icons";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export function Sheet({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className={`sheet ${wide ? "sheet-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
