import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Check,
    CheckSquare,
    ChevronDown,
    Download,
    Eraser,
    Eye,
    EyeOff,
    FolderOpen,
    LogIn,
    LogOut,
    Mail,
    NotebookText,
    Plus,
    RefreshCw,
    RotateCcw,
    Settings,
    Square,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import { pb } from '../api/pocketbase';
import { useStore } from '../store/useStore';
import './CompanionApp.css';

const COMPANION_WIDGETS = [
    { id: 'todo', label: 'Checklist', title: 'Checklist', icon: CheckSquare },
    { id: 'notes', label: 'Notes', title: 'Notes', icon: NotebookText },
    { id: 'files', label: 'Files', title: 'Files', icon: FolderOpen },
    { id: 'settings', label: 'Settings', title: 'Settings', icon: Settings }
];

const ALL_TAB_IDS = COMPANION_WIDGETS.map(widget => widget.id);

const getWidgetTitle = (item, fallback) => item?.name || fallback;

// Splits pasted text on commas/newlines so a CSV or list paste becomes one task per entry.
const splitIntoTasks = (text) => text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

const emptyWidgetConfig = {
    todo: { type: 'todo', todos: [] },
    notes: { type: 'notes', note: '' }
};

const widgetDefaults = {
    todo: { name: 'Checklist', position: { x: 0, y: 0, w: 6, h: 8 } },
    notes: { name: 'Notes', position: { x: 0, y: 0, w: 6, h: 6 } }
};

export const CompanionApp = () => {
    const {
        user,
        setUser,
        items,
        fetchItems,
        createItem,
        updateItem,
        deleteItem,
        companionMenu,
        setCompanionMenu
    } = useStore();
    const availableTabs = useMemo(() => {
        const selected = companionMenu?.length ? companionMenu : ALL_TAB_IDS;
        return COMPANION_WIDGETS.filter(widget => selected.includes(widget.id));
    }, [companionMenu]);
    const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || 'settings');
    const [selectedWidgetIds, setSelectedWidgetIds] = useState({});

    useEffect(() => {
        if (user) fetchItems();
    }, [fetchItems, user]);

    // Pull-to-refresh: reloads the page, which is also the escape hatch for the
    // freezes users hit after the app sits backgrounded for a long stretch.
    const PULL_THRESHOLD = 70;
    const MAX_PULL = 110;
    const contentRef = useRef(null);
    const touchStartY = useRef(0);
    const pulling = useRef(false);
    const pullDistanceRef = useRef(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        const setPull = (value) => {
            pullDistanceRef.current = value;
            setPullDistance(value);
        };

        const onTouchStart = (e) => {
            pulling.current = el.scrollTop <= 0;
            touchStartY.current = e.touches[0].clientY;
        };

        const onTouchMove = (e) => {
            if (!pulling.current) return;
            const delta = e.touches[0].clientY - touchStartY.current;
            if (delta <= 0 || el.scrollTop > 0) {
                pulling.current = false;
                setPull(0);
                return;
            }
            e.preventDefault(); // stop native rubber-banding while we drive our own indicator
            setPull(Math.min(delta * 0.5, MAX_PULL));
        };

        const onTouchEnd = () => {
            if (pulling.current && pullDistanceRef.current >= PULL_THRESHOLD) {
                setRefreshing(true);
                pulling.current = false;
                setPull(0); // collapse the indicator so we reload from a settled, resting layout
                window.location.reload();
                return;
            }
            pulling.current = false;
            setPull(0);
        };

        // The OS/browser can interrupt a vertical drag mid-gesture (it's ambiguous with its
        // own scroll/toolbar-hide handling) and fires touchcancel instead of touchend — without
        // this, pulling.current/pullDistance never reset and the indicator stays stuck open,
        // shifting the layout (and the fixed bottom nav along with it) until something else
        // forces a reflow.
        const onTouchCancel = () => {
            pulling.current = false;
            setPull(0);
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchCancel);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchCancel);
        };
    }, []);

    const widgetsByType = useMemo(() => {
        const widgets = items.filter(item => item.type === 'widget');
        return {
            todo: widgets.filter(item => item.config?.type === 'todo'),
            notes: widgets.filter(item => item.config?.type === 'notes')
        };
    }, [items]);

    // Gallery images are also stored as type 'file', but parented to their gallery widget.
    // Excluding those keeps this list to the standalone files sitting on the desktop.
    const files = useMemo(
        () => items.filter(item => item.type === 'file' && !item.parent && item.payload),
        [items]
    );

    const ensureWidget = async (type) => {
        const existing = widgetsByType[type]?.[0];
        if (existing) return existing;

        return createItem({
            type: 'widget',
            name: widgetDefaults[type].name,
            config: emptyWidgetConfig[type],
            position: widgetDefaults[type].position
        });
    };

    const handleLogout = () => {
        pb.authStore.clear();
        setUser(null);
    };

    const activeMeta = COMPANION_WIDGETS.find(widget => widget.id === activeTab) || COMPANION_WIDGETS[0];
    const visibleActiveTab = user && availableTabs.some(tab => tab.id === activeTab)
        ? activeTab
        : availableTabs[0]?.id || 'settings';
    const visibleMeta = COMPANION_WIDGETS.find(widget => widget.id === visibleActiveTab) || COMPANION_WIDGETS[0];

    // The header title doubles as the widget picker: with 2+ widgets of the active tab's
    // type it becomes a real <select> (native picker on mobile), with exactly one it just
    // shows that widget's own name, and with none it falls back to the generic tab title.
    const activeWidgets = widgetsByType[visibleActiveTab] || [];
    const activeSelectedId = activeWidgets.some(w => w.id === selectedWidgetIds[visibleActiveTab])
        ? selectedWidgetIds[visibleActiveTab]
        : activeWidgets[0]?.id;
    const activeSelectedWidget = activeWidgets.find(w => w.id === activeSelectedId);
    const setActiveSelectedId = (id) => setSelectedWidgetIds(prev => ({ ...prev, [visibleActiveTab]: id }));

    return (
        <main className="companion-shell animate-fade-in">
            <div className="companion-rotate-lock">
                <RotateCcw size={32} />
                <p>Please rotate your phone back to portrait — Tabtop Companion doesn't support landscape.</p>
            </div>

            <header className="companion-header">
                <div>
                    <p>Tabtop Companion</p>
                    <h1 className="companion-title-row">
                        {user && activeWidgets.length >= 2 ? (
                            <>
                                <select
                                    className="companion-title-select"
                                    value={activeSelectedId || ''}
                                    onChange={(event) => setActiveSelectedId(event.target.value)}
                                >
                                    {activeWidgets.map(widget => (
                                        <option key={widget.id} value={widget.id}>
                                            {getWidgetTitle(widget, visibleMeta.title)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={20} className="companion-title-chevron" />
                            </>
                        ) : (
                            user ? getWidgetTitle(activeSelectedWidget, visibleMeta.title) : activeMeta.title
                        )}
                    </h1>
                </div>
            </header>

            <section className="companion-content" ref={contentRef}>
                <div className="companion-pull-indicator" style={{ height: pullDistance }}>
                    <RefreshCw
                        size={20}
                        className={refreshing ? 'spinning' : ''}
                        style={{ transform: `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 360}deg)` }}
                    />
                </div>
                {!user ? (
                    <CompanionLogin onLogin={setUser} />
                ) : visibleActiveTab === 'todo' ? (
                    <TodoEditor widgets={widgetsByType.todo} selectedId={activeSelectedId} ensureWidget={() => ensureWidget('todo')} updateItem={updateItem} />
                ) : visibleActiveTab === 'notes' ? (
                    <NotesEditor widgets={widgetsByType.notes} selectedId={activeSelectedId} ensureWidget={() => ensureWidget('notes')} updateItem={updateItem} />
                ) : visibleActiveTab === 'files' ? (
                    <FilesEditor files={files} createItem={createItem} deleteItem={deleteItem} />
                ) : (
                    <CompanionSettings
                        user={user}
                        selectedMenu={companionMenu}
                        setSelectedMenu={setCompanionMenu}
                        onLogout={handleLogout}
                    />
                )}
            </section>

            {user ? (
                <nav className="companion-bottom-nav" aria-label="Companion widgets">
                    {availableTabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={visibleActiveTab === tab.id ? 'active' : ''}
                            onClick={() => setActiveTab(tab.id)}
                            title={tab.title}
                        >
                            <tab.icon size={21} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            ) : null}
        </main>
    );
};

const CompanionLogin = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
            if (isRegistering) {
                await pb.collection('TabtopUsers').create({
                    email,
                    password,
                    passwordConfirm: password,
                    trial_started_at: new Date().toISOString(),
                    account_type: 'trial'
                });
            }

            const authData = await pb.collection('TabtopUsers').authWithPassword(email, password);
            onLogin(authData.record);
        } catch (error) {
            console.error('Companion login failed:', error);
            alert(isRegistering ? 'Registration failed. Please check your details.' : 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="companion-panel companion-auth-panel">
            <div className="companion-section-heading">
                <LogIn size={22} />
                <div>
                    <h2>{isRegistering ? 'Create your Tabtop' : 'Log in'}</h2>
                    <p>Edit your dashboard widgets from Android.</p>
                </div>
            </div>

            <form className="companion-form" onSubmit={handleSubmit}>
                <label>
                    <span>Email</span>
                    <div className="companion-input-icon">
                        <Mail size={18} />
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>
                </label>
                <label>
                    <span>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        minLength={8}
                        required
                    />
                </label>
                <button type="submit" className="companion-primary-button" disabled={loading}>
                    {loading ? 'Working...' : isRegistering ? 'Create account' : 'Log in'}
                </button>
            </form>

            <button type="button" className="companion-link-button" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Use an existing account' : 'Create a new account'}
            </button>
        </div>
    );
};

const TodoEditor = ({ widgets, selectedId, ensureWidget, updateItem }) => {
    const [newTask, setNewTask] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const selectedWidget = widgets.find(widget => widget.id === selectedId) || widgets[0];
    const todos = selectedWidget?.config?.todos || [];
    const showAmount = !!selectedWidget?.config?.showAmount;
    const [hideCompleted, setHideCompleted] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const visibleTodos = hideCompleted ? todos.filter(t => !t.done) : todos;

    const saveTodos = async (nextTodos) => {
        const widget = selectedWidget || await ensureWidget();
        await updateItem(widget.id, { config: { ...(widget.config || emptyWidgetConfig.todo), todos: nextTodos } });
    };

    const addTask = async (event) => {
        event.preventDefault();
        const tasks = splitIntoTasks(newTask);
        if (tasks.length === 0) return;

        // A typed amount only applies when adding a single task — a multi-item paste
        // would otherwise duplicate the same amount across every split entry.
        const amount = tasks.length === 1 ? newAmount.trim() : '';
        await saveTodos([...todos, ...tasks.map(text => ({ id: Date.now() + Math.random(), text, amount, done: false }))]);
        setNewTask('');
        setNewAmount('');
    };

    const handlePaste = async (event) => {
        const pasted = event.clipboardData.getData('text');
        if (!/[,\n]/.test(pasted)) return; // single item — let the default paste happen
        event.preventDefault();
        const tasks = splitIntoTasks(pasted);
        if (tasks.length === 0) return;

        await saveTodos([...todos, ...tasks.map(text => ({ id: Date.now() + Math.random(), text, amount: '', done: false }))]);
        setNewTask('');
    };

    const updateAmount = (id, amount) => {
        saveTodos(todos.map(item => item.id === id ? { ...item, amount } : item));
    };

    const updateText = (id, text) => {
        const trimmed = text.trim();
        setEditingId(null);
        if (!trimmed) return; // empty edit — leave the original text alone rather than blanking it
        saveTodos(todos.map(item => item.id === id ? { ...item, text: trimmed } : item));
    };

    const clearAll = () => {
        if (todos.length === 0) return;
        const ok = window.confirm(`Delete all ${todos.length} item${todos.length === 1 ? '' : 's'}? This can't be undone.`);
        if (!ok) return;
        saveTodos([]);
    };

    return (
        <div className="companion-panel">
            <div className="companion-panel-header">
                <div className="companion-panel-actions">
                    <button
                        type="button"
                        className="companion-icon-toggle"
                        onClick={() => setHideCompleted(v => !v)}
                        title={hideCompleted ? 'Show completed items' : 'Hide completed items'}
                    >
                        {hideCompleted ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                        type="button"
                        className="companion-icon-toggle"
                        onClick={clearAll}
                        title="Clear all items"
                    >
                        <Eraser size={18} />
                    </button>
                </div>
            </div>

            <form className="companion-add-row" onSubmit={addTask}>
                <input
                    type="text"
                    value={newTask}
                    onChange={(event) => setNewTask(event.target.value)}
                    onPaste={handlePaste}
                    placeholder="New task (paste a list to add multiple)"
                />
                {showAmount && (
                    <input
                        type="text"
                        className="companion-amount-input"
                        value={newAmount}
                        onChange={(event) => setNewAmount(event.target.value)}
                        placeholder="Qty"
                    />
                )}
                <button type="submit" title="Add task">
                    <Plus size={20} />
                </button>
            </form>

            <div className="companion-list">
                {visibleTodos.length ? visibleTodos.map(todo => (
                    <article key={todo.id} className={`companion-todo ${todo.done ? 'done' : ''}`}>
                        <button type="button" onClick={() => saveTodos(todos.map(item => item.id === todo.id ? { ...item, done: !item.done } : item))}>
                            {todo.done ? <CheckSquare size={22} /> : <Square size={22} />}
                        </button>
                        {editingId === todo.id ? (
                            <input
                                type="text"
                                className="companion-todo-edit-input"
                                defaultValue={todo.text}
                                autoFocus
                                onFocus={(event) => event.target.select()}
                                onBlur={(event) => updateText(todo.id, event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') event.target.blur();
                                    if (event.key === 'Escape') setEditingId(null);
                                }}
                            />
                        ) : (
                            <span onClick={() => setEditingId(todo.id)}>{todo.text}</span>
                        )}
                        {showAmount && (
                            <input
                                type="text"
                                className="companion-amount-input"
                                defaultValue={todo.amount || ''}
                                onBlur={(event) => updateAmount(todo.id, event.target.value)}
                                placeholder="Qty"
                            />
                        )}
                        <button type="button" className="danger" onClick={() => saveTodos(todos.filter(item => item.id !== todo.id))}>
                            <Trash2 size={19} />
                        </button>
                    </article>
                )) : (
                    <div className="companion-empty">
                        <CheckSquare size={28} />
                        <p>{hideCompleted && todos.length > 0 ? 'All items completed.' : 'No tasks yet.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const NotesEditor = ({ widgets, selectedId, ensureWidget, updateItem }) => {
    const selectedWidget = widgets.find(widget => widget.id === selectedId) || widgets[0];
    const [noteDrafts, setNoteDrafts] = useState({});
    const [saveState, setSaveState] = useState('idle');
    const note = noteDrafts[selectedId] ?? selectedWidget?.config?.note ?? '';

    const saveNote = async () => {
        setSaveState('saving');
        const widget = selectedWidget || await ensureWidget();
        await updateItem(widget.id, { config: { ...(widget.config || emptyWidgetConfig.notes), note } });
        setSaveState('saved');
        window.setTimeout(() => setSaveState('idle'), 1400);
    };

    return (
        <div className="companion-panel companion-notes-panel">
            <textarea
                value={note}
                onChange={(event) => setNoteDrafts(drafts => ({ ...drafts, [selectedId]: event.target.value }))}
                onBlur={saveNote}
                placeholder="Write your note..."
            />
            <button type="button" className="companion-primary-button" onClick={saveNote}>
                {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save note'}
            </button>
        </div>
    );
};

const FilesEditor = ({ files, createItem, deleteItem }) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleUpload = async (event) => {
        const picked = Array.from(event.target.files || []);
        if (picked.length === 0) return;
        setUploading(true);
        try {
            for (const file of picked) {
                const formData = new FormData();
                formData.append('type', 'file');
                formData.append('name', file.name);
                formData.append('position', JSON.stringify(useStore.getState().findFreePosition({ w: 2, h: 3 })));
                formData.append('payload', file);
                await createItem(formData);
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Upload failed. The file may be too large (5 MB limit).');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleDownload = async (item) => {
        try {
            const token = await pb.files.getToken();
            const res = await fetch(pb.files.getURL(item, item.payload, { token }));
            // Fetch to a blob first: the download attribute is ignored on cross-origin URLs
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = item.name?.includes('.') ? item.name : item.payload;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Download failed', error);
            alert('Could not download this file.');
        }
    };

    const handleDelete = (item) => {
        const ok = window.confirm(`Delete "${item.name}"? This can't be undone.`);
        if (!ok) return;
        deleteItem(item.id);
    };

    return (
        <div className="companion-panel">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleUpload}
            />
            <button
                type="button"
                className="companion-primary-button companion-upload-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
            >
                <Upload size={18} />
                {uploading ? 'Uploading...' : 'Add files'}
            </button>

            <div className="companion-list">
                {files.length ? files.map(item => (
                    <article key={item.id} className="companion-file">
                        <span className="companion-file-name">{item.name}</span>
                        <button type="button" onClick={() => handleDownload(item)} title="Download">
                            <Download size={19} />
                        </button>
                        <button type="button" className="danger" onClick={() => handleDelete(item)} title="Delete">
                            <Trash2 size={19} />
                        </button>
                    </article>
                )) : (
                    <div className="companion-empty">
                        <FolderOpen size={28} />
                        <p>No files yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const CompanionSettings = ({ user, selectedMenu, setSelectedMenu, onLogout }) => {
    const selected = selectedMenu?.length ? selectedMenu : ALL_TAB_IDS;

    const toggleMenuItem = (id) => {
        if (id === 'settings') return;

        const next = selected.includes(id)
            ? selected.filter(item => item !== id)
            : [...selected.filter(item => item !== 'settings'), id, 'settings'];
        setSelectedMenu(next.includes('settings') ? next : [...next, 'settings']);
    };

    return (
        <div className="companion-panel companion-settings-panel">
            <div className="companion-account-card">
                <div>
                    <p>Logged in as</p>
                    <strong>{user.email}</strong>
                </div>
                <button type="button" onClick={onLogout} title="Log out">
                    <LogOut size={20} />
                </button>
            </div>

            <div className="companion-settings-group">
                <h2>Bottom Menu</h2>
                {COMPANION_WIDGETS.map(widget => (
                    <label key={widget.id} className="companion-check-row">
                        <div>
                            <widget.icon size={20} />
                            <span>{widget.title}</span>
                        </div>
                        <button
                            type="button"
                            className={selected.includes(widget.id) ? 'selected' : ''}
                            disabled={widget.id === 'settings'}
                            onClick={() => toggleMenuItem(widget.id)}
                            title={selected.includes(widget.id) ? 'Hide from bottom menu' : 'Show in bottom menu'}
                        >
                            {selected.includes(widget.id) ? <Check size={18} /> : <X size={18} />}
                        </button>
                    </label>
                ))}
            </div>
        </div>
    );
};
