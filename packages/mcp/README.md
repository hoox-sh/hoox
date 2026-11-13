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

## Code Mode (opt-in)

Set `HOOX_MCP_CODE_MODE=1` to trade the per-command context cost for two tools. Every existing tool stays registered; Code Mode only appends `search` and `execute`. With the flag unset the tool list is byte-identical to the previous release, so existing clients see no change.

| Tool      | What it does                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`  | Runs an async arrow function against a compact `catalog` array (`path`, `tool`, `risk`, `summary`, `destructive`, `local`, `action`, `args`, `flags`) and returns only the rows the code selects. Full schemas never enter context. |
| `execute` | Runs an async arrow function with `hoox.run(pathOrTool, args)`, `hoox.describe(path)`, `hoox.advise()`, `hoox.snapshot()`, and `hoox.policy()`. It composes calls, paginates, and returns only the data it needs.                   |

Both take one `code` string:

```json
{
  "code": "async () => catalog.filter((e) => e.risk === 'read').map((e) => e.path)"
}
```

`execute` is not a policy bypass. Every `hoox.run` goes through the same `executeEntry` path as the direct tool: the same zod input schema, the same risk classification, and the same confirm-token flow. `hoox.run("db reset")` without a token returns `confirmation_required` with the identical message the direct tool returns and spawns nothing. A token minted inside `execute` works on the direct tool, and the reverse.

Limits per call: 20s wall clock, 50 `hoox.*` calls, 20,000 code characters, 200,000 result characters.

### Sandbox boundary

`search` and `execute` do not run in the server process. They run in a separate process launched with bubblewrap:

- `--unshare-all` — new user, pid, net, ipc, uts, and cgroup namespaces. There is no network route, not even loopback.
- `--clearenv` — the child receives only `PATH`, `HOME`, `TMPDIR`, `LANG`, and `NO_COLOR`. No `process.env`, no `CLOUDFLARE_*`, no `.dev.vars` values.
- Read-only binds of the Bun binary, the harness file, and the shared library directories. The repository and the home directory are absent, so the values `redact.ts` protects are unreachable from inside.
- A private tmpfs root, so writes anywhere are discarded with the process.
- `--die-with-parent`, `--new-session`, `--cap-drop ALL`.

What it is **not**: not a V8 isolate, not `node:vm`, and not a seccomp filter. Inside the child, `node:vm` shapes capabilities (`process`, `Bun`, `require`, and `fetch` are undefined, and `constructor.constructor("return process")` throws), but `vm` is not the boundary — the namespace is. The parent also never trusts the child: every call is re-validated in the server process as if a model had typed it.

If bubblewrap is missing, `execute` fails closed and says so. `HOOX_MCP_CODE_MODE_SANDBOX=subprocess` opts into a weaker mode — a plain child process with a cleared environment and a throwaway cwd, but host filesystem reads are still possible. That is an explicit operator decision, never a default.

The registration seam is `registerCodeMode(server, catalog, options)` in `src/codemode/tools.ts`: give it a catalog and the same two tools come out, which is how the pyne-mcp and axis-worker servers reuse this pattern.

`hoox tui`, `hoox dev …`, `hoox dashboard dev`, and `hoox workers dev` / `workers logs` are refused. They need a terminal or they stream until killed. Use `hoox_logs_worker` instead of `workers logs`; it passes `--no-follow` unless `follow` is true.

These also refuse, and are not spawned, when they would block on a prompt:

- `init` and `onboard` unless both `token` and `account` are set
- `config env init` (it prompts for every variable; `--yes` only skips overwrite)
- `deploy dashboard` unless `rebuild` is true
- `deploy rollback` unless the `version` argument is set

Prompts: `triage` and `deploy-checklist`. Policy text: `hoox://policy`.
