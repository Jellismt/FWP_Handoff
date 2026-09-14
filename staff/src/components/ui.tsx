/**
 * @file ui.tsx
 * @module engage-mt/staff
 * @description Tiny shared UI pieces reused across the editing screens: a toast (message
 *              + optional undo, auto-dismiss), the standard optimistic-lock conflict
 *              message helper (with an optional Reload action), a titled form card, and
 *              a modal confirm dialog for destructive/irreversible actions. Extracted from
 *              the inline patterns first written in DistrictDetailScreen / UsersScreen so
 *              every new editor renders the same way.
 * @author Jamie Ellis / Engage MT
 * @created 2026-07-04
 * @updated 2026-07-14
 * @version 1.3.0
 *
 * FWP Engage MT — Montana's Official Gateway to the Outdoors
 * Licensed under the MIT License.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type PublicationDto } from "../api.js";

export interface ToastState {
  msg: string;
  undo?: () => void | Promise<void>;
  /** When set, the toast shows a Reload button (used for optimistic-lock conflicts). */
  reload?: () => void | Promise<void>;
}

/** Auto-dismissing confirmation banner with an optional Undo or Reload action. */
export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return (
    <div className="card" style={{ borderColor: "var(--fwp-green)", display: "flex", gap: 12, alignItems: "center" }} role="status">
      <span>{toast.msg}</span>
      {toast.undo && (
        <button className="secondary" onClick={() => { void toast.undo!(); onDismiss(); }}>Undo</button>
      )}
      {toast.reload && (
        <button className="secondary" onClick={() => { void toast.reload!(); onDismiss(); }}>Reload</button>
      )}
    </div>
  );
}

/**
 * Standard message for a caught error, giving the optimistic-lock 409 its own copy
 * (including who/when when the server supplied it) and falling back to the raw message.
 */
export function conflictMsg(e: unknown, reloadHint = "reload"): string {
  if (e instanceof ApiError && e.status === 409) {
    return e.message.includes("Changed by") ? e.message : `Changed by someone else — ${reloadHint}.`;
  }
  return e instanceof ApiError ? e.message : String(e);
}

/** True when the error is an optimistic-lock conflict — the case a Reload button recovers. */
export function isConflict(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409;
}

/**
 * Build a ToastState from a caught error, attaching a Reload button only when the
 * error is a recoverable optimistic-lock conflict. One call replaces the repeated
 * `setToast({ msg: conflictMsg(e) })` pattern where a re-fetch is available.
 */
export function conflictToast(e: unknown, reloadHint: string, onReload?: () => void | Promise<void>): ToastState {
  return { msg: conflictMsg(e, reloadHint), ...(onReload && isConflict(e) ? { reload: onReload } : {}) };
}

/** A titled `<form className="card">` wrapper matching the existing create-form styling. */
export function FormCard({ title, onSubmit, children }: {
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <form className="card" onSubmit={onSubmit}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </form>
  );
}

/**
 * Modal confirm dialog for destructive/irreversible actions — replaces bare
 * `window.confirm()` so the consequence is stated in-app before the verb.
 * Accessibility: `role="alertdialog"`, focus moves to the confirm button on open,
 * Esc cancels, and clicking the backdrop cancels.
 */
export function ConfirmDialog({ heading, body, confirmLabel, danger = true, busy = false, onConfirm, onCancel }: {
  heading: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={heading} onClick={(e) => e.stopPropagation()}>
        <h3>{heading}</h3>
        <div className="subtle" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{body}</div>
        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button ref={confirmRef} className={danger ? "danger" : undefined} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The one honest answer to "what is the public reading right now?" — a status banner
 * showing the LIVE snapshot version for a season year (or "not yet published"), plus a
 * warning when the working draft has un-published changes ahead of live. Self-fetching so
 * it can drop onto any screen (Dashboard, Review, Live snapshot) without prop threading.
 *
 * Accessibility: the status line is `role="status"` with `aria-live="polite"` so a screen
 * reader announces the resolved state once loaded; color is always paired with a text label.
 */
export function LiveBanner({ seasonYear }: { seasonYear: number }) {
  // undefined = still loading; null = no publication exists yet.
  const [pub, setPub] = useState<PublicationDto | null | undefined>(undefined);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setPub(undefined);
    setPending(null);
    api
      .publications(seasonYear)
      .then((rows) => {
        if (!alive) return;
        const latest = rows.slice().sort((a, b) => b.version - a.version)[0] ?? null;
        setPub(latest);
      })
      .catch(() => alive && setPub(null));
    api
      .diff(seasonYear)
      .then((rows) => {
        if (!alive) return;
        const d = rows[0];
        setPending(d ? d.totals.added + d.totals.removed + d.totals.changed : 0);
      })
      .catch(() => alive && setPending(null));
    return () => {
      alive = false;
    };
  }, [seasonYear]);

  if (pub === undefined) {
    return <div className="live-banner live-banner--loading subtle" aria-hidden="true">Checking what's live…</div>;
  }

  if (pub === null) {
    return (
      <div className="live-banner live-banner--none" role="status" aria-live="polite">
        <strong>Not published yet</strong>
        <span>
          The public Engage&nbsp;MT app shows nothing for <strong>{seasonYear}</strong> until an approver publishes it.
        </span>
      </div>
    );
  }

  return (
    <div className="live-banner" role="status" aria-live="polite">
      <div className="live-banner__line">
        <span className="live-dot" aria-hidden="true" />
        <strong>LIVE — {seasonYear} v{pub.version}</strong>
        <span className="subtle">
          published {pub.published_at.slice(0, 10)} by {pub.published_by} · {pub.row_count} rules
        </span>
      </div>
      {pub.note && <div className="live-banner__note subtle">“{pub.note}”</div>}
      {pending != null && pending > 0 && (
        <div className="live-banner__pending">
          Draft is <strong>{pending}</strong> change{pending === 1 ? "" : "s"} ahead of live —{" "}
          <Link className="district-link" to="/review">review &amp; re-publish</Link> to push them out.
        </div>
      )}
    </div>
  );
}
