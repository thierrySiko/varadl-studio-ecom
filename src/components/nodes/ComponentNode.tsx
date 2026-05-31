import { Handle, Position } from "reactflow";

type ComponentNodeData = {
  label: string;
  subtitle?: string;
  details?: string;
  badge?: string;
  kind?: "core" | "optional" | "variant" | "database" | "technology" | "product";
};

const stylesByKind: Record<
  NonNullable<ComponentNodeData["kind"]>,
  { border: string; background: string; badge: string }
> = {
  core: {
    border: "#2563eb",
    background: "#dbeafe",
    badge: "#1d4ed8",
  },
  optional: {
    border: "#f97316",
    background: "#ffedd5",
    badge: "#c2410c",
  },
  variant: {
    border: "#16a34a",
    background: "#dcfce7",
    badge: "#15803d",
  },
  database: {
    border: "#7c3aed",
    background: "#ede9fe",
    badge: "#6d28d9",
  },
  technology: {
    border: "#0891b2",
    background: "#cffafe",
    badge: "#0e7490",
  },
  product: {
    border: "#9333ea",
    background: "#f3e8ff",
    badge: "#7e22ce",
  },
};

function handleStyle(color: string) {
  return {
    width: 9,
    height: 9,
    background: color,
    border: "2px solid white",
  };
}

export default function ComponentNode({ data }: { data: ComponentNodeData }) {
  const kind = data.kind ?? "core";
  const style = stylesByKind[kind];

  return (
    <div
      style={{
        padding: 12,
        border: `2px solid ${style.border}`,
        borderRadius: 12,
        background: style.background,
        minWidth: 190,
        textAlign: "center",
        boxShadow: "0 4px 10px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Handle id="target-left" type="target" position={Position.Left} style={handleStyle(style.border)} />
      <Handle id="target-top" type="target" position={Position.Top} style={handleStyle(style.border)} />
      <Handle id="source-right" type="source" position={Position.Right} style={handleStyle(style.border)} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleStyle(style.border)} />

      <strong style={{ color: "#0f172a" }}>{data.label}</strong>

      <div
        style={{
          marginTop: 6,
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: style.badge,
          color: "white",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {data.badge ?? kind}
      </div>

      {data.subtitle && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#334155" }}>
          {data.subtitle}
        </div>
      )}

      {data.details && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#64748b" }}>
          {data.details}
        </div>
      )}
    </div>
  );
}
