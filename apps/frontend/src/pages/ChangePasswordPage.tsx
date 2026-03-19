import React, { useState } from 'react';
import { authApi } from '../api/auth';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';
import { KeyRound } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
    const { t } = useTranslation('auth');
    const toast = useToast();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await authApi.changePassword({ old_password: oldPassword, new_password: newPassword });
            toast.success(t('change_password.success'));
            setOldPassword('');
            setNewPassword('');
        } catch {
            toast.error(t('change_password.error_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <KeyRound size={20} color="white" />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{t('change_password.title')}</h1>
            </div>
            <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>{t('change_password.old_password_label')}</label>
                        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required
                            style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>{t('change_password.new_password_label')}</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
                            style={{ width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <button type="submit" disabled={isLoading} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        {isLoading ? t('change_password.submitting_button') : t('change_password.submit_button')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
