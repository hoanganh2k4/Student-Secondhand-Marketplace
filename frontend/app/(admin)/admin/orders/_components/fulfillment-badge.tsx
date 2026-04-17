// frontend/components/admin/FulfillmentBadge.tsx
import { Package, Truck, RefreshCw } from "lucide-react";

export type FulfillmentMethod = "pickup" | "delivery" | "f lexible";

interface FulfillmentBadgeProps {
  method: FulfillmentMethod;
}

const methodConfig = {
  pickup: {
    label: "Pickup",
    color: "bg-purple-100 text-purple-800",
    icon: Package,
  },
  delivery: {
    label: "Delivery",
    color: "bg-green-100 text-green-800",
    icon: Truck,
  },
  flexible: {
    label: "Flexible",
    color: "bg-orange-100 text-orange-800",
    icon: RefreshCw,
  },
};

export default function FulfillmentBadge({ method }: FulfillmentBadgeProps) {
  const config = methodConfig[method];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
