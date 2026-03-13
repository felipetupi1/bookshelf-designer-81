import { useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface FinishPreviewChipsProps {
  onSelectFinish?: (finishId: string) => void
  selectedFinish?: string
}

type ChipDef = { id: string; label: string; image?: string; leftImage?: string; rightImage?: string; split?: boolean }

const CHIPS: ChipDef[] = [
  { id: "Oak/Oak", label: "White Oak", image: "/images/finishes/Oak_Close.jpg" },
  { id: "Maple/Maple", label: "Maple", image: "/images/finishes/Maple_Close.jpg" },
  { id: "Walnut/Walnut", label: "Walnut", image: "/images/finishes/Walnut_Close.jpg" },
  { id: "Maple/Black", label: "Maple / Black", leftImage: "/images/finishes/Maple_Close.jpg", rightImage: "/images/finishes/Maple___Black_Closer_2.jpg", split: true },
  { id: "Oak/Black", label: "White Oak / Black", leftImage: "/images/finishes/Oak_Close.jpg", rightImage: "/images/finishes/Oak___Black_Closer_2.jpg", split: true },
]

export function FinishPreviewChips({ selectedFinish }: FinishPreviewChipsProps) {
  const [modal, setModal] = useState<{ isOpen: boolean; finishName: string; image1: string; image2?: string }>({ isOpen: false, finishName: "", image1: "" })

  function openModal(chip: ChipDef) {
    if (chip.split) {
      setModal({ isOpen: true, finishName: chip.label, image1: chip.leftImage!, image2: chip.rightImage! })
    } else {
      setModal({ isOpen: true, finishName: chip.label, image1: chip.image! })
    }
  }

  return (
    <>
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
        {CHIPS.map(chip => (
          <button
            key={chip.id}
            onClick={() => openModal(chip)}
            className="group relative"
            title={chip.label}
          >
            <div className={`w-8 h-8 rounded-full border-2 shadow-md overflow-hidden hover:scale-110 transition-transform ${selectedFinish === chip.id ? "border-foreground ring-2 ring-foreground/30" : "border-background"}`}>
              {chip.split ? (
                <div className="flex w-full h-full">
                  <div className="w-1/2 h-full" style={{ backgroundImage: `url(${chip.leftImage})`, backgroundSize: "cover", backgroundPosition: "left center" }} />
                  <div className="w-1/2 h-full" style={{ backgroundImage: `url(${chip.rightImage})`, backgroundSize: "cover", backgroundPosition: "right center" }} />
                </div>
              ) : (
                <img src={chip.image} alt={chip.label} className="object-cover object-center w-full h-full" />
              )}
            </div>
          </button>
        ))}
      </div>

      {modal.isOpen && createPortal(
        (
          <>
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm" onClick={() => setModal(m => ({ ...m, isOpen: false }))} />
            <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
              <div className="relative bg-card border border-border rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 pointer-events-auto" onClick={e => e.stopPropagation()}>
                <button onClick={() => setModal(m => ({ ...m, isOpen: false }))} className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
                <h3 className="text-lg font-semibold text-foreground mb-4">{modal.finishName}</h3>
                <div className={`flex gap-3 ${modal.image2 ? "" : "justify-center"}`}>
                  <img src={modal.image1} alt={modal.finishName} className={`rounded-xl object-cover ${modal.image2 ? "w-1/2" : "w-full max-h-[400px]"}`} />
                  {modal.image2 && <img src={modal.image2} alt="Frame finish" className="w-1/2 rounded-xl object-cover" />}
                </div>
              </div>
            </div>
          </>
        ),
        document.body
      )}
    </>
  )
}
