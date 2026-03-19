import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Filter as FilterIcon, Grid2X2, HardDrive, Plus, Radio, Rows3, Video } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import CameraLivePlayer from '../components/CameraLivePlayer';
import QueryBuilder, { createGroup, type QueryGroup } from '../components/QueryBuilder';
import { cameraFields, camerasApi, type CameraResponse, type CreateCameraRequest, type UpdateCameraRequest } from '../api/cameras';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';

type CameraFormState = CreateCameraRequest;
type ViewMode = 'list' | 'nvr';

const gridOptions = [1, 4, 9, 16] as const;
const nvrOrderStorageKey = 'nvr-grid-order';

const defaultFormState: CameraFormState = {
    name: '',
    rtsp_url: '',
    enabled: true,
    recording_setting: {
        mode: 'continuous',
        retention_type: 'days',
        retention_value: 7,
    },
};

const CamerasPage: React.FC = () => {
    const { t } = useTranslation('cameras');
    const { t: tGeneral } = useTranslation('general');
    const { success, error } = useToast();

    const [cameras, setCameras] = useState<CameraResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [queryGroup, setQueryGroup] = useState<QueryGroup>(createGroup());
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [gridSlots, setGridSlots] = useState<1 | 4 | 9 | 16>(4);
    const [nvrOrder, setNvrOrder] = useState<string[]>(() => {
        if (typeof window === 'undefined') {
            return [];
        }

        try {
            const stored = window.localStorage.getItem(nvrOrderStorageKey);
            return stored ? JSON.parse(stored) as string[] : [];
        } catch {
            return [];
        }
    });
    const [draggedCameraId, setDraggedCameraId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingCamera, setEditingCamera] = useState<CameraResponse | null>(null);
    const [formState, setFormState] = useState<CameraFormState>(defaultFormState);

    const fetchCameras = useCallback(async () => {
        setIsLoading(true);
        try {
            setCameras(await camerasApi.list());
        } catch {
            error(t('messages.load_failed'));
        } finally {
            setIsLoading(false);
        }
    }, [error, t]);

    useEffect(() => {
        fetchCameras();
    }, [fetchCameras]);

    const filteredCameras = useMemo(() => {
        if (queryGroup.children.length === 0) return cameras;

        const matchesRule = (camera: CameraResponse, field: string, operator: string, value: string): boolean => {
            if (!field || !value) return true;
            const cameraValue = String(resolveField(camera, field)).toLowerCase();
            const filterValue = value.toLowerCase();

            switch (operator) {
                case '=': return cameraValue === filterValue;
                case '!=': return cameraValue !== filterValue;
                case 'contains': return cameraValue.includes(filterValue);
                case 'not_contains': return !cameraValue.includes(filterValue);
                default: return true;
            }
        };

        const matchesGroup = (camera: CameraResponse, group: QueryGroup): boolean => {
            const results = group.children.map((child) => {
                if ('children' in child) return matchesGroup(camera, child as QueryGroup);
                return matchesRule(camera, child.field, child.operator, child.value);
            });
            return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
        };

        return cameras.filter((camera) => matchesGroup(camera, queryGroup));
    }, [cameras, queryGroup]);

    useEffect(() => {
        setNvrOrder((prev) => {
            const known = prev.filter((id) => cameras.some((camera) => camera.id === id));
            const missing = cameras.map((camera) => camera.id).filter((id) => !known.includes(id));
            return [...known, ...missing];
        });
    }, [cameras]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(nvrOrderStorageKey, JSON.stringify(nvrOrder));
        }
    }, [nvrOrder]);

    const orderedFilteredCameras = useMemo(() => {
        const rank = new Map(nvrOrder.map((id, index) => [id, index]));
        return [...filteredCameras].sort((left, right) => {
            const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
            if (leftRank === rightRank) {
                return left.name.localeCompare(right.name);
            }
            return leftRank - rightRank;
        });
    }, [filteredCameras, nvrOrder]);

    const pageSize = viewMode === 'nvr' ? gridSlots : limit;
    const totalPages = Math.max(1, Math.ceil(orderedFilteredCameras.length / pageSize));
    const paginatedCameras = useMemo(
        () => orderedFilteredCameras.slice((page - 1) * pageSize, page * pageSize),
        [orderedFilteredCameras, page, pageSize]
    );

    const openCreateModal = useCallback(() => {
        setEditingCamera(null);
        setFormState(defaultFormState);
        setShowModal(true);
    }, []);

    const openEditModal = useCallback((camera: CameraResponse) => {
        setEditingCamera(camera);
        setFormState({
            name: camera.name,
            rtsp_url: camera.rtsp_url,
            enabled: camera.enabled,
            recording_setting: {
                mode: camera.recording_setting.mode,
                retention_type: camera.recording_setting.retention_type,
                retention_value: camera.recording_setting.retention_value,
            },
        });
        setShowModal(true);
    }, []);

    const handleSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            if (editingCamera) {
                await camerasApi.update(editingCamera.id, formState as UpdateCameraRequest);
                success(t('messages.updated'));
            } else {
                await camerasApi.create(formState);
                success(t('messages.created'));
            }
            setShowModal(false);
            fetchCameras();
        } catch {
            error(editingCamera ? t('messages.update_failed') : t('messages.create_failed'));
        }
    }, [editingCamera, error, fetchCameras, formState, success, t]);

    const handleDelete = useCallback(async (camera: CameraResponse) => {
        if (!window.confirm(t('messages.delete_confirm', { name: camera.name }))) return;
        try {
            await camerasApi.delete(camera.id);
            success(t('messages.deleted'));
            fetchCameras();
        } catch {
            error(t('messages.delete_failed'));
        }
    }, [error, fetchCameras, success, t]);

    const handleToggleEnabled = useCallback(async (camera: CameraResponse) => {
        try {
            await camerasApi.update(camera.id, {
                name: camera.name,
                rtsp_url: camera.rtsp_url,
                enabled: !camera.enabled,
                recording_setting: camera.recording_setting,
            });
            success(!camera.enabled ? t('messages.enabled') : t('messages.disabled'));
            fetchCameras();
        } catch {
            error(t('messages.toggle_failed'));
        }
    }, [error, fetchCameras, success, t]);

    const handleQueryGroupChange = useCallback((nextGroup: QueryGroup) => {
        setQueryGroup(nextGroup);
        setPage(1);
    }, []);

    const handleGridDrop = useCallback((draggedId: string | null, targetCameraId: string) => {
        if (!draggedId || draggedId === targetCameraId) {
            setDraggedCameraId(null);
            return;
        }

        setNvrOrder((prev) => {
            const next = [...prev];
            const draggedIndex = next.indexOf(draggedId);
            const targetIndex = next.indexOf(targetCameraId);

            if (draggedIndex === -1 || targetIndex === -1) {
                return prev;
            }

            next.splice(draggedIndex, 1);
            next.splice(targetIndex, 0, draggedId);
            return next;
        });

        setDraggedCameraId(null);
    }, []);

    const columns = useMemo<Column<CameraResponse>[]>(() => [
        {
            key: 'name',
            label: tGeneral('columns.name'),
            sortable: true,
            render: (camera) => (
                <Link to={`/cameras/${camera.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: '#0f172a' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: 'linear-gradient(135deg, #0f766e, #0ea5e9)', display: 'grid', placeItems: 'center', color: 'white' }}>
                        <Camera size={18} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700 }}>{camera.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{camera.rtsp_url}</div>
                    </div>
                </Link>
            ),
        },
        {
            key: 'enabled',
            label: t('status.enabled'),
            sortable: true,
            render: (camera) => (
                <button type="button" onClick={() => handleToggleEnabled(camera)} style={{ padding: '6px 12px', borderRadius: '999px', border: '1px solid', borderColor: camera.enabled ? '#86efac' : '#fecaca', background: camera.enabled ? '#f0fdf4' : '#fef2f2', color: camera.enabled ? '#166534' : '#b91c1c', cursor: 'pointer', fontWeight: 600 }}>
                    {camera.enabled ? t('status.enabled') : t('status.disabled')}
                </button>
            ),
        },
        {
            key: 'runtime_status.state',
            label: t('status.health'),
            sortable: true,
            render: (camera) => <StatusPill state={camera.runtime_status.state} label={t(`health.${camera.runtime_status.state}`)} />,
        },
        {
            key: 'recording_setting.retention_type',
            label: t('retention.title'),
            sortable: true,
            render: (camera) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <HardDrive size={16} color="#475569" />
                    <span>{camera.recording_setting.retention_value} {camera.recording_setting.retention_type === 'days' ? t('retention.days_label') : t('retention.size_label')}</span>
                </div>
            ),
        },
        {
            key: 'created_at',
            label: tGeneral('columns.created_at'),
            sortable: true,
            render: (camera) => new Date(camera.created_at).toLocaleString(),
        },
    ], [handleToggleEnabled, t, tGeneral]);

    return (
        <div>
            <section style={{ padding: '24px', borderRadius: '24px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(15,118,110,0.14), rgba(14,165,233,0.10))', border: '1px solid rgba(14,165,233,0.16)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.8)', color: '#155e75', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}>
                            <Radio size={14} /> {t('eyebrow')}
                        </div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>{t('title')}</h1>
                        <p style={{ margin: 0, color: '#475569' }}>{t('subtitle', { count: String(filteredCameras.length) })}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setShowFilters((prev) => !prev)} style={secondaryButton(showFilters)}><FilterIcon size={18} /> {tGeneral('button.filters')}</button>
                        <button type="button" onClick={openCreateModal} style={primaryButton}><Plus size={18} /> {t('add_camera')}</button>
                    </div>
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => { setViewMode('list'); setPage(1); }} style={viewButton(viewMode === 'list')}>
                        <Rows3 size={17} /> {t('view.list')}
                    </button>
                    <button type="button" onClick={() => { setViewMode('nvr'); setPage(1); }} style={viewButton(viewMode === 'nvr')}>
                        <Grid2X2 size={17} /> {t('view.nvr')}
                    </button>
                </div>
                {viewMode === 'nvr' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {gridOptions.map((option) => (
                            <button key={option} type="button" onClick={() => { setGridSlots(option); setPage(1); }} style={slotButton(gridSlots === option)}>
                                {option}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {showFilters && (
                <div style={cardStyle}>
                    <QueryBuilder value={queryGroup} onChange={handleQueryGroupChange} fields={cameraFields} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button type="button" onClick={() => setPage(1)} style={solidButton('#0f766e')}>{tGeneral('button.apply_filters')}</button>
                        <button type="button" onClick={() => { setQueryGroup(createGroup()); setPage(1); }} style={outlineButton}>{tGeneral('button.clear_all')}</button>
                    </div>
                </div>
            )}

            {viewMode === 'list' ? (
                <DataTable
                    data={paginatedCameras}
                    columns={columns}
                    keyField="id"
                    tableId="cameras"
                    module="camera-list"
                    isLoading={isLoading}
                    emptyMessage={t('empty')}
                    showPagination={true}
                    total={orderedFilteredCameras.length}
                    page={page}
                    limit={limit}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1); }}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    showColumnToggle={true}
                    enableColumnReorder={true}
                    enableColumnResize={true}
                />
            ) : (
                <>
                    <div style={gridLayout(gridSlots)}>
                        {paginatedCameras.map((camera) => (
                            <article
                                key={camera.id}
                                style={{ ...nvrCardStyle, outline: draggedCameraId === camera.id ? '2px solid #0ea5e9' : 'none' }}
                                draggable={true}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', camera.id);
                                    setDraggedCameraId(camera.id);
                                }}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const draggedId = event.dataTransfer.getData('text/plain') || draggedCameraId;
                                    handleGridDrop(draggedId, camera.id);
                                }}
                                onDragEnd={() => setDraggedCameraId(null)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                        <Link to={`/cameras/${camera.id}`} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 800 }}>{camera.name}</Link>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{camera.rtsp_url}</div>
                                    </div>
                                    <StatusPill state={camera.runtime_status.state} label={t(`health.${camera.runtime_status.state}`)} />
                                </div>

                                <div style={{ minHeight: gridSlots >= 9 ? '190px' : '260px', marginBottom: '12px' }}>
                                    <CameraLivePlayer
                                        cameraId={camera.id}
                                        controls={false}
                                        autoPlay={true}
                                        muted={true}
                                        preferLowLatency={false}
                                        emptyLabel={t('view.live_empty')}
                                        errorLabel={t('view.live_unavailable')}
                                        style={{ minHeight: gridSlots >= 9 ? '190px' : '260px' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '13px', fontWeight: 600 }}>
                                        <Video size={15} /> {t('view.live_badge')}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => handleToggleEnabled(camera)} style={miniPill(camera.enabled)}>
                                            {camera.enabled ? t('status.enabled') : t('status.disabled')}
                                        </button>
                                        <Link to={`/cameras/${camera.id}`} style={miniLinkStyle}>{t('view.open_detail')}</Link>
                                    </div>
                                </div>
                            </article>
                        ))}

                        {paginatedCameras.length === 0 && (
                            <div style={{ ...cardStyle, gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>{t('empty')}</div>
                        )}
                    </div>

                    <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ color: '#475569', fontWeight: 600 }}>{t('view.page_summary', { page: String(page), total: String(totalPages) })}</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} style={pagerButton(page <= 1)}>{t('view.previous')}</button>
                            <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} style={pagerButton(page >= totalPages)}>{t('view.next')}</button>
                        </div>
                    </div>
                </>
            )}

            {showModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>{editingCamera ? t('edit_camera') : t('add_camera')}</h2>
                                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px' }}>{t('form.subtitle')}</p>
                            </div>
                            <button type="button" onClick={() => setShowModal(false)} style={ghostButton}>x</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="camera-name" style={labelStyle}>{tGeneral('columns.name')}</label>
                                <input id="camera-name" required value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label htmlFor="camera-rtsp-url" style={labelStyle}>{t('fields.rtsp_url')}</label>
                                <input id="camera-rtsp-url" required value={formState.rtsp_url} onChange={(event) => setFormState((prev) => ({ ...prev, rtsp_url: event.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label htmlFor="camera-retention-type" style={labelStyle}>{t('retention.type')}</label>
                                    <select id="camera-retention-type" value={formState.recording_setting.retention_type} onChange={(event) => setFormState((prev) => ({ ...prev, recording_setting: { ...prev.recording_setting, retention_type: event.target.value as 'days' | 'size' } }))} style={inputStyle}>
                                        <option value="days">{t('retention.days')}</option>
                                        <option value="size">{t('retention.size')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="camera-retention-value" style={labelStyle}>{t('retention.value')}</label>
                                    <input id="camera-retention-value" type="number" min={1} value={formState.recording_setting.retention_value} onChange={(event) => setFormState((prev) => ({ ...prev, recording_setting: { ...prev.recording_setting, retention_value: Number(event.target.value) } }))} style={inputStyle} />
                                </div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: '#334155', fontWeight: 500 }}>
                                <input type="checkbox" checked={formState.enabled} onChange={(event) => setFormState((prev) => ({ ...prev, enabled: event.target.checked }))} />
                                {t('form.enabled_help')}
                            </label>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={outlineButton}>{tGeneral('button.cancel')}</button>
                                <button type="submit" style={primaryButton}>{tGeneral('button.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

function resolveField(camera: CameraResponse, field: string): string | boolean | number {
    return field.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && part in current) {
            return (current as Record<string, unknown>)[part];
        }
        return '';
    }, camera) as string | boolean | number;
}

const StatusPill: React.FC<{ state: string; label: string }> = ({ state, label }) => {
    const styles: Record<string, { background: string; color: string }> = {
        online: { background: '#dcfce7', color: '#166534' },
        offline: { background: '#fef2f2', color: '#b91c1c' },
        stopped: { background: '#e2e8f0', color: '#334155' },
        error: { background: '#fef3c7', color: '#92400e' },
    };
    const palette = styles[state] ?? styles.offline;
    return <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', background: palette.background, color: palette.color }}>{label}</span>;
};

const gridLayout = (slots: 1 | 4 | 9 | 16): React.CSSProperties => ({
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: slots === 1 ? '1fr' : slots === 4 ? 'repeat(2, minmax(0, 1fr))' : slots === 9 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
});

const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '18px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(15, 23, 42, 0.06)', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' };
const nvrCardStyle: React.CSSProperties = { background: 'white', borderRadius: '22px', padding: '18px', border: '1px solid rgba(15, 23, 42, 0.06)', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', color: '#334155', fontSize: '13px', fontWeight: 700 };
const primaryButton: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 18px', background: 'linear-gradient(135deg, #0f766e, #0ea5e9)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' };
const outlineButton: React.CSSProperties = { padding: '11px 18px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 };
const solidButton = (color: string): React.CSSProperties => ({ padding: '10px 16px', background: color, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 });
const secondaryButton = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 18px', background: active ? '#ecfeff' : 'white', color: active ? '#155e75' : '#334155', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' });
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: '20px', zIndex: 60 };
const modalCardStyle: React.CSSProperties = { width: 'min(580px, 100%)', background: 'white', borderRadius: '24px', padding: '28px', boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)' };
const ghostButton: React.CSSProperties = { width: '36px', height: '36px', borderRadius: '999px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b' };
const miniLinkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: '10px', textDecoration: 'none', background: '#e0f2fe', color: '#075985', fontWeight: 700 };
const viewButton = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', background: active ? '#ecfeff' : 'white', color: active ? '#0f766e' : '#334155', cursor: 'pointer', fontWeight: 700 });
const slotButton = (active: boolean): React.CSSProperties => ({ padding: '9px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: active ? '#0f766e' : 'white', color: active ? 'white' : '#334155', cursor: 'pointer', fontWeight: 700 });
const pagerButton = (disabled: boolean): React.CSSProperties => ({ padding: '9px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: disabled ? '#f8fafc' : 'white', color: disabled ? '#94a3b8' : '#334155', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700 });
const miniPill = (active: boolean): React.CSSProperties => ({ padding: '8px 12px', borderRadius: '999px', border: '1px solid', borderColor: active ? '#86efac' : '#fecaca', background: active ? '#f0fdf4' : '#fef2f2', color: active ? '#166534' : '#b91c1c', cursor: 'pointer', fontWeight: 700 });

export default CamerasPage;
