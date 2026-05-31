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

import type { Architecture } from "../model/varadl-types";

interface Props {
  architecture: Architecture;
  selection?: Record<string, string[]>;
}

type FeatureKind = "root" | "mandatory" | "optional" | "abstract";
type MarkerKind = "mandatory" | "optional" | "xor" | "or";

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function selectedFunctionalFeatures(selection?: Record<string, string[]>): Set<string> {
  const selected = new Set<string>();
  const values = Object.values(selection ?? {}).flat();

  if (values.includes("StripeAdapter")) selected.add("CreditCard");
  if (values.includes("PayPalAdapter")) selected.add("PayPal");
  if (values.includes("StandardDelivery")) selected.add("StandardDelivery");
  if (values.includes("ExpressDelivery")) selected.add("ExpressDelivery");
  if (values.includes("EmailNotification")) selected.add("EmailNotification");
  if (values.includes("SmsNotification")) selected.add("SmsNotification");
  if (values.includes("RecommendationEnabled")) selected.add("RecommendationService");

  // Les fonctionnalités de base sont toujours présentes dans l'exemple e-commerce.
  [
    "ProductCatalog",
    "UserAccount",
    "ShoppingCart",
    "Checkout",
    "Payment",
    "Delivery",
    "Notification",
  ].forEach((feature) => selected.add(feature));

  return selected;
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
  selection,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    const selected = selectedFunctionalFeatures(selection);
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    function addFeature(
      id: string,
      label: string,
      x: number,
      y: number,
      kind: FeatureKind = "mandatory"
    ) {
      nodes.push({
        id,
        position: { x, y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: true,
        data: { label },
        style: featureStyle(kind, selected.has(id)),
      });
    }

    function addMarker(id: string, kind: MarkerKind, x: number, y: number) {
      nodes.push({
        id,
        position: { x, y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: true,
        selectable: false,
        data: { label: markerLabel(kind) },
        style: markerStyle(kind),
      });
    }

    function addMandatory(parent: string, child: string, marker: string, x: number, y: number) {
      addMarker(marker, "mandatory", x, y);
      edges.push(relationEdge(`${parent}-${marker}`, parent, marker));
      edges.push(relationEdge(`${marker}-${child}`, marker, child));
    }

    function addOptional(parent: string, child: string, marker: string, x: number, y: number) {
      addMarker(marker, "optional", x, y);
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
      children: string[],
      x: number,
      y: number
    ) {
      addMarker(marker, markerKind, x, y);
      edges.push(relationEdge(`${parent}-${marker}`, parent, marker));
      children.forEach((child) => edges.push(relationEdge(`${marker}-${child}`, marker, child)));
    }

    addFeature("ECommerceSystem", "ECommerceSystem", 520, 20, "root");

    // Fonctionnalités métier principales.
    addFeature("ProductCatalog", "ProductCatalog", 80, 190);
    addFeature("UserAccount", "UserAccount", 260, 190);
    addFeature("ShoppingCart", "ShoppingCart", 440, 190);
    addFeature("Checkout", "Checkout", 620, 190);
    addFeature("Payment", "Payment", 800, 190, "abstract");
    addFeature("Delivery", "Delivery", 980, 190, "abstract");
    addFeature("Notification", "Notification", 1160, 190, "abstract");

    addMandatory("ECommerceSystem", "ProductCatalog", "m-catalog", 138, 125);
    addMandatory("ECommerceSystem", "UserAccount", "m-user", 318, 125);
    addMandatory("ECommerceSystem", "ShoppingCart", "m-cart", 498, 125);
    addMandatory("ECommerceSystem", "Checkout", "m-checkout", 678, 125);
    addMandatory("ECommerceSystem", "Payment", "m-payment", 858, 125);
    addMandatory("ECommerceSystem", "Delivery", "m-delivery", 1038, 125);
    addMandatory("ECommerceSystem", "Notification", "m-notification", 1218, 125);

    // Fonctionnalités optionnelles.
    addFeature("RecommendationService", "Recommendation", 260, 430, "optional");
    addFeature("Reviews", "Reviews", 80, 430, "optional");
    addFeature("Wishlist", "Wishlist", 440, 430, "optional");
    addFeature("Promotions", "Promotions", 620, 430, "optional");
    addFeature("LoyaltyProgram", "LoyaltyProgram", 800, 430, "optional");

    addOptional("ECommerceSystem", "Reviews", "o-reviews", 138, 355);
    addOptional("ECommerceSystem", "RecommendationService", "o-reco", 318, 355);
    addOptional("ECommerceSystem", "Wishlist", "o-wishlist", 498, 355);
    addOptional("ECommerceSystem", "Promotions", "o-promotions", 678, 355);
    addOptional("ECommerceSystem", "LoyaltyProgram", "o-loyalty", 858, 355);

    // Groupes fonctionnels.
    addFeature("CreditCard", "CreditCard", 720, 350);
    addFeature("PayPal", "PayPal", 880, 350);
    addGroup("Payment", "xor-payment", "xor", ["CreditCard", "PayPal"], 820, 285);

    addFeature("StandardDelivery", "Standard", 900, 350);
    addFeature("ExpressDelivery", "Express", 1060, 350);
    addGroup("Delivery", "xor-delivery", "xor", ["StandardDelivery", "ExpressDelivery"], 1000, 285);

    addFeature("EmailNotification", "Email", 1080, 350);
    addFeature("SmsNotification", "SMS", 1240, 350);
    addFeature("PushNotification", "Push", 1400, 350);
    addGroup(
      "Notification",
      "or-notification",
      "or",
      ["EmailNotification", "SmsNotification", "PushNotification"],
      1220,
      285
    );

    // Contraintes transversales fonctionnelles.
    const constraintEdges: Edge[] = [
      {
        id: "requires-reco-catalog",
        source: "RecommendationService",
        target: "ProductCatalog",
        label: "requires",
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16a34a" },
        style: { stroke: "#16a34a", strokeWidth: 2, strokeDasharray: "7 5" },
        labelStyle: { fill: "#166534", fontWeight: 700, fontSize: 11 },
      },
      {
        id: "requires-reviews-account",
        source: "Reviews",
        target: "UserAccount",
        label: "requires",
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16a34a" },
        style: { stroke: "#16a34a", strokeWidth: 2, strokeDasharray: "7 5" },
        labelStyle: { fill: "#166534", fontWeight: 700, fontSize: 11 },
      },
      {
        id: "requires-wishlist-account",
        source: "Wishlist",
        target: "UserAccount",
        label: "requires",
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16a34a" },
        style: { stroke: "#16a34a", strokeWidth: 2, strokeDasharray: "7 5" },
        labelStyle: { fill: "#166534", fontWeight: 700, fontSize: 11 },
      },
      {
        id: "excludes-guest-loyalty",
        source: "LoyaltyProgram",
        target: "PayPal",
        label: "example excludes",
        type: "bezier",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#dc2626" },
        style: { stroke: "#dc2626", strokeWidth: 2, strokeDasharray: "7 5" },
        labelStyle: { fill: "#991b1b", fontWeight: 700, fontSize: 11 },
      },
    ];

    edges.push(...constraintEdges);

    return { nodes, edges };
  }, [selection]);

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
        Cette vue représente le Feature Model au sens SPL classique : elle se concentre
        sur les fonctionnalités visibles du produit. Les choix techniques comme REST,
        EventBus, PostgreSQL ou Docker restent modélisés au niveau architectural dans
        VarADL.
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
