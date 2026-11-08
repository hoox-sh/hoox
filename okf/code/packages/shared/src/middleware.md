---
type: "Code Module"
title: "packages/shared/src/middleware"
description: "Barrel exports for shared middleware."
resource: "packages/shared/src/middleware"
tags: [code, middleware, packages, shared]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "packages/shared/src/middleware"
    title: "packages/shared/src/middleware"
    author: process:git
okf_lock: generated
---

# Role

Barrel exports for shared middleware

# Files

- `auth.ts` — InternalAuthEnv, InternalAuthKeyName, OperatorAuthEnv, checkInternalAuth, collectInternalAuthKeys, createInternalAuthMiddleware, createOperatorAuthMiddleware, requireAuth, requireInternalAuth, requireOperatorAuth, resolveOperatorApiKey, timingSafeEqual
- `cors.ts` — CorsEnv, CorsOptions, corsHeaders, handleCorsPreflightRequest, internalCorsHeaders, publicCorsHeaders, resolveCorsOptions
- `index.ts` — DEFAULT_MAX_JSON_BODY_BYTES, SECURITY_HEADERS_DEFAULTS, checkInternalAuth, collectInternalAuthKeys, corsHeaders, createInternalAuthMiddleware, createLogger, createOperatorAuthMiddleware, createRateLimiter, handleCorsPreflightRequest, internalCorsHeaders, optionalField
- `logger.ts` — LogContext, Logger, createLogger, withRequestLog
- `rate-limit.ts` — RateLimitConfig, RateLimiter, createRateLimiter
- `security-headers.ts` — SECURITY_HEADERS_DEFAULTS, SecurityHeadersOptions, secureHeaders, wrapWithSecurityHeaders
- `validate.ts` — DEFAULT_MAX_JSON_BODY_BYTES, ParseJsonBodyOptions, optionalField, parseJsonBody, requireField, validateJson, validateJsonLegacy
- `wait-until.ts` — WaitUntilHost, safeWaitUntil, waitUntilAll

# Packages

`@hoox-sh/hoox-shared/middleware`, `zod`

# Depends on

- [packages/shared/src](/code/packages/shared/src.md)
- [packages/shared/src/types](/code/packages/shared/src/types.md)

# Used by

- [packages/shared/src](/code/packages/shared/src.md)
