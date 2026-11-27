/** CSFloat list endpoints answer with either a bare array or `{ data: [...] }`, depending on the endpoint version. */
export function listInResponse(body: unknown): unknown[] | undefined {
  const list = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data;
  return Array.isArray(list) ? list : undefined;
}
