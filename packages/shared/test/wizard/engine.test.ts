/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { WizardEngine } from "../../src/wizard/engine";

describe("WizardEngine", () => {
  it("starts at PREREQUISITES step", () => {
    const engine = new WizardEngine();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
  });

  it("canProceed is false on initial state", () => {
    const engine = new WizardEngine();
    expect(engine.canProceed()).toBe(false);
  });

  it("advances to next step after execute succeeds", () => {
    const engine = new WizardEngine();
    const errors = engine.execute({ checksPassed: true });
    expect(errors).toEqual([]);
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG");
  });

  it("canGoBack is false on PREREQUISITES", () => {
    const engine = new WizardEngine();
    expect(engine.canGoBack()).toBe(false);
  });

  it("canGoBack is true after advancing", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    expect(engine.canGoBack()).toBe(true);
  });

  it("goBack returns to previous step", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.goBack();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
  });

  it("returns validation errors for CLOUDFLARE_CONFIG with empty input", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    const errors = engine.execute({});
    expect(errors.length).toBeGreaterThan(0);
    // didn't advance
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG");
  });

  it("accepts non-hex but non-empty account ID (engine only validates required)", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    const errors = engine.execute({
      apiToken: "tok_xxx",
      accountId: "my-account-id-string",
      secretStoreId: "",
      subdomain: "myapp",
    });
    expect(errors.length).toBe(0);
    expect(engine.getCurrentStep().id).toBe("WORKER_SELECTION");
  });

  it("buildConfig returns valid WorkersJsonConfig after minimal preset", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "minimal" });
    const config = engine.buildConfig();
    expect(config.global.cloudflare_account_id).toBe(
      "abc123def456abc123def456abc123de"
    );
    expect(config.global.subdomain_prefix).toBe("myapp");
    expect(config.global.cloudflare_api_token).toBe(
      "<USE_CLOUDFLARE_API_TOKEN_ENV_OR_WRANGLER_AUTH>"
    );
    expect(config.global.cloudflare_api_token).not.toBe("test-token");
    expect(Object.keys(config.workers).length).toBeGreaterThan(0);
    expect(config.workers["d1-worker"]).toBeDefined();
    expect(config.workers.hoox).toBeDefined();
    expect(config.workers["d1-worker"]?.vars.database_name).toBe(
      "trade-data-db"
    );
  });

  it("reset clears all state", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.reset();
    expect(engine.getCurrentStep().id).toBe("PREREQUISITES");
    expect(engine.getState().completedSteps).toEqual([]);
  });

  it("returns selected integrations from standard preset", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "standard" });
    const state = engine.getState();
    expect(state.selectedIntegrations).toContain("exchange");
    expect(state.selectedIntegrations).toContain("telegram");
  });

  it("getProvisioningPlan returns databases for selected workers", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({ preset: "standard" });
    const plan = engine.getProvisioningPlan();
    expect(plan.d1Databases).toContain("trade-data-db");
    expect(plan.kvNamespaces).toContain("CONFIG_KV");
    expect(plan.vectorizeIndexes).toContain("hoox-rag-index");
  });

  it("loads from existing state", () => {
    const existingState = {
      step: "CLOUDFLARE_CONFIG" as const,
      completedSteps: ["PREREQUISITES" as const],
      selectedWorkers: [],
      selectedIntegrations: [],
      secrets: {},
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    const engine = new WizardEngine(existingState);
    expect(engine.getCurrentStep().id).toBe("CLOUDFLARE_CONFIG");
    expect(engine.getCompletedSteps()).toContain("PREREQUISITES");
  });

  it("allows custom worker selection", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "test-token",
      accountId: "abc123def456abc123def456abc123de",
      secretStoreId: "",
      subdomain: "myapp",
    });
    engine.execute({
      preset: "custom",
      workers: ["trade-worker"],
      integrations: ["exchange"],
    });
    const state = engine.getState();
    expect(state.selectedWorkers).toContain("trade-worker");
    expect(state.selectedWorkers).toContain("d1-worker"); // auto-resolved
    expect(state.selectedIntegrations).toContain("exchange");
  });

  it("rejects custom preset with empty workers", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "tok",
      accountId: "acct",
      secretStoreId: "",
      subdomain: "app",
    });
    const errors = engine.execute({ preset: "custom", workers: [] });
    expect(errors.some((e) => e.includes("At least one worker"))).toBe(true);
    expect(engine.getCurrentStep().id).toBe("WORKER_SELECTION");
  });

  it("validates secrets for selected integrations", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "tok",
      accountId: "acct",
      secretStoreId: "",
      subdomain: "app",
    });
    engine.execute({
      preset: "custom",
      workers: ["trade-worker"],
      integrations: ["exchange"],
    });
    // Optional provisioning
    engine.execute({});
    expect(engine.getCurrentStep().id).toBe("SECRETS");
    // Empty secrets object for exchange should error required fields
    const errors = engine.execute({
      secrets: {
        exchange: {
          EXCHANGE_KEY_BINDING: "",
          EXCHANGE_SECRET_BINDING: "  ",
        },
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /Exchange|API Key|API Secret/i.test(e))).toBe(
      true
    );
    expect(engine.getCurrentStep().id).toBe("SECRETS");

    // Empty secrets map is allowed (skip-style)
    const skip = engine.execute({ secrets: {} });
    expect(skip).toEqual([]);
  });

  it("accepts filled secrets and advances past SECRETS", () => {
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: "tok",
      accountId: "acct",
      secretStoreId: "",
      subdomain: "app",
    });
    engine.execute({
      preset: "custom",
      workers: ["trade-worker"],
      integrations: ["exchange"],
    });
    engine.execute({}); // provisioning
    const errors = engine.execute({
      secrets: {
        exchange: {
          EXCHANGE_KEY_BINDING: "key-value",
          EXCHANGE_SECRET_BINDING: "sec-value",
        },
      },
    });
    expect(errors).toEqual([]);
    expect(engine.getCurrentStep().id).toBe("CONFIG_WRITE");
    expect(engine.getState().secrets.exchange?.EXCHANGE_KEY_BINDING).toBe(
      "key-value"
    );
  });
});
