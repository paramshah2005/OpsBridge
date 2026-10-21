"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type PullRequest = {
  number: number;
  title: string;
  author: string;
  headBranch: string;
  baseBranch: string;
};
type Props = { repoId: string; open: boolean; onClose: () => void; onSubmit: (command: string) => Promise<void> };

export default function DeletePrModal({ repoId, open, onClose, onSubmit }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const controller = new AbortController();
    document.body.style.overflow = "hidden";
    setLoading(true);
    setError("");
    fetch(`/api/repos/${repoId}/pull-requests`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { pullRequests?: PullRequest[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Open pull requests could not be loaded.");
        setPullRequests(data.pullRequests || []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Open pull requests could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else document.querySelector<HTMLElement>(".composer input")?.focus();
    };
  }, [open, repoId]);

  useEffect(() => {
    if (!open) {
      setPullRequests([]);
      setSelectedNumber(null);
      setLoading(false);
      setError("");
      setConfirming(false);
      setSubmitting(false);
      setSubmitError("");
    }
  }, [open]);

  useEffect(() => {
    if (confirming) window.setTimeout(() => cancelConfirmRef.current?.focus(), 0);
  }, [confirming]);

  if (!open) return null;
  const selectedPullRequest = pullRequests.find((pullRequest) => pullRequest.number === selectedNumber) || null;
  const close = () => { if (!submitting) onClose(); };

  function trapFocus(event: KeyboardEvent<HTMLDivElement>, dialog: HTMLDivElement | null) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirming) { setConfirming(false); setSubmitError(""); }
      else close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function confirmClose() {
    if (!selectedPullRequest || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(`/delete-pr ${selectedPullRequest.number}`);
      onClose();
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "The pull request could not be closed.");
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <div className="command-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="command-modal merge-pr-modal close-pr-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => trapFocus(event, dialogRef.current)}>
        <div className="command-modal-heading">
          <div><span className="sidebar-label">PULL REQUEST</span><h2 id={titleId}>Close a pull request</h2></div>
          <button type="button" className="command-modal-close" aria-label="Close" onClick={close} disabled={submitting}>×</button>
        </div>
        <section className="merge-pr-list" aria-label="Open pull requests">
          <h3>Open pull requests</h3>
          {loading && <p className="merge-pr-muted">Loading pull requests…</p>}
          {error && <p className="command-modal-error" role="alert">{error}</p>}
          {!loading && !error && pullRequests.length === 0 && <p className="merge-pr-muted">No open pull requests.</p>}
          {pullRequests.map((pullRequest) => <button
            type="button"
            key={pullRequest.number}
            className={`merge-pr-choice${selectedNumber === pullRequest.number ? " merge-pr-choice-selected" : ""}`}
            onClick={() => { setSelectedNumber(pullRequest.number); setSubmitError(""); }}
            disabled={submitting}
            aria-pressed={selectedNumber === pullRequest.number}
          >
            <strong>#{pullRequest.number} {pullRequest.title}</strong>
            <span>@{pullRequest.author} · {pullRequest.headBranch} → {pullRequest.baseBranch}</span>
          </button>)}
        </section>
        <p className="close-pr-note">Closing a pull request leaves its branches unchanged.</p>
        {submitError && <p className="command-modal-error" role="alert">{submitError}</p>}
        <div className="command-modal-actions">
          <button type="button" className="secondary" onClick={close} disabled={submitting}>Cancel</button>
          <button type="button" onClick={() => setConfirming(true)} disabled={!selectedPullRequest || loading || submitting}>Close PR</button>
        </div>
      </div>
    </div>
    {confirming && selectedPullRequest && <div className="command-modal-backdrop merge-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) { setConfirming(false); setSubmitError(""); } }}>
      <div ref={confirmRef} className="command-modal merge-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-confirm`} onKeyDown={(event) => trapFocus(event, confirmRef.current)}>
        <div className="command-modal-heading"><div><span className="sidebar-label">CONFIRM CLOSE</span><h2 id={`${titleId}-confirm`}>Close PR #{selectedPullRequest.number}?</h2></div></div>
        <p>This will close <strong>{selectedPullRequest.title}</strong>. Its branches will remain unchanged.</p>
        {submitError && <p className="command-modal-error" role="alert">{submitError}</p>}
        <div className="command-modal-actions">
          <button ref={cancelConfirmRef} type="button" className="secondary" onClick={() => { setConfirming(false); setSubmitError(""); }} disabled={submitting}>No</button>
          <button type="button" onClick={confirmClose} disabled={submitting}>{submitting ? "Closing…" : "Yes, close PR"}</button>
        </div>
      </div>
    </div>}
  </>;
}
