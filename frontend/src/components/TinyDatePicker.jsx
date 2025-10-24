import React, { forwardRef, useMemo } from "react";
import DatePicker from "react-datepicker";
import { format, parseISO, isValid } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Props:
 *  - value: "YYYY-MM-DD" | Date | ""
 *  - onChange: (iso: "YYYY-MM-DD") => void
 *  - placeholder?: string (e.g., "Start")
 *  - className?: string (extra classes for the button)
 *  - disabled?: boolean
 */
export default function TinyDatePicker({ value, onChange, placeholder = "", className = "", disabled = false }) {
  // normalize incoming value -> Date
  const selected = useMemo(() => {
    if (!value) return null;
    if (value instanceof Date) return isValid(value) ? value : null;
    const d = parseISO(String(value));
    return isValid(d) ? d : null;
  }, [value]);

  // Small button as the "input"
  const ButtonInput = forwardRef(({ value: v, onClick }, ref) => (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={
        // ~6.5rem wide, short height
        `btn-white w-27 h-9 rounded-md border border-gray-300 bg-white px-2 text-left
         inline-flex items-center gap-2 focus:outline-none focus:ring focus:ring-indigo-200/50
         disabled:opacity-50 ${className}`
      }
      title="Choose date"
    >

      <span className={v ? "" : "text-gray-400"}>{v || placeholder}</span>
    </button>
  ));

  return (
    <DatePicker
      selected={selected}
      onChange={(d) => onChange(d ? toISO(d) : "")} // always emit "YYYY-MM-DD"
      dateFormat="dd-MM-yyyy"                        // what the button shows
      customInput={<ButtonInput />}
      calendarStartDay={1}                           // Monday
      showPopperArrow
      disabled={disabled}
      // keep the popper compact
      popperClassName="z-40"
    />
  );
}
