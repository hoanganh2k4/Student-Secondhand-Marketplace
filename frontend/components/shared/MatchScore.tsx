function getColor(score: number) {
  if (score >= 80) return 'text-[#16A34A] bg-[#16A34A]/10'
  if (score >= 60) return 'text-[#D97706] bg-[#D97706]/10'
  return 'text-[#4B5563] bg-[#D1D5DB]'
}

function getLabel(score: number) {
  if (score >= 80) return 'High match'
  if (score >= 60) return 'Medium match'
  return 'Low match'
}

export function MatchScore({ score, label }: { score: number; label?: string }) {
  const color = getColor(score)
  const defaultLabel = getLabel(score)

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${color}`}>
        {score}%
      </span>
      <span className="text-[10px] text-[#4B5563]">{label ?? defaultLabel}</span>
    </div>
  )
}
