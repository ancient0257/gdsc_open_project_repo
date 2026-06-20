import "./StatsPanel.css";

export default function StatsPanel({
  stats, languages, filterLanguage, onLanguageChange,
  filterComplexity, onComplexityChange, onSelectMostComplex, rawNodes,
}) {
  if (!stats) return null;

  const langEntries = Object.entries(stats.language_distribution)
    .sort((a, b) => b[1] - a[1]);

  const handleLangClick = (lang) => {
    onLanguageChange(filterLanguage === lang ? "all" : lang);
  };

  const findNodeIdByLabel = (label) => {
    if (!rawNodes) return null;
    const match = rawNodes.find((n) => n.label === label);
    return match?.id ?? null;
  };

  return (
    <aside className="stats-panel">
      <div className="sp-inner">
        <div className="stats-logo">
          <span className="logo-mark">⬡</span>
          <span className="logo-text">RepoLens</span>
        </div>

        <div className="stat-row">
          <div className="stat-item">
            <span className="stat-num">{stats.total_files}</span>
            <span className="stat-lbl">Files</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">{stats.total_edges}</span>
            <span className="stat-lbl">Links</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">{(stats.total_loc / 1000).toFixed(1)}k</span>
            <span className="stat-lbl">Total LoC</span>
          </div>
          <div className="stat-item">
            <span className="stat-num">{stats.avg_loc}</span>
            <span className="stat-lbl">Avg LoC</span>
          </div>
        </div>

        <div className="section-label">Complexity</div>
        <div className="complexity-breakdown">
          {["low", "medium", "high"].map((level) => {
            const count = stats.complexity_distribution[level] || 0;
            const pct = Math.round((count / Math.max(stats.total_files, 1)) * 100);
            const color = level === "low" ? "#34d399" : level === "medium" ? "#fbbf24" : "#f87171";
            const active = filterComplexity === level;
            return (
              <div
                key={level}
                className={`cc-row ${active ? "active" : ""}`}
                onClick={() => onComplexityChange(active ? "all" : level)}
                title={`Filter to ${level} complexity files`}
              >
                <span className="cc-label" style={{ color }}>{level}</span>
                <div className="cc-bar-bg">
                  <div className="cc-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="cc-count">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="section-label">Languages <span className="hint-text">(click to filter)</span></div>
        <div className="lang-dist">
          {langEntries.map(([lang, count]) => (
            <div
              key={lang}
              className={`lang-row ${filterLanguage === lang ? "active" : ""}`}
              onClick={() => handleLangClick(lang)}
            >
              <span className="lang-name">{lang}</span>
              <span className="lang-count">{count}</span>
            </div>
          ))}
        </div>

        <div className="section-label">Filters</div>
        <div className="filter-group">
          <label className="filter-label">Language</label>
          <select
            className="filter-select"
            value={filterLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Complexity</label>
          <select
            className="filter-select"
            value={filterComplexity}
            onChange={(e) => onComplexityChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="low">Low (&lt;10)</option>
            <option value="medium">Medium (10–24)</option>
            <option value="high">High (25+)</option>
          </select>
        </div>

        {stats.most_complex?.length > 0 && (
          <>
            <div className="section-label">Most Complex</div>
            <div className="complex-list">
              {stats.most_complex.map((item, i) => {
                const nodeId = findNodeIdByLabel(item.file);
                return (
                  <div
                    key={i}
                    className="complex-item"
                    onClick={() => nodeId && onSelectMostComplex && onSelectMostComplex(nodeId)}
                    style={{ cursor: nodeId ? "pointer" : "default" }}
                    title={nodeId ? "Click to focus this file" : item.file}
                  >
                    <span className="complex-name" title={item.file}>{item.file}</span>
                    <span className="complex-cc">{item.complexity}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
