import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Book, Laptop, Sofa, Shirt, Home as HomeIcon, Dumbbell, Music, Gamepad2, PenTool, MoreHorizontal } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const categories = [
  { id: "textbooks", label: "Textbooks", icon: Book },
  { id: "electronics", label: "Electronics", icon: Laptop },
  { id: "furniture", label: "Furniture", icon: Sofa },
  { id: "clothing", label: "Clothing", icon: Shirt },
  { id: "appliances", label: "Appliances", icon: HomeIcon },
  { id: "sports", label: "Sports Gear", icon: Dumbbell },
  { id: "music", label: "Musical Instruments", icon: Music },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "stationery", label: "Stationery", icon: PenTool },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

const subcategories: Record<string, string[]> = {
  electronics: ["Laptop", "Phone", "Tablet", "Headphones", "Charger", "Camera"],
  textbooks: ["Math", "Science", "Engineering", "Business", "Literature", "History"],
};

const conditions = ["Any", "Good", "Very Good", "Like New"];
const urgencyOptions = [
  { value: "flexible", label: "Flexible — Anytime in the next 30 days" },
  { value: "week", label: "Within a week — I need this soon" },
  { value: "month", label: "Within a month — No rush but prefer sooner" },
];

const campusLocations = ["Main Campus", "North Campus", "Downtown Campus", "West Campus"];

export function CreateDemand() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");

  // Step 2
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [condition, setCondition] = useState("Any");
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState("flexible");

  // Step 3
  const [location, setLocation] = useState("");

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Submit demand
      navigate("/");
    }
  };

  const isStep1Valid = category && description;
  const isStep2Valid = minBudget && maxBudget;
  const isStep3Valid = location;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-[#D1D5DB] px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => (step === 1 ? navigate(-1) : setStep(step - 1))}>
          <ArrowLeft className="w-6 h-6 text-[#111827]" />
        </button>
        <div className="flex-1">
          <h1 className="text-[17px] font-semibold text-[#111827]">New Demand Request</h1>
          <p className="text-[13px] text-[#4B5563]">Step {step} of 3</p>
        </div>
      </div>

      <div className="px-4 py-6">
        {step === 1 && (
          <div className="space-y-6">
            {/* Category grid */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Category *
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        setSubcategory("");
                      }}
                      className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-colors ${
                        category === cat.id
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#D1D5DB] hover:border-[#2563EB]/50"
                      }`}
                    >
                      <Icon
                        className={`w-8 h-8 ${
                          category === cat.id ? "text-[#2563EB]" : "text-[#4B5563]"
                        }`}
                      />
                      <span className="text-[13px] font-medium text-[#111827]">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategory */}
            {category && subcategories[category] && (
              <div>
                <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                  Subcategory
                </Label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                  {subcategories[category].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSubcategory(sub)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full border text-[13px] font-medium transition-colors ${
                        subcategory === sub
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                          : "border-[#D1D5DB] text-[#4B5563]"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-[12px] font-medium text-[#4B5563] mb-2 block">
                What exactly do you need? *
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the specific item. E.g. 'Calculus: Early Transcendentals 8th edition by James Stewart'"
                className="min-h-[100px] border-[#D1D5DB] rounded-lg"
              />
            </div>

            {/* Requirements */}
            <div>
              <Label htmlFor="requirements" className="text-[12px] font-medium text-[#4B5563] mb-2 block">
                Special requirements (optional)
              </Label>
              <Input
                id="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="E.g. Must include original box, charger, etc."
                className="h-12 border-[#D1D5DB] rounded-lg"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            {/* Budget range */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Budget range *
              </Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-[11px] text-[#4B5563] mb-1 block">Min ($)</Label>
                  <Input
                    type="number"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value)}
                    placeholder="0"
                    className="h-12 border-[#D1D5DB] rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-[11px] text-[#4B5563] mb-1 block">Max ($)</Label>
                  <Input
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="100"
                    className="h-12 border-[#D1D5DB] rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Condition */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Preferred condition
              </Label>
              <div className="flex gap-2">
                {conditions.map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setCondition(cond)}
                    className={`flex-1 h-10 rounded-lg text-[13px] font-medium transition-colors ${
                      condition === cond
                        ? "bg-[#2563EB] text-white"
                        : "bg-[#F3F4F6] text-[#4B5563]"
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Quantity needed
              </Label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-10 w-10 rounded-lg border-[#D1D5DB]"
                >
                  -
                </Button>
                <span className="text-[20px] font-semibold text-[#111827] w-12 text-center">
                  {quantity}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  className="h-10 w-10 rounded-lg border-[#D1D5DB]"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Urgency */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Urgency
              </Label>
              <div className="space-y-2">
                {urgencyOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setUrgency(option.value)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                      urgency === option.value
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#D1D5DB]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          urgency === option.value
                            ? "border-[#2563EB]"
                            : "border-[#D1D5DB]"
                        }`}
                      >
                        {urgency === option.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                        )}
                      </div>
                      <span className="text-[14px] text-[#111827]">{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {/* Location */}
            <div>
              <Label className="text-[12px] font-medium text-[#4B5563] mb-3 block">
                Preferred pickup location *
              </Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="h-12 border-[#D1D5DB] rounded-lg">
                  <SelectValue placeholder="Select campus location" />
                </SelectTrigger>
                <SelectContent>
                  {campusLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Review summary */}
            <div className="bg-[#F3F4F6] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#111827]">Review Summary</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-[#2563EB] text-[13px] h-auto p-0"
                >
                  Edit
                </Button>
              </div>
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Category:</span>
                  <span className="text-[#111827] font-medium">
                    {categories.find((c) => c.id === category)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Budget:</span>
                  <span className="text-[#111827] font-medium">
                    ${minBudget} – ${maxBudget}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Condition:</span>
                  <span className="text-[#111827] font-medium">{condition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Quantity:</span>
                  <span className="text-[#111827] font-medium">{quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#4B5563]">Location:</span>
                  <span className="text-[#111827] font-medium">{location}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom sticky button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-[#D1D5DB]">
        <Button
          onClick={handleNext}
          disabled={
            (step === 1 && !isStep1Valid) ||
            (step === 2 && !isStep2Valid) ||
            (step === 3 && !isStep3Valid)
          }
          className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg font-medium disabled:bg-[#D1D5DB] disabled:text-[#4B5563]"
        >
          {step === 3 ? "Post Demand Request" : "Next →"}
        </Button>
        {step === 3 && (
          <p className="text-[13px] text-[#4B5563] text-center mt-2">
            Your demand expires in 30 days. You can cancel anytime.
          </p>
        )}
      </div>
    </div>
  );
}
