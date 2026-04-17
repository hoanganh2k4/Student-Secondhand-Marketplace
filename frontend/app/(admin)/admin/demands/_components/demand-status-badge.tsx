export type DemandStatus =
  | "draft"
  | "active"
  | "waiting"
  | "matched"
  | "in_conversation"
  | "in_negotiation"
  | "fulfilled"
  | "expired"
  | "cancelled";

interface DemandStatusBadgeProps {
  status: DemandStatus;
}

const statusConfig = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800" },
  active: { label: "Active", color: "bg-blue-100 text-blue-800" },
  waiting: { label: "Waiting", color: "bg-yellow-100 text-yellow-800" },
  matched: { label: "Matched", color: "bg-purple-100 text-purple-800" },
  in_conversation: {
    label: "In Conversation",
    color: "bg-indigo-100 text-indigo-800",
  },
  in_negotiation: {
    label: "In Negotiation",
    color: "bg-orange-100 text-orange-800",
  },
  fulfilled: { label: "Fulfilled", color: "bg-green-100 text-green-800" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function DemandStatusBadge({ status }: DemandStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
