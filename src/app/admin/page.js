"use client";

import { useEffect, useState } from "react";
import StudyTimeline from "@/components/study-timeline/StudyTimeline";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

async function apiUsers() {
  const res = await fetch("/api/admin/users");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Forbidden");
  return data.users || [];
}

async function apiUser(id) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed");
  return data.user;
}

async function apiAdminLogin(password) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Invalid password");
  return true;
}

async function apiAdminLogout() {
  await fetch("/api/admin/logout", { method: "POST" });
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("profile"); // profile | lineup
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [stage, setStage] = useState("checking"); // checking | login | panel

  useEffect(() => {
    (async () => {
      try {
        const list = await apiUsers();
        setUsers(list);
        if (list[0]?.userId) setSelectedId(list[0].userId);
        setStage("panel");
      } catch {
        setError("");
        setStage("login");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const u = await apiUser(selectedId);
        setSelectedUser(u);
        setError("");
      } catch (e) {
        setError(e?.message || "Failed");
      }
    })();
  }, [selectedId]);

  if (stage === "checking") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-10 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-3xl rounded-2xl bg-(--card) p-4 ring-1 ring-slate-200 sm:rounded-3xl sm:p-6">
          <div className="text-base font-semibold">Admin</div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">Loading…</div>
        </div>
      </div>
    );
  }

  if (stage === "login") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-10 text-[color:var(--foreground)]">
        <div className="mx-auto max-w-md rounded-2xl bg-(--card) p-4 ring-1 ring-slate-200 sm:rounded-3xl sm:p-6">
          <div className="text-base font-semibold">Admin Panel</div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Enter admin password to view users and lineups.
          </div>
          <form
            className="mt-5 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoggingIn(true);
              setError("");
              try {
                await apiAdminLogin(password);
                const list = await apiUsers();
                setUsers(list);
                if (list[0]?.userId) setSelectedId(list[0].userId);
                setStage("panel");
              } catch (err) {
                setError(err?.message || "Invalid password");
              } finally {
                setLoggingIn(false);
              }
            }}
          >
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              type="password"
              className="w-full rounded-2xl border border-slate-200 bg-(--card) px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
              required
            />
            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loggingIn}
              className={cx(
                "cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                loggingIn ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              {loggingIn ? "Checking…" : "Enter"}
            </button>
          </form>
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            Set <span className="font-mono">LINEUP_ADMIN_PANEL_PASSWORD</span> in .env
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-[color:var(--foreground)]">
      <div className="flex h-screen flex-col overflow-hidden lg:flex-row">
        <aside className="custom-scrollbar flex-shrink-0 overflow-y-auto border-b border-[color:var(--border)] bg-(--card) lg:w-[280px] lg:border-b-0 lg:border-r xl:w-[320px]">
          <div className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Admin Panel</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Users: {users.length}
                </div>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-full bg-(--card) px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-(--card-2)"
                onClick={async () => {
                  await apiAdminLogout();
                  setUsers([]);
                  setSelectedId(null);
                  setSelectedUser(null);
                  setError("");
                  setStage("login");
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="custom-scrollbar max-h-[40vh] overflow-y-auto px-2 pb-3 sm:max-h-none lg:px-3">
            {users.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelectedId(u.userId)}
                className={cx(
                  "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left ring-1 ring-transparent transition hover:bg-(--card-2)",
                  selectedId === u.userId ? "bg-(--card-2) ring-slate-200" : "",
                )}
              >
                <div className="h-9 w-9 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200">
                  {u.avatarDataUrl || u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarDataUrl || u.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {u.name || u.email}
                  </div>
                  <div className="truncate text-xs text-[color:var(--muted)]">
                    {u.email} {u.role === "admin" ? "• admin" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[color:var(--border)] px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  {selectedUser ? selectedUser.name || selectedUser.email : "—"}
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {selectedUser ? selectedUser.email : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab("profile")}
                  className={cx(
                    "cursor-pointer rounded-full px-4 py-2 text-sm font-medium ring-1 ring-slate-200",
                    tab === "profile" ? "bg-blue-600 text-white ring-blue-600" : "bg-(--card) hover:bg-(--card-2)",
                  )}
                >
                  View profile
                </button>
                <button
                  type="button"
                  onClick={() => setTab("lineup")}
                  className={cx(
                    "cursor-pointer rounded-full px-4 py-2 text-sm font-medium ring-1 ring-slate-200",
                    tab === "lineup" ? "bg-blue-600 text-white ring-blue-600" : "bg-(--card) hover:bg-(--card-2)",
                  )}
                >
                  View lineup
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <div className="px-4 pt-3 sm:px-6 sm:pt-4">
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {error}
              </div>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="custom-scrollbar overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="max-w-2xl rounded-2xl bg-(--card) p-4 ring-1 ring-slate-200 sm:rounded-3xl sm:p-6">
                <div className="text-sm font-semibold">Profile</div>
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[color:var(--muted)]">Name</span>
                    <span className="truncate font-medium">{selectedUser?.name || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[color:var(--muted)]">Email</span>
                    <span className="truncate font-medium">{selectedUser?.email || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[color:var(--muted)]">Role</span>
                    <span className="font-medium">{selectedUser?.role || "user"}</span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[color:var(--muted)]">Created</span>
                    <span className="font-medium">{selectedUser?.createdAt || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              {selectedId ? (
                <StudyTimeline viewAsUserId={selectedId} readOnly />
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

