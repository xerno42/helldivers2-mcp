import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Stateless single-request transport for environments without a Node http server
 * (e.g. Cloudflare Workers). One transport instance handles exactly one inbound
 * JSON-RPC message and resolves with the server's outbound response.
 */
export class WorkerTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  private resolver?: (message: JSONRPCMessage) => void;
  private settled = false;

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.settled || !this.resolver) return;
    this.settled = true;
    const r = this.resolver;
    this.resolver = undefined;
    r(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  dispatch(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    return new Promise<JSONRPCMessage>((resolve, reject) => {
      if (!this.onmessage) {
        reject(new Error('Transport not connected: onmessage handler missing'));
        return;
      }
      this.resolver = resolve;
      try {
        this.onmessage(message);
      } catch (err) {
        this.settled = true;
        this.resolver = undefined;
        reject(err as Error);
      }
    });
  }

  /**
   * Deliver a fire-and-forget message (a notification or response) to the server.
   * These produce no reply, so we resolve as soon as onmessage returns rather than
   * waiting on send() — which would hang forever.
   */
  notify(message: JSONRPCMessage): void {
    if (!this.onmessage) {
      throw new Error('Transport not connected: onmessage handler missing');
    }
    this.onmessage(message);
  }
}
