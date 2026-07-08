import { Routes, Route } from 'react-router-dom'
import Home from './routes/Home.jsx'
import Onboarding from './routes/Onboarding.jsx'
import Dashboard from './routes/Dashboard.jsx'
import SuccessMap from './routes/SuccessMap.jsx'
import Metrics from './routes/Metrics.jsx'
import Tasks from './routes/Tasks.jsx'
import ClientPortal from './routes/ClientPortal.jsx'

// Every "page" is now a route in one app. Each still lives in its own
// file — editing one doesn't touch the others.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/success-map" element={<SuccessMap />} />
      <Route path="/metrics" element={<Metrics />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/portal" element={<ClientPortal />} />
    </Routes>
  )
}
