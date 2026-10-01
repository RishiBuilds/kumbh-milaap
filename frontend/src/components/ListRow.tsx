import { ArrowUpRight, type LucideIcon } from "lucide-react";

type ListRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: string;
};

export function ListRow({
  icon: Icon,
  title,
  description,
  action,
}: ListRowProps) {
  return (
    <div
      tabIndex={0}
      className="group flex cursor-default items-center gap-4 border-b border-border px-1 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted"
    >
      <Icon size={19} strokeWidth={1.75} className="text-saffron" />

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      {action && (
        <span className="hidden text-xs text-muted-foreground sm:block">
          {action}
        </span>
      )}

      <ArrowUpRight
        size={17}
        strokeWidth={1.75}
        className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </div>
  );
}