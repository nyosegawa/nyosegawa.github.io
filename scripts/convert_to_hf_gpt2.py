"""
Convert a nanoGPT-style checkpoint + SentencePiece tokenizer into a
HuggingFace GPT2LMHeadModel-compatible repo, then push to the Hub.

After running this, the published repo should be loadable with:

    from transformers import GPT2LMHeadModel, AutoTokenizer
    model = GPT2LMHeadModel.from_pretrained("sakasegawa/gpt2-jp-small")
    tok   = AutoTokenizer.from_pretrained("sakasegawa/gpt2-jp-small")

References:
- nanoGPT (Linear weight (out, in)):
  https://github.com/karpathy/nanoGPT/blob/master/model.py
- HF GPT-2 (Conv1D weight (in, out)):
  https://github.com/huggingface/transformers/blob/main/src/transformers/models/gpt2/modeling_gpt2.py
- HF Conv1D:
  https://github.com/huggingface/transformers/blob/main/src/transformers/pytorch_utils.py
- LlamaTokenizer (SentencePiece backend, used here just for vocab IO):
  https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/tokenization_llama.py

Run:
    python3 scripts/convert_to_hf_gpt2.py \
        --ckpt path/to/ckpt.pt \
        --tokenizer path/to/tokenizer.model \
        --out-dir staging_hf \
        --repo-id sakasegawa/gpt2-jp-small \
        --push
"""

import argparse
from pathlib import Path

import torch
from transformers import GPT2Config, GPT2LMHeadModel, LlamaTokenizer

TRANSPOSE = (
    "attn.c_attn.weight",
    "attn.c_proj.weight",
    "mlp.c_fc.weight",
    "mlp.c_proj.weight",
)


def load_state_dict(ckpt_path: Path) -> dict:
    obj = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    if isinstance(obj, dict) and "model" in obj and isinstance(obj["model"], dict):
        sd = obj["model"]
    elif isinstance(obj, dict):
        sd = obj
    else:
        raise ValueError(f"Unsupported checkpoint format: {type(obj)}")

    sd = {k.removeprefix("_orig_mod."): v for k, v in sd.items()}
    sd = {
        k: v
        for k, v in sd.items()
        if not (k.endswith("attn.bias") or k.endswith("attn.masked_bias"))
    }
    return sd


def to_hf_layout(sd: dict) -> dict:
    out = {}
    for k, v in sd.items():
        if any(k.endswith(s) for s in TRANSPOSE):
            v = v.t().contiguous()
        out[k] = v
    return out


def build_hf_model(sd: dict, *, vocab_size: int, n_positions: int,
                   n_embd: int, n_layer: int, n_head: int) -> GPT2LMHeadModel:
    cfg = GPT2Config(
        vocab_size=vocab_size,
        n_positions=n_positions,
        n_ctx=n_positions,
        n_embd=n_embd,
        n_layer=n_layer,
        n_head=n_head,
        bos_token_id=1,
        eos_token_id=1,
        tie_word_embeddings=True,
    )
    model = GPT2LMHeadModel(cfg)
    missing, unexpected = model.load_state_dict(sd, strict=False)
    bad_missing = [k for k in missing if not k.endswith(".bias")]
    if bad_missing:
        raise RuntimeError(f"unexpected missing keys (not bias): {bad_missing[:8]}")
    if unexpected:
        raise RuntimeError(f"unexpected keys in checkpoint: {unexpected[:8]}")
    return model


def write_tokenizer(tokenizer_model: Path, out_dir: Path) -> None:
    # Use the special tokens that already exist in the SentencePiece vocab so
    # AutoTokenizer doesn't append IDs past vocab_size:
    #   id 0: <unk>, id 1: <|endoftext|>, id 2: <|pad|>
    tok = LlamaTokenizer(
        vocab_file=str(tokenizer_model),
        bos_token="<|endoftext|>",
        eos_token="<|endoftext|>",
        unk_token="<unk>",
        pad_token="<|pad|>",
        add_bos_token=False,
        add_eos_token=False,
        legacy=False,
    )
    tok.save_pretrained(out_dir)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--ckpt", type=Path, required=True)
    p.add_argument("--tokenizer", type=Path, required=True)
    p.add_argument("--out-dir", type=Path, required=True)
    p.add_argument("--repo-id", type=str, required=False)
    p.add_argument("--push", action="store_true")
    p.add_argument("--vocab-size", type=int, default=32000)
    p.add_argument("--n-positions", type=int, default=1024)
    p.add_argument("--n-embd", type=int, default=768)
    p.add_argument("--n-layer", type=int, default=12)
    p.add_argument("--n-head", type=int, default=12)
    args = p.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    sd = load_state_dict(args.ckpt)
    sd = to_hf_layout(sd)
    model = build_hf_model(
        sd,
        vocab_size=args.vocab_size,
        n_positions=args.n_positions,
        n_embd=args.n_embd,
        n_layer=args.n_layer,
        n_head=args.n_head,
    )
    model.save_pretrained(args.out_dir)
    write_tokenizer(args.tokenizer, args.out_dir)
    print(f"wrote HF-compatible repo to {args.out_dir}")

    sanity_check(args.out_dir)

    if args.push:
        if not args.repo_id:
            raise SystemExit("--repo-id is required with --push")
        from huggingface_hub import HfApi
        api = HfApi()
        api.create_repo(repo_id=args.repo_id, exist_ok=True)
        api.upload_folder(folder_path=str(args.out_dir), repo_id=args.repo_id)
        print(f"pushed to https://huggingface.co/{args.repo_id}")


def sanity_check(out_dir: Path) -> None:
    from transformers import AutoTokenizer
    m = GPT2LMHeadModel.from_pretrained(out_dir)
    t = AutoTokenizer.from_pretrained(out_dir)
    ids = t("日本の首都は", return_tensors="pt").input_ids
    y = m.generate(ids, max_new_tokens=8, do_sample=False)
    print("[sanity]", t.decode(y[0], skip_special_tokens=True))


if __name__ == "__main__":
    main()
