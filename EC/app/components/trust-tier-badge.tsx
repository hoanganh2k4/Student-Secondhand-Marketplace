import { Shield, Check } from "lucide-react";

type TrustTierBadgeProps = {
  tier: "new" | "established" | "trusted";
};

export function TrustTierBadge({ tier }: TrustTierBadgeProps) {
  if (tier === "new") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D1D5DB] text-[#4B5563] text-[11px] font-normal">
        New
      </span>
    );
  }

  if (tier === "established") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2563EB]/10 text-[#2563EB] text-[11px] font-normal">
        <Shield className="w-3 h-3" />
        Established
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#16A34A]/10 text-[#16A34A] text-[11px] font-normal">
      <Check className="w-3 h-3" />
      Trusted
    </span>
  );
}
