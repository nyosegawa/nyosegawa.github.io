---
title: "Building a Remote Claude Code Dev Environment with Mac × WSL × Android"
description: "How I built a remote dev environment that lets me drive Claude Code from three devices using Ghostty + tmux + happy-coder, plus the security audit I ran on it."
date: 2026-02-13T15:00:00
tags: [Claude Code, Ghostty, tmux, happy-coder, WSL, Remote Dev]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa ([@gyakuse](https://x.com/gyakuse))!

Today I want to walk through how I built a remote dev environment that lets me drive Claude Code from three devices: a Mac, WSL on Windows, and Android. The combination of Ghostty, tmux, and happy-coder ended up working out really nicely, so I'll cover everything from the setup to the results of a security audit I ran on it.

<!--more-->

## The problem: dev environments are stuck on a single machine

When you're working with Claude Code, you often run into situations like "I want to check the current session from my phone" or "I want to pick up where I left off from another machine."

Concretely, scenarios like these:

- You started Claude Code on your Mac and are working away, but you'd like to be able to approve things from Android while out and about
- Your Windows machine has a GPU on it, so you'd like to run heavy workloads inside its WSL instance, but operate it from your Mac
- You'd like to fire off "go ahead and apply that fix" instructions from Android while sitting on the couch

In short, you want to decouple the dev session from any one device. Claude Code is a terminal app, so unlike a browser-based tool you can't just hit a URL to access it. The approach this time is to persist the session with SSH + tmux, and use happy-coder to operate it from mobile.

So let's look at the pieces we need to make this work.

## The overall architecture

The final setup looks like this.

```
┌─────────────┐     SSH (Tailscale)     ┌──────────────────────┐
│   Mac        │ ──────────────────────→ │   WSL (Windows)      │
│  Ghostty     │                         │  ┌─────────────────┐ │
│              │                         │  │ tmux session     │ │
└─────────────┘                         │  │  └─ Claude Code  │ │
                                         │  └─────────────────┘ │
┌─────────────┐   E2E encrypted relay    │  ┌─────────────────┐ │
│  Android     │ ◄──────────────────────→│  │ happy daemon     │ │
│  Happy App   │                         │  └─────────────────┘ │
└─────────────┘                         └──────────────────────┘
```

Three things to note here.

- The Mac → WSL connection is plain SSH. With Tailscale you can reach across LANs as well
- A tmux session on WSL persists everything. Even if SSH drops, Claude Code keeps running
- Android talks to Claude Code through an end-to-end encrypted relay server

Let's go through each piece in turn.

## Ghostty: a modern terminal that's good at SSH

For the terminal emulator, I'm using [Ghostty](https://ghostty.org/). It's a GPU-accelerated terminal written in Zig by HashiCorp founder Mitchell Hashimoto.

I went with Ghostty because it's strong at SSH-based development, in two specific ways.

### OSC 52 clipboard support

OSC 52 is a terminal escape sequence that lets a program on a remote machine copy text into the local system clipboard.

Why is that nice? Because when you select text inside tmux on a remote SSH host, it gets copied straight to your Mac's clipboard. No more manually re-copying things by hand. Ghostty supports OSC 52 natively, so it works without any configuration.

### Automatic terminfo distribution

If your SSH target doesn't have Ghostty's terminfo, you'll get an error like `missing or unsuitable terminal: xterm-ghostty`. I tripped over that one myself early on.

Ghostty 1.2.0 added an SSH integration feature: if you put the following in your config, Ghostty will automatically push terminfo to remote hosts when you SSH into them.

```
# ~/.config/ghostty/config
shell-integration-features = ssh-terminfo,ssh-env
```

`ssh-terminfo` does the auto-distribution, and `ssh-env` sets up a TERM fallback (it falls back to `xterm-256color` if installing terminfo fails).

If you want to do it by hand, export terminfo on the Mac side and ship it over.

```bash
# On the Mac
TERMINFO=/Applications/Ghostty.app/Contents/Resources/terminfo \
  infocmp xterm-ghostty > /tmp/ghostty.terminfo
scp /tmp/ghostty.terminfo wsl:/tmp/

# On the WSL side
tic -x /tmp/ghostty.terminfo
```

After this, `xterm-ghostty` works on the remote, with proper 256 colors plus modern text styling like italics and undercurl.

OK, now that the terminal is set up, let's move on to session persistence.

## tmux: session persistence and clipboard integration

tmux is a terminal multiplexer that keeps your session alive even when SSH disconnects. For long-running processes like Claude Code, it's essential.

### Basic config

My `~/.tmux.conf` on WSL looks like this.

```bash
# Enable mouse (pane selection, resize, scroll, text selection)
set -g mouse on

# OSC 52 clipboard integration
set -g set-clipboard on

# Modern terminal settings
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-ghostty:RGB"
```

A walk-through of each line.

`set -g mouse on` enables mouse support. With just this, you get clickable pane selection, draggable border resizing, scroll wheel, and text selection.

`set -g set-clipboard on` is the OSC 52 hookup. When you yank text in tmux's copy-mode, it goes into the tmux buffer and an OSC 52 escape sequence is also passed through to the parent terminal (Ghostty), which copies it into the Mac's system clipboard. That's why you can select text inside tmux on a remote host and paste it locally with Cmd+V.

For `default-terminal`, use `tmux-256color`. People used to set `screen-256color`, but `tmux-256color` supports modern features like italics and RGB colors, and is the recommended choice today.

The last `terminal-overrides` line enables Ghostty's RGB (truecolor) support.

### tmux-256color vs screen-256color

The difference is subtle but matters, so here it is in a table.

| Item | tmux-256color | screen-256color |
|---|---|---|
| Italic text | Supported | Not supported |
| Key sequence recognition | Recognizes more sequences | Some not recognized |
| Portability | Needs a recent ncurses | Works in older environments |
| Recommendation | Recommended on modern systems | For legacy environments |

On WSL or any modern Linux distro, `tmux-256color` is fine. On something like an older CentOS, fall back to `screen-256color`.

### A dev-tmux script

I wrote a small script for managing the dev session on WSL.

```bash
#!/usr/bin/env bash
# ~/bin/dev-tmux: start/manage the WSL dev environment's tmux session
set -euo pipefail

SESSION_DEV="dev"

start_session() {
  # Check happy daemon status (for Android integration; auto-started by `happy`)
  if command -v happy &>/dev/null; then
    happy daemon status 2>/dev/null || true
  fi
  # Create the tmux session
  if ! tmux has-session -t "$SESSION_DEV" 2>/dev/null; then
    tmux new-session -d -s "$SESSION_DEV" -c "$HOME"
    echo "  [dev] started"
  else
    echo "  [dev] already running"
  fi
}

attach_session() {
  start_session
  tmux attach-session -t "$SESSION_DEV"
}

stop_session() {
  tmux kill-session -t "$SESSION_DEV" 2>/dev/null && echo "  [dev] stopped" || true
  if command -v happy &>/dev/null; then
    happy daemon stop 2>/dev/null || true
  fi
}

status() {
  echo "=== tmux ==="
  tmux ls 2>/dev/null || echo "  no sessions"
  echo "=== happy daemon ==="
  happy daemon status 2>/dev/null || echo "  not running"
}

case "${1:-start}" in
  start)   start_session ;;
  attach)  attach_session ;;
  stop)    stop_session ;;
  status)  status ;;
  *)       echo "Usage: dev-tmux {start|attach|stop|status}" ;;
esac
```

To call it from the Mac over SSH:

```bash
# Start a session (SSH + attach)
ssh wsl -t 'dev-tmux attach'

# Just check status
ssh wsl 'dev-tmux status'
```

There's one gotcha here. WSL's `.bashrc` typically has its PATH configuration written *after* the `# If not running interactively, don't do anything` guard. With a non-interactive call like `ssh wsl 'dev-tmux status'`, PATH never gets set up and you'll hit `command not found`. The fix is to add the PATH line *before* the interactive guard in `.bashrc`.

```bash
# ~/.bashrc (near the top, before the case statement)
export PATH="$HOME/bin:$PATH"
```

At this point you have a stable way to reach Claude Code on WSL from your Mac. Next up, accessing it from Android.

## happy-coder: drive Claude Code from your phone

[happy-coder](https://github.com/slopus/happy) is a mobile/web client for Claude Code. It lets you operate Claude Code sessions from a smartphone app. The OSS project has about 5.7k GitHub stars.

### Install and connect

```bash
# Install on WSL
npm install -g happy-coder

# Start a session (a QR code shows up)
happy
```

The first time you run `happy`, it shows a QR code in the terminal — scan it with the Happy Coder app on Android. That's pairing done.

### Daemon auto-start

Running the `happy` command auto-starts the daemon in the background. You don't need to call `happy daemon start` explicitly.

```bash
# Check status
happy daemon status

# Stop the daemon
happy daemon stop
```

Once the daemon is running, opening the Android app is enough to reach the Claude Code session on WSL. You don't need to run `happy` inside tmux — the daemon listens for Android connections independently.

### What you can do

From the Android app you can:

- Send messages to Claude Code (text or voice input)
- Approve/reject tool execution (delivered as push notifications to your phone)
- Switch sessions (manage multiple Claude Code sessions)
- Specify a working directory

When you're out and about, push notifications like "Bash execution requires approval" come in, you check the contents, and one tap approves it. This turns out to be surprisingly handy: you can have Claude Code chew on a long task while you move around.

### Security: how E2E encryption is implemented

happy-coder implements end-to-end encryption — by design, the relay server can't read chat contents. I actually audited the source to confirm.

The encryption setup looks like this.

1. Devices exchange public keys out-of-band via the QR code
2. Key exchange uses tweetnacl (Curve25519 + XSalsa20 + Poly1305)
3. Session data is encrypted with AES-256-GCM (authenticated encryption) before transmission
4. The relay server just stores and forwards the encrypted bytes as-is

Because there's a physical step of scanning a QR code, this is also resistant to network-level man-in-the-middle attacks. It's similar in spirit to verifying an SSH key fingerprint.

Credentials are saved to `~/.happy/agent.key` as JSON. The file permissions are set to 0600 (owner read/write only), so even on a multi-user machine other users can't read it.

### Security: things to watch out for

The audit also surfaced a few concerning items.

| Risk | Details |
|---|---|
| Critical | The vendor API key registration feature (OpenAI etc.) isn't E2E — keys are encrypted on the server side |
| High | The local daemon's HTTP server (bound to 127.0.0.1) has no authentication |
| High | A `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` env var exists, which sends debug logs to the server |
| Critical | The mobile app can send `permissionMode: 'yolo'`, bypassing Claude Code's permission approval |
| High | `customSystemPrompt` / `appendSystemPrompt` get passed to the Claude CLI without sanitization |

The permission-related one is a design-level concern in particular. If a mobile device gets compromised, an attacker could bypass Claude Code's safety controls and run arbitrary commands.

That said, a realistic risk assessment should consider the following.

- An attack requires compromising a *paired* mobile device first (E2E encryption rules out network sniffing)
- Tampering control messages from the relay server isn't possible either (the meta field is part of the encrypted payload)
- For personal dev use, if you're managing your own phone properly the practical risk is low

Recommended mitigations:

- Don't use the vendor API key registration feature (`happy connect`). Manage API keys via local environment variables instead
- Maintain device security on your Android (screen lock, don't install sketchy apps)
- If you want to self-host happy-coder's server, [Happy Server](https://github.com/slopus/happy) is open source

While we're here, let me cover an alternative tool too.

## Alternative: hapi

[hapi](https://github.com/tiann/hapi) is an OSS project being developed as an alternative to happy-coder, with about 1.5k GitHub stars. The design philosophy is different, so let's compare them.

| Item | happy-coder | hapi |
|---|---|---|
| Design philosophy | Cloud-hosted, multi-user | Local-first, single-user |
| Communication encryption | E2E (via relay server) | WireGuard + TLS (direct connection) |
| Security model | Untrusted server assumed | You manage the server yourself |
| Deployment | npm install + scan QR in app | One-command, but needs network setup |
| Supported AIs | Claude Code, Codex, Gemini CLI | Claude Code, Codex, Gemini, OpenCode |
| License | MIT | AGPL-3.0 |

What stands out about hapi is its WireGuard-based direct connection. There's no relay server in between; devices connect directly to each other. If you're already on Tailscale, you can combine it as the underlying hub.

happy-coder, on the other hand, is easier to start using casually. npm install plus QR scan and you're done. It depends on a relay server, but since it's E2E encrypted the server can't read anything.

I'm on Tailscale myself so hapi probably plays well with my setup, but happy-coder hasn't given me any trouble so I keep using it. If you don't want to mess with network settings, happy-coder is the easier choice.

## Putting it together: my actual dev flow

Let me show you how I actually use these tools together day-to-day.

### Working from the Mac

```bash
# 1. SSH to WSL and attach to the tmux session
ssh wsl -t 'dev-tmux attach'

# 2. Inside tmux, start Claude Code
claude

# 3. When done, detach tmux (Ctrl+B, D)
# Claude Code keeps running in the background

# 4. Reattach later
ssh wsl -t 'tmux attach -t dev'
```

Using tmux pane splits, you can run multiple Claude Code sessions in parallel.

```bash
# Inside tmux, split horizontally
# Ctrl+B, "

# In the new pane, start Claude Code in another directory
cd ~/src/github.com/nyosegawa/another-project
claude
```

### Working from Android

```
1. Open the Happy Coder app
2. The happy daemon on WSL is auto-discovered
3. Pick the Claude Code session you want to operate from the list
4. Send a message or approve a tool call
```

A common usage pattern: "Start a big refactor on the Mac → leave the house → check progress and approve from Android → come home and check the result on the Mac." When Claude Code asks for tool execution approval, you get a push notification, so work doesn't stall while you're moving around.

### Session management tips

Claude Code has a `--resume` option, so you can pick up an interrupted session.

```bash
# Resume the most recent session
claude --continue

# Resume a specific session by ID
claude --resume <session-id>

# Pick from a list of sessions
claude --resume
```

Combining tmux's session persistence with Claude Code's session resume means you don't lose Claude Code's context even if SSH disconnects.

### Why develop on WSL?

You might wonder: "Why not just run Claude Code locally on the Mac?" Two reasons.

First is the GPU. The Windows machine has an NVIDIA GPU, and I want to use it via WSL when running local LLMs or CUDA-based tools.

Second is session persistence. Claude Code on the Mac dies when you close the terminal, but tmux on WSL keeps running indefinitely. Even if I put my Mac to sleep, the session stays alive. The happy daemon is also resident on WSL, so I can hit it from Android any time.

## Ghostty + tmux config summary

Finally, here are the config files all in one place. They're meant to be pasted in directly.

### Mac side: Ghostty config

```
# ~/.config/ghostty/config
shell-integration-features = ssh-terminfo,ssh-env
```

### WSL side: tmux config

```bash
# ~/.tmux.conf
set -g mouse on
set -g set-clipboard on
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-ghostty:RGB"
```

### WSL side: .bashrc PATH setup

```bash
# ~/.bashrc (added before the interactive guard)
export PATH="$HOME/bin:$PATH"

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac
```

### WSL side: happy-coder setup

```bash
# Install Node.js (fnm recommended)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install --lts

# Install happy-coder
npm install -g happy-coder

# First-time auth (shows a QR code; daemon auto-starts too)
happy
```

## Summary

- The Ghostty + tmux + OSC 52 combo gives you a modern remote dev experience over SSH, including clipboard sharing
- happy-coder's E2E encryption is implemented properly, but the API key registration feature and the permissionMode operation are design-level concerns. For personal use, device hygiene covers it
- The alternative, hapi, uses WireGuard-based direct connections. Especially nice if you're already on Tailscale

## Appendix: detailed happy-coder security audit

Details for the security findings touched on in the main text. Based on a full source-code analysis using [Gemini 3 Pro](https://deepmind.google/technologies/gemini/).

### E2E encryption implementation

- Key exchange: tweetnacl.box (Curve25519 + XSalsa20 + Poly1305)
- Data encryption: AES-256-GCM (authenticated encryption)
- Key exchange happens out-of-band via QR code. Stealing keys via network eavesdropping isn't possible
- Metadata (permissionMode, appendSystemPrompt, etc.) is also part of the E2E payload, so the relay server can't tamper with it

### Local daemon design

- Bound to `127.0.0.1` (not reachable from external networks)
- The HTTP server has no authentication. Other processes on the same machine can `POST http://127.0.0.1:<port>/spawn-session` to create a session in any directory
- Practically low risk in a personal WSL environment, but be careful on shared machines

### Instruction injection

- `customSystemPrompt` / `appendSystemPrompt`: if included in the meta field of a message from mobile, they're passed unsanitized to Claude CLI's `--system-prompt` / `--append-system-prompt` arguments
- `permissionMode`: sending `'yolo'` translates to `--permission-mode bypassPermissions`, which skips user approval at tool execution
- MCP server injection isn't possible (there's no logic to set mcpServers from the meta field)
- On Unix systems, `spawn` is called with array form, so shell injection doesn't happen (but be careful: there are spots on Windows where `shell: true` is used)

### Credential storage

- Location: `~/.happy/agent.key` (JSON format)
- Directory: permissions 0700
- File: permissions 0600
- The private key is base64-encoded but not encrypted (same model as an SSH private key)

## References

- Ghostty
    - [Ghostty official site](https://ghostty.org/)
    - [Ghostty on GitHub](https://github.com/ghostty-org/ghostty)
    - [1.2.0 release notes (SSH integration)](https://ghostty.org/docs/install/release-notes/1-2-0)
    - [Terminfo docs](https://ghostty.org/docs/help/terminfo)
- tmux
    - [tmux on GitHub](https://github.com/tmux/tmux)
    - [tmux Clipboard Wiki](https://github.com/tmux/tmux/wiki/Clipboard)
    - [tmux FAQ](https://github.com/tmux/tmux/wiki/FAQ)
- happy-coder
    - [happy-coder on GitHub](https://github.com/slopus/happy)
    - [Happy Coder official site](https://happy.engineering/)
- hapi
    - [hapi on GitHub](https://github.com/tiann/hapi)
- Claude Code
    - [Claude Code official docs](https://code.claude.com/docs/en/headless)
    - [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
    - [Claude Code on GitHub](https://github.com/anthropics/claude-code)
- Networking
    - [Tailscale](https://tailscale.com/)
