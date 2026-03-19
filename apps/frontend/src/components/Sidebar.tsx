import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ChevronLeft, ChevronRight, Users, Clock, X, ChevronDown, Database, Activity, Camera } from 'lucide-react';
import { useAuth } from '../store/auth-context';

import { useTranslation } from '../hooks/useTranslation';

const appName = import.meta.env.VITE_APP_NAME || 'SaaS Admin';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    isMobile?: boolean;
    isMobileMenuOpen?: boolean;
    onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    collapsed,
    onToggle,
    isMobile = false,
    isMobileMenuOpen = false,
    onMobileClose
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { t } = useTranslation('sidebar');
    const location = useLocation();
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    interface NavItemConfig {
        id?: string;
        to?: string;
        icon: React.ElementType;
        label: string;
        adminOnly?: boolean;
        children?: NavItemConfig[];
    }

    const allNavItems: NavItemConfig[] = useMemo(() => [
        { to: '/', icon: LayoutDashboard, label: t('dashboard'), adminOnly: false },
        {
            id: 'data_management',
            icon: Database,
            label: t('data_management'),
            adminOnly: false,
            children: [
                { to: '/users', icon: Users, label: t('users'), adminOnly: true },
            ]
        },
        {
            id: 'system_monitoring',
            icon: Activity,
            label: t('system_monitoring'),
            adminOnly: false,
            children: [
                { to: '/cameras', icon: Camera, label: t('cameras'), adminOnly: false },
                { to: '/background-jobs', icon: Clock, label: t('background_jobs'), adminOnly: false },
            ]
        }
    ], [t]);

    useEffect(() => {
        // Auto-expand groups based on current location
        const parentGroup = allNavItems.find(item =>
            item.children?.some(child => child.to === location.pathname)
        );
        if (parentGroup && parentGroup.id && !expandedGroups.includes(parentGroup.id)) {
            setExpandedGroups(prev => [...prev, parentGroup.id!]);
        }
    }, [allNavItems, expandedGroups, location.pathname]);

    const toggleGroup = (groupId: string) => {
        if (collapsed && !isMobile) {
            onToggle();
            // Ensure the clicked group is expanded when opening
            if (!expandedGroups.includes(groupId)) {
                setExpandedGroups(prev => [...prev, groupId]);
            }
            return;
        }

        setExpandedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    // Filter nav items based on user role
    const navItems = allNavItems.map(item => {
        if (item.children) {
            return {
                ...item,
                children: item.children.filter(child => !child.adminOnly || isAdmin)
            };
        }
        return item;
    }).filter(item => {
        if (item.children) {
            return item.children.length > 0 && (!item.adminOnly || isAdmin);
        }
        return !item.adminOnly || isAdmin;
    });

    // Calculate sidebar width and visibility for mobile
    const getSidebarStyle = (): React.CSSProperties => {
        if (isMobile) {
            return {
                position: 'fixed',
                left: 0,
                top: 0,
                height: '100vh',
                width: '280px',
                background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 50%, #172554 100%)',
                transition: 'transform 0.3s ease',
                zIndex: 45,
                boxShadow: isMobileMenuOpen ? '4px 0 24px rgba(30, 64, 175, 0.3)' : 'none',
                transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
            };
        }
        return {
            position: 'fixed',
            left: 0,
            top: 0,
            height: '100vh',
            width: collapsed ? '80px' : '260px',
            background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 50%, #172554 100%)',
            transition: 'width 0.3s ease',
            zIndex: 40,
            boxShadow: '4px 0 24px rgba(30, 64, 175, 0.3)',
        };
    };

    // Show expanded view on mobile or when not collapsed on desktop
    const showExpanded = isMobile || !collapsed;

    return (
        <aside style={getSidebarStyle()}>
            {/* Logo */}
            <div style={{
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: showExpanded ? 'space-between' : 'center',
                padding: showExpanded ? '0 16px' : '0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
                {showExpanded && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                            src="/assets/images/logo_small.svg"
                            alt="Logo"
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                objectFit: 'contain',
                            }}
                        />
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{appName}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(147, 197, 253, 0.8)', marginTop: '-2px' }}>Enterprise</div>
                        </div>
                    </div>
                )}
                {isMobile ? (
                    <button
                        type="button"
                        onClick={onMobileClose}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(147, 197, 253, 0.8)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <X size={20} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onToggle}
                        onFocus={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
                            (e.target as HTMLElement).style.color = 'white';
                        }}
                        onBlur={(e) => {
                            (e.target as HTMLElement).style.background = 'transparent';
                            (e.target as HTMLElement).style.color = 'rgba(147, 197, 253, 0.8)';
                        }}
                        style={{
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(147, 197, 253, 0.8)',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
                            (e.target as HTMLElement).style.color = 'white';
                        }}
                        onMouseOut={(e) => {
                            (e.target as HTMLElement).style.background = 'transparent';
                            (e.target as HTMLElement).style.color = 'rgba(147, 197, 253, 0.8)';
                        }}
                    >
                        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ marginTop: '24px', padding: '0 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                {navItems.map((item) => {
                    if (item.children) {
                        const isExpanded = expandedGroups.includes(item.id!);
                        const hasActiveChild = item.children.some(child => child.to === location.pathname);

                        return (
                            <div key={item.id} style={{ marginBottom: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(item.id!)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: showExpanded ? '12px 16px' : '12px',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        justifyContent: showExpanded ? 'space-between' : 'center',
                                        color: hasActiveChild ? 'white' : 'rgba(191, 219, 254, 0.9)',
                                        background: hasActiveChild ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                        transition: 'all 0.2s',
                                        border: 'none',
                                        width: '100%',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <item.icon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                                        {showExpanded && (
                                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                                        )}
                                    </div>
                                    {showExpanded && (
                                        <ChevronDown size={16} style={{
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s'
                                        }} />
                                    )}
                                </button>

                                {isExpanded && showExpanded && (
                                    <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                                        {item.children.map(child => (
                                            <NavLink
                                                key={child.to}
                                                to={child.to!}
                                                onClick={() => {
                                                    if (isMobile && onMobileClose) {
                                                        onMobileClose();
                                                    }
                                                }}
                                                style={({ isActive }) => ({
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '10px 16px',
                                                    marginBottom: '4px',
                                                    borderRadius: '12px',
                                                    textDecoration: 'none',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.95em',
                                                    background: isActive
                                                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)'
                                                        : 'transparent',
                                                    color: isActive ? 'white' : 'rgba(191, 219, 254, 0.7)',
                                                    boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                                                })}
                                            >
                                                <child.icon style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                                                <span style={{ fontSize: '13px', fontWeight: 500 }}>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to!}
                            onClick={() => {
                                if (isMobile && onMobileClose) {
                                    onMobileClose();
                                }
                            }}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: showExpanded ? '12px 16px' : '12px',
                                marginBottom: '8px',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                justifyContent: showExpanded ? 'flex-start' : 'center',
                                background: isActive
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)'
                                    : 'transparent',
                                color: isActive ? 'white' : 'rgba(191, 219, 254, 0.9)',
                                boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                            })}
                        >
                            <item.icon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                            {showExpanded && (
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.label}</span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Help box */}
            {showExpanded && (
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '12px',
                    right: '12px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            animation: 'pulse 2s infinite',
                        }} />
                        <span style={{ fontSize: '12px', color: 'rgba(147, 197, 253, 0.9)', fontWeight: 500 }}>
                            System Online
                        </span>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
