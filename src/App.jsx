import { useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/components/Login'
import Inventario from '@/components/Inventario'
import Venta from '@/components/Venta'
import Tiendas from '@/components/Tiendas'
import Empleados from '@/components/Empleados'
import Facturar from '@/components/Facturar'
import { Toaster } from '@/components/ui/use-toast'

function AppContent() {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState('inventario')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const renderView = () => {
    switch (currentView) {
      case 'inventario':
        return <Inventario />
      case 'venta':
        return <Venta />
      case 'tiendas':
        return <Tiendas />
      case 'empleados':
        return <Empleados />
      case 'facturar':
        return <Facturar />
      default:
        return <Inventario />
    }
  }

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  )
}

export default App

