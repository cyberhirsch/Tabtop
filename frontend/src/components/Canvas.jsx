import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import { useStore } from '../store/useStore';
import { ContextMenu } from './ContextMenu';
import { pb } from '../api/pocketbase';
import { GridItem } from './GridItem';
import { Layout, Plus, Link as LinkIcon, Rss, Trash2, Maximize2, Minimize2, Image as ImageIcon, Settings as SettingsIcon, LayoutGrid, Edit3, Share2 } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export const Canvas = () => {
    const { items, fetchItems, syncLayout, createItem, deleteItem, user, gridConfig, gridOpacity, showGrid, hideGrid } = useStore();
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetId: null });
    const containerRef = useRef(null);

    useEffect(() => {
        fetchItems();
    }, [fetchItems, user]);

    // Records with a parent live inside a widget (e.g. gallery images), not on the desktop
    const desktopItems = useMemo(() => (items || []).filter(i => !i.parent), [items]);

    const layout = useMemo(() => {
        return desktopItems.map(item => {
            const pos = item.position || {};
            const isWidget = item.type === 'widget';
            return {
                i: item.id,
                x: pos.x || 0,
                y: pos.y || 0,
                w: pos.w || (isWidget ? 4 : 2),
                h: pos.h || (isWidget ? 4 : 3),
                isResizable: isWidget
            };
        });
    }, [desktopItems]);

    const handleContextMenu = useCallback((e, targetId = null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            targetId: targetId
        });
    }, []);

    const handleCreate = useCallback(async (type, extra = {}) => {
        if (!user) {
            alert('Please login to add items.');
            return;
        }
        const name = extra.name || prompt(`Enter name for the new ${type}:`) || `New ${type}`;
        const position = extra.position || { x: 0, y: 0, w: 4, h: 4 };

        const data = {
            type: type,
            name: name,
            position: position,
            ...extra.fields
        };

        if (extra.file) {
            const formData = new FormData();
            Object.keys(data).forEach(k => formData.append(k, k === 'position' ? JSON.stringify(data[k]) : data[k]));
            formData.append('payload', extra.file);
            await createItem(formData);
        } else {
            await createItem(data);
        }
    }, [user, createItem]);

    const onDrop = async (e) => {
        e.preventDefault();
        if (!user) return;

        const files = e.dataTransfer.files;
        const url = e.dataTransfer.getData('url') || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');

        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (rect.width / gridConfig.cols));
        const y = Math.floor((e.clientY - rect.top) / (gridConfig.rowHeight + gridConfig.gap));

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                await handleCreate('file', {
                    name: files[i].name,
                    file: files[i],
                    position: { x: x + (i * 2), y: y, w: 2, h: 3 }
                });
            }
        } else if (url && (url.startsWith('http') || url.includes('.'))) {
            await handleCreate('link', {
                name: url.replace(/^https?:\/\//, '').split('/')[0],
                fields: { config: { url } },
                position: { x, y, w: 2, h: 3 }
            });
        }
    };

    const handleLayoutChange = (currentLayout) => {
        currentLayout.forEach(layoutItem => {
            const originalItem = items.find(i => i.id === layoutItem.i);
            if (!originalItem) return;

            const pos = {
                x: layoutItem.x,
                y: layoutItem.y,
                w: layoutItem.w,
                h: layoutItem.h
            };

            if (
                originalItem.position?.x !== pos.x ||
                originalItem.position?.y !== pos.y ||
                originalItem.position?.w !== pos.w ||
                originalItem.position?.h !== pos.h
            ) {
                syncLayout(layoutItem.i, pos);
            }
        });
    };

    const autoArrange = useCallback(() => {
        const cols = gridConfig.cols;
        const totalItems = [...desktopItems];

        // 1. Sort items: Widgets first (by area descending), then Links/Files (alphabetically)
        totalItems.sort((a, b) => {
            if (a.type === 'widget' && b.type !== 'widget') return -1;
            if (a.type !== 'widget' && b.type === 'widget') return 1;

            if (a.type === 'widget') {
                const areaA = (a.position?.w || 4) * (a.position?.h || 4);
                const areaB = (b.position?.w || 4) * (b.position?.h || 4);
                return areaB - areaA;
            }

            return (a.name || '').localeCompare(b.name || '');
        });

        const updates = [];
        const occupied = new Set(); // Use string "x,y" to track occupied cells

        const isAreaFree = (x, y, w, h) => {
            if (x + w > cols) return false;
            for (let i = x; i < x + w; i++) {
                for (let j = y; j < y + h; j++) {
                    if (occupied.has(`${i},${j}`)) return false;
                }
            }
            return true;
        };

        const markOccupied = (x, y, w, h) => {
            for (let i = x; i < x + w; i++) {
                for (let j = y; j < y + h; j++) {
                    occupied.add(`${i},${j}`);
                }
            }
        };


        totalItems.forEach(item => {
            const isWidget = item.type === 'widget';
            // Use current size or reasonable defaults
            const w = item.position?.w || (isWidget ? 12 : 4);
            const h = item.position?.h || (isWidget ? 8 : 4);

            // Limit width if it exceeds grid columns
            const finalW = Math.min(w, cols);
            const finalH = h;

            let placed = false;
            // Search row by row
            for (let y = 0; y < 1000; y++) { // Arbitrary limit to infinite loop
                for (let x = 0; x <= cols - finalW; x++) {
                    if (isAreaFree(x, y, finalW, finalH)) {
                        const newPos = { x, y, w: finalW, h: finalH };
                        updates.push({ id: item.id, position: newPos });
                        markOccupied(x, y, finalW, finalH);
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        });

        if (updates.length > 0) {
            useStore.getState().bulkSyncLayout(updates);
        }
    }, [desktopItems, gridConfig.cols]);

    const menuItems = useMemo(() => {
        const baseMenu = [];

        // Context-specific widget options at the very top
        if (contextMenu.targetId) {
            const targetItem = items.find(i => i.id === contextMenu.targetId);
            if (targetItem?.type === 'widget' && targetItem.config?.type === 'clock') {
                baseMenu.push({
                    label: targetItem.config.mode === 'analog' ? 'Switch to Digital' : 'Switch to Analog',
                    icon: <Plus size={16} />,
                    onClick: () => {
                        const newConfig = { ...targetItem.config, mode: targetItem.config.mode === 'analog' ? 'digital' : 'analog' };
                        useStore.getState().updateItem(targetItem.id, { config: newConfig });
                    }
                });
                baseMenu.push({ type: 'separator' });
            }
        }

        // Add items in the middle
        baseMenu.push(
            { label: 'Add Link', icon: <LinkIcon size={16} />, onClick: () => handleCreate('link') },
            {
                label: 'Add Widget...',
                icon: <LayoutGrid size={16} />,
                onClick: () => useStore.getState().toggleWidgetGallery(true)
            },
            { type: 'separator' }
        );

        // Management tools at the bottom
        baseMenu.push({ label: 'Auto Arrange', icon: <Layout size={16} />, onClick: autoArrange });

        if (contextMenu.targetId) {
            const targetItem = items.find(i => i.id === contextMenu.targetId);
            if (targetItem?.type === 'link' || targetItem?.type === 'file') {
                baseMenu.push({
                    label: 'Rename Item',
                    icon: <Edit3 size={16} />,
                    onClick: () => {
                        const newName = prompt('Enter new name (leave empty for icon-only):', targetItem.name);
                        if (newName !== null) {
                            useStore.getState().updateItem(targetItem.id, { name: newName });
                        }
                    }
                });
                baseMenu.push({
                    label: 'Share',
                    icon: <Share2 size={16} />,
                    onClick: async () => {
                        let url = '';
                        if (targetItem.type === 'link') {
                            url = targetItem.config?.url;
                            if (!url.startsWith('http')) url = 'https://' + url;
                        } else if (targetItem.type === 'file' && targetItem.payload) {
                            if (!targetItem.shared) {
                                await useStore.getState().updateItem(targetItem.id, { shared: true });
                            }
                            try {
                                const token = await pb.files.getToken();
                                url = pb.files.getURL(targetItem, targetItem.payload, { token });
                            } catch (error) {
                                console.error('Token fetch failed', error);
                                url = pb.files.getURL(targetItem, targetItem.payload);
                            }
                        }
                        if (url) {
                            navigator.clipboard.writeText(url);
                        }
                    }
                });
            } else if (targetItem?.type === 'widget') {
                baseMenu.push({
                    label: 'Widget Settings',
                    icon: <SettingsIcon size={16} />,
                    onClick: () => useStore.getState().setWidgetSettings(true, targetItem)
                });
            }
            baseMenu.push({ label: 'Delete Item', icon: <Trash2 size={16} />, danger: true, onClick: () => deleteItem(contextMenu.targetId) });
        }

        return baseMenu;
    }, [contextMenu.targetId, items, handleCreate, deleteItem, autoArrange]);

    return (
        <div
            ref={containerRef}
            className="canvas-container"
            style={{ height: '100vh', width: '100vw', padding: '20px', position: 'relative' }}
            onContextMenu={(e) => handleContextMenu(e)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
        >
            <div
                className="grid-preview"
                style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    right: 20,
                    bottom: 20,
                    pointerEvents: 'none',
                    zIndex: 0,
                    opacity: gridOpacity,
                    background: `
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)
                        `,
                    backgroundSize: `calc((100% + ${gridConfig.gap}px) / ${gridConfig.cols}) ${gridConfig.rowHeight + gridConfig.gap}px`,
                    transition: 'opacity 0.5s ease'
                }}
            />

            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xss: 0 }}
                cols={{ lg: gridConfig.cols, md: Math.floor(gridConfig.cols * 0.75), sm: Math.floor(gridConfig.cols * 0.5), xs: 8, xss: 4 }}
                rowHeight={gridConfig.rowHeight}
                draggableHandle=".drag-handle"
                draggableCancel=".grid-drag-cancel"
                onDragStart={showGrid}
                onDragStop={(l) => {
                    hideGrid();
                    handleLayoutChange(l);
                }}
                onResizeStop={handleLayoutChange}
                margin={[gridConfig.gap, gridConfig.gap]}
                compactType={null}
                preventCollision={true}
                resizeHandles={['se', 'sw']}
            >
                {desktopItems.map(item => (
                    <div key={item.id} i={item.id} className="drag-handle">
                        <GridItem item={item} onContextMenu={handleContextMenu} />
                    </div>
                ))}
            </ResponsiveGridLayout>

            <ContextMenu
                {...contextMenu}
                items={menuItems}
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
            />
        </div>
    );
};
