import React, { useEffect, useState, useMemo } from 'react'
import {
  fetchCameras,
  fetchDepartments,
  fetchGeoJSON,
  fetchHealthSummary,
  fetchCamera,
  importCsv,
  createCamera,
  login,
  setToken,
} from './api'
import CameraMap from './components/CameraMap'
import GapLayer from './components/GapLayer'
import TopBar from './components/TopBar'
import SidebarDrawer from './components/SidebarDrawer'
import CameraInspector from './components/CameraInspector'
import LayerDock from './components/LayerDock'
import VehicleTracker, { SAMPLE_ROUTE } from './components/VehicleTracker'
import CameraOnboardingModal from './components/CameraOnboardingModal'
import { Shield, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('admin@gujarat.gov.in')
  const [password, setPassword] = useState('sentinel')
  const [error, setError] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)

  // Data states
  const [cameras, setCameras] = useState([])
  const [geojson, setGeojson] = useState(null)
  const [departments, setDepartments] = useState([])
  const [summary, setSummary] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)

  // UI Control states
  const [selectedId, setSelectedId] = useState(null)
  const [selectedCameraData, setSelectedCameraData] = useState(null)
  const [selectedDept, setSelectedDept] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [importReport, setImportReport] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)

  // Map & Layer states (SkyFi style)
  const [activeBasemap, setActiveBasemap] = useState('dark')
  const [showBuffers, setShowBuffers] = useState(false)
  const [bufferRadius, setBufferRadius] = useState(300)
  const [showGaps, setShowGaps] = useState(false)
  const [gapError, setGapError] = useState(null)

  // Vehicle Tracking Test Scenario
  const [showRoute, setShowRoute] = useState(false)
  const [activeRouteStep, setActiveRouteStep] = useState(1)

  // Fetch initial data on auth
  useEffect(() => {
    if (!authed) return
    Promise.all([
      fetchCameras({ departmentId: selectedDept }),
      fetchGeoJSON({ departmentId: selectedDept }),
      fetchHealthSummary(),
      fetchDepartments(),
    ])
      .then(([list, fc, totals, depts]) => {
        setCameras(list.items || [])
        setGeojson(fc)
        setSummary(totals)
        setDepartments(depts || [])
      })
      .catch((e) => setError(e.message))
  }, [authed, selectedDept])

  // Fetch deep camera detail when selected
  useEffect(() => {
    if (!selectedId) {
      setSelectedCameraData(null)
      return
    }
    fetchCamera(selectedId)
      .then((data) => setSelectedCameraData(data))
      .catch(() => {
        const found = cameras.find((c) => c.id === selectedId)
        setSelectedCameraData(found || null)
      })
  }, [selectedId, cameras])

  // Filtered cameras based on search and department
  const filteredCameras = useMemo(() => {
    let list = cameras
    if (selectedDept) {
      list = list.filter((c) => c.department_id === selectedDept)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.vendor && c.vendor.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q)) ||
          (c.external_ref && c.external_ref.toLowerCase().includes(q))
      )
    }
    return list
  }, [cameras, selectedDept, searchQuery])

  // Login handler
  async function submit(event) {
    event.preventDefault()
    setError(null)
    setLoggingIn(true)
    try {
      const session = await login(email, password)
      const depts = await fetchDepartments()
      setDepartments(depts || [])
      setDepartmentId(session.department_id ?? depts[0]?.id ?? 1)
      setAuthed(true)
    } catch (e) {
      setError(e.message || 'Authentication failed')
    } finally {
      setLoggingIn(false)
    }
  }

  function handleLogout() {
    setToken(null)
    setAuthed(false)
    setSelectedId(null)
  }

  // Camera Selection & FlyTo
  function handleSelectCamera(id) {
    setSelectedId(id)
    const target = cameras.find((c) => c.id === id)
    if (target) {
      setFlyTarget({ lat: target.lat, lon: target.lon, zoom: 15 })
    }
  }

  function handleCenterMap(lat, lon) {
    setFlyTarget({ lat, lon, zoom: 16 })
  }

  // CSV Upload handler
  async function handleUploadCsv(deptId, file) {
    if (!file) return
    try {
      const report = await importCsv(deptId, file)
      setImportReport(report)
      const [list, fc, totals] = await Promise.all([
        fetchCameras({ departmentId: selectedDept }),
        fetchGeoJSON({ departmentId: selectedDept }),
        fetchHealthSummary(),
      ])
      setCameras(list.items || [])
      setGeojson(fc)
      setSummary(totals)
    } catch (e) {
      setError(e.message)
    }
  }

  // Manual Camera Registration
  async function handleCreateCamera(data) {
    await createCamera(data)
    const [list, fc, totals] = await Promise.all([
      fetchCameras({ departmentId: selectedDept }),
      fetchGeoJSON({ departmentId: selectedDept }),
      fetchHealthSummary(),
    ])
    setCameras(list.items || [])
    setGeojson(fc)
    setSummary(totals)
  }

  // 1. Unauthenticated Login Screen (Architectural Security Portal)
  if (!authed) {
    return (
      <div className="relative w-screen h-screen flex items-center justify-center bg-[#08090c] overflow-hidden text-slate-100 selection:bg-white/20 selection:text-white">
        {/* Subtle geometric line grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute inset-0 bg-radial-[at_center] from-transparent via-[#08090c]/80 to-[#08090c] pointer-events-none" />

        <div className="w-full max-w-sm p-8 titanium-glass rounded-2xl relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-white mb-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
              <Shield className="w-5 h-5 text-zinc-100" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono tracking-widest text-slate-400 uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Gujarat Police Command</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              SENTINEL
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Statewide CCTV Asset Registry & GIS
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Operator Identifier</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gujarat.gov.in"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs titanium-input font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Security Token</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs titanium-input font-mono"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 active:scale-[0.99] transition-all shadow-[0_4px_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loggingIn ? 'Authenticating...' : 'Access Intelligence Registry'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-900" />
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-white/[0.06] text-center text-[10px] text-slate-500 font-mono tracking-wider uppercase">
            GPIC 2026 &middot; Model 1 Baseline &middot; PostGIS 16
          </div>
        </div>
      </div>
    )
  }

  // 2. Authenticated Edge-to-Edge SkyFi Command Platform
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Edge-to-Edge Leaflet Canvas */}
      <div className="absolute inset-0 z-0">
        <CameraMap
          geojson={geojson}
          selectedId={selectedId}
          onSelect={handleSelectCamera}
          activeBasemap={activeBasemap}
          showBuffers={showBuffers}
          bufferRadius={bufferRadius}
          showRoute={showRoute}
          activeRouteStep={activeRouteStep}
          flyTarget={flyTarget}
        >
          <GapLayer enabled={showGaps} radiusM={bufferRadius} onError={setGapError} />
        </CameraMap>
      </div>

      {/* Floating Top Navigation Header */}
      <TopBar
        summary={summary}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        departments={departments}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        trackingActive={showRoute}
        onToggleTracking={() => {
          const next = !showRoute
          setShowRoute(next)
          if (next && SAMPLE_ROUTE[0]) {
            setFlyTarget({ lat: SAMPLE_ROUTE[0].lat, lon: SAMPLE_ROUTE[0].lon, zoom: 12 })
          }
        }}
        onLogout={handleLogout}
        totalCameras={cameras.length}
      />

      {/* Floating Left Collapsible Camera Inventory Drawer */}
      <SidebarDrawer
        cameras={filteredCameras}
        selectedId={selectedId}
        onSelectCamera={handleSelectCamera}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        departments={departments}
      />

      {/* Floating Right Deep Camera Telemetry & Stream Inspector */}
      {selectedCameraData && (
        <CameraInspector
          camera={selectedCameraData}
          health={
            summary?.recent_checks?.[selectedCameraData.id] || {
              reachable: selectedCameraData.status === 'active',
              latency_ms: 22,
            }
          }
          onClose={() => setSelectedId(null)}
          onCenterMap={handleCenterMap}
          departments={departments}
        />
      )}

      {/* Floating Bottom-Center Basemap & Spatial Layer Dock */}
      <LayerDock
        activeBasemap={activeBasemap}
        onSelectBasemap={setActiveBasemap}
        showBuffers={showBuffers}
        onToggleBuffers={() => setShowBuffers(!showBuffers)}
        bufferRadius={bufferRadius}
        onBufferRadiusChange={setBufferRadius}
        showGaps={showGaps}
        onToggleGaps={() => setShowGaps(!showGaps)}
        showRoute={showRoute}
        onToggleRoute={() => setShowRoute(!showRoute)}
      />

      {/* Floating Bottom-Left Vehicle Movement & Watchlist Alert Dock */}
      <VehicleTracker
        isOpen={showRoute}
        onClose={() => setShowRoute(false)}
        activeStep={activeRouteStep}
        onStepChange={setActiveRouteStep}
        onFlyTo={handleCenterMap}
      />

      {/* Camera Onboarding Modal (CSV Bulk Dropzone & Manual Form) */}
      <CameraOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        departmentId={departmentId}
        departments={departments}
        onUploadCsv={handleUploadCsv}
        importReport={importReport}
        onCreateCamera={handleCreateCamera}
      />

      {/* Coverage Gap Error Toast (if query too large) */}
      {showGaps && gapError && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs shadow-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span>{gapError}</span>
        </div>
      )}
    </div>
  )
}
