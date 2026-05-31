import { Handle, Position } from "reactflow";

type VariantNodeData = {
  label: string;
  selected?: boolean;
  details?: string;
};

function handleStyle(color: string) {
  return {
    width: 9,
    height: 9,
    background: color,
    border: "2px solid white",
  };
}

export default function VariantNode({ data }: { data: VariantNodeData }) {
  const border = data.selected ? "#16a34a" : "#0ea5e9";
  const background = data.selected ? "#dcfce7" : "#ecfeff";
  const badge = data.selected ? "Selected variant" : "Variant";

  return (
    <div
      style={{
        padding: 12,
        border: `2px solid ${border}`,
        borderRadius: 12,
        background,
        minWidth: 180,
        textAlign: "center",
        boxShadow: "0 4px 10px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Handle id="target-left" type="target" position={Position.Left} style={handleStyle(border)} />
      <Handle id="target-top" type="target" position={Position.Top} style={handleStyle(border)} />
      <Handle id="source-right" type="source" position={Position.Right} style={handleStyle(border)} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleStyle(border)} />

      <strong style={{ color: "#0f172a" }}>{data.label}</strong>

      <div
        style={{
          marginTop: 6,
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: border,
          color: "white",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {badge}
      </div>

      {data.details && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#334155" }}>
          {data.details}
        </div>
      )}
    </div>
  );
}
