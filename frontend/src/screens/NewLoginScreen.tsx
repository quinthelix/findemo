/**
 * Full-Screen Login with Financial Hero
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/endpoints';
import './NewLoginScreen.css';

export const NewLoginScreen = () => {
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ username, password });
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.username);
      localStorage.setItem('customer_name', response.customer_name);
      
      // Update page title with company name
      const displayName = response.customer_name.charAt(0).toUpperCase() + response.customer_name.slice(1);
      document.title = `${displayName} - Findemo`;
      
      navigate('/dashboard/var');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fullscreen-login">
      <div className="login-hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">Findemo</h1>
          <p className="hero-subtitle">Advanced Commodity Risk Management</p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Real-time VaR Analysis</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span>Instant Hedge Execution</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💼</span>
              <span>Portfolio Management</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-container">
        <div className="login-form-card">
          <div className="form-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access your risk management dashboard</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="btn-login">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="demo-credentials">
            <p>Demo Credentials: <strong>demo</strong> / <strong>demo123</strong></p>
          </div>
        </div>

        <div className="login-footer">
          <p>© 2026 Findemo. Enterprise Risk Management Platform.</p>
        </div>
      </div>
    </div>
  );
};
