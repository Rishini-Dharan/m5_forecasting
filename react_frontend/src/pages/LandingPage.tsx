import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px'
        }}>
            <div className="glass-panel animate-fade-in" style={{
                padding: '48px 40px',
                textAlign: 'center',
                maxWidth: '640px',
                width: '100%'
            }}>
                <div style={{
                    display: 'inline-block',
                    padding: '6px 14px',
                    borderRadius: '50px',
                    backgroundColor: 'var(--accent-gold-transparent-light)',
                    border: '1px solid var(--border-gold)',
                    color: 'var(--accent-gold)',
                    fontSize: '12px',
                    fontWeight: '600',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '24px'
                }}>
                    Enterprise Grade
                </div>

                <h1 style={{
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, #ffffff 0%, #d4af37 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '3rem',
                    letterSpacing: '-0.03em'
                }}>
                    M5 Forecasting Engine
                </h1>

                <p style={{
                    fontSize: '1.125rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '40px'
                }}>
                    A state-of-the-art predictive analytics platform powered by LightGBM. Includes an ultra-low latency AI Voice Assistant for instant insights.
                </p>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <div style={{ flex: '1', maxWidth: '200px' }}>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/login')}
                        >
                            Login
                        </button>
                    </div>

                    <div style={{ flex: '1', maxWidth: '200px' }}>
                        <button
                            className="btn-secondary"
                            onClick={() => navigate('/signup')}
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
