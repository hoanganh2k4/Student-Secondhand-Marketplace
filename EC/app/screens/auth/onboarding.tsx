import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [campus, setCampus] = useState("");

  const currentYear = 2026;
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const campuses = ["Main Campus", "North Campus", "Downtown Campus", "West Campus"];

  const handleSetup = () => {
    // Save user data to localStorage for demo
    localStorage.setItem("userData", JSON.stringify({ name, graduationYear, campus }));
    navigate("/");
  };

  const isValid = name && graduationYear && campus;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col gap-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[28px] font-bold text-[#111827] mb-2">
            Almost there — tell us a bit about yourself
          </h1>
          <p className="text-[15px] text-[#4B5563]">
            This information stays on your profile and helps build trust.
          </p>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          {/* Full name */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-[12px] font-medium text-[#4B5563]">
              Full name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 border border-[#D1D5DB] rounded-lg focus:border-[#2563EB] focus:border-2"
            />
          </div>

          {/* Graduation year */}
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-[#4B5563]">
              Graduation year
            </label>
            <Select value={graduationYear} onValueChange={setGraduationYear}>
              <SelectTrigger className="h-12 border border-[#D1D5DB] rounded-lg">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary campus location */}
          <div className="space-y-2">
            <label className="block text-[12px] font-medium text-[#4B5563]">
              Primary campus location
            </label>
            <Select value={campus} onValueChange={setCampus}>
              <SelectTrigger className="h-12 border border-[#D1D5DB] rounded-lg">
                <SelectValue placeholder="Select campus" />
              </SelectTrigger>
              <SelectContent>
                {campuses.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Setup button */}
        <Button
          onClick={handleSetup}
          disabled={!isValid}
          className="w-full h-11 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg font-medium disabled:bg-[#D1D5DB] disabled:text-[#4B5563]"
        >
          Set up my account →
        </Button>

        {/* Verification note */}
        <div className="flex items-center justify-center gap-2 text-[13px] text-[#4B5563]">
          <Lock className="w-3.5 h-3.5" />
          <span>Your student status is verified via your email domain.</span>
        </div>
      </div>
    </div>
  );
}
