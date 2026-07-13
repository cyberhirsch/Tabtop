import React, { useRef } from 'react';
import { File as FileIcon, Globe, Layout, Rss, Settings as Cog, X } from 'lucide-react';
import { pb } from '../api/pocketbase';
import { SearchWidget } from './widgets/SearchWidget';
import { WeatherWidget } from './widgets/WeatherWidget';
import { RSSWidget } from './widgets/RSSWidget';
import { ClockWidget } from './widgets/ClockWidget';
import { QuoteWidget } from './widgets/QuoteWidget';
import { NotesWidget } from './widgets/NotesWidget';
import { GreetingWidget } from './widgets/GreetingWidget';
import { TodoWidget } from './widgets/TodoWidget';
import { JokeWidget } from './widgets/JokeWidget';
import { LinksWidget } from './widgets/LinksWidget';
import { GithubWidget } from './widgets/GithubWidget';
import { IpInfoWidget } from './widgets/IpInfoWidget';
import { MessageWidget } from './widgets/MessageWidget';
import { WorkHoursWidget } from './widgets/WorkHoursWidget';
import { LiteratureClockWidget } from './widgets/LiteratureClockWidget';
import { JsWidget } from './widgets/JsWidget';
import { NbaWidget } from './widgets/NbaWidget';
import { RainRadarWidget } from './widgets/RainRadarWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { GalleryWidget } from './widgets/GalleryWidget';
import { useStore } from '../store/useStore';

export const GridItem = ({ item, onContextMenu }) => {
    const { gridConfig, deleteItem, setWidgetSettings } = useStore();
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const getIcon = () => {
        if (item.type === 'widget' && (item.config?.type === 'search' || item.config?.type === 'weather' || item.config?.type === 'rss' || item.config?.type === 'clock' || item.config?.type === 'radar')) {
            return null;
        }

        const size = gridConfig.iconSize || 64;

        if (item.cache_icon) {
            return (
                <img
                    src={pb.files.getURL(item, item.cache_icon)}
                    alt={item.name}
                    style={{ width: `${size * 0.7}px`, height: `${size * 0.7}px`, borderRadius: `calc(10px * var(--radius-scale, 1))`, objectFit: 'contain' }}
                />
            );
        }

        if (item.type === 'link' && item.config?.url) {
            try {
                let urlStr = item.config.url;
                if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
                const url = new URL(urlStr);

                const getSrc = (attempt) => {
                    if (attempt === 0) return `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`;
                    if (attempt === 1) return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url.href}&size=256`;
                    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
                };

                return (
                    <img
                        src={getSrc(0)}
                        alt={item.name}
                        onError={(e) => {
                            const attempt = parseInt(e.target.dataset.attempt || '0');
                            if (attempt < 2) {
                                e.target.dataset.attempt = attempt + 1;
                                e.target.src = getSrc(attempt + 1);
                            }
                        }}
                        style={{ width: `${size * 0.6}px`, height: `${size * 0.6}px`, borderRadius: `calc(8px * var(--radius-scale, 1))`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                    />
                );
            } catch {
                // Fallback to globe
            }
        }

        switch (item.type) {
            case 'link': return <Globe size={size * 0.5} opacity={0.6} color="var(--accent-primary)" />;
            case 'file': return <FileIcon size={size * 0.5} opacity={0.6} color="var(--accent-secondary)" />;
            case 'widget': return <Layout size={size * 0.5} opacity={0.6} />;
            default: return <Layout size={size * 0.5} opacity={0.6} />;
        }
    };

    const handleClick = async (e) => {
        const dist = Math.sqrt(
            Math.pow(e.clientX - dragStartPos.current.x, 2) +
            Math.pow(e.clientY - dragStartPos.current.y, 2)
        );
        if (dist > 5) return;

        if (item.type === 'link' && item.config?.url) {
            let url = item.config.url;
            if (!url.startsWith('http')) url = 'https://' + url;
            window.location.href = url;
        } else if (item.type === 'file' && item.payload) {
            try {
                const token = await pb.files.getToken();
                window.open(pb.files.getURL(item, item.payload, { token }), '_blank');
            } catch (error) {
                console.error('Failed to get file token', error);
                window.open(pb.files.getURL(item, item.payload), '_blank'); // fallback
            }
        }
    };

    if (item.type === 'widget') {
        let content;
        if (item.config?.type === 'search') content = <SearchWidget config={item.config} />;
        else if (item.config?.type === 'weather') content = <WeatherWidget config={item.config} item={item} />;
        else if (item.config?.type === 'rss') content = <RSSWidget config={item.config} />;
        else if (item.config?.type === 'clock') content = <ClockWidget config={item.config} />;
        else if (item.config?.type === 'quote') content = <QuoteWidget config={item.config} />;
        else if (item.config?.type === 'notes') content = <NotesWidget config={item.config} item={item} />;
        else if (item.config?.type === 'greeting') content = <GreetingWidget config={item.config} />;
        else if (item.config?.type === 'todo') content = <TodoWidget config={item.config} item={item} />;
        else if (item.config?.type === 'joke') content = <JokeWidget config={item.config} />;
        else if (item.config?.type === 'links') content = <LinksWidget config={item.config} item={item} />;
        else if (item.config?.type === 'github') content = <GithubWidget config={item.config} />;
        else if (item.config?.type === 'ipinfo') content = <IpInfoWidget config={item.config} />;
        else if (item.config?.type === 'message') content = <MessageWidget config={item.config} />;
        else if (item.config?.type === 'workhours') content = <WorkHoursWidget config={item.config} />;
        else if (item.config?.type === 'literatureclock') content = <LiteratureClockWidget config={item.config} />;
        else if (item.config?.type === 'js') content = <JsWidget config={item.config} />;
        else if (item.config?.type === 'nba') content = <NbaWidget config={item.config} />;
        else if (item.config?.type === 'radar') content = <RainRadarWidget config={item.config} />;
        else if (item.config?.type === 'calendar') content = <CalendarWidget config={item.config} />;
        else if (item.config?.type === 'gallery') content = <GalleryWidget config={item.config} item={item} />;
        else content = (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Layout size={32} opacity={0.6} />
                <span style={{ fontSize: '12px', opacity: 0.6 }}>{item.name}</span>
            </div>
        );

        return (
            <div
                className="glass-card widget-container drag-handle animate-fade-in"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onMouseDown={handleMouseDown}
                onContextMenu={(e) => onContextMenu(e, item.id)}
            >
                <div className="widget-controls">
                    <button className="control-btn" onClick={() => setWidgetSettings(true, item)}>
                        <Cog size={12} />
                    </button>
                    <button className="control-btn delete" onClick={() => deleteItem(item.id)}>
                        <X size={12} />
                    </button>
                </div>

                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div
            className="desktop-icon animate-fade-in"
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                height: '100%',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'center',
                padding: '8px 4px 0 4px',
                userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onContextMenu={(e) => onContextMenu(e, item.id)}
        >
            <div className="icon-wrapper" style={{
                width: '100%',
                aspectRatio: '1/1',
                maxHeight: '70%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                marginBottom: '4px',
                transition: 'transform 0.1s ease'
            }}>
                <div className="icon-hover-effect" style={{
                    position: 'absolute',
                    width: '110%',
                    height: '110%',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: `calc(12px * var(--radius-scale, 1))`,
                    opacity: 0,
                    transition: 'opacity 0.2s'
                }} />
                {getIcon()}
            </div>
            <span style={{
                fontSize: '11px',
                fontWeight: '500',
                color: 'white',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                maxWidth: '100%',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.2',
                padding: '0 2px'
            }}>
                {item.name}
            </span>
        </div>
    );
};
