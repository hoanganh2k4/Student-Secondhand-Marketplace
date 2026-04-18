interface Props { ms?: number | null }

export default function LatencyBadge({ ms }: Props) {
  if (ms == null) return <span className="text-xs text-gray-400">—</span>;
  const color =
    ms < 500  ? "text-green-700 bg-green-100" :
    ms < 2000 ? "text-yellow-700 bg-yellow-100" :
                "text-red-700 bg-red-100";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`}
    </span>
  );
}
