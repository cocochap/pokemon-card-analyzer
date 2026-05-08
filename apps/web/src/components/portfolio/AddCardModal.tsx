export function AddCardModal({ open, onClose }: { open?: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Add Card</h3>
        <p className="text-muted-foreground text-sm mb-4">Add card to portfolio coming soon.</p>
        <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
          Close
        </button>
      </div>
    </div>
  )
}
