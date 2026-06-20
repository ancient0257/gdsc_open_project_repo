# RepoLens — Repository Analysis Engine

**🌍 Live Demo:** [https://gdsc-open-project-repo.onrender.com/](https://gdsc-open-project-repo.onrender.com/)

A full-stack developer tool that takes any **public GitHub repository URL**, automatically clones it, and produces an interactive, AI-powered visual map of the codebase — showing file dependencies, code complexity, and language distribution on a beautiful draggable canvas.

---

## How to Use

1. Open the [live demo](https://gdsc-open-project-repo.onrender.com/)
2. Paste a public GitHub URL into the top bar (e.g. `https://github.com/facebook/react`)
3. Click **Analyse →**
4. Click any node on the canvas to see an AI-generated explanation of that file

> Leave the URL blank and click Analyse to see the app analyze its own source code as a live demo.

---

## Architecture

```
repo/
├── backend/                   # Python + FastAPI
│   ├── main.py                # REST API + analysis engine + GitHub cloning
│   └── requirements.txt
├── frontend/                  # React + Vite
│   ├── src/
│   │   ├── App.jsx            # Main application logic
│   │   ├── App.css
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── FileNode.jsx/css    # Custom draggable nodes
│   │   │   ├── SidePanel.jsx/css   # File details + AI summary
│   │   │   ├── StatsPanel.jsx/css  # Left sidebar stats
│   │   │   └── TopBar.jsx/css      # URL input + controls
│   │   └── utils/
│   │       ├── buildFlowData.js    # API response → React Flow format
│   │       └── layout.js           # Hierarchical node layout (dagre)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── Dockerfile                 # Multi-stage Docker build
└── docker-compose.yml         # One-command local run
```

---

## Quick Start (Docker)

```bash
# Clone this repo
git clone https://github.com/ancient0257/gdsc_open_project_repo.git
cd gdsc_open_project_repo

# Set your Gemini API key (optional — needed for AI summaries)
# On Windows:
set GEMINI_API_KEY=your_key_here
# On Linux/Mac:
export GEMINI_API_KEY=your_key_here

# Run the whole app with a single command
docker-compose up --build
```

Then open **http://localhost:8000** in your browser.

---

## Features

### Backend (Python + FastAPI)

| Feature | Detail |
|---------|--------|
| GitHub URL Analysis | Clones any public GitHub repo via `git clone --depth=1`, analyses it, and auto-deletes the temp folder |
| Multi-language parsing | Python, JS/TS, Java, C/C++, Go, Rust, Ruby, PHP, C#, Kotlin, Swift, Bash, R |
| Dependency extraction | Regex-based import/require/include detection |
| Lines of Code (LoC) | Total, blank, comment, net LoC per file |
| Cyclomatic Complexity | Exact for Python via `ast`; keyword heuristic for all other languages |
| Large-repo safety cap | Caps traversal at 3,000 files; flags `truncated` in the response |
| AI Summaries | Google Gemini 1.5 Flash via `/api/ai-summary` |
| Response caching | Content-hash keyed in-memory cache — no repeat API calls for unchanged files |
| Markdown export | `/api/export-markdown` — shareable report with language/complexity tables |
| Static file serving | FastAPI serves the compiled React frontend — single unified service |

### Frontend (React + React Flow)

| Feature | Detail |
|---------|--------|
| Draggable canvas | React Flow infinite canvas with zoom/pan |
| Custom nodes | Per-language icon badge + colour theme, LoC/CC/deps metrics, complexity bar |
| Hierarchical layout | Topological sort using `dagre` assigns dependency layers |
| Minimap | Overview of full graph, pannable and zoomable |
| File search | Live search by filename — dims non-matches, highlights matches |
| Language filter | Filter graph by programming language |
| Complexity filter | Filter graph by cyclomatic complexity level |
| Clickable dependencies | Click a dependency chip in the side panel to jump to that file |
| Fit view | Button or `F` key |
| Keyboard shortcuts | `/` focus search, `Esc` clear/close, `F` fit view |
| Export report | Downloads a markdown analysis report |
| AI summary panel | Click any node for an instant AI-powered plain-English file explanation |

---

## API Reference

### `GET /api/analyse?github_url=<url>`

Clones a public GitHub repository and returns the full dependency graph.

```
GET /api/analyse?github_url=https://github.com/username/repo
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "abc123",
      "label": "main.py",
      "relative_path": "src/main.py",
      "language": "python",
      "lines_of_code": 142,
      "cyclomatic_complexity": 11,
      "dependencies": ["utils", "models"]
    }
  ],
  "edges": [
    { "id": "e_abc123_def456", "source": "abc123", "target": "def456", "label": "imports" }
  ],
  "stats": {
    "total_files": 47,
    "total_edges": 63,
    "total_loc": 8420,
    "language_distribution": { "python": 31, "javascript": 16 },
    "complexity_distribution": { "low": 35, "medium": 10, "high": 2 }
  }
}
```

### `POST /api/ai-summary`

Generate a Gemini AI explanation for a specific file.

**Body:**
```json
{
  "file_path": "/absolute/path/to/file.py",
  "repo_root": "",
  "api_key": "optional_gemini_key"
}
```

### `GET /api/export-markdown?github_url=<url>`

Returns a shareable markdown report of the repository analysis.

### `GET /api/health`

Returns server health and AI summary cache size.

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key for AI summaries (optional — can also be passed per-request) |

---

## Complexity Thresholds

| Level | CC Score | Node colour |
|-------|----------|-------------|
| Low   | < 10     | 🟢 Green    |
| Medium| 10 – 24  | 🟡 Amber    |
| High  | 25+      | 🔴 Red      |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the file search box |
| `Esc` | Clear search, or close the side panel |
| `F` | Fit the graph to the current view |

---

## Cloud Deployment

This app is packaged as a single Docker service. To deploy on **Render.com**:
1. Connect your GitHub repository.
2. Choose **Docker** as the environment.
3. Add `GEMINI_API_KEY` as an environment variable.
4. Click Deploy.

---

_Generated by RepoLens_
