export type CommandDefinition = { name: string; usage: string; description: string };

export const commandDefinitions: CommandDefinition[] = [
  { name: "rerun-trivy-scan", usage: "/rerun-trivy-scan", description: "Rerun the Trivy security scan." },
  { name: "rerun-semgrep", usage: "/rerun-semgrep", description: "Rerun the Semgrep security scan." },
  { name: "raise-pr", usage: '/raise-pr <head> <base> "<title>"', description: "Create a pull request." },
  { name: "status", usage: "/status", description: "Show repository statistics." },
  { name: "branch", usage: "/branch", description: "List the repository's branches." },
  { name: "prs", usage: "/prs", description: "List open pull requests." },
  { name: "pr", usage: "/pr <number>", description: "Show details for a pull request." },
  { name: "merge", usage: "/merge <number>", description: "Merge an open pull request." },
  { name: "delete-pr", usage: "/delete-pr <number>", description: "Close an open pull request." },
  { name: "checks", usage: "/checks <number>", description: "Show checks for a pull request." },
  { name: "whoami", usage: "/whoami", description: "Show your GitHub identity and repository access." },
  { name: "help", usage: "/help", description: "List available commands." },
];

export function parseCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const tokens = [...trimmed.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g)].map((match) => {
    if (match[1] !== undefined) return match[1].replace(/\\(["\\])/g, "$1");
    return match[2] ?? match[3] ?? "";
  });
  const name = tokens.shift()?.slice(1).toLowerCase() || "";
  return { name, args: tokens };
}

export function helpText() {
  return commandDefinitions.map((command) => `${command.usage} — ${command.description}`).join("\n");
}
