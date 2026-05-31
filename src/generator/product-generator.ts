import JSZip from "jszip";

import type {
  ArchitecturalElement,
  Component,
  Connector,
} from "../model/varadl-types";

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

function isConnector(element: ArchitecturalElement): element is Connector {
  return element.kind === "connector";
}

function safeName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function humanizeName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ComponentRole =
  | "service"
  | "gateway"
  | "adapter"
  | "database"
  | "frontend"
  | "runtime"
  | "communication"
  | "deployment"
  | "component";

type GeneratedComponent = {
  name: string;
  label: string;
  role: ComponentRole;
  ports: string[];
  origin: string;
};

type GeneratedConnector = {
  source: string;
  target: string;
};

type Choice = {
  id: string;
  label: string;
  component: string;
  description: string;
  priceImpact?: number;
};

type GeneratedApplicationModel = {
  productName: string;
  domain: "ecommerce" | "generic";
  title: string;
  subtitle: string;
  components: GeneratedComponent[];
  connectors: GeneratedConnector[];
  services: GeneratedComponent[];
  adapters: GeneratedComponent[];
  frontends: GeneratedComponent[];
  databases: GeneratedComponent[];
  communication: GeneratedComponent[];
  deployments: GeneratedComponent[];
  payments: Choice[];
  deliveries: Choice[];
  notifications: Choice[];
};

function classifyComponent(name: string): ComponentRole {
  if (/gateway/i.test(name)) return "gateway";
  if (/adapter|provider|client|connector/i.test(name)) return "adapter";
  if (/database|db|postgres|mongo|mysql|redis/i.test(name)) return "database";
  if (/webapp|mobileapp|frontend|ui|portal|screen|clientapp/i.test(name)) return "frontend";
  if (/runtime|monolith|microservice/i.test(name)) return "runtime";
  if (/broker|eventbus|message|rest|communication|kafka|queue/i.test(name)) return "communication";
  if (/deployment|docker|cloud|kubernetes|target|compose/i.test(name)) return "deployment";
  if (/service|manager|controller|module|engine/i.test(name)) return "service";
  return "component";
}

function hasComponent(components: GeneratedComponent[], pattern: RegExp): boolean {
  return components.some((component) => pattern.test(component.name));
}

function buildChoice(
  id: string,
  label: string,
  component: string,
  description: string,
  priceImpact?: number
): Choice {
  return { id, label, component, description, priceImpact };
}

function buildApplicationModel(productName: string, elements: ArchitecturalElement[]): GeneratedApplicationModel {
  const components = elements.filter(isComponent).map((component): GeneratedComponent => ({
    name: component.name,
    label: humanizeName(component.name),
    role: classifyComponent(component.name),
    ports: component.ports.map((port) => port.name),
    origin: component.origin ?? "core",
  }));

  const connectors = elements.filter(isConnector).map((connector) => ({
    source: `${connector.sourceComponent}.${connector.sourcePort}`,
    target: `${connector.targetComponent}.${connector.targetPort}`,
  }));

  const componentText = `${productName} ${components.map((component) => component.name).join(" ")}`.toLowerCase();
  const domain = /commerce|shop|cart|catalog|order|payment|delivery/.test(componentText) ? "ecommerce" : "generic";

  const payments: Choice[] = [];
  if (hasComponent(components, /stripe/i)) {
    payments.push(buildChoice("stripe", "Stripe", "StripeAdapter", "Paiement carte bancaire simulé via Stripe."));
  }
  if (hasComponent(components, /paypal/i)) {
    payments.push(buildChoice("paypal", "PayPal", "PayPalAdapter", "Paiement simulé via PayPal."));
  }
  if (payments.length === 0) {
    payments.push(buildChoice("mock-payment", "Paiement simulé", "GenericPaymentAdapter", "Paiement générique simulé."));
  }

  const deliveries: Choice[] = [];
  if (hasComponent(components, /standard.*delivery|standard/i)) {
    deliveries.push(buildChoice("standard", "Livraison standard", "StandardDeliveryAdapter", "Livraison estimée entre 3 et 5 jours ouvrés.", 4.99));
  }
  if (hasComponent(components, /express.*delivery|express/i)) {
    deliveries.push(buildChoice("express", "Livraison express", "ExpressDeliveryAdapter", "Livraison prioritaire sous 24 à 48h.", 12.99));
  }
  if (deliveries.length === 0) {
    deliveries.push(buildChoice("standard", "Livraison standard", "GenericDeliveryAdapter", "Livraison simulée par défaut.", 4.99));
  }

  const notifications: Choice[] = [];
  if (hasComponent(components, /email/i)) {
    notifications.push(buildChoice("email", "E-mail", "EmailNotificationAdapter", "Confirmation envoyée par e-mail."));
  }
  if (hasComponent(components, /sms/i)) {
    notifications.push(buildChoice("sms", "SMS", "SmsNotificationAdapter", "Confirmation envoyée par SMS."));
  }
  if (hasComponent(components, /push/i)) {
    notifications.push(buildChoice("push", "Push", "PushNotificationAdapter", "Notification push reçue dans l'application."));
  }
  if (notifications.length === 0) {
    notifications.push(buildChoice("none", "Aucune notification", "NoNotificationAdapter", "Aucun canal de notification sélectionné."));
  }

  return {
    productName,
    domain,
    title: domain === "ecommerce" ? "Boutique en ligne générée" : "Produit généré",
    subtitle:
      domain === "ecommerce"
        ? "Catalogue, panier, livraison, paiement et confirmation générés depuis l'architecture produit dérivée."
        : "Application démonstrative générée depuis l'architecture produit dérivée.",
    components,
    connectors,
    services: components.filter((component) => component.role === "service"),
    adapters: components.filter((component) => component.role === "adapter"),
    frontends: components.filter((component) => component.role === "frontend"),
    databases: components.filter((component) => component.role === "database"),
    communication: components.filter((component) => component.role === "communication"),
    deployments: components.filter((component) => component.role === "deployment"),
    payments,
    deliveries,
    notifications,
  };
}

function buildPackageJson(productName: string): string {
  return JSON.stringify(
    {
      name: safeName(productName) || "generated-product",
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        start: "node src/server.js",
        dev: "node src/server.js",
      },
      dependencies: {
        express: "^4.18.3",
        cors: "^2.8.5",
      },
    },
    null,
    2
  );
}

function buildServerJs(model: GeneratedApplicationModel): string {
  const eventRoute = model.communication.some((component) => /broker|eventbus|message|kafka/i.test(component.name))
    ? 'app.get("/api/events", (_req, res) => res.json(events));'
    : "";

  return `import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const productConfig = JSON.parse(readFileSync(join(__dirname, "config", "product-config.json"), "utf-8"));

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, "..", "public")));

const products = [
  { id: 1, name: "Sac urbain", price: 79, category: "Accessoires", image: "S" },
  { id: 2, name: "Casque audio", price: 129, category: "Électronique", image: "C" },
  { id: 3, name: "Montre connectée", price: 199, category: "High-tech", image: "M" },
  { id: 4, name: "Lampe connectée", price: 59, category: "Maison", image: "L" }
];

let cart = [];
let orders = [];
let events = [];

function publishEvent(type, payload) {
  const event = { type, payload, timestamp: new Date().toISOString() };
  events.push(event);
  return event;
}

function cartWithTotals() {
  const items = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return { ...item, product, lineTotal: product ? product.price * item.quantity : 0 };
  }).filter((item) => item.product);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items, subtotal };
}

function selectedAdapter(type, id) {
  const choices = productConfig[type] || [];
  return choices.find((choice) => choice.id === id) || choices[0] || null;
}

app.get("/api", (_req, res) => {
  res.json({ product: productConfig.name, domain: productConfig.domain, endpoints: productConfig.endpoints });
});

app.get("/api/config", (_req, res) => res.json(productConfig));
app.get("/api/catalog", (_req, res) => res.json(products));
app.get("/api/cart", (_req, res) => res.json(cartWithTotals()));
app.get("/api/orders", (_req, res) => res.json(orders));
app.get("/api/options", (_req, res) => res.json({ payments: productConfig.payments, deliveries: productConfig.deliveries, notifications: productConfig.notifications }));
${eventRoute}

app.post("/api/cart/add", (req, res) => {
  const productId = Number(req.body.productId);
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  const existing = cart.find((item) => item.productId === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  publishEvent("cart.itemAdded", { productId });
  res.json({ message: product.name + " ajouté au panier", cart: cartWithTotals() });
});

app.patch("/api/cart/:productId", (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Math.max(0, Number(req.body.quantity || 0));
  if (quantity === 0) cart = cart.filter((item) => item.productId !== productId);
  else {
    const item = cart.find((entry) => entry.productId === productId);
    if (item) item.quantity = quantity;
  }
  publishEvent("cart.quantityChanged", { productId, quantity });
  res.json(cartWithTotals());
});

app.delete("/api/cart/:productId", (req, res) => {
  const productId = Number(req.params.productId);
  cart = cart.filter((item) => item.productId !== productId);
  publishEvent("cart.itemRemoved", { productId });
  res.json(cartWithTotals());
});

app.post("/api/cart/clear", (_req, res) => {
  cart = [];
  publishEvent("cart.cleared", {});
  res.json(cartWithTotals());
});

app.post("/api/checkout", (req, res) => {
  const currentCart = cartWithTotals();
  if (currentCart.items.length === 0) return res.status(400).json({ error: "Cart is empty" });

  const delivery = selectedAdapter("deliveries", req.body.deliveryId);
  const payment = selectedAdapter("payments", req.body.paymentId);
  const notificationIds = Array.isArray(req.body.notificationIds) ? req.body.notificationIds : [];
  const notifications = (productConfig.notifications || []).filter((choice) => notificationIds.includes(choice.id));
  const deliveryPrice = delivery?.priceImpact || 0;
  const total = currentCart.subtotal + deliveryPrice;

  const paymentSimulation = {
    provider: payment?.label || "Paiement simulé",
    adapter: payment?.component || "GenericPaymentAdapter",
    status: "ACCEPTED",
    transactionId: "TX-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
    authorizedAmount: total,
    message: "Paiement simulé accepté par " + (payment?.label || "le fournisseur sélectionné"),
  };

  const notificationReceipts = notifications.map((notification) => ({
    channel: notification.label,
    adapter: notification.component,
    status: "SENT",
    message:
      notification.id === "push"
        ? "Notification push reçue dans l'application"
        : "Confirmation envoyée via " + notification.label,
    deliveredAt: new Date().toISOString(),
  }));

  const order = {
    id: "ORD-" + String(Date.now()).slice(-8),
    status: "CONFIRMED",
    items: currentCart.items,
    subtotal: currentCart.subtotal,
    delivery,
    payment,
    notifications,
    paymentSimulation,
    notificationReceipts,
    total,
    generatedByArchitecture: {
      paymentAdapter: payment?.component,
      deliveryAdapter: delivery?.component,
      notificationAdapters: notifications.map((item) => item.component),
      database: productConfig.databases,
      communication: productConfig.communication,
    },
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  cart = [];
  publishEvent("payment.accepted", { orderId: order.id, transactionId: paymentSimulation.transactionId });
  for (const receipt of notificationReceipts) {
    publishEvent("notification.sent", { orderId: order.id, channel: receipt.channel });
  }
  publishEvent("order.confirmed", { orderId: order.id, total });
  res.json(order);
});

app.listen(port, () => {
  console.log("Generated product " + productConfig.name + " running on http://localhost:" + port);
});
`;
}

function buildProductConfig(model: GeneratedApplicationModel): string {
  const endpoints = [
    "GET /api/catalog",
    "GET /api/cart",
    "POST /api/cart/add",
    "PATCH /api/cart/:productId",
    "DELETE /api/cart/:productId",
    "POST /api/checkout",
    "GET /api/options",
    "GET /api/orders",
    "GET /api/config",
    model.communication.some((component) => /broker|eventbus|message|kafka/i.test(component.name)) ? "GET /api/events" : null,
  ].filter(Boolean);

  return JSON.stringify(
    {
      name: model.productName,
      domain: model.domain,
      title: model.title,
      subtitle: model.subtitle,
      generatedBy: "VarADL Studio",
      endpoints,
      payments: model.payments,
      deliveries: model.deliveries,
      notifications: model.notifications,
      frontends: model.frontends.map((component) => component.name),
      databases: model.databases.map((component) => component.name),
      communication: model.communication.map((component) => component.name),
      deployments: model.deployments.map((component) => component.name),
      components: model.components,
      connectors: model.connectors,
      architecturalTrace: {
        message: "This executable product is generated from the active components of the derived VarADL architecture.",
        activeComponents: model.components.map((component) => component.name),
      },
    },
    null,
    2
  );
}

function buildIndexHtml(productName: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${productName}</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <header class="header">
    <div>
      <p class="eyebrow">Generated by VarADL Studio</p>
      <h1 id="app-title">${productName}</h1>
      <p id="app-subtitle" class="subtitle">Chargement...</p>
      <div id="architecture-badges" class="badges"></div>
    </div>
    <div class="cart-summary">
      <strong>Panier</strong>
      <span id="header-cart-count">0 article</span>
      <span id="header-cart-total">0,00 €</span>
    </div>
  </header>

  <main class="container">
    <nav class="steps">
      <button class="step active" data-step="catalog">1. Catalogue</button>
      <button class="step" data-step="cart">2. Panier</button>
      <button class="step" data-step="delivery">3. Livraison</button>
      <button class="step" data-step="payment">4. Paiement</button>
      <button class="step" data-step="confirmation">5. Confirmation</button>
    </nav>

    <section id="alert" class="alert hidden"></section>

    <section class="layout">
      <article class="main-card">
        <div class="section-header">
          <div>
            <h2 id="main-title">Boutique</h2>
            <p id="main-description">Sélectionnez plusieurs articles, puis suivez le parcours d'achat.</p>
          </div>
          <button id="reset-shop" class="secondary">Réinitialiser</button>
        </div>
        <div id="main-content"></div>
      </article>

      <aside class="side-card">
        <h2>Résumé</h2>
        <div id="cart-panel"></div>
        <button id="primary-action" class="primary">Voir le panier</button>
      </aside>
    </section>

    <section class="trace-grid">
      <article><h3>Paiement</h3><p id="trace-payment">-</p></article>
      <article><h3>Livraison</h3><p id="trace-delivery">-</p></article>
      <article><h3>Notification</h3><p id="trace-notification">-</p></article>
      <article><h3>Communication</h3><p id="trace-communication">-</p></article>
      <article><h3>Base de données</h3><p id="trace-database">-</p></article>
      <article><h3>Déploiement</h3><p id="trace-deployment">-</p></article>
    </section>
  </main>

  <script type="module" src="/app.js"></script>
</body>
</html>`;
}

function buildStylesCss(): string {
  return `:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #071936;
  background: #f4f7fb;
}
* { box-sizing: border-box; }
body { margin: 0; }
button, select, input { font: inherit; }
.header {
  background: linear-gradient(120deg, #173b85, #2563eb, #7c3aed);
  color: white;
  padding: 48px 56px;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 32px;
  align-items: center;
}
.eyebrow { text-transform: uppercase; letter-spacing: 0.18em; opacity: .85; }
h1 { font-size: 48px; margin: 10px 0; }
.subtitle { font-size: 20px; line-height: 1.5; max-width: 900px; }
.cart-summary { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.26); border-radius: 22px; padding: 24px; display: grid; gap: 10px; font-size: 18px; }
.badges { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
.badge { padding: 9px 14px; border-radius: 999px; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.26); font-weight: 800; }
.container { padding: 36px 52px 70px; }
.steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 26px; }
.step { border: 1px solid #cbd5e1; border-radius: 18px; background: white; padding: 18px; font-weight: 900; color: #64748b; cursor: pointer; }
.step.active { background: #2563eb; color: white; box-shadow: 0 18px 30px rgba(37,99,235,.20); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 28px; }
.main-card, .side-card, .trace-grid article { background: white; border: 1px solid #dbe3ef; border-radius: 24px; box-shadow: 0 18px 50px rgba(15,23,42,.06); }
.main-card { padding: 28px; min-height: 520px; }
.side-card { padding: 26px; align-self: start; position: sticky; top: 20px; }
.section-header { display: flex; justify-content: space-between; gap: 20px; align-items: start; margin-bottom: 24px; }
h2 { font-size: 30px; margin: 0 0 10px; }
h3 { margin-top: 0; color: #1744aa; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 22px; }
.product-card, .choice-card, .cart-row, .confirmation-card { border: 1px solid #dbe7f6; background: #f8fbff; border-radius: 20px; padding: 20px; }
.product-image { height: 140px; display: grid; place-items: center; border-radius: 18px; background: linear-gradient(135deg, #dceafe, #ece7ff); font-size: 56px; color: #1d4ed8; font-weight: 1000; margin-bottom: 18px; }
.price { font-size: 22px; font-weight: 1000; }
.primary, .secondary, .danger { border: 0; border-radius: 16px; padding: 14px 18px; cursor: pointer; font-weight: 1000; }
.primary { background: #2563eb; color: white; width: 100%; }
.secondary { background: #e8eefc; color: #123a88; }
.danger { background: #fee2e2; color: #b91c1c; }
.card-button { margin-top: 14px; width: 100%; }
.cart-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-bottom: 12px; }
.qty-controls { display: flex; gap: 8px; align-items: center; }
.qty-controls button { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
.summary-line { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
.summary-line.total { font-size: 22px; font-weight: 1000; border-bottom: 0; }
.choice-list { display: grid; gap: 14px; }
.choice-card { cursor: pointer; display: flex; gap: 14px; align-items: flex-start; }
.choice-card.selected { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.choice-card input { margin-top: 6px; }
.trace-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; }
.trace-grid article { padding: 22px; }
.alert { margin-bottom: 20px; padding: 16px 18px; border-radius: 16px; background: #ecfdf5; color: #047857; font-weight: 900; }
.alert.error { background: #fef2f2; color: #b91c1c; }
.hidden { display: none; }
pre { white-space: pre-wrap; background: #eef2f7; border-radius: 16px; padding: 16px; overflow: auto; }
@media (max-width: 1000px) { .header, .layout { grid-template-columns: 1fr; } .steps, .trace-grid { grid-template-columns: 1fr; } }
`;
}

function buildClientAppJs(): string {
  return `const state = {
  config: null,
  products: [],
  cart: { items: [], subtotal: 0 },
  step: "catalog",
  deliveryId: null,
  paymentId: null,
  notificationIds: [],
  order: null,
};

const euro = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });

async function api(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.error || text || "Request failed");
  return data;
}

function qs(id) { return document.getElementById(id); }
function showAlert(message, type = "success") {
  const alert = qs("alert");
  alert.textContent = message;
  alert.className = "alert" + (type === "error" ? " error" : "");
  window.setTimeout(() => alert.classList.add("hidden"), 2500);
}

function setStep(step) {
  state.step = step;
  document.querySelectorAll(".step").forEach((button) => button.classList.toggle("active", button.dataset.step === step));
  render();
}

async function loadAll() {
  state.config = await api("/api/config");
  state.products = await api("/api/catalog");
  state.cart = await api("/api/cart");
  state.deliveryId = state.config.deliveries[0]?.id || null;
  state.paymentId = state.config.payments[0]?.id || null;
  state.notificationIds = state.config.notifications.filter((n) => n.id !== "none").map((n) => n.id);
  renderStaticConfig();
  render();
}

function renderStaticConfig() {
  qs("app-title").textContent = state.config.title || state.config.name;
  qs("app-subtitle").textContent = state.config.subtitle;
  qs("architecture-badges").innerHTML = [
    ["Paiement", state.config.payments.map((p) => p.label).join(" / ")],
    ["Livraison", state.config.deliveries.map((d) => d.label).join(" / ")],
    ["Notification", state.config.notifications.map((n) => n.label).join(" / ")],
  ].map(([key, value]) => '<span class="badge">' + key + ': ' + (value || "-") + '</span>').join("");
  qs("trace-payment").textContent = state.config.payments.map((p) => p.component).join(" / ") || "-";
  qs("trace-delivery").textContent = state.config.deliveries.map((d) => d.component).join(" / ") || "-";
  qs("trace-notification").textContent = state.config.notifications.map((n) => n.component).join(" / ") || "-";
  qs("trace-communication").textContent = state.config.communication.join(" / ") || "-";
  qs("trace-database").textContent = state.config.databases.join(" / ") || "-";
  qs("trace-deployment").textContent = state.config.deployments.join(" / ") || "-";
}

function renderCartPanel() {
  const count = state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const delivery = state.config.deliveries.find((item) => item.id === state.deliveryId);
  const deliveryCost = delivery?.priceImpact || 0;
  const total = state.cart.subtotal + (count ? deliveryCost : 0);
  qs("header-cart-count").textContent = count + (count > 1 ? " articles" : " article");
  qs("header-cart-total").textContent = euro.format(total);
  qs("cart-panel").innerHTML =
    (state.cart.items.length ? state.cart.items.map((item) =>
      '<div class="summary-line"><span>' + item.quantity + ' × ' + item.product.name + '</span><strong>' + euro.format(item.lineTotal) + '</strong></div>'
    ).join("") : '<p>Panier vide</p>') +
    '<div class="summary-line"><span>Livraison</span><strong>' + (count ? euro.format(deliveryCost) : "À choisir") + '</strong></div>' +
    '<div class="summary-line total"><span>Total</span><strong>' + euro.format(total) + '</strong></div>';
}

function renderCatalog() {
  qs("main-title").textContent = "Boutique";
  qs("main-description").textContent = "Ajoutez plusieurs produits au panier. Vous pourrez ensuite choisir la livraison, le paiement et les notifications.";
  qs("primary-action").textContent = "Voir le panier";
  qs("main-content").innerHTML = '<div class="product-grid">' + state.products.map((product) =>
    '<article class="product-card">' +
      '<div class="product-image">' + product.image + '</div>' +
      '<h3>' + product.name + '</h3>' +
      '<p>' + product.category + '</p>' +
      '<p class="price">' + euro.format(product.price) + '</p>' +
      '<button class="primary card-button" data-add-product="' + product.id + '">Ajouter au panier</button>' +
    '</article>'
  ).join("") + '</div>';
}

function renderCart() {
  qs("main-title").textContent = "Panier";
  qs("main-description").textContent = "Modifiez les quantités, retirez des articles ou continuez vos achats.";
  qs("primary-action").textContent = "Choisir la livraison";
  qs("main-content").innerHTML = state.cart.items.length
    ? state.cart.items.map((item) =>
      '<div class="cart-row">' +
        '<div><h3>' + item.product.name + '</h3><p>' + euro.format(item.product.price) + ' / unité</p><strong>' + euro.format(item.lineTotal) + '</strong></div>' +
        '<div class="qty-controls">' +
          '<button data-qty="' + item.productId + '" data-value="' + (item.quantity - 1) + '">−</button>' +
          '<strong>' + item.quantity + '</strong>' +
          '<button data-qty="' + item.productId + '" data-value="' + (item.quantity + 1) + '">+</button>' +
          '<button class="danger" data-remove="' + item.productId + '">Retirer</button>' +
        '</div>' +
      '</div>'
    ).join("") + '<button class="secondary" data-step-target="catalog">Continuer mes achats</button>'
    : '<p>Votre panier est vide.</p><button class="secondary" data-step-target="catalog">Retour au catalogue</button>';
}

function renderDelivery() {
  qs("main-title").textContent = "Livraison";
  qs("main-description").textContent = "Les options disponibles proviennent des variants de livraison actifs dans l'architecture dérivée.";
  qs("primary-action").textContent = "Passer au paiement";
  qs("main-content").innerHTML = '<div class="choice-list">' + state.config.deliveries.map((delivery) =>
    '<label class="choice-card ' + (state.deliveryId === delivery.id ? "selected" : "") + '">' +
      '<input type="radio" name="delivery" value="' + delivery.id + '" ' + (state.deliveryId === delivery.id ? "checked" : "") + ' />' +
      '<span><strong>' + delivery.label + '</strong><br />' + delivery.description + '<br /><em>' + euro.format(delivery.priceImpact || 0) + '</em></span>' +
    '</label>'
  ).join("") + '</div>';
}

function renderPayment() {
  qs("main-title").textContent = "Paiement et notifications";
  qs("main-description").textContent = "Les moyens proposés sont ceux dérivés de l'architecture produit.";
  qs("primary-action").textContent = "Confirmer la commande";
  qs("main-content").innerHTML =
    '<h3>Moyen de paiement</h3><div class="choice-list">' + state.config.payments.map((payment) =>
      '<label class="choice-card ' + (state.paymentId === payment.id ? "selected" : "") + '">' +
        '<input type="radio" name="payment" value="' + payment.id + '" ' + (state.paymentId === payment.id ? "checked" : "") + ' />' +
        '<span><strong>' + payment.label + '</strong><br />' + payment.description + '</span>' +
      '</label>'
    ).join("") + '</div>' +
    '<h3>Notifications</h3><div class="choice-list">' + state.config.notifications.map((notification) =>
      '<label class="choice-card ' + (state.notificationIds.includes(notification.id) ? "selected" : "") + '">' +
        '<input type="checkbox" name="notification" value="' + notification.id + '" ' + (state.notificationIds.includes(notification.id) ? "checked" : "") + ' />' +
        '<span><strong>' + notification.label + '</strong><br />' + notification.description + '</span>' +
      '</label>'
    ).join("") + '</div>';
}

function renderConfirmation() {
  qs("main-title").textContent = "Confirmation";
  qs("main-description").textContent = "Commande générée par le produit exécutable.";
  qs("primary-action").textContent = "Nouvelle commande";
  if (!state.order) {
    qs("main-content").innerHTML = '<p>Aucune commande confirmée pour le moment.</p>';
    return;
  }
  const receipts = (state.order.notificationReceipts || []).map((receipt) =>
    '<li><strong>' + receipt.channel + '</strong> — ' + receipt.message + '</li>'
  ).join('');
  qs("main-content").innerHTML =
    '<div class="confirmation-card">' +
      '<h3>Commande ' + state.order.id + '</h3>' +
      '<p>Statut : <strong>' + state.order.status + '</strong></p>' +
      '<p>Total : <strong>' + euro.format(state.order.total) + '</strong></p>' +
      '<h3>Paiement simulé</h3>' +
      '<p><strong>' + state.order.paymentSimulation.provider + '</strong> — transaction ' + state.order.paymentSimulation.transactionId + '</p>' +
      '<p>' + state.order.paymentSimulation.message + '</p>' +
      '<h3>Notifications reçues</h3>' +
      '<ul>' + (receipts || '<li>Aucune notification sélectionnée</li>') + '</ul>' +
      '<h3>Trace architecturale</h3>' +
      '<pre>' + JSON.stringify(state.order.generatedByArchitecture, null, 2) + '</pre>' +
    '</div>';
}

function render() {
  renderCartPanel();
  if (state.step === "catalog") renderCatalog();
  if (state.step === "cart") renderCart();
  if (state.step === "delivery") renderDelivery();
  if (state.step === "payment") renderPayment();
  if (state.step === "confirmation") renderConfirmation();
}

async function refreshCart() {
  state.cart = await api("/api/cart");
  render();
}

async function addProduct(productId) {
  const result = await api("/api/cart/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
  state.cart = result.cart;
  showAlert(result.message);
  render();
}

async function checkout() {
  try {
    const order = await api("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId: state.deliveryId, paymentId: state.paymentId, notificationIds: state.notificationIds }),
    });
    state.order = order;
    state.cart = await api("/api/cart");
    setStep("confirmation");
    showAlert("Commande confirmée");
  } catch (error) {
    showAlert(error.message, "error");
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.dataset.addProduct) await addProduct(Number(target.dataset.addProduct));
  if (target.dataset.remove) { await api("/api/cart/" + target.dataset.remove, { method: "DELETE" }); await refreshCart(); }
  if (target.dataset.qty) { await api("/api/cart/" + target.dataset.qty, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: Number(target.dataset.value) }) }); await refreshCart(); }
  if (target.dataset.stepTarget) setStep(target.dataset.stepTarget);
  if (target.classList.contains("step")) setStep(target.dataset.step);
  if (target.id === "reset-shop") { await api("/api/cart/clear", { method: "POST" }); state.order = null; await refreshCart(); showAlert("Boutique réinitialisée"); }
  if (target.id === "primary-action") {
    if (state.step === "catalog") return setStep("cart");
    if (state.step === "cart") return state.cart.items.length ? setStep("delivery") : showAlert("Ajoutez au moins un produit", "error");
    if (state.step === "delivery") return setStep("payment");
    if (state.step === "payment") return checkout();
    if (state.step === "confirmation") { state.order = null; return setStep("catalog"); }
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.name === "delivery") state.deliveryId = target.value;
  if (target.name === "payment") state.paymentId = target.value;
  if (target.name === "notification") {
    if (target.checked) state.notificationIds = Array.from(new Set([...state.notificationIds, target.value]));
    else state.notificationIds = state.notificationIds.filter((id) => id !== target.value);
  }
  render();
});

await loadAll();
`;
}

function addStaticFiles(zip: JSZip, productName: string): void {
  zip.file("public/index.html", buildIndexHtml(productName));
  zip.file("public/styles.css", buildStylesCss());
  zip.file("public/app.js", buildClientAppJs());
}

function addAdapterFiles(zip: JSZip, model: GeneratedApplicationModel): void {
  for (const adapter of model.adapters) {
    zip.file(
      `src/adapters/${safeName(adapter.name)}.js`,
      `export async function execute(payload = {}) {
  return {
    adapter: ${JSON.stringify(adapter.name)},
    status: "EXECUTED",
    payload,
    timestamp: new Date().toISOString()
  };
}
`
    );
  }
}

function addDatabaseFile(zip: JSZip, model: GeneratedApplicationModel): void {
  zip.file(
    "src/database/database.js",
    `export const database = {
  type: ${JSON.stringify(model.databases[0]?.name ?? "InMemoryDatabase")},
  generatedFrom: "VarADL derived architecture"
};
`
  );
}

function buildReadme(model: GeneratedApplicationModel): string {
  return `# ${model.productName}

Produit exécutable généré par VarADL Studio à partir d'une architecture produit dérivée.

## Lancer le produit

\`\`\`bash
npm install
npm start
\`\`\`

Puis ouvrir :

\`\`\`text
http://localhost:3000
\`\`\`

## Parcours e-commerce généré

Catalogue → Panier → Livraison → Paiement → Confirmation

## Variantes architecturales actives

- Paiement : ${model.payments.map((choice) => choice.component).join(" / ")}
- Livraison : ${model.deliveries.map((choice) => choice.component).join(" / ")}
- Notification : ${model.notifications.map((choice) => choice.component).join(" / ")}
- Communication : ${model.communication.map((component) => component.name).join(" / ") || "-"}
- Base de données : ${model.databases.map((component) => component.name).join(" / ") || "-"}

Cette application est une preuve de faisabilité : elle montre qu'une architecture dérivée peut produire un squelette exécutable avec un parcours métier cohérent.
`;
}

function addDockerCompose(zip: JSZip, model: GeneratedApplicationModel): void {
  if (model.deployments.length === 0) return;
  zip.file(
    "docker-compose.yml",
    `services:
  app:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "npm install && npm start"
    ports:
      - "3000:3000"
    volumes:
      - .:/app
`
  );
}

export async function generateExecutableProductZip(
  productName: string,
  elements: ArchitecturalElement[]
): Promise<void> {
  const zip = new JSZip();
  const model = buildApplicationModel(productName, elements);

  zip.file("package.json", buildPackageJson(productName));
  zip.file("README.md", buildReadme(model));
  zip.file("src/server.js", buildServerJs(model));
  zip.file("src/config/product-config.json", buildProductConfig(model));

  addStaticFiles(zip, productName);
  addAdapterFiles(zip, model);
  addDatabaseFile(zip, model);
  addDockerCompose(zip, model);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${safeName(productName) || "generated-product"}-generated-product.zip`);
}
