/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WizardState } from "./types";

/**
 * Serialize wizard state to JSON string.
 *
 * The Cloudflare API token is stripped — `.wizard-state.json` must not
 * hold live credentials. Resume re-reads `CLOUDFLARE_API_TOKEN` from the
 * environment (or re-prompts).
 */
export function serializeState(state: WizardState): string {
  const copy: WizardState = {
    ...state,
    cloudflareConfig: state.cloudflareConfig
      ? { ...state.cloudflareConfig, apiToken: "" }
      : undefined,
  };
  return JSON.stringify(copy, null, 2);
}

/**
 * Deserialize wizard state from JSON string.
 */
export function deserializeState(json: string): WizardState {
  const parsed = JSON.parse(json);
  return parsed as WizardState;
}

/**
 * Path for wizard state file (relative to project root).
 */
export const WIZARD_STATE_PATH = ".wizard-state.json";
