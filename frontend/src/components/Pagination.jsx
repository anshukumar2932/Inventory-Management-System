export default function Pagination({ page, totalPages, totalCount, onPageChange }) {
  if (totalPages <= 1) return null

  const getPageNumbers = () => {
    const pages = []
    const delta = 2
    const start = Math.max(2, page - delta)
    const end = Math.min(totalPages - 1, page + delta)

    pages.push(1)
    if (start > 2) pages.push("...")
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < totalPages - 1) pages.push("...")
    if (totalPages > 1) pages.push(totalPages)

    return pages
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderTop: "1px solid rgba(148,163,184,0.1)",
      flexWrap: "wrap", gap: "8px",
    }}>
      <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
        {totalCount} total
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{
            padding: "6px 12px", borderRadius: "6px",
            border: "1px solid rgba(148,163,184,0.2)",
            background: "transparent", color: page <= 1 ? "#475569" : "#94a3b8",
            cursor: page <= 1 ? "not-allowed" : "pointer",
            fontSize: "0.8rem", fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          &larr; Prev
        </button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} style={{ color: "#64748b", padding: "0 4px", fontSize: "0.85rem" }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                minWidth: "32px", height: "32px", borderRadius: "6px",
                border: p === page ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(148,163,184,0.2)",
                background: p === page ? "rgba(6,182,212,0.15)" : "transparent",
                color: p === page ? "#06b6d4" : "#94a3b8",
                cursor: "pointer", fontSize: "0.8rem", fontWeight: p === page ? 600 : 400,
                transition: "all 0.2s",
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{
            padding: "6px 12px", borderRadius: "6px",
            border: "1px solid rgba(148,163,184,0.2)",
            background: "transparent", color: page >= totalPages ? "#475569" : "#94a3b8",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontSize: "0.8rem", fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          Next &rarr;
        </button>
      </div>

      <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
        Page {page} of {totalPages}
      </span>
    </div>
  )
}
