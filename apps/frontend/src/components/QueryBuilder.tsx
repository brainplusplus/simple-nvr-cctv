import React, { createContext, useContext } from 'react';
import { Plus, Trash2, FolderPlus } from 'lucide-react';
// import { cutoffFields } from '../api/cutoffs'; // Removed specific dependency
import type { FieldDefinition, Filter, FilterGroup } from '../types/filters';
import { filterOperators } from '../types/filters';
import MultiSelect from './MultiSelect';
import { useTranslation } from '../hooks/useTranslation';

// Re-export FieldDefinition for backwards compatibility
export type { FieldDefinition } from '../types/filters';

// Types for Query Builder
export interface QueryRule {
    id: string;
    type?: 'rule';
    field: string;
    operator: string;
    value: string;
}

export interface QueryGroup {
    id: string;
    type?: 'group';
    logic: 'AND' | 'OR';
    children: (QueryRule | QueryGroup)[];
}

// Type guard
export function isQueryGroup(item: QueryRule | QueryGroup): item is QueryGroup {
    return 'children' in item;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Create empty rule
export const createRule = (): QueryRule => ({
    id: generateId(),
    type: 'rule',
    field: '',
    operator: '=',
    value: '',
});

// Create empty group - starts with no rules so filter is truly empty on page load
export const createGroup = (logic: 'AND' | 'OR' = 'AND'): QueryGroup => ({
    id: generateId(),
    type: 'group',
    logic,
    children: [],  // Empty by default - user must click "Add Rule" to add filters
});

// Convert QueryGroup to API FilterGroup format
export function toApiFilterGroup(group: QueryGroup): FilterGroup {
    const filters: (Filter | FilterGroup)[] = group.children
        .filter((child) => {
            if (isQueryGroup(child)) {
                return child.children.length > 0;
            }
            // Allow empty string for boolean fields (which have 'true' or 'false')
            return child.field && (child.value || child.value === 'false');
        })
        .map((child): Filter | FilterGroup => {
            if (isQueryGroup(child)) {
                return toApiFilterGroup(child);
            }

            // Convert boolean string values to actual booleans
            let value: string | boolean | string[] = child.value;
            if (child.value === 'true') {
                value = true;
            } else if (child.value === 'false') {
                value = false;
            } else if ((child.operator === 'contains' || child.operator === 'in' || child.operator === 'not_in') && child.value.includes(',')) {
                // Multiselect values are comma-separated, convert to array
                value = child.value.split(',').filter(v => v);
            }

            return {
                field: child.field,
                operator: child.operator,
                value,
            };
        });

    return {
        logic: group.logic,
        filters,
    };
}

// Context for fields
const FieldsContext = createContext<FieldDefinition[]>([]);

// Styles
const styles = {
    group: {
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        background: '#fafafa',
    },
    groupNested: {
        border: '2px dashed #d1d5db',
        borderRadius: '10px',
        padding: '14px',
        marginTop: '10px',
        marginBottom: '8px',
        background: '#f5f5f5',
    },
    logicSelector: {
        display: 'inline-flex',
        gap: '4px',
        marginBottom: '12px',
    },
    logicButton: (isActive: boolean) => ({
        padding: '6px 14px',
        borderRadius: '6px',
        border: 'none',
        background: isActive ? '#3b82f6' : '#e5e7eb',
        color: isActive ? 'white' : '#374151',
        fontSize: '12px',
        fontWeight: 600 as const,
        cursor: 'pointer',
        transition: 'all 0.15s',
    }),
    rule: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginBottom: '8px',
        flexWrap: 'wrap' as const,
    },
    select: {
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        minWidth: '130px',
        background: 'white',
    },
    input: {
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        fontSize: '14px',
        flex: 1,
        minWidth: '120px',
    },
    iconButton: (color: string) => ({
        padding: '6px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color,
        display: 'flex',
        alignItems: 'center',
    }),
    actionButtons: {
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
    },
    addButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px dashed #d1d5db',
        background: 'transparent',
        color: '#6b7280',
        fontSize: '13px',
        cursor: 'pointer',
    },
};

// Rule Component
interface RuleProps {
    rule: QueryRule;
    onUpdate: (rule: QueryRule) => void;
    onRemove: () => void;
    canRemove: boolean;
}

// Operators for boolean fields
const booleanOperators = [
    { value: '=', label: 'Equals' },
];

// Operators for multiselect fields (JSONB arrays)
const multiselectOperators = [
    { value: 'in', label: 'In (Contains Any)' },
    { value: 'not_in', label: 'Not In (Excludes All)' },
];

const Rule: React.FC<RuleProps> = ({ rule, onUpdate, onRemove, canRemove }) => {
    const fields = useContext(FieldsContext);
    const { t } = useTranslation('query_builder');
    const isFieldEmpty = !rule.field;

    // Get the selected field definition
    const selectedField = fields.find(f => f.name === rule.field);
    const fieldType = selectedField?.type || 'string';

    // Get appropriate operators based on field type
    const getOperators = () => {
        if (fieldType === 'boolean') return booleanOperators;
        if (fieldType === 'multiselect') return multiselectOperators;
        return filterOperators;
    };

    // Handle boolean toggle
    const handleBooleanChange = (checked: boolean) => {
        onUpdate({ ...rule, value: checked ? 'true' : 'false', operator: '=' });
    };

    // Handle select change (single value)
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate({ ...rule, value: e.target.value });
    };

    // Reset value when field type changes
    const handleFieldChange = (newField: string) => {
        const newFieldDef = fields.find(f => f.name === newField);
        let newValue = '';
        let newOperator = '=';

        if (newFieldDef?.type === 'boolean') {
            newValue = 'true';
            newOperator = '=';
        } else if (newFieldDef?.type === 'multiselect') {
            newValue = '';
            newOperator = 'in';
        }

        onUpdate({ ...rule, field: newField, value: newValue, operator: newOperator });
    };

    // Parse multiselect value back to array
    const getMultiselectValues = (): string[] => {
        if (!rule.value) return [];
        return rule.value.split(',').filter(v => v);
    };

    // Render value input based on field type
    const renderValueInput = () => {
        // Boolean: render checkbox
        if (fieldType === 'boolean') {
            return (
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    background: 'white',
                    cursor: 'pointer',
                    minWidth: '120px',
                }}>
                    <input
                        type="checkbox"
                        checked={rule.value === 'true'}
                        onChange={(e) => handleBooleanChange(e.target.checked)}
                        style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                        }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                        {rule.value === 'true' ? t('yes') : t('no')}
                    </span>
                </label>
            );
        }

        // Multiselect: render Select2-style multi-select with chips
        if (fieldType === 'multiselect' && selectedField?.options) {
            const selectedValues = getMultiselectValues();
            // Helper to normalize options to {value, label} format
            const normalizedOptions = selectedField.options.map(opt =>
                typeof opt === 'string' ? { value: opt, label: opt } : opt
            );
            return (
                <MultiSelect
                    options={normalizedOptions}
                    value={selectedValues}
                    onChange={(values) => onUpdate({ ...rule, value: values.join(',') })}
                    placeholder={t('select_values_placeholder')}
                />
            );
        }

        // Select: render single-select dropdown
        if (fieldType === 'select' && selectedField?.options) {
            // Helper to normalize options to {value, label} format
            const normalizedOptions = selectedField.options.map(opt =>
                typeof opt === 'string' ? { value: opt, label: opt } : opt
            );
            return (
                <select
                    value={rule.value}
                    onChange={handleSelectChange}
                    style={styles.select}
                >
                    <option value="">{t('select_option_placeholder')}</option>
                    {normalizedOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        // Default: render text input
        return (
            <input
                type="text"
                value={rule.value}
                onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                placeholder={t('value_placeholder')}
                style={styles.input}
            />
        );
    };

    return (
        <div style={styles.rule}>
            <select
                value={rule.field}
                onChange={(e) => handleFieldChange(e.target.value)}
                style={{
                    ...styles.select,
                    borderColor: isFieldEmpty ? '#f87171' : '#e5e7eb',
                    backgroundColor: isFieldEmpty ? '#fef2f2' : 'white',
                }}
                required
            >
                <option value="" disabled>{t('select_field')}</option>
                {fields.map((f) => (
                    <option key={f.name} value={f.name}>{t(f.label)}</option>
                ))}
            </select>
            {/* Hide operator select for boolean (fixed operators), show for multiselect */}
            {fieldType !== 'boolean' && (
                <select
                    value={rule.operator}
                    onChange={(e) => onUpdate({ ...rule, operator: e.target.value })}
                    style={styles.select}
                >
                    {getOperators().map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                </select>
            )}
            {renderValueInput()}
            {canRemove && (
                <button onClick={onRemove} style={styles.iconButton('#6b7280')}>
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
};

// Group Component
interface GroupProps {
    group: QueryGroup;
    onUpdate: (group: QueryGroup) => void;
    onRemove?: () => void;
    isRoot?: boolean;
}

const Group: React.FC<GroupProps> = ({ group, onUpdate, onRemove, isRoot = false }) => {
    const { t } = useTranslation('query_builder');

    const toggleLogic = (logic: 'AND' | 'OR') => {
        onUpdate({ ...group, logic });
    };

    const addRule = () => {
        onUpdate({
            ...group,
            children: [...group.children, createRule()],
        });
    };

    const addGroup = () => {
        onUpdate({
            ...group,
            children: [...group.children, createGroup()],
        });
    };

    const updateChild = (index: number, child: QueryRule | QueryGroup) => {
        const newChildren = [...group.children];
        newChildren[index] = child;
        onUpdate({ ...group, children: newChildren });
    };

    const removeChild = (index: number) => {
        // Allow removing any child - filter can be empty
        const newChildren = group.children.filter((_, i) => i !== index);
        onUpdate({ ...group, children: newChildren });
    };

    return (
        <div style={isRoot ? styles.group : styles.groupNested}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.logicSelector}>
                    <button
                        onClick={() => toggleLogic('AND')}
                        style={styles.logicButton(group.logic === 'AND')}
                    >
                        {t('and')}
                    </button>
                    <button
                        onClick={() => toggleLogic('OR')}
                        style={styles.logicButton(group.logic === 'OR')}
                    >
                        {t('or')}
                    </button>
                </div>
                {!isRoot && onRemove && (
                    <button onClick={onRemove} style={styles.iconButton('#ef4444')}>
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Empty state message */}
            {group.children.length === 0 && (
                <div style={{
                    padding: '12px 16px',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontStyle: 'italic',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    marginBottom: '8px'
                }}>
                    {t('empty_message')}
                </div>
            )}

            {group.children.map((child, index) => (
                <div key={isQueryGroup(child) ? child.id : child.id}>
                    {isQueryGroup(child) ? (
                        <Group
                            group={child}
                            onUpdate={(updated) => updateChild(index, updated)}
                            onRemove={() => removeChild(index)}
                        />
                    ) : (
                        <Rule
                            rule={child}
                            onUpdate={(updated) => updateChild(index, updated)}
                            onRemove={() => removeChild(index)}
                            canRemove={true}
                        />
                    )}
                </div>
            ))}

            <div style={styles.actionButtons}>
                <button onClick={addRule} style={styles.addButton}>
                    <Plus size={14} />
                    {t('add_rule')}
                </button>
                <button onClick={addGroup} style={styles.addButton}>
                    <FolderPlus size={14} />
                    {t('add_group')}
                </button>
            </div>
        </div>
    );
};

// Main QueryBuilder Component
interface QueryBuilderProps {
    value: QueryGroup;
    onChange: (group: QueryGroup) => void;
    fields?: FieldDefinition[];  // Optional - defaults to empty if not provided
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({ value, onChange, fields }) => {
    return (
        <FieldsContext.Provider value={fields || []}>
            <Group
                group={value}
                onUpdate={onChange}
                isRoot={true}
            />
        </FieldsContext.Provider>
    );
};

export default QueryBuilder;
