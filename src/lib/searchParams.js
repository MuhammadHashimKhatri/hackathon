// Next passes repeated query keys as arrays; list pages only ever use the first value.
export function firstValues(params) {
  return Object.fromEntries(Object.entries(params ?? {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}
