# RepoLens — Repository Analysis Engine

A full-stack developer tool that parses local Git repositories and produces an interactive, AI-powered visual map of your codebase.

---

## Architecture

```
repo-analyzer/
├── backend/           # Python + FastAPI
│   ├── main.py        # REST API + analysis engine
│   ├── requirements.txt
│   └── start_backend.sh
└── frontend/          # React + React Flow
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── main.jsx
    │   ├── components/
    │   │   ├── FileNode.jsx / .css   # Custom draggable nodes
    │   │   ├── SidePanel.jsx / .css  # File details + AI summary
    │   │   ├── StatsPanel.jsx / .css # Left sidebar stats
    │   │   └── TopBar.jsx / .css     # Path input + controls
    │   └── utils/
    │       ├── buildFlowData.js      # API response → React Flow format
    │       └── layout.js             # Hierarchical node layout
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── start_frontend.sh
```

---

## Quick Start

### 1. Start the Backend

```bash
cd backend
chmod +x start_backend.sh
./start_backend.sh
```

The API will be live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

### 2. Start the Frontend

```bash
cd frontend
chmod +x start_frontend.sh
./start_frontend.sh
```

The app will be live at **http://localhost:5173**

### 3. Analyse a Repository

1. Open http://localhost:5173
2. Enter an absolute path in the top bar (e.g. `/home/user/my-project`)
3. Click **Analyse →**
4. Click any node to see details + AI summary

---

## Features

### Backend (Python + FastAPI)

| Feature | Detail |
|---------|--------|
| Multi-language parsing | Python, JS/TS, Java, C/C++, Go, Rust, Ruby, PHP, C#, Kotlin, Swift, Bash, R |
| Dependency extraction | Regex-based import/require/include detection |
| Lines of Code (LoC) | Total, blank, comment, net LoC per file |
| Cyclomatic Complexity | **Exact** for Python via `ast` traversal; regex-keyword approximation for every other language |
| Large-repo safety cap | Caps traversal at 3,000 files (`MAX_FILES`); flags `truncated` in the response so the UI can warn |
| AI Summaries | Anthropic Claude via `/api/ai-summary` |
| Response caching | Content-hash keyed in-memory cache |
| Markdown export | `/api/export-markdown` — shareable report with language/complexity tables |
| REST API | FastAPI with auto-generated OpenAPI docs |

### Frontend (React + React Flow)

| Feature | Detail |
|---------|--------|
| Draggable canvas | React Flow infinite canvas with zoom/pan |
| Custom nodes | Per-language icon badge + colour theme, LoC/CC/deps metrics, complexity bar with letter grade |
| Hierarchical layout | Topological sort assigns dependency layers |
| Minimap | Overview of full graph, pannable and zoomable |
| File search | Live search by filename or path — dims non-matches, highlights matches in amber |
| Language filter | Click a language in the sidebar, or use the dropdown |
| Complexity filter | Click a complexity row in the sidebar, or use the dropdown |
| Clickable dependencies | Click a dependency chip in the side panel to jump straight to that file |
| Clickable "most complex" | Click any entry in the sidebar's top-5 list to focus that node |
| Fit view | Button or `F` key — recenters and rescales to fit all visible nodes |
| Keyboard shortcuts | `/` focus search, `Esc` clear search or close panel, `F` fit view |
| Export report | Downloads a markdown report of the current analysis |
| Stats panel | File count, LoC totals, complexity distribution, top-5 most complex |
| Side panel | Full metrics + dependency list + AI summary with copy-to-clipboard |
| AI caching indicator | "cached" badge when summary reused |
| Truncation warning | Amber banner when a repo exceeds the file cap |

---

## API Reference

### `GET /api/analyse?repo_path=<path>`

Traverses a directory and returns the full graph.

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
      "blank_lines": 18,
      "comment_lines": 24,
      "cyclomatic_complexity": 11,
      "size_bytes": 4821,
      "content_hash": "a1b2c3d4e5f6a7b8",
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
    "complexity_distribution": { "low": 35, "medium": 10, "high": 2 },
    "avg_loc": 179.1,
    "most_complex": [...]
  }
}
```

### `POST /api/ai-summary`

Request Claude to explain a file.

**Body:**
```json
{
  "file_path": "/absolute/path/to/file.py",
  "repo_root": "/absolute/path/to/repo"
}
```

**Response:**
```json
{
  "summary": "This file defines the main FastAPI application...",
  "cached": false
}
```

### `GET /api/file-content?file_path=<path>`

Returns raw file content (UTF-8, Latin-1, or CP1252 fallback).

### `GET /api/export-markdown?repo_path=<path>`

Returns a shareable markdown report — overview stats, language distribution table, complexity distribution table, and the top-5 most complex files. The frontend's **Export** button downloads this directly as a `.md` file.

**Response:**
```json
{ "markdown": "# Repository analysis: my-project\n\n- **Files analysed:** 47\n..." }
```

---

## Configuration

### Environment Variables (frontend)

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

### Skipped Directories

The backend automatically skips: `.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build`, `.next`, `target`, and other build artifact directories.

### Supported Languages

`.py` `.js` `.ts` `.jsx` `.tsx` `.java` `.cpp` `.c` `.h` `.hpp` `.go` `.rs` `.rb` `.php` `.cs` `.swift` `.kt` `.scala` `.r` `.m` `.lua` `.sh` `.bash`

---

## Complexity Thresholds

| Level | CC Score | Node colour |
|-------|----------|-------------|
| Low   | < 10     | Green       |
| Medium| 10 – 24  | Amber       |
| High  | 25+      | Red         |

For Python files, cyclomatic complexity is computed exactly via `ast` traversal — counting `if`/`for`/`while`/`except`/`with` nodes, boolean operator branches, comprehensions, lambdas, and `match` cases. Every other supported language falls back to a regex keyword-counting heuristic (no execution required, but less precise than full AST parsing).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the file search box |
| `Esc` | Clear search, or close the side panel if search is empty |
| `F` | Fit the graph to the current view |

## Large Repositories

Traversal is capped at 3,000 files (`MAX_FILES` in `main.py`). If a repository exceeds this, the response's `stats.truncated` flag is set to `true` and the frontend shows an amber warning banner. Raise `MAX_FILES` in the backend if you need to analyse larger codebases — just expect slower response times.

---

## AI Integration Notes

- Summaries are generated via the Anthropic API (`claude-sonnet-4-20250514`)
- Each summary is cached by the SHA-256 hash of the file content
- Files are truncated to 4000 characters before sending to the API
- The backend needs no API key when running inside Claude.ai's infrastructure
- For standalone deployments, pass `"api_key": "sk-ant-..."` in the AI summary request body

---

## Performance Tips

- Large repos (1000+ files) may take 10–20 seconds to analyse
- Complexity filters help focus on high-interest files
- The minimap helps navigate large graphs
- Use the language filter to explore one language at a time
