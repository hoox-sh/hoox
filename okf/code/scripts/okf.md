---
type: "Code Module"
title: "scripts/okf"
description: "OKF bundle pipeline."
resource: "scripts/okf"
tags: [code, okf, scripts]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "scripts/okf"
    title: "scripts/okf"
    author: process:git
okf_lock: generated
---

# Files

- `cli.ts`
- `compile.ts` — CompileInput, compileBundle, extractNotes, isHumanConcept
- `io.ts` — CODE_ROOTS, InputFile, STANDALONE_DOCS, applyBundle, classifyPath, collectInputs, diffBundle, readBundleFiles, readBundleFromIndex
- `lint.ts` — BundleDocs, ConceptDoc, Finding, Severity, findingLine, lintBundle, lintFiles, loadConcepts, markdownLinkTargets, readMarkdownTree, resolveBundleLink
- `query.ts` — Hit, formatHits, renderContext, searchConcepts
- `yaml.ts` — ACTOR, Frontmatter, ISO_8601, PRODUCER, asList, cmp, isRecord, parseYaml, quote, sortedUnique, splitFrontmatter, withoutStamp

# Packages

`node:child_process`, `node:crypto`, `node:fs`, `node:path`

# Used by

- [tests/okf](/code/tests/okf.md)
