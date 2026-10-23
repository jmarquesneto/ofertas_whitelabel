/**
 * Tokens de sessão (JWT HS256 via jose — compatível com Edge/middleware).
 *
 * Dois cookies:
 *  - PRE_COOKIE  : etapa intermediária após senha correta (10 min).
 *                  stage = "setup" (precisa cadastrar o Authenticator) | "totp" (precisa digitar código)
 *  - SESSION_COOKIE : sessão completa, só emitida após o código TOTP válido.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "vt_session";
export const PRE_COOKIE = "vt_pre";
export const SESSION_TTL_S = 60 * 60 * 12; // 12h
export const PRE_TTL_S = 60 * 10; // 10min

export type SessionClaims = { sub: string; v: number; stage: "full" };
export type PreClaims = { sub: string; stage: "setup" | "totp" };

const secret = () => new TextEncoder().encode(process.env.APP_SECRET ?? "");

export async function signToken(claims: SessionClaims | PreClaims, ttlSeconds: number) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret());
}

export async function verifyToken<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});
