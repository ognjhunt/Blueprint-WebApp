from __future__ import annotations

import argparse
import json
from pathlib import Path

from graphify.analyze import god_nodes, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.detect import detect
from graphify.export import to_html, to_json
from graphify.extract import extract
from graphify.report import generate


def normalize_code_files(root: Path, detection: dict) -> list[Path]:
    code_entries = detection.get("files", {}).get("code", [])
    files: list[Path] = []

    for entry in code_entries:
        path = Path(entry)
        if not path.is_absolute():
          path = root / path
        files.append(path)

    return files


def community_labels(communities: dict[int, list[str]], graph) -> dict[int, str]:
    labels: dict[int, str] = {}

    for community_id, nodes in communities.items():
        source_counts: dict[str, int] = {}
        for node_id in nodes:
            source = str(graph.nodes[node_id].get("source_file") or "").strip()
            if not source:
                continue
            stem = Path(source).stem
            if not stem:
                continue
            source_counts[stem] = source_counts.get(stem, 0) + 1

        if source_counts:
            ranked = sorted(source_counts.items(), key=lambda item: (-item[1], item[0]))
            labels[community_id] = f"{ranked[0][0]} cluster"
        else:
            labels[community_id] = f"Community {community_id}"

    return labels


def write_metadata(output_dir: Path, detection: dict, extraction: dict, communities: dict[int, list[str]]) -> None:
    payload = {
        "runner": "run-staged-ast-pilot.py",
        "semantic_extraction_included": False,
        "notes": [
            "This pilot uses graphify's deterministic AST extraction path for staged code files.",
            "Staged docs are part of corpus detection and review scope but are not semantically extracted by this runner.",
            "Use the resulting report as a first-pass structural audit, not a complete multimodal graph.",
        ],
        "detection": {
            "total_files": detection.get("total_files", 0),
            "total_words": detection.get("total_words", 0),
            "code_files": len(detection.get("files", {}).get("code", [])),
            "document_files": len(detection.get("files", {}).get("document", [])),
            "paper_files": len(detection.get("files", {}).get("paper", [])),
            "image_files": len(detection.get("files", {}).get("image", [])),
        },
        "extraction": {
            "nodes": len(extraction.get("nodes", [])),
            "edges": len(extraction.get("edges", [])),
            "input_tokens": extraction.get("input_tokens", 0),
            "output_tokens": extraction.get("output_tokens", 0),
        },
        "communities": {
            "count": len(communities),
        },
    }

    (output_dir / "PILOT_METADATA.json").write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the staged Blueprint graphify AST pilot.")
    parser.add_argument("--corpus-dir", required=True, help="Path to the staged corpus directory")
    parser.add_argument("--output-dir", required=True, help="Path to the graph output directory")
    parser.add_argument("--no-viz", action="store_true", help="Skip HTML output")
    args = parser.parse_args()

    corpus_dir = Path(args.corpus_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    detection = detect(corpus_dir)
    code_files = normalize_code_files(corpus_dir, detection)

    if not code_files:
        raise SystemExit("No code files found in staged corpus; AST pilot cannot proceed.")

    extraction = extract(code_files)
    graph = build_from_json(extraction)

    if graph.number_of_nodes() == 0:
        raise SystemExit("Graph extraction produced zero nodes; aborting.")

    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    labels = community_labels(communities, graph)
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    suggested_questions: list[dict] = []
    token_cost = {
        "input": extraction.get("input_tokens", 0),
        "output": extraction.get("output_tokens", 0),
    }

    report = generate(
        graph,
        communities,
        cohesion,
        labels,
        gods,
        surprises,
        detection,
        token_cost,
        str(corpus_dir),
        suggested_questions=suggested_questions,
    )

    (output_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    to_json(graph, communities, str(output_dir / "graph.json"))
    if not args.no_viz:
        to_html(graph, communities, str(output_dir / "graph.html"), community_labels=labels)

    write_metadata(output_dir, detection, extraction, communities)

    print(
        json.dumps(
            {
                "status": "ok",
                "output_dir": str(output_dir),
                "total_files": detection.get("total_files", 0),
                "total_words": detection.get("total_words", 0),
                "code_files": len(detection.get("files", {}).get("code", [])),
                "document_files": len(detection.get("files", {}).get("document", [])),
                "nodes": graph.number_of_nodes(),
                "edges": graph.number_of_edges(),
                "communities": len(communities),
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
