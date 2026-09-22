export type CommandDefinition = { name: string; usage: string; description: string };

export const commandDefinitions: CommandDefinition[] = [
  { name: "rerun-trivy-scan", usage: "/rerun-trivy-scan", description: "Rerun the Trivy security scan." },
  { name: "rerun-semgrep", usage: "/rerun-semgrep", description: "Rerun the Semgrep security scan." },
  { name: "raise-pr", usage: '/raise-pr <head> <base> "<title>"', description: "Create a pull request." },
  { name: "status", usage: "/status", description: "Show repository statistics." },
  { name: "branch", usage: "/branch", description: "List the repository's branches." },
  { name: "help", usage: "/help", description: "List available commands." },
];

export function parseCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const tokens = [...trimmed.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
  const name = tokens.shift()?.slice(1).toLowerCase() || "";
  return { name, args: tokens };
}

export function helpText() {
  return commandDefinitions.map((command) => `${command.usage} — ${command.description}`).join("\n");
}
