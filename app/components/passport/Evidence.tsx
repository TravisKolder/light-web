import { NeedsReviewBadge, StatusBadge } from "@/app/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { Passport } from "@/lib/passport";
import type {
  DocumentKind, EvidenceKind, VerificationFinding, VerificationMethod,
} from "@/lib/types";

// Evidence list (backlog item 14): every assertion with its status, the
// supporting documents and evidence that are public, and the independent
// verifications. The three states stay visibly separate: documents and
// evidence are support; only a verification is a check by someone
// independent.

const DOC_KIND: Record<DocumentKind, string> = {
  receipt: "Receipt", invoice: "Invoice", photo: "Photo", report: "Report",
  contract: "Contract", bank_statement: "Bank statement", other: "Document",
};
const EVIDENCE_KIND: Record<EvidenceKind, string> = {
  photo: "Photo", video: "Video", receipt: "Receipt", site_report: "Site report", other: "Evidence",
};
const METHOD: Record<VerificationMethod, string> = {
  site_visit: "site visit", document_review: "document review",
  third_party_audit: "third-party audit", photo_geolocation: "photo geolocation",
  interview: "interview", other: "other method",
};
const FINDING: Record<VerificationFinding, string> = {
  confirmed: "Confirmed", not_confirmed: "Not confirmed", disputed: "Disputed",
};

// Small line icons so supporting material reads as evidence, not as a line of
// text (backlog item 23i). Decorative: the kind is always written out too.
type IconName = "photo" | "video" | "page" | "receipt" | "report" | "lock";
const ICON_PATHS: Record<IconName, React.ReactNode> = {
  photo: <><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" /><circle cx="7" cy="8.5" r="1.3" /><path d="M3 14l4-3.5 3 2.5 3-3 4 4" /></>,
  video: <><rect x="2.5" y="4.5" width="15" height="11" rx="1.5" /><path d="M8.5 7.8v4.4l3.8-2.2z" /></>,
  page: <><path d="M5.5 2.5h6l3 3v12h-9z" /><path d="M11.5 2.5v3h3M7.5 9.5h5M7.5 12.5h5" /></>,
  receipt: <><path d="M5.5 2.5h9v15l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" /><path d="M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" /></>,
  report: <><rect x="4.5" y="3.5" width="11" height="14" rx="1.5" /><path d="M7.5 3.5v-1h5v1M7.5 8h5M7.5 11h5M7.5 14h3" /></>,
  lock: <><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></>,
};
const DOC_ICON: Record<DocumentKind, IconName> = {
  receipt: "receipt", invoice: "receipt", photo: "photo", report: "report",
  contract: "page", bank_statement: "page", other: "page",
};
const EVIDENCE_ICON: Record<EvidenceKind, IconName> = {
  photo: "photo", video: "video", receipt: "receipt", site_report: "report", other: "page",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="support-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name]}
    </svg>
  );
}

export function EvidenceList({ passport }: { passport: Passport }) {
  const { assertions, documents, evidence, verifications } = passport;

  return (
    <section aria-labelledby="evidence-h">
      <h2 id="evidence-h">Claims, evidence, and verification</h2>
      <p className="muted small">
        Each statement the project makes, what supports it, and whether someone
        independent has checked it.
      </p>

      <ul className="assertions">
        {assertions.map((a) => {
          const docs = documents.filter((d) => d.assertion_id === a.id);
          const ev = evidence.filter((e) => e.assertion_id === a.id);
          const ver = verifications.filter((v) => v.assertion_id === a.id);
          // Supported but nothing public to show: the support is private
          // (personal data, or photos of identifiable people).
          const hiddenSupport = a.status !== "claim" && docs.length === 0 && ev.length === 0;

          return (
            <li key={a.id} className="assertion">
              <div className="assertion-head">
                <StatusBadge status={a.status} />
                <span className="muted small">{formatDate(a.asserted_on)}</span>
              </div>
              <p className="assertion-statement">{a.statement}</p>

              {(docs.length > 0 || ev.length > 0 || hiddenSupport) && (
                <>
                  <h3 className="sub">Supporting material</h3>
                  <ul className="support evidence-items">
                    {docs.map((d) => (
                      <li key={d.id} className={d.contains_personal_data ? "is-private" : undefined}>
                        <Icon name={DOC_ICON[d.kind]} />
                        <div>
                          <span className="kind">{DOC_KIND[d.kind]}</span> {d.title}
                          <div className="muted small">
                            {d.issued_on ? `Issued ${formatDate(d.issued_on)}` : "Date not recorded"}
                            {d.contains_personal_data && (
                              <span className="private-note">
                                <Icon name="lock" /> File not public (contains personal data)
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                    {ev.map((e) => (
                      <li key={e.id}>
                        <Icon name={EVIDENCE_ICON[e.kind]} />
                        <div>
                          <span className="kind">{EVIDENCE_KIND[e.kind]}</span> {e.caption}
                          <div className="muted small">
                            {[
                              e.captured_on ? `Captured ${formatDate(e.captured_on)}` : "Date not recorded",
                              e.location_label,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </li>
                    ))}
                    {hiddenSupport && (
                      <li className="is-private">
                        <Icon name="lock" />
                        <div className="muted">Supported by material not shown publicly, to protect people&apos;s privacy.</div>
                      </li>
                    )}
                  </ul>
                </>
              )}

              {ver.length > 0 && (
                <>
                  <h3 className="sub">Independent verification</h3>
                  <ul className="support">
                    {ver.map((v) => (
                      <li key={v.id}>
                        <strong>{FINDING[v.finding]}</strong> by{" "}
                        {v.verifier_name ?? "an independent verifier (name not public)"}{" "}
                        ({METHOD[v.method]}, {formatDate(v.verified_on)}).
                        <span className="muted small"> Independence declared {formatDate(v.independence_declared_on)}.</span>
                        {v.tie_flagged && <> <NeedsReviewBadge /></>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {a.status === "claim" && (
                <p className="muted small">No supporting material or verification yet.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
