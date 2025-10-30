// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      await login(username.trim(), password);
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err) {
      setMsg(err?.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen w-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200
                  dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
                  flex items-center justify-center p-6"
    >
      <div className="w-full max-w-md">
        <div
          className="relative rounded-3xl border border-white/20 bg-white/70 dark:bg-white/5
                     backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)]
                     ring-1 ring-black/5 overflow-hidden"
        >
          <div className="p-7 sm:p-8">
            <div className="mb-6 flex items-center justify-center gap-3">
              <h1 className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Login
              </h1>
            </div>

            <form onSubmit={onSubmit} autoComplete="off" className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Username
                </label>
                <input
                  className="w-full rounded-xl bg-white/70 dark:bg-white/10 border border-slate-300/70 dark:border-white/10
                             px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    className="w-full rounded-xl bg-white/70 dark:bg-white/10 border border-slate-300/70 dark:border-white/10
                               px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                    value={password}
                    autoComplete="off"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="btn-gray group relative w-full overflow-hidden rounded-xl text-white 
                           py-2.5 font-medium shadow-lg transition bg-slate-800
                           hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy ? "Logging in…" : "Log In"}
              </button>

              {msg && (
                <div className="rounded-xl border border-rose-200/50 bg-rose-50/80 text-rose-700 px-3 py-2 text-sm">
                  {msg}
                </div>
              )}
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
