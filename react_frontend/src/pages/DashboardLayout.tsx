import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import VoiceOverlay from '../components/VoiceOverlay';

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
      localStorage.removeItem('jwt');
      localStorage.removeItem('user_role');
      navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navigation */}
      <nav style={{ 
          margin: '24px auto',
          width: '100%',
          maxWidth: '1440px',
          padding: '0 24px',
          display: 'flex', 
          justifyContent: 'center'
      }}>
          <div className="glass-panel" style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '16px 32px',
              gap: '32px'
          }}>
              <div style={{ 
                  fontWeight: '800', 
                  fontSize: '1.5rem', 
                  letterSpacing: '0.05em',
                  background: 'linear-gradient(135deg, #ffffff 0%, #d4af37 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  cursor: 'default'
              }}>
                M5
              </div>
              
              <Link to="/dashboard" style={{ 
                  color: 'var(--accent-gold)', 
                  textDecoration: 'none', 
                  fontWeight: '600', 
                  fontSize: '0.9rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.1em',
                  transition: 'color 0.2s'
              }}>
                  Sales Forecast
              </Link>
              
              <div style={{ flex: 1 }}></div>

              <button 
                  className="btn-secondary"
                  onClick={handleLogout}
                  style={{
                      width: 'auto',
                      padding: '8px 20px',
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border-subtle)',
                      fontSize: '14px'
                  }}
              >
                  Logout
              </button>
          </div>
      </nav>

      {/* Main Content Area */}
      <main style={{ 
          flex: 1,
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 24px 60px'
      }}>
        <Outlet />
      </main>

      {/* Universal Floating Voice Assistant */}
      <VoiceOverlay />
    </div>
  );
}
