"""
Repository Structure Analysis Engine - FastAPI Backend
"""
import os
import re
import ast
import json
import hashlib
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RepoLens API",
    description="Repository Structure Analysis Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ───────────────────────────────────────────────────────────────
SKIP_DIRS = {
    ".git", ".svn", ".hg", "__pycache__", "node_modules",
    ".venv", "venv", "env", ".env", "dist", "build", ".next",
    ".nuxt", "coverage", ".nyc_output", "target", ".cargo",
    ".pytest_cache", ".mypy_cache", ".tox", "eggs", ".eggs",
    "*.egg-info",
}

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c",
    ".h", ".hpp", ".go", ".rs", ".rb", ".php", ".cs", ".swift",
    ".kt", ".scala", ".r", ".m", ".lua", ".sh", ".bash",
}

# Hard cap to keep very large repos from hanging the request indefinitely.
# Files beyond this count are skipped; the response notes the truncation.
MAX_FILES = 3000

COMPLEXITY_KEYWORDS = {
    "python": ["if", "elif", "else", "for", "while", "try", "except",
               "with", "lambda", "and", "or", "not"],
    "javascript": ["if", "else", "for", "while", "switch", "case",
                   "catch", "&&", "||", "?", "??"],
    "java": ["if", "else", "for", "while", "switch", "case", "catch",
             "&&", "||", "?", "throw"],
    "cpp": ["if", "else", "for", "while", "switch", "case", "catch",
            "&&", "||", "?", "throw"],
    "go": ["if", "else", "for", "switch", "case", "select",
           "&&", "||"],
}

# ── AI Summary Cache (in-memory, keyed by file content hash) ────────────────
_summary_cache: dict[str, str] = {}

# ── Data Models ─────────────────────────────────────────────────────────────
@dataclass
class FileNode:
    id: str
    label: str
    path: str
    relative_path: str
    extension: str
    language: str
    lines_of_code: int
    blank_lines: int
    comment_lines: int
    cyclomatic_complexity: int
    size_bytes: int
    content_hash: str
    dependencies: list[str] = field(default_factory=list)
    node_type: str = "file"   # file | directory

@dataclass
class Edge:
    id: str
    source: str
    target: str
    label: str = "imports"

@dataclass
class RepoGraph:
    nodes: list[dict]
    edges: list[dict]
    stats: dict

class AIRequest(BaseModel):
    file_path: str
    repo_root: str
    api_key: Optional[str] = None

# ── Parsers ─────────────────────────────────────────────────────────────────

def detect_language(ext: str) -> str:
    mapping = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".jsx": "javascript", ".tsx": "typescript", ".java": "java",
        ".cpp": "cpp", ".c": "c", ".h": "c", ".hpp": "cpp",
        ".go": "go", ".rs": "rust", ".rb": "ruby", ".php": "php",
        ".cs": "csharp", ".swift": "swift", ".kt": "kotlin",
        ".scala": "scala", ".r": "r", ".m": "matlab",
        ".lua": "lua", ".sh": "bash", ".bash": "bash",
    }
    return mapping.get(ext.lower(), "unknown")


def python_ast_complexity(content: str) -> Optional[int]:
    """
    Compute exact cyclomatic complexity for Python via AST traversal.
    Returns None if the file has a syntax error (caller should fall back
    to the regex heuristic in that case).
    """
    try:
        tree = ast.parse(content)
    except (SyntaxError, ValueError):
        return None

    complexity = 1
    for node in ast.walk(tree):
        if isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While,
                              ast.ExceptHandler, ast.With, ast.AsyncWith)):
            complexity += 1
        elif isinstance(node, ast.BoolOp):
            # each additional and/or adds a branch
            complexity += len(node.values) - 1
        elif isinstance(node, (ast.comprehension,)):
            complexity += 1
        elif isinstance(node, ast.Lambda):
            complexity += 1
        elif isinstance(node, ast.Match):
            complexity += len(node.cases)
    return complexity


def compute_metrics(content: str, language: str) -> dict:
    lines = content.splitlines()
    total = len(lines)
    blank = sum(1 for l in lines if not l.strip())

    # Comment detection per language
    comment_patterns = {
        "python": (r'^\s*#', r'^\s*"""', r"^\s*'''"),
        "javascript": (r'^\s*//', r'^\s*/\*'),
        "typescript": (r'^\s*//', r'^\s*/\*'),
        "java": (r'^\s*//', r'^\s*/\*'),
        "cpp": (r'^\s*//', r'^\s*/\*'),
        "c": (r'^\s*//', r'^\s*/\*'),
        "go": (r'^\s*//', r'^\s*/\*'),
        "rust": (r'^\s*//', r'^\s*/\*'),
        "ruby": (r'^\s*#',),
        "bash": (r'^\s*#',),
        "r": (r'^\s*#',),
    }
    patterns = comment_patterns.get(language, (r'^\s*#', r'^\s*//'))
    comment = sum(
        1 for l in lines
        if any(re.match(p, l) for p in patterns)
    )

    loc = total - blank - comment

    # Prefer exact AST-based complexity for Python; fall back to the
    # regex heuristic for every other language (and for unparsable Python).
    complexity = None
    if language == "python":
        complexity = python_ast_complexity(content)

    if complexity is None:
        kw = COMPLEXITY_KEYWORDS.get(language, COMPLEXITY_KEYWORDS["javascript"])
        complexity = 1
        for line in lines:
            for k in kw:
                if re.search(r'\b' + re.escape(k) + r'\b', line):
                    complexity += 1
                    break  # one per line max

    return {
        "lines_of_code": max(loc, 0),
        "blank_lines": blank,
        "comment_lines": comment,
        "cyclomatic_complexity": complexity,
    }


def extract_dependencies(content: str, language: str, file_path: Path) -> list[str]:
    """Extract raw import strings from source code."""
    deps = []

    if language == "python":
        # import X / from X import Y
        for m in re.finditer(
            r'^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))',
            content, re.MULTILINE
        ):
            dep = m.group(1) or m.group(2)
            for d in dep.split(","):
                deps.append(d.strip().split(".")[0])

    elif language in ("javascript", "typescript"):
        # import … from '…' / require('…')
        for m in re.finditer(
            r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""",
            content
        ):
            deps.append(m.group(1) or m.group(2))

    elif language == "java":
        for m in re.finditer(r'^import\s+([\w.]+);', content, re.MULTILINE):
            deps.append(m.group(1))

    elif language in ("c", "cpp"):
        for m in re.finditer(r'^#include\s+["<](.*?)[">]', content, re.MULTILINE):
            deps.append(m.group(1))

    elif language == "go":
        for m in re.finditer(r'"([^"]+)"', content):
            deps.append(m.group(1))

    elif language == "rust":
        for m in re.finditer(r'^use\s+([\w:]+)', content, re.MULTILINE):
            deps.append(m.group(1))

    return list(set(deps))


def safe_read(path: Path) -> Optional[str]:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, OSError):
            continue
    return None


def node_id(path: Path, root: Path) -> str:
    rel = str(path.relative_to(root)).replace(os.sep, "/")
    return hashlib.md5(rel.encode()).hexdigest()[:12]


# ── Core Traversal ──────────────────────────────────────────────────────────

def analyse_repository(root_path: str) -> RepoGraph:
    root = Path(root_path).resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError(f"Path does not exist or is not a directory: {root_path}")

    nodes_map: dict[str, FileNode] = {}
    all_deps: dict[str, list[str]] = {}  # node_id → raw dep strings
    truncated = False

    # Walk the tree
    for dirpath, dirnames, filenames in os.walk(root):
        current = Path(dirpath)

        # Prune skip dirs in-place
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        for fname in filenames:
            if len(nodes_map) >= MAX_FILES:
                truncated = True
                break

            fpath = current / fname
            ext = fpath.suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue

            content = safe_read(fpath)
            if content is None:
                continue

            lang = detect_language(ext)
            metrics = compute_metrics(content, lang)
            nid = node_id(fpath, root)
            rel = str(fpath.relative_to(root)).replace(os.sep, "/")
            content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

            node = FileNode(
                id=nid,
                label=fname,
                path=str(fpath),
                relative_path=rel,
                extension=ext,
                language=lang,
                size_bytes=fpath.stat().st_size,
                content_hash=content_hash,
                **metrics,
            )
            nodes_map[nid] = node

            raw_deps = extract_dependencies(content, lang, fpath)
            all_deps[nid] = raw_deps

        if truncated:
            break

    # Resolve dependencies to node IDs
    # Build a reverse lookup: relative_path → node_id
    rel_to_id: dict[str, str] = {
        n.relative_path: nid for nid, n in nodes_map.items()
    }
    # Also build a basename lookup for partial matching
    base_to_ids: dict[str, list[str]] = {}
    for nid, n in nodes_map.items():
        base = Path(n.relative_path).stem
        base_to_ids.setdefault(base, []).append(nid)

    edges: list[Edge] = []
    edge_set: set[tuple[str, str]] = set()

    for src_id, raw_deps in all_deps.items():
        src_node = nodes_map[src_id]
        for dep in raw_deps:
            # Try to find a matching file in the repo
            dep_clean = dep.strip().lstrip("./").replace("/", os.sep)
            matched = None

            # Check for relative-path match
            for candidate_rel, candidate_id in rel_to_id.items():
                stem = Path(dep_clean).stem
                if Path(candidate_rel).stem == stem and candidate_id != src_id:
                    matched = candidate_id
                    break

            if matched and (src_id, matched) not in edge_set:
                edge_set.add((src_id, matched))
                eid = f"e_{src_id}_{matched}"
                edges.append(Edge(id=eid, source=src_id, target=matched))
                nodes_map[src_id].dependencies.append(matched)

    # Stats
    total_loc = sum(n.lines_of_code for n in nodes_map.values())
    lang_dist: dict[str, int] = {}
    for n in nodes_map.values():
        lang_dist[n.language] = lang_dist.get(n.language, 0) + 1

    complexity_dist = {"low": 0, "medium": 0, "high": 0}
    for n in nodes_map.values():
        if n.cyclomatic_complexity < 10:
            complexity_dist["low"] += 1
        elif n.cyclomatic_complexity < 25:
            complexity_dist["medium"] += 1
        else:
            complexity_dist["high"] += 1

    stats = {
        "total_files": len(nodes_map),
        "total_edges": len(edges),
        "total_loc": total_loc,
        "language_distribution": lang_dist,
        "complexity_distribution": complexity_dist,
        "avg_loc": round(total_loc / max(len(nodes_map), 1), 1),
        "most_complex": sorted(
            [{"file": n.label, "complexity": n.cyclomatic_complexity}
             for n in nodes_map.values()],
            key=lambda x: x["complexity"], reverse=True
        )[:5],
        "truncated": truncated,
        "max_files": MAX_FILES,
    }

    return RepoGraph(
        nodes=[asdict(n) for n in nodes_map.values()],
        edges=[asdict(e) for e in edges],
        stats=stats,
    )


# ── API Routes ──────────────────────────────────────────────────────────────


@app.get("/api/analyse")
def analyse(repo_path: Optional[str] = Query(None, description="Absolute path to the git repo. Leave blank for self-analysis demo.")):
    try:
        # Fallback to current working directory if empty
        if not repo_path or repo_path.strip().lower() == "demo":
            repo_path = os.getcwd()
            
        graph = analyse_repository(repo_path)
        return JSONResponse(content={
            "nodes": graph.nodes,
            "edges": graph.edges,
            "stats": graph.stats,
        })
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


@app.get("/api/file-content")
def file_content(file_path: str = Query(...)):
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    content = safe_read(p)
    if content is None:
        raise HTTPException(status_code=422, detail="Cannot decode file")
    return {"path": file_path, "content": content}


@app.post("/api/ai-summary")
async def ai_summary(req: AIRequest):
    """
    Generate an AI summary of a file using the Google Gemini API.
    Responses are cached by content hash to save API costs.
    """
    import httpx

    p = Path(req.file_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="File not found")

    content = safe_read(p)
    if content is None:
        raise HTTPException(status_code=422, detail="Cannot decode file")

    # Cache lookup
    content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
    if content_hash in _summary_cache:
        return {"summary": _summary_cache[content_hash], "cached": True}

    # Truncate very large files
    snippet = content[:4000] if len(content) > 4000 else content
    lang = detect_language(p.suffix)

    prompt = (
        f"This is a {lang} source file named `{p.name}`.\n\n"
        f"```{lang}\n{snippet}\n```\n\n"
        "Please explain what this code does in exactly 3 short, plain-English sentences. "
        "Focus on: (1) the file's purpose, (2) its main logic or key functions, "
        "(3) any important dependencies or side-effects. Be concise and developer-friendly."
    )

    api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required. Please provide it in the UI or set GEMINI_API_KEY environment variable.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"AI API error: {resp.text[:200]}"
        )

    data = resp.json()
    try:
        summary = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=500, detail="Failed to parse Gemini response.")
        
    _summary_cache[content_hash] = summary
    return {"summary": summary, "cached": False}


@app.get("/api/export-markdown")
def export_markdown(repo_path: str = Query(..., description="Absolute path to the git repo")):
    """
    Export the analysis as a shareable markdown report — repo overview,
    language breakdown, and the most complex files, ready to drop into
    a README or a PR description.
    """
    try:
        graph = analyse_repository(repo_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    stats = graph.stats
    repo_name = Path(repo_path).name or repo_path

    lines = [
        f"# Repository analysis: {repo_name}",
        "",
        f"- **Files analysed:** {stats['total_files']}",
        f"- **Dependency links:** {stats['total_edges']}",
        f"- **Total lines of code:** {stats['total_loc']:,}",
        f"- **Average LoC per file:** {stats['avg_loc']}",
        "",
        "## Language distribution",
        "",
        "| Language | Files |",
        "|---|---|",
    ]
    for lang, count in sorted(stats["language_distribution"].items(), key=lambda x: -x[1]):
        lines.append(f"| {lang} | {count} |")

    lines += [
        "",
        "## Complexity distribution",
        "",
        "| Level | Files |",
        "|---|---|",
        f"| Low (CC < 10) | {stats['complexity_distribution']['low']} |",
        f"| Medium (CC 10–24) | {stats['complexity_distribution']['medium']} |",
        f"| High (CC 25+) | {stats['complexity_distribution']['high']} |",
        "",
        "## Most complex files",
        "",
        "| File | Cyclomatic complexity |",
        "|---|---|",
    ]
    for item in stats["most_complex"]:
        lines.append(f"| `{item['file']}` | {item['complexity']} |")

    if stats.get("truncated"):
        lines += [
            "",
            f"> ⚠ Repository exceeds {stats['max_files']} files — this report covers "
            f"the first {stats['max_files']} files found during traversal.",
        ]

    lines += ["", "---", "_Generated by RepoLens_"]

    return JSONResponse(content={"markdown": "\n".join(lines)})


@app.get("/api/health")
def health():
    return {"status": "healthy", "cache_size": len(_summary_cache)}

# Mount static files at the end so it doesn't override API routes
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
