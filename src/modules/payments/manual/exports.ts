import type { TrailEvent } from "./api";
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function trailCsv(events: TrailEvent[]) {
  return [
    ["Entry", "Lease", "Recorded at", "Event", "Payload", "Previous hash", "Entry hash"]
      .map(csvCell)
      .join(","),
    ...events.map((e) =>
      [
        e.id,
        e.lease_id,
        e.created_at,
        e.payload["event"],
        JSON.stringify(e.payload),
        e.previous_hash,
        e.entry_hash,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export function downloadCsv(events: TrailEvent[], lease: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + trailCsv(events)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "TNP-payment-trail-" + lease + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function escapeHtml(value: unknown) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value ?? "").replace(/[&<>"']/g, (c) => entities[c]!);
}
export function printTrail(
  target: Window,
  events: TrailEvent[],
  lease: string,
  verification: unknown,
  images: Array<{ label: string; url: string }> = [],
) {
  target.document.write(
    '<!doctype html><html><head><title>TNP payment evidence</title><style>body{font:12px Arial;color:#10213c;margin:30px}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid #aaa;padding:12px 0;break-inside:avoid}button{padding:10px}@media print{button{display:none}}</style></head><body><button id="tnp-print-evidence">Print / save as PDF</button><h1>TNP manual payment trail</h1><p>Lease ' +
      escapeHtml(lease) +
      "</p><p>Tenant claims and landlord attestations; no provider or bank verification is asserted. TNP does not hold funds. Hash validation detects inconsistent stored entries, not factual truth or tampering by a database owner who recomputes the chain. Keep exports separately for comparison.</p><pre>" +
      escapeHtml(JSON.stringify(verification, null, 2)) +
      "</pre>" +
      events
        .map(
          (e) =>
            "<article><h2>Entry " +
            escapeHtml(e.id) +
            "</h2><pre>" +
            escapeHtml(JSON.stringify(e, null, 2)) +
            "</pre></article>",
        )
        .join("") +
      images
        .map(
          (image) =>
            "<article><h2>" +
            escapeHtml(image.label) +
            "</h2>" +
            (image.url
              ? '<img alt="Tenant-submitted receipt" style="max-width:100%;max-height:900px" src="' +
                escapeHtml(image.url) +
                '"/>'
              : "<p>Receipt unavailable or checksum did not match. Investigate the canonical record.</p>") +
            "</article>",
        )
        .join("") +
      "</body></html>",
  );
  target.document.close();
  target.document
    .getElementById("tnp-print-evidence")
    ?.addEventListener("click", () => target.print());
}
