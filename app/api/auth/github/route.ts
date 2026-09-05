import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId)
    return NextResponse.redirect(
      new URL("/?error=github_not_configured", request.url),
    );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(`${appUrl}/api/auth/github/callback`)}&scope=read:user%20repo&state=${state}`,
  );
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
