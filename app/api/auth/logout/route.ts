import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/session";
export async function POST(request: Request) { const response = NextResponse.redirect(new URL("/", request.url)); response.cookies.delete(SESSION_COOKIE); response.cookies.delete("github_access_token"); return response; }
