"""
Generate pre-computed inference traces for GPT-2 small.
Output: series/study-llm/gpt-2/data/<slug>.json (one file per prompt) + index.json

Run: python3 scripts/gen-gpt2-traces.py
"""

import json
import math
import os
import re
from pathlib import Path

import torch
import torch.nn.functional as F
from transformers import GPT2LMHeadModel, GPT2Tokenizer

OUT_DIR = Path(__file__).resolve().parent.parent / "series" / "study-llm" / "gpt-2" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = [
    {"slug": "capital",   "label": "The capital of France is", "text": "The capital of France is"},
    {"slug": "once-upon", "label": "Once upon a time,",         "text": "Once upon a time,"},
    {"slug": "hello",     "label": "Hello, my name is",         "text": "Hello, my name is"},
    {"slug": "fox",       "label": "The quick brown fox",       "text": "The quick brown fox"},
]

GEN_STEPS = 8
TOPK = 20


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def round_floats(obj, ndigits=3):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return round(obj, ndigits)
    if isinstance(obj, list):
        return [round_floats(v, ndigits) for v in obj]
    if isinstance(obj, dict):
        return {k: round_floats(v, ndigits) for k, v in obj.items()}
    return obj


def as_list(t, ndigits=3):
    return round_floats(t.detach().cpu().tolist(), ndigits)


def main():
    print("Loading gpt2 small ...")
    tok = GPT2Tokenizer.from_pretrained("gpt2")
    model = GPT2LMHeadModel.from_pretrained("gpt2", output_attentions=True, output_hidden_states=True)
    model.eval()

    index_entries = []

    with torch.no_grad():
        for p in PROMPTS:
            text = p["text"]
            ids = tok.encode(text, return_tensors="pt")
            input_ids = ids[0].tolist()
            tokens = []
            for tid in input_ids:
                piece = tok.decode([tid])
                tokens.append({"id": int(tid), "text": piece})

            out = model(ids)
            attentions = out.attentions            # tuple of (1, heads, seq, seq) × 12
            hidden_states = out.hidden_states      # tuple of (1, seq, 768) × 13 (embed + 12 layers)
            logits = out.logits                    # (1, seq, vocab)

            # --- embeddings ---
            wte = model.transformer.wte.weight     # vocab × 768
            wpe = model.transformer.wpe.weight     # 1024 × 768
            seq_len = len(input_ids)
            tok_emb = wte[input_ids]               # seq × 768
            pos_emb = wpe[:seq_len]                # seq × 768

            # To keep the payload small we downsample 768-dim vectors to 64 dims for display.
            def downsample(mat, cols=64):
                # mat: seq × 768 — block-average
                n = mat.shape[1]
                block = n // cols
                return mat[:, : block * cols].reshape(mat.shape[0], cols, block).mean(dim=-1)

            tok_emb_ds = downsample(tok_emb)
            pos_emb_ds = downsample(pos_emb)
            sum_emb_ds = downsample(tok_emb + pos_emb)

            # --- per-layer: attention + hidden_state L2 norm per position ---
            layers = []
            for li, att in enumerate(attentions):
                att_matrix = att[0]              # (heads, seq, seq)
                hs = hidden_states[li + 1][0]    # (seq, 768) after layer li
                hs_ds = downsample(hs)
                layers.append({
                    "attention": as_list(att_matrix, 3),           # heads × seq × seq
                    "hidden_ds": as_list(hs_ds, 3),                # seq × 64
                    "hidden_norm": as_list(hs.norm(dim=-1), 2),    # seq
                })

            # --- top-k logits for the last token (the "next token") ---
            last_logits = logits[0, -1]          # (vocab,)
            probs = F.softmax(last_logits, dim=-1)
            top_vals, top_idx = torch.topk(probs, TOPK)
            top_logit_vals = last_logits[top_idx]
            topk = [
                {
                    "id": int(top_idx[i].item()),
                    "text": tok.decode([int(top_idx[i].item())]),
                    "logit": float(top_logit_vals[i].item()),
                    "prob": float(top_vals[i].item()),
                }
                for i in range(TOPK)
            ]

            # --- generation loop: greedy + random snapshots ---
            gen_steps = []
            ctx = ids.clone()
            for step in range(GEN_STEPS):
                g_out = model(ctx)
                g_logits = g_out.logits[0, -1]
                g_probs = F.softmax(g_logits, dim=-1)
                gv, gi = torch.topk(g_probs, TOPK)
                g_lv = g_logits[gi]
                greedy_id = int(gi[0].item())
                step_tokens = []
                for i in range(TOPK):
                    step_tokens.append({
                        "id": int(gi[i].item()),
                        "text": tok.decode([int(gi[i].item())]),
                        "logit": float(g_lv[i].item()),
                        "prob": float(gv[i].item()),
                    })
                # include context text up to this point
                ctx_ids = ctx[0].tolist()
                gen_steps.append({
                    "context_tokens": [{"id": int(t), "text": tok.decode([int(t)])} for t in ctx_ids],
                    "topk": step_tokens,
                    "greedy_id": greedy_id,
                })
                # extend greedy
                ctx = torch.cat([ctx, torch.tensor([[greedy_id]])], dim=1)

            trace = {
                "prompt": text,
                "label": p["label"],
                "tokens": tokens,
                "seq_len": seq_len,
                "d_model": 768,
                "n_layer": len(attentions),
                "n_head": attentions[0].shape[1],
                "embed": {
                    "token_ds": as_list(tok_emb_ds, 3),
                    "position_ds": as_list(pos_emb_ds, 3),
                    "sum_ds": as_list(sum_emb_ds, 3),
                },
                "layers": layers,
                "next_topk": topk,
                "generation": gen_steps,
            }

            out_path = OUT_DIR / f"{p['slug']}.json"
            out_path.write_text(json.dumps(trace, ensure_ascii=False))
            size_kb = out_path.stat().st_size / 1024
            print(f"wrote {out_path.relative_to(Path.cwd())}  ({size_kb:.1f} KB)")

            index_entries.append({
                "slug": p["slug"],
                "label": p["label"],
                "prompt": text,
                "seq_len": seq_len,
                "tokens": tokens,
            })

    (OUT_DIR / "index.json").write_text(
        json.dumps({
            "d_model": 768,
            "n_layer": 12,
            "n_head": 12,
            "vocab_size": 50257,
            "prompts": index_entries,
        }, ensure_ascii=False, indent=2)
    )
    print(f"wrote {OUT_DIR / 'index.json'}")


if __name__ == "__main__":
    main()
