import { useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
} from "reactflow";
import type { Edge, Node } from "reactflow";
import { toPng, toSvg } from "html-to-image";
import "reactflow/dist/style.css";

import type { Architecture, ArchitecturalElement, Component } from "../model/varadl-types";
import { getLayoutedElements } from "./graph-layout";

interface Props {
  architecture: Architecture;
  selection?: Record<string, string[]>;
}

type FeatureKind = "root" | "mandatory" | "optional" | "abstract";
type MarkerKind = "mandatory" | "optional" | "xor" | "or";

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// Une fonctionnalité (feature) est considérée comme "sélectionnée" si c'est une
// variante effectivement choisie dans la configuration courante. Généralisé à
// n'importe quelle architecture (plus de mapping figé vers les noms e-commerce).
function selectedFunctionalFeatures(selection?: Record<string, string[]>): Set<string> {
  return new Set(Object.values(selection ?? {}).flat());
}

function featureStyle(kind: FeatureKind, selected = false): React.CSSProperties {
  const base: React.CSSProperties = {
    minWidth: 150,
    borderRadius: 6,
    padding: "8px 10px",
    textAlign: "center",
    fontWeight: 650,
    fontSize: 13,
    color: "#0f172a",
  };

  if (kind === "root") {
    return {
      ...base,
      minWidth: 220,
      background: "#dbeafe",
      border: "2px solid #2563eb",
      fontSize: 15,
    };
  }

  if (kind === "optional") {
    return {
      ...base,
      background: selected ? "#dcfce7" : "#fff7ed",
      border: selected ? "2px solid #16a34a" : "2px dashed #f97316",
    };
  }

  if (kind === "abstract") {
    return {
      ...base,
      background: "#f1f5f9",
      border: "1px solid #64748b",
    };
  }

  return {
    ...base,
    background: selected ? "#dcfce7" : "#f0fdf4",
    border: selected ? "2px solid #16a34a" : "1px solid #22c55e",
  };
}

function markerLabel(kind: MarkerKind) {
  if (kind === "mandatory") return "●";
  if (kind === "optional") return "○";
  if (kind === "xor") return "△";
  return "▲";
}

function markerStyle(kind: MarkerKind): React.CSSProperties {
  return {
    width: 34,
    height: 28,
    border: "0px solid transparent",
    background: "transparent",
    color: kind === "optional" || kind === "xor" ? "#111827" : "#000000",
    fontSize: kind === "mandatory" || kind === "optional" ? 26 : 28,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}

function relationEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: "bezier",
    style: { stroke: "#111827", strokeWidth: 2 },
  };
}

export default function FeatureModelGraph({
  architecture,
  selection,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    const selected = selectedFunctionalFeatures(selection);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const knownFeatureIds = new Set<string>();

    function addFeature(id: string, label: string, kind: FeatureKind = "mandatory") {
      knownFeatureIds.add(id);
      nodes.push({
        id,
        position: { x: 0, y: 0 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: true,
        data: { label },
        style: featureStyle(kind, selected.has(id) || kind === "root"),
      });
    }

    function addMarker(id: string, kind: MarkerKind) {
      nodes.push({
        id,
        position: { x: 0, y: 0 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: true,
        selectable: false,
        data: { label: markerLabel(kind) },
        style: markerStyle(kind),
      });
    }

    function addMandatory(parent: string, child: string, marker: string) {
      addMarker(marker, "mandatory");
      edges.push(relationEdge(`${parent}-${marker}`, parent, marker));
      edges.push(relationEdge(`${marker}-${child}`, marker, child));
    }

    function addOptional(parent: string, child: string, marker: string) {
      addMarker(marker, "optional");
      edges.push(relationEdge(`${parent}-${marker}`, parent, marker));
      edges.push({
        ...relationEdge(`${marker}-${child}`, marker, child),
        style: { stroke: "#111827", strokeWidth: 2, strokeDasharray: "5 4" },
      });
    }

    function addGroup(
      parent: string,
      marker: string,
      markerKind: "xor" | "or",
      children: string[]
    ) {
      addMarker(marker, markerKind);
      edges.push(relationEdge(`${parent}-${marker}`, parent, marker));
      children.forEach((child) => edges.push(relationEdge(`${marker}-${child}`, marker, child)));
    }

    // --- Racine : l'architecture elle-même ---
    const root = architecture.name;
    addFeature(root, root, "root");

    // --- Composants de premier niveau : mandatory ou optional ---
    const topLevelComponents = architecture.elements.filter(isComponent);
    for (const component of topLevelComponents) {
      const kind: FeatureKind = component.optional ? "optional" : "mandatory";
      addFeature(component.name, component.name, kind);

      if (component.optional) {
        addOptional(root, component.name, `m-${component.name}`);
      } else {
        addMandatory(root, component.name, `m-${component.name}`);
      }
    }

    // --- Points de variation : chaque variante devient une feature ---
    for (const vp of architecture.variationPoints) {
      const variantIds = vp.variants.map((variant) => variant.name);

      for (const variant of vp.variants) {
        if (!knownFeatureIds.has(variant.name)) {
          addFeature(variant.name, variant.name, "mandatory");
        }
      }

      if (vp.type === "alternative") {
        addGroup(root, `xor-${vp.name}`, "xor", variantIds);
      } else if (vp.type === "or") {
        addGroup(root, `or-${vp.name}`, "or", variantIds);
      } else if (variantIds.length <= 1) {
        // "optional" avec une seule variante : simple feature optionnelle.
        variantIds.forEach((variantId) => addOptional(root, variantId, `o-${variantId}`));
      } else {
        // "optional" avec plusieurs variantes (0..1 parmi N) : rendu comme un
        // groupe XOR, la sémantique exacte (0 ou 1, pas exactement 1) est
        // rappelée dans la légende de la vue.
        addGroup(root, `xor-${vp.name}`, "xor", variantIds);
      }
    }

    // --- Contraintes requires/excludes : reliées à n'importe quelle feature connue ---
    for (const constraint of architecture.constraints) {
      if (!knownFeatureIds.has(constraint.source) || !knownFeatureIds.has(constraint.target)) {
        // La contrainte porte sur un élément qui n'est pas représenté comme
        // feature de premier niveau (ex. composant interne à une variante) :
        // on ne peut pas tracer l'arête dans cette vue fonctionnelle simplifiée.
        continue;
      }

      const isRequires = constraint.type === "requires";
      edges.push({
        id: `${constraint.type}-${constraint.source}-${constraint.target}`,
        source: constraint.source,
        target: constraint.target,
        label: constraint.type,
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, color: isRequires ? "#16a34a" : "#dc2626" },
        style: {
          stroke: isRequires ? "#16a34a" : "#dc2626",
          strokeWidth: 2,
          strokeDasharray: "7 5",
        },
        labelStyle: {
          fill: isRequires ? "#166534" : "#991b1b",
          fontWeight: 700,
          fontSize: 11,
        },
      });
    }

    return getLayoutedElements(nodes, edges, "TB");
  }, [architecture, selection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout.nodes, layout.edges, setNodes, setEdges]);

  async function exportPng() {
    if (!ref.current) return;

    const data = await toPng(ref.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });

    download(data, "feature-model.png");
  }

  async function exportSvg() {
    if (!ref.current) return;

    const data = await toSvg(ref.current, {
      cacheBust: true,
      backgroundColor: "#ffffff",
    });

    download(data, "feature-model.svg");
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h2>Feature Model fonctionnel</h2>

      <p style={{ color: "#475569", maxWidth: 950 }}>
        Cette vue dérive automatiquement un Feature Model au sens SPL classique à
        partir de l'architecture VarADL courante : chaque composant de premier niveau,
        point de variation et contrainte y est représenté comme une fonctionnalité.
        Un point de variation de type <em>optional</em> comportant plusieurs variantes
        est affiché avec le marqueur △ (0 ou 1 variante), à ne pas confondre avec un
        groupe alternatif strict (exactement une variante).
      </p>

      <div
        style={{
          marginBottom: 10,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: 13,
        }}
      >
        <button onClick={exportPng}>Export PNG</button>
        <button onClick={exportSvg}>Export SVG</button>
        <span><strong>●</strong> Mandatory</span>
        <span><strong>○</strong> Optional</span>
        <span><strong>△</strong> Alternative / XOR</span>
        <span><strong>▲</strong> OR</span>
        <span style={{ color: "#16a34a" }}>- - - requires</span>
        <span style={{ color: "#dc2626" }}>- - - excludes</span>
      </div>

      <div
        ref={ref}
        style={{
          height: 720,
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          minZoom={0.25}
          maxZoom={1.5}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          zoomOnScroll
        >
          <Background gap={18} size={1} color="#e2e8f0" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
