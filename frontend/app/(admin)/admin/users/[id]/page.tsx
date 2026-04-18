"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Package,
  Star,
  Shield,
  CheckCircle,
  GraduationCap,
} from "lucide-react";
import UserStatusBadge from "../../_components/user-status-badge";
import Toast from "@/components/ui/toast";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastActiveAt?: string;
  studentProfile?: {
    university: string;
    verificationStatus: string;
    graduationYear?: number;
  };
  buyerProfile?: {
    buyerRating?: number;
    totalOrdersCompleted: number;
    trustTier: string;
  };
  sellerProfile?: {
    sellerRating?: number;
    totalListingsCreated: number;
    totalOrdersCompleted: number;
  };
  buyerOrders: Array<{ id: string; status: string; finalPrice: number; createdAt: string }>;
  sellerOrders: Array<{ id: string; status: string; finalPrice: number; createdAt: string }>;
  filedDisputes: Array<{ id: string; status: string; description: string; openedAt: string }>;
  _count: { buyerOrders: number; sellerOrders: number; filedDisputes: number };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user,      setUser]      = useState<UserDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [acting,    setActing]    = useState(false);
  const [toast,     setToast]     = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proxy/admin/users/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        setUser(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleAction = async (action: "suspend" | "ban" | "reinstate") => {
    setActing(true);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Failed to ${action} user`);
      const updated = await res.json();
      setUser((prev) => prev ? { ...prev, status: updated.status } : prev);
      setToast({ message: `User successfully ${action}ed`, type: "success" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "An error occurred", type: "error" });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => router.push("/admin")} className="text-blue-600 hover:text-blue-700">
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const initials = user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </button>

        {/* Header card */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <UserStatusBadge status={user.status as any} />
                {user.isAdmin && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
                {user.emailVerified && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{user.email}</span>
                {user.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{user.phone}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {user.status === "active" && (
                <>
                  <button
                    onClick={() => handleAction("suspend")}
                    disabled={acting}
                    className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 disabled:opacity-50 transition-colors"
                  >
                    Suspend
                  </button>
                  <button
                    onClick={() => handleAction("ban")}
                    disabled={acting}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    Ban
                  </button>
                </>
              )}
              {(user.status === "suspended" || user.status === "banned") && (
                <button
                  onClick={() => handleAction("reinstate")}
                  disabled={acting}
                  className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
                >
                  Reinstate
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — stats & profiles */}
          <div className="space-y-6">
            {/* Activity counts */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Activity Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <ShoppingBag className="w-4 h-4 text-green-500" />
                    Purchases
                  </span>
                  <span className="font-semibold text-gray-900">{user._count.buyerOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="w-4 h-4 text-blue-500" />
                    Sales
                  </span>
                  <span className="font-semibold text-gray-900">{user._count.sellerOrders}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Disputes Filed
                  </span>
                  <span className="font-semibold text-gray-900">{user._count.filedDisputes}</span>
                </div>
              </div>
            </div>

            {/* Ratings */}
            {(user.buyerProfile || user.sellerProfile) && (
              <div className="bg-white rounded-lg shadow p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Ratings</h2>
                <div className="flex divide-x divide-gray-200">
                  <div className="flex-1 flex flex-col items-center gap-1 pr-4">
                    <span className="text-xs text-gray-500">Buyer</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-xl font-bold text-gray-900">
                        {user.buyerProfile?.buyerRating != null
                          ? Number(user.buyerProfile.buyerRating).toFixed(1)
                          : "0.0"}
                      </span>
                    </div>
                    {user.buyerProfile && (
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize mt-1">
                        {user.buyerProfile.trustTier}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 pl-4">
                    <span className="text-xs text-gray-500">Seller</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-xl font-bold text-gray-900">
                        {user.sellerProfile?.sellerRating != null
                          ? Number(user.sellerProfile.sellerRating).toFixed(1)
                          : "0.0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Student profile */}
            {user.studentProfile && (
              <div className="bg-white rounded-lg shadow p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Student Profile
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">University</span>
                    <span className="font-medium">{user.studentProfile.university}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Verification</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      user.studentProfile.verificationStatus === "verified"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {user.studentProfile.verificationStatus}
                    </span>
                  </div>
                  {user.studentProfile.graduationYear && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Graduation</span>
                      <span className="font-medium">{user.studentProfile.graduationYear}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right — recent orders + disputes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent purchases */}
            {user.buyerOrders.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">Recent Purchases</h2>
                  <span className="text-xs text-gray-400">{user._count.buyerOrders} total</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {user.buyerOrders.map((o) => (
                    <div key={o.id} className="px-6 py-3 flex items-center justify-between">
                      <Link href={`/admin/orders/${o.id}`} className="text-sm font-mono text-blue-600 hover:text-blue-800">
                        #{o.id.slice(0, 8)}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === "completed" ? "bg-green-100 text-green-700" :
                        o.status === "disputed"  ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{o.status}</span>
                      <span className="text-sm text-gray-700">{Number(o.finalPrice).toLocaleString()} ₫</span>
                      <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent sales */}
            {user.sellerOrders.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">Recent Sales</h2>
                  <span className="text-xs text-gray-400">{user._count.sellerOrders} total</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {user.sellerOrders.map((o) => (
                    <div key={o.id} className="px-6 py-3 flex items-center justify-between">
                      <Link href={`/admin/orders/${o.id}`} className="text-sm font-mono text-blue-600 hover:text-blue-800">
                        #{o.id.slice(0, 8)}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === "completed" ? "bg-green-100 text-green-700" :
                        o.status === "disputed"  ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{o.status}</span>
                      <span className="text-sm text-gray-700">{Number(o.finalPrice).toLocaleString()} ₫</span>
                      <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent disputes */}
            {user.filedDisputes.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    Filed Disputes
                  </h2>
                  <span className="text-xs text-gray-400">{user._count.filedDisputes} total</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {user.filedDisputes.map((d) => (
                    <div key={d.id} className="px-6 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/admin/disputes/${d.id}`} className="text-sm font-mono text-blue-600 hover:text-blue-800">
                          #{d.id.slice(0, 8)}
                        </Link>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.status === "resolved" ? "bg-green-100 text-green-700" :
                          d.status === "opened"   ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>{d.status}</span>
                        <span className="text-xs text-gray-400">{new Date(d.openedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">{d.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.buyerOrders.length === 0 && user.sellerOrders.length === 0 && user.filedDisputes.length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-400 text-sm">No activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
