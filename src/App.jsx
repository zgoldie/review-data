import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from './lib/supabaseClient'

const CHART_STYLES = {
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  text: 'var(--chart-text)',
  barStroke: 'var(--chart-bar-stroke)',
}
const SHOW_DUMMY_WATERMARK = true

const EMPTY_DISTRIBUTION = ['0-12', '12-24', '24-36', '36-48', '48-60', '60-72', '72-84', '84-96', '96-108', '108-120', '120+'].map((bucket) => ({
  bucket,
  pct: 0,
}))

const toStackedTrendData = (rawTrendsData) =>
  rawTrendsData.map((point) => ({
    month: point.month,
    p0: Number(point.p0 ?? 0),
    p10: Number(point.p10 ?? 0),
    p25: Number(point.p25 ?? 0),
    p75: Number(point.p75 ?? 0),
    p90: Number(point.p90 ?? 0),
    p100: Number(point.p100 ?? 0),
    r0to10: Number(point.p10 ?? 0) - Number(point.p0 ?? 0),
    r10to25: Number(point.p25 ?? 0) - Number(point.p10 ?? 0),
    r25to75: Number(point.p75 ?? 0) - Number(point.p25 ?? 0),
    r75to90: Number(point.p90 ?? 0) - Number(point.p75 ?? 0),
    r90to100: Number(point.p100 ?? 0) - Number(point.p90 ?? 0),
    p50: Number(point.p50 ?? 0),
  }))

const tabs = ['Overview', 'Trend', 'My App']
const pages = ['Data', 'About', 'Add Data']

function StatsBar({ items }) {
  return (
    <div className="stats-bar">
      {items.map((item) => (
        <div key={item} className="stats-item">
          {item}
        </div>
      ))}
    </div>
  )
}

function ScrollableChartArea({ isMobile, minWidth = 760, children }) {
  const scrollRef = useRef(null)
  const dragRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 })

  function scrollByOffset(offset) {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  function handlePointerDown(event) {
    if (!scrollRef.current) return
    dragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: scrollRef.current.scrollLeft,
    }
    scrollRef.current.classList.add('is-dragging')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    if (!scrollRef.current || !dragRef.current.isDragging) return
    const delta = event.clientX - dragRef.current.startX
    scrollRef.current.scrollLeft = dragRef.current.startScrollLeft - delta
  }

  function handlePointerUp(event) {
    if (!scrollRef.current) return
    dragRef.current.isDragging = false
    scrollRef.current.classList.remove('is-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div className="chart-scroll-shell">
      {isMobile ? (
        <div className="chart-scroll-controls" aria-label="Chart horizontal controls">
          <button type="button" className="chart-scroll-button" onClick={() => scrollByOffset(-160)}>
            {'<'}
          </button>
          <button type="button" className="chart-scroll-button" onClick={() => scrollByOffset(160)}>
            {'>'}
          </button>
        </div>
      ) : null}
      <div
        className="chart-scroll-track"
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="chart-scroll-inner" style={isMobile ? { width: `${minWidth}px` } : { width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function DistributionChart({ data, dataKey = 'pct', label, control }) {
  const maxValue = data.reduce((max, point) => Math.max(max, point[dataKey] ?? 0), 0)
  const maxTick = Math.max(10, Math.ceil(maxValue / 10) * 10)
  const yTicks = Array.from({ length: maxTick / 10 + 1 }, (_, index) => index * 10)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches

  return (
    <div className="chart-frame">
      {label || control ? (
        <div className="chart-head">
          {label ? <h3 className="chart-title">{label}</h3> : <span />}
          {control ? <div className="chart-control">{control}</div> : null}
        </div>
      ) : null}
      <div className="chart-wrap">
        {SHOW_DUMMY_WATERMARK ? <div className="dummy-watermark">Dummy Data</div> : null}
        <ScrollableChartArea isMobile={isMobile} minWidth={780}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={isMobile ? { top: 12, right: 10, left: 0, bottom: 8 } : { top: 16, right: 18, left: 0, bottom: 8 }}>
              <defs>
                <pattern id="barHatchPos" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="var(--chart-bar-fill)" />
                  <line x1="0" y1="0" x2="0" y2="8" stroke={CHART_STYLES.barStroke} strokeWidth="2" />
                </pattern>
                <pattern id="barHatchNeg" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <rect width="8" height="8" fill="var(--chart-bar-fill)" />
                  <line x1="0" y1="0" x2="0" y2="8" stroke={CHART_STYLES.barStroke} strokeWidth="2" />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
              <XAxis
                dataKey="bucket"
                tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 11 : 11 }}
                axisLine={{ stroke: CHART_STYLES.axis }}
                tickLine={{ stroke: CHART_STYLES.axis }}
                interval={0}
              />
              <YAxis
                ticks={yTicks}
                domain={[0, maxTick]}
                width={isMobile ? 32 : 36}
                tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 10 : 11 }}
                axisLine={{ stroke: CHART_STYLES.axis }}
                tickLine={{ stroke: CHART_STYLES.axis }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                cursor={false}
                formatter={(value) => `${value}%`}
                labelFormatter={(label) => `${label} hrs`}
                separator=": "
                contentStyle={{
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text)',
                  padding: '6px 8px',
                }}
                wrapperStyle={{ outline: 'none' }}
              />
              <Bar dataKey={dataKey} stroke={CHART_STYLES.barStroke} strokeWidth={0.7}>
                {data.map((entry, index) => (
                  <Cell key={`${entry.bucket}-${index}`} fill={index % 2 === 0 ? 'url(#barHatchPos)' : 'url(#barHatchNeg)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ScrollableChartArea>
      </div>
    </div>
  )
}

function TrendsChart({ data }) {
  const maxTrendValue = data.reduce((max, point) => Math.max(max, point.p0 + point.r0to10 + point.r10to25 + point.r25to75 + point.r75to90 + point.r90to100 || 0), 0)
  const maxTrendTick = Math.max(24, Math.ceil(maxTrendValue / 24) * 24)
  const trendTicks = Array.from({ length: Math.floor(maxTrendTick / 24) + 1 }, (_, index) => index * 24)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches

  function renderTrendsTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null
    const point = payload[0].payload
    if (!point) return null
    const formatHours = (value) => {
      const hours = Number(value)
      return Number.isFinite(hours) ? `${Math.round(hours)}h` : '--'
    }

    return (
      <div className="trends-tooltip">
        <div className="trends-tooltip-title">{point.month}</div>
        <div>Fastest 10%: under {formatHours(point.p10)}</div>
        <div>Fastest 25%: under {formatHours(point.p25)}</div>
        <div>Fastest 75%: under {formatHours(point.p75)}</div>
        <div>Fastest 90%: under {formatHours(point.p90)}</div>
        <div>Slowest review: {formatHours(point.p100)}</div>
        <div className="trends-tooltip-divider" />
        <div>Median: {formatHours(point.p50)}</div>
      </div>
    )
  }

  return (
    <div className="chart-frame">
      <div className="chart-wrap trends-wrap">
        {SHOW_DUMMY_WATERMARK ? <div className="dummy-watermark">Dummy Data</div> : null}
        <ScrollableChartArea isMobile={isMobile} minWidth={740}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={isMobile ? { top: 12, right: 10, left: 0, bottom: 14 } : { top: 16, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 10 : 12 }}
              axisLine={{ stroke: CHART_STYLES.axis }}
              tickLine={{ stroke: CHART_STYLES.axis }}
              interval={0}
            />
            <YAxis
              ticks={trendTicks}
              domain={[0, maxTrendTick]}
              width={isMobile ? 32 : 36}
              tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 10 : 12 }}
              axisLine={{ stroke: CHART_STYLES.axis }}
              tickLine={{ stroke: CHART_STYLES.axis }}
              unit="h"
            />
            <Tooltip content={renderTrendsTooltip} />
            <Bar dataKey="p0" stackId="ranges" fill="transparent" stroke="none" />
            <Bar dataKey="r0to10" stackId="ranges" fill="var(--trend-band-1)" stroke="none" />
            <Bar dataKey="r10to25" stackId="ranges" fill="var(--trend-band-2)" stroke="none" />
            <Bar dataKey="r25to75" stackId="ranges" fill="var(--trend-band-3)" stroke="none" />
            <Bar dataKey="r75to90" stackId="ranges" fill="var(--trend-band-4)" stroke="none" />
            <Bar dataKey="r90to100" stackId="ranges" fill="var(--trend-band-5)" stroke="none" />
            <Line type="linear" dataKey="p50" stroke={CHART_STYLES.text} strokeWidth={2} dot={{ r: 2.5, fill: CHART_STYLES.text }} name="Median" />
            </ComposedChart>
          </ResponsiveContainer>
        </ScrollableChartArea>
      </div>
    </div>
  )
}

function MyAppChartPlaceholder() {
  const monthTicks = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
  const scaffoldData = monthTicks.map((month) => ({ month, value: 0 }))
  const yTicks = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240]
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches

  return (
    <div className="chart-frame">
      <div className="chart-wrap myapp-wrap">
        <ScrollableChartArea isMobile={isMobile} minWidth={740}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={scaffoldData} margin={isMobile ? { top: 12, right: 10, left: 0, bottom: 14 } : { top: 16, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
              <XAxis dataKey="month" tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 10 : 12 }} axisLine={{ stroke: CHART_STYLES.axis }} tickLine={{ stroke: CHART_STYLES.axis }} interval={0} />
              <YAxis ticks={yTicks} domain={[0, 240]} width={isMobile ? 32 : 36} tick={{ fill: CHART_STYLES.axis, fontSize: isMobile ? 10 : 12 }} axisLine={{ stroke: CHART_STYLES.axis }} tickLine={{ stroke: CHART_STYLES.axis }} unit="h" />
            </ComposedChart>
          </ResponsiveContainer>
        </ScrollableChartArea>
        <div className="myapp-empty">Connect Your App</div>
      </div>
    </div>
  )
}

function AboutPanel() {
  return (
    <section className="about-panel">
      <div className="about-content">
        <h2>Why we made this</h2>
        <p>
          Apple says 90% of apps are reviewed within 24 hours. We&apos;re hearing lots of anecdotes about it actually taking days.
        </p>
        <p>
          There&apos;s no public way to see how true the claim is, so we felt there should be a crowdsourced, automated answer.
        </p>

        <h2>How it works</h2>
        <p>
          Data is collected via App Store Connect webhooks. Developers who contribute point their ASC webhook at our endpoint, and we receive anonymous state change notifications as their submissions move through the review process.
        </p>
        <p>
          We record only the timestamps and state transitions, there&apos;s no deep integration. The more developers contribute, the more accurate the picture becomes.
        </p>

        <h2>Contribute your data</h2>
        <p>
          If you submit apps to the App Store, you can help. It takes about two minutes to set up and runs silently in the background from then on.
        </p>
        <button type="button" className="about-cta">
          Contribute -
          {'>'}
        </button>
      </div>
    </section>
  )
}

function ContributePanel() {
  return (
    <section className="about-panel">
      <div className="about-content">
        <h2>How to contribute</h2>
        <ol className="contribute-steps">
          <li>Sign up.</li>
          <li>Receive a secret.</li>
          <li>
            Go to{' '}
            <a
              href="https://appstoreconnect.apple.com/access/integrations/webhooks"
              target="_blank"
              rel="noreferrer"
            >
              App Store Connect
            </a>
            .
          </li>
          <li>Create a webhook and give it a name for your own reference (for example, &quot;Review Stats&quot;).</li>
          <li>Add the provided URL and your generated secret.</li>
          <li>Select the event triggers: &quot;App Version Status&quot; and &quot;Build Version Status&quot;.</li>
        </ol>
        <p>
          And you&apos;re done.<br />
          Your data will pull through, and you'll be able to see the trend for your own reviews.
        </p>

        <h2>Data Safety</h2>
        <p>
          The webhook payload is lightweight. It only includes event identifiers, app version identifiers, state transitions, and timestamps.
        </p>
        <p>
          It does not include any sensitive information about your application, and is a one-way inbound connection without any permissions or ability to make changes.
        </p>
   
      </div>
    </section>
  )
}

function CopyIcon({ copied }) {
  if (copied) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="4" width="11" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="5" y="7" width="11" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function AccountsPanel({
  session,
  authMode,
  authEmail,
  authPassword,
  authPending,
  authError,
  authInfo,
  myAppSetup,
  latestSecret,
  onSecretAction,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSignOut,
}) {
  const webhookUrl = myAppSetup.webhookUrl || 'Unavailable until account setup completes'
  const ascWebhookHelpUrl = 'https://appstoreconnect.apple.com/access/integrations/webhooks'
  const [copiedField, setCopiedField] = useState('')

  async function copyValue(value, field) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? '' : current))
      }, 1500)
    } catch {
      setCopiedField('')
    }
  }

  if (session) {
    return (
      <section className="auth-panel">
        <div className="auth-block">
          <p className="auth-section-title">Webhook Credentials</p>
          <p className="chart-title">
            {myAppSetup.secretConfigured ? `Current secret: ${myAppSetup.secretPreview}` : 'No webhook secret configured yet.'}
          </p>
          <div className="auth-actions">
            {!myAppSetup.secretConfigured ? (
              <button type="button" className="login-button" onClick={() => onSecretAction('create')} disabled={myAppSetup.loading}>
                {myAppSetup.loading ? 'Working...' : 'Generate secret'}
              </button>
            ) : (
              <button type="button" className="login-button" onClick={() => onSecretAction('rotate')} disabled={myAppSetup.loading}>
                {myAppSetup.loading ? 'Working...' : 'Rotate secret'}
              </button>
            )}
            <button type="button" className="login-button" onClick={onSignOut}>
              Log Out
            </button>
          </div>
          {latestSecret ? (
            <div className="copy-row">
              <p className="auth-info">Copy this now: {latestSecret}</p>
              <button
                type="button"
                className={`copy-icon-button ${copiedField === 'secret' ? 'is-copied' : ''}`}
                aria-label="Copy secret"
                onClick={() => copyValue(latestSecret, 'secret')}
              >
                <CopyIcon copied={copiedField === 'secret'} />
              </button>
              {copiedField === 'secret' ? <span className="copy-feedback">Copied</span> : null}
            </div>
          ) : null}
          <div className="copy-row">
            <p className="auth-info">
              Endpoint URL: <code>{webhookUrl}</code>
            </p>
            <button
              type="button"
              className={`copy-icon-button ${copiedField === 'url' ? 'is-copied' : ''}`}
              aria-label="Copy webhook URL"
              onClick={() => copyValue(webhookUrl, 'url')}
              disabled={!myAppSetup.webhookUrl}
            >
              <CopyIcon copied={copiedField === 'url'} />
            </button>
            {copiedField === 'url' ? <span className="copy-feedback">Copied</span> : null}
          </div>
        </div>

        <div className="auth-block">
          <p className="auth-section-title">Setup Steps</p>
          <ol className="account-steps">
            <li>
              Open{' '}
              <a href={ascWebhookHelpUrl} target="_blank" rel="noreferrer">
                App Store Connect webhooks
              </a>
              .
            </li>
            <li>Create a new webhook.</li>
            <li>Name it for reference (for example, &quot;Review Stats&quot;).</li>
            <li>Paste your endpoint URL from above.</li>
            <li>Add the secret from above in ASC webhook &quot;Secret&quot;.</li>
            <li>Set event triggers: &quot;App Version Status&quot; and &quot;Build Version Status&quot;.</li>
          </ol>
        </div>
        {myAppSetup.error ? <p className="auth-error">{myAppSetup.error}</p> : null}
      </section>
    )
  }

  return (
    <section className="auth-panel">
      <p className="chart-title">Log in to set up your webhook secret</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <input type="email" value={authEmail} onChange={(event) => onEmailChange(event.target.value)} placeholder="Email" required />
        <input type="password" value={authPassword} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" required />
        <div className="auth-actions">
          <button type="submit" className="login-button" disabled={authPending}>
            {authPending ? 'Working...' : authMode === 'signup' ? 'Create account' : 'Log in'}
          </button>
          <button type="button" className="page-button auth-switch" onClick={() => onModeChange(authMode === 'signup' ? 'login' : 'signup')}>
            {authMode === 'signup' ? 'Have an account? Log in' : 'Need an account? Sign up'}
          </button>
        </div>
        {authError ? <p className="auth-error">{authError}</p> : null}
        {authInfo ? <p className="auth-info">{authInfo}</p> : null}
      </form>
    </section>
  )
}

function AccountPage(props) {
  return (
    <section className="about-panel">
      <div className="about-content">
        <h2>Account</h2>
        <AccountsPanel {...props} />
      </div>
    </section>
  )
}

function App() {
  async function parseJsonResponse(response) {
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      return { error: text || 'Unexpected non-JSON response' }
    }
    return response.json()
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const [activePage, setActivePage] = useState('Data')
  const [activeTab, setActiveTab] = useState('Overview')
  const [rangeDays, setRangeDays] = useState(30)
  const [overviewData, setOverviewData] = useState(EMPTY_DISTRIBUTION)
  const [trendsData, setTrendsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authSession, setAuthSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authPending, setAuthPending] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authInfo, setAuthInfo] = useState('')
  const [myAppSetup, setMyAppSetup] = useState({ loading: false, error: '', secretConfigured: false, secretPreview: '', webhookUrl: '' })
  const [latestSecret, setLatestSecret] = useState('')
  const [overviewStatsRaw, setOverviewStatsRaw] = useState({ apps: 0, reviews: 0, range: 'last 30 days', under24hrs: 0, under48hrs: 0, rejected: 0 })
  const authToken = useMemo(() => authSession?.access_token || '', [authSession])

  const overviewStats = useMemo(
    () => [
      `Apps: ${overviewStatsRaw.apps}`,
      `Reviews: ${overviewStatsRaw.reviews}`,
      `Under 24hrs: ${overviewStatsRaw.under24hrs}%`,
      `Under 48hrs: ${overviewStatsRaw.under48hrs}%`,
      `Rejected: ${overviewStatsRaw.rejected}%`,
    ],
    [overviewStatsRaw],
  )
  const overviewClaimText = useMemo(
    () => `Apple claims 90% under 24hrs. Currently ${overviewStatsRaw.under24hrs}%`,
    [overviewStatsRaw.under24hrs],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (event) => {
      const isDark = typeof event?.matches === 'boolean' ? event.matches : media.matches
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    }

    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [])

  useEffect(() => {
    if (!supabase) return

    const openedFromAuthRedirect =
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('type=signup') ||
      window.location.search.includes('type=signup')
    if (openedFromAuthRedirect) {
      setActivePage('Account')
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthSession(data.session || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session || null)
      setAuthError('')
      setAuthInfo('')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [overviewRes, trendsRes] = await Promise.all([
          fetch(`${apiBase}/api/metrics/overview?rangeDays=${rangeDays}`),
          fetch(`${apiBase}/api/metrics/trends?months=9`),
        ])

        if (!overviewRes.ok || !trendsRes.ok) {
          throw new Error('Failed to load metrics')
        }

        const overviewPayload = await overviewRes.json()
        const trendsPayload = await trendsRes.json()

        setOverviewData(overviewPayload.distribution)
        setOverviewStatsRaw(overviewPayload.stats)
        setTrendsData(toStackedTrendData(trendsPayload.trends))
      } catch (loadError) {
        setError(loadError.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [apiBase, rangeDays])

  useEffect(() => {
    async function loadMyAppSetup() {
      if (!authToken || activePage !== 'Account') return
      try {
        setMyAppSetup((state) => ({ ...state, loading: true, error: '' }))
        const response = await fetch(`${apiBase}/api/my-app/setup`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const payload = await parseJsonResponse(response)
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load setup')
        }
        setMyAppSetup({
          loading: false,
          error: '',
          secretConfigured: Boolean(payload.secretConfigured),
          secretPreview: payload.secretPreview || '',
          webhookUrl: payload.webhookUrl || '',
        })
      } catch (setupError) {
        setMyAppSetup((state) => ({ ...state, loading: false, error: setupError.message || 'Failed to load setup' }))
      }
    }

    loadMyAppSetup()
  }, [activePage, apiBase, authToken])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    if (!supabase) {
      setAuthError('Missing Supabase frontend env vars.')
      return
    }
    try {
      setAuthPending(true)
      setAuthError('')
      setAuthInfo('')
      if (authMode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
        if (signUpError) throw signUpError
        setAuthInfo('Account created. You can now log in.')
        setAuthMode('login')
        setActivePage('Account')
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (signInError) throw signInError
    } catch (submitError) {
      setAuthError(submitError.message || 'Authentication failed')
    } finally {
      setAuthPending(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setLatestSecret('')
    setMyAppSetup({ loading: false, error: '', secretConfigured: false, secretPreview: '', webhookUrl: '' })
  }

  async function handleSecretAction(action) {
    if (!authToken) return
    try {
      setMyAppSetup((state) => ({ ...state, loading: true, error: '' }))
      const endpoint = action === 'create' ? '/api/my-app/secret' : '/api/my-app/secret/rotate'
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const payload = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to manage secret')
      }
      setLatestSecret(payload.secret || '')
      setMyAppSetup((state) => ({
        ...state,
        loading: false,
        error: '',
        secretConfigured: true,
        secretPreview: payload.secretPreview || '',
      }))
    } catch (secretError) {
      setMyAppSetup((state) => ({ ...state, loading: false, error: secretError.message || 'Failed to manage secret' }))
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <h1>App Store Review Times</h1>
        <nav className="page-nav" aria-label="Page tabs">
          {pages.map((page) => (
            <button key={page} type="button" className={`page-button ${activePage === page ? 'is-active' : ''}`} onClick={() => setActivePage(page)}>
              {page}
            </button>
          ))}
          <button
            type="button"
            className="login-button"
            onClick={() => {
              if (!authSession) setAuthMode('login')
              setActivePage('Account')
            }}
          >
            {authSession ? 'Accounts' : 'Log In'}
          </button>
        </nav>
      </header>

      {activePage === 'Data' && (
      <nav className="tabs" aria-label="Dashboard tabs">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={`tab-button ${activeTab === tab ? 'is-active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
      )}

      {loading ? <section className="chart-frame"><p className="chart-title">Loading data...</p></section> : null}
      {error ? <section className="chart-frame"><p className="chart-title">Error: {error}</p></section> : null}

      {!loading && !error && activePage === 'Data' && activeTab === 'Overview' && (
        <section className="tab-panel">
          <DistributionChart
            data={overviewData}
            control={(
              <label className="select-wrap overview-range-wrap">
                <span>Range:</span>
                <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </label>
            )}
          />
          <section className="chart-frame">
            <p className="chart-title">{overviewClaimText}</p>
          </section>
          <StatsBar items={overviewStats} />
        </section>
      )}

      {!loading && !error && activePage === 'Data' && activeTab === 'Trend' && (
        <section className="tab-panel">
          <TrendsChart data={trendsData} />
          <section className="chart-frame">
            <p className="chart-title">{overviewClaimText}</p>
          </section>
          <StatsBar items={overviewStats} />
        </section>
      )}

      {!loading && !error && activePage === 'Data' && activeTab === 'My App' && (
        <section className="tab-panel">
          <MyAppChartPlaceholder />
          <section className="chart-frame">
            <p className="chart-title">
              {authSession
                ? 'Open Accounts above to manage your webhook secret, then watch your app-specific trend populate.'
                : 'Log in from Accounts above to generate a webhook secret for your app.'}
            </p>
          </section>
          <StatsBar
            items={[
              'Apps: 1',
              'Reviews: -',
              'Under 24hrs: -',
              'Under 48hrs: -',
              'Rejected: -',
            ]}
          />
        </section>
      )}

      {activePage === 'About' && (
        <AboutPanel />
      )}

      {activePage === 'Add Data' && (
        <ContributePanel />
      )}

      {activePage === 'Account' && (
        <AccountPage
          session={authSession}
          authMode={authMode}
          authEmail={authEmail}
          authPassword={authPassword}
          authPending={authPending}
          authError={authError}
          authInfo={authInfo}
          myAppSetup={myAppSetup}
          latestSecret={latestSecret}
          onSecretAction={handleSecretAction}
          onModeChange={setAuthMode}
          onEmailChange={setAuthEmail}
          onPasswordChange={setAuthPassword}
          onSubmit={handleAuthSubmit}
          onSignOut={handleSignOut}
        />
      )}
    </main>
  )
}

export default App
