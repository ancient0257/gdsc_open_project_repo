import { useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import FileNode from "./components/FileNode";
import SidePanel from "./components/SidePanel";
import StatsPanel from "./components/StatsPanel";
import TopBar from "./components/TopBar";
import { layoutNodes } from "./utils/layout";
import { buildFlowData } from "./utils/buildFlowData";
import "./App.css";

const nodeTypes = { fileNode: FileNode };

const API_BASE = import.meta.env.VITE_API_URL || "";

function Workspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [stats, setStats] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [repoPath, setRepoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterLanguage, setFilterLanguage] = useState("all");
  const [filterComplexity, setFilterComplexity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rawData, setRawData] = useState(null);
  const reactFlow = useReactFlow();

  const analyseRepo = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    setAiSummary(null);
    setSearchQuery("");

    try {
      const res = await fetch(
        `${API_BASE}/api/analyse?repo_path=${encodeURIComponent(path)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setRawData(data);
      setStats(data.stats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFilters = useCallback((data, lang, complexity, search) => {
    if (!data) return;
    const { flowNodes, flowEdges } = buildFlowData(data, lang, complexity, search);
    const laid = layoutNodes(flowNodes, flowEdges);
    setNodes(laid);
    setEdges(flowEdges);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (rawData) applyFilters(rawData, filterLanguage, filterComplexity, searchQuery);
  }, [filterLanguage, filterComplexity, searchQuery, rawData, applyFilters]);

  useEffect(() => {
    if (nodes.length) {
      const t = setTimeout(() => reactFlow.fitView({ padding: 0.2, duration: 400 }), 60);
      return () => clearTimeout(t);
    }
  }, [rawData]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAiSummary = useCallback(async (nodeData) => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: nodeData.path,
          repo_root: repoPath,
        }),
      });
      const result = await res.json();
      setAiSummary(result);
    } catch (e) {
      setAiSummary({ summary: "Could not load AI summary.", cached: false });
    } finally {
      setAiLoading(false);
    }
  }, [repoPath]);

  const selectAndFocusNode = useCallback((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNode(node.data);
    setAiSummary(null);
    reactFlow.setCenter(node.position.x + 75, node.position.y + 50, { zoom: 1, duration: 400 });
    fetchAiSummary(node.data);
  }, [nodes, reactFlow, fetchAiSummary]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data);
    fetchAiSummary(node.data);
  }, [fetchAiSummary]);

  // Find a node by its dependency label (filename) for "jump to dependency" clicks
  const jumpToDependency = useCallback((depLabel) => {
    if (!rawData) return;
    const target = rawData.nodes.find((n) => n.label === depLabel || n.relative_path.endsWith(depLabel));
    if (target) selectAndFocusNode(target.id);
  }, [rawData, selectAndFocusNode]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.2, duration: 400 });
  }, [reactFlow]);

  const handleExport = useCallback(async () => {
    if (!repoPath.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/export-markdown?repo_path=${encodeURIComponent(repoPath)}`);
      if (!res.ok) throw new Error("Export failed");
      const { markdown } = await res.json();
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const repoName = repoPath.split("/").filter(Boolean).pop() || "repo";
      a.href = url;
      a.download = `${repoName}-analysis.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Could not export report: " + e.message);
    }
  }, [repoPath]);

  // Keyboard shortcuts: F = fit view, Esc = clear search / close panel
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "f" && !typing) handleFitView();
      if (e.key === "Escape") {
        if (searchQuery) setSearchQuery("");
        else if (selectedNode) setSelectedNode(null);
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.querySelector(".tb-filesearch-input")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleFitView, searchQuery, selectedNode]);

  const languages = rawData
    ? ["all", ...Object.keys(rawData.stats.language_distribution)]
    : ["all"];

  return (
    <div className="app">
      <TopBar
        repoPath={repoPath}
        onRepoPathChange={setRepoPath}
        onAnalyse={() => analyseRepo(repoPath)}
        loading={loading}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFitView={handleFitView}
        hasGraph={!!rawData}
        onExport={handleExport}
      />

      <div className="workspace">
        {stats && (
          <StatsPanel
            stats={stats}
            languages={languages}
            filterLanguage={filterLanguage}
            onLanguageChange={setFilterLanguage}
            filterComplexity={filterComplexity}
            onComplexityChange={setFilterComplexity}
            onSelectMostComplex={selectAndFocusNode}
            rawNodes={rawData?.nodes}
          />
        )}

        <div className="canvas-wrapper">
          {error && (
            <div className="error-banner">
              <span>⚠</span> {error}
            </div>
          )}
          {!error && stats?.truncated && (
            <div className="warn-banner">
              <span>ℹ</span> Repository exceeds {stats.max_files.toLocaleString()} files — showing the first {stats.max_files.toLocaleString()} found.
            </div>
          )}
          {loading && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Scanning repository…</p>
            </div>
          )}
          {!nodes.length && !loading && (
            <div className="empty-state">
              <div className="empty-icon">⬡</div>
              <h2>No repository loaded</h2>
              <p>Enter an absolute path above (or leave blank) and click <strong>Analyse</strong></p>
              <p className="hint">Example: /home/user/my-project, or leave blank to analyze this app's own code</p>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            minZoom={0.25}
            maxZoom={2.5}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            }}
          >
            <Background color="#1a2438" gap={28} size={1} />
            <Controls className="rf-controls" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => n.data?.color || "#2d4a7a"}
              style={{ background: "#0d1526", border: "1px solid #1e3050" }}
              maskColor="rgba(0,0,0,0.55)"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {selectedNode && (
          <SidePanel
            node={selectedNode}
            aiSummary={aiSummary}
            aiLoading={aiLoading}
            onClose={() => { setSelectedNode(null); setAiSummary(null); }}
            onJumpToDependency={jumpToDependency}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  );
}
