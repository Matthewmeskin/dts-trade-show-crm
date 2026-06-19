/**
 * DTS wordmark — maroon "DTS" with the trailing speed streaks. Inline SVG so it
 * needs no asset and scales crisply. `variant="light"` renders a white knockout
 * for use on the blue sidebar; the default maroon version is for light surfaces.
 * To use the exact brand artwork instead, drop a file in /public and swap this
 * for an <img>.
 */
export function DtsLogo({
  className = "h-7 w-auto",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "light";
}) {
  const light = variant === "light";
  const gradId = `dts-streak-${variant}`;
  const dtsFill = light ? "#ffffff" : "#AB0534";

  return (
    <svg
      viewBox="0 0 132 30"
      className={className}
      role="img"
      aria-label="DTS — Diversified Transportation Services"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          {light ? (
            <>
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.35" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#AB0534" />
              <stop offset="1" stopColor="#c9ccce" />
            </>
          )}
        </linearGradient>
      </defs>
      <g transform="skewX(-12)">
        <rect x="72" y="2" width="58" height="3.2" rx="1.6" fill={`url(#${gradId})`} />
        <rect x="76" y="8" width="54" height="3.2" rx="1.6" fill={`url(#${gradId})`} />
        <rect x="80" y="14" width="50" height="3.2" rx="1.6" fill={`url(#${gradId})`} />
      </g>
      <text
        x="0"
        y="23"
        fontFamily="Montserrat, system-ui, sans-serif"
        fontSize="26"
        fontWeight="800"
        fontStyle="italic"
        letterSpacing="-1.5"
        fill={dtsFill}
      >
        DTS
      </text>
    </svg>
  );
}
