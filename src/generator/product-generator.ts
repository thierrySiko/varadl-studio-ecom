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

//
// Note de conception : le générateur produit une MAQUETTE VIDE (squelette),
// pas un produit métier fonctionnel. Chaque route de service est un stub à
// compléter ; chaque adaptateur expose un point d'entrée générique qui
// démontre la traçabilité entre configuration et code, sans simuler de
// logique métier spécifique à un domaine (cf. remarque du 02/07/2026 :
// "produit généré trop spécifique" -> générer une maquette vide plutôt
// qu'un générateur "universel").
type GeneratedApplicationModel = {
  productName: string;
  components: GeneratedComponent[];
  connectors: GeneratedConnector[];
  services: GeneratedComponent[];
  adapters: GeneratedComponent[];
  frontends: GeneratedComponent[];
  databases: GeneratedComponent[];
  communication: GeneratedComponent[];
  deployments: GeneratedComponent[];
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

  return {
    productName,
    components,
    connectors,
    services: components.filter((component) => component.role === "service" || component.role === "gateway"),
    adapters: components.filter((component) => component.role === "adapter"),
    frontends: components.filter((component) => component.role === "frontend"),
    databases: components.filter((component) => component.role === "database"),
    communication: components.filter((component) => component.role === "communication"),
    deployments: components.filter((component) => component.role === "deployment"),
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
  const serviceRoutes = model.services
    .map(
      (component) => `app.get("/api/components/${safeName(component.name)}", (_req, res) => {
  // TODO: implémenter la logique métier de ${component.label}.
  res.json({
    component: ${JSON.stringify(component.name)},
    role: ${JSON.stringify(component.role)},
    status: "TODO",
    message: "Stub généré depuis l'architecture dérivée - logique métier à implémenter."
  });
});`
    )
    .join("\n\n");

  const adapterRoutes = model.adapters
    .map(
      (component) => `app.post("/api/adapters/${safeName(component.name)}", async (req, res) => {
  const adapter = await import("./adapters/${safeName(component.name)}.js");
  const result = await adapter.execute(req.body ?? {});
  res.json(result);
});`
    )
    .join("\n\n");

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

app.get("/api", (_req, res) => {
  res.json({ product: productConfig.name, endpoints: productConfig.endpoints });
});

app.get("/api/config", (_req, res) => res.json(productConfig));

${serviceRoutes || "// Aucun composant de type service/gateway détecté dans cette architecture."}

${adapterRoutes || "// Aucun adaptateur détecté dans cette architecture."}

app.listen(port, () => {
  console.log("Generated product " + productConfig.name + " running on http://localhost:" + port);
});
`;
}

function buildProductConfig(model: GeneratedApplicationModel): string {
  const endpoints = [
    "GET /api",
    "GET /api/config",
    ...model.services.map((component) => `GET /api/components/${safeName(component.name)}`),
    ...model.adapters.map((component) => `POST /api/adapters/${safeName(component.name)}`),
  ];

  return JSON.stringify(
    {
      name: model.productName,
      generatedBy: "VarADL Studio",
      kind: "squelette applicatif (maquette vide)",
      endpoints,
      services: model.services.map((component) => ({ name: component.name, slug: safeName(component.name) })),
      adapters: model.adapters.map((component) => ({ name: component.name, slug: safeName(component.name) })),
      frontends: model.frontends.map((component) => component.name),
      databases: model.databases.map((component) => component.name),
      communication: model.communication.map((component) => component.name),
      deployments: model.deployments.map((component) => component.name),
      components: model.components,
      connectors: model.connectors,
      architecturalTrace: {
        message:
          "Ce squelette exécutable est généré à partir des composants actifs de l'architecture VarADL dérivée. Chaque route est un stub à compléter avec la logique métier réelle : le générateur ne prétend pas résoudre le domaine applicatif, seulement refléter fidèlement la structure et les choix de configuration.",
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
    <p class="eyebrow">Squelette généré par VarADL Studio</p>
    <h1 id="app-title">${productName}</h1>
    <p class="subtitle">
      Maquette vide dérivée de l'architecture produit : chaque bloc ci-dessous correspond à un
      élément architectural actif dans la configuration. Les services exposent un stub à compléter ;
      les adaptateurs peuvent être exécutés pour vérifier la traçabilité entre configuration et code.
    </p>
  </header>

  <main class="container">
    <section>
      <h2>Composants de type service / gateway</h2>
      <div id="services-list" class="card-grid"></div>
    </section>

    <section>
      <h2>Adaptateurs (variantes technologiques actives)</h2>
      <div id="adapters-list" class="card-grid"></div>
    </section>

    <section>
      <h2>Autres éléments de l'architecture dérivée</h2>
      <div id="misc-list" class="card-grid"></div>
    </section>

    <section>
      <h2>Résultat du dernier appel</h2>
      <pre id="result-output">Sélectionnez un composant ou un adaptateur ci-dessus.</pre>
    </section>
  </main>

  <script type="module" src="/app.js"></script>
</body>
</html>`;
}

function buildStylesCss(): string {
  return `:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #0f172a;
  background: #f4f7fb;
}
* { box-sizing: border-box; }
body { margin: 0; }
button { font: inherit; cursor: pointer; }
.header {
  background: linear-gradient(120deg, #173b85, #2563eb);
  color: white;
  padding: 40px 48px;
}
.eyebrow { text-transform: uppercase; letter-spacing: 0.18em; opacity: .85; font-size: 13px; }
h1 { font-size: 36px; margin: 10px 0; }
.subtitle { font-size: 16px; line-height: 1.6; max-width: 760px; opacity: .95; }
.container { padding: 32px 48px 64px; display: grid; gap: 32px; }
h2 { font-size: 20px; margin-bottom: 14px; color: #173b85; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.card {
  background: white; border: 1px solid #dbe3ef; border-radius: 16px; padding: 18px;
  box-shadow: 0 10px 30px rgba(15,23,42,.05); display: grid; gap: 8px;
}
.card h3 { margin: 0; font-size: 16px; }
.card .role { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: #2563eb; background: #eaf1ff; padding: 3px 8px; border-radius: 999px; width: fit-content; }
.card button { border: 0; border-radius: 10px; padding: 8px 12px; background: #2563eb; color: white; font-weight: 600; }
.card button:hover { background: #1744aa; }
.empty { color: #64748b; font-style: italic; }
pre#result-output {
  background: #0f172a; color: #e2e8f0; padding: 18px; border-radius: 14px; overflow: auto;
  min-height: 60px; white-space: pre-wrap;
}
`;
}

function buildClientAppJs(): string {
  return `async function api(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, data };
}

function qs(id) { return document.getElementById(id); }

function showResult(data) {
  qs("result-output").textContent = JSON.stringify(data, null, 2);
}

function componentCard(component, action) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<span class="role">' + component.role + '</span>' +
    '<h3>' + component.name + '</h3>';
  const button = document.createElement("button");
  button.textContent = action.label;
  button.addEventListener("click", async () => {
    const { data } = await api(action.url, action.options);
    showResult(data);
  });
  card.appendChild(button);
  return card;
}

function renderList(containerId, components, buildAction) {
  const container = qs(containerId);
  container.innerHTML = "";
  if (components.length === 0) {
    container.innerHTML = '<p class="empty">Aucun élément de ce type dans cette configuration.</p>';
    return;
  }
  components.forEach((component) => container.appendChild(componentCard(component, buildAction(component))));
}

async function loadAll() {
  const { data: config } = await api("/api/config");

  const services = (config.services || []).map((entry) => ({ name: entry.name, slug: entry.slug, role: "service" }));
  renderList("services-list", services, (component) => ({
    label: "Appeler le stub",
    url: "/api/components/" + component.slug,
    options: undefined,
  }));

  const adapters = (config.adapters || []).map((entry) => ({ name: entry.name, slug: entry.slug, role: "adapter" }));
  renderList("adapters-list", adapters, (component) => ({
    label: "Exécuter l'adaptateur",
    url: "/api/adapters/" + component.slug,
    options: { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  }));

  const misc = [
    ...(config.frontends || []).map((name) => ({ name, role: "frontend" })),
    ...(config.databases || []).map((name) => ({ name, role: "database" })),
    ...(config.communication || []).map((name) => ({ name, role: "communication" })),
    ...(config.deployments || []).map((name) => ({ name, role: "deployment" })),
  ];
  const container = qs("misc-list");
  container.innerHTML = misc.length
    ? misc.map((component) => '<div class="card"><span class="role">' + component.role + '</span><h3>' + component.name + '</h3></div>').join("")
    : '<p class="empty">Aucun autre élément détecté.</p>';
}

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
      `// Stub généré depuis la variante technologique "${adapter.name}".
// TODO: remplacer ce corps par l'implémentation réelle de l'adaptateur.
export async function execute(payload = {}) {
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

Squelette applicatif (maquette vide) généré par VarADL Studio à partir d'une
architecture produit dérivée. Ce n'est pas un produit métier fonctionnel : chaque
route de service est un stub à compléter, chaque adaptateur retourne une réponse
simulée générique. L'objectif est de démontrer la traçabilité entre les décisions
de configuration et le code généré, pas de résoudre un domaine applicatif
particulier.

## Lancer le produit

\`\`\`bash
npm install
npm start
\`\`\`

Puis ouvrir :

\`\`\`text
http://localhost:3000
\`\`\`

## Composants générés

- Services / gateways : ${model.services.map((component) => component.name).join(", ") || "aucun"}
- Adaptateurs (variantes technologiques actives) : ${model.adapters.map((component) => component.name).join(", ") || "aucun"}
- Bases de données : ${model.databases.map((component) => component.name).join(", ") || "aucune"}
- Communication : ${model.communication.map((component) => component.name).join(", ") || "-"}
- Déploiement : ${model.deployments.map((component) => component.name).join(", ") || "-"}

## Limites assumées

Ce générateur produit un squelette structurel, pas une implémentation métier
générique. Compléter chaque stub (\`TODO\`) reste à la charge du développeur.
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
