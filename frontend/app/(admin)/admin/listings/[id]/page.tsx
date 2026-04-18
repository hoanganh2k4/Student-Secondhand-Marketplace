"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Package,
  Calendar,
  Star,
  TrendingUp,
  Image as ImageIcon,
  FileText,
  Tag,
  User,
  Mail,
  Phone,
  AlertCircle,
  Trash2,
} from "lucide-react";
import ListingStatusBadge from "../_components/listing-status-badge";
import ConditionBadge from "../_components/condition-badge";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import Toast from "@/components/ui/toast";

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  condition: string;
  conditionNotes?: string;
  priceExpectation: string;
  priceFlexible: boolean;
  location: string;
  quantityAvailable: number;
  quantityRemaining: number;
  proofCompletenessScore: number;
  imageCount: number;
  hasVision: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
  };
  sellerProfile: {
    id: string;
    userId: string;
    name: string;
    email: string;
    sellerRating: number;
    buyerRating: number | null;
    totalOrdersCompleted: number;
    trustTier: string;
  };
  proofAssets: Array<{
    id: string;
    fileUrl: string;
    aiAttributes?: {
      attributes: {
        detailed_caption?: string;
        ocr?: string;
        object_detection?: string;
      };
    };
  }>;
  matches: Array<{
    id: string;
    matchScore: number;
    status: string;
    createdAt: string;
    demandRequest: {
      id: string;
      title: string;
    };
  }>;
}

export default function AdminListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchListing = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proxy/admin/listings/${listingId}`);
      if (!response.ok) throw new Error("Failed to fetch listing details");

      const data = await response.json();
      setListing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListing();
  }, [listingId]);

  const handleRemoveListing = async () => {
    try {
      const response = await fetch(
        `/api/proxy/admin/listings/${listingId}/remove`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) throw new Error("Failed to remove listing");

      setToast({
        message: "Listing successfully removed",
        type: "success",
      });

      // Refresh listing data
      await fetchListing();
      setShowRemoveDialog(false);
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to remove listing",
        type: "error",
      });
    }
  };

  const formatPrice = (price: string) => {
    return `${parseInt(price).toLocaleString()} ₫`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Listing Not Found
          </h2>
          <p className="text-gray-500 mb-4">
            {error || "The listing you are looking for does not exist."}
          </p>
          <button
            onClick={() => router.push("/admin/listings")}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Listings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Listings
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {listing.title}
                  </h1>
                  <ListingStatusBadge status={listing.status as any} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Created: {new Date(listing.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Package className="w-4 h-4 mr-1" />
                    Quantity: {listing.quantityRemaining} /{" "}
                    {listing.quantityAvailable}
                  </div>
                  {listing.expiresAt && (
                    <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Expires:{" "}
                      {new Date(listing.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              {listing.status !== "removed" && (
                <button
                  onClick={() => setShowRemoveDialog(true)}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove Listing
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Listing info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Images Gallery */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Images & AI Analysis
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listing.proofAssets.map((asset) => (
                    <div key={asset.id} className="space-y-2">
                      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={asset.fileUrl}
                          alt="Listing image"
                          className="object-cover"
                        />
                      </div>
                      {asset.aiAttributes && (
                        <div className="text-sm space-y-1">
                          {asset.aiAttributes.attributes.detailed_caption && (
                            <p className="text-gray-600">
                              <span className="font-medium">Caption:</span>{" "}
                              {asset.aiAttributes.attributes.detailed_caption}
                            </p>
                          )}
                          {asset.aiAttributes.attributes.ocr && (
                            <p className="text-gray-600">
                              <span className="font-medium">OCR:</span>{" "}
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                                {asset.aiAttributes.attributes.ocr}
                              </span>
                            </p>
                          )}
                          {asset.aiAttributes.attributes.object_detection && (
                            <p className="text-gray-600">
                              <span className="font-medium">Objects:</span>{" "}
                              {asset.aiAttributes.attributes.object_detection}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {listing.proofAssets.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    No images available
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Description
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {listing.description}
                </p>
                {listing.conditionNotes && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                      Condition Notes:
                    </p>
                    <p className="text-sm text-yellow-700">
                      {listing.conditionNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Matches Table */}
            {listing.matches && listing.matches.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Matches ({listing.matches.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Match Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Demand
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
                      {listing.matches.map((match) => (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">
                                {match.matchScore}%
                              </span>
                              <div className="ml-2 flex-1 max-w-24">
                                <div className="bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
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
                              href={`/admin/demands/${match.demandRequest.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              {match.demandRequest.title}
                            </Link>
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
          </div>

          {/* Right column - Seller & Details */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Tag className="w-5 h-5 mr-2" />
                  Pricing
                </h2>
              </div>
              <div className="p-6">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {formatPrice(listing.priceExpectation)}
                </div>
                <div className="text-sm text-gray-600">
                  {listing.priceFlexible
                    ? "Price is negotiable"
                    : "Fixed price"}
                </div>
              </div>
            </div>

            {/* Seller Info Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Seller Information
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {listing.sellerProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <Link
                      href={`/admin/users/${listing.sellerProfile.userId}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {listing.sellerProfile.name}
                    </Link>
                    <div className="text-sm text-gray-500">
                      {listing.sellerProfile.email}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Seller Rating</span>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm font-medium">
                        {listing.sellerProfile.sellerRating || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Buyer Rating</span>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm font-medium">
                        {listing.sellerProfile.buyerRating ?? 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Orders Completed
                    </span>
                    <span className="text-sm font-medium">
                      {listing.sellerProfile.totalOrdersCompleted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Trust Tier</span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getTrustTierColor(listing.sellerProfile.trustTier)}`}
                    >
                      {listing.sellerProfile.trustTier}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href={`/admin/users/${listing.sellerProfile.userId}`}
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View Full Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Details</h2>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Category
                  </label>
                  <p className="mt-1 text-gray-900">{listing.category.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Condition
                  </label>
                  <div className="mt-1">
                    <ConditionBadge condition={listing.condition as any} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Location
                  </label>
                  <p className="mt-1 text-gray-900 flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                    {listing.location}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Proof Completeness
                  </label>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            listing.proofCompletenessScore >= 80
                              ? "bg-green-500"
                              : listing.proofCompletenessScore >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${listing.proofCompletenessScore}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {listing.proofCompletenessScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Dialog */}
      <ConfirmDialog
        isOpen={showRemoveDialog}
        onClose={() => setShowRemoveDialog(false)}
        onConfirm={handleRemoveListing}
        title="Remove Listing"
        message={`Are you sure you want to remove "${listing.title}"? This listing will be hidden from the platform and cannot be undone.`}
        confirmText="Remove"
        type="danger"
      />

      {/* Toast */}
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
