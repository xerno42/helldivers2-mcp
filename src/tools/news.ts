import { hd2Fetch } from '../client.js';
import { RawNewsFeedItem, SteamNewsItem } from '../api-types.js';
import { Tool } from '../tool-types.js';
import {
  WAR_START_TIMESTAMP,
  errorResponse,
  stripItalic,
  stripSteamMarkup,
  textResponse,
  toRelativeTime,
} from '../utils.js';

const DEFAULT_DISPATCHES = 20;
const DEFAULT_STEAM_NEWS = 10;

function clampLimit(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export const getDispatches: Tool = {
  definition: {
    name: 'get_dispatches',
    title: 'Get Dispatches',
    description:
      'Fetch the latest dispatches (news feed) from Super Earth high command. Returns recent dispatches with their published date (relative time) and message text. Optional `limit` parameter caps how many items to return (default 20, max 50).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of dispatches to return. Default 20, max 50.',
        },
      },
      additionalProperties: false,
    },
  },
  handler: async (args) => {
    const limit = clampLimit(args.limit, DEFAULT_DISPATCHES, 50);
    try {
      const news = await hd2Fetch<RawNewsFeedItem[]>('/raw/api/NewsFeed/801');
      if (!Array.isArray(news) || news.length === 0) {
        return textResponse('No dispatches found.');
      }
      const sorted = [...news].sort((a, b) => b.published - a.published);
      const items = sorted.slice(0, limit).map((d) => {
        const date = new Date((WAR_START_TIMESTAMP + d.published) * 1000);
        const message = stripItalic(d.message ?? '');
        return `Published: ${toRelativeTime(date)} - Message: ${message || 'No message'}`;
      });
      return textResponse(items.join('\n---\n'));
    } catch (err) {
      return errorResponse(`Failed to fetch dispatches: ${(err as Error).message}`);
    }
  },
};

export const getSteamNews: Tool = {
  definition: {
    name: 'get_steam_news',
    title: 'Get Steam News',
    description:
      'Fetch the latest Steam news for Helldivers 2. Returns recent items with title, URL, published date (relative time), and content. Optional `limit` parameter caps how many items to return (default 10, max 30).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of Steam news items to return. Default 10, max 30.',
        },
      },
      additionalProperties: false,
    },
  },
  handler: async (args) => {
    const limit = clampLimit(args.limit, DEFAULT_STEAM_NEWS, 30);
    try {
      const news = await hd2Fetch<SteamNewsItem[]>('/api/v1/steam');
      if (!Array.isArray(news) || news.length === 0) {
        return textResponse('No Steam news found.');
      }
      const sorted = [...news].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      const items = sorted.slice(0, limit).map((n) => {
        const date = n.publishedAt ? toRelativeTime(new Date(n.publishedAt)) : 'No publish date';
        return (
          `Title: ${n.title ?? 'No title'}\n` +
          `URL: ${n.url ?? 'No URL'}\n` +
          `Published: ${date}\n` +
          `Content: ${stripSteamMarkup(n.content ?? '') || 'No content'}`
        );
      });
      return textResponse(items.join('\n---\n'));
    } catch (err) {
      return errorResponse(`Failed to fetch Steam news: ${(err as Error).message}`);
    }
  },
};
