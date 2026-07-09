"use client";

import { useEffect, useState } from "react";

/**
 * Celebratory "all clear" banner shown when an MHA passes — carrier isn't DTS
 * and the freight is billed to DTS. Getting this right at the booth is the whole
 * job, so it should feel like a win: a longer confetti burst, a trophy that pops
 * with a pulsing ring, and upbeat copy. Respects prefers-reduced-motion.
 */
const COLORS = ["#AB0534", "#0063A0", "#10b981", "#f59e0b", "#86BBD8", "#facc15"];

export function MhaCelebrate() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    // Trigger the pop on mount (next frame) so the animation always plays.
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pieces = Array.from({ length: 44 }, (_, i) => i);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-5 py-9 text-center shadow-sm">
      {/* confetti */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {pieces.map((i) => {
          const left = (i * 27) % 100;
          const delay = (i % 10) * 0.14;
          const dur = 2.2 + ((i * 13) % 16) / 10;
          const size = 6 + ((i * 7) % 7);
          const round = i % 3 === 0;
          return (
            <span
              key={i}
              className="mha-confetti"
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
                background: COLORS[i % COLORS.length],
                width: size,
                height: size,
                borderRadius: round ? "9999px" : "2px",
              }}
            />
          );
        })}
      </div>

      <div className="relative">
        <div className={`mha-trophy-wrap relative mx-auto h-20 w-20 ${go ? "mha-pop" : "opacity-0"}`}>
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 mha-ring" aria-hidden="true" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-4xl shadow-lg">
            🏆
          </span>
        </div>

        <p className="mt-4 text-2xl font-extrabold tracking-tight text-emerald-700">
          Perfect MHA! 🎉
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-emerald-800/90">
          Carrier is correct and the freight is billed to DTS — exactly right. Turn it in at the
          service desk and you&apos;re all done.
        </p>
      </div>

      <style>{`
        .mha-confetti {
          position: absolute;
          top: -16px;
          animation-name: mha-fall;
          animation-timing-function: ease-in;
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
        }
        @keyframes mha-fall {
          0%   { transform: translateY(-16px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(230px) rotate(520deg); opacity: 0; }
        }
        .mha-pop { animation: mha-pop 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
        @keyframes mha-pop {
          0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
          60%  { transform: scale(1.18) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .mha-ring { animation: mha-ring 1.4s ease-out 0.35s 2; }
        @keyframes mha-ring {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mha-confetti { display: none; }
          .mha-pop, .mha-ring { animation: none; }
          .mha-trophy-wrap { opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
