import { useEffect, useState } from "react";

export default function useAuth() {
  const [isAuthed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend returns 200 when session exists, 401 otherwise
    fetch("/api/adminhome", { credentials: "include" })
      .then(res => setAuthed(res.ok))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  return { isAuthed, loading };
}
