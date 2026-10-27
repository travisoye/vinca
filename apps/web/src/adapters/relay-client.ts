/*
  adapters/relay-client.ts — Real VincaRelayPort implementation.

  Connects the browser workbench to the Vinca chain relay service
  (services/chain-relay). The relay provides public, unauthenticated
  blockchain data (tip height, compact block ranges, and full raw transactions
  for user-approved memo retrieval).

  Privacy & Operational Rules
  ────────────────────────────
  1. No private viewing keys, addresses, or search filters are sent to the relay.
  2. Mainnet queries are permanently blocked before any HTTP call is made.
  3. Query paths for transactions are only called upon explicit user confirmation
     via the MemoPrivacyDialog.
  4. Bounded responses: maximum block ranges and payload lengths are strictly enforced.
  5. Relay failures are explicit. Live requests never fall back to synthetic data.
*/

import type { CoverageRange, Network } from "@/types";
import type { RelayHealthReport, VincaRelayPort } from "./types";

export interface RelayClientConfig {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

const MAX_COMPACT_BLOCKS_PER_REQUEST = 1_000;
const MAX_COMPACT_BLOCK_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_TRANSACTION_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_RELAY_ERROR_BYTES = 64 * 1024;

export class RelayError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, code: string, status?: number, retryable = false) {
    super(message);
    this.name = "RelayError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export class RelayClient implements VincaRelayPort {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: RelayClientConfig) {
    const envUrl =
      typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env.VITE_RELAY_URL as string | undefined)
        : undefined;
    this.baseUrl = (config?.baseUrl ?? envUrl ?? "https://vinca-relay.onrender.com").replace(/\/+$/, "");
    this.timeoutMs = config?.timeoutMs ?? 15_000;
  }

  /**
   * Readiness check. /health only confirms that the relay process is running;
   * /ready confirms that its configured upstream can serve chain data.
   */
  async checkHealth(): Promise<RelayHealthReport> {
    const startTime = Date.now();
    try {
      const res = await this.request(`${this.baseUrl}/ready`, "application/json", true);
      const data = await res.json();
      const configuredProfiles = Array.isArray(data.configured_networks)
        ? data.configured_networks.filter(
            (network: unknown): network is Network =>
              network === "testnet" || network === "regtest",
          )
        : [];
      const testnetStatus = Array.isArray(data.upstream_status)
        ? data.upstream_status.find(
            (status: { network?: unknown }) => status.network === "testnet",
          )
        : undefined;
      const upstreamConnected = testnetStatus?.reachable === true;

      return {
        status: data.status === "ready" && upstreamConnected ? "connected" : "degraded",
        upstreamConnected,
        configuredProfiles,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      return {
        status: "unavailable",
        upstreamConnected: false,
        configuredProfiles: [],
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Retrieves the latest block height for the given network.
   * Rejects mainnet queries unconditionally.
   */
  async getTipHeight(network: Network): Promise<number> {
    this.assertValidNetwork(network);

    const res = await this.request(`${this.baseUrl}/tip/${network}`, "application/json");
    const data = await res.json();
    const height = typeof data.tip_height === "number" ? data.tip_height : data.height;
    if (!Number.isSafeInteger(height) || height < 0) {
      throw new Error("Relay returned an invalid chain tip.");
    }
    return height;
  }

  /**
   * Fetches compact blocks for the specified range as raw length-delimited protobuf bytes.
   * Query: GET /blocks/:network?start=N&end=M
   */
  async fetchCompactBlocks(network: Network, range: CoverageRange): Promise<Uint8Array> {
    this.assertValidNetwork(network);

    if (range.startHeight > range.endHeight) {
      throw new Error(`Invalid range: startHeight (${range.startHeight}) exceeds endHeight (${range.endHeight})`);
    }

    const count = range.endHeight - range.startHeight + 1;
    if (count > MAX_COMPACT_BLOCKS_PER_REQUEST) {
      throw new Error(
        `Requested range too large: ${count} blocks (maximum is ${MAX_COMPACT_BLOCKS_PER_REQUEST} blocks per request)`,
      );
    }

    const url = `${this.baseUrl}/blocks/${network}?start=${range.startHeight}&end=${range.endHeight}`;
    const res = await this.request(url, "application/octet-stream");
    const contentLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_COMPACT_BLOCK_RESPONSE_BYTES) {
      throw new Error("Relay compact-block response exceeds the 10 MiB client limit.");
    }
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_COMPACT_BLOCK_RESPONSE_BYTES) {
      throw new Error("Relay compact-block response exceeds the 10 MiB client limit.");
    }
    return new Uint8Array(body);
  }

  /**
   * Fetches raw transaction bytes for on-demand memo decryption.
   * Query: GET /tx/:network/:txIdHex
   *
   * Only called after explicit user acknowledgement of the privacy disclosure.
   */
  async fetchTransaction(network: Network, txIdHex: string): Promise<Uint8Array> {
    this.assertValidNetwork(network);

    // Validate txId format (64 hex characters)
    if (!/^[0-9a-fA-F]{64}$/.test(txIdHex)) {
      throw new RelayError(
        "Invalid transaction ID format.",
        "INVALID_TXID",
        400,
        false,
      );
    }

    return this.requestTransactionBytes(
      `${this.baseUrl}/tx/${network}/${txIdHex.toLowerCase()}`,
    );
  }

  private async requestTransactionBytes(url: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/octet-stream" },
      });

      if (!response.ok) {
        const errorBytes = await this.readBoundedResponse(response, MAX_RELAY_ERROR_BYTES);
        let body: { error_code?: unknown; message?: unknown; retry_after_secs?: unknown } = {};
        try {
          body = JSON.parse(new TextDecoder().decode(errorBytes)) as typeof body;
        } catch {
          body = {};
        }
        const code =
          typeof body.error_code === "string" && /^[A-Z0-9_]{1,64}$/.test(body.error_code)
            ? body.error_code
            : "UPSTREAM_ERROR";
        const message =
          typeof body.message === "string"
            ? body.message.slice(0, 512)
            : `Relay returned HTTP ${response.status}.`;
        throw new RelayError(
          message,
          code,
          response.status,
          response.status === 429 || response.status >= 500,
        );
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_TRANSACTION_RESPONSE_BYTES) {
        throw new RelayError(
          "Relay transaction response exceeds the 2 MiB client limit.",
          "PAYLOAD_TOO_LARGE",
          413,
          false,
        );
      }
      const bytes = await this.readBoundedResponse(response, MAX_TRANSACTION_RESPONSE_BYTES);
      if (bytes.length === 0) {
        throw new RelayError(
          "Relay returned an empty transaction response.",
          "EMPTY_TRANSACTION",
          502,
          true,
        );
      }
      return bytes;
    } catch (error) {
      if (error instanceof RelayError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new RelayError(
          "Relay request timed out while receiving transaction data.",
          "UPSTREAM_TIMEOUT",
          504,
          true,
        );
      }
      throw new RelayError(
        "Relay request failed; no chain data was returned.",
        "RELAY_UNAVAILABLE",
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readBoundedResponse(response: Response, maxBytes: number): Promise<Uint8Array> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new RelayError(
        "Relay response streaming is unavailable; the response was not buffered.",
        "RESPONSE_STREAM_UNAVAILABLE",
        response.status,
        true,
      );
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RelayError(
          maxBytes === MAX_TRANSACTION_RESPONSE_BYTES
            ? "Relay transaction response exceeds the 2 MiB client limit."
            : "Relay error response exceeds the bounded error limit.",
          maxBytes === MAX_TRANSACTION_RESPONSE_BYTES ? "PAYLOAD_TOO_LARGE" : "ERROR_BODY_TOO_LARGE",
          maxBytes === MAX_TRANSACTION_RESPONSE_BYTES ? 413 : response.status,
          false,
        );
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  private async request(
    url: string,
    accept: string,
    allowDegradedReadiness = false,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: accept },
      });
      if (!response.ok && !(allowDegradedReadiness && response.status === 503)) {
        throw new Error(`Relay returned HTTP ${response.status}.`);
      }
      return response;
    } catch (error) {
      if (error instanceof RelayError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new RelayError(
          "Relay request timed out; no chain data was returned.",
          "UPSTREAM_TIMEOUT",
          504,
          true,
        );
      }
      throw new RelayError(
        "Relay request failed or timed out; no chain data was returned.",
        "RELAY_UNAVAILABLE",
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private assertValidNetwork(network: string): void {
    const net = network.toLowerCase();
    if (net === "mainnet" || net === "main" || net === "live") {
      throw new Error("[MAINNET_REJECTED] Mainnet queries are permanently disabled.");
    }
    if (net !== "testnet" && net !== "regtest") {
      throw new Error(`Unsupported network: ${network}. Vinca only supports testnet and regtest.`);
    }
  }

}

/** Singleton default relay client */
let _relayInstance: RelayClient | null = null;

export function getRelayClient(): RelayClient {
  if (!_relayInstance) {
    _relayInstance = new RelayClient();
  }
  return _relayInstance;
}
