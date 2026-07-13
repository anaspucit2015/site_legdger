export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Navy background */}
      <rect width="40" height="40" rx="10" fill="#1B3A5C" />
      {/* Clipboard body */}
      <rect x="11" y="13" width="18" height="20" rx="2.5" fill="white" />
      {/* Clipboard clip */}
      <rect x="16" y="10" width="8" height="5" rx="2" fill="#E8A33D" />
      {/* Lines on clipboard */}
      <rect x="14" y="19" width="12" height="1.5" rx="0.75" fill="#1B3A5C" opacity="0.25" />
      <rect x="14" y="22.5" width="9" height="1.5" rx="0.75" fill="#1B3A5C" opacity="0.25" />
      <rect x="14" y="26" width="10" height="1.5" rx="0.75" fill="#1B3A5C" opacity="0.25" />
      {/* Amber dot */}
      <circle cx="30" cy="30" r="6" fill="#E8A33D" />
    </svg>
  );
}
