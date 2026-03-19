import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, type UserResponse, type CreateUserRequest, type UpdateUserRequest, userFields } from '../api/users';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';
import { UserPlus, X, Filter as FilterIcon, Check, XCircle, Download, Trash2 } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import QueryBuilder, { createGroup, type QueryGroup } from '../components/QueryBuilder';
import * as XLSX from 'xlsx';

const UsersPage: React.FC = () => {
    const { t } = useTranslation('users');
    const { t: tGeneral } = useTranslation('general');
    const toast = useToast();
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserResponse | null>(null);

    // Filter & Pagination state
    const [showFilters, setShowFilters] = useState(false);
    const [queryGroup, setQueryGroup] = useState<QueryGroup>(createGroup());
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Form state
    const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'user', telegram_id: '', phone_number: '', is_using_otp: false, is_active: true, lang_code: 'en' });

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try { setUsers(await usersApi.getAll()); } catch { toast.error('Failed to load users'); } finally { setIsLoading(false); }
    }, [toast]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Client-side filtering logic
    const matchesRule = (user: UserResponse, rule: { field: string; operator: string; value: string }): boolean => {
        if (!rule.field || !rule.value) return true;
        const fieldValue = String((user as any)[rule.field] || '').toLowerCase();
        const filterValue = rule.value.toLowerCase();
        switch (rule.operator) {
            case '=': return fieldValue === filterValue;
            case '!=': return fieldValue !== filterValue;
            case 'contains': return fieldValue.includes(filterValue);
            case 'not_contains': return !fieldValue.includes(filterValue);
            default: return true;
        }
    };

    const matchesGroup = (user: UserResponse, group: QueryGroup): boolean => {
        const results = group.children.map(child => {
            if (child.type === 'group') return matchesGroup(user, child as QueryGroup);
            return matchesRule(user, child as any);
        });
        return group.logic === 'AND' ? results.every(r => r) : results.some(r => r);
    };

    const applyFilters = (data: UserResponse[]): UserResponse[] => {
        if (queryGroup.children.length === 0) return data;
        return data.filter(user => matchesGroup(user, queryGroup));
    };

    const filteredUsers = applyFilters(users);
    const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(filteredUsers.length / limit);

    const handleApplyFilters = () => setPage(1);
    const handleClearFilters = () => { setQueryGroup(createGroup()); setPage(1); };

    // Mass Actions
    const handleExport = () => {
        const dataToExport = selectedItems.size > 0
            ? filteredUsers.filter(u => selectedItems.has(u.id))
            : filteredUsers;

        const ws = XLSX.utils.json_to_sheet(dataToExport.map(u => ({
            ID: u.id,
            Name: u.name,
            Email: u.email,
            Role: u.role,
            Status: u.is_active ? 'Active' : 'Inactive',
            'OTP Enabled': u.is_using_otp ? 'Yes' : 'No',
            'Telegram ID': u.telegram_id || '-',
            'Phone': u.phone_number || '-'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Users");
        XLSX.writeFile(wb, "users_export.xlsx");
        toast.success(`Exported ${dataToExport.length} users`);
    };

    const handleMassDelete = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedItems.size} users?`)) return;

        let successCount = 0;
        setIsLoading(true);
        try {
            for (const id of selectedItems) {
                await usersApi.delete(id);
                successCount++;
            }
            toast.success(`Successfully deleted ${successCount} users`);
            setSelectedItems(new Set());
            fetchUsers();
        } catch (error) {
            toast.error('Failed to delete some users');
        } finally {
            setIsLoading(false);
        }
    };

    // Columns
    const columns: Column<UserResponse>[] = [
        {
            key: 'name', label: tGeneral('columns.name'), sortable: true,
            render: (user) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    {user.name}
                </div>
            )
        },
        { key: 'email', label: tGeneral('columns.email'), sortable: true },
        {
            key: 'role', label: tGeneral('columns.role'), sortable: true,
            render: (user) => (
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: user.role === 'admin' ? '#ede9fe' : '#e0f2fe', color: user.role === 'admin' ? '#7c3aed' : '#0284c7' }}>
                    {user.role}
                </span>
            )
        },
        {
            key: 'is_active', label: tGeneral('columns.status'), sortable: true,
            render: (user) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user.is_active ? <Check size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
                    <span style={{ color: user.is_active ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                        {user.is_active ? tGeneral('status.active') : tGeneral('status.inactive')}
                    </span>
                </div>
            )
        },
    ];

    // Modal & Actions
    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({ email: '', password: '', name: '', role: 'user', telegram_id: '', phone_number: '', is_using_otp: false, is_active: true, lang_code: 'en' });
        setShowModal(true);
    };

    const openEditModal = (user: UserResponse) => {
        setEditingUser(user);
        setFormData({ email: user.email, password: '', name: user.name, role: user.role, telegram_id: user.telegram_id || '', phone_number: user.phone_number || '', is_using_otp: user.is_using_otp, is_active: user.is_active, lang_code: user.lang_code });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUser) {
                const data: UpdateUserRequest = { ...formData };
                if (!formData.password) delete data.password;
                await usersApi.update(editingUser.id, data);
                toast.success('User updated');
            } else {
                await usersApi.create(formData as CreateUserRequest);
                toast.success('User created');
            }
            setShowModal(false);
            fetchUsers();
        } catch { toast.error(editingUser ? 'Failed to update user' : 'Failed to create user'); }
    };

    const handleDelete = async (user: UserResponse) => {
        if (!confirm(`Deactivate ${user.name}?`)) return;
        try { await usersApi.delete(user.id); toast.success('User deactivated'); fetchUsers(); } catch { toast.error('Failed to deactivate user'); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{t('title')}</h1>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        {t('subtitle')} · {t('users_found', { count: String(filteredUsers.length) })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedItems.size > 0 && (
                        <>
                            <button onClick={handleMassDelete} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#dc2626' }}>
                                <Trash2 size={18} /> Delete ({selectedItems.size})
                            </button>
                            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                                <Download size={18} /> Export
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: showFilters ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: showFilters ? '#2563eb' : '#374151' }}>
                        <FilterIcon size={18} /> {tGeneral('button.filters')}
                    </button>
                    <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                        <UserPlus size={18} /> {t('add_user')}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div style={{ background: 'white', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <QueryBuilder value={queryGroup} onChange={setQueryGroup} fields={userFields} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button onClick={handleApplyFilters} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{tGeneral('button.apply_filters')}</button>
                        <button onClick={handleClearFilters} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }}>{tGeneral('button.clear_all')}</button>
                    </div>
                </div>
            )}

            <DataTable
                data={paginatedUsers}
                columns={columns}
                keyField="id"
                tableId="users"
                module="users-list"
                isLoading={isLoading}
                emptyMessage={tGeneral('datatables.empty_message')}
                showPagination={true}
                total={filteredUsers.length}
                page={page}
                limit={limit}
                totalPages={totalPages}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                onEdit={openEditModal}
                onDelete={handleDelete}
                showColumnToggle={true}
                enableColumnReorder={true}
                enableColumnResize={true}
                enableMultiSelect={true}
                selectedItems={selectedItems}
                onSelectionChange={setSelectedItems}
            />

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{editingUser ? t('edit_user') : t('add_user')}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}><label style={labelStyle}>{tGeneral('columns.name')}</label><input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={inputStyle} /></div>
                            <div style={{ marginBottom: '16px' }}><label style={labelStyle}>{tGeneral('columns.email')}</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required style={inputStyle} /></div>
                            <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Password {editingUser && '(leave blank to keep)'}</label><input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingUser} style={inputStyle} /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div><label style={labelStyle}>{tGeneral('columns.role')}</label>
                                    <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={inputStyle}>
                                        <option value="user">User</option><option value="admin">Admin</option>
                                    </select></div>
                                <div><label style={labelStyle}>{tGeneral('columns.language')}</label>
                                    <select value={formData.lang_code} onChange={(e) => setFormData({ ...formData, lang_code: e.target.value })} style={inputStyle}>
                                        <option value="en">English</option><option value="id">Indonesia</option>
                                    </select></div>
                            </div>
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} /> {tGeneral('status.active')}
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                                    <input type="checkbox" checked={formData.is_using_otp} onChange={(e) => setFormData({ ...formData, is_using_otp: e.target.checked })} /> OTP
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>{tGeneral('button.cancel')}</button>
                                <button type="submit" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>{tGeneral('button.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersPage;
