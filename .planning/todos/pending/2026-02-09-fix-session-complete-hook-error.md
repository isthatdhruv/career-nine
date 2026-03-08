---
created: 2026-02-09T11:14
title: Fix session-complete hook error
area: tooling
files:
  - ${CLAUDE_PLUGIN_ROOT}/scripts/worker-service.cjs
---

## Problem

The Claude Code hook system is throwing an error when the `session-complete` event is triggered:

```
Hook error: Error: Unknown event type: session-complete
```

This occurs with the hook configuration:
- Hook script: `${CLAUDE_PLUGIN_ROOT}/scripts/worker-service.cjs`
- Runner: `${CLAUDE_PLUGIN_ROOT}/scripts/bun-runner.js`
- Event: `session-complete`

The error suggests that the `worker-service.cjs` script doesn't recognize or handle the `session-complete` event type, even though it's being registered as a hook.

This may be causing:
- Failed hook executions at session end
- Potential data not being saved/processed
- Error messages appearing to users

## Solution

**RESOLVED** - Removed the unsupported hook.

Root cause: The hooks.json file was configured to call `session-complete` event, but the compiled worker-service.cjs only supports: `context`, `session-init`, `observation`, `summarize`, `user-message`, `file-edit`.

The `session-complete` handler exists in the source code but hasn't been compiled into the distributed worker-service.cjs yet (version mismatch in claude-mem plugin v9.0.17).

Fixed by removing the unsupported hook from:
- `/home/kccsw/.claude/plugins/marketplaces/thedotmack/plugin/hooks/hooks.json`

The `summarize` hook already handles session completion properly, so no functionality is lost.
