"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Target,
  Clock,
  AlertCircle,
  User,
  Mail,
  Building,
  Star,
  ShoppingBag,
  TrendingUp,
  FileText,
  Tag,
  Heart,
  CheckCircle,
  XCircle,
} from "lucide-react";
import DemandStatusBadge from "../_components/demand-status-badge";
import Toast from "@/components/ui/toast";

interface DemandDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  budgetMin: string;
  budgetMax: string;
  preferredCondition: string;
  specialRequirements?: string;
  location: string;
  urgency: string;
  quantityNeeded: number;
  fulfilledQuantity: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
  buyerProfile: {
    id: string;
    name: string;
    email: string;
    trustTier: string;
    totalOrdersCompleted: number;
    university?: string;
    avatar?: string;
  };
  matches: Array<{
    id: string;
    matchScore: number;
    matchConfidence: "high" | "medium" | "low";
    status: string;
    createdAt: string;
    productListing: {
      id: string;
      title: string;
      status: string;
      priceExpectation?: string;
      thumbnailUrl?: string;
    };
  }>;
}

const urgencyConfig = {
  within_week: {
    label: "Within a week",
    color: "bg-red-100 text-red-800",
    icon: Clock,
  },
  within_month: {
    label: "Within a month",
    color: "bg-yellow-100 text-yellow-800",
    icon: Calendar,
  },
  flexible: {
    label: "Flexible",
    color: "bg-green-100 text-green-800",
    icon: Clock,
  },
};

const confidenceConfig = {
  high: { label: "High", color: "bg-green-100 text-green-800" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  low: { label: "Low", color: "bg-red-100 text-red-800" },
};

export default function AdminDemandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const demandId = params.id as string;

  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchDemand = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proxy/admin/demands/${demandId}`);
      if (!response.ok) throw new Error("Failed to fetch demand details");

      const data = await response.json();
      setDemand(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemand();
  }, [demandId]);

  const formatBudget = (min: string, max: string) => {
    const minNum = parseInt(min);
    const maxNum = parseInt(max);

    if (minNum === 0 && maxNum === 0) return "Negotiable";
    if (minNum === 0) return `Up to ${maxNum.toLocaleString()} ₫`;
    if (maxNum === 0) return `From ${minNum.toLocaleString()} ₫`;
    return `${minNum.toLocaleString()} – ${maxNum.toLocaleString()} ₫`;
  };

  const getTrustTierColor = (tier: string) => {
    switch (tier) {
      case "established":
        return "bg-green-100 text-green-800";
      case "verified":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTrustTierIcon = (tier: string) => {
    switch (tier) {
      case "established":
        return <CheckCircle className="w-4 h-4" />;
      case "verified":
        return <Star className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 bg-green-50";
    if (score >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const isExpiringSoon = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry < 3 && daysUntilExpiry > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !demand) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Demand Not Found
          </h2>
          <p className="text-gray-500 mb-4">
            {error || "The demand you are looking for does not exist."}
          </p>
          <button
            onClick={() => router.push("/admin/demands")}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Demands
          </button>
        </div>
      </div>
    );
  }

  const UrgencyIcon =
    urgencyConfig[demand.urgency as keyof typeof urgencyConfig]?.icon || Clock;
  const isExpiring = isExpiringSoon(demand.expiresAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Demands
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {demand.title}
                  </h1>
                  <DemandStatusBadge status={demand.status as any} />
                  {demand.fulfilledQuantity > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      {demand.fulfilledQuantity}/{demand.quantityNeeded}{" "}
                      Fulfilled
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Created: {new Date(demand.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Updated: {new Date(demand.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <AlertCircle
                      className={`w-4 h-4 mr-1 ${isExpiring ? "text-red-500" : "text-gray-400"}`}
                    />
                    Expires: {new Date(demand.expiresAt).toLocaleDateString()}
                    {isExpiring && (
                      <span className="ml-2 text-xs text-red-600 font-medium">
                        (Expiring soon!)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Demand info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Description
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {demand.description}
                </p>
                {demand.specialRequirements && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-900 flex items-center mb-2">
                      <Star className="w-4 h-4 mr-1" />
                      Special Requirements
                    </p>
                    <p className="text-sm text-blue-800">
                      {demand.specialRequirements}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Demand Details
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Tag className="w-4 h-4 mr-1" />
                        Category
                      </label>
                      <p className="mt-1 text-gray-900">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                          {demand.category.name}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Target className="w-4 h-4 mr-1" />
                        Budget Range
                      </label>
                      <p className="mt-1 text-lg font-semibold text-blue-600">
                        {formatBudget(demand.budgetMin, demand.budgetMax)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Package className="w-4 h-4 mr-1" />
                        Quantity Needed
                      </label>
                      <p className="mt-1 text-gray-900">
                        {demand.quantityNeeded} item(s)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Heart className="w-4 h-4 mr-1" />
                        Preferred Condition
                      </label>
                      <p className="mt-1 text-gray-900 capitalize">
                        {demand.preferredCondition.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <UrgencyIcon className="w-4 h-4 mr-1" />
                        Urgency
                      </label>
                      <p className="mt-1">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${urgencyConfig[demand.urgency as keyof typeof urgencyConfig]?.color}`}
                        >
                          {urgencyConfig[
                            demand.urgency as keyof typeof urgencyConfig
                          ]?.label || demand.urgency}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        Location
                      </label>
                      <p className="mt-1 text-gray-900">{demand.location}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Matches Table */}
            {demand.matches && demand.matches.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Matches ({demand.matches.length})
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    AI-matched listings that match this demand
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Match Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Listing
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Confidence
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {demand.matches.map((match) => (
                        <tr
                          key={match.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-sm font-bold ${getMatchScoreColor(match.matchScore)} px-2 py-1 rounded`}
                              >
                                {match.matchScore}%
                              </span>
                              <div className="flex-1 max-w-32">
                                <div className="bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      match.matchScore >= 70
                                        ? "bg-green-500"
                                        : match.matchScore >= 50
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                    }`}
                                    style={{ width: `${match.matchScore}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/admin/listings/${match.productListing.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {match.productListing.title}
                            </Link>
                            {match.productListing.priceExpectation && (
                              <div className="text-xs text-gray-500 mt-1">
                                {parseInt(
                                  match.productListing.priceExpectation,
                                ).toLocaleString()}{" "}
                                ₫
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${confidenceConfig[match.matchConfidence]?.color}`}
                            >
                              {confidenceConfig[match.matchConfidence]?.label ||
                                match.matchConfidence}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              {match.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(match.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Matches State */}
            {(!demand.matches || demand.matches.length === 0) && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No Matches Yet
                </h3>
                <p className="text-sm text-gray-500">
                  This demand hasn't been matched with any listings yet.
                </p>
              </div>
            )}
          </div>

          {/* Right column - Buyer info */}
          <div className="space-y-6">
            {/* Buyer Profile Card */}
            <div className="bg-white rounded-lg shadow sticky top-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Buyer Information
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                    {demand.buyerProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-4 flex-1">
                    <Link
                      href={`/admin/users/${demand.buyerProfile.id}`}
                      className="text-base font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {demand.buyerProfile.name}
                    </Link>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {demand.buyerProfile.email}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  {demand.buyerProfile.university && (
                    <div className="flex items-start">
                      <Building className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">University</p>
                        <p className="text-sm text-gray-900">
                          {demand.buyerProfile.university}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start">
                    <div className="flex items-center gap-2">
                      {getTrustTierIcon(demand.buyerProfile.trustTier)}
                      <div>
                        <p className="text-xs text-gray-500">Trust Tier</p>
                        <p
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getTrustTierColor(demand.buyerProfile.trustTier)}`}
                        >
                          {demand.buyerProfile.trustTier
                            .charAt(0)
                            .toUpperCase() +
                            demand.buyerProfile.trustTier.slice(1)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <ShoppingBag className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Orders Completed</p>
                      <p className="text-sm text-gray-900">
                        {demand.buyerProfile.totalOrdersCompleted}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Target className="w-4 h-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">
                        Fulfillment Progress
                      </p>
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{
                                width: `${(demand.fulfilledQuantity / demand.quantityNeeded) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700">
                            {demand.fulfilledQuantity}/{demand.quantityNeeded}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    href={`/admin/users/${demand.buyerProfile.id}`}
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View Full Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Stats
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Match Rate</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {demand.matches?.length || 0} matches
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fulfillment</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.round(
                      (demand.fulfilledQuantity / demand.quantityNeeded) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status Age</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.floor(
                      (new Date().getTime() -
                        new Date(demand.createdAt).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}{" "}
                    days
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
