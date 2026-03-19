import React from 'react';
import { useAuth } from '../store/auth-context';
import { useTranslation } from '../hooks/useTranslation';
import { LayoutDashboard, Users, Clock, Shield } from 'lucide-react';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const { t } = useTranslation('dashboard');

    const cards = [
        { icon: <LayoutDashboard size={24} />, label: 'Dashboard', color: '#3b82f6', bg: '#eff6ff' },
        { icon: <Users size={24} />, label: 'Users', color: '#10b981', bg: '#ecfdf5' },
        { icon: <Clock size={24} />, label: 'Jobs', color: '#f59e0b', bg: '#fffbeb' },
        { icon: <Shield size={24} />, label: 'Security', color: '#8b5cf6', bg: '#f5f3ff' },
    ];

    return (
        <div>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
                    {t('welcome', { name: user?.name ?? '' })}
                </h1>
                <p style={{ color: '#64748b', fontSize: '16px', margin: 0 }}>{t('subtitle')}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                {cards.map((card, i) => (
                    <div key={i} style={{
                        background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        display: 'flex', alignItems: 'center', gap: '16px', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
                    }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                            {card.icon}
                        </div>
                        <div>
                            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 4px' }}>{card.label}</p>
                            <p style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>—</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardPage;
