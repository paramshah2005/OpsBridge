"use client";

import { FormEvent, useState } from "react";
import { commandDefinitions } from "../../lib/commands";

type Props = {
  /** Whether a submission is in flight (disables input + button). */
  sending: boolean;
  /**
   * Called when the user submits a non-empty, non-/raise-pr message or
   * command. Should perform the network request and update parent state.
   * Must throw on failure so the composer can display the error.
   */
  onSubmit: (value: string) => Promise<void>;
  /** Called when the /raise-pr command is triggered via input or the menu. */
  onRaisePrOpen: () => void;
};

/**
 * MessageComposer
 *
 * Owns: input content, slash-command autocomplete menu, send-error display.
 * Does NOT own: the list of messages, scan state, or feed state.
 */
export default function MessageComposer({
  sending,
  onSubmit,
  onRaisePrOpen,
}: Props) {
  const [content, setContent] = useState("");
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [error, setError] = useState("");

  const commandQuery = content.startsWith("/")
    ? content.slice(1).split(/\s/)[0].toLowerCase()
    : "";
  const commandMatches = commandDefinitions.filter((cmd) =>
    cmd.name.startsWith(commandQuery)
  );

  function selectCommand(name: string) {
    const command = commandDefinitions.find((item) => item.name === name);
    if (!command) return;
    if (name === "raise-pr") {
      setContent("");
      setCommandMenuOpen(false);
      onRaisePrOpen();
      return;
    }
    setContent(`${command.usage} `);
    setCommandMenuOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = content.trim();
    if (!value || sending) return;

    // /raise-pr typed directly without going through the menu
    if (value === "/raise-pr") {
      onRaisePrOpen();
      setContent("");
      setCommandMenuOpen(false);
      return;
    }

    setError("");
    try {
      await onSubmit(value);
      setContent("");
      setCommandMenuOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not be sent.");
    }
  }

  return (
    <>
      {error && <p className="chat-error">{error}</p>}
      <form
        className="composer"
        style={{ position: "relative" }}
        onSubmit={handleSubmit}
      >
        {/* Slash-command autocomplete menu */}
        {commandMenuOpen && commandMatches.length > 0 && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              right: 74,
              background: "#fff",
              border: "1px solid #ccd3ca",
              zIndex: 3,
            }}
          >
            {commandMatches.map((command, index) => (
              <button
                type="button"
                key={command.name}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectCommand(command.name);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  width: "100%",
                  padding: "11px 14px",
                  border: 0,
                  borderBottom: "1px solid #edf0ea",
                  background: index === commandIndex ? "#eff4e8" : "#fff",
                  color: "#263025",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <strong style={{ font: "12px DM Mono" }}>{command.usage}</strong>
                <span style={{ font: "11px DM Sans", color: "#798279" }}>
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        )}

        <input
          value={content}
          onChange={(e) => {
            const value = e.target.value;
            setContent(value);
            setCommandMenuOpen(value.startsWith("/") && !value.includes(" "));
            setCommandIndex(0);
          }}
          onKeyDown={(event) => {
            if (!commandMenuOpen || commandMatches.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCommandIndex((i) => (i + 1) % commandMatches.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCommandIndex(
                (i) => (i - 1 + commandMatches.length) % commandMatches.length
              );
            } else if (
              event.key === "Enter" &&
              commandMatches[commandIndex]
            ) {
              event.preventDefault();
              selectCommand(commandMatches[commandIndex].name);
            } else if (event.key === "Escape") {
              setCommandMenuOpen(false);
            }
          }}
          placeholder="Write a message…"
          maxLength={2000}
          disabled={sending}
        />
        <button type="submit" disabled={!content.trim() || sending}>
          {sending ? "Sending…" : "Send ↗"}
        </button>
      </form>
    </>
  );
}
