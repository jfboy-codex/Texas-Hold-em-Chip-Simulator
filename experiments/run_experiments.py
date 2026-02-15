from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from statistics import mean
from typing import Dict, List

from ce_rjssp import (
    ATCPolicy,
    CERSchedulingEnv,
    FIFOPolicy,
    G4DQNPolicy,
    LPTPolicy,
    MWKRPolicy,
    RandomPolicy,
    SPTPolicy,
    generate_instance,
)

try:
    import matplotlib.pyplot as plt  # type: ignore
except Exception:
    plt = None


def _save_bar_svg(labels: List[str], values: List[float], title: str, out_path: Path) -> None:
    w, h = 900, 420
    margin = 50
    max_v = max(values) if values else 1.0
    bar_w = (w - 2 * margin) / max(1, len(values)) * 0.7
    gap = (w - 2 * margin) / max(1, len(values)) * 0.3

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">']
    parts.append(f'<text x="{w//2}" y="25" text-anchor="middle" font-size="16">{title}</text>')
    parts.append(f'<line x1="{margin}" y1="{h-margin}" x2="{w-margin}" y2="{h-margin}" stroke="black"/>')
    parts.append(f'<line x1="{margin}" y1="{margin}" x2="{margin}" y2="{h-margin}" stroke="black"/>')

    x = margin + gap / 2
    for i, (lab, val) in enumerate(zip(labels, values)):
        bh = 0 if max_v == 0 else (val / max_v) * (h - 2 * margin)
        y = h - margin - bh
        parts.append(f'<rect x="{x}" y="{y}" width="{bar_w}" height="{bh}" fill="#4682B4"/>')
        parts.append(f'<text x="{x + bar_w/2}" y="{h-margin+16}" text-anchor="middle" font-size="10">{lab}</text>')
        parts.append(f'<text x="{x + bar_w/2}" y="{max(y-4,14)}" text-anchor="middle" font-size="9">{val:.1f}</text>')
        x += bar_w + gap
    parts.append('</svg>')
    out_path.write_text("\n".join(parts), encoding="utf-8")


def _save_line_svg(labels: List[str], values: List[float], title: str, out_path: Path) -> None:
    w, h = 900, 420
    margin = 50
    max_v = max(values) if values else 1.0
    min_v = min(values) if values else 0.0
    span = max(1e-9, max_v - min_v)
    step = (w - 2 * margin) / max(1, len(values) - 1)

    def y_of(v: float) -> float:
        return h - margin - ((v - min_v) / span) * (h - 2 * margin)

    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">']
    parts.append(f'<text x="{w//2}" y="25" text-anchor="middle" font-size="16">{title}</text>')
    parts.append(f'<line x1="{margin}" y1="{h-margin}" x2="{w-margin}" y2="{h-margin}" stroke="black"/>')
    parts.append(f'<line x1="{margin}" y1="{margin}" x2="{margin}" y2="{h-margin}" stroke="black"/>')

    points = []
    for i, v in enumerate(values):
        x = margin + i * step
        y = y_of(v)
        points.append((x, y))
    if points:
        poly = " ".join(f"{x},{y}" for x, y in points)
        parts.append(f'<polyline points="{poly}" fill="none" stroke="#d2691e" stroke-width="2"/>')
    for (x, y), lab, val in zip(points, labels, values):
        parts.append(f'<circle cx="{x}" cy="{y}" r="4" fill="#d2691e"/>')
        parts.append(f'<text x="{x}" y="{h-margin+16}" text-anchor="middle" font-size="10">{lab}</text>')
        parts.append(f'<text x="{x}" y="{max(y-6,14)}" text-anchor="middle" font-size="9">{val:.1f}</text>')
    parts.append('</svg>')
    out_path.write_text("\n".join(parts), encoding="utf-8")


def evaluate_policy(policy, instances):
    rows = []
    for inst in instances:
        env = CERSchedulingEnv(inst, seed=42)
        result = env.run_with_policy(policy)
        rows.append(asdict(result))
    agg = {
        "policy": policy.name,
        "makespan": mean(r["makespan"] for r in rows),
        "total_tardiness": mean(r["total_tardiness"] for r in rows),
        "total_energy": mean(r["total_energy"] for r in rows),
        "avg_wip": mean(r["avg_wip"] for r in rows),
        "objective": mean(r["objective"] for r in rows),
        "decision_count": mean(r["decision_count"] for r in rows),
    }
    return agg


def create_instances(n, jobs, machines, seed_offset=0, breakdown_override=None):
    out = []
    for i in range(n):
        breakdown = 0.05 if breakdown_override is None else breakdown_override
        out.append(
            generate_instance(
                num_jobs=jobs,
                num_machines=machines,
                reentry_prob=0.2 + 0.1 * (i % 4),
                hotspot_intensity=0.3 + 0.1 * (i % 3),
                setup_variance=0.5 + 0.2 * (i % 2),
                breakdown_freq=breakdown,
                due_tightness=0.9 + 0.2 * (i % 3),
                seed=seed_offset + i,
            )
        )
    return out


def plot_metrics(results: List[Dict], out_dir: Path):
    metrics = ["makespan", "total_tardiness", "total_energy", "avg_wip", "objective"]
    names = [r["policy"] for r in results]
    for m in metrics:
        vals = [r[m] for r in results]
        if plt is not None:
            plt.figure(figsize=(8, 4))
            plt.bar(names, vals, color="steelblue")
            plt.title(f"Policy Comparison: {m}")
            plt.xticks(rotation=30)
            plt.tight_layout()
            plt.savefig(out_dir / f"policy_{m}.png", dpi=150)
            plt.close()
        else:
            _save_bar_svg(names, vals, f"Policy Comparison: {m}", out_dir / f"policy_{m}.svg")


def run_ablation(instances, out_dir: Path):
    variants = {
        "full": G4DQNPolicy(),
        "job_like_action": G4DQNPolicy(use_candidate_set=False),
        "single_objective": G4DQNPolicy(use_multi_objective=False),
        "no_candidate_set": G4DQNPolicy(use_candidate_set=False),
        "no_imitation": G4DQNPolicy(warm_start=False),
    }
    ablation = []
    for label, policy in variants.items():
        r = evaluate_policy(policy, instances)
        r["policy"] = label
        ablation.append(r)

    with (out_dir / "ablation.json").open("w", encoding="utf-8") as f:
        json.dump(ablation, f, indent=2)

    labels = [r["policy"] for r in ablation]
    vals = [r["objective"] for r in ablation]
    if plt is not None:
        plt.figure(figsize=(8, 4))
        plt.bar(labels, vals, color="indianred")
        plt.title("Ablation: objective")
        plt.xticks(rotation=25)
        plt.tight_layout()
        plt.savefig(out_dir / "ablation_objective.png", dpi=150)
        plt.close()
    else:
        _save_bar_svg(labels, vals, "Ablation: objective", out_dir / "ablation_objective.svg")

    return ablation


def run_generalization(out_dir: Path):
    in_dist = create_instances(8, jobs=10, machines=10, seed_offset=100)
    cross_scale = create_instances(8, jobs=20, machines=15, seed_offset=300)
    ood = create_instances(8, jobs=10, machines=10, seed_offset=500, breakdown_override=0.16)

    policy = G4DQNPolicy()
    data = {
        "in_distribution": evaluate_policy(policy, in_dist),
        "cross_scale": evaluate_policy(policy, cross_scale),
        "ood_breakdown": evaluate_policy(policy, ood),
    }

    with (out_dir / "generalization.json").open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    labels = list(data.keys())
    vals = [data[k]["objective"] for k in labels]
    if plt is not None:
        plt.figure(figsize=(7, 4))
        plt.plot(labels, vals, marker="o")
        plt.title("Generalization Gap (objective)")
        plt.tight_layout()
        plt.savefig(out_dir / "generalization_gap.png", dpi=150)
        plt.close()
    else:
        _save_line_svg(labels, vals, "Generalization Gap (objective)", out_dir / "generalization_gap.svg")

    return data


def main():
    parser = argparse.ArgumentParser(description="CE-RJSSP experiment runner")
    parser.add_argument("--output", default="experiments/results", help="Result output directory")
    parser.add_argument("--num-instances", type=int, default=10)
    parser.add_argument("--jobs", type=int, default=10)
    parser.add_argument("--machines", type=int, default=10)
    args = parser.parse_args()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    instances = create_instances(args.num_instances, args.jobs, args.machines, seed_offset=10)
    policies = [
        FIFOPolicy(),
        SPTPolicy(),
        LPTPolicy(),
        MWKRPolicy(),
        ATCPolicy(),
        RandomPolicy(7),
        G4DQNPolicy(),
    ]

    results = [evaluate_policy(p, instances) for p in policies]
    with (out_dir / "policy_results.json").open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    plot_metrics(results, out_dir)
    ablation = run_ablation(instances, out_dir)
    generalization = run_generalization(out_dir)

    summary = {
        "policy_results": results,
        "ablation": ablation,
        "generalization": generalization,
    }
    with (out_dir / "summary.json").open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"Done. Artifacts saved to {out_dir}")


if __name__ == "__main__":
    main()
