/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { useEffect, useState } from "react";
import { Colors, PULSE_FRAMES, STEP_GLYPH } from "@hoox-sh/hoox-shared";

function inTest(): boolean {
  return (
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT === true || process.env.BUN_TEST === "1"
  );
}

export function PulseWave({ color }: { color?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (inTest()) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % PULSE_FRAMES.length);
    }, 120);
    return () => clearInterval(id);
  }, []);
  return (
    <text fg={color ?? Colors.accent}>
      {PULSE_FRAMES[frame] ?? PULSE_FRAMES[0]}
    </text>
  );
}

export function PulseDot({
  active = true,
  color,
}: {
  active?: boolean;
  color?: string;
}) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (inTest() || !active) return;
    const id = setInterval(() => setOn((v) => !v), 500);
    return () => clearInterval(id);
  }, [active]);
  return (
    <text fg={color ?? (on ? Colors.accent : Colors["accent-dim"])}>
      {on || !active ? "●" : "○"}
    </text>
  );
}

export function StepTick({
  status,
}: {
  status: "pending" | "running" | "done" | "failed";
}) {
  const color =
    status === "done"
      ? Colors.success
      : status === "failed"
        ? Colors.error
        : status === "running"
          ? Colors.accent
          : Colors.dim;
  return <text fg={color}>{STEP_GLYPH[status]}</text>;
}
