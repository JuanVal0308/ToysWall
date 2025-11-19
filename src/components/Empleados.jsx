import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Edit, Trash2, Users } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

export default function Empleados() {
  const { empresaId, isAdmin } = useAuth()
  const { toast } = useToast()
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendedor, setEditingVendedor] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    email: '',
    telefono: '',
  })

  useEffect(() => {
    if (empresaId) {
      loadVendedores()
    }
  }, [empresaId])

  const loadVendedores = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre')

      if (error) throw error
      setVendedores(data || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .insert({
          ...formData,
          empresa_id: empresaId,
        })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Vendedor creado correctamente',
      })

      setDialogOpen(false)
      resetForm()
      loadVendedores()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleUpdate = async () => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .update(formData)
        .eq('id', editingVendedor.id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Vendedor actualizado correctamente',
      })

      setDialogOpen(false)
      setEditingVendedor(null)
      resetForm()
      loadVendedores()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Vendedor eliminado correctamente',
      })

      loadVendedores()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      codigo: '',
      email: '',
      telefono: '',
    })
  }

  const openEditDialog = (vendedor) => {
    setEditingVendedor(vendedor)
    setFormData({
      nombre: vendedor.nombre,
      codigo: vendedor.codigo || '',
      email: vendedor.email || '',
      telefono: vendedor.telefono || '',
    })
    setDialogOpen(true)
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Empleados</h2>
          <p className="text-gray-600 mt-1">Gestiona los vendedores de tu empresa</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingVendedor(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Vendedor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingVendedor ? 'Editar Vendedor' : 'Nuevo Vendedor'}
                </DialogTitle>
                <DialogDescription>
                  {editingVendedor
                    ? 'Modifica la información del vendedor'
                    : 'Agrega un nuevo vendedor al sistema'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={editingVendedor ? handleUpdate : handleCreate}>
                  {editingVendedor ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Lista de Vendedores
          </CardTitle>
          <CardDescription>
            Todos los vendedores registrados en tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  {isAdmin && <TableHead>Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">
                      No hay vendedores registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  vendedores.map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell className="font-mono">{vendedor.codigo}</TableCell>
                      <TableCell className="font-medium">{vendedor.nombre}</TableCell>
                      <TableCell>{vendedor.email || '-'}</TableCell>
                      <TableCell>{vendedor.telefono || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(vendedor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminará el vendedor "{vendedor.nombre}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(vendedor.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

