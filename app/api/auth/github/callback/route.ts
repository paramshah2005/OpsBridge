import { NextResponse } from "next/server";
import {
  createSession,
  encryptAccessToken,
  SESSION_COOKIE,
} from "../../../../lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const responseError = (reason: string) =>
    NextResponse.redirect(new URL(`/?error=${reason}`, request.url));
  if (!code || !state) return responseError("oauth_cancelled");
  const stateCookie = request.headers
    .get("cookie")
    ?.match(/(?:^|; )github_oauth_state=([^;]+)/)?.[1];
  if (!stateCookie || stateCookie !== state)
    return responseError("invalid_oauth_state");
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    },
  );
  if (!tokenResponse.ok) return responseError("token_exchange_failed");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) return responseError("token_missing");
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "OpsBridge",
    },
    cache: "no-store",
  });
  if (!userResponse.ok) return responseError("github_user_failed");
  const user = (await userResponse.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };
  const response = NextResponse.redirect(new URL("/repos", request.url));
  response.cookies.set(
    SESSION_COOKIE,
    createSession({
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    },
  );
  response.cookies.delete("github_oauth_state");
  response.cookies.set(
    "github_access_token",
    encryptAccessToken(token.access_token),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    },
  );
  return response;
}
