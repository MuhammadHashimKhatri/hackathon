// Minimal stand-in for the Supabase query builder in service tests.
// Every builder call is recorded; awaiting the chain asks `respond(table, ops)`
// for the { data, error } result. ops is a list like [["select", "id"], ["eq", "id", 1]].
export function fakeDb(respond) {
  const calls = [];
  return {
    calls,
    from(table) {
      const ops = [];
      calls.push({ table, ops });
      const chain = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              const result = Promise.resolve().then(() => respond(table, ops));
              return (resolve, reject) => result.then(resolve, reject);
            }
            return (...args) => {
              ops.push([prop, ...args]);
              return chain;
            };
          },
        }
      );
      return chain;
    },
  };
}

// The op name list for a recorded call, e.g. ["update", "eq", "select", "single"].
export const opNames = (call) => call.ops.map(([name]) => name);
