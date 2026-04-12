import type { Fund } from './types';
import type { Alert, MonitoringConfig } from './alertTypes';
import { api } from './api';

export interface FundSnapshot {
  id: string;
  name: string;
  category: string;
  return1y: number | null;
  sharpeRatio: number | null;
  stdDev: number | null;
  timestamp: number;
}

// API経由の永続化
export async function saveSnapshots(funds: Fund[]): Promise<void> {
  const snapshots: FundSnapshot[] = funds.map(f => ({
    id: f.id, name: f.name, category: f.category,
    return1y: f.return1y, sharpeRatio: f.sharpeRatio, stdDev: f.stdDev,
    timestamp: Date.now(),
  }));
  await api.put('/portfolio/snapshots', { snapshots });
}

export async function loadSnapshots(): Promise<FundSnapshot[]> {
  const data = await api.get('/portfolio/snapshots');
  return data.snapshots || [];
}

export async function saveAlerts(alerts: Alert[]): Promise<void> {
  await api.post('/portfolio/alerts', { alerts });
}

export async function loadAlerts(): Promise<Alert[]> {
  const data = await api.get('/portfolio/alerts');
  return data.alerts || [];
}

export async function markAlertsRead(alertIds: string[] | 'all'): Promise<void> {
  await api.put('/portfolio/alerts/read', { alertIds });
}

export async function saveConfig(config: MonitoringConfig): Promise<void> {
  await api.put('/portfolio/config', { config });
}

export async function loadConfig(): Promise<MonitoringConfig | null> {
  const data = await api.get('/portfolio/config');
  return data.config || null;
}

export async function savePortfolio(items: any[]): Promise<void> {
  await api.put('/portfolio', { items });
}

export async function loadPortfolio(): Promise<any[]> {
  const data = await api.get('/portfolio');
  return data.items || [];
}

// アラート判定（変更なし）
export function checkAlerts(
  currentFunds: Fund[],
  previousSnapshots: FundSnapshot[],
  config: MonitoringConfig
): Alert[] {
  if (!config.enabled) return [];

  const prevMap = new Map(previousSnapshots.map(s => [s.id, s]));
  const alerts: Alert[] = [];
  const now = Date.now();

  for (const fund of currentFunds) {
    const prev = prevMap.get(fund.id);
    if (!prev) continue;

    for (const rule of config.rules) {
      if (!rule.enabled) continue;

      if (rule.type === 'return_change' && fund.return1y !== null && prev.return1y !== null) {
        const change = fund.return1y - prev.return1y;
        const absChange = Math.abs(change);

        if (rule.id === 'return_drop' && change < 0 && absChange >= rule.threshold) {
          alerts.push({
            id: `${fund.id}_${rule.id}_${now}`,
            ruleId: rule.id, fundId: fund.id, fundName: fund.name, category: fund.category,
            type: 'return_change',
            severity: absChange >= rule.threshold * 2 ? 'danger' : 'warning',
            title: `リターン低下: ${fund.name}`,
            message: `1年リターンが ${prev.return1y.toFixed(1)}% → ${fund.return1y.toFixed(1)}% に低下（${change.toFixed(1)}%）`,
            suggestion: generateSuggestion('return_drop', fund, absChange),
            previousValue: prev.return1y, currentValue: fund.return1y, changePercent: change,
            timestamp: now, read: false,
          });
        }

        if (rule.id === 'return_surge' && change > 0 && absChange >= rule.threshold) {
          alerts.push({
            id: `${fund.id}_${rule.id}_${now}`,
            ruleId: rule.id, fundId: fund.id, fundName: fund.name, category: fund.category,
            type: 'return_change', severity: 'info',
            title: `リターン上昇: ${fund.name}`,
            message: `1年リターンが ${prev.return1y.toFixed(1)}% → ${fund.return1y.toFixed(1)}% に上昇（+${change.toFixed(1)}%）`,
            suggestion: generateSuggestion('return_surge', fund, absChange),
            previousValue: prev.return1y, currentValue: fund.return1y, changePercent: change,
            timestamp: now, read: false,
          });
        }
      }

      if (rule.type === 'sharpe_decline' && fund.sharpeRatio !== null && prev.sharpeRatio !== null) {
        const change = fund.sharpeRatio - prev.sharpeRatio;
        if (change < 0 && Math.abs(change) >= rule.threshold) {
          alerts.push({
            id: `${fund.id}_${rule.id}_${now}`,
            ruleId: rule.id, fundId: fund.id, fundName: fund.name, category: fund.category,
            type: 'sharpe_decline',
            severity: Math.abs(change) >= rule.threshold * 2 ? 'danger' : 'warning',
            title: `効率性低下: ${fund.name}`,
            message: `シャープレシオが ${prev.sharpeRatio.toFixed(2)} → ${fund.sharpeRatio.toFixed(2)} に低下`,
            suggestion: generateSuggestion('sharpe_decline', fund, Math.abs(change)),
            previousValue: prev.sharpeRatio, currentValue: fund.sharpeRatio, changePercent: change,
            timestamp: now, read: false,
          });
        }
      }

      if (rule.type === 'risk_change' && fund.stdDev !== null) {
        if (rule.id === 'risk_high' && fund.stdDev > rule.threshold) {
          const prevVal = prev.stdDev ?? 0;
          if (prevVal <= rule.threshold) {
            alerts.push({
              id: `${fund.id}_${rule.id}_${now}`,
              ruleId: rule.id, fundId: fund.id, fundName: fund.name, category: fund.category,
              type: 'risk_change',
              severity: fund.stdDev > 25 ? 'danger' : 'warning',
              title: `リスク上昇: ${fund.name}`,
              message: `標準偏差が ${fund.stdDev.toFixed(1)}% に上昇（設定上限${rule.threshold}%超過）`,
              suggestion: generateSuggestion('risk_high', fund, fund.stdDev),
              previousValue: prevVal, currentValue: fund.stdDev, changePercent: fund.stdDev - prevVal,
              timestamp: now, read: false,
            });
          }
        }
        if (rule.id === 'risk_low' && fund.stdDev < rule.threshold) {
          const prevVal = prev.stdDev ?? 20;
          if (prevVal >= rule.threshold) {
            alerts.push({
              id: `${fund.id}_${rule.id}_${now}`,
              ruleId: rule.id, fundId: fund.id, fundName: fund.name, category: fund.category,
              type: 'risk_change', severity: 'info',
              title: `リスク低下: ${fund.name}`,
              message: `標準偏差が ${fund.stdDev.toFixed(1)}% に低下（設定下限${rule.threshold}%未満）`,
              suggestion: generateSuggestion('risk_low', fund, fund.stdDev),
              previousValue: prevVal, currentValue: fund.stdDev, changePercent: fund.stdDev - prevVal,
              timestamp: now, read: false,
            });
          }
        }
      }
    }
  }

  return alerts;
}

function generateSuggestion(ruleId: string, fund: Fund, magnitude: number): string {
  switch (ruleId) {
    case 'return_drop':
      return magnitude >= 10
        ? `大幅な下落です。同カテゴリ（${fund.category}）内で代替ファンドへのスイッチングを検討してください。`
        : `リターンが低下しています。3ヶ月以上継続する場合はスイッチングを検討してください。`;
    case 'return_surge':
      return `リターンが大幅に上昇しています。利益確定のリバランスを検討するタイミングかもしれません。`;
    case 'sharpe_decline':
      return `リスクに対するリターン効率が低下しています。代替ファンドへのスイッチングを検討してください。`;
    case 'risk_high':
      return `リスク水準が設定範囲を超えています。債券比率を上げるか低リスクファンドへの振替を検討してください。`;
    case 'risk_low':
      return `リスク水準が設定範囲より低くなっています。投資目標に合っているか確認してください。`;
    default:
      return 'ポートフォリオの見直しを検討してください。';
  }
}
