# Modèle Firestore (projet `vigilis-2026`)

Trois collections : `users`, `alerts`, `alert_logs`. Les champs reprennent exactement les types du frontend (`web/src/services/types.ts`) pour que le passage du mock à FastAPI ne change pas les écrans.

**Principe de sécurité** : le client (navigateur) ne fait aucune écriture directe. Toute écriture passe par FastAPI (`firebase-admin`), qui vérifie l'ID token Firebase. Le client peut seulement lire, selon son rôle.

## `users/{uid}`
| Champ | Type | Remarque |
|---|---|---|
| `name` | string | |
| `email` | string | |
| `role` | `'user'` \| `'admin'` | Copie d'affichage. La **source de vérité** est le *custom claim* `role` du jeton. |
| `gpsConsent` | bool \| null | Null tant que l'utilisateur n'a pas répondu |
| `shareCamerasOnMap` | bool | |
| `createdAt` | timestamp | |

## `alerts/{alertId}` (un document par incident)
| Champ | Type | Remarque |
|---|---|---|
| `type` | `'violence'` \| `'chute'` \| `'sos'` \| `'vol'` | `vol` est expérimental |
| `status` | `'nouveau'` \| `'en_cours'` \| `'cloture'` | |
| `score` | number 0-1 | Absent pour un SOS (pas d'IA) |
| `createdAt` | timestamp | Moment de l'événement |
| `receivedAt` | timestamp | Réception par le système (compteur d'attente) |
| `takenAt`, `closedAt` | timestamp | Optionnels |
| `resolution` | `'confirme'` \| `'fausse_alerte'` | Obligatoire à la clôture |
| `position` | `{lat, lng}` \| null | Null si GPS révoqué (« sans position ») |
| `source` | `'camera'` \| `'app'` | |
| `cameraId`, `userId` | string | Optionnels. `userId` = uid de l'émetteur d'un SOS |
| `description` | string | |
| `windowsConfirmed` | number | Fenêtres consécutives au-dessus du seuil |
| `assignedTo` | string | uid de l'admin |
| `experimental` | bool | Vrai pour le vol |
| `imageUrl` | string | Pas de Storage (plan Spark) : à trancher (miniature réduite ou aucune image) |

## `alert_logs/{logId}` (journal d'audit, en ajout seulement)
| Champ | Type | Remarque |
|---|---|---|
| `incidentId` | string \| null | Null pour les événements système |
| `kind` | `detection`, `sos`, `prise_en_charge`, `cloture`, `resolution`, `reouverture`, `panne_camera`, `retablissement`, `reinitialisation` | |
| `action` | string | |
| `actor` | string | uid ou nom du service |
| `at` | timestamp | |

## Droits de lecture (règles Firestore, à écrire et tester)
| Collection | Utilisateur | Admin |
|---|---|---|
| `users/{uid}` | son propre document | tous |
| `alerts` | seulement ceux où `userId == uid` | tous |
| `alert_logs` | aucun accès | tous |
| Écriture (toutes) | **refusée** | **refusée** (FastAPI écrit avec `firebase-admin`) |

## Vie privée
- Ne pas écrire de position ni d'image dans les logs applicatifs.
- Durée de conservation à définir (le frontend affiche une valeur indicative).

## Tester les règles
```bash
cd web
npm run test:rules     # démarre l'émulateur Firestore, lance 14 tests, l'arrête
```
- Prérequis : Java (testé avec 23) et `firebase-tools`. Au premier lancement, l'émulateur (`.jar`, ~136 Mo) est téléchargé dans `~/.cache/firebase/emulators`.
- Port de l'émulateur : **8085** (8080 est pris par Apache sur le PC de développement).
- **Windows** : si Java échoue avec « Unable to establish loopback connection », définir un dossier temporaire court avant la commande (`TEMP=C:\tmpjava`, `TMP=C:\tmpjava`, `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\tmpjava`).
- Contrôle effectué : avec une règle volontairement trop permissive sur `alerts`, 6 tests sur 14 échouent ; les règles ont ensuite été restaurées.
