import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCcw, PlayCircle, Image as ImageIcon, Radio, Trash2, Video } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import CameraSnapshotImage from '../components/CameraSnapshotImage';
import FileVideoPlayer from '../components/FileVideoPlayer';
import CameraLivePlayer from '../components/CameraLivePlayer';
import { camerasApi, formatBytes, type CameraResponse, type RecordingFile } from '../api/cameras';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../contexts/ToastContext';

const CameraDetailPage: React.FC = () => {
    const { id = '' } = useParams();
    const { t } = useTranslation('cameras');
    const { t: tGeneral } = useTranslation('general');
    const { error, success, warning } = useToast();

    const [camera, setCamera] = useState<CameraResponse | null>(null);
    const [recordings, setRecordings] = useState<RecordingFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeRecording, setActiveRecording] = useState<RecordingFile | null>(null);
    const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [snapshotVersion, setSnapshotVersion] = useState(0);

    const load = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [cameraData, recordingData] = await Promise.all([camerasApi.get(id), camerasApi.listRecordings(id)]);
            setCamera(cameraData);
            setRecordings(recordingData);
            setActiveRecording((current) => {
                if (!current) {
                    return null;
                }
                return recordingData.find((recording) => recording.relative_path === current.relative_path) ?? null;
            });
        } catch {
            error(t('messages.detail_failed'));
        } finally {
            setIsLoading(false);
        }
    }, [error, id, t]);

    useEffect(() => {
        load();
    }, [load]);

    const snapshotUrl = useMemo(() => camerasApi.getSnapshotUrl(id, snapshotVersion), [id, snapshotVersion]);
    const playbackUrl = useMemo(() => activeRecording ? camerasApi.getPlaybackUrl(activeRecording.playback_url) : '', [activeRecording]);
    const totalRecordingSize = useMemo(() => recordings.reduce((sum, recording) => sum + recording.size, 0), [recordings]);
    const allRecordingKeys = useMemo(() => recordings.map((recording) => recording.relative_path), [recordings]);
    const selectedRecordingItems = useMemo(
        () => recordings.filter((recording) => selectedRecordings.has(recording.relative_path)),
        [recordings, selectedRecordings]
    );
    const areAllRecordingsSelected = useMemo(
        () => allRecordingKeys.length > 0 && allRecordingKeys.every((key) => selectedRecordings.has(key)),
        [allRecordingKeys, selectedRecordings]
    );

    const handleSelectAllRecordings = useCallback(() => {
        setSelectedRecordings(new Set(allRecordingKeys));
    }, [allRecordingKeys]);

    const handleDeselectAllRecordings = useCallback(() => {
        setSelectedRecordings(new Set());
    }, []);

    const handleDeleteSelectedRecordings = useCallback(async () => {
        if (!id || selectedRecordings.size === 0) {
            return;
        }

        try {
            const result = await camerasApi.deleteRecordings(id, Array.from(selectedRecordings));
            if (activeRecording && selectedRecordings.has(activeRecording.relative_path)) {
                setActiveRecording(null);
            }
            setSelectedRecordings(new Set());
            setShowDeleteModal(false);
            await load();
            success(t('recordings.delete_selected_success', { count: String(result.deleted) }));
            if ((result.skipped?.length ?? 0) > 0) {
                warning(t('recordings.delete_selected_skipped', { count: String(result.skipped?.length ?? 0) }));
            }
        } catch {
            error(t('recordings.delete_selected_failed'));
            return;
        }
    }, [activeRecording, error, id, load, selectedRecordings, success, t, warning]);

    const isRecordingPlayable = useCallback((recording: RecordingFile) => {
        const now = new Date();
        const currentHourlyFilename = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}0000.mp4`;
        return recording.filename !== currentHourlyFilename;
    }, []);

    const columns = useMemo<Column<RecordingFile>[]>(() => [
        { key: 'filename', label: t('recordings.filename'), sortable: true },
        { key: 'timestamp', label: t('recordings.timestamp'), sortable: true, render: (recording) => new Date(recording.timestamp).toLocaleString() },
        { key: 'size', label: t('recordings.size'), sortable: true, render: (recording) => formatBytes(recording.size) },
        {
            key: 'playback_url',
            label: tGeneral('datatables.actions'),
            render: (recording) => {
                const playable = isRecordingPlayable(recording);
                return (
                    <button
                        type="button"
                        onClick={() => playable && setActiveRecording(recording)}
                        disabled={!playable}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: 'none',
                            background: playable ? '#0f766e' : '#cbd5e1',
                            color: playable ? 'white' : '#64748b',
                            cursor: playable ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <PlayCircle size={16} /> {playable ? t('recordings.play') : t('recordings.recording_now')}
                    </button>
                );
            },
        },
    ], [isRecordingPlayable, t, tGeneral]);

    if (!camera && !isLoading) {
        return <div style={{ color: '#64748b' }}>{t('messages.not_found')}</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div>
                    <Link to="/cameras" style={{ display: 'inline-flex', marginBottom: '10px', color: '#0f766e', textDecoration: 'none', fontWeight: 700 }}>{tGeneral('button.back')}</Link>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{camera?.name ?? t('detail.title')}</h1>
                    <p style={{ margin: '6px 0 0', color: '#64748b' }}>{camera?.rtsp_url}</p>
                </div>
                <button type="button" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 700, color: '#334155' }}>
                    <RefreshCcw size={16} /> {t('detail.refresh')}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: '20px', marginBottom: '20px' }}>
                <section style={{ background: 'linear-gradient(180deg, rgba(15,118,110,0.12), rgba(255,255,255,0.98))', borderRadius: '22px', padding: '18px', border: '1px solid rgba(15,118,110,0.14)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{t('detail.snapshot')}</h2>
                        <button type="button" onClick={() => setSnapshotVersion((prev) => prev + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(15,118,110,0.16)', background: 'white', cursor: 'pointer', color: '#0f766e', fontWeight: 700 }}>
                            <ImageIcon size={15} /> {t('detail.refresh_snapshot')}
                        </button>
                    </div>
                    <div style={{ aspectRatio: '16 / 9', borderRadius: '18px', overflow: 'hidden', background: '#0f172a', display: 'grid', placeItems: 'center', marginBottom: '14px' }}>
                        <CameraSnapshotImage
                            src={snapshotUrl}
                            alt={camera?.name ?? t('detail.snapshot')}
                            fallbackLabel={t('detail.live_empty')}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        <Metric label={t('status.health')} value={t(`health.${camera?.runtime_status.state ?? 'offline'}`)} />
                        <Metric label={t('detail.retention')} value={`${camera?.recording_setting.retention_value} ${camera?.recording_setting.retention_type === 'days' ? t('retention.days_label') : t('retention.size_label')}`} />
                        <Metric label={t('detail.recording_size')} value={formatBytes(totalRecordingSize)} />
                        <Metric label={t('detail.restarts')} value={String(camera?.runtime_status.restart_count ?? 0)} />
                    </div>
                </section>

                <div style={{ display: 'grid', gap: '20px' }}>
                    <section style={{ background: 'white', borderRadius: '22px', padding: '18px', border: '1px solid rgba(15, 23, 42, 0.06)', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(15,118,110,0.08)', color: '#0f766e', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>
                                    <Radio size={14} /> {t('detail.live')}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{t('detail.live')}</h2>
                                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px' }}>{t('detail.live_help_low_latency')}</p>
                            </div>
                            <Video size={20} color="#0f766e" />
                        </div>
                        <div style={{ minHeight: '320px' }}>
                            <CameraLivePlayer
                                cameraId={id}
                                controls={true}
                                autoPlay={true}
                                muted={true}
                                preferLowLatency={true}
                                allowFallback={true}
                                emptyLabel={t('detail.live_empty')}
                                errorLabel={t('detail.live_unavailable')}
                                style={{ minHeight: '320px' }}
                            />
                        </div>
                    </section>

                    <section style={{ background: 'white', borderRadius: '22px', padding: '18px', border: '1px solid rgba(15, 23, 42, 0.06)', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{t('detail.player')}</h2>
                                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px' }}>{activeRecording?.filename ?? t('detail.no_recording_selected')}</p>
                            </div>
                            <Video size={20} color="#0f766e" />
                        </div>

                        <div style={{ borderRadius: '18px', overflow: 'hidden', background: '#020617', minHeight: '320px', display: 'grid', placeItems: 'center' }}>
                            {activeRecording ? (
                                <FileVideoPlayer key={activeRecording.relative_path} src={playbackUrl} poster={snapshotUrl} />
                            ) : (
                                <div style={{ color: '#cbd5e1' }}>{t('detail.no_recording_selected')}</div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ color: '#475569', fontWeight: 700 }}>
                    {t('recordings.selected_count', { count: String(selectedRecordings.size) })}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleSelectAllRecordings} disabled={recordings.length === 0 || areAllRecordingsSelected} style={secondaryActionButton(recordings.length === 0 || areAllRecordingsSelected)}>
                        {t('recordings.select_all')}
                    </button>
                    <button type="button" onClick={handleDeselectAllRecordings} disabled={selectedRecordings.size === 0} style={secondaryActionButton(selectedRecordings.size === 0)}>
                        {t('recordings.deselect_all')}
                    </button>
                    <button type="button" onClick={() => setShowDeleteModal(true)} disabled={selectedRecordings.size === 0} style={dangerActionButton(selectedRecordings.size === 0)}>
                        <Trash2 size={16} /> {t('recordings.delete_selected')}
                    </button>
                </div>
            </div>

            <DataTable
                data={recordings}
                columns={columns}
                keyField="relative_path"
                tableId="camera-recordings"
                module="camera-recordings-list"
                isLoading={isLoading}
                emptyMessage={t('recordings.empty')}
                showPagination={false}
                showColumnToggle={true}
                enableColumnReorder={true}
                enableColumnResize={true}
                enableMultiSelect={true}
                selectedItems={selectedRecordings}
                onSelectionChange={setSelectedRecordings}
            />

            {showDeleteModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '22px', color: '#0f172a' }}>{t('recordings.delete_selected')}</h3>
                                <p style={{ margin: '6px 0 0', color: '#64748b' }}>{t('recordings.delete_selected_confirm', { count: String(selectedRecordings.size) })}</p>
                            </div>
                            <button type="button" onClick={() => setShowDeleteModal(false)} style={ghostButton}>x</button>
                        </div>

                        <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#f8fafc', marginBottom: '18px' }}>
                            {selectedRecordingItems.map((recording) => (
                                <div key={recording.relative_path} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{recording.filename}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(recording.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#334155' }}>{formatBytes(recording.size)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" onClick={() => setShowDeleteModal(false)} style={secondaryActionButton(false)}>
                                {tGeneral('button.cancel')}
                            </button>
                            <button type="button" onClick={handleDeleteSelectedRecordings} style={dangerActionButton(false)}>
                                <Trash2 size={16} /> {t('recordings.delete_selected')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: 700 }}>{value}</div>
    </div>
);

const secondaryActionButton = (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: disabled ? '#f8fafc' : 'white',
    color: disabled ? '#94a3b8' : '#334155',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
});

const dangerActionButton = (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1px solid',
    borderColor: disabled ? '#fecaca' : '#ef4444',
    background: disabled ? '#fef2f2' : '#ef4444',
    color: disabled ? '#fca5a5' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
});

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(6px)',
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    zIndex: 60,
};

const modalCardStyle: React.CSSProperties = {
    width: 'min(640px, 100%)',
    background: 'white',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.28)',
};

const ghostButton: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '999px',
    border: '1px solid #e2e8f0',
    background: 'white',
    cursor: 'pointer',
    color: '#64748b',
};

export default CameraDetailPage;
