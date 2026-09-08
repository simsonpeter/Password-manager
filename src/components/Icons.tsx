type IconProps = {
  className?: string;
};

export function KeyholeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M32 8c9.9 0 18 8.1 18 18 0 6.9-3.9 12.9-9.6 15.9V54h-5.8v-5h-5.2v5H23.6V41.9C17.9 38.9 14 32.9 14 26c0-9.9 8.1-18 18-18Z"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="32" cy="26" r="5.5" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function StarIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="m12 3.2 2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16.4 6.8 19.2l1.3-5.9-4.5-4 6-.6L12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16.5 20.5 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 6 8 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 16V6.8A1.8 1.8 0 0 1 6.8 5H16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8 11 7.4-4.2M8 13l7.4 4.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 4.2 13.3 6l2.2-.4 1.1 2 2.1.8-.3 2.2 1.6 1.6-1.6 1.6.3 2.2-2.1.8-1.1 2-2.2-.4L12 19.8 10.7 18l-2.2.4-1.1-2-2.1-.8.3-2.2L4.2 12l1.4-1.6-.3-2.2 2.1-.8 1.1-2 2.2.4L12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12s3.6-6.5 9-6.5S21 12 21 12s-3.6 6.5-9 6.5S3 12 3 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7m-7.5 0 .6 11.2A1.8 1.8 0 0 0 9.9 20h4.2a1.8 1.8 0 0 0 1.8-1.8L16.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloudIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.5 18h9.2A4.3 4.3 0 0 0 21 13.8a4.3 4.3 0 0 0-4-4.2A6 6 0 0 0 6.2 11 3.7 3.7 0 0 0 7.5 18Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeviceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArchMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 320 420" fill="none" aria-hidden="true">
      <path
        d="M40 400V168C40 84 104 24 160 24s120 60 120 144v232"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M88 400V184c0-44 32-76 72-76s72 32 72 76v216" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="160" cy="210" r="18" stroke="currentColor" strokeWidth="1.4" />
      <path d="M160 228v42h-10v18h20v-18h-10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CategoryMark({ category, className }: IconProps & { category: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  switch (category) {
    case "gate":
      return (
        <svg {...common}>
          <path d="M5 20V9.5C5 6 8 3.5 12 3.5S19 6 19 9.5V20" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 12h14M12 3.5V20" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "port":
      return (
        <svg {...common}>
          <path d="M4 16h16M6 16 8 8h8l2 8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 8V4M9 20h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "door":
      return (
        <svg {...common}>
          <rect x="6" y="3.5" width="12" height="17" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="14.2" cy="12" r="0.9" fill="currentColor" />
        </svg>
      );
    case "alarm":
      return (
        <svg {...common}>
          <path d="M6.5 10a5.5 5.5 0 1 1 11 0c0 4 1.5 6 1.5 6H5s1.5-2 1.5-6Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "locker":
      return (
        <svg {...common}>
          <rect x="6" y="9" width="12" height="11" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8.5 9V7.2A3.5 3.5 0 0 1 12 3.7 3.5 3.5 0 0 1 15.5 7.2V9" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 8.5V12l2.4 2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}
