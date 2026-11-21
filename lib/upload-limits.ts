// Upload limits shared by forms and server actions (no server-only imports,
// so pages can use them). Must match the `evidence` bucket in migration 019;
// next.config.ts allows request bodies a little over this size.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const EVIDENCE_BUCKET = "evidence";
