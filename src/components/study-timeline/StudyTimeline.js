"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  addDaysToDayKey,
  dayKeyFromLocalDate,
  formatDayLabel,
  formatWeekdayLabel,
  scheduledIsoFromDayKey,
} from "@/lib/date";
import { formatMinutes } from "@/lib/time";

const INITIAL_PAST_DAYS = 5;
const INITIAL_FUTURE_DAYS = 5;
const PAGE_SIZE_DAYS = 10;

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function SunIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93 6.34 6.34" />
      <path d="M17.66 17.66 19.07 19.07" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07 6.34 17.66" />
      <path d="M17.66 6.34 19.07 4.93" />
    </svg>
  );
}

function MoonIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function ChevronDownIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function makeRangeAround(dayKey, pastDays, futureDays) {
  const out = [];
  for (let i = -pastDays; i <= futureDays; i++) {
    out.push(addDaysToDayKey(dayKey, i));
  }
  return out;
}

function buildDayKeyRange(startDayKey, endDayKeyExclusive) {
  const out = [];
  let cur = startDayKey;
  while (cur < endDayKeyExclusive) {
    out.push(cur);
    cur = addDaysToDayKey(cur, 1);
  }
  return out;
}

function mergeTasksIntoByDay(prev, tasks) {
  const next = { ...prev };
  for (const t of tasks) {
    const dayKey = t.dayKey || String(t.scheduledDate).slice(0, 10);
    const arr = next[dayKey] ? [...next[dayKey]] : [];
    const existingIdx = arr.findIndex((x) => x._id === t._id);
    if (existingIdx !== -1) arr[existingIdx] = t;
    else arr.push(t);
    next[dayKey] = arr;
  }
  return next;
}

async function apiGetTasks(startDayKey, endDayKeyExclusive, viewAsUserId) {
  const start = scheduledIsoFromDayKey(startDayKey);
  const end = scheduledIsoFromDayKey(endDayKeyExclusive);
  const url = viewAsUserId
    ? `/api/admin/users/${encodeURIComponent(viewAsUserId)}/tasks?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    : `/api/tasks?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to fetch tasks");
  return data.tasks || [];
}

async function apiCreateTask({ dayKey, videoUrl, notes, timeToComplete }) {
  const scheduledDate = scheduledIsoFromDayKey(dayKey);
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scheduledDate, videoUrl, notes, timeToComplete }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to create task");
  return data.task;
}

async function apiUpdateTask(id, { videoUrl, notes, timeToComplete }) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoUrl, notes, timeToComplete }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to update task");
  return data.task;
}

async function apiDeleteTask(id) {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to delete task");
  return true;
}

async function apiBulkReorder(updates) {
  const res = await fetch("/api/tasks/reorder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to reorder");
  return true;
}

async function apiAuthMe() {
  const res = await fetch("/api/auth/me");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.user || null;
}

async function apiAuthLogin({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Login failed");
  return data.user;
}

async function apiAuthSignup({ email, password }) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Signup failed");
  return data.user;
}

async function apiAuthLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

async function apiYouTubeMeta(videoUrl) {
  const res = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(videoUrl)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to fetch video metadata");
  return data.meta;
}

async function apiProfileGet() {
  const res = await fetch("/api/profile");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to load profile");
  return data.profile;
}

async function apiProfilePatch({ name, avatarUrl, avatarDataUrl }) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, avatarUrl, avatarDataUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to save profile");
  return data.profile;
}

function PlusIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function NoteIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function KebabIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5h.01" />
      <path d="M12 12h.01" />
      <path d="M12 19h.01" />
    </svg>
  );
}

function PencilIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function TargetIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function TimelineHeader({
  onToday,
  onJumpToDayKey,
  theme,
  onToggleTheme,
  searchQuery,
  onSearchQueryChange,
  searchCount,
  activeSearchIndex,
  onSearchNext,
  onSearchPrev,
  onSearchClear,
  authMode,
  userEmail,
  userName,
  userAvatarUrl,
  onOpenAuth,
  onOpenProfile,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-(--background)/80 backdrop-blur">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 sm:flex-initial">
          <div className="flex h-10 shrink-0 items-center justify-center sm:h-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Lineup.png" alt="Lineup" className="h-8 w-auto object-contain sm:h-12" />
          </div>
          <div className="min-w-0 flex flex-col">
            <h1 className="truncate text-base font-semibold tracking-tight text-[color:var(--foreground)] sm:text-lg">
              Lineup
            </h1>
            <p className="hidden text-sm text-[color:var(--muted)] sm:block">
              Tasks grouped by date.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full bg-(--card) px-3 py-2 text-sm ring-1 ring-slate-200 md:flex">
            <SearchIcon className="text-[color:var(--muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) onSearchPrev();
                  else onSearchNext();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  onSearchNext();
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  onSearchPrev();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onSearchClear();
                }
              }}
              placeholder="Search tasks…"
              className="w-40 min-w-0 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-slate-400 sm:w-[260px]"
            />

            {searchQuery.trim().length ? (
              <button
                type="button"
                onClick={onSearchClear}
                className="cursor-pointer rounded-full p-1 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
                aria-label="Clear search"
                title="Clear"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : null}

            <div className="ml-1 flex items-center gap-1">
              <div className="rounded-full bg-(--card-2) px-2 py-1 text-xs text-[color:var(--muted)]">
                {searchQuery.trim().length
                  ? `${searchCount === 1 ? "" : ""}${
                      searchCount ? `${activeSearchIndex + 1}/${searchCount}` : ""
                    }`
                  : "Search"}
              </div>
              <button
                type="button"
                onClick={onSearchPrev}
                disabled={!searchCount}
                className={cx(
                  "cursor-pointer rounded-full p-1 ring-1 ring-slate-200",
                  searchCount
                    ? "bg-(--card) text-[color:var(--foreground)] hover:bg-(--card-2)"
                    : "bg-(--card) text-[color:var(--muted)] opacity-60",
                )}
                aria-label="Previous result"
                title="Previous (↑)"
              >
                <ChevronUpIcon />
              </button>
              <button
                type="button"
                onClick={onSearchNext}
                disabled={!searchCount}
                className={cx(
                  "cursor-pointer rounded-full p-1 ring-1 ring-slate-200",
                  searchCount
                    ? "bg-(--card) text-[color:var(--foreground)] hover:bg-(--card-2)"
                    : "bg-(--card) text-[color:var(--muted)] opacity-60",
                )}
                aria-label="Next result"
                title="Next (↓ / Enter)"
              >
                <ChevronDownIcon />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-(--card) px-4 py-2 text-sm font-medium text-[color:var(--foreground)] shadow-sm ring-1 ring-slate-200 hover:bg-(--card-2)"
          >
            <TargetIcon className="text-blue-600" />
            Today
          </button>
          <div className="hidden items-center gap-2 rounded-full bg-(--card) px-3 py-2 text-sm ring-1 ring-slate-200 sm:flex">
            <span className="text-[color:var(--muted)]">Jump</span>
            <input
              id="jump-date-input"
              type="date"
              onChange={(e) => {
                const v = e.target.value; // YYYY-MM-DD
                if (v) onJumpToDayKey(v);
              }}
              className="cursor-pointer bg-transparent text-sm text-[color:var(--foreground)] outline-none"
            />
          </div>

          {authMode === "admin" ? (
            <div className="hidden rounded-full bg-(--card) px-3 py-2 text-sm text-[color:var(--muted)] ring-1 ring-slate-200 sm:flex">
              Read-only
            </div>
          ) : authMode === "guest" ? (
            <>
              <div className="hidden rounded-full bg-(--card) px-3 py-2 text-sm text-[color:var(--muted)] ring-1 ring-slate-200 sm:flex">
                Guest
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Login
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenProfile}
              className="hidden cursor-pointer items-center gap-2 rounded-full bg-(--card) px-3 py-2 text-sm text-[color:var(--foreground)] ring-1 ring-slate-200 hover:bg-(--card-2) sm:inline-flex"
              title="Profile"
            >
              <span className="inline-flex h-6 w-6 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200">
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="max-w-[180px] truncate">
                {userName || userEmail || "Account"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-(--card) p-2 text-[color:var(--foreground)] shadow-sm ring-1 ring-slate-200 hover:bg-(--card-2)"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}

function AuthModal({ open, mode, onModeChange, onClose, onSubmit, error, submitting }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-3xl bg-(--card) p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">
              {mode === "login" ? "Login" : "Sign up"}
            </div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {mode === "login"
                ? "Access your saved Lineup."
                : "Create an account to save your Lineup."}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
            aria-label="Close auth modal"
          >
            <XIcon />
          </button>
        </div>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ email, password });
          }}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-2xl border border-slate-200 bg-(--card) px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
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
            disabled={submitting}
            className={cx(
              "w-full cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
              submitting
                ? "bg-blue-400"
                : "bg-blue-600 hover:bg-blue-700",
            )}
          >
            {submitting
              ? mode === "login"
                ? "Logging in…"
                : "Creating…"
              : mode === "login"
                ? "Login"
                : "Sign up"}
          </button>

          <div className="pt-1 text-center text-sm text-[color:var(--muted)]">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => onModeChange("signup")}
                  className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => onModeChange("login")}
                  className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700"
                >
                  Login
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ProfileModal({ open, profile, onClose, onSave, onLogout }) {
  const [name, setName] = useState(profile?.name || "");
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile?.avatarDataUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(profile?.name || "");
    setAvatarDataUrl(profile?.avatarDataUrl || "");
    setSaving(false);
    setError("");
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-3xl bg-(--card) p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">
              Profile
            </div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {profile?.email || ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
            aria-label="Close profile"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-(--card) px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              Avatar (upload)
            </label>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200">
                {avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full cursor-pointer text-sm text-[color:var(--muted)] file:mr-3 file:rounded-full file:border-0 file:bg-(--card-2) file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[color:var(--foreground)] hover:file:opacity-90"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 250 * 1024) {
                      setError("Please use an image under 250KB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setError("");
                      setAvatarDataUrl(String(reader.result || ""));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {avatarDataUrl ? (
                  <button
                    type="button"
                    className="cursor-pointer rounded-full bg-(--card) px-3 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-slate-200 hover:bg-(--card-2)"
                    onClick={() => setAvatarDataUrl("")}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="cursor-pointer rounded-full bg-(--card) px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-slate-200 hover:bg-red-50"
                >
                  Logout
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full bg-(--card) px-4 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-slate-200 hover:bg-(--card-2)"
              >
                Close
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError("");
                  try {
                    await onSave({ name, avatarDataUrl });
                    onClose();
                  } catch (e) {
                    setError(e?.message || "Failed to save");
                  } finally {
                    setSaving(false);
                  }
                }}
                className={cx(
                  "cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white transition",
                  saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
                )}
              >
              {saving ? "Saving…" : "Save"}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotePopover({ open, notes, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-3 top-10 z-30 w-[320px] rounded-2xl bg-(--card) p-4 shadow-xl ring-1 ring-slate-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-[color:var(--foreground)]">
          Notes
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="cursor-pointer rounded-md p-1 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
          aria-label="Close notes"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--foreground)]">
        {notes}
      </div>
    </div>
  );
}

function PlayIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx("h-5 w-5", className)}
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function VideoPlayerModal({ open, videoUrl, title, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  let embedSrc = null;
  try {
    const u = new URL(videoUrl);
    let id = u.searchParams.get("v");
    if (!id && u.hostname === "youtu.be") id = u.pathname.replace("/", "");
    if (!id) {
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx !== -1 && parts[idx + 1]) id = parts[idx + 1];
    }
    if (id) {
      embedSrc = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
    }
  } catch {
    // ignore
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-(--card) shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-semibold text-[color:var(--foreground)]">
              {title || "Video"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
            aria-label="Close player"
          >
            <XIcon />
          </button>
        </div>
        <div className="relative aspect-video w-full bg-black">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={title || "YouTube video player"}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/80">
              Invalid YouTube link
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CARD_SIZE_CLASS =
  "w-[140px] h-[160px] sm:w-[200px] sm:h-[220px] md:w-[180px] md:h-[188px] lg:w-[192px] lg:h-[182px]";
const VIDEO_THUMB_CLASS = "h-[84px] sm:h-[120px] md:h-[100px] lg:h-[108px]";

function VideoCard({ task, onOpenNotes, onPlay }) {
  const completeLabel = formatMinutes(task.timeToComplete);

  return (
    <div
      className={cx(
        "relative flex shrink-0 flex-col overflow-hidden rounded-2xl bg-(--card) shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md",
        CARD_SIZE_CLASS,
      )}
      onClick={(e) => e.stopPropagation()}
      role="group"
    >
      <div className={cx("relative shrink-0 w-full overflow-hidden bg-slate-100", VIDEO_THUMB_CLASS)}>
        {task.thumbnailUrl ? (
          <Image
            src={task.thumbnailUrl}
            alt=""
            fill
            className="object-cover"
            sizes="300px"
            priority={false}
          />
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.();
          }}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition hover:bg-black/20"
          aria-label="Play"
          title="Play"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm ring-1 ring-white/60 sm:h-12 sm:w-12">
            <PlayIcon className="h-4 w-4 translate-x-px sm:h-6 sm:w-6" />
          </span>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between px-2 pb-2.5 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2">
        <a
          href={task.videoUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-2 cursor-pointer text-[11px] font-semibold leading-tight text-[color:var(--foreground)] hover:text-blue-600 sm:text-xs"
          title={task.title || ""}
        >
          {task.title || "Untitled video"}
        </a>

        <div className="mt-1 flex shrink-0 items-center justify-between gap-1.5 text-[10px] text-[color:var(--muted)] sm:mt-1.5 sm:gap-2 sm:text-[11px]">
          <div className="min-w-0">
            <span className="font-medium text-[color:var(--muted)]">
              {task.videoDuration || "—"}
            </span>
            <span className="px-2">•</span>
            <span>{completeLabel}</span>
          </div>

          {task.notes ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenNotes();
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-(--card-2) px-2 py-1 text-[color:var(--foreground)] ring-1 ring-slate-200 hover:opacity-90"
              aria-label="Open notes"
            >
              <NoteIcon />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ task, onOpen }) {
  const completeLabel = formatMinutes(task.timeToComplete);

  return (
    <button
      type="button"
      className={cx(
        "flex shrink-0 cursor-pointer flex-col justify-between rounded-2xl bg-(--card) px-3 pb-2.5 pt-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md sm:px-4 sm:pb-3 sm:pt-4",
        CARD_SIZE_CLASS,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border-l-4 border-blue-500/50 pl-2 sm:pl-3">
        <div className="line-clamp-3 text-[11px] leading-4.5 text-[color:var(--foreground)] sm:line-clamp-4 sm:text-xs sm:leading-5">
          {task.notes || "—"}
        </div>
      </div>
      <div className="mt-2 shrink-0 text-[10px] font-medium text-[color:var(--muted)] sm:text-[11px]">
        {completeLabel}
      </div>
    </button>
  );
}

function AddCard({ onAdd }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className={cx(
        "group/add flex shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-(--row-hover) text-blue-700 ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-sm",
        CARD_SIZE_CLASS,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--card) text-blue-600 ring-1 ring-blue-100 transition group-hover/add:scale-105 sm:h-10 sm:w-10">
          <PlusIcon />
        </div>
        <div className="text-xs font-semibold sm:text-sm">Add</div>
      </div>
    </button>
  );
}

function TaskMenu({ open, onClose, onEdit, onDelete }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-2 top-10 z-40 w-40 overflow-hidden rounded-2xl bg-(--card) shadow-xl ring-1 ring-slate-200"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-[color:var(--foreground)] hover:bg-(--card-2)"
        onClick={() => {
          onClose();
          onEdit();
        }}
      >
        <PencilIcon className="text-slate-600" />
        Edit
      </button>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        <TrashIcon className="text-red-600" />
        Delete
      </button>
    </div>
  );
}

function DateRow({
  dayKey,
  isToday,
  tasks,
  onAdd,
  onEditTask,
  onDeleteTask,
  onOpenNoteTask,
  onPlayVideo,
  dragTask,
  dragOver,
  setDragOver,
  onDropTask,
  onDragStartTask,
  onDragEndTask,
  searchQuery,
  activeSearchTaskId,
  openNotesTaskId,
  setOpenNotesTaskId,
  openMenuTaskId,
  setOpenMenuTaskId,
  readOnly,
}) {
  const sortedTasks = useMemo(() => {
    const list = [...(tasks || [])];
    list.sort((a, b) => {
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const ac = a.createdAt ? String(a.createdAt) : "";
      const bc = b.createdAt ? String(b.createdAt) : "";
      if (ac !== bc) return ac < bc ? 1 : -1;
      return 0;
    });
    return list;
  }, [tasks]);

  return (
    <div
      id={`day-${dayKey}`}
      className="group w-full border-b border-[color:var(--border)]"
    >
      <div className="flex px-4 sm:px-6">
        <div
          className={cx(
            "relative flex w-14 shrink-0 items-center sm:w-28 md:w-36 lg:w-[200px]",
          )}
        >
          <div
            className={cx(
              "w-full rounded-2xl px-4 py-2 sm:py-3",
              isToday
                ? "bg-(--today-bg) ring-1 ring-[color:var(--today-ring)]"
                : "bg-transparent",
            )}
          >
            {isToday ? (
              <div className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-blue-500" />
            ) : null}

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-[color:var(--foreground)] sm:text-base">
                  {formatDayLabel(dayKey)}
                </div>
                <div className="text-xs text-[color:var(--muted)] sm:text-sm">
                  {formatWeekdayLabel(dayKey)}
                </div>
              </div>
              {isToday ? (
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className={cx(
              "relative rounded-2xl px-4 py-2 transition sm:py-3"
            )}
          >
            <div
              className="no-scrollbar flex items-start gap-4 overflow-x-auto pb-2 pr-2"
              onDragOver={(e) => {
                if (!dragTask) return;
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                setDragOver({ dayKey, index: sortedTasks.length });
              }}
              onDrop={(e) => {
                if (!dragTask) return;
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                onDropTask({ toDayKey: dayKey, toIndex: sortedTasks.length });
              }}
            >
              {sortedTasks.map((t, idx) => {
                const q = (searchQuery || "").trim().toLowerCase();
                const isMatch =
                  q.length > 0
                    ? `${t.title || ""}\n${t.notes || ""}`
                        .toLowerCase()
                        .includes(q)
                    : false;
                const isActive = isMatch && activeSearchTaskId === t._id;

                return (
                  <div
                    id={`task-${t._id}`}
                    key={t._id}
                    draggable={!readOnly}
                    onDragStart={(e) => {
                      if (readOnly) return;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t._id);
                      onDragStartTask?.(t, dayKey);
                    }}
                    onDragEnd={() => {
                      setDragOver(null);
                      onDragEndTask?.();
                    }}
                    onDragOver={(e) => {
                      if (readOnly) return;
                      if (!dragTask) return;
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const before = e.clientX < rect.left + rect.width / 2;
                      setDragOver({ dayKey, index: before ? idx : idx + 1 });
                    }}
                    onDrop={(e) => {
                      if (readOnly) return;
                      if (!dragTask) return;
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const before = e.clientX < rect.left + rect.width / 2;
                      onDropTask({ toDayKey: dayKey, toIndex: before ? idx : idx + 1 });
                    }}
                    className={cx(
                      "group/card relative shrink-0 rounded-2xl transition",
                      dragTask?.id === t._id ? "opacity-60" : "",
                      isMatch ? "ring-2 ring-blue-400/70" : "",
                      isActive ? "ring-2 ring-blue-600 shadow-lg" : "",
                    )}
                  >
                    {dragOver?.dayKey === dayKey && dragOver.index === idx ? (
                      <div
                        className="pointer-events-none absolute -left-3 top-0 h-[160px] w-1 rounded-full bg-blue-500/70 sm:h-[220px] md:h-[188px] lg:h-[182px]"
                      />
                    ) : null}
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-30 cursor-pointer rounded-full bg-(--card)/90 p-1.5 text-[color:var(--muted)] shadow-sm ring-1 ring-slate-200 opacity-0 transition group-hover/card:opacity-100 group-focus-within/card:opacity-100 hover:bg-(--card) hover:text-[color:var(--foreground)]"
                    aria-label="Task options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuTaskId(openMenuTaskId === t._id ? null : t._id);
                    }}
                    disabled={readOnly}
                  >
                    <KebabIcon className="h-4 w-4" />
                  </button>

                  <TaskMenu
                    open={openMenuTaskId === t._id}
                    onClose={() => setOpenMenuTaskId(null)}
                    onEdit={() => onEditTask(t)}
                    onDelete={() => onDeleteTask(t)}
                  />

                  {t.type === "video" ? (
                    <>
                      <VideoCard
                        task={t}
                        onPlay={() => onPlayVideo?.(t)}
                        onOpenNotes={() =>
                          setOpenNotesTaskId(
                            openNotesTaskId === t._id ? null : t._id,
                          )
                        }
                      />
                      <NotePopover
                        open={openNotesTaskId === t._id}
                        notes={t.notes}
                        onClose={() => setOpenNotesTaskId(null)}
                      />
                    </>
                  ) : (
                    <NoteCard task={t} onOpen={() => onOpenNoteTask(t)} />
                  )}
                  </div>
                );
              })}

              {dragOver?.dayKey === dayKey && dragOver.index === sortedTasks.length ? (
                <div className="h-[160px] w-1 shrink-0 rounded-full bg-blue-500/70 sm:h-[220px] md:h-[188px] lg:h-[182px]" />
              ) : null}
  
              {!readOnly ? (
                <div className="shrink-0">
                  <AddCard onAdd={() => onAdd(dayKey)} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTaskModal({ open, dayKey, task, onClose, onSaved, onSaveTask }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [timePreset, setTimePreset] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSubmitting(false);
    const initialVideo = task?.videoUrl || "";
    const initialNotes = task?.notes || "";
    const initialMinutes =
      typeof task?.timeToComplete === "number" ? task.timeToComplete : null;

    setVideoUrl(initialVideo);
    setNotes(initialNotes);
    setTimePreset(
      initialMinutes && [30, 60, 120, 1440].includes(initialMinutes)
        ? initialMinutes
        : null,
    );
    setCustomMinutes(
      initialMinutes && ![30, 60, 120, 1440].includes(initialMinutes)
        ? String(initialMinutes)
        : "",
    );
  }, [open, dayKey, task]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const resolvedMinutes = useMemo(() => {
    if (timePreset) return timePreset;
    const n = Number(customMinutes);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) return n;
    return null;
  }, [timePreset, customMinutes]);

  if (!open) return null;

  const dayLabel = `${formatDayLabel(dayKey)} • ${formatWeekdayLabel(dayKey)}`;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedVideo = videoUrl.trim();
    const trimmedNotes = notes.trim();

    if (!resolvedMinutes) {
      setError("Time to complete is required.");
      return;
    }
    if (!trimmedVideo && !trimmedNotes) {
      setError("Add a YouTube link or write a note.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = await onSaveTask({
        dayKey,
        taskId: task?._id || null,
        videoUrl: trimmedVideo || null,
        notes: trimmedNotes || null,
        timeToComplete: resolvedMinutes,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  const presets = [
    { label: "30 min", minutes: 30 },
    { label: "1 hr", minutes: 60 },
    { label: "2 hr", minutes: 120 },
    { label: "1 day", minutes: 1440 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add task"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-3xl bg-(--card) p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">
              {task?._id ? "Edit task" : "Add task"}
            </div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">{dayLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
            aria-label="Close modal"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              YouTube link (optional)
            </label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-(--card) px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[color:var(--foreground)]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What do you want to do?"
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-(--card) px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                Time to complete (required)
              </label>
              <div className="text-xs text-[color:var(--muted)]">
                {resolvedMinutes ? `Selected: ${formatMinutes(resolvedMinutes)}` : ""}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => {
                const active = timePreset === p.minutes;
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => {
                      setTimePreset(active ? null : p.minutes);
                      setCustomMinutes("");
                    }}
                    className={cx(
                      "cursor-pointer rounded-full px-3 py-2 text-sm font-medium ring-1 transition",
                      active
                        ? "bg-blue-600 text-white ring-blue-600"
                        : "bg-(--card) text-[color:var(--foreground)] ring-slate-200 hover:bg-(--card-2)",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-2">
                <input
                  value={customMinutes}
                  onChange={(e) => {
                    setTimePreset(null);
                    setCustomMinutes(e.target.value.replace(/[^\d]/g, ""));
                  }}
                  inputMode="numeric"
                  placeholder="Custom (min)"
                  className="w-[140px] rounded-full border border-slate-200 bg-(--card) px-3 py-2 text-sm text-[color:var(--foreground)] outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full bg-(--card) px-4 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-slate-200 hover:bg-(--card-2)"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cx(
                "cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white transition",
                submitting ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              {submitting
                ? task?._id
                  ? "Saving…"
                  : "Adding…"
                : task?._id
                  ? "Save"
                  : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoteViewModal({ open, task, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Note"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-3xl bg-(--card) p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Note</div>
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              {formatMinutes(task.timeToComplete)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
            aria-label="Close note"
          >
            <XIcon />
          </button>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
          {task.notes}
        </div>
      </div>
    </div>
  );
}

export default function StudyTimeline({ viewAsUserId = null, readOnly = false } = {}) {
  const todayKey = useMemo(() => dayKeyFromLocalDate(new Date()), []);
  const [dates, setDates] = useState(() =>
    makeRangeAround(todayKey, INITIAL_PAST_DAYS, INITIAL_FUTURE_DAYS),
  );
  const [tasksByDay, setTasksByDay] = useState({});
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null);
  const [noteViewTask, setNoteViewTask] = useState(null);
  const [openNotesTaskId, setOpenNotesTaskId] = useState(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [theme, setTheme] = useState("light");
  const [deleteModalTask, setDeleteModalTask] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [playerTask, setPlayerTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [dragTask, setDragTask] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [authMode, setAuthMode] = useState(viewAsUserId ? "admin" : "loading"); // loading | guest | user | admin
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("login"); // login | signup
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  const scrollerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);

  const loadedSegmentsRef = useRef(new Set());
  const pendingPrependRestoreRef = useRef(null);
  const didCenterTodayRef = useRef(false);
  const fetchingRef = useRef(false);
  const refreshedVideoIdsRef = useRef(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lineup-theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
      else setTheme("light");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("lineup-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Auth bootstrap: default Guest unless cookie session exists.
  useEffect(() => {
    if (viewAsUserId) return;
    let cancelled = false;
    (async () => {
      const me = await apiAuthMe();
      if (cancelled) return;
      if (me?.userId) {
        setUser(me);
        setAuthMode("user");
      } else {
        setUser(null);
        setAuthMode("guest");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewAsUserId]);

  const firstDayKey = dates[0];
  const lastDayKey = dates[dates.length - 1];
  const endExclusiveKey = useMemo(() => addDaysToDayKey(lastDayKey, 1), [lastDayKey]);

  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const searchMatches = useMemo(() => {
    const q = normalizedSearchQuery;
    if (!q) return [];

    const matches = [];
    const sortKey = (t) => ({
      order: Number.isFinite(Number(t.order)) ? Number(t.order) : Number.POSITIVE_INFINITY,
      createdAt: t.createdAt ? String(t.createdAt) : "",
    });

    for (const dayKey of dates) {
      const list = tasksByDay[dayKey] || [];
      const sorted = [...list].sort((a, b) => {
        const ka = sortKey(a);
        const kb = sortKey(b);
        if (ka.order !== kb.order) return ka.order - kb.order;
        // createdAt desc (string ISO works)
        if (ka.createdAt !== kb.createdAt) return ka.createdAt < kb.createdAt ? 1 : -1;
        return 0;
      });

      for (const t of sorted) {
        const hay = `${t.title || ""}\n${t.notes || ""}`.toLowerCase();
        if (hay.includes(q)) matches.push({ dayKey, taskId: t._id });
      }
    }
    return matches;
  }, [normalizedSearchQuery, dates, tasksByDay]);

  const activeSearchTaskId =
    searchMatches.length > 0 ? searchMatches[activeSearchIndex]?.taskId : null;

  function scrollToTaskId(taskId) {
    if (!taskId) return;
    const el = document.getElementById(`task-${taskId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  useEffect(() => {
    if (!normalizedSearchQuery) {
      setActiveSearchIndex(0);
      return;
    }
    setActiveSearchIndex(0);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    if (!normalizedSearchQuery) return;
    if (!searchMatches.length) return;
    // Clamp index if result set shrank.
    if (activeSearchIndex >= searchMatches.length) {
      setActiveSearchIndex(0);
      return;
    }
    scrollToTaskId(searchMatches[activeSearchIndex]?.taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearchQuery, searchMatches.length, activeSearchIndex]);

  function searchNext() {
    if (!searchMatches.length) return;
    setActiveSearchIndex((i) => (i + 1) % searchMatches.length);
  }

  function searchPrev() {
    if (!searchMatches.length) return;
    setActiveSearchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length);
  }

  function clearSearch() {
    setSearchQuery("");
    setActiveSearchIndex(0);
  }

  function guestNextId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `guest_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async function saveTask({ dayKey, taskId, videoUrl, notes, timeToComplete }) {
    if (authMode === "user") {
      if (taskId) {
        return await apiUpdateTask(taskId, { videoUrl, notes, timeToComplete });
      }
      return await apiCreateTask({ dayKey, videoUrl, notes, timeToComplete });
    }

    // Guest mode: in-memory only (lost on refresh).
    const scheduledDate = scheduledIsoFromDayKey(dayKey);
    const nowIso = new Date().toISOString();

    let type = videoUrl ? "video" : "note";
    let title = null;
    let thumbnailUrl = null;
    let videoDuration = null;

    if (videoUrl) {
      const meta = await apiYouTubeMeta(videoUrl);
      title = meta.title;
      thumbnailUrl = meta.thumbnailUrl;
      videoDuration = meta.videoDuration;
    } else if (notes) {
      title = notes.split("\n")[0].trim().slice(0, 80) || "Note";
    }

    const list = sortTasks(tasksByDay[dayKey] || []);
    const nextOrder = (list.length + 1) * 1000;

    if (taskId) {
      const existing = (tasksByDay[dayKey] || []).find((t) => t._id === taskId);
      return {
        ...(existing || {}),
        _id: taskId,
        type,
        title,
        videoUrl,
        thumbnailUrl,
        videoDuration,
        notes,
        scheduledDate,
        dayKey,
        timeToComplete,
        order: existing?.order ?? nextOrder,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };
    }

    return {
      _id: guestNextId(),
      type,
      title,
      videoUrl,
      thumbnailUrl,
      videoDuration,
      notes,
      scheduledDate,
      dayKey,
      timeToComplete,
      order: nextOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  function sortTasks(list) {
    const out = [...(list || [])];
    out.sort((a, b) => {
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const ac = a.createdAt ? String(a.createdAt) : "";
      const bc = b.createdAt ? String(b.createdAt) : "";
      if (ac !== bc) return ac < bc ? 1 : -1;
      return 0;
    });
    return out;
  }

  function withReindexedOrders(dayKey, list) {
    const scheduledDate = scheduledIsoFromDayKey(dayKey);
    return list.map((t, idx) => ({
      ...t,
      scheduledDate,
      dayKey,
      order: (idx + 1) * 1000,
    }));
  }

  async function handleDropTask({ toDayKey, toIndex }) {
    if (!dragTask?.id || !dragTask?.fromDayKey) return;
    if (reorderBusy) return;

    const fromDayKey = dragTask.fromDayKey;
    const fromSorted = sortTasks(tasksByDay[fromDayKey] || []);
    const moved = fromSorted.find((t) => t._id === dragTask.id);
    if (!moved) return;

    const fromIndex = fromSorted.findIndex((t) => t._id === dragTask.id);

    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const rawToIndex = clamp(Number(toIndex) || 0, 0, (tasksByDay[toDayKey] || []).length + 1);

    let nextByDay = tasksByDay;
    let updates = [];

    if (fromDayKey === toDayKey) {
      const without = fromSorted.filter((t) => t._id !== dragTask.id);
      let insertAt = rawToIndex;
      if (insertAt > fromIndex) insertAt = Math.max(0, insertAt - 1);
      insertAt = clamp(insertAt, 0, without.length);

      const nextList = [...without.slice(0, insertAt), moved, ...without.slice(insertAt)];
      const re = withReindexedOrders(fromDayKey, nextList);

      nextByDay = { ...tasksByDay, [fromDayKey]: re };
      updates = re.map((t) => ({
        id: t._id,
        scheduledDate: t.scheduledDate,
        order: t.order,
      }));
    } else {
      const toSorted = sortTasks(tasksByDay[toDayKey] || []);
      const fromWithout = fromSorted.filter((t) => t._id !== dragTask.id);
      const insertAt = clamp(rawToIndex, 0, toSorted.length);

      const movedAdjusted = { ...moved, dayKey: toDayKey, scheduledDate: scheduledIsoFromDayKey(toDayKey) };
      const toNext = [...toSorted.slice(0, insertAt), movedAdjusted, ...toSorted.slice(insertAt)];

      const reFrom = withReindexedOrders(fromDayKey, fromWithout);
      const reTo = withReindexedOrders(toDayKey, toNext);

      nextByDay = { ...tasksByDay, [fromDayKey]: reFrom, [toDayKey]: reTo };
      updates = [...reFrom, ...reTo].map((t) => ({
        id: t._id,
        scheduledDate: t.scheduledDate,
        order: t.order,
      }));
    }

    setTasksByDay(nextByDay);
    setDragOver(null);
    setDragTask(null);

    if (authMode === "user") {
      setReorderBusy(true);
      try {
        await apiBulkReorder(updates);
      } catch (e) {
        setFetchError(e?.message || "Failed to reorder");
      } finally {
        setReorderBusy(false);
      }
    }
  }

  async function fetchSegment(startKey, endKeyExclusive) {
    const segKey = `${startKey}..${endKeyExclusive}`;
    if (loadedSegmentsRef.current.has(segKey)) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setFetchError("");

    try {
      if (viewAsUserId) {
        const tasks = await apiGetTasks(startKey, endKeyExclusive, viewAsUserId);
        loadedSegmentsRef.current.add(segKey);
        setTasksByDay((prev) => mergeTasksIntoByDay(prev, tasks));
        return;
      }

      if (authMode !== "user") {
        // In guest mode we treat segments as "loaded" to avoid repeated work while scrolling.
        // In loading mode we do NOT cache, so that a discovered session can fetch immediately.
        if (authMode === "guest") loadedSegmentsRef.current.add(segKey);
        return;
      }

      const tasks = await apiGetTasks(startKey, endKeyExclusive, null);
      loadedSegmentsRef.current.add(segKey);
      setTasksByDay((prev) => mergeTasksIntoByDay(prev, tasks));

      // Best-effort: refresh older placeholder video tasks in background
      // (e.g. created when YouTube metadata fetch failed earlier).
      for (const t of tasks) {
        if (t.type !== "video" || !t.videoUrl) continue;
        const looksPlaceholder =
          !t.title ||
          t.title === "YouTube video" ||
          t.title === "Untitled video" ||
          !t.thumbnailUrl ||
          !t.videoDuration;
        if (!looksPlaceholder) continue;
        if (refreshedVideoIdsRef.current.has(t._id)) continue;
        refreshedVideoIdsRef.current.add(t._id);

        apiUpdateTask(t._id, {
          videoUrl: t.videoUrl,
          notes: t.notes || null,
          timeToComplete: t.timeToComplete,
        })
          .then((updated) => {
            setTasksByDay((prev) => mergeTasksIntoByDay(prev, [updated]));
          })
          .catch(() => {
            // Allow retry later (we previously had PATCH 404s).
            refreshedVideoIdsRef.current.delete(t._id);
          });
      }
    } catch (e) {
      setFetchError(e?.message || "Failed to fetch tasks");
    } finally {
      fetchingRef.current = false;
    }
  }

  // Initial fetch for the visible range.
  useEffect(() => {
    fetchSegment(firstDayKey, endExclusiveKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode]);

  // Restore scroll position after prepend.
  useLayoutEffect(() => {
    const pending = pendingPrependRestoreRef.current;
    const scroller = scrollerRef.current;
    if (!pending || !scroller) return;
    const newScrollHeight = scroller.scrollHeight;
    scroller.scrollTop = pending.prevScrollTop + (newScrollHeight - pending.prevScrollHeight);
    pendingPrependRestoreRef.current = null;
  }, [dates.length]);

  // Center on today once.
  useEffect(() => {
    if (didCenterTodayRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const el = document.getElementById(`day-${todayKey}`);
    if (!el) return;

    requestAnimationFrame(() => {
      const rowTop = el.offsetTop;
      const rowH = el.offsetHeight;
      const containerH = scroller.clientHeight;
      scroller.scrollTop = Math.max(0, rowTop - containerH / 2 + rowH / 2);
      didCenterTodayRef.current = true;
    });
  }, [todayKey]);

  // IntersectionObservers for infinite scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const mkObserver = (onHit) =>
      new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) onHit();
          }
        },
        { root: scroller, rootMargin: "400px 0px 400px 0px", threshold: 0 },
      );

    const topObs = mkObserver(async () => {
      const sc = scrollerRef.current;
      if (!sc) return;

      pendingPrependRestoreRef.current = {
        prevScrollTop: sc.scrollTop,
        prevScrollHeight: sc.scrollHeight,
      };

      const newStart = addDaysToDayKey(firstDayKey, -PAGE_SIZE_DAYS);
      const toAdd = buildDayKeyRange(newStart, firstDayKey);
      if (toAdd.length) setDates((prev) => [...toAdd, ...prev]);
      fetchSegment(newStart, firstDayKey);
    });

    const bottomObs = mkObserver(async () => {
      const newStart = addDaysToDayKey(lastDayKey, 1);
      const newEndExclusive = addDaysToDayKey(newStart, PAGE_SIZE_DAYS);
      const toAdd = buildDayKeyRange(newStart, newEndExclusive);
      if (toAdd.length) setDates((prev) => [...prev, ...toAdd]);
      fetchSegment(newStart, newEndExclusive);
    });

    if (topSentinelRef.current) topObs.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) bottomObs.observe(bottomSentinelRef.current);

    return () => {
      topObs.disconnect();
      bottomObs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDayKey, lastDayKey]);

  function openModalForDay(dayKey) {
    setSelectedDayKey(dayKey);
    setModalTask(null);
    setModalOpen(true);
  }

  function openEditModal(task) {
    setSelectedDayKey(task.dayKey || String(task.scheduledDate).slice(0, 10));
    setModalTask(task);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function onSaved(task) {
    setTasksByDay((prev) => mergeTasksIntoByDay(prev, [task]));
  }

  function onDelete(task) {
    setDeleteError("");
    setDeleteModalTask(task);
  }

  async function confirmDelete() {
    if (!deleteModalTask?._id) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      if (authMode === "user") {
        await apiDeleteTask(deleteModalTask._id);
      }
      setTasksByDay((prev) => {
        const dayKey =
          deleteModalTask.dayKey ||
          String(deleteModalTask.scheduledDate).slice(0, 10);
        const next = { ...prev };
        next[dayKey] = (next[dayKey] || []).filter(
          (t) => t._id !== deleteModalTask._id,
        );
        return next;
      });
      setOpenMenuTaskId(null);
      if (noteViewTask?._id === deleteModalTask._id) setNoteViewTask(null);
      if (modalTask?._id === deleteModalTask._id) setModalTask(null);
      setDeleteModalTask(null);
    } catch (e) {
      setDeleteError(e?.message || "Failed to delete");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function scrollToToday() {
    const scroller = scrollerRef.current;
    const el = document.getElementById(`day-${todayKey}`);
    if (!scroller || !el) return;

    const rowTop = el.offsetTop;
    const rowH = el.offsetHeight;
    const containerH = scroller.clientHeight;
    scroller.scrollTo({
      top: Math.max(0, rowTop - containerH / 2 + rowH / 2),
      behavior: "smooth",
    });
  }

  function scrollToDayKey(dayKey) {
    const scroller = scrollerRef.current;
    const el = document.getElementById(`day-${dayKey}`);
    if (!scroller || !el) return;

    const rowTop = el.offsetTop;
    const rowH = el.offsetHeight;
    const containerH = scroller.clientHeight;
    scroller.scrollTo({
      top: Math.max(0, rowTop - containerH / 2 + rowH / 2),
      behavior: "smooth",
    });
  }

  function ensureAndScrollToDayKey(targetDayKey) {
    if (!targetDayKey) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    if (dates.includes(targetDayKey)) {
      scrollToDayKey(targetDayKey);
      return;
    }

    const buffer = 5;

    if (targetDayKey < firstDayKey) {
      const newStart = addDaysToDayKey(targetDayKey, -buffer);
      const toAdd = buildDayKeyRange(newStart, firstDayKey);
      if (toAdd.length) {
        pendingPrependRestoreRef.current = {
          prevScrollTop: scroller.scrollTop,
          prevScrollHeight: scroller.scrollHeight,
        };
        setDates((prev) => [...toAdd, ...prev]);
      }
      fetchSegment(newStart, firstDayKey);
    } else if (targetDayKey > lastDayKey) {
      const newEndExclusive = addDaysToDayKey(targetDayKey, buffer + 1);
      const toAdd = buildDayKeyRange(
        addDaysToDayKey(lastDayKey, 1),
        newEndExclusive,
      );
      if (toAdd.length) setDates((prev) => [...prev, ...toAdd]);
      fetchSegment(addDaysToDayKey(lastDayKey, 1), newEndExclusive);
    }

    requestAnimationFrame(() => scrollToDayKey(targetDayKey));
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="shrink-0">
      <TimelineHeader
        onToday={scrollToToday}
        onJumpToDayKey={ensureAndScrollToDayKey}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchCount={searchMatches.length}
        activeSearchIndex={activeSearchIndex}
        onSearchNext={searchNext}
        onSearchPrev={searchPrev}
        onSearchClear={clearSearch}
        authMode={readOnly ? "admin" : authMode === "user" ? "user" : "guest"}
        userEmail={user?.email}
        userName={user?.name}
        userAvatarUrl={user?.avatarDataUrl || user?.avatarUrl}
        onOpenAuth={() => {
          setAuthError("");
          setAuthModalMode("login");
          setAuthModalOpen(true);
        }}
        onOpenProfile={async () => {
          try {
            const p = await apiProfileGet();
            setProfile(p);
            setProfileModalOpen(true);
          } catch (e) {
            setFetchError(e?.message || "Failed to load profile");
          }
        }}
      />
      </div>

      <div
        ref={scrollerRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        <div ref={topSentinelRef} className="h-1" />

        {fetchError ? (
          <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
              {fetchError}
            </div>
          </div>
        ) : null}

        {dates.map((dayKey) => (
          <DateRow
            key={dayKey}
            dayKey={dayKey}
            isToday={dayKey === todayKey}
            tasks={tasksByDay[dayKey] || []}
            onAdd={() => openModalForDay(dayKey)}
            onEditTask={openEditModal}
            onDeleteTask={onDelete}
            onOpenNoteTask={(t) => setNoteViewTask(t)}
            onPlayVideo={(t) => setPlayerTask(t)}
            dragTask={dragTask}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDropTask={handleDropTask}
            onDragStartTask={(t, fromDayKey) =>
              setDragTask({ id: t._id, fromDayKey })
            }
            onDragEndTask={() => {
              setDragTask(null);
              setDragOver(null);
            }}
            searchQuery={normalizedSearchQuery}
            activeSearchTaskId={activeSearchTaskId}
            openNotesTaskId={openNotesTaskId}
            setOpenNotesTaskId={setOpenNotesTaskId}
            openMenuTaskId={openMenuTaskId}
            setOpenMenuTaskId={setOpenMenuTaskId}
            // read-only when admin viewing another user
            readOnly={readOnly || !!viewAsUserId}
          />
        ))}

        <div ref={bottomSentinelRef} className="h-1" />
      </div>

      <AddTaskModal
        open={modalOpen}
        dayKey={selectedDayKey || todayKey}
        onClose={closeModal}
        task={modalTask}
        onSaved={onSaved}
        onSaveTask={saveTask}
      />

      <NoteViewModal
        open={!!noteViewTask}
        task={noteViewTask}
        onClose={() => setNoteViewTask(null)}
      />

      <VideoPlayerModal
        open={!!playerTask}
        videoUrl={playerTask?.videoUrl}
        title={playerTask?.title}
        onClose={() => setPlayerTask(null)}
      />

      {deleteModalTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Delete task"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteModalTask(null);
          }}
        >
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-3xl bg-(--card) p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[color:var(--foreground)]">
                  Delete task?
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  This can’t be undone.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalTask(null)}
                className="cursor-pointer rounded-xl p-2 text-[color:var(--muted)] hover:bg-(--card-2) hover:text-[color:var(--foreground)]"
                aria-label="Close delete modal"
              >
                <XIcon />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-(--card-2) p-3 text-sm text-[color:var(--foreground)]">
              <div className="line-clamp-2 font-semibold">
                {deleteModalTask.type === "video"
                  ? deleteModalTask.title
                  : "Note"}
              </div>
              {deleteModalTask.type !== "video" ? (
                <div className="mt-1 line-clamp-2 text-[color:var(--muted)]">
                  {deleteModalTask.notes}
                </div>
              ) : null}
            </div>

            {deleteError ? (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalTask(null)}
                className="cursor-pointer rounded-full bg-(--card) px-4 py-2 text-sm font-medium text-[color:var(--foreground)] ring-1 ring-slate-200 hover:bg-(--card-2)"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={confirmDelete}
                className={cx(
                  "cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white transition",
                  deleteSubmitting
                    ? "bg-red-400"
                    : "bg-red-600 hover:bg-red-700",
                )}
              >
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AuthModal
        key={`${authModalOpen ? "open" : "closed"}-${authModalMode}`}
        open={authModalOpen}
        mode={authModalMode}
        onModeChange={setAuthModalMode}
        onClose={() => setAuthModalOpen(false)}
        submitting={authSubmitting}
        error={authError}
        onSubmit={async ({ email, password }) => {
          setAuthSubmitting(true);
          setAuthError("");
          try {
            const u =
              authModalMode === "login"
                ? await apiAuthLogin({ email, password })
                : await apiAuthSignup({ email, password });
            setUser(u);
            setAuthMode("user");
            setAuthModalOpen(false);
            setTasksByDay({});
            loadedSegmentsRef.current = new Set();
            refreshedVideoIdsRef.current = new Set();
          } catch (e) {
            setAuthError(e?.message || "Auth failed");
          } finally {
            setAuthSubmitting(false);
          }
        }}
      />

      <ProfileModal
        open={profileModalOpen}
        profile={profile}
        onClose={() => setProfileModalOpen(false)}
        onSave={async ({ name, avatarDataUrl }) => {
          const p = await apiProfilePatch({ name, avatarDataUrl });
          setProfile(p);
          setUser((u) =>
            u ? { ...u, name: p.name, avatarUrl: p.avatarUrl, avatarDataUrl: p.avatarDataUrl } : u,
          );
        }}
        onLogout={
          readOnly
            ? undefined
            : async () => {
                await apiAuthLogout();
                setProfileModalOpen(false);
                setUser(null);
                setAuthMode("guest");
                setTasksByDay({});
                loadedSegmentsRef.current = new Set();
                refreshedVideoIdsRef.current = new Set();
              }
        }
      />
    </div>
  );
}

