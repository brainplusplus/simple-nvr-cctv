import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/auth-context';
import { useTranslation } from '../hooks/useTranslation';
import { Mail, Lock, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const LoginPage: React.FC = () => {
    const { login, verifyOtp } = useAuth();
    const { t } = useTranslation('auth');
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // OTP state
    const [showOtp, setShowOtp] = useState(false);
    const [otpEmail, setOtpEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login({ email, password });
            navigate('/');
        } catch (err: unknown) {
            if (err instanceof Error && err.message === 'OTP_REQUIRED') {
                setShowOtp(true);
                setOtpEmail((err as Error & { email: string }).email);
            } else {
                setError(t('login.error_invalid_credentials'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError('');
        setIsLoading(true);

        try {
            await verifyOtp({ email: otpEmail, otp_code: otpCode });
            navigate('/');
        } catch {
            setOtpError(t('otp.error_invalid'));
        } finally {
            setIsLoading(false);
        }
    };

    if (showOtp) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '48px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <KeyRound size={28} color="white" />
                        </div>
                        <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>{t('otp.title')}</h2>
                        <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{t('otp.info', { email: otpEmail })}</p>
                    </div>
                    {otpError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{otpError}</div>}
                    <form onSubmit={handleVerifyOtp}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{t('otp.label')}</label>
                            <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder={t('otp.placeholder')} maxLength={6} required
                                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px 16px', color: 'white', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}>
                            {isLoading ? t('otp.submitting_button') : t('otp.submit_button')}
                        </button>
                    </form>
                    <button onClick={() => { setShowOtp(false); setOtpCode(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '14px' }}>
                        <ArrowLeft size={16} /> {t('otp.back_to_login')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '48px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Lock size={28} color="white" />
                    </div>
                    <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: 0 }}>{t('login.title')}</h2>
                </div>
                {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}
                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{t('login.email_label')}</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.email_placeholder')} required
                                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px 16px 14px 44px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>{t('login.password_label')}</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login.password_placeholder')} required
                                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '14px 44px 14px 44px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                            </button>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                        <Link to="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{t('login.forgot_password')}</Link>
                    </div>
                    <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                        {isLoading ? t('login.submitting_button') : t('login.submit_button')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
