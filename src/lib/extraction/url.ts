import { extractRecipesFromHtml, pageToText } from '../parsing/jsonld';
import { parseRecipeText } from '../parsing/text';
import type { ExtractionResult } from './types';
import { fetchPageNative, isNativeApp } from '../native';

export type UrlImportErrorKind = 'invalid' | 'blocked' | 'http' | 'not-recipe' | 'timeout' | 'too-large';

export class UrlImportError extends Error {
  constructor(
    public readonly kind: UrlImportErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'UrlImportError';
  }
}

const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/** Accepts "example.com/recipe" too. Returns a normalised https/http URL or throws. */
export function validateRecipeUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new UrlImportError('invalid', 'Paste a link to a recipe page.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new UrlImportError('invalid', 'That doesn’t look like a web address. Check the link and try again.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UrlImportError('invalid', 'Only web links (http or https) can be imported.');
  }
  if (url.username || url.password) {
    throw new UrlImportError('invalid', 'Links with a username or password in them can’t be imported.');
  }
  if (!url.hostname.includes('.') || PRIVATE_HOST.test(url.hostname)) {
    throw new UrlImportError('invalid', 'That link points to a private or local address, so it can’t be imported.');
  }
  url.hash = '';
  return url;
}

async function readLimited(res: Response): Promise<string> {
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_PAGE_BYTES) throw new UrlImportError('too-large', 'That page is too large to import.');
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new UrlImportError('too-large', 'That page is too large to import.');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder('utf-8').decode(all);
}

/**
 * Fetches the page directly from the user's browser. Most recipe sites don't
 * allow this (CORS), and that's expected: we never route the request through a
 * proxy or a third-party service, so the caller falls back to pasted text.
 */
async function fetchHtmlInApp(url: URL, signal?: AbortSignal): Promise<string> {
  let res: Awaited<ReturnType<typeof fetchPageNative>>;
  try {
    res = await Promise.race([
      fetchPageNative(url.href, TIMEOUT_MS),
      new Promise<never>((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError'))))
    ]);
  } catch (err) {
    if (signal?.aborted) throw err;
    if (/time/i.test(String((err as Error)?.message))) throw new UrlImportError('timeout', 'The website took too long to answer.');
    throw new UrlImportError('blocked', 'We couldn’t reach that website. Check your connection and the link.');
  }
  if (res.status >= 400) {
    throw new UrlImportError(
      'http',
      res.status === 404 ? 'That page wasn’t found (404). Check the link.' : res.status === 403 ? 'This website blocks automatic importing.' : `The website refused the request (error ${res.status}).`
    );
  }
  if (res.contentType && !/html|xml|text\/plain/i.test(res.contentType)) {
    throw new UrlImportError('not-recipe', 'That link isn’t a web page we can read.');
  }
  if (res.body.length > MAX_PAGE_BYTES) throw new UrlImportError('too-large', 'That page is too large to import.');
  return res.body;
}

export async function extractFromUrl(input: string, signal?: AbortSignal): Promise<ExtractionResult[]> {
  const url = validateRecipeUrl(input);
  if (isNativeApp) return parsePage(await fetchHtmlInApp(url, signal), url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  let html: string;
  try {
    let res: Response;
    try {
      res = await fetch(url.href, {
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
    } catch (err) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new UrlImportError('timeout', 'The website took too long to answer.');
      }
      if (signal?.aborted) throw err;
      throw new UrlImportError('blocked', 'This website doesn’t allow other apps to read its pages.');
    }
    if (!res.ok) {
      throw new UrlImportError(
        'http',
        res.status === 404 ? 'That page wasn’t found (404). Check the link.' : `The website refused the request (error ${res.status}).`
      );
    }
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|xml|text\/plain/i.test(type)) {
      throw new UrlImportError('not-recipe', 'That link isn’t a web page we can read.');
    }
    html = await readLimited(res);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  return parsePage(html, url);
}

function parsePage(html: string, url: URL): ExtractionResult[] {
  const finalUrl = url.href;
  const { results, meta, doc } = extractRecipesFromHtml(html, finalUrl);
  if (results.length) return results;

  // No structured data: try the readable page text.
  const text = pageToText(doc);
  const parsed = parseRecipeText(text, { sourceUrl: meta.canonicalUrl ?? finalUrl });
  if (parsed.confidence === 'low' || parsed.draft.ingredients.length === 0) {
    throw new UrlImportError('not-recipe', 'We couldn’t find a recipe on that page.');
  }
  parsed.draft.sourceName = meta.siteName ?? url.hostname.replace(/^www\./, '');
  parsed.warnings.unshift({ field: 'general', message: 'This page had no recipe card data, so we read the page text. Check everything carefully.' });
  return [parsed];
}
