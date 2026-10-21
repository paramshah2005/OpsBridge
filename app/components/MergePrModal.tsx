"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type PullRequestChoice = {
  number: number;
  title: string;
  url: string;
  author: string;
  headBranch: string;
  baseBranch: string;
};
type Check = { name: string; status: "pass" | "fail" | "pending"; url: string | null; details: string | null };
type PullRequestDetails = {
  number: number;
  title: string;
  url: string;
  headBranch: string;
  baseBranch: string;
  mergeable: boolean | null;
};
type Props = { repoId: string; open: boolean; onClose: () => void; onSubmit: (command: string) => Promise<void> };

export default function MergePrModal({ repoId, open, onClose, onSubmit }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const cancelConfirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequestChoice[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [details, setDetails] = useState<PullRequestDetails | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [baseProtected, setBaseProtected] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [listError, setListError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const controller = new AbortController();
    document.body.style.overflow = "hidden";
    setLoadingList(true);
    setListError("");
    fetch(`/api/repos/${repoId}/pull-requests`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { pullRequests?: PullRequestChoice[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Open pull requests could not be loaded.");
        setPullRequests(data.pullRequests || []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setListError(reason instanceof Error ? reason.message : "Open pull requests could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingList(false); });
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else document.querySelector<HTMLElement>(".composer input")?.focus();
    };
  }, [open, repoId]);

  useEffect(() => {
    if (!open || selectedNumber === null) return;
    const controller = new AbortController();
    setLoadingDetails(true);
    setDetailsError("");
    setDetails(null);
    setChecks([]);
    fetch(`/api/repos/${repoId}/pull-requests?number=${selectedNumber}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { pullRequest?: PullRequestDetails; checks?: Check[]; baseProtected?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || "Pull request checks could not be loaded.");
        setDetails(data.pullRequest || null);
        setChecks(data.checks || []);
        setBaseProtected(data.baseProtected === true);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setDetailsError(reason instanceof Error ? reason.message : "Pull request checks could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingDetails(false); });
    return () => controller.abort();
  }, [open, repoId, selectedNumber, refreshCount]);

  useEffect(() => {
    if (!open) {
      setPullRequests([]);
      setSelectedNumber(null);
      setDetails(null);
      setChecks([]);
      setBaseProtected(false);
      setLoadingList(false);
      setLoadingDetails(false);
      setListError("");
      setDetailsError("");
      setConfirming(false);
      setSubmitting(false);
      setSubmitError("");
    }
  }, [open]);

  useEffect(() => {
    if (confirming) window.setTimeout(() => cancelConfirmRef.current?.focus(), 0);
  }, [confirming]);

  if (!open) return null;
  const close = () => { if (!submitting) onClose(); };
  const checksReady = !loadingDetails && !detailsError && checks.every((check) => check.status === "pass");
  const mergeReady = Boolean(details && details.mergeable === true && checksReady && !submitting);

  function trapFocus(event: KeyboardEvent<HTMLDivElement>, dialog: HTMLDivElement | null) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirming) { setConfirming(false); setSubmitError(""); }
      else close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialog?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function confirmMerge() {
    if (!mergeReady || selectedNumber === null) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await onSubmit(`/merge ${selectedNumber}`);
      onClose();
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "The pull request could not be merged.");
    } finally {
      setSubmitting(false);
    }
  }

  return <>
    <div className="command-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className="command-modal merge-pr-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => trapFocus(event, dialogRef.current)}>
        <div className="command-modal-heading">
          <div><span className="sidebar-label">PULL REQUEST</span><h2 id={titleId}>Merge a pull request</h2></div>
          <button type="button" className="command-modal-close" aria-label="Close" onClick={close} disabled={submitting}>×</button>
        </div>
        <div className="merge-pr-content">
          <section className="merge-pr-list" aria-label="Open pull requests">
            <h3>Open pull requests</h3>
            {loadingList && <p className="merge-pr-muted">Loading pull requests…</p>}
            {listError && <p className="command-modal-error" role="alert">{listError}</p>}
            {!loadingList && !listError && pullRequests.length === 0 && <p className="merge-pr-muted">No open pull requests.</p>}
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

          {selectedNumber !== null && <section className="merge-pr-checks" aria-live="polite" aria-label="Pull request checks">
            <div className="merge-pr-checks-heading">
              <h3>{details ? `Checks for #${details.number}` : `Checks for #${selectedNumber}`}</h3>
              <button type="button" className="merge-pr-refresh" onClick={() => setRefreshCount((count) => count + 1)} disabled={loadingDetails || submitting}>Refresh</button>
            </div>
            {loadingDetails && <p className="merge-pr-muted">Loading checks and branch protection…</p>}
            {detailsError && <p className="command-modal-error" role="alert">{detailsError}</p>}
            {!loadingDetails && details && <>
              {baseProtected && <p className="merge-pr-protection" role="status">Base branch <strong>{details.baseBranch}</strong> is protected. GitHub will enforce its protection rules.</p>}
              <p className="merge-pr-branches">{details.headBranch} → {details.baseBranch}</p>
              {details.mergeable === false && <p className="command-modal-error" role="alert">GitHub reports this pull request has merge conflicts.</p>}
              {details.mergeable === null && <p className="merge-pr-muted">GitHub is still checking whether this pull request can be merged. Refresh to check again.</p>}
              {checks.length === 0
                ? <p className="merge-pr-muted">No checks reported for this pull request.</p>
                : <ul className="merge-pr-check-list">{checks.map((check, index) => <li key={`${check.name}-${index}`}>
                  <span className={`merge-pr-status merge-pr-status-${check.status}`}>{check.status === "pass" ? "Pass" : check.status === "fail" ? "Fail" : "Pending"}</span>
                  <span className="merge-pr-check-name">{check.url ? <a href={check.url} target="_blank" rel="noreferrer">{check.name}</a> : check.name}{check.details && <small>{check.details}</small>}</span>
                </li>)}</ul>}
              {checks.some((check) => check.status === "fail") && <p className="command-modal-error" role="alert">One or more checks failed. This pull request cannot be merged.</p>}
              {!checks.some((check) => check.status === "fail") && checks.some((check) => check.status === "pending") && <p className="merge-pr-muted">Wait for all checks to finish before merging.</p>}
            </>}
          </section>}
        </div>
        {submitError && <p className="command-modal-error" role="alert">{submitError}</p>}
        <div className="command-modal-actions">
          <button type="button" className="secondary" onClick={close} disabled={submitting}>Cancel</button>
          <button type="button" onClick={() => setConfirming(true)} disabled={!mergeReady}>Merge</button>
        </div>
      </div>
    </div>
    {confirming && <div className="command-modal-backdrop merge-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) { setConfirming(false); setSubmitError(""); } }}>
      <div ref={confirmRef} className="command-modal merge-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-confirm`} onKeyDown={(event) => trapFocus(event, confirmRef.current)}>
        <div className="command-modal-heading"><div><span className="sidebar-label">CONFIRM MERGE</span><h2 id={`${titleId}-confirm`}>Merge PR #{selectedNumber}?</h2></div></div>
        <p>This will merge <strong>{details?.title}</strong> into {details?.baseBranch}.</p>
        {submitError && <p className="command-modal-error" role="alert">{submitError}</p>}
        <div className="command-modal-actions">
          <button ref={cancelConfirmRef} type="button" className="secondary" onClick={() => { setConfirming(false); setSubmitError(""); }} disabled={submitting}>No</button>
          <button type="button" onClick={confirmMerge} disabled={submitting}>{submitting ? "Merging…" : "Yes, merge"}</button>
        </div>
      </div>
    </div>}
  </>;
}
