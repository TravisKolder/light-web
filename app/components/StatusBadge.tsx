import type { AssertionStatus } from "@/lib/types";

// Shows the three assertion states distinctly. Each state has its own
// label, icon shape, and color, so they stay distinguishable without color
// (e.g. for color-blind readers or in print).
const STATES: Record<AssertionStatus, { label: string; icon: string; title: string }> = {
  claim: {
    label: "Claim",
    icon: "○",
    title: "Claim: stated by the project, no supporting document yet",
  },
  documented: {
    label: "Documented",
    icon: "◐",
    title: "Documented: a supporting document is attached, not yet independently verified",
  },
  verified: {
    label: "Verified",
    icon: "●",
    title: "Verified: confirmed by an independent verifier",
  },
};

export function StatusBadge({ status }: { status: AssertionStatus }) {
  const s = STATES[status];
  return (
    <span className={`status-badge status-${status}`} title={s.title}>
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}

/** Shown when a verification has a tie flag. A prompt for review, not a verdict. */
export function NeedsReviewBadge() {
  return (
    <span className="status-badge status-review" title="Needs review: flagged for a human to look at">
      <span aria-hidden="true">⚑</span> Needs review
    </span>
  );
}
