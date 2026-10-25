/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
import { useState, useEffect, useCallback, useRef } from "react";
import { Colors, WorkerStatusColor } from "@hoox-sh/hoox-shared";
import { StatusDot } from "../../shared/status-dot";
import { cliBridge } from "../../../services/cli-bridge";
import type { PyneHealthResult } from "../../../services/cli-bridge";
import { usePolling } from "../../../hooks/use-polling";

function statusToDot(
  status: PyneHealthResult["status"]
): "operational" | "degraded" | "down" {
  if (status === "healthy") return "operational";
  if (status === "degraded") return "degraded";
  return "down";
}

/**
 * Compact PYNE edge evaluate health row for the TUI dashboard.
 * Polls `hoox pyne health` via the CLI bridge.
 */
export function PyneHealthSection() {
  const [result, setResult] = useState<PyneHealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const gen = ++genRef.current;
    try {
      const res = await cliBridge.pyneHealthCheck();
      if (gen !== genRef.current) return;
      if (res.data) {
        setResult(res.data);
      } else {
        setResult({
          worker: "pyne-worker",
          url: "",
          status: "down",
          error: res.stderr || "probe failed",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (gen !== genRef.current) return;
      setResult({
        worker: "pyne-worker",
        url: "",
        status: "down",
        error: err instanceof Error ? err.message : "probe failed",
        timestamp: new Date().toISOString(),
      });
    } finally {
      inFlightRef.current = false;
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(
    () => () => {
      genRef.current += 1;
    },
    []
  );
  usePolling({ callback: refresh, immediate: true });

  const status = result?.status ?? "down";
  const dot = statusToDot(status);
  const color = WorkerStatusColor[dot];
  // Never surface raw probe payloads that might embed tokens in free text
  const errMsg = result?.error
    ? result.error.length > 40
      ? result.error.slice(0, 37) + "…"
      : result.error
    : null;

  return (
    <box flexDirection="column" gap={0} paddingTop={1}>
      <text fg={Colors.muted} dim>
        PYNE EDGE
      </text>
      <box flexDirection="row" gap={1} paddingLeft={1}>
        <StatusDot status={dot} pulse={status === "healthy"} />
        <text fg={Colors.foreground} bold>
          pyne-worker
        </text>
        <text fg={color}>{loading ? "…" : status.toUpperCase()}</text>
        {result?.latencyMs != null ? (
          <text fg={Colors.muted} dim>
            {result.latencyMs}ms
          </text>
        ) : null}
        {errMsg ? (
          <text fg={Colors.error} dim>
            {errMsg}
          </text>
        ) : null}
      </box>
    </box>
  );
}
