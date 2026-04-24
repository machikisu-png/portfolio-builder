import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Key that causes the boundary to reset (e.g. current tab id). 値が変わると再マウントしhasErrorをリセット */
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 軽量インライン型 ErrorBoundary
 * - タブコンテンツの内側で使うことを想定
 * - 外側の State（activeTab など）はこの境界の外にあるので保持される
 * - resetKey が変わった場合は自動的に復帰
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 my-3">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-xl">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                この画面の読み込みで問題が発生しました
              </h3>
              <p className="text-xs text-yellow-700 mb-2">
                他のタブは正常です。下のボタンで再表示を試してください。
              </p>
              <button
                onClick={this.handleReset}
                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                再表示
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
