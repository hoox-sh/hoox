/**
 * Copyright (c) 2026 HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Draft an OKF v0.2 bundle from the working tree.
 *
 * One concept per source directory and per document. Imports become absolute
 * concept links. Module prose is the first non-license comment, so the bundle
 * is a compiled cache: deterministic, reviewable, and safe to refresh on
 * every commit. Human-locked concepts (`okf_lock: human`) are never rewritten.
 */

import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { InputFile } from "./io";
import {
  isRecord,
  parseYaml,
  PRODUCER,
  quote,
  sortedUnique,
  splitFrontmatter,
  withoutStamp,
} from "./yaml";

export type CompileInput = {
  files: InputFile[];
  existing: Map<string, string>;
  now: string;
};

type ParsedCode = {
  path: string;
  exports: string[];
  localImports: string[];
  packages: string[];
  note: string;
};

type Module = {
  dir: string;
  files: ParsedCode[];
  others: string[];
  depends: string[];
  usedBy: string[];
  nested: string[];
  packages: string[];
  role: string;
  description: string;
};

type DocConcept = {
  path: string;
  bundlePath: string;
  title: string;
  description: string;
  headings: { depth: number; text: string }[];
  mentions: string[];
};

const LICENSE =
  /copyright|spdx|affero|general public license|all rights reserved|free software|warranty|merchantability|this file is part of|any later version|at your option|along with |should have received|software foundation|either version|published by the|distributed in the hope|fitness for a particular|for more details|gnu\.org\/licenses/i;
const CODE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".py"];

function plain(text: string): string {
  return text
    .replace(/\{@link\s+([^}]+)\}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function oneLine(text: string, max: number): string {
  const flat = plain(text);
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1).replace(/\s+\S*$/, "");
  return `${cut || flat.slice(0, max - 1)}…`;
}

export function extractNotes(text: string, ext: string): string[] {
  const notes: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (
    i < lines.length &&
    (lines[i]?.trim() === "" || lines[i]?.startsWith("#!"))
  )
    i += 1;
  while (i < lines.length && i < 160) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "") {
      i += 1;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      const buf: string[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        buf.push(
          current
            .replace(/^\s*\/\*\*? ?/, "")
            .replace(/\*\/\s*$/, "")
            .replace(/^\s*\* ?/, "")
        );
        i += 1;
        if (current.includes("*/")) break;
      }
      const note = usefulComment(buf);
      if (note) notes.push(note);
      continue;
    }
    if (trimmed.startsWith("//")) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("//")) {
        buf.push((lines[i] ?? "").replace(/^\s*\/\/ ?/, ""));
        i += 1;
      }
      const note = usefulComment(buf);
      if (note) notes.push(note);
      continue;
    }
    if ((ext === ".py" || ext === ".sh") && /^#(?!\[)/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^#(?!\[)/.test((lines[i] ?? "").trim())) {
        buf.push((lines[i] ?? "").replace(/^\s*# ?/, ""));
        i += 1;
      }
      const note = usefulComment(buf);
      if (note) notes.push(note);
      continue;
    }
    break;
  }
  return notes;
}

function usefulComment(lines: string[]): string {
  const kept = lines
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !LICENSE.test(line) &&
        !/free software|warranty|redistribute|merCHANTABILITY|this file is part of/i.test(
          line
        )
    );
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function firstSentence(note: string): string {
  const cleaned = note
    .replace(/\{@link\s+([^}]+)\}/g, "$1")
    .replace(/@module\s+\S+/g, "")
    .trim();
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  return oneLine((match?.[1] ?? cleaned).trim(), 180);
}

function affinity(dir: string, file: ParsedCode): number {
  const base = posix
    .basename(file.path)
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  const compact = base.replace(/[^a-z0-9]/g, "");
  const leaf = posix
    .basename(dir)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  let score = 0;
  if (base === "index" || base === "main" || base === "mod" || base === "lib")
    score += 1000;
  if (base === "cli") score += 600;
  if (compact === leaf) score += 900;
  if (compact === `${leaf}host` || compact === `${leaf}app`) score += 850;
  const token = posix
    .basename(file.path)
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  if (
    leaf.length >= 3 &&
    (token === leaf ||
      token.startsWith(`${leaf}-`) ||
      token.startsWith(`${leaf}_`))
  ) {
    score += 700 - Math.min(token.length - leaf.length, 200);
  } else if (leaf.length >= 4 && compact.includes(leaf)) score += 400;
  if (leaf.length >= 3 && file.note.toLowerCase().includes(leaf)) score += 120;
  return (
    score +
    Math.min(file.note.length, 800) / 4 +
    Math.min(file.exports.length, 6)
  );
}

function parseExports(text: string, ext: string): string[] {
  const names = new Set<string>();
  if (ext === ".rs") {
    for (const match of text.matchAll(
      /\bpub(?:\([^)]*\))?\s+(?:async\s+)?(?:fn|struct|enum|mod|trait|const|type|static)\s+([A-Za-z0-9_]+)/g
    )) {
      if (match[1]) names.add(match[1]);
    }
    return [...names].sort();
  }
  if (ext === ".py") {
    for (const match of text.matchAll(
      /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)|^class\s+([A-Za-z_][A-Za-z0-9_]*)/gm
    )) {
      const name = match[1] ?? match[2];
      if (name && !name.startsWith("_")) names.add(name);
    }
    return [...names].sort();
  }
  for (const match of text.matchAll(
    /export\s+(?:async\s+)?(?:function\*?|class|const|let|var|type|interface|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of text.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const piece = part.trim();
      if (!piece) continue;
      const alias = piece.split(/\s+as\s+/);
      const name = (alias[1] ?? alias[0] ?? "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const match of text.matchAll(
    /export\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    if (match[1]) names.add(match[1]);
  }
  return [...names].sort();
}

function parseImports(text: string): { local: string[]; packages: string[] } {
  const specs = new Set<string>();
  for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g))
    if (match[1]) specs.add(match[1]);
  for (const match of text.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g))
    if (match[1]) specs.add(match[1]);
  for (const match of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g))
    if (match[1]) specs.add(match[1]);
  const local: string[] = [];
  const packages: string[] = [];
  for (const spec of specs) {
    if (spec.startsWith(".")) local.push(spec);
    else packages.push(spec);
  }
  return { local, packages };
}

function extOf(path: string): string {
  const base = posix.basename(path);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot);
}

function parseCode(file: InputFile): ParsedCode {
  const ext = extOf(file.path);
  const notes = extractNotes(file.text, ext);
  const imports = parseImports(file.text);
  return {
    path: file.path,
    exports: parseExports(file.text, ext).slice(0, 12),
    localImports: imports.local,
    packages: imports.packages,
    note: notes[0] ?? "",
  };
}

function resolveImport(
  fromFile: string,
  spec: string,
  known: Set<string>
): string | null {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const candidates = [base];
  for (const ext of CODE_EXT) {
    candidates.push(base + ext);
    candidates.push(posix.join(base, `index${ext}`));
  }
  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

function moduleId(dir: string): string {
  return `code/${dir}`;
}

function docBundlePath(repoPath: string): string {
  if (repoPath.startsWith("docs/")) return repoPath.replace(/\.mdx?$/, ".md");
  const base = posix
    .basename(repoPath)
    .replace(/\.mdx?$/, "")
    .toLowerCase();
  const dir = posix.dirname(repoPath);
  if (dir === ".") return `repository/${base}.md`;
  return `repository/${dir}/${base}.md`;
}

function fenceAwareLines(text: string): string[] {
  const out: string[] = [];
  let fence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (!fence) out.push(line);
  }
  return out;
}

function stripDocBanner(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  const first = lines[0] ?? "";
  if (
    first.startsWith("# Copyright") ||
    first.startsWith("# SPDX") ||
    first.startsWith("<!--")
  ) {
    while (i < lines.length) {
      const line = lines[i] ?? "";
      if (
        line.startsWith("#") ||
        line.trim() === "" ||
        line.startsWith("<!--") ||
        line.startsWith("-->")
      ) {
        i += 1;
        continue;
      }
      break;
    }
  }
  return lines.slice(i).join("\n");
}

function docFrontmatter(text: string): {
  title: string;
  description: string;
  body: string;
} {
  const { yaml, body } = splitFrontmatter(stripDocBanner(text));
  let title = "";
  let description = "";
  if (yaml) {
    try {
      const parsed = parseYaml(yaml);
      if (isRecord(parsed)) {
        if (typeof parsed.title === "string") title = parsed.title;
        if (typeof parsed.description === "string")
          description = parsed.description;
      }
    } catch {
      // a doc with broken frontmatter still gets an outline
    }
  }
  return { title, description, body };
}

function buildDocs(files: InputFile[], modules: Set<string>): DocConcept[] {
  const docs: DocConcept[] = [];
  for (const file of files) {
    if (file.kind !== "doc" || !file.text) continue;
    const meta = docFrontmatter(file.text);
    const lines = fenceAwareLines(meta.body);
    const headings: { depth: number; text: string }[] = [];
    for (const line of lines) {
      const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
      if (!match?.[2] || !match[1]) continue;
      headings.push({ depth: match[1].length, text: plain(match[2]) });
      if (headings.length >= 40) break;
    }
    const h1 =
      lines
        .map((line) => /^#\s+(.+)$/.exec(line.trim())?.[1]?.trim())
        .find(Boolean) ?? "";
    const paragraph = lines
      .map((line) => line.trim())
      .find(
        (line) =>
          line.length > 40 &&
          !line.startsWith("#") &&
          !line.startsWith("|") &&
          !line.startsWith("-") &&
          !LICENSE.test(line)
      );
    const title = meta.title || h1 || posix.basename(file.path);
    const description = oneLine(
      meta.description || paragraph || `${file.path} document.`,
      180
    );
    const mentions = new Set<string>();
    for (const match of file.text.matchAll(
      /\b((?:src|worker|packages|tests|e2e|scripts|src-tauri)\/[A-Za-z0-9_./-]+)/g
    )) {
      const raw = (match[1] ?? "")
        .replace(/[.),:;`]+$/, "")
        .replace(/\.(?:mdx|md|ts|tsx|js|mjs)$/, "");
      const dir = raw.includes(".") ? posix.dirname(raw) : raw;
      if (modules.has(dir)) mentions.add(dir);
      else if (modules.has(posix.dirname(dir)))
        mentions.add(posix.dirname(dir));
    }
    docs.push({
      path: file.path,
      bundlePath: docBundlePath(file.path),
      title,
      description:
        description.endsWith(".") || description.endsWith("…")
          ? description
          : `${description}.`,
      headings,
      mentions: sortedUnique(mentions),
    });
  }
  return docs.sort((a, b) => (a.bundlePath < b.bundlePath ? -1 : 1));
}

function buildModules(files: InputFile[]): Module[] {
  const code = files.filter((file) => file.kind === "code" && file.text);
  const known = new Set(code.map((file) => file.path));
  const byDir = new Map<string, { parsed: ParsedCode[]; others: string[] }>();
  const ensure = (dir: string) => {
    let bucket = byDir.get(dir);
    if (!bucket) {
      bucket = { parsed: [], others: [] };
      byDir.set(dir, bucket);
    }
    return bucket;
  };
  for (const file of code) {
    ensure(posix.dirname(file.path)).parsed.push(parseCode(file));
  }
  for (const file of files) {
    if (file.kind !== "other") continue;
    const dir = posix.dirname(file.path);
    if (byDir.has(dir)) ensure(dir).others.push(posix.basename(file.path));
  }
  const dirs = [...byDir.keys()];
  const modules: Module[] = [];
  for (const dir of dirs) {
    const bucket = byDir.get(dir);
    if (!bucket) continue;
    const depends = new Set<string>();
    const packages = new Set<string>();
    for (const parsed of bucket.parsed) {
      for (const spec of parsed.localImports) {
        const resolved = resolveImport(parsed.path, spec, known);
        if (!resolved) continue;
        const target = posix.dirname(resolved);
        if (target !== dir) depends.add(target);
      }
      for (const spec of parsed.packages) packages.add(spec);
    }
    const parsed = bucket.parsed.sort((a, b) => (a.path < b.path ? -1 : 1));
    const ranked = parsed
      .filter((file) => file.note)
      .map((file) => ({ file, score: affinity(dir, file) }))
      .sort(
        (a, b) => b.score - a.score || (a.file.path < b.file.path ? -1 : 1)
      );
    const best = ranked[0];
    const useNote = !!best && (best.score >= 400 || ranked.length === 1);
    const role = useNote && best ? oneLine(best.file.note, 500) : "";
    const sentence = useNote && best ? firstSentence(best.file.note) : "";
    const description =
      sentence.length >= 16 ? sentence : fallbackDescription(dir, parsed);
    modules.push({
      dir,
      files: parsed,
      others: sortedUnique(bucket.others),
      depends: sortedUnique(depends),
      usedBy: [],
      nested: directModuleChildren(dir, dirs),
      packages: sortedUnique(packages).slice(0, 16),
      role,
      description:
        description.endsWith(".") || description.endsWith("…")
          ? description
          : `${description}.`,
    });
  }
  const byDirModule = new Map(modules.map((mod) => [mod.dir, mod]));
  for (const mod of modules) {
    for (const dep of mod.depends) byDirModule.get(dep)?.usedBy.push(mod.dir);
  }
  for (const mod of modules) mod.usedBy = sortedUnique(mod.usedBy);
  return modules.sort((a, b) => (a.dir < b.dir ? -1 : 1));
}

function fallbackDescription(dir: string, files: ParsedCode[]): string {
  const names = files.map((file) => posix.basename(file.path)).slice(0, 3);
  const extra = files.length - names.length;
  if (names.length === 0)
    return `${dir} contains ${files.length} source file${files.length === 1 ? "" : "s"}.`;
  if (extra > 0)
    return `${dir} contains ${names.join(", ")}, and ${extra} more file${extra === 1 ? "" : "s"}.`;
  return `${dir} contains ${names.join(", ")}.`;
}

function directModuleChildren(dir: string, dirs: string[]): string[] {
  const prefix = `${dir}/`;
  return dirs
    .filter(
      (candidate) =>
        candidate.startsWith(prefix) &&
        !candidate.slice(prefix.length).includes("/")
    )
    .sort();
}

function conceptHeader(opts: {
  type: string;
  title: string;
  description: string;
  resource: string;
  tags: string[];
  now: string;
  sourceTitle: string;
}): string {
  const tags = opts.tags.filter((tag) => /^[a-z0-9-]+$/.test(tag));
  return [
    "---",
    `type: ${quote(opts.type)}`,
    `title: ${quote(opts.title)}`,
    `description: ${quote(opts.description)}`,
    `resource: ${quote(opts.resource)}`,
    `tags: [${tags.join(", ")}]`,
    "status: stable",
    "generated:",
    `  by: ${PRODUCER}`,
    `  at: ${opts.now}`,
    "sources:",
    "  - id: tree",
    `    resource: ${quote(opts.resource)}`,
    `    title: ${quote(opts.sourceTitle)}`,
    "    author: process:git",
    "okf_lock: generated",
    "---",
    "",
  ].join("\n");
}

function mdDest(url: string): string {
  return /[()\s]/.test(url) ? `<${url}>` : url;
}

// Bullets are "-", not "*": prettier's markdown printer normalizes list
// markers to "-", and the bundle is committed, so it must pass `prettier
// --check` without a post-generation formatting pass.
function linkList(dirs: string[], label: (dir: string) => string): string {
  return dirs
    .map((dir) => `- [${label(dir)}](${mdDest(`/${moduleId(dir)}.md`)})`)
    .join("\n");
}

function renderModule(mod: Module, now: string): string {
  const lines = [
    conceptHeader({
      type: "Code Module",
      title: mod.dir,
      description: mod.description,
      resource: mod.dir,
      tags: tagsFor(mod.dir, "code"),
      now,
      sourceTitle: mod.dir,
    }),
  ];
  if (mod.role && firstSentence(mod.role) !== mod.description) {
    lines.push("# Role", "", mod.role, "");
  }
  lines.push("# Files", "");
  for (const file of mod.files) {
    const name = posix.basename(file.path);
    const exports =
      file.exports.length > 0 ? ` — ${file.exports.join(", ")}` : "";
    lines.push(`- \`${name}\`${exports}`);
  }
  if (mod.others.length > 0) {
    lines.push("", "# Other files", "");
    for (const name of mod.others) lines.push(`- \`${name}\``);
  }
  if (mod.packages.length > 0) {
    lines.push(
      "",
      "# Packages",
      "",
      mod.packages.map((name) => `\`${name}\``).join(", ")
    );
  }
  if (mod.depends.length > 0) {
    lines.push(
      "",
      "# Depends on",
      "",
      linkList(mod.depends, (dir) => dir)
    );
  }
  if (mod.usedBy.length > 0) {
    lines.push(
      "",
      "# Used by",
      "",
      linkList(mod.usedBy, (dir) => dir)
    );
  }
  if (mod.nested.length > 0) {
    lines.push(
      "",
      "# Nested",
      "",
      linkList(mod.nested, (dir) => dir)
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderDoc(doc: DocConcept, now: string): string {
  const lines = [
    conceptHeader({
      type: "Document",
      title: doc.title,
      description: doc.description,
      resource: doc.path,
      tags: tagsFor(doc.path, "doc"),
      now,
      sourceTitle: doc.path,
    }),
    "# Source",
    "",
    `Repo path \`${doc.path}\`.`,
    "",
  ];
  if (doc.headings.length > 0) {
    lines.push("# Outline", "");
    // Indent relative to the shallowest heading in this doc, and never deeper
    // than one level below the previous item: prettier re-normalizes any other
    // shape (e.g. a 2-space first item with no parent) on `--check`.
    const baseDepth = Math.min(...doc.headings.map((heading) => heading.depth));
    let prevLevel = -1;
    for (const heading of doc.headings) {
      const level = Math.min(
        Math.max(heading.depth - baseDepth, 0),
        prevLevel + 1
      );
      lines.push(`${"  ".repeat(level)}- ${heading.text}`);
      prevLevel = level;
    }
    lines.push("");
  }
  if (doc.mentions.length > 0) {
    lines.push(
      "# Mentions",
      "",
      linkList(doc.mentions, (dir) => dir),
      ""
    );
  }
  return lines.join("\n");
}

function tagsFor(path: string, kind: string): string[] {
  const parts = path
    .replace(/\.(mdx|md)$/, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "src")
    .slice(0, 3)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter((part) => /^[a-z0-9-]+$/.test(part));
  return sortedUnique([kind, ...parts]).slice(0, 6);
}

type Indexed = { path: string; title: string; description: string };

function renderIndexes(
  items: Indexed[],
  human: Indexed[]
): Map<string, string> {
  const all = [...items, ...human];
  const byParent = new Map<string, Indexed[]>();
  for (const item of all) {
    const parent = posix.dirname(item.path);
    const list = byParent.get(parent) ?? [];
    list.push(item);
    byParent.set(parent, list);
  }
  const dirs = new Set<string>();
  for (const item of all) {
    let parent = posix.dirname(item.path);
    while (parent !== "." && parent !== "") {
      dirs.add(parent);
      parent = posix.dirname(parent);
    }
  }
  const indexes = new Map<string, string>();
  const dirList = [...dirs].sort();
  for (const dir of dirList) {
    const concepts = (byParent.get(dir) ?? []).sort((a, b) =>
      a.path < b.path ? -1 : 1
    );
    const children = dirList.filter(
      (candidate) => posix.dirname(candidate) === dir
    );
    const lines = [`# ${dir}`, ""];
    if (concepts.length > 0) {
      lines.push("# Concepts", "");
      for (const concept of concepts) {
        lines.push(
          `- [${concept.title}](${mdDest(posix.basename(concept.path))}) - ${concept.description}`
        );
      }
      lines.push("");
    }
    if (children.length > 0) {
      lines.push("# Nested", "");
      for (const child of children) {
        const nestedConcept = all.find((item) => item.path === `${child}.md`);
        const blurb = nestedConcept?.description ?? "Nested concepts.";
        lines.push(
          `- [${posix.basename(child)}](${mdDest(`${posix.basename(child)}/`)}) - ${blurb}`
        );
      }
      lines.push("");
    }
    indexes.set(`${dir}/index.md`, lines.join("\n"));
  }
  indexes.set("index.md", renderRoot(dirs, all));
  return indexes;
}

function renderRoot(dirs: Set<string>, all: Indexed[]): string {
  const preferred = ["playbooks", "code", "docs", "repository"];
  const seen = new Set<string>();
  const top: string[] = [];
  const consider = (name: string | undefined) => {
    if (!name || seen.has(name)) return;
    if (
      !dirs.has(name) &&
      !all.some(
        (item) => item.path === `${name}.md` || item.path.startsWith(`${name}/`)
      )
    )
      return;
    seen.add(name);
    top.push(name);
  };
  for (const name of preferred) consider(name);
  for (const item of all) {
    const parent = posix.dirname(item.path);
    consider(
      parent === "." ? posix.basename(item.path, ".md") : parent.split("/")[0]
    );
  }
  const blurbs: Record<string, string> = {
    playbooks: "How to read this bundle and where HOOX keeps its map.",
    code: "Compiled map of source modules, imports, and exports.",
    docs: "Outlines of the product documentation.",
    repository: "README, contributing, security, and package notes.",
  };
  const lines = [
    "---",
    'okf_version: "0.2"',
    "---",
    "",
    "# HOOX knowledge bundle",
    "",
  ];
  for (const name of top) {
    lines.push(`# ${name[0]?.toUpperCase()}${name.slice(1)}`, "");
    if (dirs.has(name)) {
      lines.push(
        `- [${name}](${mdDest(`${name}/`)}) - ${blurbs[name] ?? "Concepts in this section."}`
      );
    }
    const rooted = all.filter(
      (item) => item.path === `${name}.md` || posix.dirname(item.path) === name
    );
    if (!dirs.has(name)) {
      for (const item of rooted) {
        lines.push(
          `- [${item.title}](${mdDest(posix.basename(item.path))}) - ${item.description}`
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderLog(
  previous: string | undefined,
  digest: string,
  now: string,
  modules: number,
  docs: number
): string {
  if (previous?.includes(`digest \`${digest}\``)) return previous;
  const day = now.slice(0, 10);
  const verb = previous ? "Update" : "Initialization";
  const bullet = `- **${verb}**: Compiled ${modules} code modules and ${docs} documents (digest \`${digest}\`).`;
  const kept = previous
    ? previous
        .replace(/\r\n/g, "\n")
        .replace(new RegExp(`## ${day}\\n(?:(?!## ).*\\n)*`), "")
        .replace(/^# .+\n+/, "")
        .trim()
    : "";
  const sections = [`## ${day}`, "", bullet];
  if (kept) sections.push("", kept);
  return `# Bundle update log\n\n${sections.join("\n")}\n`;
}

function humanConcepts(existing: Map<string, string>): {
  keep: Map<string, string>;
  indexed: Indexed[];
} {
  const keep = new Map<string, string>();
  const indexed: Indexed[] = [];
  for (const [path, text] of existing) {
    const kind = classifyExisting(text);
    if (kind !== "human" && kind !== "keep") continue;
    if (
      posix.basename(path) === "index.md" ||
      posix.basename(path) === "log.md"
    ) {
      if (kind === "human") keep.set(path, text);
      continue;
    }
    keep.set(path, text);
    if (kind !== "human") continue;
    const { yaml } = splitFrontmatter(text);
    let title = path.replace(/\.md$/, "");
    let description = "Curated concept.";
    if (yaml) {
      try {
        const parsed = parseYaml(yaml);
        if (isRecord(parsed)) {
          if (typeof parsed.title === "string") title = parsed.title;
          if (typeof parsed.description === "string")
            description = parsed.description;
        }
      } catch {
        // kept, but not indexed if it will not lint
      }
    }
    indexed.push({ path, title, description: oneLine(description, 180) });
  }
  return { keep, indexed };
}

export function isHumanConcept(text: string): boolean {
  return classifyExisting(text) === "human";
}

function classifyExisting(text: string): "human" | "generated" | "keep" {
  const { yaml } = splitFrontmatter(text);
  if (yaml == null) return "generated";
  try {
    const parsed = parseYaml(yaml);
    if (!isRecord(parsed)) return "keep";
    if (parsed.okf_lock === "human") return "human";
    if (
      isRecord(parsed.generated) &&
      typeof parsed.generated.by === "string" &&
      parsed.generated.by.startsWith("human:")
    ) {
      return "human";
    }
    if (parsed.okf_lock === "generated") return "generated";
    if (isRecord(parsed.generated) && parsed.generated.by === PRODUCER)
      return "generated";
    if ("okf_version" in parsed) return "generated";
    return "keep";
  } catch {
    return "keep";
  }
}

function digestOf(files: Map<string, string>): string {
  const hash = createHash("sha256");
  for (const key of [...files.keys()].sort()) {
    if (key === "log.md") continue;
    hash.update(key);
    hash.update("\0");
    hash.update(withoutStamp(files.get(key) ?? ""));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

function preferPrevious(
  path: string,
  fresh: string,
  existing: Map<string, string>
): string {
  const previous = existing.get(path);
  if (previous && withoutStamp(previous) === withoutStamp(fresh))
    return previous;
  return fresh;
}

export function compileBundle(input: CompileInput): Map<string, string> {
  const modules = buildModules(input.files);
  const moduleDirs = new Set(modules.map((mod) => mod.dir));
  const docs = buildDocs(input.files, moduleDirs);
  const humans = humanConcepts(input.existing);
  const next = new Map<string, string>();

  const indexed: Indexed[] = [];
  for (const mod of modules) {
    const path = `${moduleId(mod.dir)}.md`;
    if (humans.keep.has(path)) continue;
    const fresh = renderModule(mod, input.now);
    next.set(path, preferPrevious(path, fresh, input.existing));
    indexed.push({ path, title: mod.dir, description: mod.description });
  }
  for (const doc of docs) {
    if (humans.keep.has(doc.bundlePath)) continue;
    const fresh = renderDoc(doc, input.now);
    next.set(
      doc.bundlePath,
      preferPrevious(doc.bundlePath, fresh, input.existing)
    );
    indexed.push({
      path: doc.bundlePath,
      title: doc.title,
      description: doc.description,
    });
  }
  for (const [path, text] of humans.keep) next.set(path, text);

  const indexes = renderIndexes(indexed, humans.indexed);
  for (const [path, text] of indexes) {
    if (humans.keep.has(path)) continue;
    next.set(path, text);
  }
  const digest = digestOf(next);
  const logPath = "log.md";
  if (!humans.keep.has(logPath)) {
    next.set(
      logPath,
      renderLog(
        input.existing.get(logPath),
        digest,
        input.now,
        modules.length,
        docs.length
      )
    );
  }
  return next;
}
