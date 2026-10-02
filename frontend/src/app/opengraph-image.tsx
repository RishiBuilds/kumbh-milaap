import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kumbh Milaap - Reuniting Families at Kumbh Mela 2027";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  background: "#FAF7F2",
  ink: "#2D2A26",
  muted: "#4A4640",
  primary: "#D4621A",
  primaryDark: "#B84F10",
  gold: "#E6A817",
  border: "#E8DFD0",
} as const;

const COPY = {
  brand: "Kumbh Milaap",
  headlineTop: "Every Missing Face",
  headlineBottom: "Deserves a Way",
  headlineAccent: "Home.",
  subtitle:
    "AI-powered missing persons reunification platform for the Nashik Simhastha Kumbh Mela 2027.",
  event: "Nashik Simhastha Kumbh Mela 2027",
} as const;

const FONT_FAMILY = "Playfair Display";
const FONT_WEIGHTS = [400, 700] as const;
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

async function loadFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${FONT_FAMILY.replace(
      / /g,
      "+"
    )}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl)).text();
    const source = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    const fontUrl = source?.[1];
    if (!fontUrl) return null;
    const response = await fetch(fontUrl);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function loadFonts() {
  const text = Object.values(COPY).join(" ");
  const loaded = await Promise.all(
    FONT_WEIGHTS.map(async (weight) => ({
      weight,
      data: await loadFont(weight, text),
    }))
  );
  return loaded.flatMap(({ weight, data }) =>
    data ? [{ name: FONT_FAMILY, data, weight, style: "normal" as const }] : []
  );
}

function Logo() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {COPY.brand}
      </div>
    </div>
  );
}

function Headline() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontSize: 64,
        fontWeight: 700,
        color: COLORS.ink,
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex" }}>{COPY.headlineTop}</div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ display: "flex" }}>{COPY.headlineBottom}</div>
        <div style={{ display: "flex", color: COLORS.primary }}>{COPY.headlineAccent}</div>
      </div>
    </div>
  );
}

function Footer() {
  const base = {
    display: "flex",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
  } as const;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 80,
        right: 80,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `1px solid ${COLORS.border}`,
        paddingTop: 24,
      }}
    >
      <div style={{ ...base, color: COLORS.muted, opacity: 0.5 }}>{COPY.event}</div>
    </div>
  );
}

export default async function Image() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          width: "100%",
          height: "100%",
          padding: 80,
          backgroundColor: COLORS.background,
          fontFamily: `"${FONT_FAMILY}", Georgia, serif`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.gold})`,
          }}
        />
        {Logo()}
        {Headline()}
        <div
          style={{
            display: "flex",
            maxWidth: 700,
            fontSize: 22,
            fontWeight: 400,
            lineHeight: 1.5,
            color: COLORS.muted,
            opacity: 0.7,
          }}
        >
          {COPY.subtitle}
        </div>
        {Footer()}
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { "Cache-Control": CACHE_CONTROL },
    }
  );
}