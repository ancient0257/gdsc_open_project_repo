import { Handle, Position } from "reactflow";
import "./FileNode.css";

const CC_COLOR = {
  low: "#3dd68c",
  medium: "#f5c542",
  high: "#f06060",
};

function complexityLabel(cc) {
  if (cc < 10) return "low";
  if (cc < 25) return "medium";
  return "high";
}

function formatLoc(loc) {
  if (loc >= 1000) return `${(loc / 1000).toFixed(1)}k`;
  return String(loc);
}

export default function FileNode({ data, selected }) {
  const level = complexityLabel(data.cyclomatic_complexity);
  const ccColor = CC_COLOR[level];
  const icon = data.icon || "📄";

  return (
    <div
      className={`file-node ${selected ? "selected" : ""} ${data.isDimmed ? "dimmed" : ""} ${data.isMatch ? "search-match" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="rf-handle" />

      <div className="node-header">
        <span className="lang-icon" style={{ background: data.badge }}>{icon}</span>
        <span className="node-label" title={data.relative_path}>{data.label}</span>
      </div>

      <div className="node-metrics">
        <div className="metric">
          <span className="metric-val" style={{ color: data.color }}>{formatLoc(data.lines_of_code)}</span>
          <span className="metric-key">LoC</span>
        </div>
        <div className="metric">
          <span className="metric-val" style={{ color: ccColor }}>
            {data.cyclomatic_complexity}
          </span>
          <span className="metric-key">CC</span>
        </div>
        <div className="metric">
          <span className="metric-val">{data.dependencies?.length ?? 0}</span>
          <span className="metric-key">deps</span>
        </div>
      </div>

      <div className="cc-row">
        <div
          className="complexity-bar"
          title={`Cyclomatic complexity: ${data.cyclomatic_complexity} (${level})`}
        >
          <div
            className="complexity-fill"
            style={{
              width: `${Math.min(100, (data.cyclomatic_complexity / 40) * 100)}%`,
              background: ccColor,
            }}
          />
        </div>
        <span className="cc-letter" style={{ color: ccColor }}>{level[0].toUpperCase()}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="rf-handle" />
    </div>
  );
}
