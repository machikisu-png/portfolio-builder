import type { RiskTolerance } from '../lib/types';

interface RiskSettingsProps {
  riskTolerance: RiskTolerance;
  onRiskChange: (risk: RiskTolerance) => void;
}

const riskOptions: Array<{ value: RiskTolerance; label: string; description: string; color: string }> = [
  {
    value: 'low',
    label: '安定重視',
    description: '債券中心の低リスク配分。元本の安定性を優先。',
    color: 'border-green-500 bg-green-50 text-green-700',
  },
  {
    value: 'medium',
    label: 'バランス型',
    description: '株式と債券のバランス。中程度のリスク・リターン。',
    color: 'border-yellow-500 bg-yellow-50 text-yellow-700',
  },
  {
    value: 'high',
    label: '積極運用',
    description: '株式中心の高リターン狙い。価格変動リスクを許容。',
    color: 'border-red-500 bg-red-50 text-red-700',
  },
];

export default function RiskSettings({ riskTolerance, onRiskChange }: RiskSettingsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">リスク許容度</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {riskOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onRiskChange(opt.value)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              riskTolerance === opt.value
                ? opt.color
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold mb-1">{opt.label}</div>
            <div className="text-xs opacity-80">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
