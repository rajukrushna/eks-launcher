import React from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import HomeView from './screens/HomeView'
import EnvFormView from './screens/EnvFormView'
import PortForwardFormView from './screens/PortForwardFormView'
import PortForwardManageView from './screens/PortForwardManageView'
import { useStore } from './store/useStore'

export default function App() {
  const { view, setEnvironments, setPortForwards, initPfProcess } = useStore()

  React.useEffect(() => {
    window.api.env.list().then(setEnvironments)
    window.api.pf.list().then(pfs => {
      setPortForwards(pfs)
      // Init process runtime state immediately after load - no race condition
      pfs.forEach(pf => initPfProcess(pf))
    })
  }, [])

  const showSidebar = !['pf-manage', 'pf-edit', 'pf-create'].includes(view)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showSidebar && <Sidebar />}
        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-base)' }}>
          {view === 'home'       && <HomeView />}
          {view === 'edit'       && <EnvFormView />}
          {view === 'create'     && <EnvFormView />}
          {view === 'pf-manage'  && <PortForwardManageView />}
          {view === 'pf-edit'    && <PortForwardFormView />}
          {view === 'pf-create'  && <PortForwardFormView />}
        </main>
      </div>
    </div>
  )
}
