import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Download, Maximize2, Minimize2, Plus, Clipboard, Copy } from 'lucide-react';
import { pb } from '../../api/pocketbase';
import { useStore } from '../../store/useStore';
import { ContextMenu } from '../ContextMenu';

const IMG_W = 220;

const fileFromClipboardItem = async (clipboardItem) => {
    const type = clipboardItem.types.find(t => t.startsWith('image/'));
    if (!type) return null;
    const blob = await clipboardItem.getType(type);
    return new File([blob], `pasted-${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
};

const GalleryCanvas = ({ item, config, maximized, onToggleMaximize }) => {
    const { user, items, createItem, updateItem, deleteItem } = useStore();
    const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
    const [hoveredId, setHoveredId] = useState(null);
    const [dragOverride, setDragOverride] = useState(null); // { id, x, y } while dragging an image
    const [fileToken, setFileToken] = useState('');
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetId: null });
    const containerRef = useRef(null);
    const panState = useRef(null);
    const dragState = useRef(null);
    const fileInputRef = useRef(null);
    const mouseWorldPos = useRef({ x: 0, y: 0 });
    const isHoveredRef = useRef(false);

    // Gallery images are Tabtop records parented to this widget; the store's
    // realtime subscription keeps them in sync across devices automatically.
    const images = useMemo(
        () => items
            .filter(i => i.parent === item.id && i.payload)
            .sort((a, b) => (a.created || '').localeCompare(b.created || '')),
        [items, item.id]
    );

    // The payload file field is protected, so URLs need a short-lived file token
    useEffect(() => {
        let cancelled = false;
        const refresh = () => {
            pb.files.getToken()
                .then(t => { if (!cancelled) setFileToken(t); })
                .catch(err => console.error('File token fetch failed', err));
        };
        refresh();
        const interval = setInterval(refresh, 120000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const getImageUrl = useCallback((record) => {
        return pb.files.getURL(record, record.payload, fileToken ? { token: fileToken } : {});
    }, [fileToken]);

    const screenToWorld = useCallback((clientX, clientY) => {
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - view.x) / view.scale,
            y: (clientY - rect.top - view.y) / view.scale
        };
    }, [view]);

    const uploadImage = useCallback(async (file, worldX, worldY) => {
        const formData = new FormData();
        formData.append('type', 'file');
        formData.append('name', file.name);
        formData.append('parent', item.id);
        formData.append('position', JSON.stringify({ x: worldX, y: worldY }));
        formData.append('payload', file);
        return createItem(formData);
    }, [item.id, createItem]);

    const addFiles = useCallback(async (fileList, worldPos) => {
        if (!user || !fileList || fileList.length === 0) return;
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        for (let i = 0; i < files.length; i++) {
            try {
                await uploadImage(files[i], worldPos.x + i * 24, worldPos.y + i * 24);
            } catch (err) {
                console.error('Gallery upload failed', err);
            }
        }
    }, [user, uploadImage]);

    // Drag & drop onto canvas — OS files, or an image dragged from another page/tab (arrives as a URL)
    const onDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = screenToWorld(e.clientX, e.clientY);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files, pos);
            return;
        }
        const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (url && url.startsWith('http')) {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                if (blob.type.startsWith('image/')) {
                    const name = url.split('/').pop()?.split('?')[0] || `dropped-${Date.now()}.png`;
                    await uploadImage(new File([blob], name, { type: blob.type }), pos.x, pos.y);
                }
            } catch (err) {
                console.error('Could not fetch dropped image URL (likely CORS)', err);
            }
        }
    };

    // Paste (hover-scoped: only fires while the mouse is over this widget)
    const handlePasteEvent = useCallback(async (e) => {
        const pos = mouseWorldPos.current;
        try {
            if (e?.clipboardData) {
                const clipItems = Array.from(e.clipboardData.items || []);
                const imageItems = clipItems.filter(i => i.type.startsWith('image/'));
                if (imageItems.length > 0) {
                    e.preventDefault();
                    for (const it of imageItems) {
                        const file = it.getAsFile();
                        if (file) await uploadImage(file, pos.x, pos.y);
                    }
                    return;
                }
            }
            // Fallback to async clipboard API (used by the context-menu Paste entry)
            const clipItems = await navigator.clipboard.read();
            for (const ci of clipItems) {
                const file = await fileFromClipboardItem(ci);
                if (file) await uploadImage(file, pos.x, pos.y);
            }
        } catch (err) {
            console.error('Gallery paste failed', err);
        }
    }, [uploadImage]);

    const copyImageToClipboard = useCallback(async (record) => {
        try {
            const res = await fetch(getImageUrl(record));
            const blob = await res.blob();
            // Clipboard API is picky about types; convert to PNG via canvas if needed
            if (blob.type === 'image/png') {
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            } else {
                const bitmap = await createImageBitmap(blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0);
                const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            }
        } catch (err) {
            console.error('Copy image failed', err);
        }
    }, [getImageUrl]);

    const downloadImage = async (record) => {
        // Fetch to a blob first: the download attribute is ignored on cross-origin URLs
        try {
            const res = await fetch(getImageUrl(record));
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = record.payload || record.name || 'image';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (err) {
            console.error('Download failed', err);
        }
    };

    // Keyboard shortcuts, scoped to mouse position: listeners live on document (no focus needed)
    // and are gated by isHoveredRef. Ctrl+V over the widget pastes; Ctrl+C over an image copies it.
    useEffect(() => {
        const onPaste = (e) => {
            if (!isHoveredRef.current) return;
            // Don't hijack paste aimed at a text input elsewhere on the page
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            handlePasteEvent(e);
        };
        const onKeyDown = async (e) => {
            if (!isHoveredRef.current) return;
            if (!(e.ctrlKey || e.metaKey) || e.key !== 'c' || !hoveredId) return;
            if (window.getSelection()?.toString()) return; // let real text copies through
            const record = images.find(r => r.id === hoveredId);
            if (record) {
                e.preventDefault();
                await copyImageToClipboard(record);
            }
        };
        document.addEventListener('paste', onPaste);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('paste', onPaste);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [hoveredId, images, handlePasteEvent, copyImageToClipboard]);

    // Zoom needs a native non-passive wheel listener (React root listeners are passive,
    // so preventDefault there can't stop the page from scrolling/zooming)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheelNative = (e) => e.preventDefault();
        el.addEventListener('wheel', onWheelNative, { passive: false });
        return () => el.removeEventListener('wheel', onWheelNative);
    }, []);

    // Middle-mouse pan
    const onMouseDown = (e) => {
        if (e.button === 1) {
            e.preventDefault();
            panState.current = { startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y };
        }
    };

    const onImageMouseDown = (e, record) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const pos = record.position || { x: 0, y: 0 };
        dragState.current = {
            id: record.id,
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x || 0,
            origY: pos.y || 0
        };
    };

    const onMouseMove = (e) => {
        const world = screenToWorld(e.clientX, e.clientY);
        mouseWorldPos.current = world;

        if (panState.current) {
            const dx = e.clientX - panState.current.startX;
            const dy = e.clientY - panState.current.startY;
            setView(v => ({ ...v, x: panState.current.origX + dx, y: panState.current.origY + dy }));
        } else if (dragState.current) {
            const dx = (e.clientX - dragState.current.startX) / view.scale;
            const dy = (e.clientY - dragState.current.startY) / view.scale;
            setDragOverride({
                id: dragState.current.id,
                x: dragState.current.origX + dx,
                y: dragState.current.origY + dy
            });
        }
    };

    const onMouseUp = async () => {
        if (dragState.current && dragOverride && dragOverride.id === dragState.current.id) {
            const { id, x, y } = dragOverride;
            dragState.current = null;
            try {
                await updateItem(id, { position: { x, y } });
            } catch (err) {
                console.error('Failed to save image position', err);
            }
            setDragOverride(null);
        }
        dragState.current = null;
        panState.current = null;
    };

    const onWheel = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY < 0 ? 1.1 : 0.9;
        setView(v => {
            const newScale = Math.min(Math.max(v.scale * delta, 0.1), 6);
            const worldX = (mouseX - v.x) / v.scale;
            const worldY = (mouseY - v.y) / v.scale;
            return {
                scale: newScale,
                x: mouseX - worldX * newScale,
                y: mouseY - worldY * newScale
            };
        });
    };

    const openFilePicker = () => fileInputRef.current?.click();

    const onFilePicked = (e) => {
        const pos = mouseWorldPos.current;
        addFiles(e.target.files, pos);
        e.target.value = '';
    };

    const handleContextMenu = (e, record) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: record ? record.id : null });
    };

    const contextMenuItems = (() => {
        const target = contextMenu.targetId ? images.find(r => r.id === contextMenu.targetId) : null;
        if (target) {
            return [
                { label: 'Download', icon: <Download size={16} />, onClick: () => downloadImage(target) },
                { label: 'Copy', icon: <Copy size={16} />, onClick: () => copyImageToClipboard(target) },
                { type: 'separator' },
                { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: () => deleteItem(target.id) }
            ];
        }
        return [
            { label: 'Add Image...', icon: <Plus size={16} />, onClick: openFilePicker },
            { label: 'Paste', icon: <Clipboard size={16} />, onClick: () => handlePasteEvent(null) }
        ];
    })();

    return (
        <div
            ref={containerRef}
            onMouseEnter={() => { isHoveredRef.current = true; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { isHoveredRef.current = false; onMouseUp(); }}
            onWheel={onWheel}
            onContextMenu={(e) => handleContextMenu(e, null)}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.15)',
                cursor: panState.current ? 'grabbing' : 'default',
                outline: 'none'
            }}
        >
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFilePicked} />

            <div style={{
                position: 'absolute',
                top: 8, left: 8,
                zIndex: 5,
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
            }}>
                <button
                    onClick={onToggleMaximize}
                    className="control-btn"
                >
                    {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
            </div>

            {images.length === 0 && (
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '8px', opacity: 0.4, pointerEvents: 'none', textAlign: 'center', padding: '16px'
                }}>
                    <Plus size={28} />
                    <span style={{ fontSize: '0.85rem' }}>Drag images here, or paste with Ctrl+V</span>
                </div>
            )}

            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: '0 0'
            }}>
                {images.map(record => {
                    const pos = (dragOverride && dragOverride.id === record.id)
                        ? dragOverride
                        : (record.position || { x: 0, y: 0 });
                    return (
                        <div
                            key={record.id}
                            className="grid-drag-cancel"
                            onMouseEnter={() => setHoveredId(record.id)}
                            onMouseLeave={() => setHoveredId(prev => prev === record.id ? null : prev)}
                            onMouseDown={(e) => onImageMouseDown(e, record)}
                            onContextMenu={(e) => handleContextMenu(e, record)}
                            style={{
                                position: 'absolute',
                                left: pos.x || 0,
                                top: pos.y || 0,
                                width: IMG_W,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                cursor: 'grab',
                                userSelect: 'none'
                            }}
                        >
                            <img
                                src={getImageUrl(record)}
                                draggable={false}
                                alt=""
                                style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
                            />
                            {hoveredId === record.id && (
                                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: '4px' }}>
                                    <button
                                        className="control-btn"
                                        onClick={(e) => { e.stopPropagation(); downloadImage(record); }}
                                    >
                                        <Download size={12} />
                                    </button>
                                    <button
                                        className="control-btn delete"
                                        onClick={(e) => { e.stopPropagation(); deleteItem(record.id); }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <ContextMenu
                {...contextMenu}
                items={contextMenuItems}
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
            />
        </div>
    );
};

export const GalleryWidget = ({ config = {}, item }) => {
    const [maximized, setMaximized] = useState(false);
    const toggleMaximize = () => setMaximized(m => !m);

    if (maximized) {
        return createPortal(
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 4000,
                background: 'rgba(10,10,12,0.98)',
                backdropFilter: 'blur(12px)'
            }}>
                <GalleryCanvas item={item} config={config} maximized={maximized} onToggleMaximize={toggleMaximize} />
            </div>,
            document.body
        );
    }

    return <GalleryCanvas item={item} config={config} maximized={maximized} onToggleMaximize={toggleMaximize} />;
};

export const GalleryWidgetSettings = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>No configurable settings for Gallery yet.</span>
        </div>
    );
};
