import { ReactNode } from "react";

type StatusBadgeProps = {
  variant:
    | "active"
    | "verified"
    | "pending"
    | "waiting"
    | "draft"
    | "inactive"
    | "matched"
    | "closed"
    | "expired"
    | "rejected"
    | "cancelled";
  children: ReactNode;
};

export function StatusBadge({ variant, children }: StatusBadgeProps) {
  const variants = {
    active: "bg-[#16A34A]/10 text-[#16A34A]",
    verified: "bg-[#16A34A]/10 text-[#16A34A]",
    pending: "bg-[#D97706]/10 text-[#D97706]",
    waiting: "bg-[#D97706]/10 text-[#D97706]",
    draft: "bg-[#D1D5DB] text-[#4B5563]",
    inactive: "bg-[#D1D5DB] text-[#4B5563]",
    matched: "bg-[#2563EB]/10 text-[#2563EB]",
    closed: "bg-[#F3F4F6] text-[#4B5563]",
    expired: "bg-[#F3F4F6] text-[#4B5563]",
    rejected: "bg-[#DC2626]/10 text-[#DC2626]",
    cancelled: "bg-[#DC2626]/10 text-[#DC2626]",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-normal ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
