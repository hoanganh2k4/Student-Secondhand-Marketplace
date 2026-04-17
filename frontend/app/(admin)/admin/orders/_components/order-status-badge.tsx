// frontend/components/admin/OrderStatusBadge.tsx
export type OrderStatus =
  | "created"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "disputed";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const statusConfig = {
  created: { label: "Created", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmed", color: "bg-indigo-100 text-indigo-800" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-800" },
};

export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
