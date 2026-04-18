"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  User,
  Mail,
  Package,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import DisputeStatusBadge, { DisputeStatus } from "../_components/dispute-status-badge";
import Toast from "@/components/ui/toast";

interface DisputeDetail {
  id: string;
  disputeType?: string;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  resolutionNotes?: string;
  openedAt: string;
  resolvedAt?: string;
  assignedAdminId?: string;
  filedBy: { id: string; name: string; email: string };
  order: {
    id: string;
    finalPrice: number;
    status: string;
    buyer:   { id: string; name: string; email: string };
    seller:  { id: string; name: string; email: string };
    match: { productListing: { id: string; title: string } };
  };
}

const RESOLUTION_OPTIONS = [
  { value: "resolved_for_buyer",  label: "Resolved for Buyer" },
  { value: "resolved_for_seller", label: "Resolved for Seller" },
  { value: "mutual",              label: "Mutual Agreement" },
  { value: "dismissed",           label: "Dismissed" },
];

export default function AdminDisputeDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const disputeId = params.id as string;

  const [dispute,   setDispute]   = useState<DisputeDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [toast,     setToast]     = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Resolve form state
  const [resolving,      setResolving]      = useState(false);
  const [resolution,     setResolution]     = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proxy/admin/disputes/${disputeId}`);
        if (!res.ok) throw new Error("Failed to fetch dispute");
        setDispute(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [disputeId]);

  const handleResolve = async () => {
    if (!resolution) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/proxy/admin/disputes/${disputeId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, resolutionNotes: resolutionNotes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to resolve dispute");
      }
      const updated = await res.json();
      setDispute((prev) => prev ? { ...prev, ...updated, status: "resolved" } : prev);
      setResolving(false);
      setToast({ message: "Dispute resolved successfully", type: "success" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dispute Not Found</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => router.push("/admin/disputes")} className="text-blue-600 hover:text-blue-700">
            Back to Disputes
          </button>
        </div>
      </div>
    );
  }

  const isResolved = dispute.status === "resolved" || dispute.status === "closed";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Disputes
        </button>

        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Dispute #{dispute.id.slice(0, 8)}
                </h1>
                <DisputeStatusBadge status={dispute.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Opened: {new Date(dispute.openedAt).toLocaleDateString()}
                </span>
                {dispute.resolvedAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Resolved: {new Date(dispute.resolvedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {!isResolved && !resolving && (
              <button
                onClick={() => setResolving(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Resolve Dispute
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Dispute info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Dispute Details</h2>
              </div>
              <div className="p-6 space-y-4">
                {dispute.disputeType && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="mt-1 text-gray-900 capitalize">{dispute.disputeType.replace(/_/g, " ")}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-gray-900 whitespace-pre-wrap">{dispute.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Order</label>
                  <Link
                    href={`/admin/orders/${dispute.order.id}`}
                    className="mt-1 block text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Order #{dispute.order.id.slice(0, 8)} — {Number(dispute.order.finalPrice).toLocaleString()} ₫
                  </Link>
                </div>
                {dispute.order.match?.productListing && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Listing</label>
                    <Link
                      href={`/admin/listings/${dispute.order.match.productListing.id}`}
                      className="mt-1 block text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {dispute.order.match.productListing.title}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution info (if resolved) */}
            {isResolved && dispute.resolution && (
              <div className="bg-green-50 rounded-lg shadow border border-green-200">
                <div className="px-6 py-4 border-b border-green-200">
                  <h2 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Resolution
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-green-800">Decision</label>
                    <p className="mt-1 text-green-900 capitalize font-medium">
                      {dispute.resolution.replace(/_/g, " ")}
                    </p>
                  </div>
                  {dispute.resolutionNotes && (
                    <div>
                      <label className="text-sm font-medium text-green-800">Notes</label>
                      <p className="mt-1 text-green-900 whitespace-pre-wrap">{dispute.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resolve form */}
            {resolving && (
              <div className="bg-white rounded-lg shadow border border-blue-200">
                <div className="px-6 py-4 border-b border-blue-200">
                  <h2 className="text-lg font-semibold text-blue-900">Resolve Dispute</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Decision <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a resolution...</option>
                      {RESOLUTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resolution Notes <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Explain the decision..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">{resolutionNotes.length}/2000</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleResolve}
                      disabled={!resolution || submitting}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {submitting ? "Submitting..." : "Confirm Resolution"}
                    </button>
                    <button
                      onClick={() => setResolving(false)}
                      className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right — Parties */}
          <div className="space-y-6">
            {/* Filed By */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Filed By
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                    {dispute.filedBy.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/admin/users/${dispute.filedBy.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {dispute.filedBy.name}
                    </Link>
                    <div className="flex items-center text-xs text-gray-500 mt-0.5">
                      <Mail className="w-3 h-3 mr-1" />
                      {dispute.filedBy.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Buyer */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Buyer
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                    {dispute.order.buyer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/admin/users/${dispute.order.buyer.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {dispute.order.buyer.name}
                    </Link>
                    <div className="flex items-center text-xs text-gray-500 mt-0.5">
                      <Mail className="w-3 h-3 mr-1" />
                      {dispute.order.buyer.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Seller */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Seller
                </h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold text-sm">
                    {dispute.order.seller.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/admin/users/${dispute.order.seller.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {dispute.order.seller.name}
                    </Link>
                    <div className="flex items-center text-xs text-gray-500 mt-0.5">
                      <Mail className="w-3 h-3 mr-1" />
                      {dispute.order.seller.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
