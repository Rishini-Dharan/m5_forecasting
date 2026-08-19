/**
 * Shared API helpers.
 *
 * The error extraction exists because FastAPI returns two different shapes. A raised
 * HTTPException gives `detail` as a string, but a Pydantic validation failure (422) gives
 * `detail` as an array of objects. Passing that array to `new Error(...)` stringified it to
 * the literal text "[object Object]", which is what users saw instead of the real problem.
 */

export interface ApiErrorDetail {
  msg?: string;
  loc?: (string | number)[];
  type?: string;
}

/** Turn any FastAPI error body into a sentence a person can act on. */
export function extractErrorMessage(body: unknown, fallback = 'Request failed'): string {
  if (!body || typeof body !== 'object') return fallback;

  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry: ApiErrorDetail) => {
        if (typeof entry === 'string') return entry;
        const field = Array.isArray(entry.loc)
          ? entry.loc.filter((part) => part !== 'body').join('.')
          : '';
        const message = entry.msg || 'is invalid';
        return field ? `${field}: ${message}` : message;
      })
      .filter(Boolean);
    if (messages.length) return messages.join('; ');
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

/** Read an error message off a failed Response, tolerating non-JSON bodies. */
export async function errorFromResponse(response: Response, fallback?: string): Promise<string> {
  const base = fallback ?? `Request failed (${response.status})`;
  try {
    return extractErrorMessage(await response.json(), base);
  } catch {
    return base;
  }
}

/** Message for anything thrown by fetch or by our own code. */
export function toMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    // A CORS failure or a dead backend both surface as this opaque browser message.
    if (error.message === 'Failed to fetch') {
      return 'Could not reach the server. It may be starting up, or blocked by CORS.';
    }
    return error.message || fallback;
  }
  return extractErrorMessage(error, fallback);
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${localStorage.getItem('jwt') || ''}`, ...extra };
}
