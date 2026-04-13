import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { PortfolioItem } from '../lib/types';
import { calcPortfolioStats } from '../lib/optimizer';

interface PortfolioChartProps {
  items: PortfolioItem[];
  showFrontier?: boolean;
  frontierData?: Array<{ risk: number; return_: number }>;
  presetReturn?: number;
  presetRisk?: number;
}

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

const categoryColors: Record<string, string> = {
  '国内株式': '#EF4444',
  '先進国株式': '#3B82F6',
  '新興国株式': '#F59E0B',
  '全世界株式': '#8B5CF6',
  '国内債券': '#10B981',
  '海外債券': '#06B6D4',
  '新興国債券': '#14B8A6',
  'バランス型': '#6366F1',
  'REIT': '#EC4899',
  'コモディティ': '#F97316',
  'その他': '#9CA3AF',
};

export default function PortfolioChart({ items, showFrontier, frontierData, presetReturn, presetRisk }: PortfolioChartProps) {
  if (items.length === 0) return null;

  // ファンド別配分データ
  const pieData = items
    .filter(item => item.weight > 0)
    .map(item => ({
      name: item.fund.name.length > 20 ? item.fund.name.substring(0, 20) + '...' : item.fund.name,
      value: Math.round(item.weight * 100),
      category: item.fund.category,
    }));

  // カテゴリ別集計
  const categoryMap = new Map<string, number>();
  for (const item of items) {
    const current = categoryMap.get(item.fund.category) || 0;
    categoryMap.set(item.fund.category, current + item.weight * 100);
  }
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  // ポートフォリオ統計（プリセット値があればそちらを使用）
  const funds = items.map(i => i.fund);
  const weights = items.map(i => i.weight);
  const baseStats = calcPortfolioStats(funds, weights);
  const stats = {
    expectedReturn: presetReturn ?? baseStats.expectedReturn,
    risk: presetRisk ?? baseStats.risk,
    sharpeRatio: presetRisk ? ((presetReturn ?? baseStats.expectedReturn) - 0.1) / presetRisk : baseStats.sharpeRatio,
  };

  return (
    <div className="space-y-6">
      {/* ポートフォリオサマリー */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-sm text-blue-600 mb-1">期待リターン</div>
          <div className="text-2xl font-bold text-blue-800">{stats.expectedReturn.toFixed(1)}%</div>
          <div className="text-xs text-blue-500">年率</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-sm text-orange-600 mb-1">リスク（標準偏差）</div>
          <div className="text-2xl font-bold text-orange-800">{stats.risk.toFixed(1)}%</div>
          <div className="text-xs text-orange-500">年率</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-sm text-green-600 mb-1">シャープレシオ</div>
          <div className="text-2xl font-bold text-green-800">{stats.sharpeRatio.toFixed(2)}</div>
          <div className="text-xs text-green-500">効率性指標</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ファンド別配分 */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">ファンド別配分</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                dataKey="value"
                label={({ value }) => `${value}%`}
                labelLine={false}
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* カテゴリ別配分 */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">資産クラス別配分</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                dataKey="value"
                label={({ value }) => `${value}%`}
                labelLine={false}
              >
                {categoryData.map((entry, idx) => (
                  <Cell key={idx} fill={categoryColors[entry.name] || COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 効率的フロンティア */}
      {showFrontier && frontierData && frontierData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">効率的フロンティア</h4>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="risk"
                name="リスク"
                unit="%"
                label={{ value: 'リスク（標準偏差）%', position: 'bottom', offset: 0 }}
              />
              <YAxis
                type="number"
                dataKey="return_"
                name="リターン"
                unit="%"
                label={{ value: 'リターン%', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  `${value.toFixed(1)}%`,
                  name === 'risk' ? 'リスク' : 'リターン',
                ]}
              />
              <Scatter name="フロンティア" data={frontierData} fill="#3B82F6" />
              <Scatter
                name="現在のポートフォリオ"
                data={[{ risk: stats.risk, return_: stats.expectedReturn }]}
                fill="#EF4444"
                shape="star"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
