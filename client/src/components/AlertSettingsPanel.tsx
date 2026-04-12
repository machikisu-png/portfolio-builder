import type { MonitoringConfig, AlertRule } from '../lib/alertTypes';

interface AlertSettingsPanelProps {
  config: MonitoringConfig;
  onConfigChange: (config: MonitoringConfig) => void;
}

const frequencyOptions: Array<{ value: MonitoringConfig['frequency']; label: string; desc: string }> = [
  { value: 'monthly', label: '毎月', desc: '月1回チェック' },
  { value: 'semiannual', label: '半年', desc: '6ヶ月ごとにチェック' },
  { value: 'annual', label: '1年', desc: '年1回チェック' },
];

export default function AlertSettingsPanel({ config, onConfigChange }: AlertSettingsPanelProps) {
  const toggleEnabled = () => {
    onConfigChange({ ...config, enabled: !config.enabled });
  };

  const setFrequency = (freq: MonitoringConfig['frequency']) => {
    onConfigChange({ ...config, frequency: freq });
  };

  const toggleRule = (ruleId: string) => {
    const rules = config.rules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    onConfigChange({ ...config, rules });
  };

  const updateThreshold = (ruleId: string, value: number) => {
    const rules = config.rules.map(r =>
      r.id === ruleId ? { ...r, threshold: value } : r
    );
    onConfigChange({ ...config, rules });
  };

  const lastCheckedStr = config.lastChecked
    ? new Date(config.lastChecked).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : '未実施';

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">モニタリング設定</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-600">{config.enabled ? '有効' : '無効'}</span>
          <div
            onClick={toggleEnabled}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${config.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${config.enabled ? 'translate-x-5.5 left-[1px]' : 'left-[2px]'}`}
              style={{ transform: config.enabled ? 'translateX(22px)' : 'translateX(0)' }}
            />
          </div>
        </label>
      </div>

      {config.enabled && (
        <div className="space-y-4">
          {/* モニタリング頻度 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">チェック頻度</label>
            <div className="grid grid-cols-3 gap-2">
              {frequencyOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                    config.frequency === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 前回チェック */}
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            前回チェック: {lastCheckedStr}
          </div>

          {/* アラートルール */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">通知ルール</label>
            <div className="space-y-2">
              {config.rules.map(rule => (
                <div
                  key={rule.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    rule.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div>
                        <div className="text-sm text-gray-800 font-medium">
                          {rule.type === 'return_change' && 'リターン変動'}
                          {rule.type === 'sharpe_decline' && 'シャープレシオ低下'}
                          {rule.type === 'risk_change' && 'リスク水準変化'}
                        </div>
                        <div className="text-[11px] text-gray-500">{rule.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-500">閾値:</span>
                      <input
                        type="number"
                        step={rule.type === 'sharpe_decline' ? 0.1 : 1}
                        value={rule.threshold}
                        onChange={e => updateThreshold(rule.id, parseFloat(e.target.value) || 0)}
                        className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-xs"
                        disabled={!rule.enabled}
                      />
                      <span className="text-xs text-gray-400">
                        {rule.type === 'sharpe_decline' ? '' : '%'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
