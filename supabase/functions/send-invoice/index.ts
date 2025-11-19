import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'toyswalls@gmail.com'

serve(async (req) => {
  try {
    const { factura_id, correo_cliente, nombre_cliente } = await req.json()

    if (!factura_id || !correo_cliente || !nombre_cliente) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Obtener la factura de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: factura, error: facturaError } = await supabase
      .from('facturas')
      .select('*, ventas(juguetes(nombre, codigo))')
      .eq('id', factura_id)
      .single()

    if (facturaError || !factura) {
      return new Response(
        JSON.stringify({ error: 'Factura not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generar HTML de la factura
    const itemsHtml = factura.items?.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.nombre}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.cantidad}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.precio?.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal?.toFixed(2)}</td>
      </tr>
    `).join('') || ''

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: bold; }
            td { padding: 8px; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Toys Walls</h1>
              <p>Factura #${factura.id}</p>
            </div>
            <div class="content">
              <p>Estimado/a ${nombre_cliente},</p>
              <p>Adjuntamos la factura de su compra:</p>
              
              <table>
                <thead>
                  <tr>
                    <th>Juguete</th>
                    <th style="text-align: center;">Cantidad</th>
                    <th style="text-align: right;">Precio</th>
                    <th style="text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              
              <div class="total">
                <p>Total: $${factura.total?.toFixed(2)}</p>
              </div>
              
              <p>Gracias por su compra.</p>
              <p>Saludos,<br>Equipo de Toys Walls</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Enviar correo usando Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: correo_cliente,
        subject: `Factura #${factura.id} - Toys Walls`,
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text()
      throw new Error(`Resend API error: ${errorData}`)
    }

    const resendData = await resendResponse.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        emailId: resendData.id 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error sending invoice email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

