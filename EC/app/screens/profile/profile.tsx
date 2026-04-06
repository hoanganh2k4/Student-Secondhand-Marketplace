import { useNavigate } from "react-router";
import { Settings, Star, Package, Search, MessageSquare } from "lucide-react";
import { TrustTierBadge } from "../../components/trust-tier-badge";
import { StatusBadge } from "../../components/status-badge";

export function Profile() {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData") || '{"name":"Student User"}');
  const firstName = userData.name?.split(" ")[0] || "Student";

  const stats = [
    { label: "Orders Completed", value: 12 },
    { label: "Listings Active", value: 3 },
    { label: "Demands Active", value: 2 },
  ];

  const listings = [
    {
      id: "1",
      title: "iPhone 13 128GB Blue",
      price: "$450",
      status: "active",
    },
  ];

  const demands = [
    {
      id: "1",
      title: "Calculus Textbook 8th Ed",
      budget: "$40 - $60",
      status: "matched",
    },
  ];

  const reviews = [
    {
      id: "1",
      reviewer: "Sarah Chen",
      rating: 5,
      comment: "Great buyer, smooth transaction!",
      itemName: "Calculus Textbook",
      date: "2 weeks ago",
    },
    {
      id: "2",
      reviewer: "Mike Johnson",
      rating: 5,
      comment: "Very responsive and friendly.",
      itemName: "USB-C Hub",
      date: "1 month ago",
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-6">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-[20px] font-semibold text-[#111827]">Profile</h1>
        <button onClick={() => alert("Settings coming soon")}>
          <Settings className="w-5 h-5 text-[#4B5563]" />
        </button>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Profile header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-2xl font-bold">
            {firstName[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-[20px] font-semibold text-[#111827] mb-1">{userData.name}</h2>
            <p className="text-[13px] text-[#4B5563] mb-2">
              University Student · Class of {userData.graduationYear || "2026"}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <TrustTierBadge tier="established" />
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#D97706] text-[#D97706]" />
                <span className="text-[14px] font-medium text-[#111827]">4.8</span>
                <span className="text-[13px] text-[#4B5563]">· 12 reviews</span>
              </div>
            </div>
            <button className="text-[#2563EB] text-[13px] font-medium">Edit Profile</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#F3F4F6] rounded-xl p-4 text-center">
              <p className="text-[24px] font-bold text-[#111827] mb-1">{stat.value}</p>
              <p className="text-[11px] text-[#4B5563]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* My Listings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-semibold text-[#111827]">My Listings</h3>
            <button
              onClick={() => navigate("/listings")}
              className="text-[#2563EB] text-[13px] font-medium"
            >
              See All
            </button>
          </div>
          <div className="space-y-2">
            {listings.map((listing) => (
              <button
                key={listing.id}
                onClick={() => navigate(`/listings/${listing.id}`)}
                className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-center gap-3 hover:border-[#2563EB] transition-colors"
              >
                <Package className="w-10 h-10 text-[#4B5563]" />
                <div className="flex-1 text-left">
                  <h4 className="text-[14px] font-medium text-[#111827]">{listing.title}</h4>
                  <p className="text-[15px] font-bold text-[#2563EB]">{listing.price}</p>
                </div>
                <StatusBadge variant="active">Active</StatusBadge>
              </button>
            ))}
          </div>
        </div>

        {/* My Demands */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-semibold text-[#111827]">My Demands</h3>
            <button
              onClick={() => navigate("/demands")}
              className="text-[#2563EB] text-[13px] font-medium"
            >
              See All
            </button>
          </div>
          <div className="space-y-2">
            {demands.map((demand) => (
              <button
                key={demand.id}
                onClick={() => navigate(`/demands/${demand.id}`)}
                className="w-full bg-white border border-[#D1D5DB] rounded-xl p-3 flex items-center gap-3 hover:border-[#2563EB] transition-colors"
              >
                <Search className="w-10 h-10 text-[#4B5563]" />
                <div className="flex-1 text-left">
                  <h4 className="text-[14px] font-medium text-[#111827]">{demand.title}</h4>
                  <p className="text-[13px] text-[#4B5563]">{demand.budget}</p>
                </div>
                <StatusBadge variant="matched">Matched</StatusBadge>
              </button>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[16px] font-semibold text-[#111827]">Reviews Received</h3>
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-[#F3F4F6] rounded-xl p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-medium">
                    {review.reviewer[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#111827]">{review.reviewer}</p>
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706]" />
                      ))}
                    </div>
                    <p className="text-[13px] text-[#4B5563]">{review.comment}</p>
                    <p className="text-[11px] text-[#4B5563] mt-1">
                      {review.itemName} · {review.date}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
