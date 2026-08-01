import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Plus, Trash2, CheckSquare, Square, Eye, EyeOff, Eraser } from 'lucide-react';

// Splits pasted text on commas/newlines so a CSV or list paste becomes one task per entry.
const splitIntoTasks = (text) => text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

export const TodoWidget = ({ config = {}, item }) => {
    const { updateItem } = useStore();
    const todos = config.todos || [];
    const showAmount = !!config.showAmount;
    const [newTask, setNewTask] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [hideCompleted, setHideCompleted] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const visibleTodos = hideCompleted ? todos.filter(t => !t.done) : todos;

    const saveTodos = async (newTodos) => {
        if (item && item.id) {
            await updateItem(item.id, { config: { ...config, todos: newTodos } });
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        const tasks = splitIntoTasks(newTask);
        if (tasks.length === 0) return;
        // A typed amount only applies when adding a single task — a multi-item paste
        // would otherwise duplicate the same amount across every split entry.
        const amount = tasks.length === 1 ? newAmount.trim() : '';
        const newTodos = [...todos, ...tasks.map(text => ({ id: Date.now() + Math.random(), text, amount, done: false }))];
        await saveTodos(newTodos);
        setNewTask('');
        setNewAmount('');
    };

    const handlePaste = async (e) => {
        const pasted = e.clipboardData.getData('text');
        if (!/[,\n]/.test(pasted)) return; // single item — let the default paste happen
        e.preventDefault();
        const tasks = splitIntoTasks(pasted);
        if (tasks.length === 0) return;
        const newTodos = [...todos, ...tasks.map(text => ({ id: Date.now() + Math.random(), text, amount: '', done: false }))];
        await saveTodos(newTodos);
        setNewTask('');
    };

    const toggleDone = async (id) => {
        const newTodos = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
        await saveTodos(newTodos);
    };

    const updateAmount = async (id, amount) => {
        const newTodos = todos.map(t => t.id === id ? { ...t, amount } : t);
        await saveTodos(newTodos);
    };

    const updateText = async (id, text) => {
        const trimmed = text.trim();
        setEditingId(null);
        if (!trimmed) return; // empty edit — leave the original text alone rather than blanking it
        const newTodos = todos.map(t => t.id === id ? { ...t, text: trimmed } : t);
        await saveTodos(newTodos);
    };

    const deleteTodo = async (id) => {
        const newTodos = todos.filter(t => t.id !== id);
        await saveTodos(newTodos);
    };

    const clearAll = async () => {
        if (todos.length === 0) return;
        const ok = window.confirm(`Delete all ${todos.length} item${todos.length === 1 ? '' : 's'}? This can't be undone.`);
        if (!ok) return;
        await saveTodos([]);
    };

    return (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Icons sit beside the title, not far-right: the widget frame's own cog/delete
                controls are absolutely positioned over the rightmost ~62px on hover.
                This row is intentionally NOT a drag-cancel zone — it's the widget's drag
                handle, since the list and input below it are interactive. Plain clicks on
                the icons still register; react-grid-layout only drags once the pointer moves. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingRight: '52px' }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    color: 'var(--accent-primary)',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {item?.name || 'Checklist'}
                </h3>
                <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                    <div
                        onClick={() => setHideCompleted(v => !v)}
                        title={hideCompleted ? 'Show completed items' : 'Hide completed items'}
                        style={{ cursor: 'pointer', display: 'flex', opacity: 0.6 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
                    >
                        {hideCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
                    </div>
                    <div
                        onClick={clearAll}
                        title="Clear all items"
                        style={{ cursor: 'pointer', display: 'flex', opacity: 0.6 }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
                    >
                        <Eraser size={16} />
                    </div>
                </div>
            </div>
            <div className="grid-drag-cancel" style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
                {visibleTodos.map(todo => (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div onClick={() => toggleDone(todo.id)} style={{ cursor: 'pointer', display: 'flex' }}>
                            {todo.done ? <CheckSquare size={16} opacity={0.8} /> : <Square size={16} opacity={0.6} />}
                        </div>
                        {editingId === todo.id ? (
                            <input
                                type="text"
                                defaultValue={todo.text}
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                onBlur={(e) => updateText(todo.id, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                style={{
                                    flex: 1,
                                    fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: `calc(4px * var(--radius-scale, 1))`,
                                    color: 'white',
                                    padding: '2px 6px'
                                }}
                            />
                        ) : (
                            <span
                                onClick={() => setEditingId(todo.id)}
                                title="Click to edit"
                                style={{
                                    flex: 1,
                                    fontSize: '0.9rem',
                                    textDecoration: todo.done ? 'line-through' : 'none',
                                    opacity: todo.done ? 0.6 : 1,
                                    cursor: 'text'
                                }}
                            >
                                {todo.text}
                            </span>
                        )}
                        {showAmount && (
                            <input
                                type="text"
                                defaultValue={todo.amount || ''}
                                onBlur={(e) => updateAmount(todo.id, e.target.value)}
                                placeholder="Qty"
                                style={{
                                    width: '54px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '4px 6px',
                                    borderRadius: `calc(6px * var(--radius-scale, 1))`,
                                    color: 'white',
                                    fontSize: '0.8rem',
                                    textAlign: 'center'
                                }}
                            />
                        )}
                        <Trash2
                            size={14}
                            onClick={() => deleteTodo(todo.id)}
                            style={{ cursor: 'pointer', opacity: 0.5 }}
                            onMouseEnter={(e) => e.target.style.opacity = 1}
                            onMouseLeave={(e) => e.target.style.opacity = 0.5}
                        />
                    </div>
                ))}
            </div>
            <form onSubmit={handleAdd} className="grid-drag-cancel" style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="New task... (paste a list to add multiple)"
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '6px 10px',
                        borderRadius: `calc(6px * var(--radius-scale, 1))`,
                        color: 'white',
                        fontSize: '0.85rem'
                    }}
                />
                {showAmount && (
                    <input
                        type="text"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="Qty"
                        style={{
                            width: '54px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '6px 10px',
                            borderRadius: `calc(6px * var(--radius-scale, 1))`,
                            color: 'white',
                            fontSize: '0.85rem',
                            textAlign: 'center'
                        }}
                    />
                )}
                <button type="submit" style={{
                    background: 'var(--accent-primary)', border: 'none', borderRadius: `calc(6px * var(--radius-scale, 1))`,
                    padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'white'
                }}>
                    <Plus size={16} />
                </button>
            </form>
        </div>
    );
};

export const TodoWidgetSettings = ({ config, setConfig }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}>
                <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Show amount column</div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.6 }}>Adds a quantity field to each item — handy for grocery lists (e.g. "3 tomatoes").</div>
                </div>
                <input
                    type="checkbox"
                    checked={!!config.showAmount}
                    onChange={(e) => setConfig({ ...config, showAmount: e.target.checked })}
                    style={{ width: '18px', height: '18px', flexShrink: 0 }}
                />
            </label>
            <span style={{ fontSize: '0.78rem', opacity: 0.5 }}>Tasks themselves are managed on the widget.</span>
        </div>
    );
};
