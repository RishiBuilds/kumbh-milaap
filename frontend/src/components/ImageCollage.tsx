import Image from "next/image";
import { HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNlOWUwZDAiLz48L3N2Zz4=";

type Tile = {
  src: string;
  alt: string;
  position: string;
  radius: string;
  shadow: string;
  sizes: string;
  priority?: boolean;
};

const TILES: readonly Tile[] = [
  {
    src: "/images/kumbh/sunrise.jpg",
    alt: "Sunrise gathering at Kumbh Mela",
    position: "right-[6%] top-0 h-[69%] w-[63%]",
    radius: "rounded-[2rem]",
    shadow: "shadow-2xl",
    sizes: "(max-width: 768px) 60vw, 360px",
    priority: true,
  },
  {
    src: "/images/kumbh/crowd.jpg",
    alt: "Wide crowd scene at Kumbh Mela",
    position: "bottom-[2%] left-[1%] h-[47%] w-[50%]",
    radius: "rounded-[1.7rem]",
    shadow: "shadow-xl",
    sizes: "(max-width: 768px) 48vw, 280px",
  },
  {
    src: "/images/kumbh/procession.jpg",
    alt: "Kumbh Mela procession",
    position: "bottom-[2%] right-[1%] h-[29%] w-[40%]",
    radius: "rounded-[1.4rem]",
    shadow: "shadow-xl",
    sizes: "(max-width: 768px) 38vw, 230px",
  },
];

function CollageTile({ src, alt, position, radius, shadow, sizes, priority }: Tile) {
  return (
    <div
      className={cn(
        "absolute overflow-hidden border-4 border-background",
        position,
        radius,
        shadow
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        className="object-cover"
      />
    </div>
  );
}

type ImageCollageProps = {
  className?: string;
  badgeTitle?: string;
  badgeText?: string;
};

export function ImageCollage({
  className,
  badgeTitle = "Separated from family?",
  badgeText = "We help you find each other, even in the biggest crowds.",
}: ImageCollageProps) {
  return (
    <div
      role="group"
      aria-label="Scenes from Kumbh Mela"
      className={cn(
        "relative mx-auto h-[380px] w-full max-w-[510px] md:h-[510px]",
        className
      )}
    >
      {TILES.map((tile) => (
        <CollageTile key={tile.src} {...tile} />
      ))}

      <div className="absolute left-[2%] top-[10%] flex max-w-[58%] items-start gap-3 rounded-2xl bg-background/95 p-3 pr-4 shadow-lg ring-1 ring-border backdrop-blur-sm md:max-w-[250px]">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-saffron/15 text-saffron"
        >
          <HeartHandshake size={19} strokeWidth={1.75} />
        </span>
        <p className="grid gap-0.5">
          <span className="text-sm font-bold leading-tight">{badgeTitle}</span>
          <span className="text-xs leading-snug text-muted-foreground">
            {badgeText}
          </span>
        </p>
      </div>
    </div>
  );
}