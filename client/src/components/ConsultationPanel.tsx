import { useState } from 'react';
import type { PortfolioItem } from '../lib/types';
import { portfolioPresets } from '../lib/presets';
import {
  type UserProfile,
  getUserProfile,
  saveUserProfile,
  clearUserProfile,
  OCCUPATION_LABELS,
  MARITAL_LABELS,
  RISK_LABELS,
  RETIREMENT_LABELS,
} from '../lib/userProfile';
import { buildConsultationText, SCENARIO_TEXT } from '../lib/consultationExport';

interface Props {
  items: PortfolioItem[];
  presetId: string | null;
}

const SCENARIO_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'annual_review', label: '年1回の定期レビュー' },
  { id: 'crash',         label: '相場の大幅下落への対応' },
  { id: 'rally',         label: '相場の大幅上昇への対応' },
  { id: 'forex',         label: '為替変動とヘッジ' },
  { id: 'rate_change',   label: '金利環境の変化' },
  { id: 'life_change',   label: 'ライフイベント変化' },
  { id: 'rebalance',     label: 'リバランス手順' },
  { id: 'fund_review',   label: 'ファンド入れ替え検討' },
  { id: 'goal_check',    label: '目標額への到達診断' },
  { id: 'tax',           label: 'NISA/iDeCo の枠最適化' },
];

export default function ConsultationPanel({ items, presetId }: Props) {
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [generated, setGenerated] = useState<string>('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const preset = portfolioPresets.find(p => p.id === presetId) ?? null;

  const updateField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    saveUserProfile(next);
  };

  const toggleScenario = (id: string) => {
    setScenarios(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const generate = () => {
    const text = buildConsultationText({ profile, items, preset, scenarios, freeText });
    setGenerated(text);
    setCopyState('idle');
  };

  const copyToClipboard = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
    }
  };

  const reset = () => {
    if (!confirm('入力したプロフィールをすべて削除します。よろしいですか？')) return;
    clearUserProfile();
    setProfile({});
  };

  const num = (v: number | undefined) => (v === undefined || Number.isNaN(v)) ? '' : String(v);
  const parseNum = (s: string): number | undefined => {
    if (s === '') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <div className="space-y-4">
      {/* イントロ */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 mb-1">💬 ポートフォリオ相談シート</h2>
        <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
          下記の情報を入力すると、現在のポートフォリオと合わせて「相談シート」を自動生成します。
          生成されたテキストを Claude（チャット）に貼り付けて、診断・アドバイスを受けてください。
          <br />
          <span className="text-blue-700">※入力内容はこの端末のブラウザにのみ保存されます（サーバー送信なし）。</span>
        </p>
      </div>

      {/* プロフィール入力 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">1. あなたの情報</h3>
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-red-600 underline"
          >
            入力リセット
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {/* 年齢 */}
          <label className="block">
            <span className="text-xs text-gray-600">年齢</span>
            <input
              type="number"
              min="0"
              max="120"
              value={num(profile.age)}
              onChange={e => updateField('age', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 45"
            />
          </label>

          {/* 職業 */}
          <label className="block">
            <span className="text-xs text-gray-600">職業</span>
            <select
              value={profile.occupation ?? ''}
              onChange={e => updateField('occupation', e.target.value as UserProfile['occupation'])}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {Object.entries(OCCUPATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          {/* 世帯 */}
          <label className="block">
            <span className="text-xs text-gray-600">世帯状況</span>
            <select
              value={profile.maritalStatus ?? ''}
              onChange={e => updateField('maritalStatus', e.target.value as UserProfile['maritalStatus'])}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {Object.entries(MARITAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          {/* 扶養家族 */}
          <label className="block">
            <span className="text-xs text-gray-600">扶養家族（自由記述）</span>
            <input
              type="text"
              value={profile.dependents ?? ''}
              onChange={e => updateField('dependents', e.target.value)}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 長男8歳/長女12歳"
            />
          </label>

          {/* 年収 */}
          <label className="block">
            <span className="text-xs text-gray-600">年収（万円）</span>
            <input
              type="number"
              min="0"
              value={num(profile.annualIncome)}
              onChange={e => updateField('annualIncome', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 500"
            />
          </label>

          {/* 貯金 */}
          <label className="block">
            <span className="text-xs text-gray-600">貯金（投資以外・万円）</span>
            <input
              type="number"
              min="0"
              value={num(profile.savings)}
              onChange={e => updateField('savings', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 300"
            />
          </label>

          {/* 生活費 */}
          <label className="block">
            <span className="text-xs text-gray-600">月の生活費（万円）</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={num(profile.monthlyExpenses)}
              onChange={e => updateField('monthlyExpenses', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 18"
            />
          </label>

          {/* 固定支出 */}
          <label className="block">
            <span className="text-xs text-gray-600">月の固定支出（養育費・ローン等／万円）</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={num(profile.monthlyFixedOut)}
              onChange={e => updateField('monthlyFixedOut', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 11"
            />
          </label>

          {/* 退職金 */}
          <label className="block">
            <span className="text-xs text-gray-600">退職金/企業年金</span>
            <select
              value={profile.retirementBenefit ?? ''}
              onChange={e => updateField('retirementBenefit', e.target.value as UserProfile['retirementBenefit'])}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {Object.entries(RETIREMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          {/* リスク許容度 */}
          <label className="block">
            <span className="text-xs text-gray-600">リスク許容度</span>
            <select
              value={profile.riskTolerance ?? ''}
              onChange={e => updateField('riskTolerance', e.target.value as UserProfile['riskTolerance'])}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {Object.entries(RISK_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          {/* 目標年齢 */}
          <label className="block">
            <span className="text-xs text-gray-600">資産形成の目標年齢</span>
            <input
              type="number"
              min="0"
              max="120"
              value={num(profile.investGoalAge)}
              onChange={e => updateField('investGoalAge', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 65"
            />
          </label>

          {/* 目標額 */}
          <label className="block">
            <span className="text-xs text-gray-600">目標資産額（万円）</span>
            <input
              type="number"
              min="0"
              value={num(profile.investGoalAmount)}
              onChange={e => updateField('investGoalAmount', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 2000"
            />
          </label>

          {/* 月の積立額 */}
          <label className="block">
            <span className="text-xs text-gray-600">月の積立額（万円）</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={num(profile.monthlyInvestment)}
              onChange={e => updateField('monthlyInvestment', parseNum(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: 3"
            />
          </label>
        </div>

        {/* メモ */}
        <label className="block mt-3">
          <span className="text-xs text-gray-600">メモ（自由記述）</span>
          <textarea
            value={profile.notes ?? ''}
            onChange={e => updateField('notes', e.target.value)}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            placeholder="例: 持病あり / 親の介護リスクあり / 副業収入あり 等"
          />
        </label>
      </div>

      {/* シナリオ選択 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-base font-semibold text-gray-800 mb-2">2. 確認したい相談内容（複数選択可）</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCENARIO_OPTIONS.map(s => (
            <label key={s.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5">
              <input
                type="checkbox"
                checked={scenarios.includes(s.id)}
                onChange={() => toggleScenario(s.id)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-gray-800">{s.label}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{SCENARIO_TEXT[s.id]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 自由記述 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-base font-semibold text-gray-800 mb-2">3. 自由記述（任意）</h3>
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          placeholder="例: ニュースで米国株が大幅下落と聞いて不安。今の積立を止めるべきか、そのまま続けるべきか教えてほしい。"
        />
      </div>

      {/* 生成 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-800">4. 相談シート生成</h3>
          <button
            onClick={generate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            📝 相談シートを生成
          </button>
        </div>

        {generated && (
          <>
            <div className="flex items-center justify-between mt-3 mb-2">
              <p className="text-xs text-gray-500">
                ↓ このテキストをコピーして Claude チャットに貼り付けてください
              </p>
              <button
                onClick={copyToClipboard}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  copyState === 'copied'
                    ? 'bg-green-600 text-white'
                    : copyState === 'failed'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-white hover:bg-gray-800'
                }`}
              >
                {copyState === 'copied' ? '✓ コピー済み' : copyState === 'failed' ? '✗ 失敗' : '📋 コピー'}
              </button>
            </div>
            <textarea
              readOnly
              value={generated}
              rows={18}
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-[11px] sm:text-xs bg-gray-50"
              onFocus={e => e.target.select()}
            />
          </>
        )}

        {!generated && (
          <p className="text-xs text-gray-500 mt-2">
            上の「相談シートを生成」ボタンを押すと、現在のポートフォリオと入力内容を整形したテキストが表示されます。
          </p>
        )}
      </div>
    </div>
  );
}
