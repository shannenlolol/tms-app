// src/pages/UpdateProfile.jsx
import React, { useEffect, useState } from "react";
import { getCurrentUser, updateCurrentUser } from "../api/users";

export default function UpdateProfile() {
  const [form, setForm] = useState({ email: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setForm({ email: me.email || "" });
    })();
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setMsg("");
    await updateCurrentUser({ email: form.email });
    setMsg("Saved.");
  }

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-semibold mb-4">My Profile</h1>
      <form onSubmit={onSave} className="space-y-3">
        <label className="block text-sm">Email</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <button className="rounded bg-black text-white px-4 py-2">Save</button>
        {msg && <span className="ml-3 text-green-700">{msg}</span>}
      </form>

      <hr className="my-6" />

      <ChangePassword />
    </div>
  );
}

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState("");

  async function onChangePw(e) {
    e.preventDefault();
    setMsg("");
    await updateCurrentUser({ currentPassword: cur, newPassword: nw });
    setCur(""); setNw("");
    setMsg("Password updated.");
  }

  return (
    <form onSubmit={onChangePw} className="space-y-3">
      <h2 className="text-base font-semibold">Change password</h2>
      <input
        type="password"
        className="w-full border rounded px-3 py-2"
        placeholder="Current password"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        autoComplete="current-password"
      />
      <input
        type="password"
        className="w-full border rounded px-3 py-2"
        placeholder="New password"
        value={nw}
        onChange={(e) => setNw(e.target.value)}
        autoComplete="new-password"
      />
      <button className="rounded bg-black text-white px-4 py-2">Update</button>
      {msg && <span className="ml-3 text-green-700">{msg}</span>}
    </form>
  );
}
