import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import type { UserRole } from '@/shared/types/auth.types';
import './AuthPage.css';

type AuthType = 'individual' | 'agent' | 'corporate';
type FormMode = 'login' | 'register';

interface AuthPageProps {
  type: AuthType;
}

export default function AuthPage({ type }: AuthPageProps) {
  const [mode, setMode] = useState<FormMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [extraField, setExtraField] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { showSuccess, showError } = useToast();

  const contentMap = {
    individual: {
      title: 'Welcome to EuroTech',
      subtitle: 'Manage your personal visa and residency applications with ease.',
      image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop',
      quote: '"The journey of a thousand miles begins with a single step."',
      registerLabel: 'Passport Number',
      targetRole: 'INDIVIDUAL' as UserRole,
    },
    agent: {
      title: 'Agent Portal Access',
      subtitle: 'Process bulk tourist visas and manage your client rosters efficiently.',
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop',
      quote: '"Empowering travel agencies to deliver seamless experiences."',
      registerLabel: 'Agency Name',
      targetRole: 'AGENT' as UserRole,
    },
    corporate: {
      title: 'Corporate Mobility',
      subtitle: 'Streamline global mobility, ICT transfers, and employee business visas.',
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop',
      quote: '"Building borderless teams for the future of global business."',
      registerLabel: 'Company Name',
      targetRole: 'CORPORATE' as UserRole,
    },
  };

  const currentContent = contentMap[type];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
        showSuccess('Welcome back! Signed in successfully.');
      } else {
        const names = fullName.split(' ');
        await register({
          email,
          password,
          role: currentContent.targetRole,
          firstName: names[0] || 'User',
          lastName: names.slice(1).join(' ') || '',
          passportNumber: type === 'individual' ? extraField : undefined,
          agencyName: type === 'agent' ? extraField : undefined,
          companyName: type === 'corporate' ? extraField : undefined,
        });
        showSuccess('Account created successfully! Welcome to EuroTech.');
      }

      if (type === 'individual') {
        navigate('/individual/wizard');
      } else if (type === 'agent') {
        navigate('/agent');
      } else if (type === 'corporate') {
        navigate('/corporate');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      showError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Sol Tərəf: Forma */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-back" onClick={() => navigate('/')}>
            &larr; Back to Profile Selection
          </div>

          <div className="auth-header">
            <h1>{mode === 'login' ? 'Sign In' : 'Create Account'}</h1>
            <p>
              {currentContent.title}.{' '}
              {mode === 'login'
                ? 'Please enter your details to continue.'
                : 'Fill out the form to get started.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>{currentContent.registerLabel}</label>
                  <input
                    type="text"
                    placeholder={`Enter ${currentContent.registerLabel.toLowerCase()}`}
                    value={extraField}
                    onChange={(e) => setExtraField(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === 'login' && (
              <div className="auth-options">
                <label className="remember-me">
                  <input type="checkbox" defaultChecked />
                  <span>Remember me</span>
                </label>
                <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-toggle">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button type="button" onClick={() => setMode('register')}>
                  Sign up here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')}>
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sağ Tərəf: Dinamik Vizual */}
      <div className="auth-visual-side" style={{ backgroundImage: `url(${currentContent.image})` }}>
        <div className="auth-visual-overlay"></div>
        <div className="auth-visual-content">
          <div className="brand-badge">EUROTECH IMMIGRATION</div>
          <h2>{currentContent.subtitle}</h2>
          <p>{currentContent.quote}</p>
        </div>
      </div>
    </div>
  );
}
