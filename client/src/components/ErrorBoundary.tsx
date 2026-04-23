import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-red-600 mb-2">予期しないエラーが発生しました</h2>
            <p className="text-sm text-gray-600 mb-3">
              ページを再読み込みするか、下のボタンでリセットしてください。
            </p>
            <pre className="bg-gray-100 rounded p-3 text-xs text-gray-700 overflow-auto max-h-48 mb-3">
              {this.state.error?.message ?? '不明なエラー'}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                リセット
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                再読み込み
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
