/**
 * @file TagsInput.tsx
 * @module engage-mt/field
 * @description Chip-style tag editor. User types a tag and
 *              presses Enter (or comma); the value becomes a chip with an
 *              inline "×" remove. Backspace on the input when empty
 *              removes the last chip. Tags are unique, trimmed, lower-
 *              cased, and capped at 32 chars / 12 tags total.
 *
 *              Used by WaypointEditor + by TrackCard / ShapeCard
 *              editors and the FieldToolsPage list filter.
 * @author Jamie Ellis / Engage MT
 * @created 2026-06-09
 * @updated 2026-06-10
 * @version 1.0.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useState, type KeyboardEvent } from "react";
import { Tag, X } from "lucide-react";
import "./TagsInput.css";

const MAX_TAG_LEN = 32;
const MAX_TAG_COUNT = 12;

const normalize = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .slice(0, MAX_TAG_LEN);

interface Props {
  value: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export const TagsInput = ({ value, onChange, placeholder }: Props): JSX.Element => {
  const [draft, setDraft] = useState("");

  const commit = (raw: string): void => {
    const tag = normalize(raw);
    if (!tag) return;
    if (value.includes(tag)) return;
    if (value.length >= MAX_TAG_COUNT) return;
    onChange([...value, tag]);
  };

  const remove = (tag: string): void => {
    onChange(value.filter((t) => t !== tag));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      setDraft("");
      return;
    }
    if (e.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="wp-tags-input">
      <ul className="wp-tags-input__list" aria-label="Selected tags">
        {value.map((t) => (
          <li key={t} className="wp-tags-input__chip">
            <Tag size={11} strokeWidth={2.25} aria-hidden />
            <span>{t}</span>
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              className="wp-tags-input__chip-x"
              onClick={() => remove(t)}
            >
              <X size={11} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input
        type="text"
        className="wp-tags-input__input"
        value={draft}
        placeholder={placeholder ?? "Add a tag and press Enter"}
        maxLength={MAX_TAG_LEN}
        disabled={value.length >= MAX_TAG_COUNT}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => {
          if (draft.trim()) {
            commit(draft);
            setDraft("");
          }
        }}
      />
      {value.length >= MAX_TAG_COUNT && (
        <p className="wp-tags-input__hint">Max {MAX_TAG_COUNT} tags.</p>
      )}
    </div>
  );
};
