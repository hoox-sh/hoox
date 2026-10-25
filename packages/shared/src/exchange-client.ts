/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExchangeName = "binance" | "mexc" | "bybit";

export interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  testnet?: boolean;
}

export interface TradeParams {
  symbol: string;
  side: "long" | "short";
  orderType?: string;
  quantity: number;
  price?: number;
  reduceOnly?: boolean;
  leverage?: number;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  status: string;
  executedQty?: string;
  price?: string;
}

export interface Position {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  unrealizedPnl?: number;
}

// ── Exchange Provider Router (generic, cross-worker) ────────────────

/**
 * Generic exchange provider interface.
 * Workers implement this to provide exchange-specific client creation and credential validation.
 *
 * @typeParam TClient - The exchange client type (e.g., IExchangeClient)
 * @typeParam TEnv - The worker's environment/bindings type (e.g., Env)
 */
/** Options forwarded when constructing an exchange client. */
export interface ClientCreateOptions {
  /** Route orders to the exchange testnet/sandbox API. */
  testnet?: boolean;
}

export interface IExchangeProvider<TClient, TEnv> {
  readonly name: string;
  createClient(env: TEnv, options?: ClientCreateOptions): TClient;
  hasCredentials(env: TEnv): boolean;
  /**
   * Whether this exchange exposes a testnet/sandbox trading API.
   * Defaults to true when omitted; set false for live-only exchanges.
   */
  readonly supportsTestTrading?: boolean;
}

/**
 * Generic exchange router that maps exchange names to providers.
 * Workers extend or compose this to add worker-specific routing logic.
 *
 * @typeParam TClient - The exchange client type
 * @typeParam TEnv - The worker's environment type
 *
 * @example
 * ```ts
 * const router = new ExchangeRouter<IExchangeClient, Env>();
 * router.registerProvider(new BinanceProvider());
 * const { client } = router.route("binance", env);
 * ```
 */
export class ExchangeRouter<TClient, TEnv> {
  private readonly providers = new Map<
    string,
    IExchangeProvider<TClient, TEnv>
  >();

  registerProvider(provider: IExchangeProvider<TClient, TEnv>): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  route(
    exchange: string,
    env: TEnv,
    options?: ClientCreateOptions
  ): { exchange: string; client: TClient } {
    const key = exchange.toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }
    if (options?.testnet && provider.supportsTestTrading === false) {
      throw new Error(
        `TEST_TRADING_UNSUPPORTED: ${exchange} does not support test/sandbox trading via API`
      );
    }
    if (!provider.hasCredentials(env)) {
      throw new Error(
        `API secret bindings not configured or accessible for ${exchange}`
      );
    }
    return { exchange: key, client: provider.createClient(env, options) };
  }
}
