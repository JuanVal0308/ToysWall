import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  ShoppingCart, 
  Store, 
  Users, 
  FileText, 
  LogOut,
  Menu,
  X
} from 'lucide-react'

const menuItems = [
  { id: 'inventario', label: 'Ver Inventario', icon: Package },
  { id: 'venta', label: 'Registrar Venta', icon: ShoppingCart },
  { id: 'tiendas', label: 'Tiendas', icon: Store },
  { id: 'empleados', label: 'Empleados', icon: Users },
  { id: 'facturar', label: 'Facturar', icon: FileText },
]

export default function Layout({ children, currentView, onViewChange }) {
  const { empresaNombre, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
              <h1 className="ml-2 md:ml-0 text-xl font-bold text-gray-900">
                Toys Walls
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 hidden sm:block">
                {empresaNombre || 'Cargando...'}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-50
            w-64 bg-white shadow-lg md:shadow-none
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            pt-16 md:pt-0
          `}
        >
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id)
                    setSidebarOpen(false)
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg
                    transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Overlay para mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

