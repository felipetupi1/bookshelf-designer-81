interface FinishPreviewChipsProps {
  onSelectFinish: (finishId: string) => void
  selectedFinish?: string
}

type ChipDef = { id: string; label: string; image?: string; leftImage?: string; rightImage?: string; split?: boolean }

const CHIPS: ChipDef[] = [
  { id: "Oak/Oak", label: "White Oak", image: "/images/finishes/oak1.jpeg" },
  { id: "Maple/Maple", label: "Maple", image: "/images/finishes/maple1.jpeg" },
  { id: "Walnut/Walnut", label: "Walnut", image: "/images/finishes/walnut1.jpeg" },
  { id: "Maple/Black", label: "Maple/Black", leftImage: "/images/finishes/maple1.jpeg", rightImage: "/images/finishes/valchromat.png", split: true },
  { id: "Oak/Black", label: "White Oak/Black", leftImage: "/images/finishes/oak1.jpeg", rightImage: "/images/finishes/valchromat.png", split: true },
]

export function FinishPreviewChips({ onSelectFinish, selectedFinish }: FinishPreviewChipsProps) {
  return (
    <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
      {CHIPS.map(chip => (
        <button
          key={chip.id}
          onClick={() => onSelectFinish(chip.id)}
          className="group relative"
          title={chip.label}
        >
          <div className={`w-8 h-8 rounded-full border-2 shadow-md overflow-hidden hover:scale-110 transition-transform ${selectedFinish === chip.id ? "border-foreground ring-2 ring-foreground/30" : "border-background"}`}>
            {chip.split ? (
              <div className="flex w-full h-full">
                <div
                  className="w-1/2 h-full"
                  style={{ backgroundImage: `url(${chip.leftImage})`, backgroundSize: "cover", backgroundPosition: "left center" }}
                />
                <div
                  className="w-1/2 h-full"
                  style={{ backgroundImage: `url(${chip.rightImage})`, backgroundSize: "cover", backgroundPosition: "right center" }}
                />
              </div>
            ) : (
              <img src={chip.image} alt={chip.label} className="object-cover object-center w-full h-full" />
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
