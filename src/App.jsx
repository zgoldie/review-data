import { useEffect, useMemo, useState } from 'react'
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

const CHART_STYLES = {
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  text: 'var(--chart-text)',
  barStroke: 'var(--chart-bar-stroke)',
}

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
const pages = ['Data', 'About', 'Contribute']

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

function DistributionChart({ data, dataKey = 'pct', label, control }) {
  const maxValue = data.reduce((max, point) => Math.max(max, point[dataKey] ?? 0), 0)
  const maxTick = Math.max(10, Math.ceil(maxValue / 10) * 10)
  const yTicks = Array.from({ length: maxTick / 10 + 1 }, (_, index) => index * 10)

  return (
    <div className="chart-frame">
      {label || control ? (
        <div className="chart-head">
          {label ? <h3 className="chart-title">{label}</h3> : <span />}
          {control ? <div className="chart-control">{control}</div> : null}
        </div>
      ) : null}
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
            <defs>
              <pattern id="barHatchPos" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke={CHART_STYLES.barStroke} strokeWidth="2" />
              </pattern>
              <pattern id="barHatchNeg" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke={CHART_STYLES.barStroke} strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: CHART_STYLES.axis, fontSize: 11 }}
              axisLine={{ stroke: CHART_STYLES.axis }}
              tickLine={{ stroke: CHART_STYLES.axis }}
              tickFormatter={(value) => `${value} hrs`}
            />
            <YAxis
              ticks={yTicks}
              domain={[0, maxTick]}
              tick={{ fill: CHART_STYLES.axis, fontSize: 11 }}
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
      </div>
    </div>
  )
}

function TrendsChart({ data }) {
  const maxTrendValue = data.reduce((max, point) => Math.max(max, point.p0 + point.r0to10 + point.r10to25 + point.r25to75 + point.r75to90 + point.r90to100 || 0), 0)
  const maxTrendTick = Math.max(24, Math.ceil(maxTrendValue / 24) * 24)
  const trendTicks = Array.from({ length: Math.floor(maxTrendTick / 24) + 1 }, (_, index) => index * 24)

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
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART_STYLES.axis }}
              axisLine={{ stroke: CHART_STYLES.axis }}
              tickLine={{ stroke: CHART_STYLES.axis }}
            />
            <YAxis
              ticks={trendTicks}
              domain={[0, maxTrendTick]}
              tick={{ fill: CHART_STYLES.axis }}
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
      </div>
    </div>
  )
}

function MyAppChartPlaceholder() {
  const monthTicks = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
  const scaffoldData = monthTicks.map((month) => ({ month, value: 0 }))
  const yTicks = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240]

  return (
    <div className="chart-frame">
      <div className="chart-wrap myapp-wrap">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={scaffoldData} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke={CHART_STYLES.grid} />
            <XAxis dataKey="month" tick={{ fill: CHART_STYLES.axis }} axisLine={{ stroke: CHART_STYLES.axis }} tickLine={{ stroke: CHART_STYLES.axis }} />
            <YAxis ticks={yTicks} domain={[0, 240]} tick={{ fill: CHART_STYLES.axis }} axisLine={{ stroke: CHART_STYLES.axis }} tickLine={{ stroke: CHART_STYLES.axis }} unit="h" />
          </ComposedChart>
        </ResponsiveContainer>
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
              href="https://developer.apple.com/help/app-store-connect/manage-your-team/manage-webhooks/#:~:text=In%20Users-,and,-Access%2C%20click%20Integrations"
              target="_blank"
              rel="noreferrer"
            >
              App Store Connect
            </a>
            .
          </li>
          <li>Add a webhook using that secret and a URL of something.com.</li>
        </ol>
        <p>
          And you&apos;re done.<br />
          Your data will pull through, and you'll be able to see the trend for your own reviews.
        </p>
   
      </div>
    </section>
  )
}

function App() {
  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const [activePage, setActivePage] = useState('Data')
  const [activeTab, setActiveTab] = useState('Overview')
  const [rangeDays, setRangeDays] = useState(30)
  const [overviewData, setOverviewData] = useState(EMPTY_DISTRIBUTION)
  const [trendsData, setTrendsData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overviewStatsRaw, setOverviewStatsRaw] = useState({ apps: 0, reviews: 0, range: 'last 30 days', under24hrs: 0, under48hrs: 0, rejected: 0 })

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
          <button type="button" className="login-button">
            Log In
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
            <p className="chart-title">Connect your app to see your under-24hrs share.</p>
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

      {activePage === 'Contribute' && (
        <ContributePanel />
      )}
    </main>
  )
}

export default App
