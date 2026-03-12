import { supabase } from "@/integrations/supabase/client"

interface CheckoutPayload {
  price: string
  config: Record<string, any>
  imageDataUrl?: string | null
}

export async function createShopifyCheckout(payload: CheckoutPayload): Promise<string> {
  const { data, error } = await supabase.functions.invoke('pbs-create-checkout', {
    body: payload,
  })

  if (error) {
    console.error('Edge function error:', error)
    throw new Error(error.message || 'Failed to create checkout')
  }

  if (!data?.success || !data?.invoiceUrl) {
    throw new Error(data?.error || 'No checkout URL returned')
  }

  return data.invoiceUrl
}
