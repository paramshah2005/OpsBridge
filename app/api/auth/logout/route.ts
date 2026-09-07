import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/session";
function logout(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete("github_access_token");
  return response;
}

export async function GET(request: Request) { return logout(request); }
export async function POST(request: Request) { return logout(request); }
