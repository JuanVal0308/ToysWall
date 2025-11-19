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
import { Plus, Edit, Trash2, Store, Package } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

export default function Tiendas() {
  const { empresaId, isAdmin } = useAuth()
  const { toast } = useToast()
  const [tiendas, setTiendas] = useState([])
  const [inventario, setInventario] = useState([])
  const [selectedTienda, setSelectedTienda] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTienda, setEditingTienda] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
  })

  useEffect(() => {
    if (empresaId) {
      loadTiendas()
    }
  }, [empresaId])

  useEffect(() => {
    if (selectedTienda) {
      loadInventarioTienda(selectedTienda.id)
    }
  }, [selectedTienda])

  const loadTiendas = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tiendas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre')

      if (error) throw error
      setTiendas(data || [])
      if (data && data.length > 0 && !selectedTienda) {
        setSelectedTienda(data[0])
      }
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

  const loadInventarioTienda = async (tiendaId) => {
    try {
      const { data, error } = await supabase
        .from('inventario_tiendas')
        .select('*, juguetes(nombre, codigo, precio)')
        .eq('tienda_id', tiendaId)

      if (error) throw error
      setInventario(data || [])
    } catch (error) {
      console.error('Error loading inventario:', error)
    }
  }

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('tiendas')
        .insert({
          ...formData,
          empresa_id: empresaId,
        })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Tienda creada correctamente',
      })

      setDialogOpen(false)
      resetForm()
      loadTiendas()
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
        .from('tiendas')
        .update(formData)
        .eq('id', editingTienda.id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Tienda actualizada correctamente',
      })

      setDialogOpen(false)
      setEditingTienda(null)
      resetForm()
      loadTiendas()
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
        .from('tiendas')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Tienda eliminada correctamente',
      })

      loadTiendas()
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
      direccion: '',
      telefono: '',
    })
  }

  const openEditDialog = (tienda) => {
    setEditingTienda(tienda)
    setFormData({
      nombre: tienda.nombre,
      direccion: tienda.direccion || '',
      telefono: tienda.telefono || '',
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
          <h2 className="text-3xl font-bold text-gray-900">Tiendas</h2>
          <p className="text-gray-600 mt-1">Gestiona tus tiendas e inventario</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTienda(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tienda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingTienda ? 'Editar Tienda' : 'Nueva Tienda'}
                </DialogTitle>
                <DialogDescription>
                  {editingTienda
                    ? 'Modifica la información de la tienda'
                    : 'Agrega una nueva tienda al sistema'}
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
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
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
                <Button onClick={editingTienda ? handleUpdate : handleCreate}>
                  {editingTienda ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Store className="h-5 w-5 mr-2" />
              Lista de Tiendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tiendas.map((tienda) => (
                <button
                  key={tienda.id}
                  onClick={() => setSelectedTienda(tienda)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-colors
                    ${selectedTienda?.id === tienda.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="font-medium">{tienda.nombre}</div>
                  {tienda.direccion && (
                    <div className={`text-sm ${selectedTienda?.id === tienda.id ? 'text-primary-foreground/80' : 'text-gray-500'}`}>
                      {tienda.direccion}
                    </div>
                  )}
                </button>
              ))}
              {tiendas.length === 0 && (
                <p className="text-center text-gray-500 py-4">No hay tiendas registradas</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Inventario
              {selectedTienda && ` - ${selectedTienda.nombre}`}
            </CardTitle>
            <CardDescription>
              Stock disponible en esta tienda
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTienda ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Juguete</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventario.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          No hay inventario en esta tienda
                        </TableCell>
                      </TableRow>
                    ) : (
                      inventario.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">
                            {item.juguetes?.codigo || '-'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.juguetes?.nombre || '-'}
                          </TableCell>
                          <TableCell>
                            ${item.juguetes?.precio?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {item.cantidad || 0}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Selecciona una tienda para ver su inventario
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && selectedTienda && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => openEditDialog(selectedTienda)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar Tienda
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Tienda
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará la tienda "{selectedTienda.nombre}" y todo su inventario.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(selectedTienda.id)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

