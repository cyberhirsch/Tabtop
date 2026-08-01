import { Canvas } from './components/Canvas'
import { Settings } from './components/Settings'
import { WidgetSettings } from './components/WidgetSettings'
import { Welcome } from './components/Welcome'
import { WidgetGallery } from './components/WidgetGallery'
import { AdminPanel } from './components/AdminPanel'
import { CompanionApp } from './components/CompanionApp'
import { useStore } from './store/useStore'

function App() {
  const user = useStore(state => state.user)
  const isMobileApp = window.location.pathname === '/mobile' || window.location.pathname.startsWith('/mobile/')

  if (isMobileApp) {
    return <CompanionApp />
  }

  if (!user) {
    return (
      <main className="animate-fade-in">
        <Welcome />
      </main>
    )
  }

  const checkTrialStatus = () => {
    const role = Array.isArray(user.account_type) ? user.account_type[0] : user.account_type;
    if (role === 'admin' || role === 'patron') return true; // Always allow admins and active patrons

    // Fallback to creation date if trial_started_at is missing (for older accounts)
    const startDate = user.trial_started_at ? new Date(user.trial_started_at) : new Date(user.created);
    const now = new Date();

    // 14 days trial duration
    const trialDurationDays = 14;
    const diffTime = Math.abs(now - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= trialDurationDays;
  };

  const isTrialActive = checkTrialStatus();

  if (!isTrialActive) {
    return (
      <main className="animate-fade-in" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card" style={{ padding: '40px', maxWidth: '500px', textAlign: 'center', borderRadius: 'calc(24px * var(--radius-scale, 1))' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '16px', color: '#f96854' }}>Free Trial Expired</h2>
          <p style={{ fontSize: '1.1rem', opacity: 0.8, lineHeight: '1.6', marginBottom: '32px' }}>
            We hope you've enjoyed your 14-day trial of Tabtop! To keep your dashboard running and support the future of the project, please support us on Patreon.
          </p>
          <a href="https://patreon.com/" target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '16px 32px', background: '#f96854', color: 'white', textDecoration: 'none', borderRadius: 'calc(12px * var(--radius-scale, 1))', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '16px' }}>
            Become a Patron
          </a>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
            <button
                onClick={() => {
                    import('./api/pocketbase').then(module => {
                        module.pb.collection('TabtopUsers').authRefresh()
                            .then(({ record }) => {
                                console.log('Refreshed User Data:', record);
                                useStore.getState().setUser(record);
                                // Don't reload, just let React re-render with new state
                            })
                            .catch(err => {
                                alert('Failed to refresh status. Try logging out and back in.');
                                console.error(err);
                            });
                    });
                }}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px 24px', borderRadius: 'calc(8px * var(--radius-scale, 1))', cursor: 'pointer', fontSize: '0.9rem' }}
            >
                🔄 Refresh My Account
            </button>
            
            {/* Hidden Debug Info (Clickable area near logo to reveal) */}
            <div style={{ marginTop: '20px', fontSize: '0.7rem', opacity: 0.2, textAlign: 'left', width: '100%' }}>
                <details>
                    <summary style={{ cursor: 'pointer' }}>Diagnostic Info</summary>
                    <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '150px' }}>
                        {JSON.stringify({
                            id: user.id,
                            email: user.email,
                            account_type: user.account_type,
                            trial_started_at: user.trial_started_at,
                            created: user.created,
                            isTrialActive: isTrialActive
                        }, null, 2)}
                    </pre>
                </details>
            </div>

            <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: '8px' }}>
                I am already a Patron (Try the refresh button above)
            </p>
            <button
                onClick={() => {
                import('./api/pocketbase').then(module => {
                    module.pb.authStore.clear();
                    useStore.getState().setUser(null);
                });
                }}
                style={{ background: 'none', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer', textDecoration: 'underline' }}
            >
                Log out
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="animate-fade-in">
      <Canvas />
      <Settings />
      <WidgetSettings />
      <WidgetGallery />
      <AdminPanel />
    </main>
  )
}

export default App
