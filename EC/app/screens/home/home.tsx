import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Bell, ChevronRight, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/status-badge";
import { MatchScore } from "../../components/match-score";

export function Home() {
  const navigate = useNavigate();
  
  // Check if user is authenticated
  useEffect(() => {
    const userData = localStorage.getItem("userData");
    if (!userData) {
      navigate("/auth/login");
    }
  }, [navigate]);
  
  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem("userData") || '{"name":"Student"}');
  const firstName = userData.name?.split(" ")[0] || "Student";

  // Mock data
  const activeDemands = [
    {
      id: "1",
      category: "Textbooks",
      title: "Calculus: Early Transcendentals 8th Ed",
      budget: "$40 - $60",
      status: "matched",
      matchCount: 3,
    },
    {
      id: "2",
      category: "Electronics",
      title: "USB-C Hub with HDMI",
      budget: "$20 - $35",
      status: "pending",
      matchCount: 0,
    },
  ];

  const recentMatches = [
    {
      id: "1",
      productTitle: "Calculus Textbook 8th Edition",
      demandTitle: "Calculus: Early Transcendentals",
      matchScore: 87,
      thumbnail: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=200&fit=crop",
      timestamp: "2h ago",
    },
    {
      id: "2",
      productTitle: "MacBook Air M1 2020",
      demandTitle: "MacBook for coding",
      matchScore: 92,
      thumbnail: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200&h=200&fit=crop",
      timestamp: "5h ago",
    },
  ];

  const activeListings = [
    {
      id: "1",
      category: "Electronics",
      title: "iPhone 13 128GB Blue",
      price: "$450",
      status: "active",
    },
  ];

  const greetingTime = new Date().getHours();
  const greeting =
    greetingTime < 12 ? "Good morning" : greetingTime < 18 ? "Good afternoon" : "Good evening";

  const hasActivity = activeDemands.length > 0 || recentMatches.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center">
          <span className="text-white text-sm font-bold">U</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5 text-[#4B5563]" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#DC2626] rounded-full" />
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-medium"
          >
            {firstName[0]}
          </button>
        </div>
      </div>

      {hasActivity ? (
        <div className="px-4 py-6 space-y-8">
          {/* Hero greeting */}
          <div>
            <h1 className="text-[20px] font-semibold text-[#111827] mb-1">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-[15px] text-[#4B5563]">
              You have {recentMatches.length} new matches and 1 pending evidence request.
            </p>
          </div>

          {/* Your Active Demands */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-semibold text-[#111827]">Your Active Demands</h2>
              <button
                onClick={() => navigate("/demands")}
                className="text-[#2563EB] text-[13px] font-medium"
              >
                See all
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {activeDemands.map((demand) => (
                <button
                  key={demand.id}
                  onClick={() => navigate(`/demands/${demand.id}`)}
                  className="flex-shrink-0 w-[220px] h-[120px] bg-white border border-[#D1D5DB] rounded-xl p-3 text-left hover:border-[#2563EB] transition-colors"
                >
                  <div className="flex flex-col h-full">
                    <span className="inline-block px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium mb-2 w-fit">
                      {demand.category}
                    </span>
                    <h3 className="text-[14px] font-semibold text-[#111827] line-clamp-2 mb-auto">
                      {demand.title}
                    </h3>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <p className="text-[12px] text-[#4B5563] mb-1">{demand.budget}</p>
                        <StatusBadge variant={demand.status as any}>
                          {demand.status === "matched" ? "Matched" : "Searching"}
                        </StatusBadge>
                      </div>
                      {demand.matchCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-[#2563EB] text-white text-[11px] font-medium">
                          {demand.matchCount} matches
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => navigate("/demands/new")}
                className="flex-shrink-0 w-[220px] h-[120px] border-2 border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 transition-colors"
              >
                <Plus className="w-6 h-6 text-[#2563EB]" />
                <span className="text-[13px] font-medium text-[#2563EB]">Post a Demand</span>
              </button>
            </div>
          </div>

          {/* Recent Matches */}
          {recentMatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[16px] font-semibold text-[#111827]">Recent Matches</h2>
                <button className="text-[#2563EB] text-[13px] font-medium">See all</button>
              </div>
              <div className="space-y-2">
                {recentMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => navigate(`/matches/${match.id}`)}
                    className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-center gap-3 hover:border-[#2563EB] transition-colors"
                  >
                    <img
                      src={match.thumbnail}
                      alt={match.productTitle}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left">
                      <h3 className="text-[14px] font-medium text-[#111827] line-clamp-1">
                        {match.productTitle}
                      </h3>
                      <p className="text-[13px] text-[#4B5563] line-clamp-1">
                        {match.demandTitle}
                      </p>
                      <MatchScore score={match.matchScore} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ChevronRight className="w-5 h-5 text-[#4B5563]" />
                      <span className="text-[11px] text-[#4B5563]">{match.timestamp}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Your Listings */}
          {activeListings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[16px] font-semibold text-[#111827]">Your Listings</h2>
                <button
                  onClick={() => navigate("/listings")}
                  className="text-[#2563EB] text-[13px] font-medium"
                >
                  See all
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {activeListings.map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => navigate(`/listings/${listing.id}`)}
                    className="flex-shrink-0 w-[220px] h-[120px] bg-white border border-[#D1D5DB] rounded-xl p-3 text-left hover:border-[#2563EB] transition-colors"
                  >
                    <div className="flex flex-col h-full">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium mb-2 w-fit">
                        {listing.category}
                      </span>
                      <h3 className="text-[14px] font-semibold text-[#111827] line-clamp-2 mb-auto">
                        {listing.title}
                      </h3>
                      <div className="flex items-end justify-between mt-2">
                        <div>
                          <p className="text-[15px] font-bold text-[#2563EB] mb-1">
                            {listing.price}
                          </p>
                          <StatusBadge variant={listing.status as any}>Active</StatusBadge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => navigate("/listings/new")}
                  className="flex-shrink-0 w-[220px] h-[120px] border-2 border-dashed border-[#D1D5DB] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 transition-colors"
                >
                  <Plus className="w-6 h-6 text-[#2563EB]" />
                  <span className="text-[13px] font-medium text-[#2563EB]">Create a Listing</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Empty state
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="w-32 h-32 mb-6 flex items-center justify-center">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full text-[#D1D5DB]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="70" cy="100" r="30" />
              <circle cx="130" cy="100" r="30" />
              <path d="M70 100 L130 100" />
              <path d="M50 120 L70 140" />
              <path d="M150 120 L130 140" />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold text-[#111827] mb-2">Nothing here yet</h2>
          <p className="text-[15px] text-[#4B5563] mb-8 max-w-sm">
            Post what you're looking for, or list something to sell.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/demands/new")}
              className="h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg px-6"
            >
              Post a Demand
            </Button>
            <Button
              onClick={() => navigate("/listings/new")}
              variant="outline"
              className="h-11 border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg px-6"
            >
              Create a Listing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}