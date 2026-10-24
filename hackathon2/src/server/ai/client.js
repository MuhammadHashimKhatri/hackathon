import "server-only";
import OpenAI from "openai";
import { AppError } from "@/server/errors";
import { getDb } from "@/server/db";

// Any OpenAI-compatible provider with tool calling (Spec §8): Groq, Gemini, ...
// The key lives only in server env vars; the browser never talks to the provider.

export const TIMEOUT_MS = 15_000;
export const HOURLY_LIMIT = 20;

export const isConfigured = () => Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);

export const NOT_CONFIGURED =
  "The AI assistant isn't connected yet. An Admin needs to set AI_API_KEY, AI_BASE_URL and AI_MODEL on the server.";

let client;
function ai() {
  client ??= new OpenAI({ apiKey: process.env.AI_API_KEY, baseURL: process.env.AI_BASE_URL, maxRetries: 0 });
  return client;
}

// One model call. `signal` is shared across a whole request so the 15 s budget covers every round.
export function complete(params, signal) {
  return ai().chat.completions.create({ model: process.env.AI_MODEL, temperature: 0.2, ...params }, { signal });
}

export function deadline() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

// About 20 requests per user per rolling hour, counted from ai_logs.
export async function assertRateLimit(actor) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await getDb()
    .from("ai_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", actor.userId)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= HOURLY_LIMIT) {
    throw new AppError(429, "RATE_LIMITED", `You've used the assistant ${HOURLY_LIMIT} times in the last hour. Try again a little later.`);
  }
}

// Every AI call is logged (Spec §8). Logging never breaks the answer.
export async function logAi(actor, { feature, input, toolCalls = null, output = null, startedAt, success, error = null }) {
  const { error: dbError } = await getDb()
    .from("ai_logs")
    .insert({
      user_id: actor.userId,
      role: actor.role,
      feature,
      input: String(input ?? "").slice(0, 4000),
      tool_calls: toolCalls,
      output: output === null ? null : String(output).slice(0, 8000),
      latency_ms: Math.max(0, Date.now() - startedAt),
      success,
      error: error ? String(error).slice(0, 1000) : null,
    });
  if (dbError) console.error("ai_logs insert failed", dbError);
}

export const friendlyError = (err) =>
  err?.name === "AbortError" || /abort|timeout/i.test(err?.message ?? "")
    ? "The assistant took too long to answer. Please try again."
    : "The assistant couldn't answer right now. Please try again in a moment.";
