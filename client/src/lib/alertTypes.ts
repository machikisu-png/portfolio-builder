export interface AlertRule {
  id: string;
  type: 'return_change' | 'sharpe_decline' | 'risk_change';
  enabled: boolean;
  threshold: number; // %
  description: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  fundId: string;
  fundName: string;
  category: string;
  type: 'return_change' | 'sharpe_decline' | 'risk_change';
  severity: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  suggestion: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  timestamp: number;
  read: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  frequency: 'monthly' | 'semiannual' | 'annual';
  rules: AlertRule[];
  lastChecked: number | null;
}

export const defaultRules: AlertRule[] = [
  {
    id: 'return_drop',
    type: 'return_change',
    enabled: true,
    threshold: 5,
    description: '1年リターンが前回比で5%以上低下した場合',
  },
  {
    id: 'return_surge',
    type: 'return_change',
    enabled: true,
    threshold: 10,
    description: '1年リターンが前回比で10%以上上昇した場合',
  },
  {
    id: 'sharpe_decline',
    type: 'sharpe_decline',
    enabled: true,
    threshold: 0.3,
    description: 'シャープレシオが前回比で0.3以上低下した場合',
  },
  {
    id: 'risk_high',
    type: 'risk_change',
    enabled: true,
    threshold: 20,
    description: '標準偏差が20%を超えた場合',
  },
  {
    id: 'risk_low',
    type: 'risk_change',
    enabled: true,
    threshold: 15,
    description: '標準偏差が15%を下回った場合（設定範囲外）',
  },
];

export const defaultConfig: MonitoringConfig = {
  enabled: true,
  frequency: 'monthly',
  rules: defaultRules,
  lastChecked: null,
};
