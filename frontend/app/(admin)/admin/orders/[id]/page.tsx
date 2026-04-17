"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Package,
  Truck,
  User,
  Mail,
  MapPin,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Star,
  FileText,
  DollarSign,
  Clock,
  CreditCard,
} from "lucide-react";
import OrderStatusBadge from "../_components/order-status-badge";
import FulfillmentBadge from "../_components/fulfillment-badge";
import Toast from "@/components/ui/toast";

interface OrderDetail {
  id: string;
  status: string;
  finalPrice: number;
  quantity: number;
  fulfillmentMethod: string;
  meetupDetails?: string;
  cancellationReason?: string;
  buyerConfirmedComplete: boolean;
  sellerConfirmedComplete: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  hasDispute: boolean;
  reviewCount: number;
  listing: {
    id: string;
    title: string;
    priceExpectation?: string;
    condition?: string;
    location?: string;
  };
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  seller: {
    id: string;
    name: string;
    email: string;
  };
  match?: {
    id: string;
    matchScore: number;
    demandRequest: {
      id: string;
      title: string;
    };
    productListing: {
      id: string;
      title: string;
    };
  };
  offer: {
    proposedPrice: number;
    fulfillmentMethod: string;
  };
  dispute?: {
    id: string;
    description: string;
    filedByUserId: string;
    status: string;
    resolution?: string;
    createdAt: string;
    resolvedAt?: string;
  };
  ratingReviews: Array<{
    roleOfReviewer: "buyer" | "seller";
    rating: number;
    comment: string;
    createdAt: string;
  }>;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proxy/admin/orders/${orderId}`);
      if (!response.ok) throw new Error("Failed to fetch order details");

      const data = await response.json();
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} ₫`;
  };

  const getTimelineSteps = () => {
    const steps = [
      {
        key: "created",
        label: "Created",
        date: order?.createdAt,
        status: "completed",
      },
      {
        key: "confirmed",
        label: "Confirmed",
        date: order?.updatedAt,
        status: order?.status === "created" ? "pending" : "completed",
      },
      {
        key: "in_progress",
        label: "In Progress",
        date:
          order?.status === "in_progress" || order?.status === "completed"
            ? order?.updatedAt
            : undefined,
        status: order?.status === "created" ? "pending" : "completed",
      },
      {
        key: "completed",
        label: "Completed",
        date: order?.completedAt,
        status: order?.status === "completed" ? "completed" : "pending",
      },
    ];

    if (order?.status === "cancelled") {
      steps.push({
        key: "cancelled",
        label: "Cancelled",
        date: order?.updatedAt,
        status: "cancelled",
      });
    }
    if (order?.status === "disputed") {
      steps.push({
        key: "disputed",
        label: "Disputed",
        date: order?.updatedAt,
        status: "disputed",
      });
    }

    return steps;
  };

  const getTimelineIcon = (step: string, status: string) => {
    if (status === "completed")
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (status === "cancelled")
      return <XCircle className="w-6 h-6 text-red-500" />;
    if (status === "disputed")
      return <AlertCircle className="w-6 h-6 text-red-500" />;
    return <Clock className="w-6 h-6 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Order Not Found
          </h2>
          <p className="text-gray-500 mb-4">
            {error || "The order you are looking for does not exist."}
          </p>
          <button
            onClick={() => router.push("/admin/orders")}
            className="text-blue-600 hover:text-blue-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const timelineSteps = getTimelineSteps();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Order {order.id.slice(0, 8)}...
                  </h1>
                  <OrderStatusBadge status={order.status as any} />
                  {order.hasDispute && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Dispute Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                  {order.completedAt && (
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                      Completed:{" "}
                      {new Date(order.completedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {formatPrice(order.finalPrice)}
                </div>
                <div className="text-sm text-gray-500">
                  for {order.quantity} item(s)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Order Timeline
            </h2>
          </div>
          <div className="p-6">
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-8">
                {timelineSteps.map((step, index) => (
                  <div key={step.key} className="relative flex items-start">
                    <div className="relative z-10 bg-white rounded-full p-1">
                      {getTimelineIcon(step.key, step.status)}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          {step.label}
                        </h3>
                        {step.date && (
                          <span className="text-sm text-gray-500">
                            {new Date(step.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {step.key === "cancelled" && order.cancellationReason && (
                        <p className="mt-1 text-sm text-red-600">
                          Reason: {order.cancellationReason}
                        </p>
                      )}
                      {step.key === "disputed" && order.dispute && (
                        <p className="mt-1 text-sm text-red-600">
                          {order.dispute.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Order details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Order Details
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Package className="w-4 h-4 mr-1" />
                        Listing
                      </label>
                      <Link
                        href={`/admin/listings/${order.listing.id}`}
                        className="mt-1 text-blue-600 hover:text-blue-800 block"
                      >
                        {order.listing.title}
                      </Link>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <DollarSign className="w-4 h-4 mr-1" />
                        Proposed Price
                      </label>
                      <p className="mt-1 text-gray-900">
                        {formatPrice(order.offer.proposedPrice)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Truck className="w-4 h-4 mr-1" />
                        Fulfillment Method
                      </label>
                      <div className="mt-1">
                        <FulfillmentBadge
                          method={order.fulfillmentMethod as any}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <CreditCard className="w-4 h-4 mr-1" />
                        Final Amount
                      </label>
                      <p className="mt-1 text-xl font-bold text-blue-600">
                        {formatPrice(order.finalPrice)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirmation Status
                      </label>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {order.buyerConfirmedComplete ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm text-gray-700">
                            Buyer confirmed
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {order.sellerConfirmedComplete ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm text-gray-700">
                            Seller confirmed
                          </span>
                        </div>
                      </div>
                    </div>
                    {order.meetupDetails && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          Meetup Details
                        </label>
                        <p className="mt-1 text-sm text-gray-700">
                          {order.meetupDetails}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute Section */}
            {order.dispute && (
              <div className="bg-red-50 rounded-lg shadow border border-red-200">
                <div className="px-6 py-4 border-b border-red-200">
                  <h2 className="text-lg font-semibold text-red-900 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Dispute Information
                  </h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-red-800">
                        Filed By
                      </label>
                      <p className="mt-1 text-red-900">
                        {order.dispute.filedByUserId}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-red-800">
                        Description
                      </label>
                      <p className="mt-1 text-red-900">
                        {order.dispute.description}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-red-800">
                        Status
                      </label>
                      <p className="mt-1">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            order.dispute.status === "resolved"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {order.dispute.status}
                        </span>
                      </p>
                    </div>
                    {order.dispute.resolution && (
                      <div>
                        <label className="text-sm font-medium text-red-800">
                          Resolution
                        </label>
                        <p className="mt-1 text-red-900">
                          {order.dispute.resolution}
                        </p>
                      </div>
                    )}
                    {order.dispute.resolvedAt && (
                      <div>
                        <label className="text-sm font-medium text-red-800">
                          Resolved At
                        </label>
                        <p className="mt-1 text-red-900">
                          {new Date(
                            order.dispute.resolvedAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reviews Section */}
            {order.ratingReviews && order.ratingReviews.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Star className="w-5 h-5 mr-2" />
                    Reviews ({order.ratingReviews.length})
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  {order.ratingReviews.map((review, idx) => (
                    <div
                      key={idx}
                      className="border-b border-gray-100 last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {review.roleOfReviewer}
                          </span>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? "text-yellow-400 fill-current"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column - Parties involved */}
          <div className="space-y-6">
            {/* Buyer Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Buyer
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold">
                    {order.buyer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <Link
                      href={`/admin/users/${order.buyer.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {order.buyer.name}
                    </Link>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {order.buyer.email}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    href={`/admin/users/${order.buyer.id}`}
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View Buyer Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Seller Card */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Seller
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold">
                    {order.seller.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <Link
                      href={`/admin/users/${order.seller.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {order.seller.name}
                    </Link>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Mail className="w-3 h-3 mr-1" />
                      {order.seller.email}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    href={`/admin/users/${order.seller.id}`}
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    View Seller Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Match Info Card */}
            {order.match && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Match Information
                  </h2>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Match Score</label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            order.match.matchScore >= 70
                              ? "bg-green-500"
                              : order.match.matchScore >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${order.match.matchScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">
                        {order.match.matchScore}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Linked Demand
                    </label>
                    <Link
                      href={`/admin/demands/${order.match.demandRequest.id}`}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-800 block"
                    >
                      {order.match.demandRequest.title}
                    </Link>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Linked Listing
                    </label>
                    <Link
                      href={`/admin/listings/${order.match.productListing.id}`}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-800 block"
                    >
                      {order.match.productListing.title}
                    </Link>
                  </div>
                </div>
              </div>
            )}
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
