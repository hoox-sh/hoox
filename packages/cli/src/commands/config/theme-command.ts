/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Command } from "commander";
import {
  DEFAULT_THEME,
  THEME_HINTS,
  THEME_IDS,
  THEME_LABELS,
  isThemeId,
  migrateThemeId,
  readConfigSync,
  writeConfigSync,
  type ThemeId,
} from "@hoox-sh/hoox-shared";
import { withErrorHandling } from "../../utils/error-handler.js";
import { formatSuccess, getFormatOptions } from "../../utils/formatters.js";
import { applyCliTheme, theme } from "../../utils/theme.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

export function registerThemeCommand(configCmd: Command): void {
  configCmd
    .command("theme")
    .summary("Get or set the CLI/TUI color theme")
    .description(
      `Family color packs from hoox.sh (Signal / Volt / Void).

  signal   HOOX orange (default)
  volt     PYNE electric lime
  void     AXIS indigo

EXAMPLES:
  hoox config theme
  hoox config theme signal
  hoox config theme volt
  hoox config theme void`
    )
    .argument("[name]", "Theme id: signal | rail | light")
    .option("--list", "List available themes")
    .action(
      withErrorHandling(
        async (name: string | undefined, opts, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          const cfg = readConfigSync();

          if (opts.list || name === "list") {
            if (fmt.json) {
              process.stdout.write(
                JSON.stringify(
                  {
                    current: migrateThemeId(cfg.theme),
                    themes: THEME_IDS.map((id) => ({
                      id,
                      label: THEME_LABELS[id],
                      hint: THEME_HINTS[id],
                    })),
                  },
                  null,
                  2
                ) + "\n"
              );
              return;
            }
            const current = migrateThemeId(cfg.theme);
            process.stdout.write(theme.heading(" Themes") + "\n");
            for (const id of THEME_IDS) {
              const mark = id === current ? theme.accent("●") : theme.dim("○");
              process.stdout.write(
                `  ${mark} ${theme.text(id.padEnd(8))} ${theme.textMuted(THEME_HINTS[id])}\n`
              );
            }
            return;
          }

          if (!name) {
            const current = migrateThemeId(cfg.theme);
            if (fmt.json) {
              process.stdout.write(
                JSON.stringify({ theme: current, default: DEFAULT_THEME }) +
                  "\n"
              );
              return;
            }
            process.stdout.write(
              `${theme.accent("●")} ${theme.heading(THEME_LABELS[current])} ${theme.dim(THEME_HINTS[current])}\n`
            );
            return;
          }

          if (
            !isThemeId(name) &&
            name !== "dark" &&
            name !== "orange" &&
            name !== "indigo" &&
            name !== "rail" &&
            name !== "pyne" &&
            name !== "axis"
          ) {
            throw new CLIError(
              `Unknown theme "${name}". Use signal, volt, or void.`,
              ExitCode.INVALID_USAGE
            );
          }
          const id: ThemeId = migrateThemeId(name);
          applyCliTheme(id);
          writeConfigSync({ ...cfg, theme: id });
          formatSuccess(`Theme set to ${id} (${THEME_HINTS[id]})`, fmt);
        }
      )
    );
}
