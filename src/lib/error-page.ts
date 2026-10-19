export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Page indisponible — PROTEIN STORE®</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0b0b0b; color: #fff; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      .brand { font-size: 0.8rem; letter-spacing: 0.25em; color: #e63329; font-weight: 700; }
      h1 { font-size: 1.35rem; margin: 1rem 0 0.5rem; }
      p { color: #a3a3a3; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.55rem 1rem; border-radius: 0.45rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #e63329; color: #fff; }
      .secondary { background: transparent; color: #fff; border-color: #333; }
      .contact { margin-top: 1.5rem; font-size: 0.8rem; color: #a3a3a3; }
      .contact a { color: #e63329; padding: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="brand">PROTEIN STORE®</p>
      <h1>Cette page n'a pas pu se charger</h1>
      <p>Une erreur temporaire est survenue. Réessayez ou revenez à la boutique.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Retour à l'accueil</a>
      </div>
      <p class="contact">Besoin d'aide ? <a href="https://wa.me/212776566089">WhatsApp +212 776 566 089</a></p>
    </div>
  </body>
</html>`;
}
