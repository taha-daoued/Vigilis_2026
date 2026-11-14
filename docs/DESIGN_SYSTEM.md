# Design system Vigilis (V1 démo statique)

> Note : le skill `ui-ux-pro-max` n'a **pas** été installé (il impose un CLI npm / plugin tiers externe). Ce design system est donc rédigé à la main selon les règles du prompt (sobre, institutionnel, lisible sous stress, AA). Il pourra être revu avec le skill plus tard.

## Principes
- Sobre et institutionnel ; pas d'effets de verre, de néon ni d'animations lourdes.
- Sombre pour la supervision (`.theme-admin`), clair pour la PWA utilisateur.
- Un statut ou un type n'est **jamais** porté par la couleur seule : forme + libellé + icône.
- Cibles tactiles ≥ 44 px, focus visible (anneau 3 px), `prefers-reduced-motion` respecté.

## Tokens (définis dans `web/src/index.css`)
| Rôle | Clair | Sombre (admin) |
|---|---|---|
| Fond `--bg` | `#f4f6fb` | `#0b1220` |
| Surface `--surface` | `#ffffff` | `#111a2e` |
| Surface 2 | `#eef1f8` | `#1b2740` |
| Bordure | `#cbd3e3` | `#33405c` |
| Texte | `#0b1220` | `#e8edf7` |
| Texte atténué | `#46526b` | `#a3b0c8` |
| Focus | `#1d4ed8` | `#93b4fb` |
| OK / Alerte moyenne / Danger | `#15803d` / `#b45309` / `#b91c1c` | `#4ade80` / `#fbbf24` / `#f87171` |

Marque : `brand-600 #1d4ed8`, `brand-500 #2563eb`, `brand-300 #93b4fb`.

## Types d'incident (couleur + forme + glyphe + libellé)
| Type | Couleur | Forme | Glyphe |
|---|---|---|---|
| Violence | `#dc2626` | triangle | `!` |
| Chute / malaise | `#d97706` | carré | `↓` |
| SOS | `#7c3aed` | cercle | `S` |
| Vol (expérimental) | `#0d9488` | losange | `?` + badge « Expérimental » |

## Statuts
Nouveau `●` (danger), En cours `◐` (alerte), Clôturé `✓` (ok) : toujours icône + texte.

## Typographie
Police système (`Segoe UI`, `system-ui`, …), aucune police externe (fonctionne hors ligne). Titres en gras, corps 14-16 px.

## Composants
`.btn` (44 px minimum), `.btn-primary`, `.btn-danger`, `.card`, badges (`TypeBadge`, `StatusBadge`, `ExperimentalBadge`), marqueurs de carte (SVG forme + glyphe), toasts (`aria-live="polite"`).

## Limites connues
Contrastes choisis pour viser AA mais **non audités** avec un outil ; score Lighthouse **non mesuré**.
