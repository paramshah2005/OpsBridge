"use client";

import { useState, type FormEvent } from "react";
import { commandDefinitions } from "../../lib/commands";

type Props = {
  sending: boolean;
  onSubmit: (value: string) => Promise<void>;
  onRaisePrOpen: () => void;
};

/**
 * MessageComposer
 *
 * Owns the draft, slash-command menu, and submission errors.
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
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <form className="composer" onSubmit={handleSubmit}>
        {commandMenuOpen && commandMatches.length > 0 && (
          <div className="command-menu" id="command-menu" role="listbox">
            {commandMatches.map((command, index) => (
              <button
                type="button"
                className={
                  index === commandIndex
                    ? "command-option command-option-active"
                    : "command-option"
                }
                role="option"
                aria-selected={index === commandIndex}
                key={command.name}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectCommand(command.name);
                }}
              >
                <strong>{command.usage}</strong>
                <span>{command.description}</span>
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
          aria-autocomplete="list"
          aria-controls={
            commandMenuOpen && commandMatches.length > 0
              ? "command-menu"
              : undefined
          }
          aria-expanded={commandMenuOpen && commandMatches.length > 0}
        />
        <button type="submit" disabled={!content.trim() || sending}>
          {sending ? "Sending…" : "Send ↗"}
        </button>
      </form>
    </>
  );
}
