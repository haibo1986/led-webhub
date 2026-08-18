import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { MemberRole } from "./permissions";

const COOKIE_NAME = "led_webhub_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);
export type SessionPayload = { userId: string; tenantId: string; role: MemberRole; canPublish: boolean };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret());
  (await cookies()).set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] }); return payload as SessionPayload; } catch { return null; }
}

export async function destroySession() { (await cookies()).delete(COOKIE_NAME); }
