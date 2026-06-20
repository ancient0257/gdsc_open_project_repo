/**
 * buildFlowData – Convert raw API graph → React Flow nodes + edges,
 * applying language, complexity, and search filters.
 */

export const LANG_NODE_COLORS = {
  python:     { bg: "#0d1f30", border: "#2d6a9f", accent: "#4a9fd4", badge: "rgba(45,106,159,.25)", badgeText: "#6ab4f0", icon: "🐍" },
  javascript: { bg: "#1a150a", border: "#b8890a", accent: "#f0c040", badge: "rgba(184,137,10,.2)",  badgeText: "#f5c842", icon: "⚡" },
  typescript: { bg: "#0a1228", border: "#2d5ea8", accent: "#5b9af5", badge: "rgba(45,94,168,.25)",  badgeText: "#7bb4ff", icon: "🔷" },
  java:       { bg: "#1a1008", border: "#a06008", accent: "#e89020", badge: "rgba(160,96,8,.2)",    badgeText: "#f5a030", icon: "☕" },
  cpp:        { bg: "#081828", border: "#1860a0", accent: "#3888e0", badge: "rgba(24,96,160,.2)",   badgeText: "#60a8f5", icon: "⚙️" },
  c:          { bg: "#0f1a28", border: "#3a5070", accent: "#c8d9ec", badge: "rgba(58,80,112,.2)",   badgeText: "#8090a8", icon: "🔩" },
  go:         { bg: "#091c2a", border: "#0a8eaa", accent: "#20c0e0", badge: "rgba(10,142,170,.2)",  badgeText: "#30d0f0", icon: "🐹" },
  rust:       { bg: "#1e0c08", border: "#a03820", accent: "#e04a28", badge: "rgba(160,56,32,.2)",   badgeText: "#f07050", icon: "🦀" },
  ruby:       { bg: "#1f0808", border: "#cc342d", accent: "#f4645f", badge: "rgba(204,52,45,.2)",   badgeText: "#f4645f", icon: "💎" },
  php:        { bg: "#0f0f1f", border: "#777bb4", accent: "#9d9de0", badge: "rgba(119,123,180,.2)", badgeText: "#9d9de0", icon: "🐘" },
  csharp:     { bg: "#0f0a1f", border: "#512bd4", accent: "#7c5de0", badge: "rgba(81,43,212,.2)",   badgeText: "#7c5de0", icon: "🎯" },
  swift:      { bg: "#1f0e0a", border: "#f05138", accent: "#f47054", badge: "rgba(240,81,56,.2)",   badgeText: "#f47054", icon: "🍎" },
  kotlin:     { bg: "#130a1f", border: "#7f52ff", accent: "#a07aff", badge: "rgba(127,82,255,.2)",  badgeText: "#a07aff", icon: "🎪" },
  bash:       { bg: "#081808", border: "#206820", accent: "#40b040", badge: "rgba(32,104,32,.2)",   badgeText: "#60d060", icon: "💻" },
  unknown:    { bg: "#101820", border: "#3a5070", accent: "#5878a0", badge: "rgba(58,80,112,.2)",   badgeText: "#8090a8", icon: "📄" },
};

export function complexityLevel(cc) {
  if (cc < 10) return "low";
  if (cc < 25) return "medium";
  return "high";
}

/**
 * Returns the set of node IDs matching a search query (filename or relative path).
 * Empty query → empty set (caller treats empty set as "no search active").
 */
export function searchMatchIds(nodes, query) {
  if (!query || !query.trim()) return new Set();
  const q = query.trim().toLowerCase();
  return new Set(
    nodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.relative_path.toLowerCase().includes(q))
      .map((n) => n.id)
  );
}

export function buildFlowData(rawData, filterLang = "all", filterComplexity = "all", searchQuery = "") {
  const { nodes: rawNodes, edges: rawEdges } = rawData;

  // Filter nodes by language + complexity (search is applied as a dim/highlight, not a hide)
  const filtered = rawNodes.filter((n) => {
    if (filterLang !== "all" && n.language !== filterLang) return false;
    if (filterComplexity !== "all" && complexityLevel(n.cyclomatic_complexity) !== filterComplexity) return false;
    return true;
  });

  const filteredIds = new Set(filtered.map((n) => n.id));
  const matchIds = searchMatchIds(filtered, searchQuery);
  const hasSearch = matchIds.size > 0 || (searchQuery && searchQuery.trim().length > 0);

  // Build React Flow nodes
  const flowNodes = filtered.map((n) => {
    const colors = LANG_NODE_COLORS[n.language] || LANG_NODE_COLORS.unknown;
    const isDimmed = hasSearch && !matchIds.has(n.id);
    const isMatch = hasSearch && matchIds.has(n.id);
    return {
      id: n.id,
      type: "fileNode",
      position: { x: 0, y: 0 }, // will be set by layoutNodes
      data: {
        ...n,
        color: colors.accent,
        icon: colors.icon,
        badge: colors.badge,
        badgeText: colors.badgeText,
        isDimmed,
        isMatch,
      },
      style: {
        background: colors.bg,
        border: `1px solid ${isMatch ? "#f5d76e" : colors.border}`,
        borderRadius: "10px",
        opacity: isDimmed ? 0.25 : 1,
        boxShadow: isMatch ? "0 0 0 1.5px rgba(245,215,110,.55)" : undefined,
        transition: "opacity .15s, box-shadow .15s",
      },
    };
  });

  // Only include edges where both endpoints survived filtering
  const flowEdges = rawEdges
    .filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target))
    .map((e) => {
      const isDimmed = hasSearch && !matchIds.has(e.source) && !matchIds.has(e.target);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "smoothstep",
        animated: !isDimmed,
        style: {
          stroke: isDimmed ? "#1a2d4a" : "#4fd1c5",
          strokeWidth: isDimmed ? 1 : 1.5,
          opacity: isDimmed ? 0.3 : 0.65,
        },
      };
    });

  return { flowNodes, flowEdges };
}
