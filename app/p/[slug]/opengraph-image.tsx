import { ImageResponse } from "next/og";
import { countStatuses, getPassport } from "@/lib/passport";

// Link-preview image for a public passport (backlog item 23d): title,
// organization and the three status counts. Public data only, same source as
// the page itself.

export const alt = "Project Passport on the Light Web";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1d1d1b";
const MUTED = "#5f5e58";
const GOLD = "#7a5f17";
const STATES = [
  { key: "verified", label: "Verified", fg: "#1f6a36", bg: "#e3f1e6" },
  { key: "documented", label: "Documented", fg: "#24548a", bg: "#e6eef8" },
  { key: "claim", label: "Claim", fg: "#5f5e58", bg: "#efede6" },
] as const;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const passport = await getPassport(slug).catch(() => null);

  const counts = countStatuses(passport?.assertions ?? []);
  const title = passport?.project.title ?? "Project Passport";
  const sample = passport && (passport.source === "sample" || passport.project.is_sample);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "64px 72px",
          background: "#fbfaf7", color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
            <svg width="96" height="32" viewBox="0 0 54 18" style={{ marginRight: 18 }}>
              <circle cx="9" cy="9" r="6.5" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="2.6 2" />
              <circle cx="27" cy="9" r="6.5" fill="none" stroke={GOLD} strokeWidth="2" />
              <path d="M27 2.5a6.5 6.5 0 0 0 0 13z" fill={GOLD} />
              <circle cx="45" cy="9" r="6.5" fill={GOLD} stroke={GOLD} strokeWidth="2" />
            </svg>
            The Light Web
          </div>
          {sample && (
            <div style={{ display: "flex", fontSize: 26, color: GOLD, border: `2px dashed ${GOLD}`, borderRadius: 8, padding: "4px 16px" }}>
              Fictional sample
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, color: GOLD, fontWeight: 700, letterSpacing: 3, marginBottom: 14 }}>
            PROJECT PASSPORT
          </div>
          <div style={{ display: "flex", fontSize: title.length > 60 ? 54 : 66, fontWeight: 700, lineHeight: 1.12 }}>
            {title.length > 110 ? `${title.slice(0, 107)}…` : title}
          </div>
          {passport?.organization?.name && (
            <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 18 }}>
              {passport.organization.name}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          {STATES.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", marginRight: 36 }}>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginRight: 14 }}>{counts[s.key]}</div>
              <div
                style={{
                  display: "flex", fontSize: 28, fontWeight: 700, color: s.fg, background: s.bg,
                  border: `2px ${s.key === "claim" ? "dashed" : "solid"} ${s.fg}`, borderRadius: 999, padding: "4px 20px",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
