export type Condition = "poor" | "fair" | "good" | "very_good" | "like_new";

interface ConditionBadgeProps {
  condition: Condition;
}

const conditionConfig = {
  poor: { label: "Poor", color: "bg-red-100 text-red-800" },
  fair: { label: "Fair", color: "bg-orange-100 text-orange-800" },
  good: { label: "Good", color: "bg-yellow-100 text-yellow-800" },
  very_good: { label: "Very Good", color: "bg-blue-100 text-blue-800" },
  like_new: { label: "Like New", color: "bg-green-100 text-green-800" },
};

export default function ConditionBadge({ condition }: ConditionBadgeProps) {
  const config = conditionConfig[condition];
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.label}
    </span>
  );
}
