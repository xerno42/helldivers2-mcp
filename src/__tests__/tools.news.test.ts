import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockHd2Fetch = jest.fn<(path: string) => Promise<unknown>>();

jest.unstable_mockModule('../client.js', () => ({
  hd2Fetch: mockHd2Fetch,
}));

const { getDispatches, getSteamNews } = await import('../tools/news.js');

describe('getDispatches.handler()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    mockHd2Fetch.mockReset();
  });

  it('returns dispatches sorted newest first', async () => {
    mockHd2Fetch.mockResolvedValueOnce([
      { id: 1, published: 100, type: 0, message: 'Older message' },
      { id: 2, published: 200, type: 0, message: 'Newer message' },
    ]);

    const result = await getDispatches.handler({});
    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    const olderIdx = text.indexOf('Older message');
    const newerIdx = text.indexOf('Newer message');
    expect(newerIdx).toBeLessThan(olderIdx);
  });

  it('clamps limit to max 50', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      published: i,
      type: 0,
      message: `Message ${i}`,
    }));
    mockHd2Fetch.mockResolvedValueOnce(items);

    const result = await getDispatches.handler({ limit: 100 });
    const text = result.content[0].text;
    const separatorCount = (text.match(/\n---\n/g) ?? []).length;
    // 50 items → 49 separators
    expect(separatorCount).toBe(49);
  });

  it('returns "No dispatches found." for empty array', async () => {
    mockHd2Fetch.mockResolvedValueOnce([]);
    const result = await getDispatches.handler({});
    expect(result.content[0].text).toBe('No dispatches found.');
  });

  it('strips italic markup from message text', async () => {
    mockHd2Fetch.mockResolvedValueOnce([
      { id: 1, published: 100, type: 0, message: '<i=1>Important</i> dispatch' },
    ]);
    const result = await getDispatches.handler({});
    expect(result.content[0].text).toContain('Important dispatch');
    expect(result.content[0].text).not.toContain('<i=');
  });

  it('returns error response on fetch failure', async () => {
    mockHd2Fetch.mockRejectedValueOnce(new Error('Network down'));
    const result = await getDispatches.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch dispatches');
  });
});

describe('getSteamNews.handler()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    mockHd2Fetch.mockReset();
  });

  it('returns Steam news sorted newest first', async () => {
    mockHd2Fetch.mockResolvedValueOnce([
      { id: 'a', title: 'Older', url: 'https://example.com/1', author: 'AH', content: 'old', publishedAt: '2024-01-01T00:00:00Z' },
      { id: 'b', title: 'Newer', url: 'https://example.com/2', author: 'AH', content: 'new', publishedAt: '2024-06-01T00:00:00Z' },
    ]);

    const result = await getSteamNews.handler({});
    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text.indexOf('Newer')).toBeLessThan(text.indexOf('Older'));
  });

  it('strips Steam markup from content', async () => {
    mockHd2Fetch.mockResolvedValueOnce([
      { id: 'a', title: 'Patch Notes', url: 'https://example.com', author: 'AH', content: '[b]Bold[/b] text', publishedAt: '2024-01-01T00:00:00Z' },
    ]);
    const result = await getSteamNews.handler({});
    expect(result.content[0].text).toContain('Bold text');
    expect(result.content[0].text).not.toContain('[b]');
  });

  it('returns "No Steam news found." for empty array', async () => {
    mockHd2Fetch.mockResolvedValueOnce([]);
    const result = await getSteamNews.handler({});
    expect(result.content[0].text).toBe('No Steam news found.');
  });

  it('returns error response on fetch failure', async () => {
    mockHd2Fetch.mockRejectedValueOnce(new Error('Timeout'));
    const result = await getSteamNews.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch Steam news');
  });
});
