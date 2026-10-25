# @hoox-sh/hoox-mcp

MCP server for the Hoox CLI. It builds one tool per runnable `hoox` command from the live Commander tree, then adds five operator features around that surface.

Run it from a Hoox checkout:

```bash
bun run mcp
# or
bun packages/mcp/bin/hoox-mcp.js
```

The process speaks MCP over stdin and stdout. Logs go to stderr.

```json
{
  "mcpServers": {
    "hoox": {
      "command": "bun",
      "args": ["packages/mcp/bin/hoox-mcp.js"]
    }
  }
}
```

This repo already registers that command in `opencode.jsonc`.

## Tools

Every command that has an action becomes `hoox_<path>`, for example `hoox_deploy_all` and `hoox_monitor_kill_switch_show`. Each call runs `hoox` with `--json --no-color`. Arguments are an argv array. The server never invokes a shell. `--quiet` is not sent, because it drops the JSON document.

## Advanced features

1. **Live catalog.** `hoox_catalog` and `hoox_describe` read the Commander program, so a new CLI command shows up as a tool without a second hand-written list. The same data is the `hoox://commands` resource.
2. **Confirm gate.** Mutating commands return `confirm_token` and do not run. Call the same tool again with `confirm`, or mint the token with `hoox_plan`. The token is an HMAC over the argv, cwd, and a hash of any stdin payload (Pine script or secret). The secret and the script are not stored in the token. It expires after 10 minutes. `--dry-run` is treated as read-only. `--fix`, `--fix-runtime`, `--install-deps`, `--provision`, and `--allow-destructive` upgrade a read into a mutation. `db reset` adds `--confirm` after the token verifies; callers still pass the HMAC as `confirm`. `HOOX_MCP_ALLOW_MUTATIONS=1` skips the token on a trusted local process.
3. **Redacting runner.** Results include exit code, duration, stdout, stderr, parsed JSON when the output is JSON, and a next-command suggestion. ANSI is stripped. Labeled secrets, common token shapes, JSON string values, and `.env` lines are replaced with `[REDACTED]` when the name looks like a secret or is marked secret in the env catalog. `config kv get` JSON `{"key","value"}` redacts `value`. `secrets set` takes `secret_value` on stdin so the value is not an argv entry. Newlines in `secret_value` are rejected.
4. **`hoox_snapshot`.** One read-only bundle: `doctor`, `schema validate`, `schema list`, and `repair check --no-typecheck`. `remote: true` adds `check health`, `workers list`, `monitor kill-switch show`, and `tunnel check`.
5. **`hoox_advise`.** Returns the CLI's next-step suggestion plus a workspace brief (wrangler file, CLI version, worker names, and whether each worker has a `.dev.vars` file). It does not read secret file contents.

`hoox tui`, `hoox dev …`, `hoox dashboard dev`, and `hoox workers dev` / `workers logs` are refused. They need a terminal or they stream until killed. Use `hoox_logs_worker` instead of `workers logs`; it passes `--no-follow` unless `follow` is true.

These also refuse, and are not spawned, when they would block on a prompt:

- `init` and `onboard` unless both `token` and `account` are set
- `config env init` (it prompts for every variable; `--yes` only skips overwrite)
- `deploy dashboard` unless `rebuild` is true
- `deploy rollback` unless the `version` argument is set

Prompts: `triage` and `deploy-checklist`. Policy text: `hoox://policy`.
