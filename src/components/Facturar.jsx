import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { FileText, Plus, Trash2, Mail, Loader2 } from 'lucide-react'

export default function Facturar() {
  const { empresaId } = useAuth()
  const { toast } = useToast()
  const [ventas, setVentas] = useState([])
  const [formData, setFormData] = useState({
    venta_id: '',
    nombre_cliente: '',
    correo_cliente: '',
  })
  const [juguetesFactura, setJuguetesFactura] = useState([])
  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [facturaGenerada, setFacturaGenerada] = useState(null)

  useEffect(() => {
    if (empresaId) {
      loadVentas()
    }
  }, [empresaId])

  const loadVentas = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*, juguetes(nombre, codigo, precio), vendedores(nombre)')
        .eq('empresa_id', empresaId)
        .order('fecha_venta', { ascending: false })
        .limit(50)

      if (error) throw error
      setVentas(data || [])
    } catch (error) {
      console.error('Error loading ventas:', error)
    }
  }

  const handleVentaSelect = (ventaId) => {
    const venta = ventas.find((v) => v.id === parseInt(ventaId))
    if (venta) {
      setFormData({
        venta_id: ventaId,
        nombre_cliente: '',
        correo_cliente: '',
      })
      setJuguetesFactura([
        {
          juguete_id: venta.juguete_id,
          nombre: venta.juguetes?.nombre,
          codigo: venta.juguetes?.codigo,
          precio: venta.precio_venta,
          cantidad: 1,
        },
      ])
      setFacturaGenerada(null)
    }
  }

  const handleAddJuguete = () => {
    setJuguetesFactura([
      ...juguetesFactura,
      {
        juguete_id: '',
        nombre: '',
        codigo: '',
        precio: '',
        cantidad: 1,
      },
    ])
  }

  const handleRemoveJuguete = (index) => {
    setJuguetesFactura(juguetesFactura.filter((_, i) => i !== index))
  }

  const handleJugueteChange = (index, field, value) => {
    const updated = [...juguetesFactura]
    updated[index][field] = value
    setJuguetesFactura(updated)
  }

  const calcularTotal = () => {
    return juguetesFactura.reduce(
      (sum, item) => sum + (parseFloat(item.precio) || 0) * (parseInt(item.cantidad) || 0),
      0
    )
  }

  const handleGenerarFactura = async () => {
    if (!formData.venta_id || !formData.nombre_cliente || !formData.correo_cliente) {
      toast({
        title: 'Error',
        description: 'Completa todos los campos requeridos',
        variant: 'destructive',
      })
      return
    }

    if (juguetesFactura.length === 0) {
      toast({
        title: 'Error',
        description: 'Agrega al menos un juguete a la factura',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const total = calcularTotal()

      const { data, error } = await supabase
        .from('facturas')
        .insert({
          venta_id: parseInt(formData.venta_id),
          nombre_cliente: formData.nombre_cliente,
          correo_cliente: formData.correo_cliente,
          total: total,
          empresa_id: empresaId,
          fecha_factura: new Date().toISOString(),
          items: juguetesFactura.map((item) => ({
            juguete_id: item.juguete_id,
            nombre: item.nombre,
            codigo: item.codigo,
            precio: parseFloat(item.precio),
            cantidad: parseInt(item.cantidad),
            subtotal: parseFloat(item.precio) * parseInt(item.cantidad),
          })),
        })
        .select()
        .single()

      if (error) throw error

      setFacturaGenerada(data)
      toast({
        title: 'Éxito',
        description: 'Factura generada correctamente',
      })
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

  const handleEnviarCorreo = async () => {
    if (!facturaGenerada) return

    try {
      setSendingEmail(true)
      const { data, error } = await supabase.functions.invoke('send-invoice', {
        body: {
          factura_id: facturaGenerada.id,
          correo_cliente: formData.correo_cliente,
          nombre_cliente: formData.nombre_cliente,
        },
      })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Factura enviada por correo correctamente',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar el correo',
        variant: 'destructive',
      })
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Facturar</h2>
        <p className="text-gray-600 mt-1">Genera y envía facturas a tus clientes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Nueva Factura
            </CardTitle>
            <CardDescription>
              Completa los datos para generar la factura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="venta_id">ID de Venta</Label>
              <select
                id="venta_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.venta_id}
                onChange={(e) => handleVentaSelect(e.target.value)}
              >
                <option value="">Seleccionar venta</option>
                {ventas.map((venta) => (
                  <option key={venta.id} value={venta.id}>
                    #{venta.id} - {venta.juguetes?.nombre} - ${venta.precio_venta?.toFixed(2)} - {new Date(venta.fecha_venta).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="nombre_cliente">Nombre del Cliente *</Label>
              <Input
                id="nombre_cliente"
                value={formData.nombre_cliente}
                onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="correo_cliente">Correo del Cliente *</Label>
              <Input
                id="correo_cliente"
                type="email"
                value={formData.correo_cliente}
                onChange={(e) => setFormData({ ...formData, correo_cliente: e.target.value })}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Juguetes</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddJuguete}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {juguetesFactura.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end p-2 border rounded">
                    <div className="flex-1">
                      <Input
                        placeholder="Nombre"
                        value={item.nombre}
                        onChange={(e) => handleJugueteChange(index, 'nombre', e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Código"
                        value={item.codigo}
                        onChange={(e) => handleJugueteChange(index, 'codigo', e.target.value)}
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={item.precio}
                        onChange={(e) => handleJugueteChange(index, 'precio', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        placeholder="Cant."
                        value={item.cantidad}
                        onChange={(e) => handleJugueteChange(index, 'cantidad', e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveJuguete(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total:</span>
                <span>${calcularTotal().toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={handleGenerarFactura}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                'Generar Factura'
              )}
            </Button>

            {facturaGenerada && (
              <Button
                onClick={handleEnviarCorreo}
                className="w-full"
                variant="outline"
                disabled={sendingEmail}
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar por Correo
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {facturaGenerada && (
          <Card>
            <CardHeader>
              <CardTitle>Factura Generada</CardTitle>
              <CardDescription>
                Factura #{facturaGenerada.id}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Cliente:</p>
                  <p className="font-medium">{formData.nombre_cliente}</p>
                  <p className="text-sm text-gray-600">{formData.correo_cliente}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Items:</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Juguete</TableHead>
                        <TableHead>Cant.</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturaGenerada.items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.nombre}</TableCell>
                          <TableCell>{item.cantidad}</TableCell>
                          <TableCell>${item.precio?.toFixed(2)}</TableCell>
                          <TableCell>${item.subtotal?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total:</span>
                    <span>${facturaGenerada.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

