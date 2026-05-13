import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoadingScreen from './components/shared/LoadingScreen'
import LoginPage from './pages/LoginPage'
import ParentApp from './pages/ParentApp'
import KidApp from './pages/KidApp'
import StarBackground from './components/shared/StarBackground'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user || !profile) return <LoginPage />
  if (profile.role === 'parent') return <ParentApp />
  if (profile.role === 'kid') return <KidApp />
  return <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <StarBackground />
      <AppRoutes />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontWeight: 500, background: '#0d1b3e', color: '#e2e8f0', border: '1px solid rgba(59,130,246,0.2)' },
          success: { style: { background: '#052e16', color: '#86efac', border: '1px solid #166534' } },
          error:   { style: { background: '#2d0a0a', color: '#fca5a5', border: '1px solid #7f1d1d' } },
        }}
      />
    </AuthProvider>
  )
}
