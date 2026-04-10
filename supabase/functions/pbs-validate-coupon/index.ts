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
    if (!SHOPIFY_STORE.includes('.')) SHOPIFY_STORE = `${SHOPIFY_STORE}.myshopify.com`

    const SHOPIFY_ACCESS_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
    if (!SHOPIFY_ACCESS_TOKEN) throw new Error('SHOPIFY_ACCESS_TOKEN is not configured')

    const { code } = await req.json()
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return new Response(JSON.stringify({ valid: false, error: 'No coupon code provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const trimmedCode = code.trim().toUpperCase()

    // Look up discount code via Shopify Admin API
    const lookupUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/discount_codes/lookup.json?code=${encodeURIComponent(trimmedCode)}`
    const lookupRes = await fetch(lookupUrl, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
      redirect: 'follow',
    })

    if (!lookupRes.ok) {
      if (lookupRes.status === 404) {
        return new Response(JSON.stringify({ valid: false, error: 'Coupon not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`Shopify lookup failed: ${lookupRes.status}`)
    }

    const lookupData = await lookupRes.json()
    const discountCode = lookupData.discount_code
    if (!discountCode) {
      return new Response(JSON.stringify({ valid: false, error: 'Coupon not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the price rule to determine discount value
    const priceRuleId = discountCode.price_rule_id
    const priceRuleUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/price_rules/${priceRuleId}.json`
    const priceRuleRes = await fetch(priceRuleUrl, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN },
    })

    if (!priceRuleRes.ok) {
      throw new Error(`Failed to fetch price rule: ${priceRuleRes.status}`)
    }

    const priceRuleData = await priceRuleRes.json()
    const rule = priceRuleData.price_rule

    // Check if the discount is active
    const now = new Date()
    if (rule.starts_at && new Date(rule.starts_at) > now) {
      return new Response(JSON.stringify({ valid: false, error: 'Coupon is not yet active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (rule.ends_at && new Date(rule.ends_at) < now) {
      return new Response(JSON.stringify({ valid: false, error: 'Coupon has expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check usage limits
    if (rule.usage_limit && discountCode.usage_count >= rule.usage_limit) {
      return new Response(JSON.stringify({ valid: false, error: 'Coupon usage limit reached' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine value type and description
    const valueType = rule.value_type === 'percentage' ? 'percentage' : 'fixed_amount'
    const rawValue = Math.abs(parseFloat(rule.value))
    const description = valueType === 'percentage'
      ? `${rawValue}% off`
      : `$${rawValue.toFixed(2)} off`

    return new Response(JSON.stringify({
      valid: true,
      valueType,
      value: rawValue.toString(),
      description,
      title: rule.title || trimmedCode,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Coupon validation error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ valid: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
