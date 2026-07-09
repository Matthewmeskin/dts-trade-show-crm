"use client";

/**
 * Celebratory "all clear" banner shown when an MHA passes — carrier isn't DTS
 * and the freight is billed to DTS. A short confetti burst + a popping check to
 * make getting it right feel good. Respects prefers-reduced-motion.
 */
const COLORS = ["#AB0534", "#0063A0", "#10b981", "#f59e0b", "#86BBD8"];

export function MhaCelebrate() {
  // Deterministic-enough spread without needing a seed; runs once on mount.
  const pieces = Array.from({ length: 30 }, (_, i) => i);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-5 py-7 text-center">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {pieces.map((i) => {
          const left = (i * 37) % 100;
          const delay = (i % 6) * 0.12;
          const dur = 1.8 + ((i * 13) % 12) / 10;
          const size = 6 + ((i * 7) % 6);
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
              }}
            />
          );
        })}
      </div>

      <div className="relative">
        <div className="mha-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white">
          ✓
        </div>
        <p className="mt-3 text-xl font-bold text-emerald-700">You&apos;re all set! 🎉</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-emerald-800/80">
          The carrier is correct and the freight is billed to DTS. Turn it in at the service desk and
          you&apos;re good to go.
        </p>
      </div>

      <style>{`
        .mha-confetti {
          position: absolute;
          top: -14px;
          border-radius: 2px;
          animation-name: mha-fall;
          animation-timing-function: ease-in;
          animation-iteration-count: 1;
          animation-fill-mode: forwards;
        }
        @keyframes mha-fall {
          0%   { transform: translateY(-14px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(150px) rotate(400deg); opacity: 0; }
        }
        .mha-pop { animation: mha-pop 0.5s ease-out; }
        @keyframes mha-pop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mha-confetti { display: none; }
          .mha-pop { animation: none; }
        }
      `}</style>
    </div>
  );
}
