type TempleSkylineProps = {
  className?: string;
};

export function TempleSkyline({ className = "" }: TempleSkylineProps) {
  return (
    <svg
      viewBox="0 0 1440 120"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`temple-skyline block w-full ${className}`}
    >
      <path
        fill="currentColor"
        d="M0 120V90h40v-8l10-6 10 6v8h30V70l6-4 6 4v20h20V60l8-10 8 10v30h30V55l4-3 4 3v35h60V50l12-15 12 15v40h20V40l6-8 6 8v50h40V35l10-12 10 12v55h30V30l8-20 4-5 4 5 8 20v60h50V45l6-8 6 8v45h20V50l10-14 10 14v40h60V35l8-10 4-20 4 20 8 10v55h40V40l12-16 12 16v50h30V25l6-8 4-12 4 12 6 8v65h50V50l8-10 8 10v40h20V55l10-12 10 12v35h40V30l6-8 4-18 4 18 6 8v52h30V45l8-10 8 10v45h60V40l10-14 10 14v50h30V35l12-15 4-10 4 10 12 15v45h40V50l6-6 6 6v30h20v10l8-4 8 4v-10h30V60l10-12 10 12v28h40V70l6-6 6 6v24h20v-8l8-10 8 10v8h60v30H0z"
      />
    </svg>
  );
}