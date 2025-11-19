import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Edit, Trash2, Package } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

export default function Inventario() {
  const { empresaId, canManage } = useAuth()
  const { toast } = useToast()
  const [juguetes, setJuguetes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [inventarioTiendas, setInventarioTiendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [jugueteDialogOpen, setJugueteDialogOpen] = useState(false)
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false)
  const [inventarioDialogOpen, setInventarioDialogOpen] = useState(false)
  const [editingJuguete, setEditingJuguete] = useState(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
    codigo: '',
  })
  const [categoriaNombre, setCategoriaNombre] = useState('')
  const [inventarioData, setInventarioData] = useState({
    juguete_id: '',
    tienda_id: '',
    cantidad: '',
  })

  useEffect(() => {
    if (empresaId) {
      loadData()
    }
  }, [empresaId])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadJuguetes(),
        loadCategorias(),
        loadTiendas(),
        loadInventarioTiendas(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadJuguetes = async () => {
    const { data, error } = await supabase
      .from('juguetes')
      .select('*, categorias(nombre)')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) throw error
    setJuguetes(data || [])
  }

  const loadCategorias = async () => {
    const { data, error } = await supabase
      .from('categorias')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) throw error
    setCategorias(data || [])
  }

  const loadTiendas = async () => {
    const { data, error } = await supabase
      .from('tiendas')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) throw error
    setTiendas(data || [])
  }

  const loadInventarioTiendas = async () => {
    const { data, error } = await supabase
      .from('inventario_tiendas')
      .select('*, juguetes(nombre, codigo), tiendas(nombre)')
      .eq('juguetes.empresa_id', empresaId)

    if (error) throw error
    setInventarioTiendas(data || [])
  }

  const handleCreateJuguete = async () => {
    try {
      const { error } = await supabase
        .from('juguetes')
        .insert({
          ...formData,
          empresa_id: empresaId,
          precio: parseFloat(formData.precio),
        })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Juguete creado correctamente',
      })

      setJugueteDialogOpen(false)
      resetForm()
      loadJuguetes()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleUpdateJuguete = async () => {
    try {
      const { error } = await supabase
        .from('juguetes')
        .update({
          ...formData,
          precio: parseFloat(formData.precio),
        })
        .eq('id', editingJuguete.id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Juguete actualizado correctamente',
      })

      setJugueteDialogOpen(false)
      setEditingJuguete(null)
      resetForm()
      loadJuguetes()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteJuguete = async (id) => {
    try {
      const { error } = await supabase
        .from('juguetes')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Juguete eliminado correctamente',
      })

      loadJuguetes()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleCreateCategoria = async () => {
    try {
      const { error } = await supabase
        .from('categorias')
        .insert({
          nombre: categoriaNombre,
          empresa_id: empresaId,
        })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Categoría creada correctamente',
      })

      setCategoriaDialogOpen(false)
      setCategoriaNombre('')
      loadCategorias()
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleAddInventario = async () => {
    try {
      // Verificar si ya existe inventario para este juguete en esta tienda
      const { data: existing } = await supabase
        .from('inventario_tiendas')
        .select('id, cantidad')
        .eq('juguete_id', inventarioData.juguete_id)
        .eq('tienda_id', inventarioData.tienda_id)
        .single()

      if (existing) {
        // Actualizar cantidad existente
        const { error } = await supabase
          .from('inventario_tiendas')
          .update({
            cantidad: existing.cantidad + parseInt(inventarioData.cantidad),
          })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Crear nuevo registro
        const { error } = await supabase
          .from('inventario_tiendas')
          .insert({
            ...inventarioData,
            cantidad: parseInt(inventarioData.cantidad),
          })

        if (error) throw error
      }

      toast({
        title: 'Éxito',
        description: 'Inventario actualizado correctamente',
      })

      setInventarioDialogOpen(false)
      setInventarioData({ juguete_id: '', tienda_id: '', cantidad: '' })
      loadInventarioTiendas()
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
      descripcion: '',
      precio: '',
      categoria_id: '',
      codigo: '',
    })
  }

  const openEditDialog = (juguete) => {
    setEditingJuguete(juguete)
    setFormData({
      nombre: juguete.nombre,
      descripcion: juguete.descripcion || '',
      precio: juguete.precio.toString(),
      categoria_id: juguete.categoria_id?.toString() || '',
      codigo: juguete.codigo || '',
    })
    setJugueteDialogOpen(true)
  }

  const getStockTotal = (jugueteId) => {
    return inventarioTiendas
      .filter((inv) => inv.juguete_id === jugueteId)
      .reduce((sum, inv) => sum + (inv.cantidad || 0), 0)
  }

  const getStockByTienda = (jugueteId, tiendaId) => {
    const inv = inventarioTiendas.find(
      (i) => i.juguete_id === jugueteId && i.tienda_id === tiendaId
    )
    return inv?.cantidad || 0
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inventario</h2>
          <p className="text-gray-600 mt-1">Gestiona tus juguetes y stock</p>
        </div>
        {canManage && (
          <div className="flex space-x-2">
            <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Categoría
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Categoría</DialogTitle>
                  <DialogDescription>
                    Crea una nueva categoría para organizar tus juguetes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="categoria-nombre">Nombre</Label>
                    <Input
                      id="categoria-nombre"
                      value={categoriaNombre}
                      onChange={(e) => setCategoriaNombre(e.target.value)}
                      placeholder="Ej: Acción, Educativos, etc."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCategoriaDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateCategoria}>Crear</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={jugueteDialogOpen} onOpenChange={setJugueteDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingJuguete(null); resetForm(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Juguete
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingJuguete ? 'Editar Juguete' : 'Nuevo Juguete'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingJuguete
                      ? 'Modifica la información del juguete'
                      : 'Agrega un nuevo juguete al inventario'}
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
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="precio">Precio *</Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        value={formData.precio}
                        onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoria_id">Categoría</Label>
                      <Select
                        value={formData.categoria_id}
                        onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setJugueteDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={editingJuguete ? handleUpdateJuguete : handleCreateJuguete}>
                    {editingJuguete ? 'Actualizar' : 'Crear'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={inventarioDialogOpen} onOpenChange={setInventarioDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Package className="h-4 w-4 mr-2" />
                  Agregar Inventario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Inventario a Tienda</DialogTitle>
                  <DialogDescription>
                    Agrega o actualiza el stock de un juguete en una tienda
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inventario-juguete">Juguete</Label>
                    <Select
                      value={inventarioData.juguete_id}
                      onValueChange={(value) => setInventarioData({ ...inventarioData, juguete_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar juguete" />
                      </SelectTrigger>
                      <SelectContent>
                        {juguetes.map((jug) => (
                          <SelectItem key={jug.id} value={jug.id.toString()}>
                            {jug.nombre} ({jug.codigo || 'Sin código'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inventario-tienda">Tienda</Label>
                    <Select
                      value={inventarioData.tienda_id}
                      onValueChange={(value) => setInventarioData({ ...inventarioData, tienda_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tienda" />
                      </SelectTrigger>
                      <SelectContent>
                        {tiendas.map((tienda) => (
                          <SelectItem key={tienda.id} value={tienda.id.toString()}>
                            {tienda.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="inventario-cantidad">Cantidad</Label>
                    <Input
                      id="inventario-cantidad"
                      type="number"
                      value={inventarioData.cantidad}
                      onChange={(e) => setInventarioData({ ...inventarioData, cantidad: e.target.value })}
                      min="1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInventarioDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddInventario}>Agregar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Juguetes</CardTitle>
          <CardDescription>
            Stock total y por tienda de cada juguete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock Total</TableHead>
                  {tiendas.map((tienda) => (
                    <TableHead key={tienda.id}>{tienda.nombre}</TableHead>
                  ))}
                  {canManage && <TableHead>Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {juguetes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5 + tiendas.length + (canManage ? 1 : 0)} className="text-center py-8">
                      No hay juguetes registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  juguetes.map((juguete) => (
                    <TableRow key={juguete.id}>
                      <TableCell className="font-mono">{juguete.codigo || '-'}</TableCell>
                      <TableCell className="font-medium">{juguete.nombre}</TableCell>
                      <TableCell>{juguete.categorias?.nombre || '-'}</TableCell>
                      <TableCell>${juguete.precio?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="font-semibold">
                        {getStockTotal(juguete.id)}
                      </TableCell>
                      {tiendas.map((tienda) => (
                        <TableCell key={tienda.id}>
                          {getStockByTienda(juguete.id, tienda.id)}
                        </TableCell>
                      ))}
                      {canManage && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(juguete)}
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
                                    Esta acción no se puede deshacer. Se eliminará el juguete "{juguete.nombre}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteJuguete(juguete.id)}
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

