import { useEffect, useState } from "react";

const asArray = (v) => (Array.isArray(v) ? v : v ? [String(v)] : []);

export default function UserGroupPicker({
  value = [],
  onChange,
  options = [],
  placeholder = "Select",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  // Close when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!anchorEl) return;
      if (!anchorEl.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [anchorEl]);

  const toggle = (name) => {
    const arr = asArray(value);
    if (arr.includes(name)) {
      onChange(arr.filter((v) => v !== name));
    } else {
      onChange([...arr, name]);
    }
  };

  return (
    <div className={`relative ${className}`} ref={setAnchorEl}>
      {/* Control */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-alt w-full min-h-[34px] rounded-md border-gray-300 px-2 py-1 text-left focus:outline-none focus:ring flex items-center gap-2 flex-wrap"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          <>
            {value.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs"
              >
                {name}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((v) => v !== name));
                  }}
                  className="cursor-pointer rounded-full px-1 hover:bg-blue-200"
                  title={`Remove ${name}`}
                  aria-label={`Remove ${name}`}
                >
                  ×
                </span>
              </span>
            ))}
          </>
        )}
        <span className="ml-auto text-gray-400">▾</span>
      </button>

      {/* Menu */}
      {open && (
        <div className="absolute z-20 mt-1 w-[18rem] max-w-[80vw] rounded-md border bg-white dark:bg-gray-900 shadow-lg">
          <ul className="max-h-60 overflow-auto py-1" role="listbox">
            {options.map((name) => {
              const checked = value.includes(name);
              return (
                <li key={name}>
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={checked}
                      onChange={() => toggle(name)}
                    />
                    <span className="text-sm">{name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
