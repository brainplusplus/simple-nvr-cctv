import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';
import { Filter as FilterIcon, CheckCircle, XCircle, Clock, Loader2, Download } from 'lucide-react';
import { backgroundJobsApi, backgroundJobFields, type BackgroundJob } from '../api/background-jobs';
import type { SearchRequest } from '../types/filters';
import DataTable, { type Column } from '../components/DataTable';
import QueryBuilder, { createGroup, toApiFilterGroup, type QueryGroup } from '../components/QueryBuilder';
import * as XLSX from 'xlsx';

const BackgroundJobsPage: React.FC = () => {
    const { t } = useTranslation('background_jobs');
    const { t: tGeneral } = useTranslation('general');
    const toast = useToast();
    const [jobs, setJobs] = useState<BackgroundJob[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [queryGroup, setQueryGroup] = useState<QueryGroup>(createGroup());
    const [sortField, setSortField] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: 'created_at', direction: 'desc' });

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const request: SearchRequest = { page, limit, sort: [sortField] };
            const apiFilter = toApiFilterGroup(queryGroup);
            if (apiFilter.filters.length > 0) request.filter = apiFilter;

            const result = await backgroundJobsApi.search(request);
            setJobs(result.data || []);
            setTotal(result.total);
            setTotalPages(result.total_pages);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchData(); }, [page, limit, sortField]);

    // Auto-refresh running jobs
    useEffect(() => {
        const hasRunning = jobs.some(j => j.status === 'started');
        if (hasRunning) {
            const interval = setInterval(fetchData, 5000);
            return () => clearInterval(interval);
        }
    }, [jobs]);

    // Handlers
    const handleApplyFilters = () => { setPage(1); fetchData(); };
    const handleClearFilters = () => { setQueryGroup(createGroup()); setPage(1); fetchData(); };
    const handleSort = (field: string) => {
        setSortField(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleExport = () => {
        const dataToExport = selectedItems.size > 0
            ? jobs.filter(j => selectedItems.has(j.id))
            : jobs;

        const ws = XLSX.utils.json_to_sheet(dataToExport.map(j => ({
            ID: j.id,
            Type: j.type,
            TriggeredBy: j.triggered_by,
            Status: j.status,
            Progress: `${j.total_progress_page}/${j.total_page}`,
            Started: j.started_at ? new Date(j.started_at).toLocaleString() : '-',
            Finished: j.finished_at ? new Date(j.finished_at).toLocaleString() : '-',
            Error: j.error_message || '-'
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Background Jobs");
        XLSX.writeFile(wb, "background_jobs_export.xlsx");
        toast.success(`Exported ${dataToExport.length} jobs`);
    };

    // Columns
    const columns: Column<BackgroundJob>[] = [
        {
            key: 'type', label: t('columns.type'), sortable: true, width: 180,
            render: (item) => (
                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: '#f3f4f6', color: '#374151', textTransform: 'capitalize' }}>
                    {item.type.replace(/_/g, ' ')}
                </span>
            )
        },
        {
            key: 'status', label: t('columns.status'), sortable: true, width: 140,
            render: (item) => {
                const config = {
                    started: { icon: Loader2, color: '#3b82f6', bg: '#dbeafe', label: t('status.started') },
                    finished: { icon: CheckCircle, color: '#16a34a', bg: '#dcfce7', label: t('status.finished') },
                    error: { icon: XCircle, color: '#dc2626', bg: '#fef2f2', label: t('status.error') },
                    expired: { icon: Clock, color: '#f59e0b', bg: '#fef3c7', label: t('status.expired') },
                }[item.status] || { icon: Clock, color: '#9ca3af', bg: '#f3f4f6', label: item.status };
                const Icon = config.icon;
                return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 500, background: config.bg, color: config.color }}>
                        <Icon size={14} className={item.status === 'started' ? 'animate-spin' : ''} /> {config.label}
                    </span>
                );
            }
        },
        {
            key: 'triggered_by', label: t('columns.triggered_by'), sortable: true, width: 120,
            render: (item) => (
                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', background: item.triggered_by === 'button' ? '#f3f4f6' : '#fef3c7', color: item.triggered_by === 'button' ? '#374151' : '#92400e' }}>
                    {item.triggered_by}
                </span>
            )
        },
        {
            key: 'total_progress_page', label: t('columns.progress'), sortable: true, width: 220,
            render: (item) => {
                const pct = item.total_page > 0 ? Math.round((item.total_progress_page / item.total_page) * 100) : 0;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: item.status === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '40px' }}>{pct}%</span>
                    </div>
                );
            }
        },
        { key: 'started_at', label: t('columns.started_at'), sortable: true, render: (item) => item.started_at ? new Date(item.started_at).toLocaleString() : '-' },
        { key: 'finished_at', label: t('columns.finished_at'), sortable: true, render: (item) => item.finished_at ? new Date(item.finished_at).toLocaleString() : '-' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{t('title')}</h1>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        {t('subtitle')} · {t('records_found', { count: String(total) })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedItems.size > 0 && (
                        <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                            <Download size={18} /> Export ({selectedItems.size})
                        </button>
                    )}
                    <button onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: showFilters ? '#eff6ff' : 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', color: showFilters ? '#2563eb' : '#374151' }}>
                        <FilterIcon size={18} /> {tGeneral('button.filters')}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div style={{ background: 'white', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <QueryBuilder value={queryGroup} onChange={setQueryGroup} fields={backgroundJobFields} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button onClick={handleApplyFilters} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{tGeneral('button.apply_filters')}</button>
                        <button onClick={handleClearFilters} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }}>{tGeneral('button.clear_all')}</button>
                    </div>
                </div>
            )}

            <DataTable
                data={jobs}
                columns={columns}
                keyField="id"
                tableId="background-jobs"
                module="background-jobs-list"
                isLoading={isLoading}
                emptyMessage={t('empty_message')}
                showPagination={true}
                total={total}
                page={page}
                limit={limit}
                totalPages={totalPages}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
                sortField={sortField}
                onSort={handleSort}
                showColumnToggle={true}
                enableColumnReorder={true}
                enableColumnResize={true}
                enableMultiSelect={true}
                selectedItems={selectedItems}
                onSelectionChange={setSelectedItems}
            />

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default BackgroundJobsPage;
