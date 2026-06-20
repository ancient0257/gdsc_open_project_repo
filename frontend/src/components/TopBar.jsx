import "./TopBar.css";

export default function TopBar({
  repoPath, onRepoPathChange, onAnalyse, loading, nodeCount, edgeCount,
  searchQuery, onSearchChange, onFitView, hasGraph, onExport,
}) {
  const handleKey = (e) => {
    if (e.key === "Enter") onAnalyse();
  };

  return (
    <header className="top-bar">
      <div className="tb-brand">
        <span className="tb-hex">⬡</span>
        <div>
          <span className="tb-title">RepoLens</span>
          <span className="tb-sub">Repository Analysis Engine</span>
        </div>
      </div>

      <div className="tb-search">
        <span className="tb-icon">📂</span>
        <input
          type="text"
          className="tb-path-input"
          placeholder="/absolute/path/to/repo (or leave blank to analyze this app)"
          value={repoPath}
          onChange={(e) => onRepoPathChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAnalyse();
          }}
        /><button
          className={`tb-btn ${loading ? "loading" : ""}`}
          onClick={onAnalyse}
          disabled={loading}
        >
          {loading ? (
            <><span className="btn-spinner" /> Scanning…</>
          ) : (
            <>Analyse →</>
          )}
        </button>
      </div>

      {hasGraph && (
        <div className="tb-filesearch">
          <span className="tb-icon-sm">🔍</span>
          <input
            className="tb-filesearch-input"
            type="text"
            placeholder="Search files… ( / )"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button className="tb-clear" onClick={() => onSearchChange("")} title="Clear search">✕</button>
          )}
        </div>
      )}

      <div className="tb-meta">
        {nodeCount > 0 && (
          <>
            <span className="tb-badge">{nodeCount} files</span>
            <span className="tb-badge accent">{edgeCount} links</span>
          </>
        )}
        {hasGraph && (
          <button className="tb-fit-btn" onClick={onFitView} title="Fit graph to view (F)">
            ⤢ Fit
          </button>
        )}
        {hasGraph && onExport && (
          <button className="tb-fit-btn" onClick={onExport} title="Export as markdown report">
            ⤓ Export
          </button>
        )}
        <a
          className="tb-docs"
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
        >
          API Docs ↗
        </a>
      </div>
    </header>
  );
}
