import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Each test group resets modules to clear module-level rate-limit state.

describe('hd2Fetch', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.X_SUPER_CONTACT = 'test@example.com';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.X_SUPER_CONTACT;
  });

  it('returns parsed JSON on a successful 200 response', async () => {
    const payload = { warId: 801 };
    global.fetch = jest.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { hd2Fetch } = await import('../client.js');
    const result = hd2Fetch<{ warId: number }>('/raw/api/test');
    await jest.runAllTimersAsync();
    expect(await result).toEqual(payload);
  });

  it('sends X-Super-Client and X-Super-Contact headers', async () => {
    const mockFetch = jest.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    global.fetch = mockFetch;

    const { hd2Fetch } = await import('../client.js');
    const result = hd2Fetch<{ ok: boolean }>('/test');
    await jest.runAllTimersAsync();
    await result;

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Super-Client': 'helldivers2-mcp',
          'X-Super-Contact': 'test@example.com',
        }),
      }),
    );
  });

  it('throws an Error on non-2xx, non-429 HTTP response', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const { hd2Fetch } = await import('../client.js');
    // Catch the expected rejection before Jest can see it as unhandled
    let caughtError: Error | null = null;
    const result = hd2Fetch('/bad-endpoint').catch((err: Error) => {
      caughtError = err;
    });
    await jest.runAllTimersAsync();
    await result;
    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain('HTTP error from /bad-endpoint: status 404');
  });

  it('re-queues on 429 then resolves after retry', async () => {
    const payload = { ok: true };
    let callCount = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response('Too Many Requests', {
            status: 429,
            headers: { 'Retry-After': '1' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
    });

    const { hd2Fetch } = await import('../client.js');
    const result = hd2Fetch<{ ok: boolean }>('/retry-endpoint');

    // Run all timers to advance past rate-limit delay and retry
    await jest.runAllTimersAsync();

    expect(await result).toEqual(payload);
    expect(callCount).toBe(2);
  });
});
