import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    let SHOPIFY_STORE = Deno.env.get('SHOPIFY_STORE')
    if (!SHOPIFY_STORE) throw new Error('SHOPIFY_STORE is not configured')
    // Ensure full domain
    if (!SHOPIFY_STORE.includes('.')) SHOPIFY_STORE = `${SHOPIFY_STORE}.myshopify.com`

    const SHOPIFY_ACCESS_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
    if (!SHOPIFY_ACCESS_TOKEN) throw new Error('SHOPIFY_ACCESS_TOKEN is not configured')

    const { price, config, imageDataUrl } = await req.json()

    if (!price || !config) {
      return new Response(JSON.stringify({ error: 'Missing price or config' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build note from config for the order
    const noteLines = [
      `Type: ${config.bookshelfType || 'N/A'}`,
      `Finish: ${config.finish || 'N/A'}`,
      `Total Area: ${config.totalArea || 'N/A'} sq ft`,
      `Price/sqft: $${config.pricePerSqFt || 'N/A'}`,
      `Dimensions: ${JSON.stringify(config.dimensions || {})}`,
    ]

    if (config.shelves) {
      if (Array.isArray(config.shelves)) {
        noteLines.push(`Shelves: ${config.shelves.map((s: any, i: number) => `Row${i + 1}: ${s.height}"H x ${s.depth}"D`).join(', ')}`)
      } else {
        // U-surround style with left/front/right
        for (const [zone, shelves] of Object.entries(config.shelves)) {
          if (Array.isArray(shelves)) {
            noteLines.push(`Shelves (${zone}): ${(shelves as any[]).map((s: any, i: number) => `Row${i + 1}: ${s.height}"H x ${s.depth}"D`).join(', ')}`)
          }
        }
      }
    }

    if (config.skus && Array.isArray(config.skus)) {
      noteLines.push('--- SKUs ---')
      for (const sku of config.skus) {
        noteLines.push(`${sku.name}: ${sku.totalQuantity || sku.quantity || 0}`)
      }
    }

    // Build line item properties (visible to customer and in admin)
    const lineItemProperties = [
      { name: "Type", value: config.bookshelfType || "Custom" },
      { name: "Finish", value: config.finish || "N/A" },
      { name: "Area", value: `${config.totalArea || 'N/A'} sq ft` },
      { name: "Dimensions", value: JSON.stringify(config.dimensions || {}) },
    ]

    // Create draft order via Shopify Admin API
    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            title: `Custom ${(config.bookshelfType || 'Bookshelf').charAt(0).toUpperCase() + (config.bookshelfType || 'bookshelf').slice(1)} - ${config.finish || 'Standard'}`,
            price: price,
            quantity: 1,
            properties: lineItemProperties,
          }
        ],
        note: noteLines.join('\n'),
        tags: `pbs-configurator, ${config.bookshelfType || 'custom'}`,
      }
    }

    const shopifyUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/draft_orders.json`
    
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify(draftOrderPayload),
    })

    const shopifyData = await shopifyResponse.json()

    if (!shopifyResponse.ok) {
      console.error('Shopify API error:', JSON.stringify(shopifyData))
      throw new Error(`Shopify API error [${shopifyResponse.status}]: ${JSON.stringify(shopifyData)}`)
    }

    const invoiceUrl = shopifyData.draft_order?.invoice_url
    if (!invoiceUrl) {
      throw new Error('No invoice_url returned from Shopify')
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoiceUrl,
      draftOrderId: shopifyData.draft_order?.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Error creating draft order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
