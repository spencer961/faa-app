import { Routes, Route } from 'react-router-dom'
import Home from './routes/Home.jsx'
import Onboarding from './routes/Onboarding.jsx'
import Dashboard from './routes/Dashboard.jsx'
import SuccessMap from './routes/SuccessMap.jsx'
import Metrics from './routes/Metrics.jsx'
import Tasks from './routes/Tasks.jsx'
import ClientPortal from './routes/ClientPortal.jsx'
import SuperAdmin from './routes/SuperAdmin.jsx'
import ClientPulse from './routes/ClientPulse.jsx'
import Login, { Splash } from './routes/Login.jsx'
import { useAuth } from './lib/AuthContext.jsx'

// Every "page" is now a route in one app. Each still lives in its own
// file — editing one doesn't touch the others.
export default function App() {
  // Gate the whole app behind a login (Phase 1 — internal only). While the
  // session is being restored we show a splash so the app never flashes.
  const { loading, user } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/success-map" element={<SuccessMap />} />
      <Route path="/metrics" element={<Metrics />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/portal" element={<ClientPortal />} />
      <Route path="/pulse" element={<ClientPulse />} />
      <Route path="/admin" element={<SuperAdmin />} />
    </Routes>
  )
}
