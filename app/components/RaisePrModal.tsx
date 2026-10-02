"use client";

import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";

type Props = { repoId: string; open: boolean; onClose: () => void; onSubmit: (command: string) => Promise<void> };

export default function RaisePrModal({ repoId, open, onClose, onSubmit }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [head, setHead] = useState("");
  const [base, setBase] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const controller = new AbortController();
    document.body.style.overflow = "hidden";
    setLoading(true);
    setError("");
    fetch(`/api/repos/${repoId}/branches`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { branches?: string[]; defaultBranch?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Branches could not be loaded.");
        const incoming = data.branches || [];
        setBranches(incoming);
        setBase(data.defaultBranch && incoming.includes(data.defaultBranch) ? data.defaultBranch : incoming[0] || "");
        window.setTimeout(() => headRef.current?.focus(), 0);
      })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Branches could not be loaded."); })
      .finally(() => setLoading(false));
    return () => {
      controller.abort();
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      else document.querySelector<HTMLElement>(".composer input")?.focus();
    };
  }, [open, repoId]);

  useEffect(() => {
    if (!open) { setBranches([]); setHead(""); setBase(""); setTitle(""); setError(""); setLoading(false); setSubmitting(false); }
  }, [open]);

  if (!open) return null;
  const close = () => { if (!submitting) onClose(); };

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const normalizedTitle = title.trim();
    if (!branches.includes(head)) return setError("Choose a valid head branch.");
    if (!branches.includes(base)) return setError("Choose a valid base branch.");
    if (head === base) return setError("Head and base branches must be different.");
    if (!normalizedTitle) return setError("Enter a pull request title.");
    setSubmitting(true);
    try {
      const escapedTitle = normalizedTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await onSubmit(`/raise-pr ${head} ${base} "${escapedTitle}"`);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The pull request could not be created.");
    } finally { setSubmitting(false); }
  }

  return <div className="command-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} className="command-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleDialogKeyDown}>
      <div className="command-modal-heading"><div><span className="sidebar-label">PULL REQUEST</span><h2 id={titleId}>Create a pull request</h2></div><button type="button" className="command-modal-close" aria-label="Close" onClick={close} disabled={submitting}>×</button></div>
      <form onSubmit={submit}>
        <label>Head branch<input ref={headRef} list="raise-pr-head-branches" value={head} onChange={(event) => setHead(event.target.value)} placeholder={loading ? "Loading branches…" : "Search branches"} disabled={loading || submitting} autoComplete="off" /></label>
        <datalist id="raise-pr-head-branches">{branches.map((branch) => <option key={branch} value={branch} />)}</datalist>
        <label>Base branch<input list="raise-pr-base-branches" value={base} onChange={(event) => setBase(event.target.value)} placeholder={loading ? "Loading branches…" : "Search branches"} disabled={loading || submitting} autoComplete="off" /></label>
        <datalist id="raise-pr-base-branches">{branches.map((branch) => <option key={branch} value={branch} />)}</datalist>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the pull request" maxLength={256} disabled={submitting} /></label>
        {error && <p className="command-modal-error" role="alert">{error}</p>}
        {!loading && !error && branches.length === 0 && <p className="command-modal-error" role="alert">No branches are available in this repository.</p>}
        <div className="command-modal-actions"><button type="button" className="secondary" onClick={close} disabled={submitting}>Cancel</button><button type="submit" disabled={loading || submitting || branches.length === 0}>{submitting ? "Creating…" : "Create pull request"}</button></div>
      </form>
    </div>
  </div>;
}
