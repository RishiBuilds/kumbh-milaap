type SectionHeaderProps = {
  number: string;
  title: string;
  description: string;
};

export function SectionHeader({
  number,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <header className="mb-8 grid gap-3 border-t border-border pt-4 md:mb-10 md:grid-cols-[90px_1fr]">
      <span className="text-xs font-bold tracking-[0.16em] text-saffron">
        {number}
      </span>

      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  );
}