# CLAUDE.md — perfectbookshelf-configurator

## Contexto de negócio

Configurador de estantes da Perfect BookShelf (perfectbookshelf.com).
Produto premium ($448–$3.200+). Compra não-impulsiva, sem showroom, sem devolução.
Este app roda como <iframe> dentro de uma página do Shopify.
Qualquer quebra no fluxo de checkout = perda direta de venda de alto valor.

Stack: React + Vite + TypeScript + shadcn/ui + Tailwind + Supabase Edge Functions

Repositórios relacionados:
- perfectbookshelf-theme → tema Shopify
- perfectbookshelf-workspace → referências de UX/UI, planos de A/B, documentação

---

## REGRA ZERO — Backup antes de qualquer mudança

```bash
git checkout -b backup/pre-changes-$(date +%Y-%m-%d)
git add -A
git commit -m "backup: estado original"
git checkout main
```

Nunca deletar branches de backup. Nunca force push em main.

---

## TAREFA 1 — CRÍTICA: corrigir window.open bloqueado em iframe

### Problema
Todos os configuradores chamam window.open(checkoutUrl, '_blank').
Em iframe cross-origin no Shopify, browsers bloqueiam popups silenciosamente.
O cliente clica "Add to Cart" → nada acontece → zero feedback de erro.

### Arquivos
- src/components/BookshelfConfigurator.tsx
- src/components/PortalConfigurator.tsx
- src/components/CathedralConfigurator.tsx
- src/components/USurroundConfigurator.tsx

### Correção (aplicar nos 4 arquivos)
Localizar:
  window.open(checkoutUrl, '_blank')

Substituir por:
  if (window.top) {
    window.top.location.href = checkoutUrl
  } else {
    window.location.href = checkoutUrl
  }

---

## TAREFA 2 — Erro silencioso no checkout

### Problema
O catch usa alert() — bloqueado em iframes cross-origin.
Falha de checkout = cliente sem feedback nenhum.

### Correção nos 4 arquivos da Tarefa 1

1. Adicionar estado:
   const [checkoutError, setCheckoutError] = useState<string | null>(null)

2. Substituir o bloco catch:
   } catch (err) {
     console.error('Checkout error:', err)
     setCheckoutError('Something went wrong. Please try again or contact us.')
   } finally {
     setIsAddingToCart(false)
   }

3. Exibir erro inline acima do botão "Add to Cart":
   {checkoutError && (
     <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
       {checkoutError}{' — '}
       <a
         href="https://www.perfectbookshelf.com/pages/contact"
         target="_top"
         className="underline font-medium"
       >
         Contact us
       </a>
     </div>
   )}

4. Limpar erro quando o usuário muda qualquer configuração:
   Adicionar setCheckoutError(null) no início dos handlers:
   setWidth, setShelves, setShelves2, setSelectedFinish, setMainType

---

## TAREFA 3 — Links externos presos no iframe

Varrer todos os arquivos por <a href.
Adicionar target="_top" em qualquer link para perfectbookshelf.com.

Correto:   <a href="https://www.perfectbookshelf.com/pages/contact" target="_top">
Errado:    <a href="https://www.perfectbookshelf.com/pages/contact">

---

## TAREFA 4 — postMessage para comunicação com Shopify

Adicionar em cada configurador, ANTES do redirecionamento:

  try {
    window.parent.postMessage(
      {
        type: 'pbs-checkout-initiated',
        price: totalPrice.toFixed(2),
        bookshelfType: mainType,
        finish: selectedFinish,
      },
      'https://www.perfectbookshelf.com'
    )
  } catch {
    // falha silenciosa — checkout continua
  }

---

## TAREFA 5 — Criar src/lib/analytics.ts

Eventos enviados via postMessage para o tema Shopify capturar e
repassar ao GA4 / Neat A/B Testing.

```typescript
export function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
  try {
    window.parent.postMessage(
      { type: 'pbs-analytics', event: eventName, params },
      'https://www.perfectbookshelf.com'
    )
  } catch {
    // silently fail
  }
}
```

Disparar nos seguintes momentos:

| Evento                        | Onde                             | Params                            |
|-------------------------------|----------------------------------|-----------------------------------|
| configurator_type_selected    | Ao selecionar tipo               | { type }                          |
| configurator_finish_changed   | Ao trocar acabamento             | { finish, price_per_sqft }        |
| configurator_width_changed    | Ao soltar slider                 | { width_inches }                  |
| configurator_shelf_added      | Ao clicar "+"                    | { total_shelves }                 |
| configurator_checkout_click   | Ao clicar "Add to Cart"          | { price, type, finish }           |
| configurator_checkout_error   | No bloco catch                   | { error_message }                 |
| quiz_answer                   | A cada resposta do quiz          | { question, answer }              |
| quiz_completed                | Ao completar o quiz              | { recommended_type }              |

---

## TAREFA 6 — Quiz de qualificação pré-configurador

### Objetivo de negócio
Substituir parte da consultoria manual.
Direciona o cliente ao tipo certo antes de abrir o configurador.
Meta: reduzir consultas manuais em ~70%.

### Criar src/components/PreConfiguratorQuiz.tsx

Fluxo (3 perguntas sequenciais, UX simples e linear):

  Pergunta 1: "What are you looking to create?"
    → Store books & display items  → recomenda Bookshelf / Rack
    → Fill an entire wall          → recomenda Portal / Cathedral
    → Use a corner space           → recomenda Corner
    → Wrap around a room           → recomenda U-Surround

  Pergunta 2: "How wide is your space?"
    → Slider 25"–200", mostra ft/in em tempo real

  Pergunta 3: "What's your preferred finish?"
    → Chips visuais com previewImage das opções (omitir comingSoon: true)

  Resultado:
    → Card: tipo recomendado + estimativa de preço ("From $X")
    → Botão primário: "Start designing →" → abre configurador no tipo correto
    → Link secundário: "I'd like a free consultation instead"
      target="_top" → https://www.perfectbookshelf.com/pages/contact

### Atualizar src/pages/Index.tsx

```typescript
import { useState } from 'react'
import { PreConfiguratorQuiz } from '@/components/PreConfiguratorQuiz'
import { BookshelfConfigurator } from '@/components/BookshelfConfigurator'

type Step = 'quiz' | 'configurator'

const Index = () => {
  const [step, setStep] = useState<Step>('quiz')
  const [recommendedType, setRecommendedType] = useState('bookshelf')

  return (
    <main className="min-h-screen bg-background">
      {step === 'quiz' ? (
        <PreConfiguratorQuiz
          onComplete={(type) => {
            setRecommendedType(type)
            setStep('configurator')
          }}
        />
      ) : (
        <BookshelfConfigurator initialType={recommendedType} />
      )}
    </main>
  )
}
export default Index
```

---

## TAREFA 7 — Acabamentos "Coming Soon"

White/White e Black/Black têm comingSoon: true mas aparecem no seletor.
Confirmar com Felipe antes de implementar:
  Opção A: remover de FINISH_OPTIONS completamente
  Opção B: mostrar desabilitado visualmente com badge "Soon"

---

## TAREFA 8 — Verificar secrets Supabase antes de publicar

Edge function pbs-create-checkout precisa dessas variáveis no
Supabase Dashboard → Project Settings → Edge Functions → Secrets:

  SHOPIFY_STORE        → perfectbookshelf (sem .myshopify.com)
  SHOPIFY_ACCESS_TOKEN → token Admin API com escrita em draft_orders

Testar via curl após configurar:
  curl -X POST https://rjvpkwnkpgxlepmxdpmh.supabase.co/functions/v1/pbs-create-checkout \
    -H "Authorization: Bearer [SUPABASE_ANON_KEY]" \
    -H "Content-Type: application/json" \
    -d '{"price":"500.00","config":{"bookshelfType":"bookshelf","finish":"Oak/Oak"}}'

Resposta esperada:
  { "success": true, "invoiceUrl": "https://...", "draftOrderId": ... }

---

## Ordem de execução

1.  git checkout -b backup/pre-changes-$(date +%Y-%m-%d) && git add -A && git commit -m "backup" && git checkout main
2.  TAREFA 1 — window.open → window.top.location.href (4 arquivos)
3.  TAREFA 2 — erro inline (4 arquivos)
4.  TAREFA 3 — target="_top" em links externos
5.  TAREFA 4 — postMessage antes do redirect
6.  git add -A && git commit -m "fix: iframe checkout compatibility + inline error handling"
7.  TAREFA 5 — analytics.ts + eventos nos configuradores
8.  git add -A && git commit -m "feat: analytics events via postMessage"
9.  TAREFA 6 — PreConfiguratorQuiz
10. git add -A && git commit -m "feat: pre-configurator qualification quiz"
11. TAREFA 7 — confirmar com Felipe e executar
12. TAREFA 8 — verificar secrets + teste da edge function

---

## O que NÃO tocar sem aprovação explícita

- src/lib/bookshelf-calculator.ts    → lógica de SKUs, validada em produção
- src/lib/cathedral-calculator.ts    → idem
- src/lib/usurround-calculator.ts    → idem
- supabase/functions/pbs-create-checkout/index.ts → só para ajuste de secrets
- public/images/finishes/*           → não renomear, paths referenciados no código

---

## Variáveis de ambiente

.env (frontend — público, pode estar no repo):
  VITE_SUPABASE_PROJECT_ID=rjvpkwnkpgxlepmxdpmh
  VITE_SUPABASE_PUBLISHABLE_KEY=[chave anon pública]
  VITE_SUPABASE_URL=https://rjvpkwnkpgxlepmxdpmh.supabase.co

Secrets Supabase (NUNCA no repo):
  SHOPIFY_STORE
  SHOPIFY_ACCESS_TOKEN
