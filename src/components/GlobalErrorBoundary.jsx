import React from 'react';

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 font-sans">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">¡Algo salió mal!</h1>
                        <p className="text-gray-600 mb-6">
                            La aplicación ha encontrado un error crítico y no puede continuar.
                        </p>

                        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto mb-6">
                            <p className="font-mono text-red-400 text-sm font-bold mb-2">
                                {this.state.error?.toString()}
                            </p>
                            {this.state.errorInfo && (
                                <pre className="font-mono text-slate-400 text-xs">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                            >
                                Recargar Página
                            </button>
                            <a
                                href="/"
                                className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                            >
                                Ir al Inicio
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
