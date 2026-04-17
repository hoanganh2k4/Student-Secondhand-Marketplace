"use client";
import { Users, UserCheck, UserX, Ban } from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

interface MarketStatResponse {
  demands: {
    total: number;
    active: number;
    fulfilled: number;
    expiringSoon: number;
  };
  listings: {
    total: number;
    active: number;
    removed: number;
    lowProofScore: number;
  };
  orders: {
    total: number;
    completed: number;
    disputed: number;
    inProgress: number;
    totalVolume: number;
  };
  matches: {
    total: number;
    conversionRate: number;
  };
}

export default function MarketplaceStat() {
  const [marketStats, setMarketStats] = useState<MarketStatResponse | null>(
    null,
  );
  const fetchAllMarketStats = useCallback(async () => {
    try {
      const response = await fetch("/api/proxy/admin/stats"); // Get all users
      if (!response.ok) throw new Error("Failed to fetch market stats");

      const data = await response.json();
      setMarketStats(data);
    } catch (err) {
      console.error("Error fetching all users for stats:", err);
    }
  }, []);

  const demandCards = useMemo(
    () =>
      marketStats && marketStats.demands
        ? [
            {
              title: "Total Demands",
              value: marketStats.demands.total,
              icon: Users,
              color: "bg-blue-500",
              bgColor: "bg-blue-100",
              textColor: "text-blue-600",
            },
            {
              title: "Active",
              value: marketStats.demands.active,
              icon: UserCheck,
              color: "bg-green-500",
              bgColor: "bg-green-100",
              textColor: "text-green-600",
            },
            {
              title: "Fullfilled",
              value: marketStats.demands.fulfilled,
              icon: UserX,
              color: "bg-yellow-500",
              bgColor: "bg-yellow-100",
              textColor: "text-yellow-600",
            },
            {
              title: "Expiring Soon",
              value: marketStats.demands.expiringSoon,
              icon: Ban,
              color: "bg-red-500",
              bgColor: "bg-red-100",
              textColor: "text-red-600",
            },
          ]
        : [],
    [marketStats],
  );

  const listingCards = useMemo(
    () =>
      marketStats && marketStats.listings
        ? [
            {
              title: "Total Listings",
              value: marketStats.listings.total,
              icon: Users,
              color: "bg-blue-500",
              bgColor: "bg-blue-100",
              textColor: "text-blue-600",
            },
            {
              title: "Active",
              value: marketStats.listings.active,
              icon: UserCheck,
              color: "bg-green-500",
              bgColor: "bg-green-100",
              textColor: "text-green-600",
            },
            {
              title: "Removed",
              value: marketStats.listings.removed,
              icon: UserX,
              color: "bg-yellow-500",
              bgColor: "bg-yellow-100",
              textColor: "text-yellow-600",
            },
            {
              title: "Low Proof Score",
              value: marketStats.listings.lowProofScore,
              icon: Ban,
              color: "bg-red-500",
              bgColor: "bg-red-100",
              textColor: "text-red-600",
            },
          ]
        : [],
    [marketStats],
  );

  const orderCards = useMemo(
    () =>
      marketStats && marketStats.orders
        ? [
            {
              title: "Total Orders",
              value: marketStats.orders.total,
              icon: Users,
              color: "bg-blue-500",
              bgColor: "bg-blue-100",
              textColor: "text-blue-600",
            },
            {
              title: "Completed",
              value: marketStats.orders.completed,
              icon: UserCheck,
              color: "bg-green-500",
              bgColor: "bg-green-100",
              textColor: "text-green-600",
            },
            {
              title: "Disputed",
              value: marketStats.orders.disputed,
              icon: UserX,
              color: "bg-yellow-500",
              bgColor: "bg-yellow-100",
              textColor: "text-yellow-600",
            },
            {
              title: "In Progress",
              value: marketStats.orders.inProgress,
              icon: Ban,
              color: "bg-red-500",
              bgColor: "bg-red-100",
              textColor: "text-red-600",
            },
            {
              title: "Total Volume",
              value: marketStats.orders.totalVolume,
              icon: Ban,
              color: "bg-red-500",
              bgColor: "bg-red-100",
              textColor: "text-red-600",
            },
          ]
        : [],
    [marketStats],
  );

  const matchCards = useMemo(
    () =>
      marketStats && marketStats.matches
        ? [
            {
              title: "Total Matches",
              value: marketStats.matches.total,
              icon: Users,
              color: "bg-blue-500",
              bgColor: "bg-blue-100",
              textColor: "text-blue-600",
            },
            {
              title: "Conversion Rate",
              value: marketStats.matches.conversionRate,
              icon: UserCheck,
              color: "bg-green-500",
              bgColor: "bg-green-100",
              textColor: "text-green-600",
            },
          ]
        : [],
    [marketStats],
  );

  useEffect(() => {
    fetchAllMarketStats();
  }, [fetchAllMarketStats]);
  return (
    <>
      {/* Demand Card */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Demand Statistics</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {demandCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {card.title}
                </p>
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

      {/* Listing Card */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Listing Statistics</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {listingCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {card.title}
                </p>
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

      {/* Order Card */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Orders Statistics</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {orderCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {card.title}
                </p>
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

      {/* Matches Card */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Matches Statistics</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {matchCards.map((card) => (
          <div key={card.title} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {card.title}
                </p>
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
    </>
  );
}
