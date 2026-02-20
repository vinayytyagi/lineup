import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "lineup_auth";

function getSecretKey() {
  const secret = process.env.LINEUP_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return new TextEncoder().encode("lineup-dev-secret-change-me");
    }
    throw new Error(
      "Missing LINEUP_JWT_SECRET. Add it to your environment (e.g. .env.local).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken({ userId, email }) {
  const key = getSecretKey();
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifyAuthToken(token) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);
  return payload;
}

function parseTokenFromRequest(request) {
  if (!request) return null;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(
    new RegExp(`(?:^|;)\\s*${AUTH_COOKIE_NAME}=([^;]+)`),
  );
  return m ? m[1] : null;
}

export async function getAuthFromRequest(request) {
  // Prefer cookies() - most reliable for same-origin cookie-based auth
  const c = await cookies();
  let token = c.get(AUTH_COOKIE_NAME)?.value ?? null;
  if (!token && request) {
    token = parseTokenFromRequest(request);
  }
  if (!token) return null;
  try {
    const payload = await verifyAuthToken(token);
    return payload;
  } catch {
    return null;
  }
}

export async function requireUser(request) {
  const payload = await getAuthFromRequest(request);
  if (!payload?.userId) return null;
  return {
    userId: String(payload.userId),
    email: payload.email ? String(payload.email) : null,
  };
}

export function setAuthCookie(res, token) {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookie(res) {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}


