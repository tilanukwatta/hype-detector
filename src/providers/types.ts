import type { ProviderId, Settings } from '@/types';

/** A single analysis request, already split into system + user messages. */
export interface CompletionRequest {
  system: string;
  user: string;
  settings: Settings;
  /** Optional abort signal so the UI can cancel in-flight requests. */
  signal?: AbortSignal;
}

/** Outcome of a lightweight connection / API-key check. */
export interface ValidationResult {
  ok: boolean;
  message: string;
}

/**
 * A provider turns a {@link CompletionRequest} into raw model text. Providers
 * are intentionally thin: prompt construction lives in `prompts/` and response
 * parsing in `parser/`, so a provider only owns transport + auth + the
 * request/response shape of one vendor's API.
 */
export interface LLMProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** Whether an API key is required (false for local Ollama). */
  readonly requiresApiKey: boolean;
  /** Default endpoint; overridable via `settings.baseUrl`. */
  readonly defaultBaseUrl: string;
  /** A couple of suggested model ids to seed the options UI. */
  readonly suggestedModels: readonly string[];
  complete(req: CompletionRequest): Promise<string>;
  /**
   * Cheaply verify that the current settings can reach the provider and (where
   * applicable) that the API key is accepted. Should never throw — network and
   * auth failures are returned as `{ ok: false }`.
   */
  validate(settings: Settings, signal?: AbortSignal): Promise<ValidationResult>;
}

/** Thrown for any provider-side failure, with a user-facing message. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly options: { status?: number; provider?: ProviderId; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Resolve the effective base URL for a provider given user settings. */
export function resolveBaseUrl(provider: LLMProvider, settings: Settings): string {
  return (settings.baseUrl?.trim() || provider.defaultBaseUrl).replace(/\/+$/, '');
}

/**
 * Shared JSON POST helper with consistent error handling. Kept here so each
 * provider file stays focused on request/response shaping.
 */
export async function postJson(
  url: string,
  body: unknown,
  init: { headers?: Record<string, string>; signal?: AbortSignal; provider?: ProviderId } = {}
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: JSON.stringify(body),
      signal: init.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ProviderError(
      'Network request failed. Check your connection and that the endpoint is reachable.',
      { provider: init.provider, cause }
    );
  }

  const rawText = await response.text();

  if (!response.ok) {
    throw new ProviderError(providerHttpMessage(response.status, rawText), {
      status: response.status,
      provider: init.provider,
    });
  }

  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch (cause) {
    throw new ProviderError('The provider returned a response that was not valid JSON.', {
      provider: init.provider,
      cause,
    });
  }
}

function providerHttpMessage(status: number, body: string): string {
  const detail = extractErrorDetail(body);
  const suffix = detail ? ` — ${detail}` : '';
  if (status === 401 || status === 403)
    return `Authentication failed (${status}). Check your API key${suffix}`;
  if (status === 404) return `Endpoint or model not found (404).${suffix}`;
  if (status === 429) return `Rate limited (429). Slow down or check your plan/quota.${suffix}`;
  if (status >= 500)
    return `The provider had a server error (${status}). Try again shortly.${suffix}`;
  return `Request failed (${status}).${suffix}`;
}

/** Map an HTTP status from a key check to a user-facing message. */
export function keyCheckMessage(status: number, detail: string): string {
  const suffix = detail ? ` — ${detail}` : '';
  if (status === 401 || status === 403)
    return `Invalid or unauthorized API key (${status}).${suffix}`;
  if (status === 404) return `Not found (404). Check the model name or base URL.${suffix}`;
  if (status === 400) return `Request rejected (400). Check the model name.${suffix}`;
  return `Provider returned ${status}.${suffix}`;
}

/**
 * Shared GET-based key check used by OpenAI-compatible and Gemini providers. A
 * 2xx (or 429, which means the key is recognized but rate-limited) is treated
 * as success. Never throws.
 */
export async function checkEndpoint(
  url: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<ValidationResult> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers: init.headers, signal: init.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    return {
      ok: false,
      message: 'Could not reach the provider. Check your connection and base URL.',
    };
  }
  if (res.ok) return { ok: true, message: 'API key looks valid.' };
  if (res.status === 429) return { ok: true, message: 'Key recognized (currently rate-limited).' };
  return { ok: false, message: keyCheckMessage(res.status, extractErrorDetail(await res.text())) };
}

/** Best-effort extraction of an error message from a provider error body. */
export function extractErrorDetail(body: string): string {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Fall through to raw text.
  }
  return body.slice(0, 200);
}
