type MatchScoreProps = {
  score: number;
  label?: string;
};

export function MatchScore({ score, label }: MatchScoreProps) {
  const getColor = () => {
    if (score >= 80) return "text-[#16A34A] bg-[#16A34A]/10";
    if (score >= 60) return "text-[#D97706] bg-[#D97706]/10";
    return "text-[#4B5563] bg-[#D1D5DB]";
  };

  const getLabel = () => {
    if (label) return label;
    if (score >= 80) return "High match";
    if (score >= 60) return "Medium match";
    return "Possible match";
  };

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${getColor()}`}>
        {score} / 100
      </div>
      <span className="text-[11px] text-[#4B5563]">{getLabel()}</span>
    </div>
  );
}
