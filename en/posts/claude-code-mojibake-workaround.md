---
title: "[Resolved?] A Quick Workaround for Claude Code's Mojibake Issue"
description: "A temporary hooks-based workaround for the U+FFFD corruption that sometimes appears when Claude Code writes Japanese (and other CJK) text via Write/Edit."
date: 2026-04-07
tags: [Claude Code, Unicode, Claude Code Hooks, mojibake]
author: 逆瀬川ちゃん
lang: en
---

Hi there! This is Sakasegawa-chan ([@gyakuse](https://x.com/gyakuse))!

Today I want to walk through a mojibake (character corruption) issue that shows up when writing Japanese on recent versions of Claude Code, along with a simple workaround using hooks.

**Update 2026-04-08**: The [Changelog](https://code.claude.com/docs/en/changelog#2-1-94) says this issue was fixed in Claude Code v2.1.94, but there are [reports that it still isn't fully resolved](https://x.com/o_sio/status/2041695321802338495). I recommend keeping the hook in place for now. I also switched the hook back from `PreToolUse` to `PostToolUse`, because PostToolUse only has to repair the corrupted spots after the fact, which costs fewer tokens to fix.

<!--more-->

## What's happening

When you have Claude Code write code or docs that contain Japanese, the content written to disk via `Write` or `Edit` sometimes ends up with `�` (U+FFFD, the Unicode Replacement Character) mixed in.

Concretely, it looks like this:

- `タスクワー��ー` ← should be "タスクワーカー" (task worker)
- `プラ���トフォーム` ← should be "プラットフォーム" (platform)
- `ア��セス` ← should be "アクセス" (access)

A multibyte character's byte sequence gets truncated somewhere in the middle, and the broken piece is replaced with the Replacement Character. It happens especially often with CJK characters (Japanese, Chinese, Korean).

The cause is believed to be in Claude Code's internal SSE streaming decoder. The Anthropic SDK calls `TextDecoder.decode()` without `{ stream: true }`, so when a multibyte character's byte sequence gets split across SSE chunk boundaries, the incomplete bytes are replaced by U+FFFD. [GitHub Issue #43746](https://github.com/anthropics/claude-code/issues/43746) identifies the root cause and includes a reproduction.

There isn't any user-side setting that fully prevents this. Sigh...

That said, having your output corrupted while you wait for a fix is rough, so let's use Claude Code's hooks feature to put in a temporary countermeasure: right after a write, detect U+FFFD and reject it.

## Rejecting mojibake with hooks

Claude Code has a hooks mechanism that lets you run shell scripts before or after tool invocations. This time we'll use a `PostToolUse` hook that, **after** `Write`/`Edit`/`MultiEdit` writes to a file, inspects the file's contents and prompts Claude to repair it if U+FFFD is present.

### Why PostToolUse?

You could do this as either a `PreToolUse` (block before writing) or a `PostToolUse` (detect after writing), but `PostToolUse` has a **smaller token cost for repair**. If you block the write with PreToolUse, Claude tends to rewrite the whole file; with PostToolUse, Claude just needs to `Edit` the specific corrupted spots in the already-written file.

### Prepare the hook script

First, create the script.

```bash
#!/bin/bash
# ~/.claude/hooks/check-mojibake.sh
# PostToolUse: if a file written by Write/Edit/MultiEdit contains U+FFFD, prompt for a repair

INPUT=$(cat)

# Get the target file path from tool_input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

if [ -f "$FILE_PATH" ] && grep -q $'\xef\xbf\xbd' "$FILE_PATH"; then
  echo "U+FFFD detected in $FILE_PATH. Fix the corrupted characters." >&2
  grep -n $'\xef\xbf\xbd' "$FILE_PATH" | head -5 >&2
  exit 2
fi
```

The key part is `exit 2`. In Claude Code hooks, exit code 2 is treated as a failure and the contents of stderr are fed back to Claude. Returning `exit 2` from PostToolUse gets Claude to locate the broken spots and repair them with `Edit`.

`$'\xef\xbf\xbd'` is the UTF-8 byte sequence for U+FFFD, and that's what grep is looking for. `jq` pulls the `file_path` out of the tool input, and we check the actual file on disk directly.

### Register it in settings.json

Add the hook to `~/.claude/settings.json`.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/check-mojibake.sh"
          }
        ]
      }
    ]
  }
}
```

By setting `matcher` to `Write|Edit|MultiEdit`, the hook runs for every file-writing tool.

### Copy-paste setup

Here's a copy-paste-ready snippet.

```bash
# Create the directory
mkdir -p ~/.claude/hooks

# Create the hook script
cat << 'SCRIPT' > ~/.claude/hooks/check-mojibake.sh
#!/bin/bash
# PostToolUse: if a file written by Write/Edit/MultiEdit contains U+FFFD, prompt for a repair

INPUT=$(cat)

# Get the target file path from tool_input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

if [ -f "$FILE_PATH" ] && grep -q $'\xef\xbf\xbd' "$FILE_PATH"; then
  echo "U+FFFD detected in $FILE_PATH. Fix the corrupted characters." >&2
  grep -n $'\xef\xbf\xbd' "$FILE_PATH" | head -5 >&2
  exit 2
fi
SCRIPT

chmod +x ~/.claude/hooks/check-mojibake.sh
```

If you already have a `settings.json`, just add the `hooks` key to it.

## What this covers and what it doesn't

This is only a stopgap. Let's be clear about the coverage.

| Case | Covered? |
|---|---|
| Mojibake in files written by Write/Edit/MultiEdit | Yes |
| Mojibake in Claude's response text itself | No |
| U+FFFD inside external search results or OCR output | No |
| Reading an already-corrupted existing file | No |

Corruption on the file-write path is the most damaging because it breaks real files, and this workaround pinpoints exactly that. Meanwhile, cases where Claude's own response text is corrupted (like a "でき��した" display glitch) can't be prevented by hooks.

## Waiting for the upstream fix

This is a temporary workaround. The root cause lies in the Anthropic SDK's SSE decoder: a missing `{ stream: true }` on `TextDecoder`, which users can't fully prevent on their side.

[GitHub Issue #43746](https://github.com/anthropics/claude-code/issues/43746) has the root-cause analysis, reproduction steps, and even a proposed patch. If you're hitting the same issue, throw a reaction on the issue. Related reports are also accumulating at [#44463](https://github.com/anthropics/claude-code/issues/44463) and [#43858](https://github.com/anthropics/claude-code/issues/43858).

Think of the hook workaround as a way to keep `Write` (and friends) from breaking until the fix lands.

## Wrap-up

- The mojibake issue with `Write`/`Edit` in Claude Code can be worked around temporarily by detecting U+FFFD with a `PostToolUse` hook and asking Claude to repair it
- Some cases (like mojibake in the response text itself) can't be handled by hooks
- Ultimately, just wait for the Claude Code update with the real fix ([#43746](https://github.com/anthropics/claude-code/issues/43746) has the root cause analysis and proposed patch)

## References

- Claude Code
    - [Claude Code Hooks docs](https://docs.anthropic.com/en/docs/claude-code/hooks)
    - [Claude Code GitHub](https://github.com/anthropics/claude-code)
- Related Issues
    - [#43746 Silent U+FFFD corruption in CJK model output due to TextDecoder missing `{ stream: true }` in SSE line decoder](https://github.com/anthropics/claude-code/issues/43746)
    - [#44463 Japanese characters occasionally corrupted in output (file writes and terminal)](https://github.com/anthropics/claude-code/issues/44463)
    - [#43858 Japanese (CJK) characters occasionally corrupted in model output (mojibake)](https://github.com/anthropics/claude-code/issues/43858)
    - [#40396 Korean (CJK) characters corrupted to U+FFFD in Claude Code responses](https://github.com/anthropics/claude-code/issues/40396)
