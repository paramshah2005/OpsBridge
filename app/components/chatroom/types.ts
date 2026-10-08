export type Message = {
  id: number;
  authorLogin: string;
  content: string;
  createdAt: string;
  messageType?: "user_message" | "system_message";
};

export type FeedStatus =
  | "loading"
  | "uninitialized"
  | "pending"
  | "active"
  | "failed"
  | "disabled";

export type ScanStatus = "idle" | "running" | "completed" | "failed";
export type ScanKey = "semgrep" | "trivy";

export type Scan = {
  key: ScanKey;
  name: string;
  runId: number | null;
  status: ScanStatus;
  branch: string | null;
  commit: string | null;
  updatedAt: string | null;
  url: string | null;
};

export type Deployment = {
  id: number;
  deploymentId: string;
  status: "success";
  repository: string;
  environment: string;
  targetUrl: string | null;
  commitSha: string | null;
  ref: string | null;
  occurredAt: string;
};
