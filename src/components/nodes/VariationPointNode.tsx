import { Handle, Position } from "reactflow";

type VariationPointNodeData = {
  label: string;
  type?: string;
  selected?: boolean;
};

export default function VariationPointNode({ data }: { data: VariationPointNodeData }) {
  return (
    <div
      style={{
        padding: 12,
        border: "2px dashed #ea580c",
        borderRadius: 14,
        background: data.selected ? "#fed7aa" : "#ffedd5",
        minWidth: 200,
        textAlign: "center",
        boxShadow: "0 4px 10px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <strong style={{ color: "#9a3412" }}>{data.label}</strong>

      <div
        style={{
          marginTop: 6,
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          background: "#ea580c",
          color: "white",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        Variation Point
      </div>

      {data.type && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#7c2d12" }}>
          {data.type}
        </div>
      )}
    </div>
  );
}
