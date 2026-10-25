/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
/**
 * Secrets Viewer — Read-only dashboard for Cloudflare Workers secrets.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  SECRETS VIEWER   12 secrets · ◉ 5s auto    [⚠ READ-ONLY]   │
 *   │───────────────────────────────────────────────────────────────
 *   │  [! SECURITY !] Values are hidden for security reasons.       │
 *   │                 Use `hoox config secrets set` in CLI to manage│
 *   │───────────────────────────────────────────────────────────────
 *   │  [search…]                           Last sampled 12:34:56   │
 *   │───────────────────────────────────────────────────────────────
 *   │  SECRET NAME                   TYPE        SOURCE   STATUS  │
 *   │  EXCHANGE_KEY_BINDING         api_key     config   OK      │
 *   │  OPENAI_API_KEY               api_key     config   OK      │
 *   │  TELEGRAM_BOT_TOKEN           token       config   OK      │
 *   │  …                                                         │
 *   │───────────────────────────────────────────────────────────────
 *   │  [REFRESH]                                                 │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Pattern established for the TUI feature-parity batch:
 *   - Pure function component, no props required
 *   - Subscribes to useUIStore (so auto-refresh can pause when not active)
 *   - Calls cliBridge.configSecretsList() on mount + every 5s while active
 *   - Wraps content in <ErrorBoundary viewName="Secrets Viewer">
 *   - Renders an empty/error state instead of throwing
 *   - Read-only: write operations are intentionally *not* exposed
 *     here. The TUI never sends `secrets set` / `secrets delete` —
 *     those are CLI-only.
 *
 * Security:
 *   - Values are NEVER fetched or displayed — this is strictly read-only
 *   - The prominent security warning banner is always visible
 *   - Only secret names, inferred types, and sources are shown
 *   - No ability to reveal or copy secret values
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Colors, useUIStore, useConfigStore } from "@hoox-sh/hoox-shared";
import { ErrorBoundary } from "../shared/error-boundary";
import { Spinner, EmptyState } from "../shared/spinner";
import { ViewHeader } from "../shared/view-header";
import { cliBridge } from "../../services/cli-bridge";
import type {
  SecretMetadata,
  SecretsSnapshot,
} from "../../services/cli-bridge";
import { useViewKeyboard } from "../../hooks/shell-overlay";
import { usePolling, formatPollIntervalLabel } from "../../hooks/use-polling";

/** Cap rendered secret rows for large worker graphs. */
export const MAX_VISIBLE_SECRETS = 200;

const SEARCH_DEBOUNCE_MS = 150;

/** Case-insensitive name filter — values are never involved. */
export function filterSecrets(
  secrets: readonly SecretMetadata[],
  search: string
): SecretMetadata[] {
  const q = search.trim().toLowerCase();
  if (q.length === 0) return secrets as SecretMetadata[];
  return secrets.filter((s) => s.name.toLowerCase().includes(q));
}

/**
 * Format a secret type for display in the TYPE column.
 */
function formatType(type: SecretMetadata["type"]): string {
  return type;
}

/**
 * Color for the source badge.
 */
function sourceColor(source: SecretMetadata["source"]): string {
  return source === "Cloudflare" ? Colors.info : Colors.muted;
}

/**
 * Pick a color for a row based on secret type severity.
 */
function rowColor(type: SecretMetadata["type"]): string {
  if (type === "api_key" || type === "token") {
    return Colors.warning;
  }
  return Colors.foreground;
}

// ─── Sub-component: Single Secret Row ─────────────────────────────────────────

interface SecretRowProps {
  secret: SecretMetadata;
  isSelected: boolean;
  onSelect: (name: string) => void;
}

function SecretRow({ secret, isSelected, onSelect }: SecretRowProps) {
  const fg = isSelected ? Colors.accent : rowColor(secret.type);
  return (
    <box
      flexDirection="row"
      gap={2}
      paddingLeft={1}
      paddingRight={1}
      alignItems="center"
      backgroundColor={isSelected ? Colors.card : undefined}
      onMouseUp={() => onSelect(secret.name)}
    >
      <text fg={fg} bold={isSelected}>
        {secret.worker ? `${secret.worker}/${secret.name}` : secret.name}
      </text>
      <text fg={Colors.muted}>{formatType(secret.type).padStart(8, " ")}</text>
      <text fg={sourceColor(secret.source)} dim>
        {secret.source.padEnd(10, " ")}
      </text>
    </box>
  );
}

// ─── Sub-component: Search Box ─────────────────────────────────────────────────

interface SearchBoxProps {
  query: string;
  onChange: (next: string) => void;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

function SearchBox({
  query,
  onChange,
  active,
  onActivate,
  onDeactivate,
}: SearchBoxProps) {
  // When active, capture printable keys for filtering (same pattern as KV Viewer).
  useViewKeyboard((key) => {
    if (!active) return;
    if (key.name === "escape") {
      onDeactivate();
      return;
    }
    if (key.name === "backspace" || key.name === "delete") {
      onChange(query.slice(0, -1));
      return;
    }
    if (key.name === "return") {
      onDeactivate();
      return;
    }
    if (key.sequence && key.sequence.length === 1 && key.sequence >= " ") {
      onChange(query + key.sequence);
    }
  });

  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      alignItems="center"
      border={true}
      borderStyle="single"
      borderColor={active ? Colors.accent : Colors.border}
      onMouseUp={onActivate}
    >
      <text fg={Colors.muted} dim>
        search:
      </text>
      <text fg={Colors.foreground}>
        {query.length > 0 ? query : active ? "_" : "(press / to filter)"}
      </text>
    </box>
  );
}

// ─── Main SecretsViewer View ───────────────────────────────────────────────────

/**
 * SecretsViewer — Main view showing the declared secrets across all workers.
 *
 * The view follows the same architectural pattern as the KV viewer
 * (see `kv-viewer.tsx` for the original):
 *   1. Pure function component, no required props
 *   2. Subscribes to `useUIStore.activeView` to pause auto-refresh
 *      when the user navigates away
 *   3. Calls `cliBridge.configSecretsList()` on mount + on a fixed
 *      interval (5s) — refreshes can also be triggered manually via
 *      a button
 *   4. Renders an explicit empty/error state instead of throwing
 *   5. Wraps in <ErrorBoundary viewName="Secrets Viewer"> so a render
 *      bug in this view never crashes the whole TUI
 *
 * Security guarantees:
 *   - Values are NEVER fetched — only names and metadata are retrieved
 *   - The security warning banner is prominently displayed at all times
 *   - No "reveal" or "copy" functionality exists
 *   - Write operations are intentionally not exposed
 */
export function SecretsViewer() {
  const activeView = useUIStore((s) => s.activeView);
  const isActive = activeView === "secrets-viewer";

  const [snapshot, setSnapshot] = useState<SecretsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listGenRef = useRef(0);

  const [selectedSecretName, setSelectedSecretName] = useState<string | null>(
    null
  );

  // Debounce search filter
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      searchTimerRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [search]);

  // ── Fetch handler — metadata only; NEVER requests secret values ───────────
  const refresh = useCallback(async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft === true;
    const gen = ++listGenRef.current;
    if (!soft) setLoading(true);
    // Security: only configSecretsList (names/types). No get/reveal API.
    const result = await cliBridge.configSecretsList();
    if (gen !== listGenRef.current) return;
    if (result.success && result.data) {
      setSnapshot(result.data);
      setError(null);
    } else {
      setError(result.stderr || result.stdout || "Failed to read secrets");
    }
    setLoading(false);
  }, []);

  // Initial load on mount + invalidate in-flight on unmount.
  useEffect(() => {
    void refresh({ soft: false });
    return () => {
      listGenRef.current += 1;
    };
  }, [refresh]);

  const refreshIntervalMs = useConfigStore((s) => s.refreshIntervalMs);
  usePolling({
    callback: () => refresh({ soft: true }),
    enabled: isActive,
    immediate: false,
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const allSecrets = snapshot?.secrets ?? [];
  const filteredSecrets = useMemo(
    () => filterSecrets(allSecrets, debouncedSearch),
    [allSecrets, debouncedSearch]
  );
  const visibleSecrets = useMemo(
    () => filteredSecrets.slice(0, MAX_VISIBLE_SECRETS),
    [filteredSecrets]
  );

  const selectedSecret = useMemo(() => {
    if (!selectedSecretName) return null;
    return allSecrets.find((s) => s.name === selectedSecretName) ?? null;
  }, [allSecrets, selectedSecretName]);

  // ── Keyboard: list nav + open search (inactive while search is active) ───
  useViewKeyboard((key) => {
    if (!isActive) return;
    if (searchActive) return; // SearchBox owns keys while active
    if (key.name === "slash" || (key.ctrl && key.name === "f")) {
      setSearchActive(true);
      return;
    }
    if (key.name === "escape") {
      if (selectedSecretName) setSelectedSecretName(null);
      return;
    }
    if (key.name === "up") {
      if (visibleSecrets.length === 0) return;
      const idx = selectedSecretName
        ? visibleSecrets.findIndex((s) => s.name === selectedSecretName)
        : -1;
      const next = Math.max(0, idx - 1);
      setSelectedSecretName(visibleSecrets[next]?.name ?? null);
      return;
    }
    if (key.name === "down") {
      if (visibleSecrets.length === 0) return;
      const idx = selectedSecretName
        ? visibleSecrets.findIndex((s) => s.name === selectedSecretName)
        : -1;
      const next = Math.min(visibleSecrets.length - 1, idx + 1);
      setSelectedSecretName(visibleSecrets[next]?.name ?? null);
      return;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary viewName="Secrets Viewer">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        <ViewHeader
          title="SECRETS VIEWER"
          showDivider={false}
          meta={
            <box flexDirection="row" gap={2} alignItems="center">
              <text fg={Colors.muted} dim>
                {`${allSecrets.length} secret${allSecrets.length === 1 ? "" : "s"}`}
              </text>
              {debouncedSearch.length > 0 ? (
                <text fg={Colors.info} dim>
                  {`(${filteredSecrets.length} match${filteredSecrets.length === 1 ? "" : "es"})`}
                </text>
              ) : null}
              {filteredSecrets.length > MAX_VISIBLE_SECRETS ? (
                <text fg={Colors.muted} dim>
                  {`showing ${MAX_VISIBLE_SECRETS}`}
                </text>
              ) : null}
              <text fg={Colors.warning} bold>
                ⚠ READ-ONLY
              </text>
              <text fg={Colors.info} dim>
                {`◉ ${formatPollIntervalLabel(refreshIntervalMs)}`}
              </text>
            </box>
          }
        />

        {/* Security warning banner — ALWAYS visible */}
        <box
          flexDirection="column"
          padding={1}
          gap={0}
          border={true}
          borderStyle="single"
          borderColor={Colors.warning}
          backgroundColor={Colors.card}
        >
          <text fg={Colors.warning} bold>
            ⚠ SECURITY: Values are hidden for security reasons.
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={Colors.muted} dim>
              This view is strictly read-only. Use
            </text>
            <text fg={Colors.accent}>hoox config secrets set</text>
            <text fg={Colors.muted} dim>
              in CLI to manage secrets.
            </text>
          </box>
        </box>

        {/* Search + last sampled row */}
        <box flexDirection="row" gap={1} alignItems="center">
          <SearchBox
            query={search}
            onChange={setSearch}
            active={searchActive}
            onActivate={() => setSearchActive(true)}
            onDeactivate={() => setSearchActive(false)}
          />
          <text fg={Colors.muted} dim>
            {snapshot
              ? `Last sampled ${snapshot.timestamp.slice(11, 19)}`
              : "Last sampled —"}
          </text>
        </box>

        {/* Main content: secret list + detail */}
        <box flexDirection="row" flexGrow={1} gap={1}>
          {/* Left pane: scrollable list */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={Colors.border}
          >
            {/* Column header */}
            <box flexDirection="row" gap={2} paddingLeft={1} paddingRight={1}>
              <text fg={Colors.muted} dim>
                SECRET NAME
              </text>
              <text fg={Colors.muted} dim>
                {"TYPE".padStart(8, " ")}
              </text>
              <text fg={Colors.muted} dim>
                {"SOURCE".padEnd(10, " ")}
              </text>
            </box>
            <text fg={Colors.border} dim>
              {"─".repeat(80)}
            </text>

            {/* Body */}
            {loading && allSecrets.length === 0 ? (
              <box padding={1} flexGrow={1} justifyContent="center">
                <Spinner label="Loading secrets…" />
              </box>
            ) : error && allSecrets.length === 0 ? (
              <box padding={1} flexDirection="column" gap={0}>
                <text fg={Colors.error} bold>
                  ! {error.length > 60 ? error.slice(0, 57) + "…" : error}
                </text>
                <text fg={Colors.muted} dim>
                  Make sure hoox CLI is installed and configured.
                </text>
              </box>
            ) : allSecrets.length === 0 ? (
              <box padding={1} flexGrow={1}>
                <EmptyState
                  message="No secrets declared."
                  suggestion="Add secrets to wrangler.jsonc · hoox config secrets set"
                  icon="🔐"
                />
              </box>
            ) : filteredSecrets.length === 0 ? (
              <box padding={1} flexGrow={1}>
                <EmptyState
                  message={`No secrets match "${search}".`}
                  suggestion="Press / to clear."
                  icon="🔍"
                />
              </box>
            ) : (
              <scrollbox width="100%" flexGrow={1}>
                {visibleSecrets.map((s) => (
                  <SecretRow
                    key={s.name}
                    secret={s}
                    isSelected={s.name === selectedSecretName}
                    onSelect={(name) => setSelectedSecretName(name)}
                  />
                ))}
              </scrollbox>
            )}
          </box>

          {/* Right pane: detail / info viewer */}
          <box
            flexDirection="column"
            flexGrow={1}
            border={true}
            borderStyle="single"
            borderColor={Colors.border}
          >
            {selectedSecret ? (
              <box flexDirection="column" gap={1} padding={2}>
                <text fg={Colors.accent} bold>
                  {selectedSecret.name}
                </text>
                <text fg={Colors.border} dim>
                  {"─".repeat(40)}
                </text>
                <box flexDirection="column" gap={0}>
                  <box flexDirection="row" gap={1}>
                    <text fg={Colors.muted}>Type:</text>
                    <text fg={Colors.foreground}>{selectedSecret.type}</text>
                  </box>
                  <box flexDirection="row" gap={1}>
                    <text fg={Colors.muted}>Source:</text>
                    <text fg={sourceColor(selectedSecret.source)}>
                      {selectedSecret.source}
                    </text>
                  </box>
                </box>
                <text fg={Colors.muted} dim>
                  Values are not available for viewing.
                </text>
              </box>
            ) : (
              <box flexDirection="column" flexGrow={1} padding={2} gap={1}>
                <text fg={Colors.muted} dim>
                  Select a secret to view its metadata.
                </text>
                <text fg={Colors.dim} dim>
                  ↑↓ navigate · values hidden
                </text>
              </box>
            )}
          </box>
        </box>

        {/* Footer: refresh + read-only warning */}
        <box
          flexDirection="row"
          justifyContent="space-between"
          paddingLeft={1}
          paddingRight={1}
          alignItems="center"
        >
          <box flexDirection="row" gap={2} alignItems="center">
            <text
              fg={loading ? Colors.muted : Colors.accent}
              bg={Colors.card}
              dim={loading}
              onMouseUp={loading ? undefined : () => void refresh()}
            >
              {loading ? " ... " : " [REFRESH] "}
            </text>
            {error && allSecrets.length > 0 && (
              <text fg={Colors.warning} dim>
                ! {error.length > 50 ? error.slice(0, 47) + "…" : error}
              </text>
            )}
          </box>
          <box flexDirection="row" gap={1}>
            <text fg={Colors.muted} dim>
              Use
            </text>
            <text fg={Colors.accent}>hoox config secrets set|delete</text>
            <text fg={Colors.muted} dim>
              in CLI for writes
            </text>
          </box>
        </box>
      </box>
    </ErrorBoundary>
  );
}
