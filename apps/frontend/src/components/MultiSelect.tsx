import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * MultiSelect component with Select2-style UI
 * 
 * Features:
 * - Shows selected items as chips/tags
 * - Each chip has an X button to remove
 * - Dropdown shows available options with checkmarks for selected
 * - Click outside to close dropdown
 * 
 * @example
 * ```tsx
 * const [selected, setSelected] = useState<string[]>([]);
 * const options = [
 *     { value: 'chief_judge', label: 'Hakim Ketua' },
 *     { value: 'registrar', label: 'Sekretaris Pengganti' },
 * ];
 * 
 * <MultiSelect
 *     options={options}
 *     value={selected}
 *     onChange={setSelected}
 *     placeholder="Select job titles..."
 * />
 * ```
 */
const MultiSelect: React.FC<MultiSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onChange(value.filter(v => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const removeOption = (optionValue: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== optionValue));
    };

    const getLabel = (optionValue: string): string => {
        const option = options.find(o => o.value === optionValue);
        return option ? option.label : optionValue;
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', minWidth: '200px' }}>
            {/* Selected items container */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    paddingRight: '32px',
                    minHeight: '40px',
                    borderRadius: '8px',
                    border: `1px solid ${isOpen ? '#3b82f6' : '#e5e7eb'}`,
                    background: disabled ? '#f9fafb' : 'white',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'border-color 0.15s',
                    position: 'relative',
                }}
            >
                {value.length === 0 ? (
                    <span style={{ color: '#9ca3af', fontSize: '14px' }}>{placeholder}</span>
                ) : (
                    value.map(v => (
                        <span
                            key={v}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '12px',
                                fontWeight: 500,
                            }}
                        >
                            {getLabel(v)}
                            {!disabled && (
                                <button
                                    onClick={(e) => removeOption(v, e)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: '0',
                                        color: '#3b82f6',
                                        borderRadius: '50%',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#dbeafe';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </span>
                    ))
                )}
                {/* Dropdown arrow */}
                <div
                    style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af',
                        pointerEvents: 'none',
                    }}
                >
                    <ChevronDown size={18} style={{ transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
            </div>

            {/* Dropdown options */}
            {isOpen && !disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}
                >
                    {options.length === 0 ? (
                        <div style={{ padding: '12px', color: '#9ca3af', fontSize: '14px', textAlign: 'center' }}>
                            No options available
                        </div>
                    ) : (
                        options.map(option => {
                            const isSelected = value.includes(option.value);
                            return (
                                <div
                                    key={option.value}
                                    onClick={() => toggleOption(option.value)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        background: isSelected ? '#eff6ff' : 'transparent',
                                        borderBottom: '1px solid #f3f4f6',
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = '#f9fafb';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = isSelected ? '#eff6ff' : 'transparent';
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: isSelected ? 'none' : '2px solid #d1d5db',
                                            background: isSelected ? '#3b82f6' : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                                    </div>
                                    <span style={{
                                        fontSize: '14px',
                                        color: isSelected ? '#1d4ed8' : '#374151',
                                        fontWeight: isSelected ? 500 : 400,
                                    }}>
                                        {option.label}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
