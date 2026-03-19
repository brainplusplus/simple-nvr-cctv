import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useTranslation } from '../hooks/useTranslation';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await authApi.forgotPassword({ email });
            setSuccess(true);
        } catch {
            setError(t('forgot_password.error_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '48px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <CheckCircle size={32} color="#10b981" />
                    </div>
                    <h2 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>{t('forgot_password.success_title')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.6' }}>{t('forgot_password.success_message', { email })}</p>
                    <Link to="/reset-password" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
                        {t('forgot_password.enter_token_button')}
                    </Link>
                    <div><Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px' }}><ArrowLeft size={16} /> {t('forgot_password.back_to_login')}</Link></div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '48px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Mail size={28} color="white" />
                    </div>
                    <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>{t('forgot_password.title')}</h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: '1.5' }}>{t('forgot_password.instruction')}</p>
                </div>
                {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px' }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{t('forgot_password.email_label')}</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('forgot_password.email_placeholder')} required
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px 16px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}>
                        {isLoading ? t('forgot_password.submitting_button') : t('forgot_password.submit_button')}
                    </button>
                </form>
                <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <ArrowLeft size={16} /> {t('forgot_password.back_to_login')}
                </Link>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
