import React, { useState } from 'react';
import { X, Save, Clock, Cloud, Rss, Search, Quote, Edit3, Sun, CheckSquare, Smile, Link as LinkIcon, Github, Globe, MessageSquare, Briefcase, BookOpen, Code, Trophy, Map, CalendarDays, Image } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ClockWidgetSettings } from './widgets/ClockWidget';
import { WeatherWidgetSettings } from './widgets/WeatherWidget';
import { SearchWidgetSettings } from './widgets/SearchWidget';
import { RSSWidgetSettings } from './widgets/RSSWidget';
import { QuoteWidgetSettings } from './widgets/QuoteWidget';
import { NotesWidgetSettings } from './widgets/NotesWidget';
import { GreetingWidgetSettings } from './widgets/GreetingWidget';
import { TodoWidgetSettings } from './widgets/TodoWidget';
import { JokeWidgetSettings } from './widgets/JokeWidget';
import { LinksWidgetSettings } from './widgets/LinksWidget';
import { GithubWidgetSettings } from './widgets/GithubWidget';
import { IpInfoWidgetSettings } from './widgets/IpInfoWidget';
import { MessageWidgetSettings } from './widgets/MessageWidget';
import { WorkHoursWidgetSettings } from './widgets/WorkHoursWidget';
import { LiteratureClockWidgetSettings } from './widgets/LiteratureClockWidget';
import { JsWidgetSettings } from './widgets/JsWidget';
import { NbaWidgetSettings } from './widgets/NbaWidget';
import { RainRadarWidgetSettings } from './widgets/RainRadarWidget';
import { CalendarWidgetSettings } from './widgets/CalendarWidget';
import { GalleryWidgetSettings } from './widgets/GalleryWidget';

const SETTINGS_MAP = {
    clock: ClockWidgetSettings,
    weather: WeatherWidgetSettings,
    search: SearchWidgetSettings,
    rss: RSSWidgetSettings,
    quote: QuoteWidgetSettings,
    notes: NotesWidgetSettings,
    greeting: GreetingWidgetSettings,
    todo: TodoWidgetSettings,
    joke: JokeWidgetSettings,
    links: LinksWidgetSettings,
    github: GithubWidgetSettings,
    ipinfo: IpInfoWidgetSettings,
    message: MessageWidgetSettings,
    workhours: WorkHoursWidgetSettings,
    literatureclock: LiteratureClockWidgetSettings,
    js: JsWidgetSettings,
    nba: NbaWidgetSettings,
    radar: RainRadarWidgetSettings,
    calendar: CalendarWidgetSettings,
    gallery: GalleryWidgetSettings
};

const ICON_MAP = {
    clock: Clock,
    weather: Cloud,
    rss: Rss,
    search: Search,
    quote: Quote,
    notes: Edit3,
    greeting: Sun,
    todo: CheckSquare,
    joke: Smile,
    links: LinkIcon,
    github: Github,
    ipinfo: Globe,
    message: MessageSquare,
    workhours: Briefcase,
    literatureclock: BookOpen,
    js: Code,
    nba: Trophy,
    radar: Map,
    calendar: CalendarDays,
    gallery: Image
};

const WidgetSettingsContent = ({ item }) => {
    const { setWidgetSettings, updateItem } = useStore();
    const [config, setConfig] = useState(item.config || {});
    const [name, setName] = useState(item.name || '');

    const handleSave = async () => {
        await updateItem(item.id, { config, name });
        setWidgetSettings(false);
    };

    const widgetType = config.type;
    const SettingsComponent = SETTINGS_MAP[widgetType];
    const IconComponent = ICON_MAP[widgetType] || Clock;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
            <div style={{
                width: '400px', borderRadius: `calc(24px * var(--radius-scale, 1))`, padding: '24px',
                display: 'flex', flexDirection: 'column', gap: '20px',
                background: 'rgba(18, 18, 18, 0.96)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconComponent size={20} color="var(--accent-primary)" />
                        <h2 style={{ fontSize: '1.2rem', margin: 0, textTransform: 'capitalize' }}>
                            {widgetType} Settings
                        </h2>
                    </div>
                    <button
                        onClick={() => setWidgetSettings(false)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Widget Name</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`e.g. Groceries, Tasks...`}
                            style={{
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                padding: '8px 12px', borderRadius: `calc(8px * var(--radius-scale, 1))`,
                                color: 'white', fontSize: '0.9rem'
                            }}
                        />
                    </label>

                    {SettingsComponent ? (
                        <SettingsComponent config={config} setConfig={setConfig} />
                    ) : (
                        <div style={{ opacity: 0.6, fontSize: '0.9rem', textAlign: 'center' }}>
                            Advanced settings for {widgetType} coming soon.
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button
                        onClick={handleSave}
                        className="glass"
                        style={{
                            flex: 1, padding: '12px', borderRadius: `calc(12px * var(--radius-scale, 1))`, background: 'var(--accent-primary)',
                            color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export const WidgetSettings = () => {
    const { widgetSettings } = useStore();
    const { isOpen, item } = widgetSettings;

    if (!isOpen || !item) return null;

    return <WidgetSettingsContent key={item.id} item={item} />;
};
