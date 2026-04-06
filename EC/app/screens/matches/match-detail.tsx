import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { MatchScore } from "../../components/match-score";

export function MatchDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const match = {
    score: 87,
    confidence: "High Match",
    buyerDemand: {
      category: "Textbooks",
      budget: "$40 - $60",
      condition: "Good",
      quantity: 1,
      location: "Main Campus",
    },
    sellerListing: {
      category: "Textbooks",
      price: "$55",
      condition: "Very Good",
      quantity: 1,
      location: "Main Campus",
    },
    dimensions: [
      { label: "Category", score: 100 },
      { label: "Price", score: 92 },
      { label: "Condition", score: 85 },
      { label: "Location", score: 100 },
      { label: "Quantity", score: 100 },
    ],
  };

  return (
    <div className="min-h-screen bg-white pb-6">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-[#111827]" />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-[#111827]">Match Found</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Match score hero */}
        <div className="bg-white border-2 border-[#16A34A] rounded-2xl p-6 text-center">
          <div className="text-[40px] font-bold text-[#16A34A] mb-2">{match.score}</div>
          <div className="text-[16px] font-semibold text-[#111827] mb-4">{match.confidence}</div>
          <div className="space-y-2">
            {match.dimensions.map((dim) => (
              <div key={dim.label} className="flex items-center gap-3">
                <span className="text-[13px] text-[#4B5563] w-20 text-left">{dim.label}</span>
                <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#16A34A] rounded-full"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <span className="text-[13px] font-medium text-[#111827] w-10 text-right">
                  {dim.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Side by side comparison */}
        <div>
          <h3 className="text-[16px] font-semibold text-[#111827] mb-3">Comparison</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F3F4F6] rounded-xl p-4">
              <h4 className="text-[13px] font-medium text-[#4B5563] mb-3">Buyer's Demand</h4>
              <div className="space-y-2 text-[13px]">
                <div>
                  <p className="text-[#4B5563]">Budget</p>
                  <p className="font-medium text-[#111827]">{match.buyerDemand.budget}</p>
                </div>
                <div>
                  <p className="text-[#4B5563]">Condition</p>
                  <p className="font-medium text-[#111827]">{match.buyerDemand.condition}</p>
                </div>
                <div>
                  <p className="text-[#4B5563]">Location</p>
                  <p className="font-medium text-[#111827]">{match.buyerDemand.location}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#EFF6FF] rounded-xl p-4">
              <h4 className="text-[13px] font-medium text-[#2563EB] mb-3">Seller's Listing</h4>
              <div className="space-y-2 text-[13px]">
                <div>
                  <p className="text-[#4B5563]">Price</p>
                  <p className="font-medium text-[#111827]">{match.sellerListing.price}</p>
                </div>
                <div>
                  <p className="text-[#4B5563]">Condition</p>
                  <p className="font-medium text-[#111827]">{match.sellerListing.condition}</p>
                </div>
                <div>
                  <p className="text-[#4B5563]">Location</p>
                  <p className="font-medium text-[#111827]">{match.sellerListing.location}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="ghost"
            className="flex-1 h-11 text-[#DC2626] hover:text-[#DC2626] hover:bg-[#DC2626]/10"
          >
            Not interested
          </Button>
          <Button
            onClick={() => navigate(`/conversations/${id}`)}
            className="flex-1 h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg"
          >
            Start Conversation
          </Button>
        </div>
      </div>
    </div>
  );
}
