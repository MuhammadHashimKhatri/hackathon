import "server-only";
import { z } from "zod";
import { requireRole } from "@/server/auth/guard";
import { assertRateLimit, complete, deadline, friendlyError, isConfigured, logAi, NOT_CONFIGURED } from "@/server/ai/client";
import { chatSystemPrompt, weekdayName } from "@/server/ai/prompts";
import { runTool, toolsFor } from "@/server/ai/tools";
import { addDays, localDateTime } from "@/server/rules/companyTime";
import { getMetrics } from "./analytics";
import { getMyBalances } from "./leave";
import { loadSettings } from "./settings";

// AI assistant (Spec §8). The model explains and assists; the database is the
// only source of truth. It never writes: smart leave only returns a suggestion.

const MAX_ROUNDS = 4;

async function context() {
  const settings = await loadSettings();
  return { settings, today: localDateTime(new Date(), settings.timezone).date };
}

const fallback = (message) => ({ fallback: true, message });

// Chat with tools: the model picks a tool, we run it with the user's scope, the model answers.
export async function chat(actor, { messages }) {
  requireRole(actor, "admin", "hr", "employee");
  const question = messages.at(-1)?.content ?? "";
  if (!isConfigured()) return { ...fallback(NOT_CONFIGURED), reply: NOT_CONFIGURED };
  await assertRateLimit(actor);

  const startedAt = Date.now();
  const { settings, today } = await context();
  const convo = [
    { role: "system", content: chatSystemPrompt({ role: actor.role, today, timezone: settings.timezone, companyName: settings.company_name }) },
    ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
  ];
  const tools = toolsFor(actor.role);
  const toolCalls = [];
  const { signal, done } = deadline();
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await complete({ messages: convo, tools, tool_choice: "auto" }, signal);
      const msg = res.choices[0]?.message;
      if (!msg?.tool_calls?.length) {
        const reply = msg?.content?.trim() || "I couldn't find an answer to that.";
        await logAi(actor, { feature: "chat", input: question, toolCalls, output: reply, startedAt, success: true });
        return { reply, toolsUsed: toolCalls.map((t) => t.name) };
      }
      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        const result = await runTool(actor, call.function.name, call.function.arguments);
        toolCalls.push({ name: call.function.name, args: call.function.arguments, ok: !result?.error });
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    const reply = "That needed too many steps. Try asking a more specific question.";
    await logAi(actor, { feature: "chat", input: question, toolCalls, output: reply, startedAt, success: false, error: "max rounds" });
    return { reply, toolsUsed: toolCalls.map((t) => t.name) };
  } catch (err) {
    console.error("ai chat failed", err);
    await logAi(actor, { feature: "chat", input: question, toolCalls, startedAt, success: false, error: err?.message });
    return { ...fallback(friendlyError(err)), reply: friendlyError(err) };
  } finally {
    done();
  }
}

// Parses a JSON object out of a model reply (some providers wrap it in ```json fences).
function parseJson(text) {
  const raw = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(start >= 0 ? raw.slice(start, end + 1) : raw);
}

// Asks for JSON, validates with zod, retries once (Spec §8), else null.
async function askJson(messages, schema, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await complete({ messages, response_format: { type: "json_object" } }, signal);
    const text = res.choices[0]?.message?.content;
    try {
      const parsed = schema.safeParse(parseJson(text));
      if (parsed.success) return { value: parsed.data, raw: text };
    } catch {
      // fall through to the retry
    }
    messages = [...messages, { role: "assistant", content: text ?? "" }, { role: "user", content: "That was not valid. Reply with only the JSON object in the exact format asked." }];
  }
  return null;
}

const summarySchema = z.object({ bullets: z.array(z.string().min(3).max(400)).min(3).max(5) });

// Admin/HR: 3–5 insight bullets from the dashboard numbers for the current filters.
export async function summarizeDashboard(actor, filters) {
  requireRole(actor, "admin", "hr");
  if (!isConfigured()) return fallback(NOT_CONFIGURED);
  await assertRateLimit(actor);
  const startedAt = Date.now();
  // Recomputed on the server: the browser can't feed the model made-up numbers.
  const metrics = await getMetrics(actor, filters);
  const input = JSON.stringify(metrics);
  const { signal, done } = deadline();
  try {
    const result = await askJson(
      [
        {
          role: "system",
          content:
            'You write short HR dashboard insights. Use ONLY the numbers in the JSON you are given; never invent or estimate numbers. Write 3 to 5 bullets, each one sentence, most useful first (attendance problems, late-comers, leave, headcount, payroll cost). Reply with JSON: {"bullets": ["...", "..."]}',
        },
        { role: "user", content: `Dashboard KPI JSON for ${metrics.filters.from} to ${metrics.filters.to}:\n${input}` },
      ],
      summarySchema,
      signal
    );
    if (!result) {
      await logAi(actor, { feature: "summary", input, startedAt, success: false, error: "invalid JSON twice" });
      return fallback("The summary couldn't be generated right now. The numbers on the dashboard are still accurate.");
    }
    await logAi(actor, { feature: "summary", input, output: result.raw, startedAt, success: true });
    return { bullets: result.value.bullets, filters: metrics.filters };
  } catch (err) {
    console.error("ai summary failed", err);
    await logAi(actor, { feature: "summary", input, startedAt, success: false, error: err?.message });
    return fallback(friendlyError(err));
  } finally {
    done();
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// "Need next Monday and Tuesday off for a wedding" → { type, start, end, reason }.
// Only a suggestion: the user reviews the pre-filled form and submits it.
export async function smartLeave(actor, { text }) {
  requireRole(actor, "employee", "hr");
  if (!isConfigured()) return fallback(NOT_CONFIGURED);
  await assertRateLimit(actor);
  const startedAt = Date.now();
  const [{ settings, today }, balances] = await Promise.all([context(), getMyBalances(actor)]);
  const codes = balances.map((b) => b.code);
  if (codes.length === 0) return fallback("There are no leave types yet, so fill in the form instead.");

  // A dated calendar for the next 3 weeks makes "next Monday" unambiguous for the model.
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const d = addDays(today, i);
    return `${d} ${weekdayName(d)}${settings.weekend_days.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) ? " (weekend)" : ""}`;
  }).join("\n");
  const schema = z
    .object({ type: z.enum(codes), start: isoDate, end: isoDate, reason: z.string().trim().min(3).max(500) })
    .refine((v) => v.end >= v.start);
  const { signal, done } = deadline();
  try {
    const result = await askJson(
      [
        {
          role: "system",
          content: `You turn a leave request written in plain words (English or Roman Urdu) into JSON for a leave form.
Today is ${weekdayName(today)} ${today}. "Next <weekday>" means the first such day after today. Use this calendar:
${calendar}
Leave types (use the code): ${balances.map((b) => `${b.code} = ${b.name}`).join(", ")}.
Pick sick for illness or doctor visits, annual for vacations or trips, casual for personal events like weddings or family matters, unpaid only if the user says unpaid.
Reply with JSON only: {"type": "<code>", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "reason": "<short reason in English>"}`,
        },
        { role: "user", content: text },
      ],
      schema,
      signal
    );
    if (!result) {
      await logAi(actor, { feature: "smart_leave", input: text, startedAt, success: false, error: "invalid JSON twice" });
      return fallback("I couldn't read the dates from that. Please fill in the form.");
    }
    const type = balances.find((b) => b.code === result.value.type);
    await logAi(actor, { feature: "smart_leave", input: text, output: result.raw, startedAt, success: true });
    return {
      suggestion: { leaveTypeId: type.leaveTypeId, typeName: type.name, startDate: result.value.start, endDate: result.value.end, reason: result.value.reason },
    };
  } catch (err) {
    console.error("ai smart leave failed", err);
    await logAi(actor, { feature: "smart_leave", input: text, startedAt, success: false, error: err?.message });
    return fallback(friendlyError(err));
  } finally {
    done();
  }
}
