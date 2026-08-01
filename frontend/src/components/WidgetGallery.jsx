import React, { useState } from 'react';
import { X, Search, Clock, Cloud, Rss, Quote, Edit3, Sun, CheckSquare, Smile, Link as LinkIcon, Github, Globe, MessageSquare, Briefcase, BookOpen, Code, Trophy, Layout, Map, CalendarDays, Image } from 'lucide-react';
import { useStore } from '../store/useStore';

const WIDGET_CATEGORIES = [
    {
        id: 'productivity',
        name: 'Productivity',
        widgets: [
            { id: 'notes', name: 'Notes', description: 'Simple sticky notes for your dashboard', icon: Edit3, config: { type: 'notes' }, size: { w: 6, h: 6 } },
            { id: 'todo', name: 'Checklist', description: 'Interactive checklist for your tasks', icon: CheckSquare, config: { type: 'todo', todos: [] }, size: { w: 6, h: 8 } },
            { id: 'workhours', name: 'Work Hours', description: 'Track your daily progress', icon: Briefcase, config: { type: 'workhours', startHour: 9, endHour: 17 }, size: { w: 8, h: 3 } },
            { id: 'links', name: 'Quick Links', description: 'Fast access to your favorite sites', icon: LinkIcon, config: { type: 'links', links: [] }, size: { w: 6, h: 6 } },
            { id: 'gallery', name: 'Gallery', description: 'Drag or paste images onto a pannable, zoomable canvas', icon: Image, config: { type: 'gallery' }, size: { w: 12, h: 10 } },
        ]
    },
    {
        id: 'information',
        name: 'Information',
        widgets: [
            { id: 'weather', name: 'Weather', description: 'Real-time local weather updates', icon: Cloud, config: { type: 'weather', city: 'Berlin' }, size: { w: 8, h: 4 } },
            { id: 'rss', name: 'RSS Feed', description: 'Your favorite news sources', icon: Rss, config: { type: 'rss', url: 'https://news.google.com/rss' }, size: { w: 8, h: 8 } },
            { id: 'github', name: 'Github', description: 'Your contribution activity graph', icon: Github, config: { type: 'github', username: 'joelshepherd' }, size: { w: 8, h: 4 } },
            { id: 'nba', name: 'NBA Scores', description: 'Live games and daily schedules', icon: Trophy, config: { type: 'nba' }, size: { w: 8, h: 6 } },
            { id: 'radar', name: 'Rain Radar', description: 'Live animated precipitation map', icon: Map, config: { type: 'radar', lat: 52.52, lon: 13.405, zoom: 6 }, size: { w: 8, h: 8 } },
            { id: 'calendar', name: 'Calendar', description: 'Upcoming events from iCal feed', icon: CalendarDays, config: { type: 'calendar', url: '', days: 14 }, size: { w: 7, h: 10 } },
            { id: 'ipinfo', name: 'IP Info', description: 'Network and location details', icon: Globe, config: { type: 'ipinfo' }, size: { w: 6, h: 4 } },
        ]
    },
    {
        id: 'fun',
        name: 'Personal & Fun',
        widgets: [
            { id: 'greeting', name: 'Greeting', description: 'Personalized time-based welcome', icon: Sun, config: { type: 'greeting', name: 'Friend' }, size: { w: 8, h: 4 } },
            { id: 'quote', name: 'Quote', description: 'Daily dose of inspiration', icon: Quote, config: { type: 'quote' }, size: { w: 8, h: 4 } },
            { id: 'joke', name: 'Joke', description: 'Random humor to brighten your day', icon: Smile, config: { type: 'joke' }, size: { w: 8, h: 4 } },
            { id: 'literatureclock', name: 'Lit Clock', description: 'Time told through classic books', icon: BookOpen, config: { type: 'literatureclock' }, size: { w: 8, h: 4 } },
            { id: 'clock', name: 'Clock', description: 'Analog or digital timekeeping', icon: Clock, config: { type: 'clock', mode: 'digital' }, size: { w: 8, h: 4 } },
        ]
    },
    {
        id: 'advanced',
        name: 'Advanced',
        widgets: [
            { id: 'js', name: 'Custom JS', description: 'Safe sandbox for your own code', icon: Code, config: { type: 'js' }, size: { w: 8, h: 4 } },
            { id: 'message', name: 'Message', description: 'Display custom text or reminders', icon: MessageSquare, config: { type: 'message', message: 'Hello World!' }, size: { w: 8, h: 4 } },
            { id: 'search', name: 'Search Bar', description: 'Search the web instantly', icon: Search, config: { type: 'search', engine: 'google' }, size: { w: 12, h: 2 } },
        ]
    }
];

export const WidgetGallery = () => {
    const { isWidgetGalleryOpen, toggleWidgetGallery, createItem } = useStore();
    const [searchQuery, setSearchQuery] = useState('');

    if (!isWidgetGalleryOpen) return null;

    const handleAdd = (widget) => {
        createItem({
            name: widget.name,
            type: 'widget',
            config: widget.config,
            position: { x: 0, y: 0, ...widget.size }
        });
        toggleWidgetGallery(false);
    };

    const filteredCategories = WIDGET_CATEGORIES.map(cat => ({
        ...cat,
        widgets: cat.widgets.filter(w =>
            w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.widgets.length > 0);

    return (
        <div
            className="modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                zIndex: 3000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
            }}
            onClick={() => toggleWidgetGallery(false)}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    borderRadius: 'calc(24px * var(--radius-scale, 1))',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'rgba(18, 18, 18, 0.96)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '32px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '24px'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Widget Gallery</h2>
                        <p style={{ opacity: 0.6, margin: '4px 0 0 0' }}>Add new tools to your dashboard</p>
                    </div>

                    <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px 12px 48px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 'calc(12px * var(--radius-scale, 1))',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        onClick={() => toggleWidgetGallery(false)}
                        style={{ background: 'none', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', padding: '8px' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                    {filteredCategories.map(cat => (
                        <div key={cat.id} style={{ marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.4, marginBottom: '20px' }}>
                                {cat.name}
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '16px'
                            }}>
                                {cat.widgets.map(w => (
                                    <div
                                        key={w.id}
                                        onClick={() => handleAdd(w)}
                                        className="gallery-item"
                                        style={{
                                            padding: '24px',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            borderRadius: 'calc(20px * var(--radius-scale, 1))',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            background: 'var(--accent-primary)',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white'
                                        }}>
                                            <w.icon size={24} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{w.name}</div>
                                            <div style={{ fontSize: '0.85rem', opacity: 0.5, lineHeight: '1.4', marginTop: '4px' }}>{w.description}</div>
                                        </div>
                                        <style dangerouslySetInnerHTML={{
                                            __html: `
                                            .gallery-item:hover {
                                                background: rgba(255,255,255,0.08) !important;
                                                border-color: var(--accent-primary) !important;
                                                transform: translateY(-4px) !important;
                                            }
                                        `}} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
