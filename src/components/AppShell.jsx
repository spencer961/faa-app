import Sidebar from './Sidebar.jsx'

// The app frame: the nav rail on the left, the routed page scrolling on the
// right. Each page renders its own (now slim) Header + content unchanged.
export default function AppShell({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</main>
    </div>
  )
}
