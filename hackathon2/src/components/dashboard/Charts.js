"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Thin recharts wrappers that use the design tokens, so light and dark both work.
const axis = { stroke: "var(--color-muted)", fontSize: 12, tickLine: false, axisLine: false };
const grid = <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />;
const tooltip = (
  <Tooltip
    cursor={{ fill: "var(--color-accent-soft)" }}
    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
  />
);
const COLORS = ["var(--color-accent)", "var(--color-warning)", "var(--color-danger)", "var(--color-success)", "var(--color-info)"];

// series: [{ key, label }]
export function BarPanel({ data, x, series, height = 240, layout = "horizontal" }) {
  const vertical = layout === "vertical";
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, bottom: 0, left: vertical ? 8 : -16 }}>
          {grid}
          {vertical ? (
            <>
              <XAxis type="number" {...axis} allowDecimals={false} />
              <YAxis type="category" dataKey={x} {...axis} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} {...axis} />
              <YAxis {...axis} allowDecimals={false} />
            </>
          )}
          {tooltip}
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i % COLORS.length]} radius={4} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinePanel({ data, x, series, height = 240, unit = "" }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          {grid}
          <XAxis dataKey={x} {...axis} tickFormatter={(d) => String(d).slice(5)} />
          <YAxis {...axis} unit={unit} />
          {tooltip}
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
