import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Render error caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#111113] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Algo salio mal</h1>
              <p className="text-gray-400 text-sm">
                La aplicacion encontro un error inesperado. Tus datos estan seguros en localStorage.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-xs font-mono text-red-400 break-all">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}
            <button onClick={this.handleReload} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
              <RefreshCw className="w-4 h-4" />
              Recargar aplicacion
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
