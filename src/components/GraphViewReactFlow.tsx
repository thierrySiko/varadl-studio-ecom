import { useEffect, useMemo, useCallback, useRef } from "react";
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
import type { Edge, Node, Connection, NodeTypes } from "reactflow";
import "reactflow/dist/style.css";
import { toPng, toSvg } from "html-to-image";

import { generateExecutableProductZip } from "../generator/product-generator";

import { getLayoutedElements } from "./graph-layout";
import ComponentNode from "./nodes/ComponentNode";

import type {
  Architecture,
  ArchitecturalElement,
  Component,
  Connector,
  Constraint,
  ElementOrigin,
  ProductArchitecture,
} from "../model/varadl-types";

interface Props {
  productElements: ArchitecturalElement[];
  architecture?: Architecture | null;
  product?: ProductArchitecture | null;
}

const nodeTypes: NodeTypes = {
  component: ComponentNode,
};

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

function isConnector(element: ArchitecturalElement): element is Connector {
  return element.kind === "connector";
}

function constraintColor(type: Constraint["type"]) {
  return type === "requires" ? "#16a34a" : "#dc2626";
}

function constraintDash(type: Constraint["type"]) {
  return type === "requires" ? "6 5" : "9 5";
}

function componentKindFromOrigin(origin?: ElementOrigin) {
  if (origin === "optional") return "optional";
  if (origin === "database") return "database";
  if (origin === "variant") return "variant";
  return "core";
}

function downloadDataUrl(dataUrl: string, filename: string) {
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
    fontSize: 11,
    fontWeight: 700,
    fill: color,
  };
}

function edgeLabelBgStyle() {
  return {
    fill: "#f8fafc",
    fillOpacity: 0.9,
  };
}

export default function GraphViewReactFlow({
  productElements,
  architecture,
  product,
}: Props) {
  const exportRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => {
    const components = productElements.filter(isComponent);
    const connectors = productElements.filter(isConnector);

    const componentNames = new Set(components.map((c) => c.name));

    const nodes: Node[] = components.map((component) => ({
      id: component.name,
      type: "component",
      position: { x: 0, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: component.name,
        subtitle:
          component.ports.length > 0
            ? component.ports.map((p) => p.name).join(", ")
            : "Aucun port",
        details: "Architecture produit dérivée",
        kind: componentKindFromOrigin(component.origin),
        badge: component.origin ?? "core",
      },
    }));

    const edges: Edge[] = [];

    connectors.forEach((c, index) => {
      edges.push({
        id: `conn-${index}`,
        source: c.sourceComponent,
        target: c.targetComponent,
        label: `${c.sourcePort} → ${c.targetPort}`,
        type: "bezier",
        markerEnd: edgeMarker("#64748b"),
        style: commonEdgeStyle("#64748b", 2),
        labelStyle: edgeLabelStyle("#334155"),
        labelBgStyle: edgeLabelBgStyle(),
        interactionWidth: 24,
      });
    });

    if (architecture) {
      architecture.constraints
        .filter(
          (c) => componentNames.has(c.source) && componentNames.has(c.target)
        )
        .forEach((constraint, index) => {
          edges.push({
            id: `constraint-${index}`,
            source: constraint.source,
            target: constraint.target,
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
    }

    return getLayoutedElements(nodes, edges, "LR");
  }, [productElements, architecture]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
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
          eds
        )
      );
    },
    [setEdges]
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
    },
    [setEdges]
  );

  function resetLayout() {
    const layouted = getLayoutedElements(
      nodes.map((n) => ({ ...n, position: { x: 0, y: 0 } })),
      edges,
      "LR"
    );

    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }

  async function exportPng() {
    if (!exportRef.current) return;

    const dataUrl = await toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f8fafc",
    });

    downloadDataUrl(dataUrl, "varadl-product-architecture.png");
  }

  async function exportSvg() {
    if (!exportRef.current) return;

    const dataUrl = await toSvg(exportRef.current, {
      cacheBust: true,
      backgroundColor: "#f8fafc",
    });

    downloadDataUrl(dataUrl, "varadl-product-architecture.svg");
  }

  async function generateProductCode() {
    await generateExecutableProductZip(
      product?.name ?? "generated-product",
      product?.elements ?? productElements
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={resetLayout}
          style={{ padding: "6px 10px", cursor: "pointer" }}
        >
          Reset layout
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

        <button
          onClick={generateProductCode}
          style={{
            padding: "6px 10px",
            cursor: "pointer",
            border: "1px solid #16a34a",
            background: "#dcfce7",
            color: "#166534",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          Générer le produit exécutable
        </button>

        <span style={{ color: "#475569" }}>
          Déplace les blocs et reconnecte les liens depuis les petits points.
        </span>

        <span><strong>Core</strong> : bleu</span>
        <span style={{ color: "#f97316" }}><strong>Optional</strong> : orange</span>
        <span style={{ color: "#16a34a" }}><strong>Variant</strong> : vert</span>
        <span style={{ color: "#7c3aed" }}><strong>Database</strong> : violet</span>
      </div>

      <div
        ref={exportRef}
        style={{
          height: 600,
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
