import { Route, BrowserRouter, Routes } from 'react-router-dom'
import { AdminShell } from './components/AdminShell'
import { RoleGuard } from './components/RoleGuard'
import { UserShell } from './components/UserShell'
import { AdminAudit } from './pages/AdminAudit'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminDetection } from './pages/AdminDetection'
import { AdminEvaluation } from './pages/AdminEvaluation'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { UserApp } from './pages/UserApp'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RoleGuard allow={['user', 'admin']} />}>
          <Route element={<UserShell />}>
            <Route path="/app" element={<UserApp />} />
          </Route>
        </Route>
        <Route element={<RoleGuard allow={['admin']} />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/detection" element={<AdminDetection />} />
            <Route path="/admin/evaluation" element={<AdminEvaluation />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
