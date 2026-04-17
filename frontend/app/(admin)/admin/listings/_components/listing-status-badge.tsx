export type ListingStatus =
  | "draft"
  | "active"
  | "matched"
  | "in_conversation"
  | "partially_sold"
  | "sold"
  | "expired"
  | "removed";

interface ListingStatusBadgeProps {
  status: ListingStatus;
}

const statusConfig = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800" },
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  matched: { label: "Matched", color: "bg-purple-100 text-purple-800" },
  in_conversation: {
    label: "In Conversation",
    color: "bg-indigo-100 text-indigo-800",
  },
  partially_sold: {
    label: "Partially Sold",
    color: "bg-yellow-100 text-yellow-800",
  },
  sold: { label: "Sold", color: "bg-blue-100 text-blue-800" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500" },
  removed: { label: "Removed", color: "bg-red-100 text-red-800" },
};

export default function ListingStatusBadge({
  status,
}: ListingStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
