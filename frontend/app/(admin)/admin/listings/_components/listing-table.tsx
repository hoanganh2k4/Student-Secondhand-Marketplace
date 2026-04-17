"use client";

import Link from "next/link";
import Image from "next/image";
import ListingStatusBadge, { ListingStatus } from "./listing-status-badge";
import ConditionBadge, { Condition } from "./condition-badge";
import ProofScore from "./proof-score";
import { MoreVertical, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";

export interface Listing {
  id: string;
  title: string;
  status: ListingStatus;
  condition: Condition;
  priceExpectation: string;
  location: string;
  proofCompletenessScore: number;
  imageCount: number;
  hasVision: boolean;
  expiresAt: string;
  createdAt: string;
  matchCount: number;
  thumbnailUrl?: string;
  category: {
    id: string;
    name: string;
  };
  seller: {
    id: string;
    name: string;
    email: string;
  };
}

interface ListingsTableProps {
  listings: Listing[];
  onRemoveListing: (listingId: string) => Promise<void>;
}

export default function ListingsTable({
  listings,
  onRemoveListing,
}: ListingsTableProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    listingId: string;
    listingTitle: string;
  } | null>(null);

  const handleRemove = (listingId: string, listingTitle: string) => {
    setConfirmDialog({ isOpen: true, listingId, listingTitle });
    setActionMenuOpen(null);
  };

  const confirmRemove = async () => {
    if (confirmDialog) {
      await onRemoveListing(confirmDialog.listingId);
      setConfirmDialog(null);
    }
  };

  const formatPrice = (price: string) => {
    return `${parseInt(price).toLocaleString()} ₫`;
  };

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Listing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seller
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Condition
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proof
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {listings.map((listing) => (
              <tr
                key={listing.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 relative">
                      {listing.thumbnailUrl ? (
                        <img
                          src={listing.thumbnailUrl}
                          alt={listing.title}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No img</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <Link
                        href={`/admin/listings/${listing.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 line-clamp-2"
                      >
                        {listing.title.length > 50
                          ? `${listing.title.substring(0, 50)}...`
                          : listing.title}
                      </Link>
                      <div className="text-xs text-gray-500 mt-1">
                        Matches: {listing.matchCount || 0}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {listing.seller.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {listing.seller.email}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                    {listing.category.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {formatPrice(listing.priceExpectation)}
                </td>
                <td className="px-6 py-4">
                  <ConditionBadge condition={listing.condition} />
                </td>
                <td className="px-6 py-4">
                  <ProofScore
                    score={listing.proofCompletenessScore}
                    imageCount={listing.imageCount}
                    hasVision={listing.hasVision}
                  />
                </td>
                <td className="px-6 py-4">
                  <ListingStatusBadge status={listing.status} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(listing.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActionMenuOpen(
                          actionMenuOpen === listing.id ? null : listing.id,
                        )
                      }
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {actionMenuOpen === listing.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActionMenuOpen(null)}
                        />
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1">
                            <Link
                              href={`/admin/listings/${listing.id}`}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Link>
                            {listing.status !== "removed" && (
                              <button
                                onClick={() =>
                                  handleRemove(listing.id, listing.title)
                                }
                                className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Listing
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmRemove}
          title="Remove Listing"
          message={`Are you sure you want to remove "${confirmDialog.listingTitle}"? This listing will be hidden from the platform.`}
          confirmText="Remove"
          type="danger"
        />
      )}
    </>
  );
}
