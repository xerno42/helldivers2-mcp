import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  toRelativeTime,
  stripItalic,
  stripSpan,
  stripSteamMarkup,
  textResponse,
  errorResponse,
  WAR_START_TIMESTAMP,
} from '../utils.js';

describe('WAR_START_TIMESTAMP', () => {
  it('is the expected epoch value', () => {
    expect(WAR_START_TIMESTAMP).toBe(1707929520);
  });
});

describe('stripItalic', () => {
  it('removes <i=N> and </i> tags', () => {
    expect(stripItalic('<i=1>Hello</i>')).toBe('Hello');
  });

  it('only strips single-digit italic tags (regex is <i=\\d>)', () => {
    // The regex matches exactly one digit: <i=99> is NOT stripped
    expect(stripItalic('<i=1>text</i>')).toBe('text');
    expect(stripItalic('<i=99>text</i>')).toBe('<i=99>text');
  });

  it('leaves plain strings untouched', () => {
    expect(stripItalic('no markup here')).toBe('no markup here');
  });

  it('handles multiple italic tags', () => {
    expect(stripItalic('<i=1>first</i> and <i=2>second</i>')).toBe('first and second');
  });
});

describe('stripSpan', () => {
  it('removes <span data-ah="N"> and </span> tags', () => {
    expect(stripSpan('<span data-ah="1">content</span>')).toBe('content');
  });

  it('leaves plain text unchanged', () => {
    expect(stripSpan('plain text')).toBe('plain text');
  });
});

describe('stripSteamMarkup', () => {
  it('strips [b] and [/b] tags', () => {
    expect(stripSteamMarkup('[b]bold[/b]')).toBe('bold');
  });

  it('strips [url=...] and [/url] tags', () => {
    expect(stripSteamMarkup('[url=https://example.com]link[/url]')).toBe('link');
  });

  it('strips [p] and [/p] tags', () => {
    expect(stripSteamMarkup('[p]paragraph[/p]')).toBe('paragraph');
  });

  it('leaves plain text unchanged', () => {
    expect(stripSteamMarkup('no markup')).toBe('no markup');
  });
});

describe('toRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "N seconds ago" for past time within 60 seconds', () => {
    const date = new Date(Date.now() - 30_000);
    expect(toRelativeTime(date)).toBe('30 seconds ago');
  });

  it('returns "1 second ago" (singular)', () => {
    const date = new Date(Date.now() - 1_000);
    expect(toRelativeTime(date)).toBe('1 second ago');
  });

  it('returns "N minutes ago" for past time within an hour', () => {
    const date = new Date(Date.now() - 5 * 60_000);
    expect(toRelativeTime(date)).toBe('5 minutes ago');
  });

  it('returns "1 minute ago" (singular)', () => {
    const date = new Date(Date.now() - 60_000);
    expect(toRelativeTime(date)).toBe('1 minute ago');
  });

  it('returns "N hours ago" for past time within a day', () => {
    const date = new Date(Date.now() - 3 * 3600_000);
    expect(toRelativeTime(date)).toBe('3 hours ago');
  });

  it('returns "N days ago" for past time over a day', () => {
    const date = new Date(Date.now() - 2 * 86400_000);
    expect(toRelativeTime(date)).toBe('2 days ago');
  });

  it('returns "in N seconds" for future time', () => {
    const date = new Date(Date.now() + 45_000);
    expect(toRelativeTime(date)).toBe('in 45 seconds');
  });

  it('returns "in N hours" for future time over an hour', () => {
    const date = new Date(Date.now() + 2 * 3600_000);
    expect(toRelativeTime(date)).toBe('in 2 hours');
  });
});

describe('textResponse', () => {
  it('wraps text in MCP content envelope', () => {
    const result = textResponse('hello');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'hello' }],
    });
  });

  it('does not set isError', () => {
    const result = textResponse('ok');
    expect(result.isError).toBeUndefined();
  });

  it('propagates annotations and _meta when supplied', () => {
    const result = textResponse('hello', {
      annotations: { audience: ['user'], priority: 0.5 },
      _meta: { source: 'test' },
    });
    expect(result.annotations).toEqual({ audience: ['user'], priority: 0.5 });
    expect(result._meta).toEqual({ source: 'test' });
    expect(result.content[0].annotations).toEqual({ audience: ['user'], priority: 0.5 });
  });
});

describe('errorResponse', () => {
  it('wraps text in MCP content envelope with isError true', () => {
    const result = errorResponse('something went wrong');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'something went wrong' }],
      isError: true,
    });
  });

  it('propagates annotations and _meta when supplied', () => {
    const result = errorResponse('bad', {
      annotations: { audience: ['assistant'] },
      _meta: { code: 'E_TEST' },
    });
    expect(result.isError).toBe(true);
    expect(result.annotations).toEqual({ audience: ['assistant'] });
    expect(result._meta).toEqual({ code: 'E_TEST' });
  });
});
