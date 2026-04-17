import { Users, UserCheck, UserX, Ban } from "lucide-react";
import { User } from "./user-table";

interface UserStatsCardsProps {
  stats: User[];
}

export default function UserStatsCards({ stats }: UserStatsCardsProps) {
  const cards = [
    {
      title: "Total Users",
      value: stats.length,
      icon: Users,
      color: "bg-blue-500",
      bgColor: "bg-blue-100",
      textColor: "text-blue-600",
    },
    {
      title: "Active",
      value: stats.filter((u) => u.status == "active").length,
      icon: UserCheck,
      color: "bg-green-500",
      bgColor: "bg-green-100",
      textColor: "text-green-600",
    },
    {
      title: "Suspended",
      value: stats.filter((u) => u.status == "suspended").length,
      icon: UserX,
      color: "bg-yellow-500",
      bgColor: "bg-yellow-100",
      textColor: "text-yellow-600",
    },
    {
      title: "Banned",
      value: stats.filter((u) => u.status == "banned").length,
      icon: Ban,
      color: "bg-red-500",
      bgColor: "bg-red-100",
      textColor: "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {card.value}
              </p>
            </div>
            <div className={`${card.bgColor} p-3 rounded-full`}>
              <card.icon className={`w-6 h-6 ${card.textColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
