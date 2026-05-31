import { useEffect, useMemo, useState } from "react";
import ArchitectureEditor from "./components/ArchitectureEditor";
import ConfigEditor from "./components/ConfigEditor";
import ResultViewer from "./components/ResultViewer";
import VariabilityPanel from "./components/VariabilityPanel";
import ConstraintPanel from "./components/ConstraintPanel";
import ConfigurationSpacePanel from "./components/ConfigurationSpacePanel";
import GeneratedProductsPanel from "./components/GeneratedProductsPanel";
import GraphViewReactFlow from "./components/GraphViewReactFlow";
import FeatureModelGraph from "./components/FeatureModelGraph";
import SPLGraphView from "./components/SPLGraphView";

import { parseArchitecture, parseConfiguration } from "./parser/varadl-parser";
import { deriveProductArchitecture, productToText } from "./engine/derivation-engine";

import type {
  Architecture,
  ArchitecturalElement,
  Component,
  Configuration,
  ProductArchitecture,
} from "./model/varadl-types";

const sampleArchitecture = `architecture ECommerceSPL {

component ApiGateway {
  port webIn
  port mobileIn
  port catalogOut
  port cartOut
  port orderOut
}

component CatalogService {
  port catalogIn
  port dbOut
  port recoOut
}

component CartService {
  port cartIn
  port dbOut
}

component OrderService {
  port orderIn
  port paymentOut
  port deliveryOut
  port notificationOut
  port dbOut
  port eventOut
}

component PaymentService {
  port paymentIn
  port providerOut
}

component DeliveryService {
  port deliveryIn
  port providerOut
}

component NotificationService {
  port notificationIn
  port channelOut
}

variationPoint FrontendType alternative {

  variant ReactWebApp {
    component ReactWebApp {
      port apiOut
    }

    connect ReactWebApp.apiOut -> ApiGateway.webIn
  }

  variant MobileApp {
    component MobileApp {
      port apiOut
    }

    connect MobileApp.apiOut -> ApiGateway.mobileIn
  }
}

variationPoint BackendStyle alternative {

  variant ModularMonolith {
    component ModularMonolithRuntime {
      port runtimeIn
    }
  }

  variant Microservices {
    component MicroservicesRuntime {
      port runtimeIn
    }
  }
}

variationPoint PaymentType or {

  variant StripeAdapter {
    component StripeAdapter {
      port paymentIn
    }

    connect PaymentService.providerOut -> StripeAdapter.paymentIn
  }

  variant PayPalAdapter {
    component PayPalAdapter {
      port paymentIn
    }

    connect PaymentService.providerOut -> PayPalAdapter.paymentIn
  }
}

variationPoint DeliveryType or {

  variant StandardDelivery {
    component StandardDeliveryAdapter {
      port deliveryIn
    }

    connect DeliveryService.providerOut -> StandardDeliveryAdapter.deliveryIn
  }

  variant ExpressDelivery {
    component ExpressDeliveryAdapter {
      port deliveryIn
    }

    connect DeliveryService.providerOut -> ExpressDeliveryAdapter.deliveryIn
  }
}

variationPoint NotificationType or {

  variant EmailNotification {
    component EmailNotificationAdapter {
      port notificationIn
    }

    connect NotificationService.channelOut -> EmailNotificationAdapter.notificationIn
  }

  variant SmsNotification {
    component SmsNotificationAdapter {
      port notificationIn
    }

    connect NotificationService.channelOut -> SmsNotificationAdapter.notificationIn
  }

  variant PushNotification {
    component PushNotificationAdapter {
      port notificationIn
    }

    connect NotificationService.channelOut -> PushNotificationAdapter.notificationIn
  }
}

variationPoint Recommendation optional {

  variant RecommendationEnabled {
    component RecommendationService {
      port recommendationIn
    }

    connect CatalogService.recoOut -> RecommendationService.recommendationIn
  }
}

variationPoint CommunicationStyle alternative {

  variant REST {
    component RestCommunication {
      port restIn
    }
  }

  variant EventBus {
    component MessageBroker {
      port eventIn
    }

    connect OrderService.eventOut -> MessageBroker.eventIn
  }
}

variationPoint DatabaseType alternative {

  variant PostgreSQL {
    component PostgreSQLDatabase {
      port dbIn
    }

    connect CatalogService.dbOut -> PostgreSQLDatabase.dbIn
    connect CartService.dbOut -> PostgreSQLDatabase.dbIn
    connect OrderService.dbOut -> PostgreSQLDatabase.dbIn
  }

  variant MongoDB {
    component MongoDatabase {
      port dbIn
    }

    connect CatalogService.dbOut -> MongoDatabase.dbIn
    connect CartService.dbOut -> MongoDatabase.dbIn
    connect OrderService.dbOut -> MongoDatabase.dbIn
  }
}

variationPoint DeploymentType alternative {

  variant DockerCompose {
    component DockerComposeDeployment {
      port deployIn
    }
  }

  variant CloudDeployment {
    component CloudDeploymentTarget {
      port deployIn
    }
  }
}

connect ApiGateway.catalogOut -> CatalogService.catalogIn
connect ApiGateway.cartOut -> CartService.cartIn
connect ApiGateway.orderOut -> OrderService.orderIn
connect OrderService.paymentOut -> PaymentService.paymentIn
connect OrderService.deliveryOut -> DeliveryService.deliveryIn
connect OrderService.notificationOut -> NotificationService.notificationIn

constraint MobileApp requires REST
constraint Microservices requires EventBus
constraint EventBus requires MessageBroker
constraint RecommendationEnabled requires CatalogService
constraint RecommendationEnabled requires EventBus
constraint EventBus requires CloudDeployment
constraint CloudDeployment requires Microservices
constraint MongoDB excludes RecommendationEnabled
constraint MongoDB excludes EventBus
constraint DockerCompose excludes CloudDeployment
constraint PostgreSQL excludes MongoDB
}`;

const sampleConfiguration = `configuration BasicShop {

select FrontendType = ReactWebApp
select BackendStyle = ModularMonolith
select PaymentType = StripeAdapter, PayPalAdapter
select DeliveryType = StandardDelivery, ExpressDelivery
select NotificationType = EmailNotification, SmsNotification, PushNotification
select CommunicationStyle = REST
select DatabaseType = PostgreSQL
select DeploymentType = DockerCompose

}`;

function configurationToText(configuration: Configuration): string {
  const lines: string[] = [`configuration ${configuration.name} {`, ""];

  for (const selection of configuration.selectedVariants) {
    lines.push(
      `select ${selection.variationPoint} = ${selection.variants.join(", ")}`
    );
  }

  if (configuration.flags.length > 0) {
    lines.push("");

    for (const flag of configuration.flags) {
      lines.push(`include ${flag}`);
    }
  }

  lines.push("}");

  return lines.join("\n");
}

function isComponent(element: ArchitecturalElement): element is Component {
  return element.kind === "component";
}

export default function App() {
  const [architectureText, setArchitectureText] = useState(sampleArchitecture);
  const [configText, setConfigText] = useState(sampleConfiguration);

  const [architecture, setArchitecture] = useState<Architecture | null>(null);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [flags, setFlags] = useState<string[]>([]);

  const [baseResult, setBaseResult] = useState("");
  const [baseProduct, setBaseProduct] = useState<ProductArchitecture | null>(null);
  const [baseErrors, setBaseErrors] = useState<string[]>([]);

  const [loadedProduct, setLoadedProduct] = useState<ProductArchitecture | null>(null);

  const [showGeneratedProducts, setShowGeneratedProducts] = useState(false);
  
  function deriveFromText(): void {
    setShowGeneratedProducts(false);
    setLoadedProduct(null);

    const parsedArchitecture = parseArchitecture(architectureText);
    const parsedConfiguration = parseConfiguration(configText);

    const parseErrors = [
      ...parsedArchitecture.errors,
      ...parsedConfiguration.errors,
    ];

    if (
      parseErrors.length > 0 ||
      !parsedArchitecture.result ||
      !parsedConfiguration.result
    ) {
      setArchitecture(null);
      setBaseProduct(null);
      setBaseErrors(parseErrors.length > 0 ? parseErrors : ["Erreur de parsing."]);
      setBaseResult(parseErrors.join("\n"));
      return;
    }

    setArchitecture(parsedArchitecture.result);

    const selectionState: Record<string, string[]> = {};
    for (const s of parsedConfiguration.result.selectedVariants) {
      selectionState[s.variationPoint] = s.variants;
    }

    setSelection(selectionState);
    setFlags(parsedConfiguration.result.flags);

    const derivation = deriveProductArchitecture(
      parsedArchitecture.result,
      parsedConfiguration.result
    );

    if (derivation.errors.length > 0 || !derivation.product) {
      setBaseProduct(null);
      setBaseErrors(derivation.errors);
      setBaseResult(derivation.errors.join("\n"));
      return;
    }

    setBaseErrors([]);
    setBaseProduct(derivation.product);
    setBaseResult(productToText(derivation.product));
  }

  const interactiveConfiguration = useMemo<Configuration | null>(() => {
    if (!architecture) return null;

    return {
      name: "InteractiveProduct",
      selectedVariants: Object.entries(selection).map(
        ([variationPoint, variants]) => ({
          variationPoint,
          variants,
        })
      ),
      flags,
    };
  }, [architecture, selection, flags]);

  const interactiveDerivation = useMemo(() => {
    if (!architecture || !interactiveConfiguration) return null;

    return deriveProductArchitecture(architecture, interactiveConfiguration);
  }, [architecture, interactiveConfiguration]);

  const displayedConfigText = useMemo(() => {
    if (loadedProduct) {
      return configText;
    }

    if (!interactiveConfiguration) return configText;
    return configurationToText(interactiveConfiguration);
  }, [loadedProduct, interactiveConfiguration, configText]);

  const displayedProduct = useMemo(() => {
    if (loadedProduct) return loadedProduct;

    if (!interactiveDerivation) return baseProduct;
    if (interactiveDerivation.errors.length > 0) return null;

    return interactiveDerivation.product ?? null;
  }, [loadedProduct, interactiveDerivation, baseProduct]);

  const displayedErrors = useMemo(() => {
    if (!interactiveDerivation) return baseErrors;
    return interactiveDerivation.errors;
  }, [interactiveDerivation, baseErrors]);

  const displayedResult = useMemo(() => {
    if (loadedProduct) return productToText(loadedProduct);

    if (!interactiveDerivation) return baseResult;

    if (interactiveDerivation.errors.length > 0 || !interactiveDerivation.product) {
      return interactiveDerivation.errors.join("\n");
    }

    return productToText(interactiveDerivation.product);
  }, [loadedProduct, interactiveDerivation, baseResult]);

  function onSelectOne(vp: string, variant: string) {
    setLoadedProduct(null);

    setSelection((prev) => ({
      ...prev,
      [vp]: variant ? [variant] : [],
    }));
  }

  function onToggleMany(vp: string, variant: string) {
    setLoadedProduct(null);

    setSelection((prev) => {
      const current = prev[vp] ?? [];
      const exists = current.includes(variant);

      return {
        ...prev,
        [vp]: exists
          ? current.filter((v) => v !== variant)
          : [...current, variant],
      };
    });
  }

  function toggleFlag(flag: string) {
    setLoadedProduct(null);

    setFlags((prev) =>
      prev.includes(flag)
        ? prev.filter((f) => f !== flag)
        : [...prev, flag]
    );
  }

  function loadGeneratedProduct(
    product: ProductArchitecture,
    configuration: Configuration
  ) {
    setLoadedProduct(product);

    const selectionState: Record<string, string[]> = {};
    configuration.selectedVariants.forEach((selection) => {
      selectionState[selection.variationPoint] = selection.variants;
    });

    setSelection(selectionState);
    setFlags(configuration.flags);
    setConfigText(configurationToText(configuration));
  }

  const optionalComponents = useMemo(() => {
    if (!architecture) return [];

    return architecture.elements
      .filter(isComponent)
      .filter((component) => !!component.optional)
      .map((component) => component.name);
  }, [architecture]);

  const activeComponents = useMemo(() => {
    return new Set(
      displayedProduct?.elements
        .filter(isComponent)
        .map((component) => component.name) ?? []
    );
  }, [displayedProduct]);

  useEffect(() => {
    deriveFromText();
  }, []);

  const workflowSteps = [
    "1. Feature Model",
    "2. Architecture SPL",
    "3. Configuration",
    "4. Validation / Solveur",
    "5. Architecture dérivée",
  ];

  const sectionStyle = {
    marginBottom: 24,
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>VarADL Studio</h1>

      <p>
        Prototype d&apos;ADL intégrant la variabilité architecturale et technologique des SPL.
        Le flux commence par le Feature Model fonctionnel, puis projette les choix vers
        l&apos;architecture VarADL, la configuration, la validation par solveur et l&apos;architecture dérivée.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 20,
          padding: 12,
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          borderRadius: 12,
        }}
      >
        {workflowSteps.map((step, index) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                padding: "8px 10px",
                background: "#ffffff",
                border: "1px solid #93c5fd",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                color: "#1d4ed8",
              }}
            >
              {step}
            </span>
            {index < workflowSteps.length - 1 && (
              <span style={{ color: "#2563eb", fontWeight: 700 }}>→</span>
            )}
          </div>
        ))}
      </div>

      {displayedErrors.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 8,
            color: "#991b1b",
          }}
        >
          <strong>Erreurs</strong>
          <ul>
            {displayedErrors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {architecture && (
        <>
          <section style={sectionStyle}>
            <h2>1. Feature Model fonctionnel</h2>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Cette vue représente la variabilité fonctionnelle du produit. Les choix
              technologiques restent décrits dans l&apos;architecture VarADL.
            </p>
            <FeatureModelGraph
              architecture={architecture}
              selection={selection}
            />
          </section>

          <details
            style={{
              ...sectionStyle,
              marginTop: -8,
              background: "#f8fafc",
            }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Modifier le modèle VarADL et la configuration textuelle
            </summary>

            <p style={{ color: "#64748b", marginTop: 12 }}>
              Ces éditeurs restent disponibles pour modifier directement la description
              VarADL et la configuration produit, tout en gardant l'interface principale
              centrée sur le workflow.
            </p>

            <button
              onClick={deriveFromText}
              style={{
                marginTop: 8,
                marginBottom: 16,
                padding: "10px 16px",
                cursor: "pointer",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
              }}
            >
              Appliquer les modifications textuelles
            </button>

            {displayedErrors.length === 0 && displayedProduct && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 10,
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  background: "#f0fdf4",
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                Modèle parsé, validé par le solveur SAT et architecture dérivée générée.
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <ArchitectureEditor
                value={architectureText}
                onChange={setArchitectureText}
              />

              <ConfigEditor
                value={displayedConfigText}
                onChange={setConfigText}
              />
            </div>
          </details>

          <section style={sectionStyle}>
            <h2>2. Architecture de référence SPL</h2>
            <p style={{ marginTop: 0, color: "#475569" }}>
              Cette vue montre les composants, points de variation, variants architecturaux
              et contraintes utilisés pour dériver les architectures produit.
            </p>
            <SPLGraphView
              architecture={architecture}
              selection={selection}
            />
          </section>

          <section style={sectionStyle}>
            <h2>3. Configuration produit</h2>
            <VariabilityPanel
              variationPoints={architecture.variationPoints}
              selection={selection}
              onSelectOne={onSelectOne}
              onToggleMany={onToggleMany}
            />

            {optionalComponents.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3>Options architecturales</h3>

                {optionalComponents.map((flag) => (
                  <label key={flag} style={{ display: "block", marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={flags.includes(flag)}
                      onChange={() => toggleFlag(flag)}
                    />{" "}
                    {flag}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2>4. Validation et résultat textuel</h2>
            <ResultViewer result={displayedResult} />

            {displayedProduct && (
              <ConstraintPanel
                architecture={architecture}
                activeComponents={activeComponents}
              />
            )}
          </section>

          {displayedProduct && (
            <section style={sectionStyle}>
              <h2>5. Architecture produit dérivée</h2>
              <GraphViewReactFlow
                productElements={displayedProduct.elements}
                architecture={architecture}
                product={displayedProduct}
              />
            </section>
          )}

          <section style={sectionStyle}>
            <h2>Espace de configuration</h2>
            <ConfigurationSpacePanel architecture={architecture} />

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setShowGeneratedProducts((prev) => !prev)}
                style={{ padding: "10px 16px", cursor: "pointer" }}
              >
                {showGeneratedProducts
                  ? "Masquer les architectures générées"
                  : "Afficher les architectures générées"}
              </button>

              {showGeneratedProducts && (
                <div style={{ marginTop: 12 }}>
                  <GeneratedProductsPanel
                    architecture={architecture}
                    onLoadProduct={loadGeneratedProduct}
                  />
                </div>
              )}
            </div>
          </section>
        </>
      )}

    </div>
  );
}