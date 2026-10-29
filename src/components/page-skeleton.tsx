import { adminSection, sectionTitle } from "@/lib/admin/navigation";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

const TABLE_COLUMNS = { profiles: 6, votes: 4, "catalog-list": 5 } as const;

export default function PageSkeleton({ pathname = "/" }: { pathname?: string }) {
  const section = adminSection(pathname);
  const title = sectionTitle(pathname);
  return <div className="page-skeleton" role="status" aria-label={`Loading ${title.toLowerCase()}`}>
    <span className="sr-only">Loading {title.toLowerCase()}…</span>
    <div aria-hidden="true">
      <div className="page-heading"><h1>{title}</h1>{["overview", "media"].includes(section) && <Bar className="skeleton-button" />}</div>
      {section === "overview" ? <>
        <div className="metrics">{Array.from({ length: 4 }, (_, i) => <div className="metric skeleton-metric" key={i}><Bar className="skeleton-label" /><Bar className="skeleton-number" /><Bar className="skeleton-line" /></div>)}</div>
        <div className="dashboard-grid">{Array.from({ length: 4 }, (_, i) => <div className="panel skeleton-panel" key={i}><Bar className="skeleton-title" /><div className="skeleton-chart">{Array.from({ length: 7 }, (_, j) => <Bar key={j} className={`skeleton-column column-${j % 4}`} />)}</div></div>)}</div>
      </> : section in TABLE_COLUMNS ? <>
        <Bar className="skeleton-search" /><div className="panel table-panel skeleton-table">{Array.from({ length: 7 }, (_, i) => <div className="skeleton-row" key={i}>{Array.from({ length: TABLE_COLUMNS[section as keyof typeof TABLE_COLUMNS] }, (_, j) => <Bar className="skeleton-line" key={j} />)}</div>)}</div>
      </> : section === "media" ? <>
        <Bar className="skeleton-search" /><div className="media-grid">{Array.from({ length: 6 }, (_, i) => <div className="media-card" key={i}><Bar className="skeleton-image" /><div className="media-body"><Bar className="skeleton-label" /><Bar className="skeleton-title" /><Bar className="skeleton-line" /></div></div>)}</div>
      </> : <div className="editor-layout"><div className="panel"><Bar className="skeleton-image" /><Bar className="skeleton-title" /><Bar className="skeleton-line" /></div><div className="panel skeleton-editor">{Array.from({ length: 3 }, (_, i) => <div key={i}><Bar className="skeleton-label" /><Bar className="skeleton-field" /></div>)}<Bar className="skeleton-button" /></div></div>}
    </div>
  </div>;
}
