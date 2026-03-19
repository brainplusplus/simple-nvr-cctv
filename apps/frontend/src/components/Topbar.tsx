import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Bell, Key, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../store/auth-context';

import { useTranslation } from '../hooks/useTranslation';
import { useLanguage } from '../contexts/LanguageContext';

// Simple SVG Flags
const FlagID = ({ style }: { style?: React.CSSProperties }) => (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', objectFit: 'cover', ...style }}>
        <rect width="24" height="16" fill="white" />
        <path d="M0 0H24V8H0V0Z" fill="#EF4444" />
        <path d="M0 8H24V16H0V8Z" fill="#F9FAFB" /> {/* Slightly off-white for visibility */}
    </svg>
);

const FlagUS = ({ style }: { style?: React.CSSProperties }) => (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '2px', objectFit: 'cover', ...style }}>
        <rect width="24" height="16" fill="#F9FAFB" />
        <path d="M0 0H24V1.6H0V0Z" fill="#EF4444" />
        <path d="M0 3.2H24V4.8H0V3.2Z" fill="#EF4444" />
        <path d="M0 6.4H24V8H0V6.4Z" fill="#EF4444" />
        <path d="M0 9.6H24V11.2H0V9.6Z" fill="#EF4444" />
        <path d="M0 12.8H24V14.4H0V12.8Z" fill="#EF4444" />
        <rect width="9.6" height="8.8" fill="#3B82F6" />
        {/* Simplified Stars */}
        <path d="M2 2H2.4V2.4H2V2Z" fill="white" />
        <path d="M4 2H4.4V2.4H4V2Z" fill="white" />
        <path d="M6 2H6.4V2.4H6V2Z" fill="white" />
        <path d="M3 4H3.4V4.4H3V4Z" fill="white" />
        <path d="M5 4H5.4V4.4H5V4Z" fill="white" />
        <path d="M7 4H7.4V4.4H7V4Z" fill="white" />
        <path d="M2 6H2.4V6.4H2V6Z" fill="white" />
        <path d="M4 6H4.4V6.4H4V6Z" fill="white" />
        <path d="M6 6H6.4V6.4H6V6Z" fill="white" />
    </svg>
);

interface TopbarProps {
    sidebarCollapsed: boolean;
    isMobile?: boolean;
    onMobileMenuToggle?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ sidebarCollapsed, isMobile = false, onMobileMenuToggle }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const langDropdownRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const { language, setLanguage } = useLanguage();

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
                setIsLangDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleChangePassword = () => {
        setIsDropdownOpen(false);
        navigate('/change-password');
    };

    const handleLogout = () => {
        setIsDropdownOpen(false);
        logout();
    };

    const CurrentFlag = language === 'id' ? FlagID : FlagUS;

    return (
        <header
            className="topbar-responsive"
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                left: isMobile ? 0 : (sidebarCollapsed ? '80px' : '260px'),
                height: '64px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '0 16px' : '0 24px',
                zIndex: 30,
                transition: 'left 0.3s ease',
            }}
        >
            {/* Left: Hamburger menu (mobile) + Page info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isMobile && (
                    <button
                        className="hamburger-btn"
                        onClick={onMobileMenuToggle}
                        style={{
                            display: 'flex',
                            padding: '10px',
                            borderRadius: '10px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Menu style={{ width: '22px', height: '22px', color: '#374151' }} />
                    </button>
                )}
                <h2 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 600, color: '#1f2937' }}>
                    {t('topbar.welcome_back')}
                </h2>
            </div>

            {/* Right: User section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Language Selector */}
                <div ref={langDropdownRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            background: isLangDropdownOpen ? '#f3f4f6' : 'transparent',
                            border: '1px solid',
                            borderColor: isLangDropdownOpen ? '#e5e7eb' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <CurrentFlag style={{ width: '20px', height: '14px', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>
                            {language}
                        </span>
                        <ChevronDown
                            style={{
                                width: '14px',
                                height: '14px',
                                color: '#6b7280',
                                transform: isLangDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s'
                            }}
                        />
                    </button>

                    {isLangDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            minWidth: '150px',
                            background: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
                            border: '1px solid rgba(0, 0, 0, 0.06)',
                            padding: '6px',
                            zIndex: 51,
                        }}>
                            <button
                                onClick={() => { setLanguage('id'); setIsLangDropdownOpen(false); }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    textAlign: 'left',
                                    background: language === 'id' ? '#eff6ff' : 'transparent',
                                    color: language === 'id' ? '#2563eb' : '#374151',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }}
                            >
                                <FlagID style={{ width: '20px', height: '14px', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                                <span>Indonesia</span>
                                {language === 'id' && (
                                    <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
                                )}
                            </button>
                            <button
                                onClick={() => { setLanguage('en'); setIsLangDropdownOpen(false); }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    textAlign: 'left',
                                    background: language === 'en' ? '#eff6ff' : 'transparent',
                                    color: language === 'en' ? '#2563eb' : '#374151',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }}
                            >
                                <FlagUS style={{ width: '20px', height: '14px', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />
                                <span>English</span>
                                {language === 'en' && (
                                    <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <button
                    style={{
                        position: 'relative',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
                    }}
                    onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                >
                    <Bell style={{ width: '20px', height: '20px', color: '#6b7280' }} />
                    <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        border: '2px solid white',
                    }} />
                </button>

                {/* Divider */}
                <div style={{ width: '1px', height: '32px', background: '#e5e7eb' }} />

                {/* User info with dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: isDropdownOpen ? '#f3f4f6' : 'transparent',
                        }}
                        onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
                        }}
                        onMouseOut={(e) => {
                            if (!isDropdownOpen) {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }
                        }}
                    >
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <User style={{ width: '18px', height: '18px', color: '#2563eb' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                                {user?.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                {user?.role}
                            </div>
                        </div>
                        <ChevronDown
                            style={{
                                width: '16px',
                                height: '16px',
                                color: '#6b7280',
                                transition: 'transform 0.2s',
                                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                        />
                    </div>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                minWidth: '180px',
                                background: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
                                border: '1px solid rgba(0, 0, 0, 0.06)',
                                padding: '8px',
                                zIndex: 50,
                            }}
                        >
                            {/* Change Password */}
                            <button
                                onClick={handleChangePassword}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }}
                                onMouseOver={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = '#f0fdf4';
                                    (e.currentTarget as HTMLElement).style.color = '#16a34a';
                                }}
                                onMouseOut={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = '#374151';
                                }}
                            >
                                <Key style={{ width: '18px', height: '18px' }} />
                                <span>{t('topbar.change_password')}</span>
                            </button>

                            {/* Divider */}
                            <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    transition: 'all 0.2s',
                                    textAlign: 'left',
                                }}
                                onMouseOver={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = '#fef2f2';
                                    (e.currentTarget as HTMLElement).style.color = '#dc2626';
                                }}
                                onMouseOut={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = '#374151';
                                }}
                            >
                                <LogOut style={{ width: '18px', height: '18px' }} />
                                <span>{t('topbar.logout')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Topbar;
