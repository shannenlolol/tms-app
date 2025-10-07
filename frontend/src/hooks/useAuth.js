// hooks/useAuth.js
import { useEffect, useState } from "react";

export default function useAuth() {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/check", { credentials: "include" })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        setAuthed(Boolean(d.ok));
        setIsAdmin(Boolean(d.isAdmin));
      })
      .catch(() => {
        setAuthed(false);
        setIsAdmin(false);
      })
      .finally(() => setLoading(false));
  }, []);

  return { loading, isAuthed, isAdmin };
}
