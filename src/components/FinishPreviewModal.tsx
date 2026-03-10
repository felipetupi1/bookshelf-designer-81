import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface FinishPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  finishName: string
  imageSrc: string
}

export function FinishPreviewModal({ isOpen, onClose, finishName, imageSrc }: FinishPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{finishName} Finish Preview</DialogTitle>
        </VisuallyHidden>
        <div className="relative w-full aspect-square">
          <img
            src={imageSrc || "/placeholder.svg"}
            alt={`${finishName} finish preview`}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="p-4 bg-card border-t border-border">
          <h3 className="text-lg font-display font-semibold text-center text-foreground">{finishName}</h3>
        </div>
      </DialogContent>
    </Dialog>
  )
}
