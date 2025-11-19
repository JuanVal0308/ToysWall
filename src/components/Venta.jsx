import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ShoppingCart } from 'lucide-react'

export default function Venta() {
  const { empresaId } = useAuth()
  const { toast } = useToast()
  const [juguetes, setJuguetes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [formData, setFormData] = useState({
    juguete_codigo: '',
    vendedor_codigo: '',
    precio_venta: '',
    metodo_pago: 'efectivo',
  })
  const [selectedJuguete, setSelectedJuguete] = useState(null)

  useEffect(() => {
    if (empresaId) {
      loadJuguetes()
      loadVendedores()
    }
  }, [empresaId])

  const loadJuguetes = async () => {
    const { data, error } = await supabase
      .from('juguetes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) {
      console.error('Error loading juguetes:', error)
    } else {
      setJuguetes(data || [])
    }
  }

  const loadVendedores = async () => {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (error) {
      console.error('Error loading vendedores:', error)
    } else {
      setVendedores(data || [])
    }
  }

  const handleCodigoChange = (codigo) => {
    setFormData({ ...formData, juguete_codigo: codigo })
    const juguete = juguetes.find((j) => j.codigo === codigo)
    setSelectedJuguete(juguete)
    if (juguete) {
      setFormData((prev) => ({
        ...prev,
        precio_venta: juguete.precio?.toString() || '',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedJuguete) {
      toast({
        title: 'Error',
        description: 'Juguete no encontrado con ese código',
        variant: 'destructive',
      })
      return
    }

    const vendedor = vendedores.find((v) => v.codigo === formData.vendedor_codigo)
    if (!vendedor) {
      toast({
        title: 'Error',
        description: 'Vendedor no encontrado con ese código',
        variant: 'destructive',
      })
      return
    }

    try {
      const { error } = await supabase
        .from('ventas')
        .insert({
          juguete_id: selectedJuguete.id,
          vendedor_id: vendedor.id,
          precio_venta: parseFloat(formData.precio_venta),
          metodo_pago: formData.metodo_pago,
          empresa_id: empresaId,
          fecha_venta: new Date().toISOString(),
        })

      if (error) throw error

      toast({
        title: 'Éxito',
        description: 'Venta registrada correctamente',
      })

      // Reset form
      setFormData({
        juguete_codigo: '',
        vendedor_codigo: '',
        precio_venta: '',
        metodo_pago: 'efectivo',
      })
      setSelectedJuguete(null)
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Registrar Venta</h2>
        <p className="text-gray-600 mt-1">Registra una nueva venta en el sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Nueva Venta
          </CardTitle>
          <CardDescription>
            Completa los datos para registrar la venta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="juguete_codigo">Código del Juguete *</Label>
                <Input
                  id="juguete_codigo"
                  value={formData.juguete_codigo}
                  onChange={(e) => handleCodigoChange(e.target.value)}
                  placeholder="Ingresa el código del juguete"
                  required
                />
                {selectedJuguete && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ {selectedJuguete.nombre} - ${selectedJuguete.precio?.toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="vendedor_codigo">Código del Vendedor *</Label>
                <Input
                  id="vendedor_codigo"
                  value={formData.vendedor_codigo}
                  onChange={(e) => setFormData({ ...formData, vendedor_codigo: e.target.value })}
                  placeholder="Ingresa el código del vendedor"
                  required
                />
              </div>

              <div>
                <Label htmlFor="precio_venta">Precio de Venta *</Label>
                <Input
                  id="precio_venta"
                  type="number"
                  step="0.01"
                  value={formData.precio_venta}
                  onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="metodo_pago">Método de Pago *</Label>
                <Select
                  value={formData.metodo_pago}
                  onValueChange={(value) => setFormData({ ...formData, metodo_pago: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full md:w-auto">
              Registrar Venta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

