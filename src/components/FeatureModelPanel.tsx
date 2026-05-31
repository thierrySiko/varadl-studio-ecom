import type { Architecture } from "../model/varadl-types";

interface Props {
  architecture: Architecture;
  selection?: Record<string, string[]>;
}

function isSelected(selection: Record<string, string[]> | undefined, feature: string) {
  const selectedVariants = Object.values(selection ?? {}).flat();

  const mapping: Record<string, string[]> = {
    CreditCard: ["StripeAdapter"],
    PayPal: ["PayPalAdapter"],
    StandardDelivery: ["StandardDelivery"],
    ExpressDelivery: ["ExpressDelivery"],
    EmailNotification: ["EmailNotification"],
    SmsNotification: ["SmsNotification"],
    RecommendationService: ["RecommendationEnabled"],
  };

  const mapped = mapping[feature];
  if (!mapped) return false;
  return mapped.some((variant) => selectedVariants.includes(variant));
}

export default function FeatureModelPanel({
  architecture,
  selection,
}: Props) {
  const rootName = architecture.name.replace("SPL", "System");

  return (
    <div
      style={{
        marginBottom: 20,
        border: "1px solid #ddd",
        padding: 16,
        borderRadius: 8,
        background: "#ffffff",
      }}
    >
      <h2>Feature Model fonctionnel</h2>

      <p style={{ color: "#475569" }}>
        Cette vue décrit la variabilité fonctionnelle du produit. Les choix
        technologiques et architecturaux sont volontairement séparés et restent
        représentés dans le modèle VarADL.
      </p>

      <div style={{ fontWeight: 700, marginBottom: 10 }}>{rootName}</div>

      <ul>
        <li>
          <strong>ProductCatalog</strong> <span style={{ color: "#64748b" }}>(mandatory)</span>
        </li>
        <li>
          <strong>UserAccount</strong> <span style={{ color: "#64748b" }}>(mandatory)</span>
        </li>
        <li>
          <strong>ShoppingCart</strong> <span style={{ color: "#64748b" }}>(mandatory)</span>
        </li>
        <li>
          <strong>Checkout</strong> <span style={{ color: "#64748b" }}>(mandatory)</span>
        </li>
        <li>
          <strong>Payment</strong> <span style={{ color: "#64748b" }}>(alternative)</span>
          <ul>
            <li style={{ color: isSelected(selection, "CreditCard") ? "#166534" : undefined }}>
              CreditCard {isSelected(selection, "CreditCard") ? "✓" : ""}
            </li>
            <li style={{ color: isSelected(selection, "PayPal") ? "#166534" : undefined }}>
              PayPal {isSelected(selection, "PayPal") ? "✓" : ""}
            </li>
          </ul>
        </li>
        <li>
          <strong>Delivery</strong> <span style={{ color: "#64748b" }}>(alternative)</span>
          <ul>
            <li style={{ color: isSelected(selection, "StandardDelivery") ? "#166534" : undefined }}>
              StandardDelivery {isSelected(selection, "StandardDelivery") ? "✓" : ""}
            </li>
            <li style={{ color: isSelected(selection, "ExpressDelivery") ? "#166534" : undefined }}>
              ExpressDelivery {isSelected(selection, "ExpressDelivery") ? "✓" : ""}
            </li>
          </ul>
        </li>
        <li>
          <strong>Notification</strong> <span style={{ color: "#64748b" }}>(or)</span>
          <ul>
            <li style={{ color: isSelected(selection, "EmailNotification") ? "#166534" : undefined }}>
              EmailNotification {isSelected(selection, "EmailNotification") ? "✓" : ""}
            </li>
            <li style={{ color: isSelected(selection, "SmsNotification") ? "#166534" : undefined }}>
              SmsNotification {isSelected(selection, "SmsNotification") ? "✓" : ""}
            </li>
            <li>PushNotification</li>
          </ul>
        </li>
        <li>
          <strong>RecommendationService</strong> <span style={{ color: "#64748b" }}>(optional)</span>
        </li>
        <li>
          <strong>Reviews</strong> <span style={{ color: "#64748b" }}>(optional)</span>
        </li>
        <li>
          <strong>Wishlist</strong> <span style={{ color: "#64748b" }}>(optional)</span>
        </li>
        <li>
          <strong>Promotions</strong> <span style={{ color: "#64748b" }}>(optional)</span>
        </li>
      </ul>
    </div>
  );
}
