import { useState, useEffect, useCallback, type FormEvent } from 'react'
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Bitcoin,
  Globe,
  RefreshCw,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Database,
} from 'lucide-react'

type ListSummary = {
  totalEntities: number
  totalAddresses: number
  activeLists: number
  lists: Array<{
    id: number
    name: string
    source: string
    description: string
    lastSync: string | null
    entityCount: number
    addressCount: number
    status: string
    errorMessage: string | null
    updatedAt: string | null
  }>
}

type EntityMatch = {
  id: number
  sdnId: string | null
  name: string
  aliases: string[]
  entityType: string
  programs: string[]
  country: string | null
  remarks: string | null
  listName: string
}

type CryptoMatch = {
  id: number
  address: string
  network: string
  entityName: string | null
  sdnId: string | null
  programs: string[]
  listName: string
}

type CheckResult = {
  match: boolean
  query: string
  type: string
  entityMatches: EntityMatch[]
  cryptoMatches: CryptoMatch[]
  totalMatches: number
  timestamp: string
}

type CryptoResult = {
  sanctioned: boolean
  address: string
  network: string | null
  matches: Array<{
    id: number
    address: string
    network: string
    entityName: string | null
    sdnId: string | null
    programs: string[]
    listName: string
  }>
  timestamp: string
}

type SearchMode = 'entity' | 'crypto'

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    syncing: 'bg-blue-100 text-blue-700 border border-blue-200',
    error: 'bg-red-100 text-red-700 border border-red-200',
    pending: 'bg-gray-100 text-gray-500 border border-gray-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status === 'syncing' && (
        <RefreshCw className="w-3 h-3 animate-spin" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function NetworkBadge({ network }: { network: string }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-100 text-orange-700',
    ETH: 'bg-indigo-100 text-indigo-700',
    TRX: 'bg-red-100 text-red-700',
    XMR: 'bg-gray-100 text-gray-700',
    USDT: 'bg-green-100 text-green-700',
    USDC: 'bg-blue-100 text-blue-700',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide ${colors[network] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {network}
    </span>
  )
}

function EntityCard({ entity }: { entity: EntityMatch }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              {entity.entityType === 'individual' ? (
                <User className="w-5 h-5 text-red-500" />
              ) : (
                <Building2 className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 leading-tight">
                {entity.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">
                {entity.entityType} · {entity.listName}
                {entity.sdnId && ` · SDN #${entity.sdnId}`}
                {entity.country && ` · ${entity.country}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {entity.programs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entity.programs.map((p) => (
              <span
                key={p}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
          {entity.aliases.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Also known as
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entity.aliases.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entity.remarks && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Remarks
              </p>
              <p className="text-sm text-gray-600">{entity.remarks}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CryptoCard({ match }: { match: CryptoMatch }) {
  return (
    <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <Bitcoin className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <NetworkBadge network={match.network} />
            <span className="text-xs text-gray-400">{match.listName}</span>
          </div>
          <p className="font-mono text-sm text-gray-800 mt-1.5 break-all leading-relaxed">
            {match.address}
          </p>
          {match.entityName && (
            <p className="text-xs text-gray-500 mt-1">
              Entity:{' '}
              <span className="font-medium text-gray-700">
                {match.entityName}
              </span>
              {match.sdnId && (
                <span className="text-gray-400"> (SDN #{match.sdnId})</span>
              )}
            </p>
          )}
          {match.programs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.programs.map((p) => (
                <span
                  key={p}
                  className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SanctionsDashboard() {
  const [mode, setMode] = useState<SearchMode>('entity')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [cryptoResult, setCryptoResult] = useState<CryptoResult | null>(null)
  const [listData, setListData] = useState<ListSummary | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [searched, setSearched] = useState(false)
  const [activeSection, setActiveSection] = useState<'search' | 'lists' | 'api' | 'admin'>('search')
  const [adminPassword, setAdminPassword] = useState('')

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/sanctions/lists')
      if (res.ok) setListData(await res.json())
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setCryptoResult(null)
    setSearched(true)

    try {
      if (mode === 'entity') {
        const res = await fetch(
          `/api/sanctions/check?q=${encodeURIComponent(query)}&type=name`,
        )
        if (res.ok) setResult(await res.json())
      } else {
        const res = await fetch(
          `/api/sanctions/crypto?address=${encodeURIComponent(query)}`,
        )
        if (res.ok) setCryptoResult(await res.json())
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (listName?: string) => {
    setSyncing(true)
    setSyncMsg('Sync started in background…')
    try {
      const url = listName
        ? `/api/sanctions/sync?list=${encodeURIComponent(listName)}`
        : '/api/sanctions/sync'
      const res = await fetch(url, { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminPassword}`
        }
      })
      if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid Admin Password.')
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? 'Sync is not available.')
      }
      setSyncMsg('Sync completed. Refreshing list data…')
      await fetchLists()
      setSyncMsg('Done.')
      setTimeout(() => setSyncMsg(''), 3000)
    } catch {
      setSyncMsg('Error triggering sync.')
    } finally {
      setSyncing(false)
    }
  }

  const isMatch =
    (result?.match ?? false) || (cryptoResult?.sanctioned ?? false)
  const isClear =
    searched && !loading && !isMatch && (result !== null || cryptoResult !== null)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://wemsys.es/_next/image?url=%2Flogo-wemsys.png&w=256&q=75"
              alt="Wemsys"
              className="h-9 w-9 rounded-lg bg-white object-contain p-1"
            />
            <div>
              <span className="text-white font-bold text-lg leading-tight block">
                Sanctions API
              </span>
              <span className="text-slate-400 text-xs leading-none">
                OFAC · UN · EU
              </span>
            </div>
          </div>
          <nav className="flex gap-1">
            {(['search', 'lists', 'api', 'admin'] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeSection === sec
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sec.charAt(0).toUpperCase() + sec.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats row */}
        {listData && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              {
                label: 'Total Entities',
                value: listData.totalEntities.toLocaleString(),
                icon: User,
                color: 'text-blue-600',
              },
              {
                label: 'Crypto Addresses',
                value: listData.totalAddresses.toLocaleString(),
                icon: Bitcoin,
                color: 'text-orange-500',
              },
              {
                label: 'Active Lists',
                value: `${listData.activeLists} / ${listData.lists.length}`,
                icon: Globe,
                color: 'text-emerald-600',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4"
              >
                <Icon className={`w-8 h-8 ${color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search section */}
        {activeSection === 'search' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Sanctions Screening
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Search entities, individuals, or blockchain addresses across
                OFAC SDN, UN, and EU consolidated sanctions lists.
              </p>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                {[
                  { id: 'entity' as SearchMode, label: 'Entity / Name', icon: User },
                  { id: 'crypto' as SearchMode, label: 'Crypto Address', icon: Bitcoin },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setMode(id)
                      setQuery('')
                      setResult(null)
                      setCryptoResult(null)
                      setSearched(false)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      mode === id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      mode === 'entity'
                        ? 'Search name, alias, or organization…'
                        : 'Enter blockchain address (BTC, ETH, TRX, …)'
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors text-sm shrink-0"
                >
                  {loading ? 'Checking…' : 'Screen'}
                </button>
              </form>
            </div>

            {/* Result */}
            {(result || cryptoResult) && (
              <div className="space-y-4">
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    isMatch
                      ? 'bg-red-50 border-red-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  {isMatch ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <p
                      className={`font-semibold ${isMatch ? 'text-red-700' : 'text-emerald-700'}`}
                    >
                      {isMatch ? 'SANCTIONS MATCH FOUND' : 'No Match Found'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Query:{' '}
                      <span className="font-mono">
                        {result?.query ?? cryptoResult?.address}
                      </span>{' '}
                      ·{' '}
                      {new Date(
                        result?.timestamp ?? cryptoResult?.timestamp ?? '',
                      ).toLocaleTimeString()}
                    </p>
                  </div>
                  {result && (
                    <span className="ml-auto text-sm text-gray-500">
                      {result.totalMatches} match
                      {result.totalMatches !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>

                {result && result.entityMatches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Entity Matches ({result.entityMatches.length})
                    </h3>
                    <div className="space-y-3">
                      {result.entityMatches.map((e) => (
                        <EntityCard key={e.id} entity={e} />
                      ))}
                    </div>
                  </div>
                )}

                {result && result.cryptoMatches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Crypto Address Matches ({result.cryptoMatches.length})
                    </h3>
                    <div className="space-y-3">
                      {result.cryptoMatches.map((m) => (
                        <CryptoCard key={m.id} match={m} />
                      ))}
                    </div>
                  </div>
                )}

                {cryptoResult && cryptoResult.matches.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Sanctioned Address Matches ({cryptoResult.matches.length})
                    </h3>
                    <div className="space-y-3">
                      {cryptoResult.matches.map((m) => (
                        <CryptoCard key={m.id} match={m} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isClear && !isMatch && (
              <div className="text-center py-4 text-sm text-gray-400">
                No sanctions matches found for this query.
              </div>
            )}
          </div>
        )}

        {/* Lists section */}
        {activeSection === 'lists' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Sanctions Lists
              </h2>
            </div>

            {listData ? (
              <div className="grid gap-4">
                {listData.lists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <Database className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">
                              {list.name}
                            </p>
                            <StatusBadge status={list.status ?? 'pending'} />
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {list.description}
                          </p>
                          {list.source.startsWith('private://') ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
                              Private file
                            </span>
                          ) : (
                            <a
                              href={list.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1"
                            >
                              {list.source.replace('https://', '').split('/')[0]}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-4">
                      {[
                        {
                          label: 'Entities',
                          value: (list.entityCount ?? 0).toLocaleString(),
                        },
                        {
                          label: 'Crypto Addresses',
                          value: (list.addressCount ?? 0).toLocaleString(),
                        },
                        {
                          label: 'Last Sync',
                          value: formatDate(list.lastSync),
                          Icon: Clock,
                        },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">
                            {label}
                          </p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {list.errorMessage && (
                      <div className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-xs text-red-600">
                          {list.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 text-sm">
                  No lists found. Go to the Admin panel to sync.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Admin section */}
        {activeSection === 'admin' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Admin Panel
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Provide the administrator password to manually synchronize sanctions lists.
              </p>
              
              <div className="flex gap-3 max-w-sm">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Admin Password"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                Synchronization
              </h3>
              <div className="flex items-center gap-3">
                {syncMsg && (
                  <span className={`text-sm ${syncMsg.includes('Error') || syncMsg.includes('Invalid') ? 'text-red-500' : 'text-emerald-500'}`}>{syncMsg}</span>
                )}
                <button
                  onClick={() => handleSync()}
                  disabled={syncing || !adminPassword}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                  />
                  Sync All Lists
                </button>
              </div>
            </div>

            {listData && (
              <div className="grid gap-4">
                {listData.lists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{list.name}</p>
                          <StatusBadge status={list.status ?? 'pending'} />
                        </div>
                        <p className="text-xs text-gray-500">{list.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSync(list.name)}
                      disabled={syncing || list.status === 'syncing' || !adminPassword}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Sync
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* API Reference */}
        {activeSection === 'api' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">API Reference</h2>
            <p className="text-sm text-gray-500">
              All endpoints return JSON and support CORS. No authentication
              required.
            </p>

            {[
              {
                method: 'GET',
                path: '/api/sanctions/check',
                description: 'Search entities and crypto addresses across all active lists.',
                params: [
                  { name: 'q', required: true, desc: 'Search query (min 2 chars)' },
                  { name: 'type', required: false, desc: 'name | crypto | all (default: all)' },
                  { name: 'limit', required: false, desc: 'Max results per category (default: 50, max: 200)' },
                ],
                example: '/api/sanctions/check?q=Lazarus+Group&type=name',
              },
              {
                method: 'GET',
                path: '/api/sanctions/crypto',
                description: 'Check a specific blockchain address for sanctions.',
                params: [
                  { name: 'address', required: true, desc: 'Blockchain address to check' },
                  { name: 'network', required: false, desc: 'Filter by network: BTC, ETH, TRX, XMR, …' },
                ],
                example: '/api/sanctions/crypto?address=1FfmbHfnpaZjKFvyi1okTjJJusN455paPH',
              },
              {
                method: 'GET',
                path: '/api/sanctions/lists',
                description: 'Get status of all sanctions lists including counts and last sync times.',
                params: [],
                example: '/api/sanctions/lists',
              },
              {
                method: 'POST',
                path: '/api/sanctions/sync',
                description: 'Trigger a sync of sanctions lists from public sources. Runs synchronously.',
                params: [
                  { name: 'list', required: false, desc: 'Sync a specific list only (e.g. OFAC SDN)' },
                ],
                example: '/api/sanctions/sync',
              },
            ].map(({ method, path, description, params, example }) => (
              <div
                key={path}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
                  >
                    {method}
                  </span>
                  <code className="text-sm font-mono font-semibold text-gray-900">
                    {path}
                  </code>
                </div>
                <p className="text-sm text-gray-600 mb-3">{description}</p>

                {params.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Parameters
                    </p>
                    <div className="space-y-1.5">
                      {params.map((p) => (
                        <div key={p.name} className="flex items-start gap-2">
                          <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            {p.name}
                          </code>
                          {!p.required && (
                            <span className="text-xs text-gray-400 italic shrink-0">
                              optional
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Example
                  </p>
                  <code className="block text-xs font-mono bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-slate-700 break-all">
                    {example}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
