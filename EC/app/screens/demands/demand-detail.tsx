import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MoreVertical, AlertCircle } from "lucide-react";
import { StatusBadge } from "../../components/status-badge";
import { MatchScore } from "../../components/match-score";
import { TrustTierBadge } from "../../components/trust-tier-badge";
import { Button } from "../../components/ui/button";

export function DemandDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const demand = {
    id,
    category: "Textbooks",
    title: "Calculus: Early Transcendentals 8th Edition",
    description: "Looking for the 8th edition by James Stewart. Must be in good condition with minimal highlighting.",
    budget: "$40 - $60",
    condition: "Good",
    quantity: 1,
    location: "Main Campus",
    urgency: "Within a week",
    status: "matched",
    requirements: "Must include original box and charger",
  };

  const matches = [
    {
      id: "1",
      productTitle: "Calculus Textbook 8th Edition - Like New",
      sellerName: "Sarah Chen",
      trustTier: "trusted" as const,
      matchScore: 87,
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=200&fit=crop",
      price: "$55",
    },
    {
      id: "2",
      productTitle: "Calculus Early Transcendentals Stewart",
      sellerName: "Mike Johnson",
      trustTier: "established" as const,
      matchScore: 82,
      thumbnail: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=200&h=200&fit=crop",
      price: "$50",
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-6">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-[#111827]" />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-[#111827]">Demand Request</h1>
        <button>
          <MoreVertical className="w-6 h-6 text-[#4B5563]" />
        </button>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <StatusBadge variant="matched">Matched</StatusBadge>
          <span className="text-[13px] text-[#4B5563]">· {matches.length} matches found</span>
        </div>

        {/* Category & Title */}
        <div>
          <span className="inline-block px-2.5 py-1 rounded-md bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium mb-2">
            {demand.category}
          </span>
          <h2 className="text-[20px] font-semibold text-[#111827]">{demand.title}</h2>
          <p className="text-[15px] text-[#4B5563] mt-2">{demand.description}</p>
        </div>

        {/* Budget */}
        <div>
          <p className="text-[20px] font-semibold text-[#2563EB]">{demand.budget}</p>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4 bg-[#F3F4F6] rounded-xl p-4">
          <div>
            <p className="text-[12px] text-[#4B5563] mb-1">Condition</p>
            <p className="text-[14px] font-medium text-[#111827]">{demand.condition}</p>
          </div>
          <div>
            <p className="text-[12px] text-[#4B5563] mb-1">Quantity</p>
            <p className="text-[14px] font-medium text-[#111827]">{demand.quantity}</p>
          </div>
          <div>
            <p className="text-[12px] text-[#4B5563] mb-1">Location</p>
            <p className="text-[14px] font-medium text-[#111827]">{demand.location}</p>
          </div>
          <div>
            <p className="text-[12px] text-[#4B5563] mb-1">Urgency</p>
            <p className="text-[14px] font-medium text-[#111827]">{demand.urgency}</p>
          </div>
        </div>

        {/* Matches section */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#111827] mb-3">Your Matches</h3>
          {matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => navigate(`/matches/${match.id}`)}
                  className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-start gap-3 hover:border-[#2563EB] transition-colors"
                >
                  <img
                    src={match.thumbnail}
                    alt={match.productTitle}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 text-left">
                    <h4 className="text-[14px] font-medium text-[#111827] line-clamp-2 mb-1">
                      {match.productTitle}
                    </h4>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] text-[#4B5563]">{match.sellerName}</span>
                      <TrustTierBadge tier={match.trustTier} />
                    </div>
                    <MatchScore score={match.matchScore} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-[15px] font-bold text-[#2563EB]">{match.price}</p>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-3">
                      View
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
              <p className="text-[14px] text-[#D97706]">
                We're looking for matching listings. You'll be notified when we find one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
