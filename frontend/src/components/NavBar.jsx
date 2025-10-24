// NavBar.jsx — uses the same useRoleFlags(checkGroup) logic as App.jsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import { checkGroup } from "../api/users";

// Mirror of App.jsx's role logic: async checkGroup with stable deps
function useRoleFlags(user) {
  const [flags, setFlags] = useState({
    isAdmin: false,
    isProjectSide: false,
    isOther: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const username = String(user?.username || "").trim();
        if (!username) {
          if (!cancelled)
            setFlags({ isAdmin: false, isProjectSide: false, isOther: true });
          return;
        }
        const [isAdmin, isPM, isPL, isDev] = await Promise.all([
          checkGroup(username, "admin"),
          checkGroup(username, "project manager"),
          checkGroup(username, "project lead"),
          checkGroup(username, "dev team"),
        ]);
        if (!cancelled) {
          const isProjectSide = isPM || isPL || isDev;
          const isOther = !isAdmin && !isProjectSide;
          setFlags({ isAdmin, isProjectSide, isOther });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    //  Re-run when username change
  }, [user?.username]);

  return { ...flags, loading };
}

export default function NavBar() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { isAdmin, isProjectSide, isOther, loading } = useRoleFlags(user);

  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const t = e.target;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!ready || loading) {
    return (
      <nav className="bg-white border-gray-200 shadow-md mb-8">
        <div className="max-w-screen-xl flex items-center justify-between mx-auto p-4">
          <span className="self-center text-2xl font-semibold">
            Task Management System
          </span>
          <div className="h-12 w-24 rounded-full bg-gray-100 animate-pulse" />
        </div>
      </nav>
    );
  }

  const items = [
    isAdmin && {
      key: "admin",
      label: "User Management",
      onClick: () => navigate("/admin"),
    },
    (isProjectSide || isOther) && {
      key: "tasks",
      label: "Applications",
      onClick: () => navigate("/"),
    },
    {
      key: "profile",
      label: "Update Profile",
      onClick: () => navigate(isAdmin ? "/admin/profile" : "/profile"),
    },
    {
      key: "logout",
      label: "Logout",
      divider: true,
      onClick: async () => {
        try {
          await logout();
        } finally {
          navigate("/login");
        }
      },
    },
  ].filter(Boolean);

  return (
    <nav className="bg-white border-gray-200 shadow-md mb-8">
      <div className="max-w-screen-xl flex items-center justify-between mx-auto p-4">
        <span className="self-center text-2xl font-semibold">
          Task Management System
        </span>

        <div className="relative">
          <button
            ref={btnRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="avatar-btn inline-flex h-14 w-20 items-center justify-center
             rounded-full overflow-hidden bg-transparent
             border-none outline-none shadow-none
             focus:outline-none focus:ring-0"
          >
            <img
              src="/user_icon.png"
              className="h-full w-full object-contain"
              alt="User menu"
            />
          </button>

          {open && (
            <div
              ref={menuRef}
              role="menu"
              className="absolute right-0 w-42 rounded-md border border-gray-200 bg-white shadow-xl z-50"
            >
              <ul className="py-1 text-sm text-gray-800">
                {items.map(({ key, label, onClick, divider }) => (
                  <li
                    key={key}
                    className={divider ? "border-t border-gray-100" : undefined}
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        onClick();
                      }}
                      className="btn-white w-full text-right px-4 py-2 hover:bg-gray-50 focus:bg-gray-50"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
