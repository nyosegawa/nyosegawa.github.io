// GPT-2 visualization app
// Loads pre-computed traces from ./data/ and drives each section.

const DATA_BASE = "/series/study-llm/gpt-2/data";

const state = {
  index: null,
  trace: null,
  currentSlug: null,
  attnLayer: 0,
  attnHead: 0,
  temperature: 1.0,
  topK: 20,
  topP: 1.0,
  genStep: 0,
  genPlaying: false,
  embedFocus: 0,
  tokFocus: null,
};

// ---------- util ----------

function showSpace(text) {
  // visualize leading/embedded space as U+00B7 middle dot
  return text.replace(/ /g, "·");
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// blue→white→red diverging color for signed values
function divergeColor(v, vmax = 1.0) {
  const t = clamp(v / vmax, -1, 1);
  if (t >= 0) {
    // white → red
    const r = 248 + Math.round((200 - 248) * t * -0); // start near white #f8fbff
    const g = 251 + Math.round((80 - 251) * t);
    const b = 255 + Math.round((100 - 255) * t);
    // simpler: interpolate from #f8fbff to #c0392b
    const r2 = Math.round(248 + (192 - 248) * t);
    const g2 = Math.round(251 + (57 - 251) * t);
    const b2 = Math.round(255 + (43 - 255) * t);
    return `rgb(${r2},${g2},${b2})`;
  } else {
    const u = -t;
    const r = Math.round(248 + (52 - 248) * u);
    const g = Math.round(251 + (103 - 251) * u);
    const b = Math.round(255 + (160 - 255) * u);
    return `rgb(${r},${g},${b})`;
  }
}

// monochrome scale 0..1
function monoColor(v, vmax = 1.0) {
  const t = clamp(v / vmax, 0, 1);
  // #f8fbff (bg) → #4a88b0 (link)
  const r = Math.round(248 + (74 - 248) * t);
  const g = Math.round(251 + (136 - 251) * t);
  const b = Math.round(255 + (176 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

function maxAbs(mat) {
  let m = 0;
  for (const row of mat) for (const v of row) if (Math.abs(v) > m) m = Math.abs(v);
  return m || 1;
}

// ---------- data ----------

async function loadIndex() {
  const res = await fetch(`${DATA_BASE}/index.json`);
  if (!res.ok) throw new Error("failed to load index.json");
  return await res.json();
}

async function loadTrace(slug) {
  const res = await fetch(`${DATA_BASE}/${slug}.json`);
  if (!res.ok) throw new Error(`failed to load ${slug}.json`);
  return await res.json();
}

// ---------- sections ----------

function renderPromptPicker() {
  const chips = document.querySelector('[data-role="prompt-chips"]');
  chips.innerHTML = "";
  for (const p of state.index.prompts) {
    const btn = document.createElement("button");
    btn.className = "gpt2-chip";
    btn.textContent = p.label;
    btn.setAttribute("aria-selected", p.slug === state.currentSlug ? "true" : "false");
    btn.addEventListener("click", () => selectPrompt(p.slug));
    chips.appendChild(btn);
  }
  const cur = document.querySelector('[data-role="current-prompt"]');
  cur.innerHTML = `選択中: <code>${state.trace.prompt}</code> (${state.trace.seq_len} トークン)`;
}

function renderTokens() {
  const root = document.querySelector('[data-role="tokens"]');
  root.innerHTML = "";
  const hues = [200, 340, 40, 120, 260, 20, 170, 290];
  state.trace.tokens.forEach((tok, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "gpt2-tok";
    if (i === state.tokFocus) el.classList.add("selected");
    // Render literal text (leading space shows via padding)
    if (tok.text.startsWith(" ")) el.dataset.leadingSpace = "1";
    el.textContent = tok.text;
    const h = hues[i % hues.length];
    el.style.background = `hsl(${h}, 70%, 88%)`;
    el.style.color = `hsl(${h}, 40%, 25%)`;
    el.addEventListener("click", () => {
      state.tokFocus = i;
      renderTokens();
      renderTokenDetail();
    });
    root.appendChild(el);
  });
  renderTokenDetail();
  renderTokenCompare();
}

function renderTokenDetail() {
  const root = document.querySelector('[data-role="tok-detail"]');
  if (!root) return;
  if (state.tokFocus == null) {
    root.className = "gpt2-tok-detail placeholder";
    root.textContent = "↑ トークンをクリックすると詳細がここに出ます";
    return;
  }
  root.className = "gpt2-tok-detail";
  const i = state.tokFocus;
  const tok = state.trace.tokens[i];
  const bytes = [...new TextEncoder().encode(tok.text)];
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const visText = tok.text.replace(/ /g, "␣");
  const leadingNote = tok.text.startsWith(" ")
    ? `<span class="gpt2-tok-detail-flag">先頭スペース込み</span>`
    : (i === 0
      ? `<span class="gpt2-tok-detail-flag ok">文頭トークン (スペースなし)</span>`
      : "");
  root.innerHTML = `
    <div class="gpt2-tok-detail-title">
      トークン <span class="gpt2-tok-detail-idx">#${i}</span>
      ${leadingNote}
    </div>
    <dl class="gpt2-tok-detail-grid">
      <dt>文字列</dt>
      <dd><code>"${visText}"</code> <small>( ␣ = 空白文字)</small></dd>
      <dt>ID</dt>
      <dd><code>${tok.id}</code> <small>/ 語彙 50,257 個</small></dd>
      <dt>バイト列</dt>
      <dd><code>${hex}</code> <small>(${bytes.length} バイト)</small></dd>
    </dl>
  `;
}

function renderTokenCompare() {
  const root = document.querySelector('[data-role="tok-compare"]');
  if (!root) return;
  root.innerHTML = "";
  const text = state.trace.prompt;

  const methods = [
    {
      name: "char",
      label: "文字分割",
      era: "最古の素朴案",
      tokens: [...text].map((c) => ({ text: c })),
      pros: "OOV なし、語彙が超小",
      cons: "系列が長い (Attention が O(n²) なので重い)",
    },
    {
      name: "word",
      label: "単語分割",
      era: "古典 NLP",
      tokens: text.split(/\s+/).filter(Boolean).map((w) => ({ text: w })),
      pros: "短く、人間の直感に近い",
      cons: "語彙が爆発、未知語で詰む、活用形が別トークン扱い",
    },
    {
      name: "bpe",
      label: "BPE (GPT-2)",
      era: "今回の主役",
      tokens: state.trace.tokens,
      pros: "語彙と系列長のバランス、OOV が原理的に出ない",
      cons: "先頭スペース込みなど、見慣れるまで違和感",
    },
  ];

  for (const m of methods) {
    const row = document.createElement("div");
    row.className = `gpt2-tok-compare-row m-${m.name}`;
    const label = document.createElement("div");
    label.className = "gpt2-tok-compare-label";
    label.innerHTML = `<strong>${m.label}</strong><br><small>${m.era}</small>`;
    const tiles = document.createElement("div");
    tiles.className = "gpt2-tok-compare-tiles";
    for (const t of m.tokens) {
      const tile = document.createElement("span");
      tile.className = "gpt2-tok-compare-tile";
      if (t.text === " ") {
        tile.dataset.kind = "space";
        tile.textContent = "␣";
      } else {
        tile.textContent = t.text;
        if (t.text.startsWith(" ")) tile.dataset.leadingSpace = "1";
      }
      tiles.appendChild(tile);
    }
    const count = document.createElement("div");
    count.className = "gpt2-tok-compare-count";
    count.textContent = `${m.tokens.length} tok`;
    row.appendChild(label);
    row.appendChild(tiles);
    row.appendChild(count);
    root.appendChild(row);
    const desc = document.createElement("div");
    desc.className = "gpt2-tok-compare-desc";
    desc.innerHTML = `<span class="pros">◎ ${m.pros}</span><span class="cons">△ ${m.cons}</span>`;
    root.appendChild(desc);
  }
}

function renderEmbedGrid(rootSel, mat, vmax) {
  const root = document.querySelector(rootSel);
  root.innerHTML = "";
  const rows = mat.length;
  const cols = mat[0].length;
  const cellH = 14;
  const gap = 1;
  const pad = 2;
  root.style.position = "relative";
  root.style.gridTemplateColumns = `repeat(${cols}, 6px)`;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const cell = document.createElement("div");
      cell.className = "gpt2-embed-cell";
      cell.style.background = divergeColor(mat[i][j], vmax);
      cell.dataset.row = i;
      cell.title = `pos=${i}, dim≈${j}, v=${mat[i][j].toFixed(3)}`;
      root.appendChild(cell);
    }
  }
  // Selected-row overlay
  const r = state.embedFocus;
  if (r >= 0 && r < rows) {
    const overlay = document.createElement("div");
    overlay.className = "gpt2-embed-row-overlay";
    overlay.style.top = `${pad + r * (cellH + gap) - 1}px`;
    overlay.style.height = `${cellH + 2}px`;
    root.appendChild(overlay);
  }
  root.onclick = (e) => {
    const c = e.target.closest(".gpt2-embed-cell");
    if (!c) return;
    const rr = +c.dataset.row;
    if (Number.isFinite(rr)) {
      state.embedFocus = rr;
      renderEmbed();
    }
  };
}

function renderEmbedRowLabels(rootSel, tokens, showIdx) {
  const root = document.querySelector(rootSel);
  root.innerHTML = "";
  tokens.forEach((t, i) => {
    const d = document.createElement("div");
    d.textContent = showIdx
      ? `${i}: ${showSpace(t.text)}`
      : showSpace(t.text);
    if (i === state.embedFocus) {
      d.style.color = "var(--color-link)";
      d.style.fontWeight = "700";
    }
    root.appendChild(d);
  });
}

function renderEmbedFocusStrip(rootSel, vec, vmax) {
  const root = document.querySelector(rootSel);
  root.innerHTML = "";
  root.style.gridTemplateColumns = `repeat(${vec.length}, 14px)`;
  for (let j = 0; j < vec.length; j++) {
    const c = document.createElement("div");
    c.className = "gpt2-embed-focus-cell";
    c.style.background = divergeColor(vec[j], vmax);
    c.title = `dim≈${j}, v=${vec[j].toFixed(3)}`;
    root.appendChild(c);
  }
}

function renderEmbed() {
  const emb = state.trace.embed;
  const vmax = Math.max(maxAbs(emb.token_ds), maxAbs(emb.position_ds), maxAbs(emb.sum_ds));

  // Row labels
  const toks = state.trace.tokens;
  const posLabels = toks.map((_, i) => ({ text: `pos ${i}` }));
  renderEmbedRowLabels('[data-role="embed-rowlabels-tok"]', toks.map((t, i) => ({ text: `${i}: ${showSpace(t.text)}` })), false);
  renderEmbedRowLabels('[data-role="embed-rowlabels-pos"]', posLabels, false);
  renderEmbedRowLabels('[data-role="embed-rowlabels-sum"]', toks.map((t, i) => ({ text: `${i}: ${showSpace(t.text)}` })), false);

  document.querySelector('[data-role="embed-seq-max"]').textContent = toks.length - 1;

  renderEmbedGrid('[data-role="embed-token"]', emb.token_ds, vmax);
  renderEmbedGrid('[data-role="embed-position"]', emb.position_ds, vmax);
  renderEmbedGrid('[data-role="embed-sum"]', emb.sum_ds, vmax);

  // Focus panel
  const p = clamp(state.embedFocus, 0, toks.length - 1);
  const tokVec = emb.token_ds[p];
  const posVec = emb.position_ds[p];
  const sumVec = emb.sum_ds[p];
  document.querySelector('[data-role="focus-pos"]').textContent = p;
  document.querySelector('[data-role="focus-tok"]').textContent = `"${toks[p].text}" (id=${toks[p].id})`;
  renderEmbedFocusStrip('[data-role="focus-token"]', tokVec, vmax);
  renderEmbedFocusStrip('[data-role="focus-position"]', posVec, vmax);
  renderEmbedFocusStrip('[data-role="focus-sum"]', sumVec, vmax);

  // Numerical example for dim 0
  const ex = document.querySelector('[data-role="focus-example"]');
  const t0 = tokVec[0], p0 = posVec[0], s0 = sumVec[0];
  ex.innerHTML =
    `たとえば先頭の dim (0) では: ` +
    `<strong>${t0.toFixed(3)}</strong> (token) ` +
    `+ <strong>${p0.toFixed(3)}</strong> (position) ` +
    `= <strong>${s0.toFixed(3)}</strong>。` +
    ` 64 本の各マスで同じ足し算が行われています。`;

  renderEmbedMath();
}

function renderEmbedMath() {
  const root = document.querySelector('[data-role="embed-math"]');
  if (!root) return;
  const toks = state.trace.tokens;
  const firstTok = toks[0];
  const tokVec = state.trace.embed.token_ds[0];
  const posVec = state.trace.embed.position_ds[0];
  const sumVec = state.trace.embed.sum_ds[0];
  const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);

  const head = (arr) => arr.slice(0, 5).map(fmt).join(", ");
  const perDim = [0, 1, 2].map((d) => ({
    d,
    t: tokVec[d],
    p: posVec[d],
    s: sumVec[d],
  }));

  const perDimRows = perDim.map((r) =>
    `  x₀[${r.d}] = W_E[${firstTok.id}][${r.d}] + W_P[0][${r.d}] = ${fmt(r.t)} + ${fmt(r.p)} = ${fmt(r.s)}`
  ).join("\n");

  // Alt-position example: if seq has at least 2 tokens, show pos 1 using the SAME firstTok to argue "position changes the vec"
  const altPos = Math.min(2, toks.length - 1);
  const altPosVec = state.trace.embed.position_ds[altPos];
  const altDim0 = state.trace.embed.token_ds[0][0] + altPosVec[0]; // approx, we can't reconstruct from actual sum (pos differs)

  root.innerHTML = `
    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 1: ID から W<sub>E</sub> の行を引く</h4>
    <p>
      先頭トークン <code>"${firstTok.text}"</code> の ID は <code>${firstTok.id}</code>。
      これで <code>W<sub>E</sub></code> (50,257 × 768) の <strong>${firstTok.id} 行目</strong>を取ってきます:
    </p>
    <pre class="gpt2-math-block"><code>W_E[${firstTok.id}] = [ ${head(tokVec)}, ... ]    // 全 768 次元</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 2: 位置から W<sub>P</sub> の行を引く</h4>
    <p>
      位置 <strong>0</strong> (先頭) なので、<code>W<sub>P</sub></code> (1,024 × 768) の 0 行目:
    </p>
    <pre class="gpt2-math-block"><code>W_P[0] = [ ${head(posVec)}, ... ]</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 3: 要素ごとに足す</h4>
    <p>
      同じ位置同士の値を足し合わせるだけ。これを 768 次元ぶん繰り返します:
    </p>
    <pre class="gpt2-math-block"><code>${perDimRows}
  ...
  x₀[767] = W_E[${firstTok.id}][767] + W_P[0][767] = ...</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 4: 位置が変われば結果も変わる</h4>
    <p>
      もし同じトークン <code>"${firstTok.text}"</code> が別の位置 (たとえば 位置 ${altPos}) にあったら、
      取り出す <code>W<sub>P</sub></code> の行が変わるので、最終ベクトルも別物になる:
    </p>
    <pre class="gpt2-math-block"><code>x₀[0]   (位置 0)  = W_E[${firstTok.id}][0] + W_P[0][0] = ${fmt(tokVec[0])} + ${fmt(posVec[0])} = ${fmt(sumVec[0])}
x'₀[0]  (位置 ${altPos})  = W_E[${firstTok.id}][0] + W_P[${altPos}][0] = ${fmt(tokVec[0])} + ${fmt(altPosVec[0])} = ${fmt(altDim0)}</code></pre>
    <p>
      同じ語でも「何番目に現れたか」で表現が変わる。<strong>これが Self-Attention が語順を区別できる根拠</strong>です。
    </p>
  `;
}

function renderAttnMath() {
  const root = document.querySelector('[data-role="attn-math"]');
  if (!root) return;
  const L = state.attnLayer;
  const H = state.attnHead;
  const attn = state.trace.layers[L].attention[H];
  const toks = state.trace.tokens;
  const seq = state.trace.seq_len;
  // pick the last row (most context) as the example
  const i = seq - 1;
  const row = attn[i];
  const sumRow = row.reduce((a, b) => a + b, 0);

  const rowStr = row.map((v, j) => `${v.toFixed(3)} (→ "${showSpace(toks[j].text)}")`).join(", ");
  const sortedIdx = row.map((v, j) => [v, j]).sort((a, b) => b[0] - a[0]);

  // Simulate: softmax inverse. Given probs p, raw logits z = log(p) + const.
  // Show the relationship with 2 of the largest probs.
  const [p1, j1] = sortedIdx[0];
  const [p2, j2] = sortedIdx[1];
  const ratio = p1 > 0 && p2 > 0 ? p1 / p2 : 0;
  const deltaZ = p2 > 0 ? Math.log(ratio) : null;

  root.innerHTML = `
    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 1: 選択中 (Layer ${L}, Head ${H}) の 1 行を取り出す</h4>
    <p>
      最後のトークン <code>"${showSpace(toks[i].text)}"</code> (位置 ${i}) から他のトークンへの注意分布を見ます。
      表示中のヒートマップの下から ${i + 1} 行目:
    </p>
    <pre class="gpt2-math-block"><code>attn[${i}] = [
  ${rowStr}
]
合計 = ${sumRow.toFixed(3)}   // softmax の出力なので 1 になる</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 2: これが出るまでの計算</h4>
    <p>
      実際には <strong>raw score</strong> <code>z<sub>j</sub> = (Q<sub>${i}</sub> · K<sub>j</sub>) / √d<sub>k</sub></code> が <strong>未来の位置には -∞</strong> のマスクと一緒に softmax に通されます:
    </p>
    <pre class="gpt2-math-block"><code>z = [z_0, z_1, ..., z_${i}, -∞, -∞, ...]   // 未来はマスクで -∞
attn[${i}][j] = exp(z_j) / Σ_k exp(z_k)</code></pre>

    ${deltaZ !== null ? `
    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 3: 上位 2 つのスコアの差を逆算</h4>
    <p>
      上位 2 位の重みは <code>${p1.toFixed(3)}</code> ("${showSpace(toks[j1].text)}") と <code>${p2.toFixed(3)}</code> ("${showSpace(toks[j2].text)}")。
      softmax の性質から <code>exp(z<sub>${j1}</sub> − z<sub>${j2}</sub>) = ${p1.toFixed(3)} / ${p2.toFixed(3)} ≈ ${ratio.toFixed(2)}</code>。つまり:
    </p>
    <pre class="gpt2-math-block"><code>z_${j1} − z_${j2} = log(${ratio.toFixed(2)}) ≈ ${deltaZ.toFixed(2)}</code></pre>
    <p>
      生スコアで <strong>${Math.abs(deltaZ).toFixed(2)}</strong> 差があっただけで、softmax 通過後は約 <strong>${(p1 / p2).toFixed(1)} 倍</strong>の重み差になった、というわけ。
      softmax は <em>少しの差を増幅</em>するので、勾配が流れやすい一方で、<code>√d<sub>k</sub></code> のスケーリングで暴走を抑えているのがポイント。
    </p>
    ` : ""}
  `;
}

function renderAttention() {
  const layer = state.attnLayer;
  const head = state.attnHead;
  const attn = state.trace.layers[layer].attention[head]; // seq × seq
  const seq = state.trace.seq_len;
  const tokens = state.trace.tokens;

  document.querySelector('[data-role="attn-layer-value"]').textContent = layer;
  document.querySelector('[data-role="attn-head-value"]').textContent = head;

  const heat = document.querySelector('[data-role="attn-heat"]');
  heat.innerHTML = "";

  // header row
  const header = document.createElement("div");
  header.className = "gpt2-attn-row";
  header.style.gridTemplateColumns = `5em repeat(${seq}, 44px)`;
  const corner = document.createElement("div");
  corner.className = "gpt2-attn-header";
  corner.textContent = "i \\ j";
  header.appendChild(corner);
  for (let j = 0; j < seq; j++) {
    const h = document.createElement("div");
    h.className = "gpt2-attn-header";
    h.textContent = showSpace(tokens[j].text);
    header.appendChild(h);
  }
  heat.appendChild(header);

  for (let i = 0; i < seq; i++) {
    const row = document.createElement("div");
    row.className = "gpt2-attn-row";
    row.style.gridTemplateColumns = `5em repeat(${seq}, 44px)`;
    const label = document.createElement("div");
    label.className = "gpt2-attn-rowlabel";
    label.textContent = showSpace(tokens[i].text);
    row.appendChild(label);
    for (let j = 0; j < seq; j++) {
      const cell = document.createElement("div");
      cell.className = "gpt2-attn-cell";
      const v = attn[i][j];
      cell.style.background = monoColor(v, 1.0);
      if (v >= 0.01) {
        cell.textContent = v.toFixed(2);
        if (v > 0.5) cell.style.color = "white";
      }
      cell.title = `attn[${i}][${j}] = ${v.toFixed(3)}`;
      row.appendChild(cell);
    }
    heat.appendChild(row);
  }

  renderAttnMath();
}

function renderStack() {
  const root = document.querySelector('[data-role="stack"]');
  root.innerHTML = "";
  // layers[0..11] are block outputs; layers[11] is post final LayerNorm so magnitudes differ.
  // Skip the post-LN row and show Layer 1..11 + "Final (+LN)" + Embed separately,
  // using a log scale so the first-token outlier doesn't wash out the rest.
  const layers = state.trace.layers;
  const seq = state.trace.seq_len;
  const tokens = state.trace.tokens;
  const blocks = layers.slice(0, layers.length - 1); // block outputs (11 rows = L1..L11)
  const finalLayer = layers[layers.length - 1];       // post-LN final state

  const log1p = (x) => Math.log(1 + x);

  // vmax only over pre-LN block outputs for the main gradient
  let vmax = 0;
  for (const L of blocks) for (const n of L.hidden_norm) if (n > vmax) vmax = n;
  const vmaxLog = log1p(vmax);

  // header row with token labels
  const hdr = document.createElement("div");
  hdr.className = "gpt2-stack-row";
  const hdrLabel = document.createElement("div");
  hdrLabel.className = "gpt2-stack-label";
  hdrLabel.textContent = "";
  hdr.appendChild(hdrLabel);
  const hdrCells = document.createElement("div");
  hdrCells.className = "gpt2-stack-cells";
  for (let j = 0; j < seq; j++) {
    const c = document.createElement("div");
    c.className = "gpt2-stack-cell";
    c.style.background = "transparent";
    c.style.color = "var(--color-heading)";
    c.textContent = showSpace(tokens[j].text).slice(0, 6);
    hdrCells.appendChild(c);
  }
  hdr.appendChild(hdrCells);
  root.appendChild(hdr);

  // Final post-LN row (scaled to its own max so the row is legible)
  {
    const row = document.createElement("div");
    row.className = "gpt2-stack-row";
    const label = document.createElement("div");
    label.className = "gpt2-stack-label";
    label.innerHTML = `最終<br><small style="opacity:0.65">(+LN)</small>`;
    row.appendChild(label);
    const cells = document.createElement("div");
    cells.className = "gpt2-stack-cells";
    const fmax = Math.max(...finalLayer.hidden_norm, 1);
    for (let j = 0; j < seq; j++) {
      const v = finalLayer.hidden_norm[j];
      const c = document.createElement("div");
      c.className = "gpt2-stack-cell";
      c.style.background = monoColor(v, fmax);
      c.textContent = v.toFixed(0);
      c.title = `最終 (post-LN) pos ${j}: ‖h‖ = ${v.toFixed(2)}`;
      cells.appendChild(c);
    }
    row.appendChild(cells);
    root.appendChild(row);
  }

  // block outputs L11 .. L1 (top to bottom), log scale for color
  for (let li = blocks.length - 1; li >= 0; li--) {
    const row = document.createElement("div");
    row.className = "gpt2-stack-row";
    const label = document.createElement("div");
    label.className = "gpt2-stack-label";
    label.textContent = `Layer ${li + 1}`;
    row.appendChild(label);
    const cells = document.createElement("div");
    cells.className = "gpt2-stack-cells";
    for (let j = 0; j < seq; j++) {
      const c = document.createElement("div");
      c.className = "gpt2-stack-cell";
      const v = blocks[li].hidden_norm[j];
      c.style.background = monoColor(log1p(v), vmaxLog);
      c.textContent = v.toFixed(0);
      if (log1p(v) / vmaxLog > 0.55) c.style.color = "white";
      c.title = `Layer ${li + 1} pos ${j}: ‖h‖ = ${v.toFixed(2)}`;
      cells.appendChild(c);
    }
    row.appendChild(cells);
    root.appendChild(row);
  }

  // embedding row (own scale, small baseline)
  const row = document.createElement("div");
  row.className = "gpt2-stack-row";
  const label = document.createElement("div");
  label.className = "gpt2-stack-label";
  label.textContent = "Embed";
  row.appendChild(label);
  const cells = document.createElement("div");
  cells.className = "gpt2-stack-cells";
  const sumNorms = state.trace.embed.sum_ds.map((r) =>
    Math.sqrt(r.reduce((a, b) => a + b * b, 0))
  );
  const smax = Math.max(...sumNorms, 1);
  for (let j = 0; j < seq; j++) {
    const c = document.createElement("div");
    c.className = "gpt2-stack-cell";
    c.style.background = monoColor(sumNorms[j], smax);
    c.textContent = sumNorms[j].toFixed(1);
    cells.appendChild(c);
  }
  row.appendChild(cells);
  root.appendChild(row);
}

// ---------- sampling ----------

function applySampling(base) {
  // base: [{id, text, logit, prob}], sorted by prob desc
  const T = state.temperature;
  const k = state.topK;
  const p = state.topP;

  // recompute probs from logits with temperature
  let items = base.map((x) => ({ ...x, scaled: x.logit / T }));
  const maxL = Math.max(...items.map((x) => x.scaled));
  items = items.map((x) => ({ ...x, ex: Math.exp(x.scaled - maxL) }));
  const Z = items.reduce((a, b) => a + b.ex, 0);
  items = items.map((x) => ({ ...x, tprob: x.ex / Z }));
  items.sort((a, b) => b.tprob - a.tprob);

  // top-k: mark items with rank >= k as filtered
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    items[i].filtered = i >= k;
    if (!items[i].filtered) cum += items[i].tprob;
  }
  // top-p (over surviving items): walk sorted, stop once cum prob reaches p
  let pSum = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].filtered) continue;
    pSum += items[i].tprob;
    items[i].pFiltered = pSum - items[i].tprob >= p; // already past p before this item
  }
  // ensure at least the top item survives
  items[0].filtered = false;
  items[0].pFiltered = false;
  // final `surv`
  items.forEach((x) => (x.surv = !x.filtered && !x.pFiltered));
  // renormalize over survivors for visual fill
  const survSum = items.filter((x) => x.surv).reduce((a, b) => a + b.tprob, 0) || 1;
  items.forEach((x) => (x.renorm = x.surv ? x.tprob / survSum : 0));
  return items;
}

function renderSamplingMath() {
  const root = document.querySelector('[data-role="sampling-math"]');
  if (!root) return;
  const base = state.trace.next_topk;
  const top3 = base.slice(0, 3);
  const T = state.temperature;
  const topP = state.topP;

  // Re-compute softmax with the full top-20 to match displayed bars.
  const scaled = base.map((x) => x.logit / T);
  const mx = Math.max(...scaled);
  const ex = scaled.map((s) => Math.exp(s - mx));
  const Z = ex.reduce((a, b) => a + b, 0);
  const probs = ex.map((e) => e / Z);

  const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
  const pct = (v) => (v * 100).toFixed(2) + "%";

  // top-p cumulative
  const sortedIdx = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
  let cum = 0;
  const cumRows = [];
  for (const [p, i] of sortedIdx) {
    cum += p;
    cumRows.push({ text: base[i].text, p, cum });
    if (cum >= topP && cumRows.length >= 1) break;
  }

  const top3Rows = top3.map((t, k) =>
    `  z[${k}] = ${t.logit.toFixed(3)}  (token "${showSpace(t.text)}")`
  ).join("\n");

  const top3SoftmaxRows = top3.map((t, k) =>
    `  exp(z[${k}] − z_max) = ${Math.exp(t.logit / 1.0 - Math.max(...top3.map(x => x.logit))).toFixed(4)}`
  ).join("\n");

  // temperature demo
  const tempDemo = top3.map((t, k) => {
    const p_at_1 = ex[k] / Z; // at current T
    return { text: t.text, logit: t.logit, p: p_at_1 };
  });

  const tempRows = tempDemo.map((r) =>
    `  p(${showSpace(r.text)} | T=${T.toFixed(2)}) = ${pct(r.p)}`
  ).join("\n");

  const topPRows = cumRows.map((r) =>
    `  "${showSpace(r.text)}": p=${pct(r.p)}  累積=${pct(r.cum)}${r.cum >= topP ? "  ← ここで打ち切り" : ""}`
  ).join("\n");

  root.innerHTML = `
    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 1: ロジットの生の値</h4>
    <p>最終隠れ状態に <code>W<sub>E</sub><sup>T</sup></code> を掛けると、語彙 50,257 個ぶんの <strong>ロジット</strong> が出ます。上位 3 つ:</p>
    <pre class="gpt2-math-block"><code>${top3Rows}</code></pre>
    <p class="gpt2-note">ロジットは大きな負の数に見えますが、全体に同じ定数を足しても softmax の結果は変わりません。大事なのは <em>差</em>。</p>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 2: softmax で確率に</h4>
    <p>
      <code>p<sub>i</sub> = exp(z<sub>i</sub>) / Σ exp(z<sub>j</sub>)</code>。実装では数値安定化のため <code>z − max(z)</code> を引いてから exp を取ります:
    </p>
    <pre class="gpt2-math-block"><code>${top3SoftmaxRows}
Σ exp = (全 50,257 語の合計、ここでは省略)
p[i] = exp(z[i] − z_max) / Σ exp</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 3: 温度 T=${T.toFixed(2)} を適用</h4>
    <p>
      <code>p'<sub>i</sub> = softmax(z / T)</code>。T < 1 で尖り、T > 1 で平らに。現在の設定での上位 3:
    </p>
    <pre class="gpt2-math-block"><code>${tempRows}</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 4: top-p=${topP.toFixed(2)} で打ち切り</h4>
    <p>上位から累積確率を足していき、${pct(topP)} に達した時点で打ち切り:</p>
    <pre class="gpt2-math-block"><code>${topPRows}</code></pre>
    <p>
      残ったトークンだけで再正規化 (確率合計が 1 になるように) したものから 1 語サンプリング。
      上のスライダーをいじると、T と top-p でトークンの取捨と確率分布がどう変わるか追えます。
    </p>
  `;
}

function renderSamplingBars() {
  document.querySelector('[data-role="temp-value"]').textContent = state.temperature.toFixed(2);
  document.querySelector('[data-role="topk-value"]').textContent = state.topK;
  document.querySelector('[data-role="topp-value"]').textContent = state.topP.toFixed(2);

  const bars = document.querySelector('[data-role="sampling-bars"]');
  bars.innerHTML = "";
  const items = applySampling(state.trace.next_topk);
  const maxTp = Math.max(...items.map((x) => x.tprob));
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "gpt2-bar" + (it.surv ? "" : " filtered");
    const label = document.createElement("div");
    label.className = "gpt2-bar-label";
    label.textContent = showSpace(it.text);
    const track = document.createElement("div");
    track.className = "gpt2-bar-track";
    const fill = document.createElement("div");
    fill.className = "gpt2-bar-fill";
    fill.style.width = `${(it.tprob / maxTp) * 100}%`;
    track.appendChild(fill);
    const val = document.createElement("div");
    val.className = "gpt2-bar-value";
    val.textContent = (it.tprob * 100).toFixed(1) + "%";
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    bars.appendChild(row);
  }
  renderSamplingMath();
}

// ---------- generation ----------

function renderGeneration() {
  document.querySelector('[data-role="gen-step-value"]').textContent = state.genStep;
  const gen = document.querySelector('[data-role="gen"]');
  const topkBox = document.querySelector('[data-role="gen-topk"]');

  const steps = state.trace.generation;
  const promptLen = state.trace.tokens.length;

  // Build the evolving sequence up to current step.
  // At step s, we've accepted s additional tokens.
  gen.innerHTML = "";
  // seed tokens
  for (const t of state.trace.tokens) {
    const el = document.createElement("span");
    el.className = "gpt2-gen-tok seed";
    el.textContent = showSpace(t.text);
    gen.appendChild(el);
  }
  // accepted generated tokens 0..genStep-1
  for (let i = 0; i < state.genStep; i++) {
    const tid = steps[i].greedy_id;
    const tText = steps[i].topk.find((t) => t.id === tid)?.text ?? "?";
    const el = document.createElement("span");
    el.className = "gpt2-gen-tok new";
    el.textContent = showSpace(tText);
    gen.appendChild(el);
  }
  // placeholder for next token if not at end
  if (state.genStep < steps.length) {
    const ph = document.createElement("span");
    ph.className = "gpt2-gen-tok pending";
    ph.textContent = "▮";
    gen.appendChild(ph);
  }

  // top-k bars for the current step's next-token distribution
  topkBox.innerHTML = "";
  const currentIdx = clamp(state.genStep, 0, steps.length - 1);
  const step = steps[currentIdx];
  const bars = document.createElement("div");
  bars.className = "gpt2-bars";
  const maxP = Math.max(...step.topk.map((x) => x.prob));
  const chosen = step.greedy_id;
  step.topk.forEach((tk) => {
    const row = document.createElement("div");
    row.className = "gpt2-bar";
    const label = document.createElement("div");
    label.className = "gpt2-bar-label";
    label.textContent = showSpace(tk.text);
    const track = document.createElement("div");
    track.className = "gpt2-bar-track";
    const fill = document.createElement("div");
    fill.className = "gpt2-bar-fill";
    fill.style.width = `${(tk.prob / maxP) * 100}%`;
    if (tk.id === chosen) fill.style.background = "var(--color-heading)";
    track.appendChild(fill);
    const val = document.createElement("div");
    val.className = "gpt2-bar-value";
    val.textContent = (tk.prob * 100).toFixed(1) + "%";
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    bars.appendChild(row);
  });
  const caption = document.createElement("p");
  caption.className = "gpt2-note";
  caption.textContent = `Step ${currentIdx + 1} の候補上位 20 個と、選ばれた (濃色) 語。`;
  topkBox.appendChild(caption);
  topkBox.appendChild(bars);
}

// ---------- training ----------

function renderTrainMath() {
  const root = document.querySelector('[data-role="train-math"]');
  if (!root) return;
  const base = state.trace.next_topk; // probabilities for next-token prediction of this prompt
  const top5 = base.slice(0, 5);
  const fmt = (p) => (p * 100).toFixed(2) + "%";
  const ce = (p) => -Math.log(p);

  const rows = top5.map((t) =>
    `  "${showSpace(t.text)}":  p=${fmt(t.prob)}   →  −log(${t.prob.toFixed(3)}) = ${ce(t.prob).toFixed(3)}`
  ).join("\n");

  const best = top5[0];
  const worst = top5[top5.length - 1];
  const dLdZ_self = best.prob - 1; // if target is best
  const dLdZ_other = (top5[1]?.prob ?? 0); // example: second token's grad contribution

  root.innerHTML = `
    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 1: モデルの予測分布</h4>
    <p>
      プロンプト「${state.trace.prompt}」に対して、GPT-2 が出した次トークンの上位 5 候補とその確率:
    </p>
    <pre class="gpt2-math-block"><code>${top5.map((t) => `  p("${showSpace(t.text)}") = ${fmt(t.prob)}`).join("\n")}</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 2: 正解ごとの loss を計算</h4>
    <p>
      cross-entropy は <code>L = −log p(正解)</code>。正解トークンを変えると loss がどう変わるかを見ます:
    </p>
    <pre class="gpt2-math-block"><code>${rows}</code></pre>
    <p>
      <strong>正解の確率が高いほど loss は小さい</strong>。確率 100% なら <code>−log 1 = 0</code>、
      確率 1% なら <code>−log 0.01 ≈ 4.6</code>。モデルが自信を持って外したときほどペナルティが重くなります。
    </p>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 3: 全位置で平均して 1 バッチの loss</h4>
    <p>
      プロンプト長 T=${state.trace.seq_len} の場合、T−1 箇所で次トークン予測が行われます (最後の位置は正解が存在しないので除外)。
    </p>
    <pre class="gpt2-math-block"><code>L_total = (1 / (T−1)) × Σ_t  −log p(x_{t+1} | x_{≤t})
        = (1 / ${state.trace.seq_len - 1}) × (loss_1 + loss_2 + ... + loss_${state.trace.seq_len - 1})</code></pre>

    <h4 style="margin:1em 0 0.4em;font-size:1em;">ステップ 4: 勾配はどうなる?</h4>
    <p>
      softmax + cross-entropy の合わせ技だと、ロジットに対する勾配が <strong>きれいな形</strong>になります:
    </p>
    <pre class="gpt2-math-block"><code>∂L/∂z_i = p_i − y_i      // y は正解の one-hot

正解トークン i*:   ∂L/∂z_{i*} = p_{i*} − 1       (正解の確率が 1 に近いほど勾配が小さくなる)
それ以外の j:      ∂L/∂z_j    = p_j            (確率を下げる方向に勾配が立つ)</code></pre>
    <p>
      この <code>p − y</code> という形は実装が簡単で数値的にも安定。他の損失 (MSE など) と比べて学習が速く、深層言語モデルで採用されている大きな理由のひとつです。
    </p>
  `;
}

function renderTrain() {
  const root = document.querySelector('[data-role="train"]');
  const toks = state.trace.tokens;
  const seqShown = toks.slice(0, Math.min(toks.length, 6));
  const inputs = seqShown.slice(0, -1);
  const targets = seqShown.slice(1);

  root.innerHTML = "";
  const scroll = document.createElement("div");
  scroll.className = "gpt2-train-scroll";

  const rows = document.createElement("div");
  rows.className = "gpt2-train-rows";

  const makeRow = (labelTxt, toks, rowCls) => {
    const row = document.createElement("div");
    row.className = `gpt2-train-row ${rowCls}`;
    const label = document.createElement("div");
    label.className = "gpt2-train-label";
    label.textContent = labelTxt;
    const cells = document.createElement("div");
    cells.className = "gpt2-train-cells";
    toks.forEach((t) => {
      const c = document.createElement("div");
      c.className = "gpt2-train-cell";
      c.textContent = showSpace(t.text);
      cells.appendChild(c);
    });
    row.appendChild(label);
    row.appendChild(cells);
    return { row, cells };
  };

  const inRow = makeRow("入力  x_1…x_{T−1}", inputs, "gpt2-train-row-input");
  const tgtRow = makeRow("正解  x_2…x_T", targets, "gpt2-train-row-target");
  rows.appendChild(inRow.row);
  rows.appendChild(tgtRow.row);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "gpt2-train-arrows");
  svg.setAttribute("aria-hidden", "true");

  scroll.appendChild(rows);
  scroll.appendChild(svg);
  root.appendChild(scroll);

  const drawArrows = () => {
    svg.innerHTML = "";
    const scrollRect = scroll.getBoundingClientRect();
    const inCells = Array.from(inRow.cells.children);
    const tgtCells = Array.from(tgtRow.cells.children);
    const n = Math.min(inCells.length, tgtCells.length);
    for (let i = 0; i < n; i++) {
      const a = inCells[i].getBoundingClientRect();
      const b = tgtCells[i].getBoundingClientRect();
      const x1 = a.left + a.width / 2 - scrollRect.left;
      const y1 = a.bottom - scrollRect.top;
      const x2 = b.left + b.width / 2 - scrollRect.left;
      const y2 = b.top - scrollRect.top;
      const dy = y2 - y1;
      const cy = y1 + dy * 0.5;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2 - 6}`);
      svg.appendChild(path);
      const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      head.setAttribute("class", "gpt2-train-arrow-head");
      head.setAttribute(
        "points",
        `${x2},${y2} ${x2 - 4},${y2 - 7} ${x2 + 4},${y2 - 7}`,
      );
      svg.appendChild(head);
    }
    const w = scroll.scrollWidth;
    const h = scroll.scrollHeight;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  };

  // Defer to next frame so layout is measurable.
  requestAnimationFrame(drawArrows);
  // Webfonts change cell widths after initial layout.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(drawArrows));
  }
  // Redraw when the scroll container resizes (e.g. font load, viewport change).
  const ro = new ResizeObserver(() => drawArrows());
  ro.observe(scroll);
  // Redraw on window resize (debounced) as a belt-and-suspenders.
  if (!renderTrain._resizeBound) {
    renderTrain._resizeBound = true;
    let t;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        document.querySelectorAll('.gpt2-train-scroll').forEach((s) => {
          // no-op: ResizeObserver handles it
        });
      }, 120);
    });
  }

  renderTrainMath();
}

function renderGrad() {
  const root = document.querySelector('[data-role="grad"]');
  root.innerHTML = "";

  const flow = document.createElement("div");
  flow.className = "gpt2-grad-flow";

  // 上から loss → embed。▼ が backward の勾配の流れを表す。
  // 各ステップは「層」とその直下の「層間で渡される勾配」の 2 段構成。
  const steps = [
    {
      name: "loss",
      local: "L = −log p(x_{t+1} | x_{≤t})",
      transmit: "∂L/∂logits",
    },
    {
      name: "unembed (W_Eᵀ を掛ける)",
      local: "logits = h_12 · W_Eᵀ",
      transmit: "∂L/∂h_12",
    },
    {
      name: "Layer 12 (Block 12)",
      local: "h_12 = h_11 + Attn+MLP(LN(h_11))",
      transmit: "∂L/∂h_11",
    },
    {
      name: "… Layer 11 〜 Layer 2 …",
      local: "各ブロックで同じ形の計算",
      transmit: "∂L/∂h_1",
    },
    {
      name: "Layer 1 (Block 1)",
      local: "h_1 = x_0 + Attn+MLP(LN(x_0))",
      transmit: "∂L/∂x_0",
    },
    {
      name: "embed",
      local: "x_0 = W_E[id] + W_P[pos]",
      transmit: "ここで埋め込み行列への勾配 ∂L/∂W_E, ∂L/∂W_P が溜まる",
    },
  ];

  // 方向凡例 (上に固定表示)
  const legend = document.createElement("div");
  legend.className = "gpt2-grad-legend";
  legend.innerHTML =
    `<div><span class="gpt2-grad-dir-up">▲ forward</span> 入力 → loss (計算)</div>` +
    `<div><span class="gpt2-grad-dir-down">▼ backward</span> loss → 入力 (勾配)</div>`;
  flow.appendChild(legend);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const el = document.createElement("div");
    el.className = "gpt2-grad-step";
    el.innerHTML =
      `<div class="gpt2-grad-step-head"><strong>${s.name}</strong></div>` +
      `<div class="gpt2-grad-step-body">` +
      `<span class="gpt2-grad-step-label">forward:</span> <code>${s.local}</code>` +
      `</div>`;
    flow.appendChild(el);

    if (i < steps.length - 1) {
      const edge = document.createElement("div");
      edge.className = "gpt2-grad-edge";
      edge.innerHTML =
        `<span class="gpt2-grad-dir-down">▼</span>` +
        `<code>${s.transmit}</code>` +
        `<span class="gpt2-grad-edge-note">を下の層へ</span>`;
      flow.appendChild(edge);
    } else {
      const edge = document.createElement("div");
      edge.className = "gpt2-grad-edge gpt2-grad-edge-last";
      edge.innerHTML = `<code>${s.transmit}</code>`;
      flow.appendChild(edge);
    }
  }

  root.appendChild(flow);
}

// ---------- Part 3: loss curve ----------

async function loadLossLog() {
  const res = await fetch(`${DATA_BASE}/practice/training_log.jsonl`);
  if (!res.ok) throw new Error("failed to load training_log.jsonl");
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((l) => JSON.parse(l));
}

// best-effort eval points: parsed from kickoff log values (iter, train, val)
const EVAL_POINTS = [
  [0, 10.5456, 10.5467],
  [250, 5.6015, 5.5966],
  [500, 4.6673, 4.6756],
  [750, 3.9139, 3.9739],
  [1000, 3.6153, 3.6448],
  [1250, 3.5054, 3.5118],
  [1500, 3.3868, 3.4016],
  [1750, 3.3173, 3.3321],
  [2000, 3.2671, 3.2868],
  [2250, 3.2121, 3.2626],
  [2500, 3.1672, 3.2233],
  [2750, 3.1387, 3.1699],
  [3000, 3.1079, 3.1549],
  [3250, 3.1024, 3.1091],
  [3500, 3.0628, 3.0994],
  [3750, 3.0467, 3.0753],
  [4000, 3.0431, 3.0386],
  [4250, 3.0360, 3.0826],
  [4386, 3.0344, 3.0537],
];

async function renderLossCurve() {
  const canvas = document.querySelector('[data-role="loss-curve"]');
  if (!canvas) return;
  let log;
  try {
    log = await loadLossLog();
  } catch (err) {
    console.error("loss-curve: fetch failed", err);
    const fig = canvas.closest(".gpt2-loss-figure");
    if (fig) {
      fig.insertAdjacentHTML(
        "beforeend",
        `<p style="color:#c0392b;font-size:0.85em;">Loss curve を読み込めませんでした: ${err.message}</p>`,
      );
    }
    return;
  }

  // Determine CSS size robustly (parent width, fall back to 900)
  const parent = canvas.parentElement;
  const parentW = parent ? parent.clientWidth : 900;
  const maxW = 900;
  const cssW = Math.max(320, Math.min(parentW - 8, maxW));
  const aspect = 380 / 900; // keep a consistent shape
  const cssH = Math.round(cssW * aspect);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const css = getComputedStyle(document.documentElement);
  const colorBase = (css.getPropertyValue("--color-base") || "#586e84").trim();
  const colorLine = (css.getPropertyValue("--color-line") || "#cfd8e3").trim();
  const colorHeading = (css.getPropertyValue("--color-heading") || "#2a3540").trim();
  const trainColor = "#6ba3c7";
  const valColor = "#c0392b";

  const pad = { l: 52, r: 14, t: 14, b: 36 };
  const W = cssW;
  const H = cssH;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xMin = 0;
  const xMax = 4500;
  const yMin = 2.5;
  const yMax = 11;
  const x2px = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * plotW;
  const y2px = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  // warmup band (0..500)
  ctx.fillStyle = "rgba(180, 200, 220, 0.18)";
  ctx.fillRect(x2px(0), pad.t, x2px(500) - x2px(0), plotH);

  // gridlines + y labels
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = colorBase;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = colorLine;
  ctx.lineWidth = 1;
  for (const y of [3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const py = y2px(y);
    ctx.beginPath();
    ctx.moveTo(pad.l, py);
    ctx.lineTo(W - pad.r, py);
    ctx.stroke();
    ctx.fillText(y.toFixed(0), pad.l - 6, py);
  }
  // x labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const x of [0, 1000, 2000, 3000, 4000]) {
    const px = x2px(x);
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, H - pad.b);
    ctx.strokeStyle = colorLine;
    ctx.stroke();
    ctx.fillStyle = colorBase;
    ctx.fillText(String(x), px, H - pad.b + 6);
  }

  // axis labels
  ctx.fillStyle = colorHeading;
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("iter", W / 2, H - 16);
  ctx.save();
  ctx.translate(14, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("loss", 0, 0);
  ctx.restore();

  // train loss line (every-10-iter samples; thin)
  ctx.beginPath();
  ctx.strokeStyle = trainColor;
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.55;
  let started = false;
  for (const e of log) {
    const x = e.iter;
    const y = e.loss;
    if (y === undefined || x === undefined) continue;
    const px = x2px(x);
    const py = y2px(Math.min(y, yMax));
    if (!started) { ctx.moveTo(px, py); started = true; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // smoothed train (window=20)
  const smoothW = 20;
  const losses = log.map((e) => e.loss);
  const iters = log.map((e) => e.iter);
  ctx.beginPath();
  ctx.strokeStyle = trainColor;
  ctx.lineWidth = 2.2;
  for (let i = smoothW; i < losses.length; i++) {
    let s = 0;
    for (let k = i - smoothW; k < i; k++) s += losses[k];
    const avg = s / smoothW;
    const px = x2px(iters[i]);
    const py = y2px(Math.min(avg, yMax));
    if (i === smoothW) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // val loss line (eval points)
  ctx.beginPath();
  ctx.strokeStyle = valColor;
  ctx.lineWidth = 2.2;
  for (let i = 0; i < EVAL_POINTS.length; i++) {
    const [x, , v] = EVAL_POINTS[i];
    const px = x2px(x);
    const py = y2px(Math.min(v, yMax));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // val dots
  ctx.fillStyle = valColor;
  for (const [x, , v] of EVAL_POINTS) {
    ctx.beginPath();
    ctx.arc(x2px(x), y2px(Math.min(v, yMax)), 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // legend
  const lg = { x: W - pad.r - 170, y: pad.t + 8, w: 162, lh: 16 };
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.strokeStyle = colorLine;
  ctx.fillRect(lg.x, lg.y, lg.w, lg.lh * 3 + 4);
  ctx.strokeRect(lg.x, lg.y, lg.w, lg.lh * 3 + 4);
  ctx.fillStyle = trainColor;
  ctx.fillRect(lg.x + 8, lg.y + 6, 18, 2.5);
  ctx.fillStyle = colorHeading;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("train loss (10 iter)", lg.x + 32, lg.y + 8);
  ctx.fillStyle = valColor;
  ctx.fillRect(lg.x + 8, lg.y + 6 + lg.lh, 18, 2.5);
  ctx.beginPath();
  ctx.arc(lg.x + 17, lg.y + 7 + lg.lh, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colorHeading;
  ctx.fillText("val loss (250 iter)", lg.x + 32, lg.y + 8 + lg.lh);
  ctx.fillStyle = "rgba(180, 200, 220, 0.5)";
  ctx.fillRect(lg.x + 8, lg.y + 6 + lg.lh * 2, 18, 8);
  ctx.fillStyle = colorHeading;
  ctx.fillText("warmup (~500)", lg.x + 32, lg.y + 8 + lg.lh * 2);
}

// ---------- selection / wiring ----------

async function selectPrompt(slug) {
  state.currentSlug = slug;
  state.trace = await loadTrace(slug);
  state.attnLayer = 0;
  state.attnHead = 0;
  state.genStep = 0;
  state.genPlaying = false;
  state.embedFocus = 0;
  state.tokFocus = null;
  document.querySelector('[data-role="attn-layer"]').value = 0;
  document.querySelector('[data-role="attn-head"]').value = 0;
  document.querySelector('[data-role="gen-step"]').value = 0;
  document.querySelector('[data-role="gen-step"]').max = state.trace.generation.length;
  renderAll();
}

function renderAll() {
  renderPromptPicker();
  renderTokens();
  renderEmbed();
  renderAttention();
  renderStack();
  renderSamplingBars();
  renderGeneration();
  renderTrain();
  renderGrad();
}

function wireControls() {
  const al = document.querySelector('[data-role="attn-layer"]');
  al.addEventListener("input", () => {
    state.attnLayer = +al.value;
    renderAttention();
  });
  const ah = document.querySelector('[data-role="attn-head"]');
  ah.addEventListener("input", () => {
    state.attnHead = +ah.value;
    renderAttention();
  });
  const temp = document.querySelector('[data-role="temp"]');
  temp.addEventListener("input", () => {
    state.temperature = +temp.value;
    renderSamplingBars();
  });
  const topk = document.querySelector('[data-role="topk"]');
  topk.addEventListener("input", () => {
    state.topK = +topk.value;
    renderSamplingBars();
  });
  const topp = document.querySelector('[data-role="topp"]');
  topp.addEventListener("input", () => {
    state.topP = +topp.value;
    renderSamplingBars();
  });

  const gstep = document.querySelector('[data-role="gen-step"]');
  gstep.addEventListener("input", () => {
    state.genStep = +gstep.value;
    renderGeneration();
  });
  const play = document.querySelector('[data-role="gen-play"]');
  const reset = document.querySelector('[data-role="gen-reset"]');
  play.addEventListener("click", async () => {
    if (state.genPlaying) return;
    state.genPlaying = true;
    play.disabled = true;
    state.genStep = 0;
    const total = state.trace.generation.length;
    for (let i = 0; i <= total; i++) {
      state.genStep = i;
      gstep.value = i;
      renderGeneration();
      await new Promise((r) => setTimeout(r, 450));
      if (!state.genPlaying) break;
    }
    state.genPlaying = false;
    play.disabled = false;
  });
  reset.addEventListener("click", () => {
    state.genPlaying = false;
    state.genStep = 0;
    gstep.value = 0;
    renderGeneration();
  });
}

async function init() {
  try {
    state.index = await loadIndex();
    state.currentSlug = state.index.prompts[0].slug;
    state.trace = await loadTrace(state.currentSlug);
    document.querySelector('[data-role="gen-step"]').max = state.trace.generation.length;
    wireControls();
    renderAll();
    renderLossCurve();
    window.addEventListener("resize", () => {
      clearTimeout(window.__lossResizeT);
      window.__lossResizeT = setTimeout(renderLossCurve, 150);
    });
  } catch (err) {
    console.error(err);
    document.querySelector(".gpt2-doc").insertAdjacentHTML(
      "afterbegin",
      `<p style="background:#fee;padding:1em;border-radius:6px;">データの読み込みに失敗しました: ${err.message}</p>`
    );
  }
}

init();
