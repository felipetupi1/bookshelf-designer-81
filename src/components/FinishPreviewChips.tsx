interface FinishOption {
  id: string
  label: string
  color1: string
  color2: string
  comingSoon: boolean
  previewImage: string | null
}

interface FinishPreviewChipsProps {
  finishes: FinishOption[]
  onChipClick: (finishName: string, imageSrc: string) => void
}

const TEXTURE_MAP: Record<string, string> = {
  "Maple/Maple": "/images/finishes/maple1.jpeg",
  "Oak/Oak": "/images/finishes/OAK6.png",
  "Walnut/Walnut": "/images/finishes/walnut1.jpeg",
  "Maple/Black": "/images/finishes/maple-black.jpeg",
  "Oak/Black": "/images/finishes/oak-black.jpeg",
  "Oak/White": "/images/finishes/OAK6.png",
}

export function FinishPreviewChips({ finishes, onChipClick }: FinishPreviewChipsProps) {
  const visibleFinishes = finishes.filter(f => !f.comingSoon)

  return (
    <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
      {visibleFinishes.map(finish => {
        const texture = TEXTURE_MAP[finish.id]
        const isSplit = finish.id === "Oak/White"

        return (
          <button
            key={finish.id}
            onClick={() => {
              const img = texture || finish.previewImage
              if (img) onChipClick(finish.label, img)
            }}
            className="group relative"
            title={finish.label}
          >
            <div className="w-8 h-8 rounded-full border-2 border-background shadow-md overflow-hidden hover:scale-110 transition-transform">
              {isSplit ? (
                <div className="flex w-full h-full">
                  <div
                    className="w-1/2 h-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${texture})` }}
                  />
                  <div className="w-1/2 h-full" style={{ backgroundColor: "#f5f5f5" }} />
                </div>
              ) : texture ? (
                <img src={texture} alt={finish.label} className="object-cover object-center w-full h-full" />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: finish.color1 }} />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
