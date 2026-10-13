import { useState } from "react";

/** Password field with a show / hide toggle. */
export function PasswordInput({
  value,
  onChange,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-300 py-2 pl-3 pr-16 text-sm focus:border-rose-900 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-rose-900 hover:underline"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
