#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
HB_ROOT = Path("/home/sakasegawa/src/github.com/nyosegawa/harness-debug-benchmark")
EXP_DIR = HB_ROOT / "benchmark/experiments/harnessbench-v2-official-2026-05-04c"
MANIFEST = EXP_DIR / "manifest.json"
SUMMARY = EXP_DIR / "summary.json"
EXPERIMENT_ID = EXP_DIR.name
ARTIFACT_BASE_URL = f"https://github.com/nyosegawa/harness-bench/tree/main/benchmark/experiments/{EXPERIMENT_ID}"
ARTIFACT_RAW_BASE_URL = f"https://raw.githubusercontent.com/nyosegawa/harness-bench/main/benchmark/experiments/{EXPERIMENT_ID}"

IMG_DIR = ROOT / "img/harness-bench"
EN_IMG_DIR = ROOT / "img/en/harness-bench"
PAGE_DIR = ROOT / "harness-bench"
JA_PAGE_DIR = ROOT / "ja/harness-bench"

BLUE = "#0f6be8"
BLUE_2 = "#2f80ed"
INK = "#13213b"
MUTED = "#5f6f89"
GRID = "#dbe5f4"
PAPER = "#f6f9ff"
GREEN = "#18a058"
ORANGE = "#f59e0b"
RED = "#d64545"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    project_font = ROOT / "scripts/fonts" / ("MPLUSRounded1c-Bold.ttf" if bold else "MPLUSRounded1c-Regular.ttf")
    if project_font.exists():
        return ImageFont.truetype(project_font, size)

    candidates = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
        "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
        "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def parse_simple_yaml(path: Path) -> dict:
    data: dict[str, object] = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith(" ") or line.startswith("-") or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip().strip('"')
        if value.startswith("[") and value.endswith("]"):
            value = [x.strip() for x in value[1:-1].split(",") if x.strip()]
        data[key.strip()] = value
    return data


def condition_label(condition_id: str) -> str:
    parts = condition_id.split(":")
    harness = parts[0]
    if harness == "cursor":
        model = parts[1]
        if model == "composer-2-fast":
            return "Cursor / Composer 2 / fast"
        if model == "composer-2":
            return "Cursor / Composer 2 / normal"
        if model.startswith("gpt-5.5-"):
            return f"Cursor / gpt-5.5 / {model.removeprefix('gpt-5.5-').replace('extra-high', 'xhigh')}"
        if model.startswith("claude-opus-4-7-"):
            return f"Cursor / claude-opus-4-7 / {model.removeprefix('claude-opus-4-7-').replace('extra-high', 'xhigh')}"
        effort = parts[2] if len(parts) > 3 else "default"
        return f"Cursor / {model} / {effort.replace('extra-high', 'xhigh')}"
    if harness == "codex":
        return f"Codex / {parts[1]} / {parts[2]}"
    if harness == "claude":
        return f"Claude Code / {parts[1]} / {parts[2]}"
    return condition_id


def condition_short(condition_id: str) -> str:
    return condition_label(condition_id).replace("Claude Code", "Claude").replace("claude-opus-4-7", "Opus 4.7")


def harness_name(condition_id: str) -> str:
    h = condition_id.split(":")[0]
    return {"codex": "Codex", "claude": "Claude Code", "cursor": "Cursor"}.get(h, h)


def local_artifact_path(value: str) -> Path:
    return Path(value.replace("<repo>", str(HB_ROOT)).replace("<home>", str(Path.home())))


def load_data() -> dict:
    manifest = json.loads(MANIFEST.read_text())
    summary = json.loads(SUMMARY.read_text())

    cases: dict[str, dict] = {}
    runs = []
    for r in manifest["runs"]:
        if r.get("kind") != "agent" or r.get("invalid_run"):
            continue
        result = json.loads(local_artifact_path(r["result_path"]).read_text())
        case_path = local_artifact_path(r["case_path"])
        if r["case_id"] not in cases:
            y = parse_simple_yaml(case_path)
            cases[r["case_id"]] = {
                "id": r["case_id"],
                "repo": y.get("repo", ""),
                "difficulty": y.get("difficulty", ""),
                "size_bucket": y.get("size_bucket", ""),
                "instruction": y.get("instruction", ""),
                "selection_notes": y.get("selection_notes", ""),
                "pr_url": y.get("pr_url", ""),
            }
        usage = result.get("metrics", {}).get("usage", {})
        runs.append({
            "case_id": r["case_id"],
            "condition_id": r["condition_id"],
            "success": bool(result.get("success")),
            "wall_time_ms": result.get("metrics", {}).get("wall_time_ms"),
            "harness": r.get("harness"),
            "model": r.get("model"),
            "effort": r.get("effort"),
            "difficulty": cases[r["case_id"]]["difficulty"],
            "size_bucket": cases[r["case_id"]]["size_bucket"],
            "total_tokens": usage.get("effective_total_tokens") or usage.get("total_tokens"),
            "cost_usd": usage.get("cost_usd"),
        })

    conditions = []
    for cid, v in summary["conditions"].items():
        rs = [x for x in runs if x["condition_id"] == cid]
        by_diff = {}
        for d in ["low", "mid", "high"]:
            drs = [x for x in rs if x["difficulty"] == d]
            by_diff[d] = {
                "runs": len(drs),
                "passed": sum(1 for x in drs if x["success"]),
                "pass_rate": (sum(1 for x in drs if x["success"]) / len(drs)) if drs else 0,
            }
        condition_cost = v.get("cost_usd")
        conditions.append({
            "id": cid,
            "label": condition_label(cid),
            "short_label": condition_short(cid),
            "harness": harness_name(cid),
            "runs": v["runs"],
            "passed": v["passed"],
            "failed": v["runs"] - v["passed"],
            "pass_rate": v["pass_rate"],
            "median_wall_time_ms": v["median_wall_time_ms"],
            "median_wall_time_min": v["median_wall_time_ms"] / 60000,
            "cost_usd": condition_cost,
            "cost_per_pass": (condition_cost / v["passed"]) if isinstance(condition_cost, (int, float)) and v["passed"] else None,
            "timeouts": v["timeouts"],
            "by_difficulty": by_diff,
        })
    conditions.sort(key=lambda c: (-c["passed"], c["median_wall_time_ms"]))

    case_rows = []
    for cid, c in sorted(cases.items(), key=lambda kv: (kv[1]["repo"], kv[1]["difficulty"])):
        rs = [x for x in runs if x["case_id"] == cid]
        case_rows.append({
            **c,
            "passed": sum(1 for x in rs if x["success"]),
            "runs": len(rs),
            "pass_rate": sum(1 for x in rs if x["success"]) / len(rs),
        })

    return {
        "experiment_id": summary["experiment_id"],
        "finished_at": summary["finished_at"],
        "totals": {
            "conditions": len(conditions),
            "cases": len(cases),
            "runs": summary["agent_runs"],
            "passed": summary["passed"],
            "failed": summary["failed"],
            "pass_rate": summary["passed"] / summary["agent_runs"],
            "timeouts": summary["timeouts"],
            "invalid_attempts": summary["invalid_attempts"],
        },
        "conditions": conditions,
        "cases": case_rows,
        "statistics": {
            "success_rate": "No pairwise success-rate comparison was significant at p < 0.05 in 27 paired tasks.",
            "wall_time": "Wall time differences were statistically visible; Cursor Composer 2 fast and Cursor GPT-5.5 medium were the fastest median conditions.",
            "sample_size_note": "Detecting a 10-point success-rate gap reliably needs roughly 160-315 paired tasks before multiple-comparison correction.",
        },
    }


def rounded(draw: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def save_bar_chart(path: Path, title: str, rows: list[tuple[str, float, str]], suffix: str, max_value: float | None = None):
    w, h = 1600, max(820, 160 + len(rows) * 56)
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    rounded(d, (30, 30, w - 30, h - 30), 30, PAPER)
    d.text((70, 62), title, fill=INK, font=font(44, True))
    x0, x1 = 560, w - 180
    y = 150
    max_v = max_value or max(v for _, v, _ in rows)
    for label, value, color in rows:
        d.text((70, y - 2), label, fill=INK, font=font(24, True))
        bar_w = int((x1 - x0) * (value / max_v))
        rounded(d, (x0, y, x1, y + 32), 16, "#e6eefb")
        rounded(d, (x0, y, x0 + bar_w, y + 32), 16, color)
        d.text((x1 + 24, y - 1), f"{value:.1f}{suffix}", fill=INK, font=font(24, True))
        y += 56
    img.save(path, quality=92)


def save_difficulty_chart(path: Path, data: dict, title: str = "Difficulty別の成功率"):
    rows = data["conditions"]
    w, h = 1600, max(1060, 190 + len(rows) * 64)
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    rounded(d, (30, 30, w - 30, h - 30), 30, PAPER)
    d.text((70, 62), title, fill=INK, font=font(44, True))
    colors = {"low": GREEN, "mid": ORANGE, "high": RED}
    x0, x1 = 560, w - 180
    y = 160
    for c in rows:
        d.text((70, y - 2), c["short_label"], fill=INK, font=font(23, True))
        seg_x = x0
        for diff in ["low", "mid", "high"]:
            value = c["by_difficulty"][diff]["pass_rate"]
            seg_w = int((x1 - x0) / 3)
            rounded(d, (seg_x, y, seg_x + seg_w - 8, y + 32), 15, "#e6eefb")
            fill_w = int((seg_w - 8) * value)
            rounded(d, (seg_x, y, seg_x + fill_w, y + 32), 15, colors[diff])
            d.text((seg_x + 12, y + 2), f"{diff} {value*100:.0f}%", fill=INK, font=font(18, True))
            seg_x += seg_w
        y += 64
    img.save(path, quality=92)


def save_frontier_chart(path: Path, data: dict, subtitle: str = "右上ほど成功率が高く、左ほど速いです"):
    rows = data["conditions"]
    w, h = 1600, 960
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    rounded(d, (30, 30, w - 30, h - 30), 30, PAPER)
    d.text((70, 62), "Pass Rate × Median Wall Time", fill=INK, font=font(44, True))
    d.text((72, 120), subtitle, fill=MUTED, font=font(24))

    plot = (170, 210, w - 110, h - 150)
    x0, y0, x1, y1 = plot
    d.line((x0, y1, x1, y1), fill=GRID, width=3)
    d.line((x0, y0, x0, y1), fill=GRID, width=3)
    for pct in [60, 70, 80]:
        yy = y1 - int((pct - 55) / 30 * (y1 - y0))
        d.line((x0, yy, x1, yy), fill="#e8eff9", width=1)
        d.text((80, yy - 14), f"{pct}%", fill=MUTED, font=font(20))
    for minute in [5, 10, 15, 20]:
        xx = x0 + int((minute - 3) / 18 * (x1 - x0))
        d.line((xx, y0, xx, y1), fill="#e8eff9", width=1)
        d.text((xx - 18, y1 + 18), f"{minute}m", fill=MUTED, font=font(20))

    colors = {"Codex": BLUE, "Claude Code": GREEN, "Cursor": ORANGE}
    callouts = {
        "codex:gpt-5.5:xhigh:baseline",
        "cursor:composer-2-fast:baseline",
    }
    for c in rows:
        x = x0 + int((c["median_wall_time_min"] - 3) / 18 * (x1 - x0))
        y = y1 - int(((c["pass_rate"] * 100) - 55) / 30 * (y1 - y0))
        d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=colors[c["harness"]], outline="white", width=3)
        if c["id"] in callouts:
            d.text((x + 16, y - 12), c["short_label"], fill=INK, font=font(19, True))

    d.text((x0, h - 92), "Median wall time", fill=MUTED, font=font(22))
    d.text((58, y0 - 38), "Pass rate", fill=MUTED, font=font(22))
    legend_x = w - 520
    for i, hname in enumerate(["Codex", "Claude Code", "Cursor"]):
        lx = legend_x + i * 165
        d.ellipse((lx, 132, lx + 20, 152), fill=colors[hname])
        d.text((lx + 28, 127), hname, fill=INK, font=font(20, True))
    img.save(path, quality=92)


def write_page(data: dict):
    js = json.dumps(data, ensure_ascii=False)
    conditions = data["conditions"]
    top = conditions[0]
    body = f"""---
layout: layouts/base.vto
title: HarnessBench
description: "HarnessBench is a benchmark for comparing Codex, Claude Code, and Cursor Agent on real-repository debugging tasks."
bodyClass: body-harness-bench
image: /og/en/harness-bench-results.jpg
lang: en
extra_head:
  - '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
---

<style>
.hb-wrap {{ max-width: 1180px; margin: 0 auto; padding: 32px 18px 80px; }}
.hb-hero {{ margin: 20px 0 18px; }}
.hb-eyebrow {{ color: #0f6be8; font-weight: 800; letter-spacing: 0; margin: 0 0 10px; }}
.hb-title {{ font-size: clamp(1.75rem, 3.2vw, 3rem); line-height: 1.15; margin: 0; letter-spacing: 0; color: #13213b; max-width: 1080px; }}
.hb-lead {{ color: #4c5d75; font-size: 1rem; line-height: 1.72; max-width: 900px; }}
.hb-actions {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }}
.hb-action {{ display:inline-flex; align-items:center; border:1px solid #b9cff0; border-radius:999px; padding:8px 13px; color:#0f6be8; text-decoration:none; background:Canvas; }}
.hb-panel {{ background: color-mix(in oklab, Canvas 94%, #eaf2ff); border: 1px solid color-mix(in oklab, CanvasText 12%, transparent); border-radius: 8px; padding: 18px; }}
.hb-experiment-panel {{ margin: 0 0 22px; }}
.hb-statgrid {{ display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }}
.hb-stat {{ border: 1px solid color-mix(in oklab, CanvasText 12%, transparent); border-radius: 8px; padding: 14px; background: Canvas; }}
.hb-stat b {{ display:block; font-size: 1.55rem; color: #0f6be8; }}
.hb-stat span {{ color:#697891; font-size:.9rem; }}
.hb-grid {{ display:grid; grid-template-columns: 1fr; gap: 18px; margin: 18px 0; }}
.hb-chart-card {{ background: Canvas; border: 1px solid color-mix(in oklab, CanvasText 12%, transparent); border-radius: 8px; padding: 18px; min-height: 390px; }}
.hb-chart-card h2, .hb-section h2 {{ margin: 0 0 12px; color:#13213b; font-size: 1.25rem; }}
.hb-chart-card canvas {{ width: 100% !important; height: 320px !important; }}
.hb-controls {{ display:flex; flex-wrap:wrap; gap: 8px; margin: 8px 0 18px; }}
.hb-controls button {{ border: 1px solid #b9cff0; background: Canvas; color:#13213b; border-radius: 999px; padding: 7px 12px; cursor: pointer; }}
.hb-controls button[aria-pressed="true"] {{ background:#0f6be8; color:white; border-color:#0f6be8; }}
.hb-table-wrap {{ overflow-x:auto; border: 1px solid color-mix(in oklab, CanvasText 12%, transparent); border-radius:8px; background:Canvas; }}
.hb-table {{ width:100%; border-collapse: collapse; min-width: 900px; }}
.hb-table th, .hb-table td {{ padding: 10px 12px; border-bottom: 1px solid color-mix(in oklab, CanvasText 10%, transparent); text-align:left; white-space: nowrap; }}
.hb-table th {{ color:#53647c; font-size:.86rem; }}
.hb-note {{ color:#5f6f89; line-height:1.75; }}
.hb-artifacts {{ display:flex; flex-wrap:wrap; gap:10px; margin:12px 0 0; }}
.hb-artifacts a {{ display:inline-flex; align-items:center; border:1px solid #b9cff0; border-radius:999px; padding:7px 11px; color:#0f6be8; text-decoration:none; background:Canvas; }}
.hb-pill {{ display:inline-flex; border-radius:999px; padding:3px 8px; background:#e9f2ff; color:#0f6be8; font-size:.82rem; }}
@media (max-width: 860px) {{ .hb-grid {{ grid-template-columns: 1fr; }} .hb-statgrid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
</style>

<div class="hb-wrap">
  <section class="hb-hero">
    <p class="hb-eyebrow">Benchmark</p>
    <h1 class="hb-title">Harness Bench</h1>
    <p class="hb-lead">HarnessBench compares Codex, Claude Code, and Cursor Agent on the same 27 real-repository debugging issues. The primary score is deterministic hidden-test pass/fail, with wall time, token usage, cost estimates, and auxiliary failure reviews retained for analysis.</p>
    <div class="hb-actions">
      <a class="hb-action" href="https://github.com/nyosegawa/harness-bench">GitHub repository</a>
      <a class="hb-action" href="{ARTIFACT_BASE_URL}">Official artifacts</a>
      <a class="hb-action" href="/posts/harness-bench/">Blog post</a>
    </div>
  </section>

  <aside class="hb-panel hb-experiment-panel">
    <p class="hb-note">Latest official experiment<br><span class="hb-pill">{data["experiment_id"]}</span></p>
    <p class="hb-note">Top observed condition: {top["label"]}<br>{top["passed"]}/{top["runs"]} passed ({top["pass_rate"]*100:.1f}%). Success-rate differences were not statistically significant at n=27.</p>
  </aside>

  <section class="hb-statgrid">
    <div class="hb-stat"><b>{data["totals"]["cases"]}</b><span>debugging tasks</span></div>
    <div class="hb-stat"><b>{data["totals"]["conditions"]}</b><span>harness/model/effort conditions</span></div>
    <div class="hb-stat"><b>{data["totals"]["runs"]}</b><span>official agent runs</span></div>
    <div class="hb-stat"><b>{data["totals"]["pass_rate"]*100:.1f}%</b><span>overall hidden-test pass rate</span></div>
  </section>

  <section class="hb-grid">
    <div class="hb-chart-card">
      <h2>Pass Rate by Harness × Model × Effort</h2>
      <canvas id="passChart"></canvas>
    </div>
    <div class="hb-chart-card">
      <h2>Median Wall Time</h2>
      <canvas id="timeChart"></canvas>
    </div>
    <div class="hb-chart-card">
      <h2>Success by Difficulty</h2>
      <canvas id="difficultyChart"></canvas>
    </div>
    <div class="hb-chart-card">
      <h2>Pass Rate vs Time</h2>
      <canvas id="frontierChart"></canvas>
    </div>
  </section>

  <section class="hb-section">
    <h2>Condition Table</h2>
    <div class="hb-controls" id="harnessFilters" aria-label="Harness filter"></div>
    <div class="hb-table-wrap">
      <table class="hb-table" id="conditionTable">
        <thead><tr><th>Harness × Model × Effort</th><th>Harness</th><th>Pass</th><th>Pass rate</th><th>Median time</th><th>Cost/pass</th><th>Timeouts</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="hb-section">
    <h2>Interpretation and Artifacts</h2>
    <p class="hb-note">The strongest observed pass rate was Codex / GPT-5.5 / xhigh at 22/27. However, with only 27 paired tasks, no pairwise success-rate gap reached p &lt; 0.05. Runtime differences were clearer: Cursor Composer 2 fast and Cursor GPT-5.5 medium were substantially faster, while higher Opus effort settings traded latency for more deliberation without a statistically reliable success gain in this run.</p>
    <p class="hb-note">Cost should be read carefully. Claude Code reports dollar cost directly, Codex and some Cursor GPT-5.5 runs use API-equivalent rate-card estimates, and Cursor Opus/Composer conditions may not expose comparable cost data.</p>
    <p class="hb-note">The public repository contains the benchmark specification, cases, hidden tests, runner, report generator, and summary artifacts. Raw harness execution logs are not currently published on this website; they are retained locally under the experiment artifact policy because they can be large and may contain provider-specific session details.</p>
    <div class="hb-artifacts" aria-label="Official experiment artifacts">
      <a href="{ARTIFACT_BASE_URL}">artifact directory</a>
      <a href="{ARTIFACT_RAW_BASE_URL}/summary.json">summary.json</a>
      <a href="{ARTIFACT_RAW_BASE_URL}/manifest.json">manifest.json</a>
      <a href="{ARTIFACT_RAW_BASE_URL}/failure-reviews.json">failure-reviews.json</a>
      <a href="https://htmlpreview.github.io/?{ARTIFACT_RAW_BASE_URL}/results.html">full results.html</a>
    </div>
  </section>

  <section class="hb-section">
    <h2>Case Set</h2>
    <div class="hb-table-wrap">
      <table class="hb-table">
        <thead><tr><th>Case</th><th>Repo</th><th>Difficulty</th><th>Size</th><th>Pass</th><th>PR</th></tr></thead>
        <tbody>
          {"".join(f'<tr><td>{c["id"]}</td><td>{c["repo"]}</td><td>{c["difficulty"]}</td><td>{c["size_bucket"]}</td><td>{c["passed"]}/{c["runs"]}</td><td><a href="{c["pr_url"]}">PR</a></td></tr>' for c in data["cases"])}
        </tbody>
      </table>
    </div>
  </section>
</div>

<script type="application/json" id="hb-data">{js}</script>
<script>
const HB = JSON.parse(document.getElementById("hb-data").textContent);
const colors = {{ "Codex": "#0f6be8", "Claude Code": "#18a058", "Cursor": "#f59e0b" }};
let activeHarnesses = new Set(["Codex", "Claude Code", "Cursor"]);
const fmtPct = v => (v * 100).toFixed(1) + "%";
const fmtMin = ms => (ms / 60000).toFixed(1) + "m";
const filtered = () => HB.conditions.filter(c => activeHarnesses.has(c.harness));

function labels(rows) {{ return rows.map(c => c.short_label); }}
function colorRows(rows) {{ return rows.map(c => colors[c.harness] || "#999"); }}

function buildCharts() {{
  const rows = filtered();
  passChart.data.labels = labels(rows);
  passChart.data.datasets[0].data = rows.map(c => c.pass_rate * 100);
  passChart.data.datasets[0].backgroundColor = colorRows(rows);
  timeChart.data.labels = labels(rows);
  timeChart.data.datasets[0].data = rows.map(c => c.median_wall_time_min);
  timeChart.data.datasets[0].backgroundColor = colorRows(rows);
  difficultyChart.data.labels = labels(rows);
  ["low","mid","high"].forEach((d, i) => difficultyChart.data.datasets[i].data = rows.map(c => c.by_difficulty[d].pass_rate * 100));
  frontierChart.data.datasets = ["Codex","Claude Code","Cursor"].map(h => ({{
    label: h,
    data: rows.filter(c => c.harness === h).map(c => ({{ x: c.median_wall_time_min, y: c.pass_rate * 100, label: c.short_label }})),
    backgroundColor: colors[h],
  }}));
  [passChart, timeChart, difficultyChart, frontierChart].forEach(c => c.update());
  renderTable();
}}

const common = {{ responsive:true, maintainAspectRatio:false, plugins:{{ legend:{{ display:false }}, tooltip:{{ callbacks:{{ label: ctx => ctx.raw?.label || (ctx.parsed.x ? `${{ctx.dataset.label}}: ${{ctx.parsed.y.toFixed(1)}}%, ${{ctx.parsed.x.toFixed(1)}}m` : `${{ctx.parsed.x ?? ctx.parsed.y}}`) }} }} }} }};
const passChart = new Chart(document.getElementById("passChart"), {{ type:"bar", data:{{ labels:[], datasets:[{{ data:[], borderRadius:8 }}] }}, options:{{ ...common, indexAxis:"y", scales:{{ x:{{ max:100, ticks:{{ callback:v=>v+"%" }} }} }} }} }});
const timeChart = new Chart(document.getElementById("timeChart"), {{ type:"bar", data:{{ labels:[], datasets:[{{ data:[], borderRadius:8 }}] }}, options:{{ ...common, indexAxis:"y", scales:{{ x:{{ ticks:{{ callback:v=>v+"m" }} }} }} }} }});
const difficultyChart = new Chart(document.getElementById("difficultyChart"), {{ type:"bar", data:{{ labels:[], datasets:[{{ label:"low", data:[], backgroundColor:"#18a058" }}, {{ label:"mid", data:[], backgroundColor:"#f59e0b" }}, {{ label:"high", data:[], backgroundColor:"#d64545" }}] }}, options:{{ responsive:true, maintainAspectRatio:false, plugins:{{ legend:{{ position:"bottom" }} }}, scales:{{ x:{{ stacked:false }}, y:{{ max:100, ticks:{{ callback:v=>v+"%" }} }} }} }} }});
const frontierChart = new Chart(document.getElementById("frontierChart"), {{ type:"scatter", data:{{ datasets:[] }}, options:{{ responsive:true, maintainAspectRatio:false, plugins:{{ legend:{{ position:"bottom" }}, tooltip:{{ callbacks:{{ label:ctx=>`${{ctx.raw.label}}: ${{ctx.raw.y.toFixed(1)}}%, ${{ctx.raw.x.toFixed(1)}}m` }} }} }}, scales:{{ x:{{ title:{{ display:true, text:"Median wall time (min)" }} }}, y:{{ min:55, max:85, title:{{ display:true, text:"Pass rate (%)" }} }} }} }} }});

function renderFilters() {{
  const el = document.getElementById("harnessFilters");
  for (const h of ["Codex","Claude Code","Cursor"]) {{
    const b = document.createElement("button");
    b.textContent = h;
    b.setAttribute("aria-pressed", "true");
    b.onclick = () => {{
      if (activeHarnesses.has(h) && activeHarnesses.size > 1) activeHarnesses.delete(h); else activeHarnesses.add(h);
      b.setAttribute("aria-pressed", activeHarnesses.has(h) ? "true" : "false");
      buildCharts();
    }};
    el.appendChild(b);
  }}
}}
function renderTable() {{
  const tbody = document.querySelector("#conditionTable tbody");
  tbody.innerHTML = "";
  for (const c of filtered()) {{
    const tr = document.createElement("tr");
    const cost = c.cost_per_pass == null ? "n/a" : "$" + c.cost_per_pass.toFixed(2);
    tr.innerHTML = `<td>${{c.label}}</td><td>${{c.harness}}</td><td>${{c.passed}}/${{c.runs}}</td><td>${{fmtPct(c.pass_rate)}}</td><td>${{fmtMin(c.median_wall_time_ms)}}</td><td>${{cost}}</td><td>${{c.timeouts}}</td>`;
    tbody.appendChild(tr);
  }}
}}
renderFilters();
buildCharts();
</script>
"""
    PAGE_DIR.mkdir(parents=True, exist_ok=True)
    (PAGE_DIR / "index.vto").write_text(body)
    ja_body = body
    replacements = {
        "lang: en": "lang: ja",
        "image: /og/en/harness-bench-results.jpg": "image: /og/harness-bench-results.jpg",
        'description: "HarnessBench is a benchmark for comparing Codex, Claude Code, and Cursor Agent on real-repository debugging tasks."': 'description: "HarnessBenchは、Codex、Claude Code、Cursor Agentを実リポジトリのデバッグ課題で比較するベンチマークです。"',
        "Harness Bench": "Harness Bench",
        "HarnessBench compares Codex, Claude Code, and Cursor Agent on the same 27 real-repository debugging issues. The primary score is deterministic hidden-test pass/fail, with wall time, token usage, cost estimates, and auxiliary failure reviews retained for analysis.": "HarnessBenchは、Codex、Claude Code、Cursor Agentを同じ27個の実リポジトリ由来デバッグ課題で比較します。主指標はhidden testによる決定論的なpass/failで、wall time、token、cost estimate、補助的なfailure reviewも分析用に残します。",
        "GitHub repository": "GitHub repository",
        "Official artifacts": "公式artifact",
        "Blog post": "ブログ記事",
        "Latest official experiment": "最新の公式実験",
        "Top observed condition:": "観測上のトップ条件:",
        "passed": "passed",
        "Success-rate differences were not statistically significant at n=27.": "n=27では成功率差に統計的有意差は出ていません。",
        "debugging tasks": "debugging tasks",
        "harness/model/effort conditions": "harness/model/effort conditions",
        "official agent runs": "official agent runs",
        "overall hidden-test pass rate": "overall hidden-test pass rate",
        "Pass Rate by Harness × Model × Effort": "Harness × Model × Effort 別 Pass Rate",
        "Median Wall Time": "Median Wall Time",
        "Success by Difficulty": "Difficulty別の成功率",
        "Pass Rate vs Time": "Pass Rate vs Time",
        "Condition Table": "条件一覧",
        "Harness filter": "Harness filter",
        "Pass rate": "Pass rate",
        "Median time": "Median time",
        "Cost/pass": "Cost/pass",
        "Timeouts": "Timeouts",
        "Interpretation and Artifacts": "解釈とartifact",
        "The strongest observed pass rate was Codex / GPT-5.5 / xhigh at 22/27. However, with only 27 paired tasks, no pairwise success-rate gap reached p &lt; 0.05. Runtime differences were clearer: Cursor Composer 2 fast and Cursor GPT-5.5 medium were substantially faster, while higher Opus effort settings traded latency for more deliberation without a statistically reliable success gain in this run.": "観測上もっとも高いpass rateは Codex / GPT-5.5 / xhigh の22/27でした。ただし27個のpaired taskでは、どの成功率差も p &lt; 0.05 に達していません。一方で実行時間の差はより明確で、Cursor Composer 2 fast と Cursor GPT-5.5 medium はかなり高速でした。高いOpus effortは長く考えますが、このrunでは成功率の統計的に確かな上積みとしては観測できませんでした。",
        "Cost should be read carefully. Claude Code reports dollar cost directly, Codex and some Cursor GPT-5.5 runs use API-equivalent rate-card estimates, and Cursor Opus/Composer conditions may not expose comparable cost data.": "Costは注意して読む必要があります。Claude Codeはdollar costを直接報告しますが、Codexと一部のCursor GPT-5.5 runはAPI-equivalent rate-card estimateです。Cursor Opus/Composer条件では比較可能なcost dataが出ない場合があります。",
        "The public repository contains the benchmark specification, cases, hidden tests, runner, report generator, and summary artifacts. Raw harness execution logs are not currently published on this website; they are retained locally under the experiment artifact policy because they can be large and may contain provider-specific session details.": "公開リポジトリにはbenchmark specification、case、hidden test、runner、report generator、summary artifactを含めます。raw harness execution logは現時点ではこのサイトでは公開していません。容量が大きく、provider固有のsession detailを含みうるため、experiment artifact policyに従ってローカル保持しています。",
        "artifact directory": "artifact directory",
        "full results.html": "full results.html",
        "Case Set": "Case Set",
    }
    for src, dst in replacements.items():
        ja_body = ja_body.replace(src, dst)
    ja_body = ja_body.replace('href="/posts/harness-bench/"', 'href="/posts/harness-bench/"')
    JA_PAGE_DIR.mkdir(parents=True, exist_ok=True)
    (JA_PAGE_DIR / "index.vto").write_text(ja_body)


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    EN_IMG_DIR.mkdir(parents=True, exist_ok=True)
    data = load_data()

    pass_rows = [(c["short_label"], c["pass_rate"] * 100, {"Codex": BLUE, "Claude Code": GREEN, "Cursor": ORANGE}[c["harness"]]) for c in data["conditions"]]
    time_rows = sorted([(c["short_label"], c["median_wall_time_min"], {"Codex": BLUE, "Claude Code": GREEN, "Cursor": ORANGE}[c["harness"]]) for c in data["conditions"]], key=lambda x: x[1])
    save_bar_chart(IMG_DIR / "pass-rate.png", "Harness × Model × Effort 別 Pass Rate", pass_rows, "%", 100)
    save_bar_chart(IMG_DIR / "wall-time.png", "Median Wall Time", time_rows, "m")
    save_difficulty_chart(IMG_DIR / "difficulty.png", data)
    # matrix-design.png is a curated image-generation asset, not a deterministic chart.
    # Do not overwrite it when refreshing benchmark charts.
    save_frontier_chart(IMG_DIR / "pass-time-frontier.png", data)

    save_bar_chart(EN_IMG_DIR / "pass-rate.png", "Pass Rate by Harness × Model × Effort", pass_rows, "%", 100)
    save_bar_chart(EN_IMG_DIR / "wall-time.png", "Median Wall Time", time_rows, "m")
    save_difficulty_chart(EN_IMG_DIR / "difficulty.png", data, "Success Rate by Difficulty")
    # matrix-design.png is generated separately because it contains diagram text.
    save_frontier_chart(EN_IMG_DIR / "pass-time-frontier.png", data, "Higher is better; further left is faster")
    write_page(data)


if __name__ == "__main__":
    main()
