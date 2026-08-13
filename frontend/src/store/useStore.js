import { create } from 'zustand';
import { pb } from '../api/pocketbase';

export const useStore = create((set) => ({
    // Auth State
    user: pb.authStore.model,
    setUser: (user) => {
        set({ user });
        if (user && user.preferences) {
            if (user.preferences.gridConfig) set({ gridConfig: { ...user.preferences.gridConfig } });
            if (user.preferences.companionMenu) set({ companionMenu: user.preferences.companionMenu });
            if (user.preferences.themeConfig) {
                // Merge saved preferences on top of current defaults (preserves any new fields added to defaults)
                const currentTheme = useStore.getState().themeConfig;
                const merged = { ...currentTheme, ...user.preferences.themeConfig };
                useStore.getState().setThemeConfig(merged, true);
            }
        }
    },

    // Items State
    items: [],
    setItems: (items) => set({ items }),
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),

    // UI State
    isSettingsOpen: false,
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

    isWidgetGalleryOpen: false,
    toggleWidgetGallery: (open) => set((state) => ({ isWidgetGalleryOpen: open !== undefined ? open : !state.isWidgetGalleryOpen })),

    widgetSettings: { isOpen: false, item: null },
    setWidgetSettings: (isOpen, item = null) => set({ widgetSettings: { isOpen, item } }),

    isAdminPanelOpen: false,
    toggleAdminPanel: () => set((state) => ({ isAdminPanelOpen: !state.isAdminPanelOpen })),

    companionMenu: ['todo', 'notes', 'files', 'images', 'settings'],
    setCompanionMenu: (companionMenu) => {
        set({ companionMenu });
        useStore.getState().saveUserPreferences({ companionMenu });
    },
    saveUserPreferences: async (preferences) => {
        const currentUser = useStore.getState().user;
        if (!currentUser) return null;

        try {
            const nextPreferences = {
                ...(currentUser.preferences || {}),
                ...preferences
            };
            const record = await pb.collection('TabtopUsers').update(currentUser.id, {
                preferences: nextPreferences
            });
            set({ user: record });
            return record;
        } catch (error) {
            console.error('Failed to save preferences:', error);
            return null;
        }
    },

    users: [],
    fetchUsers: async () => {
        const currentUser = useStore.getState().user;
        const role = Array.isArray(currentUser?.account_type) ? currentUser.account_type[0] : currentUser?.account_type;
        if (!currentUser || role !== 'admin') {
            console.warn('Unauthorized: Only admins can fetch the user list');
            return [];
        }
        try {
            const records = await pb.collection('TabtopUsers').getFullList({
                sort: '-created',
            });
            set({ users: records });
            return records;
        } catch (error) {
            console.error('Failed to fetch users:', error);
            return [];
        }
    },

    createUser: async ({ email, password, account_type }) => {
        try {
            const record = await pb.collection('TabtopUsers').create({
                email,
                password,
                passwordConfirm: password,
                account_type,
                emailVisibility: true,
            });
            set((state) => ({ users: [record, ...state.users] }));
            return record;
        } catch (error) {
            console.error('Failed to create user:', error);
            throw error;
        }
    },

    updateUserStatus: async (userId, data) => {
        try {
            const record = await pb.collection('TabtopUsers').update(userId, data);
            set((state) => {
                const newUsers = state.users.map(u => u.id === userId ? record : u);
                // If update is for the current user, update their local state too
                if (state.user?.id === userId) {
                    return { users: newUsers, user: record };
                }
                return { users: newUsers };
            });
            return record;
        } catch (error) {
            console.error('Failed to update user status:', error);
            throw error;
        }
    },

    gridConfig: {
        cols: 64,
        rowHeight: 15,
        gap: 16,
        iconSize: 44
    },
    setGridConfig: (config) => {
        set((state) => ({ gridConfig: { ...state.gridConfig, ...config } }));
        useStore.getState().triggerGridPreview();
        if (window._savePrefsTimeout) clearTimeout(window._savePrefsTimeout);
        window._savePrefsTimeout = setTimeout(() => {
            const state = useStore.getState();
            if (state.user) {
                state.saveUserPreferences({ gridConfig: state.gridConfig, themeConfig: state.themeConfig });
            }
        }, 1000);
    },
    gridOpacity: 0,
    triggerGridPreview: () => {
        set({ gridOpacity: 0.3 });
        if (window._gridTimeout) clearTimeout(window._gridTimeout);
        window._gridTimeout = setTimeout(() => set({ gridOpacity: 0 }), 10000);
    },
    showGrid: () => {
        if (window._gridTimeout) clearTimeout(window._gridTimeout);
        set({ gridOpacity: 0.3 });
    },
    hideGrid: () => {
        set({ gridOpacity: 0 });
    },

    themeConfig: {
        primary: '#00bcd4',
        secondary: '#26c6da',
        bgType: 'gradient',
        bgColor: '#131313',
        bgGradientColor2: '#1e1e1e',
        bgGradientAngle: 135,
        bgImage: '',
        cornerRadius: 100,
        frameOpacity: 100
    },
    setThemeConfig: (config, skipSave = false) => {
        set((state) => {
            const newTheme = { ...state.themeConfig, ...config };
            document.documentElement.style.setProperty('--accent-primary', newTheme.primary);
            document.documentElement.style.setProperty('--accent-secondary', newTheme.secondary);
            const radiusScale = (newTheme.cornerRadius !== undefined ? newTheme.cornerRadius : 100) / 100;
            document.documentElement.style.setProperty('--radius-scale', String(radiusScale));
            const opacityScale = (newTheme.frameOpacity !== undefined ? newTheme.frameOpacity : 100) / 100;
            document.documentElement.style.setProperty('--frame-opacity-scale', String(opacityScale));

            // Apply background directly to body
            if (newTheme.bgType === 'solid') {
                document.body.style.background = newTheme.bgColor;
                document.body.style.backgroundImage = 'none';
            } else if (newTheme.bgType === 'gradient') {
                const angle = newTheme.bgGradientAngle !== undefined ? newTheme.bgGradientAngle : 135;
                const c1 = newTheme.bgColor || '#0a0a0c';
                const c2 = newTheme.bgGradientColor2 || '#1a1a2e';
                document.body.style.background = `linear-gradient(${angle}deg, ${c2} 0%, ${c1} 100%)`;
            } else if (newTheme.bgType === 'image') {
                document.body.style.background = newTheme.bgColor; // fallback behind image
                document.body.style.backgroundImage = `url("${newTheme.bgImage}")`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
            }

            if (!skipSave) {
                if (window._savePrefsTimeout) clearTimeout(window._savePrefsTimeout);
                window._savePrefsTimeout = setTimeout(() => {
                    const state = useStore.getState();
                    if (state.user) {
                        state.saveUserPreferences({ gridConfig: state.gridConfig, themeConfig: newTheme });
                    }
                }, 1000);
            }

            return { themeConfig: newTheme };
        });
    },

    // Actions
    fetchItems: async () => {
        if (!pb.authStore.model) return [];
        try {
            const records = await pb.collection('Tabtop').getFullList();
            set({ items: records });
            return records;
        } catch (error) {
            // Ignore auto-cancellation errors (status 0)
            if (error.status !== 0 && error.name !== 'AbortError') {
                console.error('Failed to fetch items:', error);
            }
            return [];
        }
    },

    // Scans existing desktop items (skipping widget children like gallery images, which
    // aren't placed on the grid) for the first open cell of the given size. Used wherever
    // a new item is created without an explicit position, so items don't all stack at (0,0).
    findFreePosition: (size = {}) => {
        const { items, gridConfig } = useStore.getState();
        const cols = gridConfig.cols;
        const w = Math.min(size.w || 4, cols);
        const h = size.h || 4;

        const occupied = new Set();
        items.forEach(item => {
            const pos = item.position;
            if (!pos || item.parent) return;
            for (let i = pos.x; i < pos.x + (pos.w || 1); i++) {
                for (let j = pos.y; j < pos.y + (pos.h || 1); j++) {
                    occupied.add(`${i},${j}`);
                }
            }
        });

        const isFree = (x, y) => {
            if (x + w > cols) return false;
            for (let i = x; i < x + w; i++) {
                for (let j = y; j < y + h; j++) {
                    if (occupied.has(`${i},${j}`)) return false;
                }
            }
            return true;
        };

        for (let y = 0; y < 1000; y++) {
            for (let x = 0; x <= cols - w; x++) {
                if (isFree(x, y)) {
                    // Mark occupied immediately so back-to-back calls in the same batch
                    // (e.g. uploading several files at once) don't land on the same slot.
                    for (let i = x; i < x + w; i++) {
                        for (let j = y; j < y + h; j++) {
                            occupied.add(`${i},${j}`);
                        }
                    }
                    return { x, y, w, h };
                }
            }
        }
        return { x: 0, y: 0, w, h };
    },

    createItem: async (data) => {
        try {
            let record;
            if (data instanceof FormData) {
                if (!data.has('owner')) {
                    data.append('owner', pb.authStore.model?.id);
                }
                record = await pb.collection('Tabtop').create(data);
            } else {
                const payload = {
                    ...data,
                    owner: pb.authStore.model?.id
                };
                record = await pb.collection('Tabtop').create(payload);
            }
            set((state) => ({
                items: state.items.some(i => i.id === record.id)
                    ? state.items.map(i => i.id === record.id ? record : i)
                    : [...state.items, record]
            }));
            return record;
        } catch (error) {
            console.error('Failed to create item:', error);
            throw error;
        }
    },

    syncLayout: async (id, position) => {
        try {
            await pb.collection('Tabtop').update(id, { position });
            set((state) => ({
                items: state.items.map(i => i.id === id ? { ...i, position } : i)
            }));
        } catch (error) {
            console.error('Failed to sync layout:', error);
        }
    },

    bulkSyncLayout: async (updates) => {
        // updates = [{ id, position }, ...]
        try {
            // Update locally first for instant feedback
            set((state) => ({
                items: state.items.map(item => {
                    const update = updates.find(u => u.id === item.id);
                    return update ? { ...item, position: update.position } : item;
                })
            }));

            // Sync with DB – PocketBase doesn't have a bulk update for separate IDs 
            // BUT we can use Promise.all to trigger them concurrently.
            await Promise.all(updates.map(u =>
                pb.collection('Tabtop').update(u.id, { position: u.position })
            ));
        } catch (error) {
            console.error('Failed to sync bulk layout:', error);
        }
    },

    updateItem: async (id, data) => {
        try {
            const record = await pb.collection('Tabtop').update(id, data);
            set((state) => ({
                items: state.items.map(i => i.id === id ? record : i)
            }));
            return record;
        } catch (error) {
            console.error('Failed to update item:', error);
        }
    },

    deleteItem: async (id) => {
        try {
            // Delete child records first (e.g. gallery images parented to a widget)
            const children = useStore.getState().items.filter(i => i.parent === id);
            await Promise.all(children.map(c => pb.collection('Tabtop').delete(c.id)));
            await pb.collection('Tabtop').delete(id);
            set((state) => ({ items: state.items.filter(i => i.id !== id && i.parent !== id) }));
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    },

    subscribe: () => {
        pb.collection('Tabtop').subscribe('*', ({ action, record }) => {
            set((state) => {
                let newItems = [...state.items];
                if (action === 'create') {
                    const exists = newItems.some(item => item.id === record.id);
                    if (exists) {
                        newItems = newItems.map(item => item.id === record.id ? record : item);
                    } else {
                        newItems.push(record);
                    }
                } else if (action === 'update') {
                    newItems = newItems.map(item => item.id === record.id ? record : item);
                } else if (action === 'delete') {
                    newItems = newItems.filter(item => item.id !== record.id);
                }
                return { items: newItems };
            });
        });
    },

    unsubscribe: () => {
        pb.collection('Tabtop').unsubscribe('*');
    }
}));

// Initialize subscription and listen for PocketBase auth changes
window.useStore = useStore;
useStore.getState().subscribe();
pb.authStore.onChange((token, model) => {
    useStore.getState().setUser(model);
});

// Mobile browsers suspend the realtime SSE connection when the tab is backgrounded
// or the screen locks, and it doesn't always resync on its own — force a refetch
// whenever the app becomes visible/focused again so stale data self-heals.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && pb.authStore.model) {
            useStore.getState().fetchItems();
        }
    });
    window.addEventListener('focus', () => {
        if (pb.authStore.model) useStore.getState().fetchItems();
    });
}

// Apply default theme to CSS immediately on startup (before any async DB load)
// This ensures CSS variables match the store's initial state from frame 1
useStore.getState().setThemeConfig({}, true);

// Load preferences on startup — fetch fresh user record so we get the latest
// saved preferences, not the stale snapshot cached in localStorage at login time
if (pb.authStore.isValid) {
    pb.collection('TabtopUsers').authRefresh()
        .then(({ record }) => {
            useStore.getState().setUser(record);
        })
        .catch(() => {
            // Token expired or network error — fall back to cached model
            if (pb.authStore.model) {
                useStore.getState().setUser(pb.authStore.model);
            }
        });
}
