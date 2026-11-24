import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/shared/api/client';
import { useToast } from '@/shared/context/ToastContext';
import './AuthPage.css';

interface PasswordActionPageProps {
  action: 'set' | 'reset';
}

export default function PasswordActionPage({ action }: PasswordActionPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const title = action === 'set' ? 'Hesab Şifrəsini Təyin Edin' : 'Şifrənizi Sıfırlayın';
  const subtitle = action === 'set' 
    ? 'EuroTech portalına xoş gəlmisiniz. Zəhmət olmasa təhlükəsiz şifrə təyin edin.' 
    : 'Hesabınız üçün yeni təhlükəsiz şifrə daxil edin.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showError('Keçid tokeni tapılmadı və ya etibarsızdır.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Daxil edilən şifrələr bir-biri ilə uyğun gəlmir.');
      return;
    }

    if (password.length < 8) {
      showError('Şifrə ən azı 8 simvol olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = action === 'set' ? '/auth/set-password' : '/auth/reset-password';
      const res = await apiClient.post(endpoint, {
        token,
        newPassword: password,
      });

      if (res.success) {
        showSuccess(res.message || 'Şifrəniz uğurla yadda saxlanıldı!');
        setCompleted(true);
        setTimeout(() => {
          navigate('/login/individual');
        }, 2500);
      }
    } catch (err: any) {
      showError(err.message || 'Şifrə təyin edilərkən xəta baş verdi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          <div className="auth-header">
            <span className="auth-badge">EUROTECH TƏHLÜKƏSİZLİK</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          {!token ? (
            <div style={{ padding: '24px', background: '#FEF2F2', border: '1px solid #F87171', borderRadius: '8px', color: '#991B1B' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Etibarsız və ya vaxtı bitmiş keçid.</p>
              <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>E-poçtunuza göndərilən sonuncu keçiddən istifadə etdiyinizə əmin olun.</p>
              <button 
                type="button" 
                onClick={() => navigate('/')} 
                style={{ marginTop: '16px', padding: '8px 16px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Əsas Səhifəyə Qayıt
              </button>
            </div>
          ) : completed ? (
            <div style={{ padding: '24px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', color: '#166534', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>Şifrəniz Uğurla Yeniləndi!</p>
              <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>Daxil olma səhifəsinə yönləndirilirsiniz...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <label>Yeni Şifrə</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <span style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                  Ən azı 8 simvol, böyük hərf, kiçik hərf, rəqəm və xüsusi simvol (@$!%*?&)
                </span>
              </div>

              <div className="input-group" style={{ marginTop: '12px' }}>
                <label>Yeni Şifrənin Təkrarı</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading} style={{ marginTop: '20px' }}>
                {loading ? 'Yadda saxlanılır...' : 'Şifrəni Təsdiqlə və Daxil Ol'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="auth-visual-side" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=2069&auto=format&fit=crop)' }}>
        <div className="auth-visual-overlay"></div>
        <div className="auth-visual-content">
          <div className="brand-badge">EUROTECH DIGITAL IMMIGRATION</div>
          <h2>Qlobal Mobillik və Təhlükəsiz Şəxsi Kabinet</h2>
          <p>"Avropaya səyahət və ezamiyyət müraciətlərinizin təhlükəsiz ünvanı."</p>
        </div>
      </div>
    </div>
  );
}

