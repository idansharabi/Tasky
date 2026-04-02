import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoadingScreen from './components/shared/LoadingScreen'
import LoginPage from './pages/LoginPage'
import ParentApp from './pages/ParentApp'
import KidApp from './pages/KidApp'

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
      <AppRoutes />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontWeight: 500 },
          success: { style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' } },
          error: { style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } },
        }}
      />
    </AuthProvider>
  )
}
