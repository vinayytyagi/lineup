import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "lineup_session";

function getSecretKey() {
  const secret = process.env.LINEUP_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      // Dev fallback so local setup still works.
      return new TextEncoder().encode("lineup-dev-secret-change-me");
    }
    throw new Error(
      "Missing LINEUP_JWT_SECRET. Add it to your environment (e.g. .env.local).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession({ userId, email }) {
  const key = getSecretKey();
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifySession(token) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);
  return payload;
}

export async function getSessionFromCookies() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = await verifySession(token);
    return payload;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSessionFromCookies();
  if (!session?.userId) return null;
  return { userId: String(session.userId), email: session.email ? String(session.email) : null };
}

export function setSessionCookie(res, token) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(res) {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

