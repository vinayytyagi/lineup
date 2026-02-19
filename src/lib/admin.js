import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "lineup_admin_session";

function getSecretKey() {
  const secret = process.env.LINEUP_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return new TextEncoder().encode("lineup-dev-secret-change-me");
    }
    throw new Error("Missing LINEUP_JWT_SECRET");
  }
  return new TextEncoder().encode(secret);
}

/** Admin panel password from env. No admin account - just this password. */
export function getAdminPanelPassword() {
  return process.env.LINEUP_ADMIN_PANEL_PASSWORD || "";
}

export async function signAdminSession() {
  const key = getSecretKey();
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyAdminSession(token) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key);
  return payload;
}

export async function getAdminSessionFromCookies() {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAdminSession(token);
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getAdminSessionFromCookies();
  if (!session?.admin) return null;
  return { admin: true };
}

export function setAdminCookie(res, token) {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminCookie(res) {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
