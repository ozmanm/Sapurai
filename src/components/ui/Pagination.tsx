interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  total?: number;
}

export default function Pagination(p: PaginationProps) {
  if (p.totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0" }}>
      <button
        disabled={p.page <= 1}
        onClick={function () { p.setPage(p.page - 1); }}
        style={{ background: p.page <= 1 ? "var(--bg-secondary)" : "var(--btn-primary-bg)", color: p.page <= 1 ? "var(--text-muted)" : "var(--btn-primary-text)", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: p.page <= 1 ? "default" : "pointer", minHeight: 44, minWidth: 44 }}
        aria-label="Page precedente"
      >
        {"\u2190 Prec"}
      </button>
      <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 600 }}>
        {p.page + " / " + p.totalPages}
      </span>
      <button
        disabled={p.page >= p.totalPages}
        onClick={function () { p.setPage(p.page + 1); }}
        style={{ background: p.page >= p.totalPages ? "var(--bg-secondary)" : "var(--btn-primary-bg)", color: p.page >= p.totalPages ? "var(--text-muted)" : "var(--btn-primary-text)", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: p.page >= p.totalPages ? "default" : "pointer", minHeight: 44, minWidth: 44 }}
        aria-label="Page suivante"
      >
        {"Suiv \u2192"}
      </button>
      {p.total != null ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{"(" + p.total + " total)"}</span> : null}
    </div>
  );
}
