interface ProofScoreProps {
  score: number;
  imageCount: number;
  hasVision: boolean;
}

export default function ProofScore({
  score,
  imageCount,
  hasVision,
}: ProofScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`${getScoreColor()} h-2 rounded-full transition-all`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600">{score}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>
          {imageCount} {imageCount === 1 ? "image" : "images"}
        </span>
        {hasVision && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
            AI Vision
          </span>
        )}
      </div>
    </div>
  );
}
