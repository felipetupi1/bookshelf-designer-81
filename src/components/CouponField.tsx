import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tag, X, Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

export interface AppliedDiscount {
  code: string
  valueType: "percentage" | "fixed_amount"
  value: string
  description: string
}

interface CouponFieldProps {
  appliedDiscount: AppliedDiscount | null
  onApply: (discount: AppliedDiscount) => void
  onRemove: () => void
}

export function CouponField({ appliedDiscount, onApply, onRemove }: CouponFieldProps) {
  const [code, setCode] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    const trimmed = code.trim()
    if (!trimmed) return
    setIsValidating(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke("pbs-validate-coupon", {
        body: { code: trimmed },
      })

      if (fnError) throw new Error(fnError.message)

      if (!data?.valid) {
        setError(data?.error || "Invalid coupon code")
        return
      }

      onApply({
        code: trimmed,
        valueType: data.valueType,
        value: data.value,
        description: data.description,
      })
      setCode("")
    } catch {
      setError("Could not validate coupon. Try again.")
    } finally {
      setIsValidating(false)
    }
  }

  if (appliedDiscount) {
    return (
      <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
            {appliedDiscount.code}
          </span>
          <span className="text-xs text-green-600 dark:text-green-500">
            ({appliedDiscount.description})
          </span>
        </div>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
          aria-label="Remove coupon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          placeholder="Coupon code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null) }}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="h-9 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={isValidating || !code.trim()}
          className="h-9 px-4 shrink-0"
        >
          {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
