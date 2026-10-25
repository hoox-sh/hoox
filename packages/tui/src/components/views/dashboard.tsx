/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
/**
 * Dashboard View — System health overview with service grid, alerts, and quick stats.
 *
 * Layout (vertical):
 *   1. Header: "DASHBOARD" title + animated connection status dot
 *   2. KillSwitchStatusBadge: live trade kill-switch indicator
 *   3. ServiceHealthGrid: worker cards with name + status indicator
 *   4. AlertsPanel: scrollable box with recent alerts, newest first
 *   5. QuickStatsRow: 4 metric cards with large numbers
 *
 * Follows Pattern 1 (View Composition) and Pattern 2 (Store Subscription).
 * Colors from design tokens via @hoox-sh/hoox-shared. No CSS, no DOM.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from "react";

import { Colors, useServiceStore } from "@hoox-sh/hoox-shared";
import { ErrorBoundary } from "../shared/error-boundary";
import { StatusDot } from "../shared/status-dot";
import { ViewHeader } from "../shared/view-header";
import { cliBridge } from "../../services/cli-bridge";
import { showConfirm } from "../ui/dialog";
import type { DialogHandle } from "../ui/dialog";
import { Spinner } from "../shared/spinner";
import {
  AutoRepairPanel,
  RepairFixItem,
  RepairState,
} from "./dashboard/auto-repair-panel";
import { ModelHealthSection } from "./dashboard/model-health-section";
import { PyneHealthSection } from "./dashboard/pyne-health-section";
import { AlertsPanel } from "./dashboard/alerts-panel";
import { useUIStore } from "@hoox-sh/hoox-shared";
import { useViewKeyboard } from "../../hooks/shell-overlay";
import { usePolling } from "../../hooks/use-polling";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DashboardViewProps {
  /** Dialog handle for confirm prompts (from useDialog context) */
  dialog?: DialogHandle;
}

// ─── Number Formatter (Bebas-style large numbers) ────────────────────────────

/**
 * Format a number for the stats cards.
 * - ≥1M: "1.2M"
 * - ≥1K: "12.3K"
 * - else: comma-separated integer
 * - P&L gets +/- prefix
 */
function formatStatNumber(value: number, isPnl = false): string {
  if (isPnl) {
    const sign = value >= 0 ? "+" : "-";
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${abs.toFixed(2)}`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/**
 * KillSwitchStatusBadge — Compact trade kill-switch indicator for the dashboard
 * header. Auto-refreshes on the Settings interval and shows the engaged/released
 * state with a color-coded status dot. Errors degrade to UNKNOWN.
 */
function KillSwitchStatusBadge() {
  const [state, setState] = useState<"engaged" | "released" | "unknown">(
    "unknown"
  );
  const genRef = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++genRef.current;
    try {
      const result = await cliBridge.monitorKillSwitch("show");
      if (gen !== genRef.current) return;
      if (result.success && result.data) {
        setState(result.data.engaged ? "engaged" : "released");
      } else {
        setState("unknown");
      }
    } catch {
      if (gen === genRef.current) setState("unknown");
    }
  }, []);

  useEffect(
    () => () => {
      genRef.current += 1;
    },
    []
  );
  usePolling({ callback: refresh, immediate: true });

  const label =
    state === "engaged"
      ? "KILL SWITCH ENGAGED"
      : state === "released"
        ? "KILL SWITCH RELEASED"
        : "KILL SWITCH ?";
  const color =
    state === "engaged"
      ? Colors.error
      : state === "released"
        ? Colors.success
        : Colors.muted;
  const dotStatus: "operational" | "down" =
    state === "engaged"
      ? "down"
      : state === "released"
        ? "operational"
        : "down";

  return (
    <box flexDirection="row" gap={1}>
      <StatusDot status={dotStatus} pulse={state === "released"} />
      <text fg={color} bold={state === "engaged"}>
        {label}
      </text>
    </box>
  );
}

/**
 * DashboardHeader — view title with animated connection status
 * and auto-repair button, via shared ViewHeader chrome.
 */
function DashboardHeader({
  onRefresh,
  onRunAutoRepair,
  autoRepairRunning,
}: {
  onRefresh?: () => void;
  onRunAutoRepair?: () => void;
  autoRepairRunning?: boolean;
}) {
  const connectionStatus = useServiceStore((s) => s.connectionStatus);

  const statusLabel: Record<string, string> = {
    connected: "CONNECTED",
    polling: "POLLING",
    reconnecting: "RECONNECTING",
    offline: "OFFLINE",
  };

  // Divider lives below the kill-switch badge in the main layout —
  // avoid a second rule under the title alone.
  // Meta: sibling text nodes in a row box (no <text> nesting; no fragments).
  return (
    <ViewHeader
      title="DASHBOARD"
      showDivider={false}
      meta={
        <box flexDirection="row" gap={1}>
          <StatusDot
            status={
              connectionStatus === "connected"
                ? "operational"
                : connectionStatus === "polling"
                  ? "degraded"
                  : "down"
            }
            pulse={connectionStatus === "connected"}
          />
          <text dim fg={Colors.muted}>
            {statusLabel[connectionStatus] ?? connectionStatus.toUpperCase()}
          </text>
          <text fg={Colors.muted} onMouseUp={onRefresh}>
            [REFRESH]
          </text>
          <text
            fg={Colors.accent}
            bold
            onMouseUp={() => useUIStore.getState().setView("edge-topology")}
          >
            [TOPOLOGY]
          </text>
          <text
            fg={autoRepairRunning ? Colors.warning : Colors.accent}
            bold={!autoRepairRunning}
            dim={autoRepairRunning}
            onMouseUp={autoRepairRunning ? undefined : onRunAutoRepair}
          >
            {autoRepairRunning ? "[REPAIRING...]" : "[AUTO-REPAIR]"}
          </text>
        </box>
      }
    />
  );
}

/**
 * ServiceHealthGrid — displays all workers as a grid of status cards.
 * Each card shows: [█ ▌ ░] WORKER_NAME
 * Limited to first 10 workers (fits the dashboard layout).
 *
 * Keyboard (dashboard active, when not handling alerts):
 *   ←→↑↓ / hjkl — move focus among worker cards
 *   Enter       — open worker detail
 * Mouse: click card → detail
 */
function ServiceHealthGrid() {
  const workers = useServiceStore((s) => s.workers);
  const connectionStatus = useServiceStore((s) => s.connectionStatus);
  const activeView = useUIStore((s) => s.activeView);
  const isActive = activeView === "dashboard";
  const [focusIndex, setFocusIndex] = useState(0);

  // Show first 10 workers (dashboard is an overview)
  const visibleWorkers = useMemo(() => workers.slice(0, 10), [workers]);
  const emptySlots = useMemo(
    () =>
      visibleWorkers.length < 10
        ? Array.from({ length: 10 - visibleWorkers.length }, (_, i) => i)
        : [],
    [visibleWorkers.length]
  );

  useEffect(() => {
    setFocusIndex((i) =>
      visibleWorkers.length === 0 ? 0 : Math.min(i, visibleWorkers.length - 1)
    );
  }, [visibleWorkers.length]);

  const openWorker = useCallback((workerId: string) => {
    useServiceStore.getState().selectWorker(workerId);
    useUIStore.getState().setView("worker-detail");
  }, []);

  // 5-column grid navigation
  const COLS = 5;
  useViewKeyboard((key) => {
    if (!isActive || visibleWorkers.length === 0) return;
    const name = String(key.name ?? "").toLowerCase();
    const n = visibleWorkers.length;
    if (name === "left" || name === "h") {
      setFocusIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (name === "right" || name === "l") {
      setFocusIndex((i) => Math.min(n - 1, i + 1));
      return;
    }
    if (name === "up" || name === "k") {
      // Prefer alerts panel owning ↑↓ when alerts exist — grid uses only
      // left/right by default; vertical jumps by COLS when pressed with Alt.
      if (key.alt) {
        setFocusIndex((i) => Math.max(0, i - COLS));
      }
      return;
    }
    if (name === "down" || name === "j") {
      if (key.alt) {
        setFocusIndex((i) => Math.min(n - 1, i + COLS));
      }
      return;
    }
    if (name === "return" || name === "enter") {
      const w = visibleWorkers[focusIndex];
      if (w) openWorker(w.id);
    }
  });

  if (workers.length === 0) {
    const offline =
      connectionStatus === "offline" || connectionStatus === "reconnecting";
    return (
      <box flexDirection="column" gap={0}>
        <text fg={Colors.foreground} bold dim>
          SERVICE HEALTH
        </text>
        <box flexDirection="column" paddingY={1} alignItems="center">
          {offline ? (
            <text fg={Colors.warning} dim>
              CLI/API offline — no worker health data
            </text>
          ) : (
            <Spinner label="Waiting for worker data..." />
          )}
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={0}>
      {/* Section label + compact keyboard affordance (avoid extra footer row —
          OpenTUI flexWrap was overlapping a sibling hint into later cards). */}
      <box flexDirection="row" gap={2}>
        <text fg={Colors.foreground} bold dim>
          SERVICE HEALTH
        </text>
        <text fg={Colors.dim} dim>
          ←→ Enter
        </text>
      </box>

      {/* 2 rows × 5 columns grid */}
      <box
        flexDirection="row"
        flexWrap="wrap"
        gap={1}
        paddingTop={1}
        paddingBottom={1}
      >
        {visibleWorkers.map((worker, i) => {
          const focused = i === focusIndex;
          return (
            <box
              key={worker.id}
              flexDirection="row"
              width={28}
              gap={1}
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={focused ? Colors.card : undefined}
              onMouseUp={() => {
                setFocusIndex(i);
                openWorker(worker.id);
              }}
            >
              <StatusDot status={worker.status} />
              <text
                fg={focused ? Colors.accent : Colors.foreground}
                bold={focused}
              >
                {worker.name}
              </text>
            </box>
          );
        })}
        {/* Fill empty slots in the same wrap container */}
        {emptySlots.map((i) => (
          <box
            key={`empty-${i}`}
            flexDirection="row"
            width={28}
            gap={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={Colors.dim} dim>
              -
            </text>
            <text fg={Colors.dim} dim>
              -
            </text>
          </box>
        ))}
      </box>
    </box>
  );
}

/**
 * MetricCard — a single stat card with label and large formatted number.
 */

function MetricCard({
  label,
  value,
  color,
  isPnl = false,
  loading = false,
}: {
  label: string;
  value: number;
  color: string;
  isPnl?: boolean;
  /** When true, show placeholder instead of inventing zeros. */
  loading?: boolean;
}) {
  return (
    <box
      flexDirection="column"
      width={22}
      border={true}
      borderStyle="single"
      borderColor={Colors.border}
      backgroundColor={Colors.card}
      paddingX={1}
      paddingY={0}
    >
      {/* Label (dim, small) */}
      <box>
        <text fg={Colors.muted} dim>
          {label}
        </text>
      </box>

      {/* Value (large, colored) — never invent zeros while loading */}
      <box>
        <text fg={loading ? Colors.dim : color} bold={!loading}>
          {loading ? "..." : formatStatNumber(value, isPnl)}
        </text>
      </box>
    </box>
  );
}

/**
 * QuickStatsRow — row of 4 metric cards from SystemMetrics.
 * P&L, Active Strategies, Daily Trades, AI Calls.
 */
function QuickStatsRow() {
  const metrics = useServiceStore((s) => s.metrics);
  const loading = metrics === null;

  const totalPnl = metrics?.totalPnl ?? 0;
  const activeStrategies = metrics?.activeStrategies ?? 0;
  const dailyTrades = metrics?.dailyTrades ?? 0;
  const aiCalls = metrics?.aiCalls ?? 0;

  return (
    <box flexDirection="column" gap={0}>
      <text fg={Colors.foreground} bold dim>
        QUICK STATS
      </text>

      <box flexDirection="row" gap={1} paddingTop={1}>
        <MetricCard
          label="P&L"
          value={totalPnl}
          color={totalPnl >= 0 ? Colors.success : Colors.error}
          isPnl
          loading={loading}
        />
        <MetricCard
          label="ACTIVE STRATEGIES"
          value={activeStrategies}
          color={Colors.accent}
          loading={loading}
        />
        <MetricCard
          label="DAILY TRADES"
          value={dailyTrades}
          color={Colors.info}
          loading={loading}
        />
        <MetricCard
          label="AI CALLS"
          value={aiCalls}
          color={Colors.accent}
          loading={loading}
        />
      </box>

      {loading && (
        <box paddingTop={1} alignItems="center">
          <Spinner label="Waiting for metrics data..." />
        </box>
      )}
    </box>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

/**
 * DashboardView — system health overview.
 *
 * Composes: Header → ServiceHealthGrid → AutoRepairPanel → AlertsPanel → QuickStatsRow
 * Wrapped in an ErrorBoundary for crash recovery.
 *
 * View subscribes to service-store (workers, alerts, metrics, connectionStatus)
 * and re-renders on data changes via Zustand selectors.
 */
export function DashboardView({ dialog }: DashboardViewProps = {}) {
  const [repairState, setRepairState] = useState<RepairState>({ kind: "idle" });

  // Mount lifetime: cancel async work so unmount never setStates after teardown
  const mountedRef = useRef(true);
  // Race-safe refresh generation (stale monitorStatus/fetchWorkers ignored)
  const refreshGenRef = useRef(0);
  // Guard double-submit without re-creating handleRunAutoRepair every state flip
  const repairRunningRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    const gen = ++refreshGenRef.current;
    try {
      const result = await cliBridge.monitorStatus();
      if (!mountedRef.current || gen !== refreshGenRef.current) return;
      if (result.success) {
        // Clear any previous CLI error and refresh the data view.
        // Note: failed CLI calls propagate to the status bar automatically
        // via the global error sink registered in app.tsx.
        useServiceStore.getState().setLastErrorDetails(null);
        await useServiceStore.getState().fetchWorkers();
      }
    } catch {
      // Global error sink handles CLI failures; never throw into the view tree.
    }
  }, []);

  const handleRunAutoRepair = useCallback(async () => {
    // Fail closed: never mutate config without an interactive confirm surface.
    if (!dialog) {
      useServiceStore.getState().addAlert({
        id: `repair-noconfirm-${Date.now()}`,
        type: "config",
        severity: "warning",
        message: "Auto-repair blocked: confirmation dialog unavailable",
        timestamp: Date.now(),
        acknowledged: false,
      });
      return;
    }
    // Prevent double-submit while a repair is already running
    if (repairRunningRef.current) return;

    const confirmed = await showConfirm(dialog, {
      title: "Run Auto-Repair?",
      message:
        "Auto-repair will apply non-destructive fixes to your configuration. " +
        "This creates placeholder .dev.vars files, adds compatibility flags, " +
        "and ensures worker configs are valid.",
      confirmLabel: "Run Repair",
      cancelLabel: "Cancel",
    });
    if (!confirmed || !mountedRef.current) return;

    repairRunningRef.current = true;
    setRepairState({ kind: "running" });
    try {
      const result = await cliBridge.checkFix();
      if (!mountedRef.current) return;
      if (!result.success) {
        setRepairState({
          kind: "error",
          message: result.stderr || result.stdout || "unknown error from CLI",
        });
        useServiceStore.getState().addAlert({
          id: `repair-${Date.now()}`,
          type: "config",
          severity: "warning",
          message: `Auto-repair failed: ${result.stderr || result.stdout || "unknown error"}`,
          timestamp: Date.now(),
          acknowledged: false,
        });
        return;
      }

      // Parse the FixReport from the CLI response
      const data = result.data as {
        actions?: Array<{
          description: string;
          type: string;
          target: string;
          applied: boolean;
          error?: string;
        }>;
        summary?: {
          total: number;
          applied: number;
          skipped: number;
          failed: number;
        };
      } | null;

      if (!data || !Array.isArray(data.actions)) {
        setRepairState({
          kind: "error",
          message: "CLI did not return a valid FixReport (missing actions).",
        });
        return;
      }

      const items: RepairFixItem[] = data.actions.map((action) => ({
        description: action.description ?? "Unknown fix",
        type: (action.type as RepairFixItem["type"]) ?? "config",
        target: action.target ?? "",
        applied: Boolean(action.applied),
        error: action.error,
        timestamp: Date.now(),
      }));

      setRepairState({ kind: "results", items, durationMs: result.duration });

      // Add summary alert
      const applied = items.filter((i) => i.applied).length;
      const failed = items.filter((i) => i.error).length;
      useServiceStore.getState().addAlert({
        id: `repair-${Date.now()}`,
        type: "config",
        severity: failed > 0 ? "warning" : "info",
        message:
          failed > 0
            ? `Auto-repair completed: ${applied} applied, ${failed} failed`
            : `Auto-repair completed: ${applied} fix(es) applied`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setRepairState({ kind: "error", message });
      useServiceStore.getState().addAlert({
        id: `repair-err-${Date.now()}`,
        type: "config",
        severity: "error",
        message: `Auto-repair error: ${message}`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    } finally {
      repairRunningRef.current = false;
    }
  }, [dialog]);

  const dismissRepairPanel = useCallback(() => {
    setRepairState({ kind: "idle" });
  }, []);

  /** Re-run the auto-repair. */
  const rerunRepair = useCallback(() => {
    void handleRunAutoRepair();
  }, [handleRunAutoRepair]);

  // Dismiss repair panel on ESC key when visible
  useViewKeyboard((key) => {
    if (repairState.kind !== "idle" && key.name === "escape") {
      dismissRepairPanel();
    }
  });

  useEffect(() => {
    let cancelled = false;
    const runHealthCheck = async () => {
      try {
        const health = await cliBridge.checkHealth();
        if (cancelled) return;
        if (health.success) {
          useServiceStore.getState().setLastErrorDetails(null);
          await useServiceStore.getState().fetchWorkers();
        }
        // Failure path: handled by the global error sink in app.tsx.
      } catch {
        // Fail gracefully when CLI is offline
      }
    };
    void runHealthCheck();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ErrorBoundary viewName="Dashboard">
      <box flexDirection="column" flexGrow={1} padding={1} gap={1}>
        {/* 1. Header: title + connection status */}
        <box>
          <DashboardHeader
            onRefresh={handleRefresh}
            onRunAutoRepair={handleRunAutoRepair}
            autoRepairRunning={repairState.kind === "running"}
          />
        </box>

        {/* 2. Kill-switch status badge — trading safety at a glance */}
        <box>
          <KillSwitchStatusBadge />
        </box>

        {/* Divider */}
        <box>
          <text fg={Colors.border} dim>
            {""}
            {"─".repeat(80)}
          </text>
        </box>

        {/* 3. Service health grid */}
        <box>
          <ServiceHealthGrid />
        </box>

        {/* Auto-repair results panel — persists until dismissed or ESC */}
        {repairState.kind !== "idle" && (
          <box>
            <AutoRepairPanel
              state={repairState}
              onDismiss={dismissRepairPanel}
              onRerun={rerunRepair}
            />
          </box>
        )}

        {/* 4. Alerts panel */}
        <box>
          <AlertsPanel />
        </box>

        {/* 5. Quick stats row */}
        <box>
          <QuickStatsRow />
        </box>

        {/* 6. AI model health section */}
        <box>
          <ModelHealthSection />
        </box>

        {/* 7. PYNE edge evaluate health */}
        <box>
          <PyneHealthSection />
        </box>
      </box>
    </ErrorBoundary>
  );
}
