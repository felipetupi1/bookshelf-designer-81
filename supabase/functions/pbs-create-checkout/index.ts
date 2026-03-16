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
    const dims = config.dimensions || {}
    const noteLines = [
      `Type: ${config.bookshelfType || 'N/A'}`,
      `Finish: ${config.finish || 'N/A'}`,
    ]

    // Per-shelf dimensions (width/length, height, depth)
    if (config.shelves) {
      if (Array.isArray(config.shelves)) {
        // Straight, Corner, Cathedral, Portal — single shelf list
        const shelfWidth = dims.width || dims.W || dims.wallWidth || 'N/A'
        noteLines.push(`--- Shelves (Width: ${shelfWidth}") ---`)
        config.shelves.forEach((s: any, i: number) => {
          noteLines.push(`  Row ${i + 1}: ${shelfWidth}" W x ${s.height}" H x ${s.depth}" D`)
        })
        // Corner has a second wall
        if (config.shelves2 && Array.isArray(config.shelves2)) {
          const width2 = dims.width2 || 'N/A'
          noteLines.push(`--- Shelves Wall 2 (Width: ${width2}") ---`)
          config.shelves2.forEach((s: any, i: number) => {
            noteLines.push(`  Row ${i + 1}: ${width2}" W x ${s.height}" H x ${s.depth}" D`)
          })
        }
      } else {
        // U-surround / L-shape — shelves keyed by wall
        const wallWidthMap: Record<string, string> = {
          left: dims.w1 || 'N/A',
          front: dims.w || 'N/A',
          right: dims.w2 || 'N/A',
        }
        for (const [wall, shelves] of Object.entries(config.shelves)) {
          if (Array.isArray(shelves)) {
            const wallW = wallWidthMap[wall] || 'N/A'
            noteLines.push(`--- ${wall.charAt(0).toUpperCase() + wall.slice(1)} Wall (Width: ${wallW}") ---`)
            ;(shelves as any[]).forEach((s: any, i: number) => {
              noteLines.push(`  Row ${i + 1}: ${wallW}" W x ${s.height}" H x ${s.depth}" D`)
            })
          }
        }
      }
    }

    // Additional dimensions context
    if (dims.H || dims.H1) {
      noteLines.push(`Wall Height: ${dims.H || 'N/A'}", Peak Height: ${dims.H1 || 'N/A'}"`)
    }
    if (dims.objectWidth) {
      noteLines.push(`Object: ${dims.objectWidth}" W x ${dims.objectHeight}" H, Floor-to-Object: ${dims.floorToObject}"`)
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
      ...(config.totalDimensions ? [{ name: "Dimensions", value: config.totalDimensions }] : []),
    ]

    // Add per-shelf summary to line item properties
    if (config.shelves && Array.isArray(config.shelves)) {
      const shelfW = config.dimensions?.width || config.dimensions?.W || '?'
      const label = config.bookshelfType === 'corner' ? 'W1 Shelf' : 'Shelf'
      config.shelves.forEach((s: any, i: number) => {
        lineItemProperties.push({ name: `${label} ${i + 1}`, value: `${shelfW}" x ${s.height}" x ${s.depth}"` })
      })
      // Corner wall 2
      if (config.shelves2 && Array.isArray(config.shelves2)) {
        const w2 = config.dimensions?.width2 || '?'
        config.shelves2.forEach((s: any, i: number) => {
          lineItemProperties.push({ name: `W2 Shelf ${i + 1}`, value: `${w2}" x ${s.height}" x ${s.depth}"` })
        })
      }
    } else if (config.shelves && typeof config.shelves === 'object') {
      for (const [wall, shelves] of Object.entries(config.shelves)) {
        if (Array.isArray(shelves)) {
          const wallWidths: Record<string, any> = { left: config.dimensions?.w1, front: config.dimensions?.w, right: config.dimensions?.w2 }
          const ww = wallWidths[wall] || '?'
          ;(shelves as any[]).forEach((s: any, i: number) => {
            lineItemProperties.push({ name: `${wall.charAt(0).toUpperCase() + wall.slice(1)} Shelf ${i + 1}`, value: `${ww}" x ${s.height}" x ${s.depth}"` })
          })
        }
      }
    }

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
