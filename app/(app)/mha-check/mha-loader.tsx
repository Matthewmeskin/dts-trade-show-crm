"use client";

import { useEffect, useState } from "react";

/** Freight-themed status lines that cycle while the vision read runs. */
const MESSAGES = [
  "Reading your MHA…",
  "Finding the carrier…",
  "Confirming the freight is billed to DTS…",
  "Checking for a signature…",
  "Matching it to your load…",
  "Double-checking the details…",
];

export function MhaLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
      <div className="relative mx-auto h-16 w-full max-w-sm">
        {/* road */}
        <div className="absolute inset-x-0 bottom-3 border-t-2 border-dashed border-slate-200" />
        {/* speed streaks */}
        <div className="mha-streaks absolute bottom-5 left-2 flex flex-col gap-[3px]">
          <span className="block h-[3px] w-10 rounded-full bg-dts-maroon/70" />
          <span className="block h-[3px] w-8 rounded-full bg-dts-maroon/45" />
          <span className="block h-[3px] w-6 rounded-full bg-dts-maroon/25" />
        </div>
        {/* truck */}
        <div className="mha-truck absolute bottom-1 text-4xl leading-none">🚛</div>
      </div>

      <div className="mx-auto mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
        <div className="mha-bar h-full w-1/3 rounded-full bg-dts-maroon" />
      </div>

      <p className="mt-5 text-center text-sm font-medium text-slate-700" aria-live="polite">
        {MESSAGES[i]}
      </p>
      <p className="mt-1 text-center text-xs text-slate-400">This usually takes a few seconds.</p>

      <style>{`
        @keyframes mha-drive {
          0%   { transform: translateX(0); }
          100% { transform: translateX(19rem); }
        }
        @keyframes mha-bar {
          0%   { transform: translateX(-130%); }
          100% { transform: translateX(320%); }
        }
        @keyframes mha-flick { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
        .mha-truck  { animation: mha-drive 2.6s ease-in-out infinite; }
        .mha-streaks{ animation: mha-flick 0.5s ease-in-out infinite; }
        .mha-bar    { animation: mha-bar 1.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mha-truck, .mha-streaks, .mha-bar { animation: none; }
          .mha-truck { left: 50%; transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
