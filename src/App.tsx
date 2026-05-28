import { useMemo, useState } from "react";
import ArchitectureEditor from "./components/ArchitectureEditor";
import ConfigEditor from "./components/ConfigEditor";
import ResultViewer from "./components/ResultViewer";
import VariabilityPanel from "./components/VariabilityPanel";
import ConstraintPanel from "./components/ConstraintPanel";
import ConfigurationSpacePanel from "./components/ConfigurationSpacePanel";
import GeneratedProductsPanel from "./components/GeneratedProductsPanel";
import GraphViewReactFlow from "./components/GraphViewReactFlow";
import FeatureModelPanel from "./components/FeatureModelPanel";
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

variationPoint PaymentType alternative {

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

variationPoint DeliveryType alternative {

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

variationPoint NotificationType alternative {

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
constraint MongoDB excludes RecommendationEnabled
}`;

const sampleConfiguration = `configuration BasicShop {

select FrontendType = ReactWebApp
select BackendStyle = ModularMonolith
select PaymentType = StripeAdapter
select DeliveryType = StandardDelivery
select NotificationType = EmailNotification
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

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1>VarADL Studio</h1>

      <p>
        Prototype d&apos;ADL intégrant la variabilité architecturale et technologique des SPL.
        Exemple courant : ligne de produits e-commerce avec frontend, backend, paiement,
        livraison, notifications, communication, persistance et déploiement configurables.
      </p>

      <ArchitectureEditor
        value={architectureText}
        onChange={setArchitectureText}
      />

      <ConfigEditor
        value={displayedConfigText}
        onChange={setConfigText}
      />

      <button
        onClick={deriveFromText}
        style={{
          marginBottom: 20,
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        Charger architecture et configuration
      </button>

      {architecture && (
        <>
          <VariabilityPanel
            variationPoints={architecture.variationPoints}
            selection={selection}
            onSelectOne={onSelectOne}
            onToggleMany={onToggleMany}
          />

          {optionalComponents.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h2>Options</h2>

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

          <FeatureModelPanel
            architecture={architecture}
            selection={selection}
          />

          <FeatureModelGraph
            architecture={architecture}
            selection={selection}
          />

          <SPLGraphView
            architecture={architecture}
            selection={selection}
          />

          
        </>
      )}

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

      <ResultViewer result={displayedResult} />

      {architecture && displayedProduct && (
        <ConstraintPanel
          architecture={architecture}
          activeComponents={activeComponents}
        />
      )}

      {architecture && displayedProduct && (
        <div style={{ marginBottom: 20 }}>
          <h2>Architecture produit dérivée</h2>
          <GraphViewReactFlow
            productElements={displayedProduct.elements}
            architecture={architecture}
          />
        </div>
      )}

      {architecture && <ConfigurationSpacePanel architecture={architecture} />}

      {architecture && (
        <div style={{ marginBottom: 20 }}>
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
      )}

    </div>
  );
}