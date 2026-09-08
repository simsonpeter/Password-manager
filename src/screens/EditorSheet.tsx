import { useState, type FormEvent } from "react";
import { Sheet } from "../components/Sheet";
import { CATEGORIES, type Draft, type Entry } from "../lib/types";
import { generatePin } from "../lib/config";

type Props = {
  initial?: Entry | null;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<void>;
};

export function EditorSheet({ initial, onClose, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "gate");
  const [codes, setCodes] = useState(initial?.codes?.length ? initial.codes : [""]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function setCode(index: number, value: string) {
    setCodes((prev) => prev.map((code, i) => (i === index ? value : code)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give this key a name.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        id: initial?.id,
        name,
        category,
        codes,
        notes,
        favorite,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={initial ? "Edit key" : "New key"} onClose={onClose} wide>
      <form className="editor" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Harbour Gate A"
            required
            autoFocus
          />
        </label>

        <fieldset>
          <legend>Kind</legend>
          <div className="kind-grid">
            {CATEGORIES.map((item) => (
              <label key={item.id} className={category === item.id ? "kind on" : "kind"}>
                <input
                  type="radio"
                  name="category"
                  value={item.id}
                  checked={category === item.id}
                  onChange={() => setCategory(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <div className="field-row">
            <span>Codes</span>
            <button
              type="button"
              className="text-link"
              onClick={() => setCodes((prev) => [...prev, generatePin(4)])}
            >
              Generate PIN
            </button>
          </div>
          {codes.map((code, index) => (
            <div className="code-row" key={index}>
              <input
                value={code}
                onChange={(e) => setCode(index, e.target.value)}
                placeholder={`${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} code`}
                autoComplete="off"
              />
              {codes.length > 1 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setCodes((prev) => prev.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-ghost btn-block" onClick={() => setCodes((prev) => [...prev, ""])}>
            Add another code
          </button>
        </div>

        <label>
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Where the keypad lives, who to call…"
          />
        </label>

        <label className="check">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          Keep at the top of the vault
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-brass" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
