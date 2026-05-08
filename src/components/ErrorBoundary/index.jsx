import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-chalk font-display text-xl">Algo se rompió</p>
          <p className="text-muted text-sm font-mono max-w-[60ch] break-words">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button
            onClick={() => { this.reset(); window.location.href = '/' }}
            className="px-6 py-2.5 rounded-full bg-gold text-void font-semibold text-sm hover:bg-gold-hi transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
