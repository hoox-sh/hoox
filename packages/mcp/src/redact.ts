/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

const ANSI =
  // ANSI CSI/OSC. Control bytes are the sequences being stripped.
  // eslint-disable-next-line no-control-regex
  /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;

const SECRET_FLAGS = new Set([
  "--token",
  "--secret-token",
  "--api-key",
  "--headers",
  "--secret",
  "--password",
  "--auth",
  "--authorization",
]);

/** Suffixes and name components that mark a credential in JSON or `.env` text. */
const SECRET_SUFFIX = /_(?:SECRET|TOKEN|PASSWORD|PASS|API_KEY|KEY)$/i;
const SECRET_WORD =
  /(?:^|_)(?:api[_-]?key|secret|token|password|authorization|passwd)(?:_|$)/i;

/**
 * `secret: true` names from EnvService.getDefinitions().
 * The suffix rule misses KEY_BINDING, EMAIL_*_BINDING, chat ids, and
 * ALERT_WEBHOOK_URL. live.test.ts fails if this list drifts from the CLI.
 */
export const SECRET_ENV_NAMES: readonly string[] = [
  "CLOUDFLARE_API_TOKEN",
  "TRADE_INTERNAL_KEY",
  "AGENT_INTERNAL_KEY",
  "WEBHOOK_API_KEY_BINDING",
  "INTERNAL_KEY_BINDING",
  "API_SERVICE_KEY_BINDING",
  "TELEGRAM_INTERNAL_KEY_BINDING",
  "WALLET_EXECUTE_KEY_BINDING",
  "HA_TOKEN_BINDING",
  "TG_BOT_TOKEN_BINDING",
  "TG_CHAT_ID_BINDING",
  "TELEGRAM_SECRET_TOKEN",
  "AUTHORIZED_CHAT_IDS",
  "TELEGRAM_ALLOWED_CHAT_IDS",
  "OPERATOR_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "EXCHANGE_KEY_BINDING",
  "EXCHANGE_SECRET_BINDING",
  "EXCHANGE_TESTNET_KEY_BINDING",
  "EXCHANGE_TESTNET_SECRET_BINDING",
  "EMAIL_HOST_BINDING",
  "EMAIL_USER_BINDING",
  "EMAIL_PASS_BINDING",
  "WALLET_MNEMONIC_SECRET",
  "WALLET_PK_SECRET",
  "SOLANA_PRIVATE_KEY",
  "JUPITER_API_KEY",
  "API_KEY",
  "ALERT_WEBHOOK_URL",
  "PYNE_API_KEY",
  "DASHBOARD_PASS",
  "REPORT_TELEGRAM_CHAT_ID",
  "SESSION_SECRET",
];

const SECRET_ENV_NAME_SET = new Set(SECRET_ENV_NAMES);

function isSecretName(name: string): boolean {
  return (
    SECRET_ENV_NAME_SET.has(name.toUpperCase()) ||
    SECRET_SUFFIX.test(name) ||
    SECRET_WORD.test(name)
  );
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

export function redact(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  const rules: Array<(value: string) => string> = [
    (value) =>
      value.replace(
        /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
        () => {
          count += 1;
          return "[REDACTED]";
        }
      ),
    (value) =>
      value.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, () => {
        count += 1;
        return "Bearer [REDACTED]";
      }),
    (value) =>
      value.replace(/\b(?:sk|pk|rk)_[A-Za-z0-9_]{8,}\b/g, () => {
        count += 1;
        return "[REDACTED]";
      }),
    (value) =>
      value.replace(/\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{10,}\b/g, () => {
        count += 1;
        return "[REDACTED]";
      }),
    (value) =>
      value.replace(
        /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
        () => {
          count += 1;
          return "[REDACTED]";
        }
      ),
    (value) =>
      value.replace(/\bAKIA[0-9A-Z]{16}\b/g, () => {
        count += 1;
        return "[REDACTED]";
      }),
    (value) =>
      value.replace(
        /\b(api[_-]?key|secret|token|password|authorization|passwd)\b(\s*[:=]\s*|\s+)(["']?)([^\s"']{4,})/gi,
        (_match, key: string, sep: string, quote: string) => {
          count += 1;
          return `${key}${sep}${quote}[REDACTED]`;
        }
      ),
    (value) =>
      value.replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, () => {
        count += 1;
        return "//[REDACTED]@";
      }),
    (value) =>
      value.replace(
        /^(export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/gm,
        (match, exp: string | undefined, name: string, raw: string) => {
          if (!isSecretName(name)) return match;
          const body = raw.trim();
          if (body.length === 0 || body === "[REDACTED]") return match;
          count += 1;
          return `${exp ?? ""}${name}=[REDACTED]`;
        }
      ),
    (value) =>
      value.replace(
        /"((?:\\.|[^"\\])*)"(\s*:\s*)"((?:\\.|[^"\\])*)"/g,
        (match, key: string, sep: string, val: string) => {
          if (!isSecretName(key) || val.length === 0 || val === "[REDACTED]") {
            return match;
          }
          count += 1;
          return `"${key}"${sep}"[REDACTED]"`;
        }
      ),
    // `config kv get --json` is exactly {"key","value"}. The value is opaque.
    (value) =>
      value.replace(
        /(\{\s*"key"\s*:\s*"(?:\\.|[^"\\])*"\s*,\s*"value"\s*:\s*")((?:\\.|[^"\\])*)("\s*\})/g,
        (match, pre: string, val: string, post: string) => {
          if (val.length === 0 || val === "[REDACTED]") return match;
          count += 1;
          return `${pre}[REDACTED]${post}`;
        }
      ),
  ];
  for (const rule of rules) out = rule(out);
  return { text: out, count };
}

export function redactArgv(argv: readonly string[]): {
  argv: string[];
  count: number;
} {
  const out: string[] = [];
  let count = 0;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    out.push(token);
    if (!SECRET_FLAGS.has(token)) continue;
    const value = argv[i + 1];
    if (value === undefined) continue;
    out.push("[REDACTED]");
    count += 1;
    i += 1;
  }
  return { argv: out, count };
}

export function clip(
  text: string,
  cap: number
): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false };
  const head = text.slice(0, Math.floor(cap * 0.7));
  const tail = text.slice(text.length - Math.floor(cap * 0.2));
  return {
    text: `${head}\n…[truncated]…\n${tail}`,
    truncated: true,
  };
}

export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Commands sometimes prefix a JSON document with a status line.
  }
  const start = trimmed.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(trimmed.slice(start)) as unknown;
  } catch {
    return null;
  }
}
