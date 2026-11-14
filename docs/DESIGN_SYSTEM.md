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
| Violence | `#e11d48` | triangle | `!` |
| Chute / malaise | `#bf8a00` | carré | `↓` |
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

## V1.1 : validation de la palette des types
Palette catégorielle des 4 types vérifiée avec `validate_palette.js` du skill `dataviz` (mode sombre) : bande de luminosité, chroma, séparation daltonisme et vision normale **passent** (pire paire : chute ↔ violence, ΔE 8,5 en deutéranopie, 20,4 en vision normale ; la séparation daltonisme étant entre 6 et 8, la forme et le libellé sont obligatoires, ce qui est déjà la règle). Les anciennes valeurs `#dc2626` / `#d97706` échouaient au plancher de vision normale (ΔE 14,4) et ont été remplacées.

## Composants réutilisables ajoutés en V1.1
| Composant | Rôle |
|---|---|
| `StatusBar` | Bande d'état : nouveaux, en cours, temps moyen, caméras, service IA (Simulé). |
| `PriorityQueue` | File triée SOS → score → ancienneté, filtres, actions rapides. |
| `WaitCounter` | Compteur d'attente (minuteur partagé `useNow`) ; dépassement = ⚠ + texte + bordure. |
| `DayTimeline` | Frise 24 h : forme + couleur par type, tooltip hover/focus, pics regroupés. |
| `ResolutionDialog` | `<dialog>` natif : Confirmé / Fausse alerte obligatoire, focus géré, Échap annule. |
| `IncidentDetail` | Image + squelette simulé, score + fenêtres (seuil visible), mini-carte, proches, historique. |
| `LiveMap` / `MiniMap` | Carte Leaflet avec fond de repli sans tuiles ; mini-carte non interactive. |
| `AlertTimeline` | Frise verticale Envoyée → Reçue → Prise en charge → Clôturée. |
| `Switch` | Interrupteur `role="switch"`, état écrit (● Activé / ○ Désactivé). |
| `RoleSwitcher`, `Tour` | Changement de vue sans déconnexion ; visite guidée en 3 étapes. |
| Heatmap (`AdminStats`) | Une seule teinte (sequentiel), 5 niveaux, valeur dans chaque case, légende, tableau alternatif. |
| Jauge de latence (`AdminHealth`) | Barre sobre + repère d'objectif 3 s ; étiquettes « Simulé » et « Objectif ». |
| `SimulatedBadge` / `ResolutionBadge` | Étiquette « Simulé » ; résolution avec icône et texte. |

Règle ajoutée : tout indicateur simulé porte le badge « Simulé » ; les barres sont fines (8 px) avec arrondi côté données, texte en jetons de texte (jamais la couleur de la série).
