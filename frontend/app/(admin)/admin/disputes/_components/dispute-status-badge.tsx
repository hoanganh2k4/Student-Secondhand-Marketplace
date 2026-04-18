export type DisputeStatus = "opened" | "under_review" | "resolved" | "closed";

interface Props {
  status: DisputeStatus;
}

const config: Record<DisputeStatus, { label: string; color: string }> = {
  opened:       { label: "Opened",       color: "bg-red-100 text-red-800" },
  under_review: { label: "Under Review", color: "bg-yellow-100 text-yellow-800" },
  resolved:     { label: "Resolved",     color: "bg-green-100 text-green-800" },
  closed:       { label: "Closed",       color: "bg-gray-100 text-gray-800" },
};

export default function DisputeStatusBadge({ status }: Props) {
  const c = config[status] ?? { label: status, color: "bg-gray-100 text-gray-800" };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}
