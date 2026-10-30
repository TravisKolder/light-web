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
                  <ul className="support">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <span className="kind">{DOC_KIND[d.kind]}</span> {d.title}
                        {d.issued_on && <span className="muted small"> · {formatDate(d.issued_on)}</span>}
                        {d.contains_personal_data && (
                          <span className="muted small"> · file not public (contains personal data)</span>
                        )}
                      </li>
                    ))}
                    {ev.map((e) => (
                      <li key={e.id}>
                        <span className="kind">{EVIDENCE_KIND[e.kind]}</span> {e.caption}
                        {(e.captured_on || e.location_label) && (
                          <span className="muted small">
                            {" · "}{[formatDate(e.captured_on), e.location_label].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                    {hiddenSupport && (
                      <li className="muted">Supported by material not shown publicly, to protect people&apos;s privacy.</li>
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
