import { useState } from "react";
import "./SidePanel.css";

const LANG_BADGE_COLORS = {
  python: "#3776ab", javascript: "#f7df1e", typescript: "#3178c6",
  java: "#ed8b00", cpp: "#00599c", c: "#a8b9cc", go: "#00add8",
  rust: "#ce4a23", ruby: "#cc342d", php: "#777bb4", csharp: "#512bd4",
  swift: "#f05138", kotlin: "#7f52ff", bash: "#4eaa25",
};

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function complexityLevel(cc) {
  if (cc < 10) return { label: "Low", color: "#34d399" };
  if (cc < 25) return { label: "Medium", color: "#fbbf24" };
  return { label: "High", color: "#f87171" };
}

export default function SidePanel({ node, aiSummary, aiLoading, onClose, onJumpToDependency }) {
  const [copied, setCopied] = useState(false);
  const badgeColor = LANG_BADGE_COLORS[node.language] || "#64748b";
  const cc = complexityLevel(node.cyclomatic_complexity);

  const handleCopy = () => {
    if (!aiSummary?.summary) return;
    navigator.clipboard?.writeText(aiSummary.summary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="side-panel">
      <div className="sp-header">
        <div className="sp-title-row">
          <h3 className="sp-filename">{node.label}</h3>
          <button className="sp-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="sp-path">{node.relative_path}</div>
        <span className="lang-badge" style={{ background: badgeColor + "22", color: badgeColor, borderColor: badgeColor + "44" }}>
          {node.language}
        </span>
      </div>

      <div className="sp-section">
        <h4 className="sp-section-title">📊 Metrics</h4>
        <div className="metrics-grid">
          <MetricCard label="Lines of Code" value={node.lines_of_code.toLocaleString()} accent="#90cdf4" />
          <MetricCard label="Blank Lines" value={node.blank_lines.toLocaleString()} accent="#718096" />
          <MetricCard label="Comments" value={node.comment_lines.toLocaleString()} accent="#68d391" />
          <MetricCard label="File Size" value={formatBytes(node.size_bytes)} accent="#f6ad55" />
          <MetricCard
            label="Complexity"
            value={`${node.cyclomatic_complexity} (${cc.label})`}
            accent={cc.color}
          />
          <MetricCard label="Imports" value={node.dependencies?.length ?? 0} accent="#b794f4" />
        </div>
      </div>

      {node.dependencies && node.dependencies.length > 0 && (
        <div className="sp-section">
          <h4 className="sp-section-title">🔗 Dependencies ({node.dependencies.length})</h4>
          <div className="deps-list">
            {node.dependencies.slice(0, 12).map((d, i) => (
              <button
                key={i}
                className="dep-tag"
                onClick={() => onJumpToDependency && onJumpToDependency(d)}
                title="Jump to this file"
              >
                {d}
              </button>
            ))}
            {node.dependencies.length > 12 && (
              <span className="dep-tag dep-more">+{node.dependencies.length - 12} more</span>
            )}
          </div>
        </div>
      )}

      <div className="sp-section ai-section">
        <h4 className="sp-section-title">
          🤖 AI Summary
          {aiSummary?.cached && <span className="cache-badge">cached</span>}
        </h4>
        {aiLoading ? (
          <div className="ai-loading">
            <div className="ai-dots">
              <span /><span /><span />
            </div>
            <p>Analysing with Claude…</p>
          </div>
        ) : aiSummary ? (
          <div className="ai-box">
            <button className="ai-copy-btn" onClick={handleCopy}>
              {copied ? "✓ Copied" : "⧉ Copy"}
            </button>
            <p className="ai-text">{aiSummary.summary}</p>
          </div>
        ) : (
          <p className="ai-placeholder">Click a node to generate an AI summary.</p>
        )}
      </div>

      <div className="sp-hash">
        <span>SHA:</span> <code>{node.content_hash}</code>
      </div>
    </aside>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div className="metric-card">
      <span className="mc-value" style={{ color: accent }}>{value}</span>
      <span className="mc-label">{label}</span>
    </div>
  );
}
