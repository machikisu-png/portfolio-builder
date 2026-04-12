import type { PortfolioPreset } from '../lib/types';
import { portfolioPresets } from '../lib/presets';

interface PresetSelectorProps {
  selectedPreset: string | null;
  onSelectPreset: (preset: PortfolioPreset) => void;
}

const colorMap: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-500',   badge: 'bg-blue-100 text-blue-800',   text: 'text-blue-700' },
  cyan:   { bg: 'bg-cyan-50',   border: 'border-cyan-500',   badge: 'bg-cyan-100 text-cyan-800',   text: 'text-cyan-700' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-500', badge: 'bg-indigo-100 text-indigo-800', text: 'text-indigo-700' },
  green:  { bg: 'bg-green-50',  border: 'border-green-500',  badge: 'bg-green-100 text-green-800',  text: 'text-green-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-500', badge: 'bg-orange-100 text-orange-800', text: 'text-orange-700' },
  red:    { bg: 'bg-red-50',    border: 'border-red-500',    badge: 'bg-red-100 text-red-800',     text: 'text-red-700' },
};

function RiskReturnBar({ returnVal, risk }: { returnVal: number; risk: number }) {
  const maxReturn = 15;
  const maxRisk = 12;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-16">リターン</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min((returnVal / maxReturn) * 100, 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono font-semibold w-14 text-right">{returnVal}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-16">リスク</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-orange-400 h-2 rounded-full transition-all"
            style={{ width: `${Math.min((risk / maxRisk) * 100, 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono font-semibold w-14 text-right">{risk}%</span>
      </div>
    </div>
  );
}

export default function PresetSelector({ selectedPreset, onSelectPreset }: PresetSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">ポートフォリオタイプを選択</h2>
      <p className="text-sm text-gray-500 mb-4">6つのプリセットから投資スタイルに合ったものを選択すると、自動的にファンドが割り当てられます</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {portfolioPresets.map((preset, index) => {
          const colors = colorMap[preset.color] || colorMap.blue;
          const isSelected = selectedPreset === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                isSelected
                  ? `${colors.bg} ${colors.border}`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {index + 1}
                </span>
                {isSelected && (
                  <span className="text-xs font-bold text-green-600">選択中</span>
                )}
              </div>
              <div className={`font-semibold text-sm mt-1 ${isSelected ? colors.text : 'text-gray-800'}`}>
                {preset.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{preset.subtitle}</div>

              {/* 資産配分バッジ */}
              <div className="flex flex-wrap gap-1 mt-2">
                {preset.allocations.map(a => (
                  <span
                    key={a.category}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                  >
                    {a.category} {Math.round(a.weight * 100)}%
                  </span>
                ))}
              </div>

              <RiskReturnBar returnVal={preset.expectedReturn} risk={preset.risk} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
