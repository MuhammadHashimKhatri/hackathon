// Client-side JSON POST to our /api routes. Never throws: returns
// { ok: true, data } or { ok: false, status, error } where error is the
// { code, message, details } body produced by src/server/errors.js.
export function postJson(path, body) {
  return sendJson("POST", path, body);
}

export function patchJson(path, body) {
  return sendJson("PATCH", path, body);
}

export async function sendJson(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data };
    return { ok: false, status: res.status, error: data?.error ?? null };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

// Turns a failed postJson result into form state for the public forms.
export function formStateFromError(result, unavailableMessage) {
  if (result.status === 404) return { formError: unavailableMessage };
  if (result.status === 0) return { formError: "Couldn't reach the server. Check your connection and try again." };
  const fieldErrors = result.error?.details?.fieldErrors;
  return {
    formError: result.error?.message ?? "Something went wrong. Try again.",
    fieldErrors: fieldErrors
      ? Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
      : undefined,
  };
}
