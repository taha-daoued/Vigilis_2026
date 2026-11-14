// Contacts de confiance : écran visible mais désactivé (prévu V2). Aucune donnée réelle collectée.
export function UserContacts() {
  return (
    <section aria-labelledby="ct" className="space-y-4">
      <h1 id="ct" className="text-xl font-bold">Contacts de confiance</h1>
      <p role="note" className="rounded-lg border border-dashed border-line p-3 text-sm font-semibold">Prévu V2 : fonction désactivée dans cette démo. Aucune donnée n'est collectée.</p>
      <form className="card space-y-3 p-4" onSubmit={(e) => e.preventDefault()} aria-disabled="true">
        <fieldset disabled className="space-y-3">
          <legend className="sr-only">Ajouter un contact de confiance (désactivé)</legend>
          <label className="block text-sm font-semibold">Nom<input className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3" placeholder="Prénom Nom" /></label>
          <label className="block text-sm font-semibold">Téléphone<input className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3" placeholder="+000 00 00 00 00" /></label>
          <button type="submit" className="btn w-full" title="Prévu V2">Ajouter ce contact (Prévu V2)</button>
        </fieldset>
      </form>
    </section>
  )
}
