import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings2, Trash2, Pencil, GripVertical, RotateCcw, Check, Square } from 'lucide-react';
import { getTableSettings, saveTableSettings, deleteTableSettings } from '../api/table-settings';
import type { TableSettingValues } from '../api/table-settings';
import { useTranslation } from '../hooks/useTranslation';

// Column definition
export interface Column<T> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    width?: number; // Initial width in pixels
    minWidth?: number; // Minimum width
    render?: (item: T, value: unknown) => React.ReactNode;
}

// DataTable props
export interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    tableId: string; // Table identifier for persistence
    module: string;  // Required: unique module identifier for DB persistence
    isLoading?: boolean;
    emptyMessage?: string;
    // Pagination
    showPagination?: boolean;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    // Sorting
    sortField?: { field: string; direction: 'asc' | 'desc' };
    onSort?: (field: string) => void;
    // Column visibility
    showColumnToggle?: boolean;
    // Column reorder & resize
    enableColumnReorder?: boolean;
    enableColumnResize?: boolean;
    // Text overflow handling (default, can be changed by user)
    defaultTextOverflow?: 'ellipsis' | 'wrap';
    // Multi-select (checkbox support)
    enableMultiSelect?: boolean;
    selectedItems?: Set<string>; // Set of selected item keys
    onSelectionChange?: (selectedItems: Set<string>) => void;
    // Actions
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
}

const rowsPerPageOptions = [10, 20, 50, 100];
const MIN_COL_WIDTH = 50;  // Low minimum to allow free resizing
const SAVE_DEBOUNCE_MS = 1000; // Debounce save to API

// Export Ref interface for parent components
export interface DataTableRef {
    getVisibleColumns: () => string[];
    getColumnOrder: () => string[];
}

// Internal component for forwardRef with generics
function DataTableInner<T extends Record<string, any>>(
    props: DataTableProps<T>,
    ref: React.Ref<DataTableRef>
) {
    const {
        data,
        columns,
        keyField,
        tableId,
        module,
        isLoading = false,
        emptyMessage,
        showPagination = true,
        total = 0,
        page = 1,
        limit = 20,
        totalPages = 1,
        onPageChange,
        onLimitChange,
        sortField,
        onSort,
        showColumnToggle = true,
        enableColumnReorder = true,
        enableColumnResize = true,
        defaultTextOverflow = 'ellipsis',
        enableMultiSelect = false,
        selectedItems: externalSelectedItems,
        onSelectionChange,
        onEdit,
        onDelete,
    } = props;

    // Normalize data to empty array if null/undefined
    const safeData = data ?? [];

    const { t } = useTranslation('table_settings');
    const displayEmptyMessage = emptyMessage || t('empty_message');

    // Default values
    const currentColumnKeys = useMemo(() => columns.map(c => String(c.key)), [columns]);
    const columnKeysSignature = useMemo(() => currentColumnKeys.join('|'), [currentColumnKeys]);
    const columnWidthsSignature = useMemo(
        () => columns.map(col => `${String(col.key)}:${col.width ?? ''}`).join('|'),
        [columns]
    );
    const defaultColumnOrder = useMemo(() => currentColumnKeys, [currentColumnKeys]);
    const defaultVisibleColumns = useMemo(() => currentColumnKeys, [currentColumnKeys]);
    const defaultColumnWidths = useMemo(() => {
        const widths: Record<string, number | undefined> = {};
        columns.forEach(col => {
            widths[String(col.key)] = col.width;
        });
        return widths;
    }, [columns]);

    // State for settings
    const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumnOrder);
    const [columnWidths, setColumnWidths] = useState<Record<string, number | undefined>>(defaultColumnWidths);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
    const [textOverflow, setTextOverflow] = useState<'ellipsis' | 'wrap'>(defaultTextOverflow);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Expose internal state to parent via ref
    React.useImperativeHandle(ref, () => ({
        getVisibleColumns: () => visibleColumns,
        getColumnOrder: () => columnOrder
    }));

    // Multi-select state (internal if not controlled externally)
    const [internalSelectedItems, setInternalSelectedItems] = useState<Set<string>>(new Set());
    const selectedItems = externalSelectedItems ?? internalSelectedItems;
    const isControlled = externalSelectedItems !== undefined;

    // Selection handlers
    const handleSelectionChange = useCallback((newSelection: Set<string>) => {
        if (isControlled) {
            onSelectionChange?.(newSelection);
        } else {
            setInternalSelectedItems(newSelection);
            onSelectionChange?.(newSelection);
        }
    }, [isControlled, onSelectionChange]);

    const handleToggleItem = useCallback((key: string) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(key)) {
            newSelection.delete(key);
        } else {
            newSelection.add(key);
        }
        handleSelectionChange(newSelection);
    }, [selectedItems, handleSelectionChange]);

    const handleToggleAll = useCallback(() => {
        const allKeys = new Set(safeData.map(item => String(item[keyField])));
        // Check if all VISIBLE items are selected (not the other way around)
        const allSelected = allKeys.size > 0 && Array.from(allKeys).every(key => selectedItems.has(key));
        if (allSelected) {
            // Deselect all visible items
            const newSelection = new Set(selectedItems);
            allKeys.forEach(key => newSelection.delete(key));
            handleSelectionChange(newSelection);
        } else {
            // Select all visible items
            const newSelection = new Set(selectedItems);
            allKeys.forEach(key => newSelection.add(key));
            handleSelectionChange(newSelection);
        }
    }, [safeData, keyField, selectedItems, handleSelectionChange]);

    // Check if all visible items are selected
    const isAllSelected = useMemo(() => {
        const visibleKeys = new Set(safeData.map(item => String(item[keyField])));
        if (visibleKeys.size === 0) return false;
        return Array.from(visibleKeys).every(key => selectedItems.has(key));
    }, [safeData, keyField, selectedItems]);

    // Check if some (but not all) visible items are selected
    const isSomeSelected = useMemo(() => {
        const visibleKeys = new Set(safeData.map(item => String(item[keyField])));
        const selectedCount = Array.from(visibleKeys).filter(key => selectedItems.has(key)).length;
        return selectedCount > 0 && selectedCount < visibleKeys.size;
    }, [safeData, keyField, selectedItems]);

    // Drag state for reordering
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // Ref to track if initial load is done (for debounced save)
    const isInitialLoad = useRef(true);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load settings from API on mount
    useEffect(() => {
        let cancelled = false;

        const loadFromAPI = async () => {
            try {
                const setting = await getTableSettings(module);
                if (cancelled) return;

                if (setting?.values) {
                    const values = setting.values as TableSettingValues;
                    const currentColumnKeys = columns.map(c => String(c.key));

                    // Validate columnOrder: keep only keys that exist in current columns, add any missing ones
                    if (values.columnOrder) {
                        const savedOrder = values.columnOrder;
                        const validOrder = savedOrder.filter(key => currentColumnKeys.includes(key));
                        const newColumns = currentColumnKeys.filter(key => !savedOrder.includes(key));
                        // If saved order has no valid columns, use defaults
                        if (validOrder.length === 0) {
                            setColumnOrder(defaultColumnOrder);
                        } else {
                            setColumnOrder([...validOrder, ...newColumns]);
                        }
                    }

                    // Validate visibleColumns: keep only keys that exist in current columns
                    if (values.visibleColumns) {
                        const validVisible = values.visibleColumns.filter(key => currentColumnKeys.includes(key));
                        // If no valid columns saved, show all columns (use defaults)
                        if (validVisible.length === 0) {
                            setVisibleColumns(defaultVisibleColumns);
                        } else {
                            setVisibleColumns(validVisible);
                        }
                    }

                    // Validate columnWidths: keep only keys that exist in current columns
                    if (values.columnWidths) {
                        const validWidths: Record<string, number | undefined> = {};
                        Object.entries(values.columnWidths).forEach(([key, width]) => {
                            if (currentColumnKeys.includes(key)) {
                                validWidths[key] = width;
                            }
                        });
                        // Merge with defaults for any columns without saved widths
                        setColumnWidths({ ...defaultColumnWidths, ...validWidths });
                    }

                    if (values.textOverflow) setTextOverflow(values.textOverflow);
                }
            } catch (e) {
                console.warn('Failed to load table settings from API:', e);
            } finally {
                if (!cancelled) {
                    setSettingsLoaded(true);
                    // Mark initial load complete after a short delay
                    setTimeout(() => {
                        isInitialLoad.current = false;
                    }, 100);
                }
            }
        };

        loadFromAPI();

        return () => { cancelled = true; };
    }, [module, columnKeysSignature, columnWidthsSignature]);

    // Debounced save to API when settings change (skip initial load)
    useEffect(() => {
        // Skip during initial load
        if (isInitialLoad.current || !settingsLoaded) return;

        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounced save
        saveTimeoutRef.current = setTimeout(async () => {
            const values: TableSettingValues = {
                visibleColumns,
                columnOrder,
                columnWidths,
                textOverflow,
            };

            try {
                await saveTableSettings(module, tableId, values);
            } catch (e) {
                console.warn('Failed to save table settings to API:', e);
            }
        }, SAVE_DEBOUNCE_MS);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [visibleColumns, columnOrder, columnWidths, textOverflow, module, tableId, settingsLoaded]);

    // Reset all settings to defaults and delete from API
    const handleReset = async () => {
        setColumnOrder(defaultColumnOrder);
        setColumnWidths(defaultColumnWidths);
        setVisibleColumns(defaultVisibleColumns);
        setTextOverflow(defaultTextOverflow);

        try {
            await deleteTableSettings(module);
        } catch (e) {
            console.warn('Failed to delete table settings from API:', e);
        }
    };

    const toggleColumn = (columnKey: string) => {
        setVisibleColumns(prev =>
            prev.includes(columnKey)
                ? prev.filter(k => k !== columnKey)
                : [...prev, columnKey]
        );
    };

    const getCellValue = (item: T, key: string): unknown => {
        return (item as Record<string, unknown>)[key];
    };

    const formatCellValue = (value: unknown, key: string): string => {
        if (value === null || value === undefined) return '-';
        // Simple date check/format
        if (key.includes('date') && value) {
            try {
                return new Date(value as string).toLocaleDateString('id-ID');
            } catch {
                return String(value);
            }
        }
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return String(value);
    };

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    // Get columns in display order, filtered by visibility
    const orderedVisibleCols = useMemo(() => {
        return columnOrder
            .filter(key => visibleColumns.includes(key))
            .map(key => columns.find(c => String(c.key) === key))
            .filter((col): col is Column<T> => col !== undefined);
    }, [columnOrder, visibleColumns, columns]);

    const hasActions = onEdit || onDelete;

    // Drag & Drop handlers for column reordering
    const handleDragStart = useCallback((e: React.DragEvent, columnKey: string) => {
        if (!enableColumnReorder) return;
        setDraggedColumn(columnKey);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', columnKey);
    }, [enableColumnReorder]);

    const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
        if (!enableColumnReorder || !draggedColumn) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (columnKey !== draggedColumn) {
            setDragOverColumn(columnKey);
        }
    }, [enableColumnReorder, draggedColumn]);

    const handleDragLeave = useCallback(() => {
        setDragOverColumn(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetKey: string) => {
        if (!enableColumnReorder || !draggedColumn) return;
        e.preventDefault();

        if (draggedColumn !== targetKey) {
            setColumnOrder(prev => {
                const newOrder = [...prev];
                const draggedIndex = newOrder.indexOf(draggedColumn);
                const targetIndex = newOrder.indexOf(targetKey);

                // Remove dragged column and insert at target position
                newOrder.splice(draggedIndex, 1);
                newOrder.splice(targetIndex, 0, draggedColumn);

                return newOrder;
            });
        }

        setDraggedColumn(null);
        setDragOverColumn(null);
    }, [enableColumnReorder, draggedColumn]);

    const handleDragEnd = useCallback(() => {
        setDraggedColumn(null);
        setDragOverColumn(null);
    }, []);

    // Resize handlers - use pageX for scroll-independent tracking
    const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
        if (!enableColumnResize) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.pageX;
        const startWidth = columnWidths[columnKey] || 150; // Default fallback for resize start
        const minWidth = columns.find(c => String(c.key) === columnKey)?.minWidth || MIN_COL_WIDTH;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diff = moveEvent.pageX - startX;
            const newWidth = Math.max(minWidth, startWidth + diff);

            setColumnWidths(prev => ({
                ...prev,
                [columnKey]: newWidth,
            }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [enableColumnResize, columnWidths, columns]);

    const PaginationBar = ({ position }: { position: 'top' | 'bottom' }) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: position === 'bottom' ? '1px solid #f3f4f6' : undefined,
            borderBottom: position === 'top' ? '1px solid #f3f4f6' : undefined,
            flexWrap: 'wrap',
            gap: '12px',
            background: '#fafafa',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>{t('rows_per_page')}:</span>
                <select
                    value={limit}
                    onChange={(e) => onLimitChange?.(Number(e.target.value))}
                    style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        fontSize: '14px',
                        background: 'white',
                    }}
                >
                    {rowsPerPageOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {t('showing_of', {
                    start: ((page - 1) * limit) + 1,
                    end: Math.min(page * limit, total),
                    total: total.toLocaleString()
                })}
            </span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button onClick={() => onPageChange?.(1)} disabled={page === 1} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: page === 1 ? '#d1d5db' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                    <ChevronsLeft style={{ width: '16px', height: '16px' }} />
                </button>
                <button onClick={() => onPageChange?.(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: page === 1 ? '#d1d5db' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                    <ChevronLeft style={{ width: '16px', height: '16px' }} />
                </button>
                {getPageNumbers().map((p, idx) => (
                    typeof p === 'number' ? (
                        <button key={idx} onClick={() => onPageChange?.(p)} style={{ padding: '6px 12px', borderRadius: '6px', border: page === p ? 'none' : '1px solid #e5e7eb', background: page === p ? '#2563eb' : 'white', color: page === p ? 'white' : '#374151', fontSize: '14px', fontWeight: page === p ? 600 : 400, cursor: 'pointer' }}>
                            {p}
                        </button>
                    ) : (
                        <span key={idx} style={{ padding: '0 4px', color: '#9ca3af' }}>...</span>
                    )
                ))}
                <button onClick={() => onPageChange?.(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: page === totalPages ? '#d1d5db' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                    <ChevronRight style={{ width: '16px', height: '16px' }} />
                </button>
                <button onClick={() => onPageChange?.(totalPages)} disabled={page === totalPages} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', color: page === totalPages ? '#d1d5db' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                    <ChevronsRight style={{ width: '16px', height: '16px' }} />
                </button>
            </div>
        </div>
    );

    return (
        <div>
            {/* Column Settings Toggle */}
            {showColumnToggle && (
                <div style={{ marginBottom: '16px' }}>
                    <button
                        onClick={() => setShowColumnSettings(!showColumnSettings)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb',
                            background: showColumnSettings ? '#f3f4f6' : 'white',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        <Settings2 style={{ width: '18px', height: '18px' }} />
                        {t('button_columns')}
                    </button>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: '1px solid #e5e7eb',
                            background: showSettings ? '#f3f4f6' : 'white',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        <Settings2 style={{ width: '18px', height: '18px' }} />
                        {t('button_settings')}
                    </button>
                    <button
                        onClick={handleReset}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: '1px solid #fecaca',
                            background: 'white',
                            color: '#dc2626',
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                        title={t('reset_tooltip')}
                    >
                        <RotateCcw style={{ width: '18px', height: '18px' }} />
                        {t('button_reset')}
                    </button>
                </div>
            )}

            {/* Column Settings Panel */}
            {showColumnSettings && (
                <div style={{
                    background: 'white',
                    borderRadius: '14px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                }}>
                    <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                            {t('visible_columns')}
                        </span>
                        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                            {t('reorder_hint')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {columns.map(col => (
                            <label
                                key={String(col.key)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: visibleColumns.includes(String(col.key)) ? '#eff6ff' : '#f3f4f6',
                                    border: `1px solid ${visibleColumns.includes(String(col.key)) ? '#3b82f6' : '#e5e7eb'}`,
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    color: visibleColumns.includes(String(col.key)) ? '#2563eb' : '#6b7280',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(String(col.key))}
                                    onChange={() => toggleColumn(String(col.key))}
                                    style={{ display: 'none' }}
                                />
                                {/* Since we don't have all translations in boilerplate yet, assume label is translated or simple text */}
                                {t(col.label) === col.label ? col.label : t(col.label)}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div style={{
                    background: 'white',
                    borderRadius: '14px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.04)',
                }}>
                    <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                            {t('table_settings')}
                        </span>
                        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>
                            {t('settings_saved')}
                        </span>
                    </div>

                    {/* Text Overflow Setting */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{t('text_overflow')}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setTextOverflow('ellipsis')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: textOverflow === 'ellipsis' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    background: textOverflow === 'ellipsis' ? '#eff6ff' : 'white',
                                    color: textOverflow === 'ellipsis' ? '#2563eb' : '#6b7280',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                }}
                            >
                                {t('truncate')}
                            </button>
                            <button
                                onClick={() => setTextOverflow('wrap')}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: textOverflow === 'wrap' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    background: textOverflow === 'wrap' ? '#eff6ff' : 'white',
                                    color: textOverflow === 'wrap' ? '#2563eb' : '#6b7280',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                }}
                            >
                                {t('wrap_text')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Container */}
            <div style={{
                background: 'white',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(0, 0, 0, 0.04)',
            }}>
                {isLoading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid #e5e7eb',
                            borderTopColor: '#3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 16px',
                        }} />
                        <p style={{ color: '#6b7280' }}>{t('loading')}</p>
                    </div>
                ) : safeData.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <p style={{ color: '#6b7280' }}>{displayEmptyMessage}</p>
                    </div>
                ) : (
                    <>
                        {showPagination && totalPages > 1 && <PaginationBar position="top" />}

                        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
                            <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                        {enableMultiSelect && (
                                            <th style={{
                                                width: '50px',
                                                minWidth: '50px',
                                                padding: '12px 16px',
                                                textAlign: 'center',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: '#6b7280',
                                                textTransform: 'uppercase',
                                                position: 'sticky',
                                                left: 0,
                                                background: '#f9fafb',
                                                zIndex: 15,
                                            }}>
                                                <button
                                                    onClick={handleToggleAll}
                                                    style={{
                                                        padding: '4px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#6b7280',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                    title={isAllSelected ? 'Deselect all' : 'Select all'}
                                                >
                                                    {isAllSelected ? (
                                                        <Check style={{ width: '18px', height: '18px' }} />
                                                    ) : isSomeSelected ? (
                                                        <div style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            position: 'relative',
                                                        }}>
                                                            <Square style={{ width: '18px', height: '18px', strokeWidth: 1.5 }} />
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '2px',
                                                                left: '2px',
                                                                right: '2px',
                                                                height: '2px',
                                                                background: '#6b7280',
                                                            }} />
                                                        </div>
                                                    ) : (
                                                        <Square style={{ width: '18px', height: '18px', strokeWidth: 1.5 }} />
                                                    )}
                                                </button>
                                            </th>
                                        )}
                                        {/* Row Number Header */}
                                        <th style={{
                                            width: '60px',
                                            minWidth: '60px',
                                            padding: '12px 16px',
                                            textAlign: 'center',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: '#6b7280',
                                            textTransform: 'uppercase',
                                            background: '#f9fafb',
                                            position: enableMultiSelect ? undefined : 'sticky',
                                            left: enableMultiSelect ? undefined : 0,
                                            zIndex: enableMultiSelect ? undefined : 15,
                                        }}>{t('no')}</th>
                                        {orderedVisibleCols.map(col => {
                                            const colKey = String(col.key);
                                            const isDragging = draggedColumn === colKey;
                                            const isDragOver = dragOverColumn === colKey;

                                            return (
                                                <th
                                                    key={colKey}
                                                    draggable={enableColumnReorder}
                                                    onDragStart={(e) => handleDragStart(e, colKey)}
                                                    onDragOver={(e) => handleDragOver(e, colKey)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, colKey)}
                                                    onDragEnd={handleDragEnd}
                                                    style={{
                                                        width: columnWidths[colKey],
                                                        minWidth: MIN_COL_WIDTH,
                                                        maxWidth: columnWidths[colKey],
                                                        padding: '12px 16px',
                                                        textAlign: 'left',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        color: '#6b7280',
                                                        textTransform: 'uppercase',
                                                        cursor: enableColumnReorder ? 'grab' : (col.sortable ? 'pointer' : 'default'),
                                                        whiteSpace: 'nowrap',
                                                        background: isDragOver ? '#dbeafe' : (isDragging ? '#e5e7eb' : '#f9fafb'),
                                                        opacity: isDragging ? 0.5 : 1,
                                                        position: 'relative',
                                                        userSelect: 'none',
                                                        borderLeft: isDragOver ? '3px solid #3b82f6' : 'none',
                                                        transition: 'background 0.15s',
                                                        overflow: 'visible',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {enableColumnReorder && (
                                                            <GripVertical style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0 }} />
                                                        )}
                                                        <span
                                                            onClick={col.sortable && onSort ? () => onSort(colKey) : undefined}
                                                            style={{ cursor: col.sortable ? 'pointer' : 'inherit' }}
                                                        >
                                                            {/* Same assumption for translations */}
                                                            {t(col.label) === col.label ? col.label : t(col.label)}
                                                            {col.sortable && sortField?.field === colKey && (
                                                                <span style={{ marginLeft: '4px' }}>
                                                                    {sortField.direction === 'asc' ? '↑' : '↓'}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>

                                                    {/* Resize Handle */}
                                                    {enableColumnResize && (
                                                        <div
                                                            onMouseDown={(e) => handleResizeStart(e, colKey)}
                                                            style={{
                                                                position: 'absolute',
                                                                right: -3,
                                                                top: 0,
                                                                bottom: 0,
                                                                width: '8px',
                                                                cursor: 'col-resize',
                                                                background: 'transparent',
                                                                zIndex: 20,
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                (e.target as HTMLElement).style.background = 'rgba(59, 130, 246, 0.5)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                (e.target as HTMLElement).style.background = 'transparent';
                                                            }}
                                                        />
                                                    )}
                                                </th>
                                            );
                                        })}
                                        {hasActions && (
                                            <th style={{
                                                padding: '12px 16px',
                                                textAlign: 'center',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: '#6b7280',
                                                textTransform: 'uppercase',
                                                position: 'sticky',
                                                right: 0,
                                                background: '#f9fafb',
                                                boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
                                                width: '100px',
                                            }}>{t('actions')}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeData.map((item, rowIndex) => {
                                        const itemKey = String(item[keyField]);
                                        const isSelected = selectedItems.has(itemKey);
                                        const rowNumber = (page - 1) * limit + rowIndex + 1;
                                        return (
                                            <tr key={itemKey} style={{ borderBottom: '1px solid #f3f4f6', background: isSelected ? '#eff6ff' : 'white' }}>
                                                {enableMultiSelect && (
                                                    <td style={{
                                                        width: '50px',
                                                        minWidth: '50px',
                                                        padding: '14px 16px',
                                                        textAlign: 'center',
                                                        position: 'sticky',
                                                        left: 0,
                                                        background: isSelected ? '#eff6ff' : 'white',
                                                        zIndex: 5,
                                                    }}>
                                                        <button
                                                            onClick={() => handleToggleItem(itemKey)}
                                                            style={{
                                                                padding: '4px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: isSelected ? '#2563eb' : '#d1d5db',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                            title={isSelected ? 'Deselect' : 'Select'}
                                                        >
                                                            {isSelected ? (
                                                                <div style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    background: '#2563eb',
                                                                    borderRadius: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                }}>
                                                                    <Check style={{ width: '14px', height: '14px', color: 'white', strokeWidth: 3 }} />
                                                                </div>
                                                            ) : (
                                                                <Square style={{ width: '18px', height: '18px', strokeWidth: 1.5 }} />
                                                            )}
                                                        </button>
                                                    </td>
                                                )}
                                                {/* Row Number Cell */}
                                                <td style={{
                                                    width: '60px',
                                                    minWidth: '60px',
                                                    padding: '14px 16px',
                                                    textAlign: 'center',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    color: '#6b7280',
                                                    background: isSelected ? '#eff6ff' : 'white',
                                                    position: enableMultiSelect ? undefined : 'sticky',
                                                    left: enableMultiSelect ? undefined : 0,
                                                    zIndex: enableMultiSelect ? undefined : 5,
                                                }}>
                                                    {rowNumber}
                                                </td>
                                                {orderedVisibleCols.map(col => {
                                                    const colKey = String(col.key);
                                                    const value = getCellValue(item, colKey);
                                                    return (
                                                        <td
                                                            key={colKey}
                                                            style={{
                                                                width: columnWidths[colKey],
                                                                minWidth: MIN_COL_WIDTH,
                                                                maxWidth: columnWidths[colKey],
                                                                padding: '14px 16px',
                                                                fontSize: '14px',
                                                                color: '#374151',
                                                                overflow: textOverflow === 'ellipsis' ? 'hidden' : 'visible',
                                                                textOverflow: textOverflow === 'ellipsis' ? 'ellipsis' : 'clip',
                                                                whiteSpace: textOverflow === 'ellipsis' ? 'nowrap' : 'normal',
                                                                wordBreak: textOverflow === 'wrap' ? 'break-word' : 'normal',
                                                            }}
                                                        >
                                                            {col.render ? col.render(item, value) : formatCellValue(value, colKey)}
                                                        </td>
                                                    );
                                                })}
                                                {hasActions && (
                                                    <td style={{
                                                        padding: '14px 16px',
                                                        textAlign: 'center',
                                                        position: 'sticky',
                                                        right: 0,
                                                        background: 'white',
                                                        boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
                                                        width: '100px',
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                            {onEdit && (
                                                                <button
                                                                    onClick={() => onEdit(item)}
                                                                    style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                                                                >
                                                                    <Pencil style={{ width: '16px', height: '16px' }} />
                                                                </button>
                                                            )}
                                                            {onDelete && (
                                                                <button
                                                                    onClick={() => onDelete(item)}
                                                                    style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                                                                >
                                                                    <Trash2 style={{ width: '16px', height: '16px' }} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {showPagination && totalPages > 1 && <PaginationBar position="bottom" />}
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// Cast to correct type to preserve generics
export const DataTable = React.forwardRef(DataTableInner) as <T extends Record<string, any>>(
    props: DataTableProps<T> & { ref?: React.Ref<DataTableRef> }
) => React.ReactElement;

export default DataTable;
