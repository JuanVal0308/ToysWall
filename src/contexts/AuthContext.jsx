import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        loadUsuario(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user)
        await loadUsuario(session.user.id)
      } else {
        setUser(null)
        setUsuario(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUsuario = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, empresas(nombre), tipo_usuarios(nombre)')
        .eq('id', userId)
        .single()

      if (error) throw error

      setUsuario(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading usuario:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información del usuario',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        await loadUsuario(data.user.id)
      }

      return { error: null }
    } catch (error) {
      return { error: error.message }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setUsuario(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    usuario,
    loading,
    signIn,
    signOut,
    empresaId: usuario?.empresa_id,
    tipoUsuarioId: usuario?.tipo_usuario_id,
    empresaNombre: usuario?.empresas?.nombre,
    isAdmin: usuario?.tipo_usuario_id === 1,
    canManage: usuario?.tipo_usuario_id === 1 || usuario?.tipo_usuario_id === 2,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

