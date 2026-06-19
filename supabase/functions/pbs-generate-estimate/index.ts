// supabase/functions/pbs-generate-estimate/index.ts
// Gera PDF de estimate. Front manda valores já calculados (área, subtotal,
// desconto, total). Esta função NÃO recalcula preço — só desenha o PDF.
// Protegida por header x-internal-key (secret INTERNAL_ACCESS_KEY).

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1"
import { z } from "npm:zod@3.23.8"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const ShelfSchema = z.object({
  height: z.union([z.literal(12), z.literal(14)]),
  depth: z.union([z.literal(7), z.literal(10), z.literal(13)]),
})

const BodySchema = z.object({
  clientName: z.string().min(1).max(200),
  clientCompany: z.string().max(200).optional(),
  date: z.string().optional(),
  mainType: z.enum(["bookshelf", "corner"]),
  bookshelfType: z.enum(["straight", "horizontal", "vertical"]).optional(),
  cornerVariant: z.enum(["inside", "outside"]).optional(),
  width: z.number().positive(),
  width2: z.number().positive().optional(),
  totalHeight: z.number().positive(),
  shelves: z.array(ShelfSchema).min(1),
  shelves2: z.array(ShelfSchema).min(1).optional(),
  selectedFinish: z.string().min(1),
  areaSqft: z.number().positive(),
  pricePerSqft: z.number().positive(),
  subtotal: z.number().nonnegative(),
  discount: z
    .object({
      type: z.enum(["percent", "flat"]),
      value: z.number().nonnegative(),
    })
    .optional(),
  total: z.number().nonnegative(),
  notes: z.string().max(2000).optional(),
})

type Body = z.infer<typeof BodySchema>

const FINISH_LABELS: Record<string, string> = {
  maple: "Maple",
  "maple-black": "Maple / Black",
  oak: "White Oak",
  "oak-black": "Oak / Black",
  "oak-white": "Oak / White",
  walnut: "Walnut",
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function fmtDate(input?: string): string {
  const d = input ? new Date(input) : new Date()
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function shelvesSummary(shelves: Body["shelves"]): string {
  // Ex.: "2× 14"H / 13"D, 1× 12"H / 10"D"
  const counts = new Map<string, number>()
  for (const s of shelves) {
    const k = `${s.height}"H / ${s.depth}"D`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([k, n]) => `${n}× ${k}`).join(", ")
}

interface DrawCtx {
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  y: number
  margin: number
  width: number
  height: number
}

function drawText(ctx: DrawCtx, text: string, opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
  const { x = ctx.margin, size = 11, bold = false, color = [0.1, 0.1, 0.1] } = opts
  ctx.page.drawText(text, {
    x,
    y: ctx.y,
    size,
    font: bold ? ctx.bold : ctx.font,
    color: rgb(color[0], color[1], color[2]),
  })
}

function hr(ctx: DrawCtx, color: [number, number, number] = [0.85, 0.85, 0.85]) {
  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.y },
    end: { x: ctx.width - ctx.margin, y: ctx.y },
    thickness: 0.5,
    color: rgb(color[0], color[1], color[2]),
  })
}

function row(ctx: DrawCtx, label: string, value: string, opts: { bold?: boolean; size?: number } = {}) {
  const size = opts.size ?? 11
  drawText(ctx, label, { size, bold: opts.bold })
  const valueWidth = (opts.bold ? ctx.bold : ctx.font).widthOfTextAtSize(value, size)
  drawText(ctx, value, { x: ctx.width - ctx.margin - valueWidth, size, bold: opts.bold })
}

function section(ctx: DrawCtx, title: string) {
  ctx.y -= 10
  drawText(ctx, title.toUpperCase(), { size: 10, bold: true, color: [0.4, 0.4, 0.4] })
  ctx.y -= 6
  hr(ctx)
  ctx.y -= 16
}

async function buildPdf(body: Body): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Estimate — ${body.clientName}`)
  pdf.setAuthor("The Perfect Bookshelf")
  pdf.setCreator("Perfect Bookshelf Configurator")

  const page = pdf.addPage([612, 792]) // Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ctx: DrawCtx = {
    page,
    font,
    bold,
    y: 750,
    margin: 50,
    width: 612,
    height: 792,
  }

  // Header
  drawText(ctx, "THE PERFECT BOOKSHELF", { size: 11, bold: true, color: [0.4, 0.25, 0.1] })
  ctx.y -= 28
  drawText(ctx, "Estimate", { size: 26, bold: true })
  ctx.y -= 22

  const headerRight = `Date: ${fmtDate(body.date)}`
  const hrW = font.widthOfTextAtSize(headerRight, 10)
  page.drawText(headerRight, {
    x: 612 - ctx.margin - hrW,
    y: 750,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  drawText(ctx, `Prepared for: ${body.clientName}`, { size: 12, bold: true })
  if (body.clientCompany) {
    ctx.y -= 16
    drawText(ctx, body.clientCompany, { size: 11, color: [0.4, 0.4, 0.4] })
  }
  ctx.y -= 10

  // Configuration
  section(ctx, "Configuration")
  const widthLabel = body.width2 ? `${body.width}" + ${body.width2}"` : `${body.width}"`
  const typeLabel =
    body.mainType === "corner"
      ? `Corner (${body.cornerVariant ?? "—"})`
      : `Bookshelf${body.bookshelfType ? ` (${body.bookshelfType})` : ""}`
  const finishLabel = FINISH_LABELS[body.selectedFinish] ?? body.selectedFinish

  const configRows: [string, string][] = [
    ["Type", typeLabel],
    ["Width", widthLabel],
    ["Total Height", `${body.totalHeight.toFixed(2)}"`],
    body.mainType === "corner" && body.shelves2
      ? ["Shelves — Arm 1", shelvesSummary(body.shelves)]
      : ["Shelves", shelvesSummary(body.shelves)],
    ["Finish", finishLabel],
  ]
  if (body.mainType === "corner" && body.shelves2) {
    configRows.splice(4, 0, ["Shelves — Arm 2", shelvesSummary(body.shelves2)])
  }

  for (const [k, v] of configRows) {
    row(ctx, k, v)
    ctx.y -= 18
  }

  // Investment
  section(ctx, "Investment")
  row(
    ctx,
    `Area  (${body.areaSqft.toFixed(2)} sq ft × ${fmtCurrency(body.pricePerSqft)}/sq ft)`,
    fmtCurrency(body.subtotal),
  )
  ctx.y -= 18

  if (body.discount) {
    const dLabel =
      body.discount.type === "percent"
        ? `Discount (${body.discount.value}%)`
        : `Discount (${fmtCurrency(body.discount.value)})`
    const discountAmount = body.subtotal - body.total
    row(ctx, dLabel, `-${fmtCurrency(discountAmount)}`, { size: 11 })
    ctx.y -= 18
  }

  ctx.y -= 4
  hr(ctx, [0.3, 0.3, 0.3])
  ctx.y -= 18
  row(ctx, "Total", fmtCurrency(body.total), { bold: true, size: 14 })
  ctx.y -= 24

  // Notes
  if (body.notes) {
    section(ctx, "Notes")
    const wrapped = wrapText(body.notes, font, 11, ctx.width - ctx.margin * 2)
    for (const line of wrapped) {
      drawText(ctx, line, { size: 11 })
      ctx.y -= 15
      if (ctx.y < 90) break
    }
  }

  // Footer
  page.drawLine({
    start: { x: ctx.margin, y: 70 },
    end: { x: ctx.width - ctx.margin, y: 70 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  })
  page.drawText("The Perfect Bookshelf  ·  Since 1994  ·  perfectbookshelf.com", {
    x: ctx.margin,
    y: 55,
    size: 9,
    font,
    color: rgb(0.45, 0.45, 0.45),
  })
  page.drawText("Estimate valid for 30 days. Pricing excludes shipping unless noted. Final quote subject to confirmation.", {
    x: ctx.margin,
    y: 42,
    size: 8,
    font,
    color: rgb(0.55, 0.55, 0.55),
  })

  return await pdf.save()
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/)
    let line = ""
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  const expected = Deno.env.get("INTERNAL_ACCESS_KEY")
  if (!expected) {
    console.error("INTERNAL_ACCESS_KEY not configured")
    return json({ error: "Server misconfigured" }, 500)
  }
  if (req.headers.get("x-internal-key") !== expected) {
    return json({ error: "Unauthorized" }, 401)
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400)
  }

  try {
    const pdfBytes = await buildPdf(parsed.data)
    const filename = `PBS_Estimate_${parsed.data.clientName.replace(/\s+/g, "_")}.pdf`
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("PDF generation failed:", err)
    return json({ error: "Failed to generate PDF" }, 500)
  }
})
