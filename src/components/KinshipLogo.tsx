// src/components/KinshipLogo.tsx
// Overlap mark: two audiences, one shared lens in amber.
// The lens is a plain path (no clipPath ids), so it is safe to render many times on one page.

type MarkProps = {
  size?: number;
  className?: string;
};

export function KinshipMark({ size = 32, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Kinship"
      className={className}
    >
      <path d="M32 17A17 17 0 0 1 32 47A17 17 0 0 1 32 17Z" fill="#ffb547" />
      <circle cx="24" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="40" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  className?: string;
};

export function KinshipLogo({ size = 32, className }: LogoProps) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}>
      <KinshipMark size={size} />
      <span
        style={{
          fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
          fontSize: size * 0.9,
          lineHeight: 1,
        }}
      >
        Kinship
      </span>
    </span>
  );
}
