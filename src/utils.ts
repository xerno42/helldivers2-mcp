export const WAR_START_TIMESTAMP = 1707929520;

export const RE_SPAN_START = /<span data-ah=\\?"\d\\?">/g;
export const RE_SPAN_END = /<\/span>/g;
export const RE_ITALIC_START = /<i=\d>/g;
export const RE_ITALIC_END = /<\/i>/g;
export const RE_STEAM = /\[(?:\/?p|\/?\*|\/?b|\/?i|\/?u|\/?h\d?|\/?list|\/url|(?:url=[/"':#=_~@!$&(){}`,;%<>^+*?.|\\\-\s\dA-Za-z]+)|\/img|(?:img\ssrc=[_\\/"{}\\.\dA-Za-z]+)|\/previewyoutube|(?:previewyoutube=[/"':#=_~@!$&(){}`,;%<>^+*?.|\-\\\s\dA-Za-z]+))\]/g;

export function stripItalic(s: string): string {
  return s.replace(RE_ITALIC_START, '').replace(RE_ITALIC_END, '');
}

export function stripSpan(s: string): string {
  return s.replace(RE_SPAN_START, '').replace(RE_SPAN_END, '');
}

export function stripSteamMarkup(s: string): string {
  return s.replace(RE_STEAM, '');
}

export function toRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const future = diffMs > 0;
  const absSecs = Math.floor(Math.abs(diffMs) / 1000);
  const absMins = Math.floor(absSecs / 60);
  const absHours = Math.floor(absMins / 60);
  const absDays = Math.floor(absHours / 24);
  let str: string;
  if (absSecs < 60) str = `${absSecs} second${absSecs !== 1 ? 's' : ''}`;
  else if (absMins < 60) str = `${absMins} minute${absMins !== 1 ? 's' : ''}`;
  else if (absHours < 24) str = `${absHours} hour${absHours !== 1 ? 's' : ''}`;
  else str = `${absDays} day${absDays !== 1 ? 's' : ''}`;
  return future ? `in ${str}` : `${str} ago`;
}

import type { ToolAnnotations, ToolResult } from './tool-types.js';

export interface ResponseOpts {
  annotations?: ToolAnnotations;
  _meta?: Record<string, unknown>;
}

export function textResponse(text: string, opts: ResponseOpts = {}): ToolResult {
  return {
    content: [{ type: 'text', text, ...(opts.annotations ? { annotations: opts.annotations } : {}) }],
    ...(opts.annotations ? { annotations: opts.annotations } : {}),
    ...(opts._meta ? { _meta: opts._meta } : {}),
  };
}

export function errorResponse(text: string, opts: ResponseOpts = {}): ToolResult {
  return {
    content: [{ type: 'text', text, ...(opts.annotations ? { annotations: opts.annotations } : {}) }],
    isError: true,
    ...(opts.annotations ? { annotations: opts.annotations } : {}),
    ...(opts._meta ? { _meta: opts._meta } : {}),
  };
}
