import { cookies as nextCookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

export type Session = { login: string; name: string | null; avatarUrl: string };
const SESSION_COOKIE = "opsbridge_session";

function secret() {
  return process.env.SESSION_SECRET || "local-development-secret-change-me";
}
function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}
function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
function key() {
  return createHash("sha256").update(secret()).digest();
}
export function encryptAccessToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function decryptAccessToken(value: string) {
  try {
    const [iv, tag, encrypted] = value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function createSession(user: Session) {
  const payload = encode(
    JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  );
  const signature = encode(`${payload}.${secret()}`).slice(0, 32);
  return `${payload}.${signature}`;
}

export async function getSession(cookieStore?: ReturnType<typeof nextCookies>) {
  const value = (await cookieStore)?.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || encode(`${payload}.${secret()}`).slice(0, 32) !== signature)
    return null;
  try {
    const session = JSON.parse(decode(payload)) as Session & { exp: number };
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
