/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as z from "zod/v4";
import type { CatalogArg, CatalogEntry, CatalogOpt } from "./types.ts";

export function inputSchemaFor(entry: CatalogEntry) {
  const shape: Record<string, z.ZodType> = {};
  for (const arg of entry.args) shape[arg.key] = argField(arg);
  for (const opt of entry.options) shape[opt.key] = optField(opt);
  shape.cwd = z
    .string()
    .optional()
    .describe(
      "Absolute Hoox checkout. Defaults to HOOX_REPO, cwd, or this repo."
    );
  shape.timeout_ms = z
    .number()
    .int()
    .min(1000)
    .max(300_000)
    .optional()
    .describe("Kill the CLI process after this many milliseconds.");
  shape.confirm = z
    .string()
    .optional()
    .describe(
      "Confirm token from a previous call or hoox_plan. Required to run a mutation."
    );
  if (entry.secretStdin) {
    shape.secret_value = z
      .string()
      .min(1)
      .max(8000)
      .optional()
      .describe("Secret written to the CLI stdin. Never placed on argv.");
  }
  if (entry.scriptStdin) {
    shape.script_body = z
      .string()
      .max(200_000)
      .optional()
      .describe("Pine source. Used only when script-path is -.");
  }
  return z.object(shape);
}

function argField(arg: CatalogArg): z.ZodType {
  const text = arg.description.slice(0, 300);
  if (arg.variadic) {
    let arraySchema = z.array(z.string().max(4000)).max(50);
    if (arg.required) arraySchema = arraySchema.min(1);
    const field = arg.required ? arraySchema : arraySchema.optional();
    return field.describe(text);
  }
  const inner = stringish(arg.choices, 8000);
  const field = arg.required ? inner : inner.optional();
  return field.describe(text);
}

function optField(opt: CatalogOpt): z.ZodType {
  const text = `${opt.flag} — ${opt.description}`.slice(0, 300);
  if (opt.kind === "boolean") {
    const field = opt.required ? z.boolean() : z.boolean().optional();
    return field.describe(text);
  }
  if (opt.kind === "string[]") {
    const arraySchema = z.array(z.string().max(4000)).max(50);
    const field = opt.required ? arraySchema : arraySchema.optional();
    return field.describe(text);
  }
  const inner = stringish(opt.choices, 8000);
  const field = opt.required ? inner : inner.optional();
  return field.describe(text);
}

function stringish(choices: string[] | undefined, max: number): z.ZodType {
  const first = choices?.[0];
  if (first !== undefined && choices && choices.length > 0) {
    return z.enum([first, ...choices.slice(1)] as [string, ...string[]]);
  }
  return z.string().max(max);
}
