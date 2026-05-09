// Bloc skeleton anime (placeholder de chargement)
interface SkeletonProps {
  w?: string;
  h?: number | string;
  r?: number | string;
}

export default function Skeleton(p: SkeletonProps) {
  return (
    <div
      className="lt-skeleton"
      style={{
        width: p.w || "100%",
        height: p.h || 16,
        borderRadius: p.r || 6,
        background: "var(--border)",
        animation: "lt-pulse 1.2s ease-in-out infinite"
      }}
    />
  );
}

// Skeleton d'une ligne de tableau (N colonnes)
interface RowSkeletonProps {
  cols?: number;
}

export function RowSkeleton(p: RowSkeletonProps) {
  var cols = p.cols || 5;
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 12px", borderBottom: "1px solid var(--border-light)", alignItems: "center" }}>
      {Array.from({ length: cols }, function (_, i) {
        return <div key={i} className="lt-skeleton" style={{
          flex: i === 0 ? 2 : 1,
          height: i === 0 ? 14 : 12,
          borderRadius: 6,
          background: "var(--border)",
          animation: "lt-pulse 1.2s ease-in-out infinite",
          animationDelay: String(i * 0.1) + "s"
        }} />;
      })}
    </div>
  );
}

// Skeleton de tableau complet (header + N lignes)
interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton(p: TableSkeletonProps) {
  var rows = p.rows || 5;
  var cols = p.cols || 5;
  return (
    <div style={{ background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ padding: "12px 12px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", gap: 12 }}>
        {Array.from({ length: cols }, function (_, i) {
          return <div key={i} className="lt-skeleton" style={{ flex: i === 0 ? 2 : 1, height: 10, borderRadius: 6, background: "var(--text-muted)", animation: "lt-pulse 1.2s ease-in-out infinite" }} />;
        })}
      </div>
      {Array.from({ length: rows }, function (_, i) {
        return <RowSkeleton key={i} cols={cols} />;
      })}
    </div>
  );
}

// Skeleton de carte stats (dashboard)
export function CardSkeleton() {
  return (
    <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: 18, border: "1px solid var(--border)" }}>
      <div className="lt-skeleton" style={{ width: 60, height: 10, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite", marginBottom: 10 }} />
      <div className="lt-skeleton" style={{ width: 80, height: 24, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite", marginBottom: 6 }} />
      <div className="lt-skeleton" style={{ width: 100, height: 10, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite" }} />
    </div>
  );
}

// Skeleton pleine page (sidebar + contenu)
export function PageSkeleton() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-body)", fontFamily: "var(--font-sans)" }}>
      {/* Fake sidebar - desktop only */}
      <div className="lt-hide-mobile" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, background: "var(--bg-primary)", borderRight: "1px solid var(--border)", padding: "20px 12px" }}>
        <div className="lt-skeleton" style={{ width: 120, height: 20, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite", marginBottom: 30 }} />
        {[1, 2, 3, 4, 5].map(function (i) {
          return <div key={i} className="lt-skeleton" style={{ width: "80%", height: 14, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite", marginBottom: 16, animationDelay: String(i * 0.1) + "s" }} />;
        })}
      </div>
      {/* Fake topbar */}
      <div style={{ height: 56, background: "var(--bg-primary)", borderBottom: "1px solid var(--border)", marginLeft: 220, display: "flex", alignItems: "center", padding: "0 24px" }} className="lt-topbar-skel">
        <div className="lt-skeleton" style={{ width: 180, height: 14, borderRadius: 6, background: "var(--border)", animation: "lt-pulse 1.2s ease-in-out infinite" }} />
      </div>
      {/* Fake content */}
      <div style={{ marginLeft: 220, padding: 24 }} className="lt-content-skel">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}
