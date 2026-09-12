/** The helmet reduced to ridge, dome and brim. Same character as the app. */
export default function Mark({ w = 22 }) {
  const ink = "var(--color-accent-700)";
  return (
    <svg width={w} height={w * (18 / 22)} viewBox="0 0 128 104" aria-hidden="true">
      <ellipse cx={60} cy={76} rx={52} ry={9.5} fill="var(--color-accent-200)" stroke={ink} strokeWidth={3} />
      <path d="M16 76 A44 44 0 0 1 104 76 Z" fill="var(--color-accent-200)" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M60 32 V74" stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}
