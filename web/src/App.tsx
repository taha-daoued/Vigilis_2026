import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { AdminShell } from './components/AdminShell'
import { RoleGuard } from './components/RoleGuard'
import { Tour } from './components/Tour'
import { UserShell } from './components/UserShell'
import { AdminAudit } from './pages/AdminAudit'
import { AdminDetection } from './pages/AdminDetection'
import { AdminEvaluation } from './pages/AdminEvaluation'
import { AdminHealth } from './pages/AdminHealth'
import { AdminStats } from './pages/AdminStats'
import { CommandCenter } from './pages/CommandCenter'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { UserAlerts } from './pages/UserAlerts'
import { UserContacts } from './pages/UserContacts'
import { UserHome } from './pages/UserHome'
import { UserMap } from './pages/UserMap'
import { UserPrivacy } from './pages/UserPrivacy'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RoleGuard allow={['user', 'admin']} />}>
          <Route element={<UserShell />}>
            <Route path="/app" element={<UserHome />} />
            <Route path="/app/alertes" element={<UserAlerts />} />
            <Route path="/app/carte" element={<UserMap />} />
            <Route path="/app/confidentialite" element={<UserPrivacy />} />
            <Route path="/app/contacts" element={<UserContacts />} />
          </Route>
        </Route>
        <Route element={<RoleGuard allow={['admin']} />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<CommandCenter />} />
            <Route path="/admin/health" element={<AdminHealth />} />
            <Route path="/admin/stats" element={<AdminStats />} />
            <Route path="/admin/detection" element={<AdminDetection />} />
            <Route path="/admin/evaluation" element={<AdminEvaluation />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Tour />
    </BrowserRouter>
  )
}
