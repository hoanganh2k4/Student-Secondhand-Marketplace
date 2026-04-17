export type UserStatus = "active" | "suspended" | "banned";

interface UserStatusBadgeProps {
  status: UserStatus;
}

const statusConfig = {
  active: { label: "Active", color: "bg-green-100 text-green-800" },
  suspended: { label: "Suspended", color: "bg-yellow-100 text-yellow-800" },
  banned: { label: "Banned", color: "bg-red-100 text-red-800" },
};

export default function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
