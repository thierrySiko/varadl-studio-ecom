import { useEffect, useMemo, useRef, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  ConnectionMode,
  useEdgesState,
  useNodesState,
  addEdge,
  reconnectEdge,
} from "reactflow";
import type { Edge, Node, NodeTypes, Connection } from "reactflow";
import { toPng, toSvg } from "html-to-image";
import "reactflow/dist/style.css";

import { getLayoutedElements } from "./graph-layout";
import ComponentNode from "./nodes/ComponentNode";
import VariationPointNode from "./nodes/VariationPointNode";
import VariantNode from "./nodes/VariantNode";
import type {
  Architecture,
  ArchitecturalElement,
  Component,
  Constraint,
} from "../model/varadl-types";

interface Props {
  architecture: Architecture;
  selection?: Record<string, string[]>;
}

const nodeTypes: NodeTypes = {
  component: ComponentNode,
  variationPoint: VariationPointNode,
  variant: VariantNode,
};

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

function constraintColor(type: Constraint["type"]) {
  return type === "requires" ? "#16a34a" : "#dc2626";
}

function constraintDash(type: Constraint["type"]) {
  return type === "requires" ? "6 5" : "9 5";
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function edgeMarker(color: string) {
  return {
    type: MarkerType.ArrowClosed,
    color,
  };
}

function commonEdgeStyle(color: string, width = 2) {
  return {
    stroke: color,
    strokeWidth: width,
  };
}

function edgeLabelStyle(color: string) {
  return {
    fill: color,
    fontSize: 11,
    fontWeight: 800,
  };
}

function edgeLabelBgStyle() {
  return {
    fill: "#f8fafc",
    fillOpacity: 0.92,
  };
}

export default function SPLGraphView({ architecture, selection }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const entityToNodeId = new Map<string, string>();

    nodes.push({
      id: "root",
      type: "component",
      position: { x: 0, y: 0 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: {
        label: architecture.name,
        subtitle: "Architecture de référence SPL",
        details: "Composants communs + points de variation",
        kind: "product",
        badge: "SPL",
      },
    });

    architecture.elements
      .filter(isComponent)
      .forEach((component, index) => {
        const id = `core-${component.name}-${index}`;
        entityToNodeId.set(component.name, id);

        nodes.push({
          id,
          type: "component",
          position: { x: 0, y: 0 },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            label: component.name,
            subtitle:
              component.ports.length > 0
                ? component.ports.map((p) => p.name).join(", ")
                : "Aucun port",
            details: "Composant commun",
            kind: component.optional ? "optional" : "core",
            badge: component.optional ? "optional" : "core",
          },
        });

        edges.push({
          id: `root-core-${index}`,
          source: "root",
          target: id,
          type: "bezier",
          markerEnd: edgeMarker("#64748b"),
          style: commonEdgeStyle("#64748b", 1.8),
          interactionWidth: 24,
        });
      });

    architecture.variationPoints.forEach((vp) => {
      const vpId = `vp-${vp.name}`;
      entityToNodeId.set(vp.name, vpId);

      nodes.push({
        id: vpId,
        type: "variationPoint",
        position: { x: 0, y: 0 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: vp.name,
          type: vp.type,
          selected: (selection?.[vp.name]?.length ?? 0) > 0,
        },
      });

      edges.push({
        id: `root-vp-${vp.name}`,
        source: "root",
        target: vpId,
        label: "variation point",
        type: "bezier",
        markerEnd: edgeMarker("#ea580c"),
        style: commonEdgeStyle("#ea580c", 2),
        labelStyle: edgeLabelStyle("#ea580c"),
        labelBgStyle: edgeLabelBgStyle(),
        interactionWidth: 24,
      });

      vp.variants.forEach((variant) => {
        const variantId = `variant-${vp.name}-${variant.name}`;
        const selected = selection?.[vp.name]?.includes(variant.name) ?? false;

        entityToNodeId.set(variant.name, variantId);

        nodes.push({
          id: variantId,
          type: "variant",
          position: { x: 0, y: 0 },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            label: variant.name,
            selected,
            details: selected ? "Activée dans la configuration" : "Disponible",
          },
        });

        edges.push({
          id: `${vpId}-${variantId}`,
          source: vpId,
          target: variantId,
          label: vp.type,
          type: "bezier",
          markerEnd: edgeMarker(selected ? "#16a34a" : "#0ea5e9"),
          style: commonEdgeStyle(selected ? "#16a34a" : "#0ea5e9", selected ? 2.6 : 1.9),
          labelStyle: edgeLabelStyle(selected ? "#15803d" : "#0f172a"),
          labelBgStyle: edgeLabelBgStyle(),
          interactionWidth: 24,
        });

        variant.elements
          .filter(isComponent)
          .forEach((component, index) => {
            const compId = `variant-comp-${variant.name}-${component.name}-${index}`;
            entityToNodeId.set(component.name, compId);

            nodes.push({
              id: compId,
              type: "component",
              position: { x: 0, y: 0 },
              sourcePosition: Position.Bottom,
              targetPosition: Position.Top,
              data: {
                label: component.name,
                subtitle:
                  component.ports.length > 0
                    ? component.ports.map((p) => p.name).join(", ")
                    : "Aucun port",
                details: `Introduit par ${variant.name}`,
                kind:
                  component.name.toLowerCase().includes("database") ||
                  component.name.toLowerCase().includes("mongo") ||
                  component.name.toLowerCase().includes("postgres")
                    ? "database"
                    : "variant",
                badge: "component",
              },
            });

            edges.push({
              id: `${variantId}-${compId}`,
              source: variantId,
              target: compId,
              label: "activates",
              type: "bezier",
              markerEnd: edgeMarker("#94a3b8"),
              style: commonEdgeStyle("#94a3b8", 1.6),
              labelStyle: edgeLabelStyle("#64748b"),
              labelBgStyle: edgeLabelBgStyle(),
              interactionWidth: 24,
            });
          });
      });
    });

    architecture.constraints.forEach((constraint, index) => {
      const source = entityToNodeId.get(constraint.source);
      const target = entityToNodeId.get(constraint.target);

      if (!source || !target) return;

      edges.push({
        id: `constraint-${constraint.source}-${constraint.target}-${index}`,
        source,
        target,
        label: constraint.type,
        type: "bezier",
        markerEnd: edgeMarker(constraintColor(constraint.type)),
        style: {
          stroke: constraintColor(constraint.type),
          strokeDasharray: constraintDash(constraint.type),
          strokeWidth: 2.4,
        },
        labelStyle: edgeLabelStyle(constraintColor(constraint.type)),
        labelBgStyle: edgeLabelBgStyle(),
        interactionWidth: 30,
        animated: constraint.type === "requires",
      });
    });

    return getLayoutedElements(nodes, edges, "TB");
  }, [architecture, selection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: `manual-${connection.source}-${connection.target}-${Date.now()}`,
            type: "bezier",
            label: "manual",
            markerEnd: edgeMarker("#334155"),
            style: commonEdgeStyle("#334155", 2),
            labelStyle: edgeLabelStyle("#334155"),
            labelBgStyle: edgeLabelBgStyle(),
            interactionWidth: 24,
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((currentEdges) => reconnectEdge(oldEdge, newConnection, currentEdges));
    },
    [setEdges]
  );

  function resetLayout() {
    const layouted = getLayoutedElements(
      nodes.map((n) => ({ ...n, position: { x: 0, y: 0 } })),
      edges,
      "TB"
    );

    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }

  async function exportPng() {
    if (!ref.current) return;

    const data = await toPng(ref.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f8fafc",
    });

    download(data, "spl-architecture.png");
  }

  async function exportSvg() {
    if (!ref.current) return;

    const data = await toSvg(ref.current, {
      cacheBust: true,
      backgroundColor: "#f8fafc",
    });

    download(data, "spl-architecture.svg");
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h2>Architecture de référence</h2>
      <div style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={resetLayout}
          style={{ padding: "6px 10px", cursor: "pointer" }}
        >
          Réorganiser automatiquement
        </button>

        <button
          onClick={exportPng}
          style={{ padding: "6px 10px", cursor: "pointer" }}
        >
          Export PNG
        </button>

        <button
          onClick={exportSvg}
          style={{ padding: "6px 10px", cursor: "pointer" }}
        >
          Export SVG
        </button>

        <span style={{ color: "#2563eb" }}><strong>Component</strong> : bleu</span>
        <span style={{ color: "#ea580c" }}><strong>VP</strong> : orange pointillé</span>
        <span style={{ color: "#0ea5e9" }}><strong>Variant</strong> : cyan</span>
        <span style={{ color: "#16a34a" }}><strong>Selected / requires</strong> : vert</span>
        <span style={{ color: "#dc2626" }}><strong>Excludes</strong> : rouge</span>
      </div>

      <div
        ref={ref}
        style={{
          height: 660,
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
          background: "#f8fafc",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          fitView
          fitViewOptions={{ padding: 0.22 }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          edgesUpdatable
          connectionMode={ConnectionMode.Loose}
          panOnDrag
          zoomOnScroll
          elevateEdgesOnSelect
          defaultEdgeOptions={{
            type: "bezier",
            markerEnd: edgeMarker("#64748b"),
            style: commonEdgeStyle("#64748b", 2),
          }}
        >
          <Background gap={18} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
