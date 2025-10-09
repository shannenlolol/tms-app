import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";

export default function NavBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Close on click outside
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

  // Shared menu item styles
  const itemCls =
    "w-full text-left px-4 py-3 text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none rounded-md";

  return (
    <nav className="bg-white border-gray-200 shadow-md mb-8">
      <div className="max-w-screen-xl flex items-center justify-between mx-auto p-4">
        <Link to="/" className="flex items-center">
          <span className="self-center text-2xl font-semibold">Task Management System</span>
        </Link>

        {/* User avatar / trigger */}
        <div className="relative">

<button
  ref={btnRef}
  type="button"
  onClick={() => setOpen(v => !v)}
  className="avatar-btn inline-flex h-14 w-20 items-center justify-center
             rounded-full overflow-hidden bg-transparent
             border-none outline-none shadow-none
             focus:outline-none focus:ring-0"
>
  <img
    src="/user_icon.png"
    className="h-full w-full object-contain select-none pointer-events-none"
    draggable={false}
  />
</button>

          {/* Dropdown menu */}
{open && (
  <div
    ref={menuRef}
    role="menu"
    className="absolute right-0 w-32 rounded-md border border-gray-200 bg-white shadow-xl z-50"
  >
    <ul className="py-1 text-sm text-gray-800">
      <li>
        <button
          role="menuitem"
          onClick={() => {
            setOpen(false);
            navigate("/profile");
          }}
          className={`btn-alt w-full py-2 text-right hover:bg-gray-50 focus:bg-gray-50 focus:outline-none`}
        >
          Update Profile
        </button>
      </li>
      <li className="border-t border-gray-100">
        <button
          role="menuitem"
          onClick={async () => {
            setOpen(false);
            try { await logout(); } finally { navigate("/login"); }
          }}
          className={`btn-alt w-full py-2 text-right hover:bg-gray-50 focus:bg-gray-50 focus:outline-none`}
        >
          Logout
        </button>
      </li>
    </ul>
  </div>
)}

        </div>
      </div>
    </nav>
  );
}
