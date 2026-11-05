# Contrat front / back

Ce fichier est la référence commune. Toute modification d'une route ou d'un message se discute à deux **avant** d'être codée.
Les types TypeScript correspondants sont dans `frontend/src/api/types.ts`, les DTO Java dans `backend/.../*Dtos.java`.

## Erreurs

Toutes les erreurs ont la même forme :

```json
{ "code": "PSEUDO_TAKEN", "message": "Ce pseudo est déjà pris dans cette session", "details": null }
```

| Code HTTP | `code` | Quand |
|---|---|---|
| 400 | `VALIDATION_ERROR` | champs invalides (`details` liste les champs) |
| 400 | `INVALID_PSEUDO`, `INVALID_CHOICE` | pseudo vide ou trop long ; choix inconnu ou plusieurs choix en mode UNIQUE |
| 401 | `UNAUTHORIZED`, `BAD_CREDENTIALS`, `INVALID_TOKEN` | pas connecté ; mauvais mot de passe ; jeton étudiant invalide |
| 404 | `ACTIVITY_NOT_FOUND`, `SESSION_NOT_FOUND` | introuvable (ou appartient à un autre enseignant) |
| 409 | `INVALID_STATE` | action incompatible avec l'état de la session |
| 409 | `ACTIVITY_LOCKED`, `ACTIVITY_ARCHIVED`, `ACTIVITY_NOT_READY` | règles R1 et cycle de vie de l'activité |
| 409 | `PSEUDO_TAKEN`, `ALREADY_ANSWERED`, `QUESTION_CLOSED`, `NO_MORE_QUESTIONS`, `EMAIL_TAKEN`, `RESULTS_NOT_READY` | règles métier |
| 502 / 503 | `AI_ERROR`, `AI_BAD_RESPONSE`, `AI_UNAVAILABLE` | service IA en échec ou arrêté |

## API REST

Les routes `/api/**` exigent `Authorization: Bearer <jwt>`, sauf `/api/auth/register`, `/api/auth/login` et `/api/public/**`.
Documentation interactive générée : http://localhost:8081/swagger-ui.html

### Authentification enseignant

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password (8+), displayName }` | 201 `{ token, teacher }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, teacher }` |
| GET | `/api/auth/me` | — | `{ id, email, displayName }` |

### Activités (MongoDB)

| Méthode | Route | Effet |
|---|---|---|
| GET | `/api/activities?status=PRETE` | liste (filtre facultatif) |
| GET | `/api/activities/{id}` | détail |
| POST | `/api/activities` | création ; statut calculé : `PRETE` si les règles W2 sont respectées, sinon `BROUILLON` |
| PUT | `/api/activities/{id}` | modification (refusée si verrouillée ou archivée) |
| DELETE | `/api/activities/{id}` | suppression (refusée si verrouillée) |
| POST | `/api/activities/{id}/duplicate` | copie modifiable |
| POST | `/api/activities/{id}/archive` / `/restore` | archivage |

Corps de création / modification :

```json
{
  "type": "QUIZ",
  "title": "Les design patterns structurels",
  "description": "",
  "questions": [
    {
      "id": null,
      "text": "Quel pattern organise des objets en arborescence ?",
      "choiceMode": "UNIQUE",
      "choices": [
        { "id": null, "label": "Composite", "correct": true },
        { "id": null, "label": "Proxy", "correct": false }
      ]
    }
  ]
}
```

La réponse ajoute `id`, `status`, `locked` (R1), `errors` (règles W2 non respectées), `questionCount`, `createdAt`, `updatedAt`.

### IA

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/ai/questions` | `{ text (50–20 000 car.), type, count (1–10), language, difficulty }` | `{ questions: [{ text, choiceMode, choices: [{ label, correct }], explanation }], model }` |

Les questions générées ne sont **pas** enregistrées : l'enseignant les relit dans l'éditeur (W7).

### Sessions (enseignant)

| Méthode | Route | Transition |
|---|---|---|
| GET | `/api/sessions?scope=active\|finished` | liste / historique |
| POST | `/api/sessions` `{ activityId }` | lancer → `EN_ATTENTE` (code de 6 caractères) |
| GET | `/api/sessions/{id}` | état complet (sert aussi à reprendre après déconnexion) |
| POST | `/api/sessions/{id}/start` | `EN_ATTENTE` → `QUESTION_OUVERTE` (question 1) |
| POST | `/api/sessions/{id}/questions/close` | `QUESTION_OUVERTE` → `QUESTION_FERMEE` |
| POST | `/api/sessions/{id}/questions/next` | `QUESTION_FERMEE` → `QUESTION_OUVERTE` (question suivante) |
| POST | `/api/sessions/{id}/end` | → `TERMINEE`, calcule scores et statistiques, renvoie les résultats |
| POST | `/api/sessions/{id}/cancel` | `EN_ATTENTE` → `ANNULEE` |
| GET | `/api/sessions/{id}/results` | résultats d'une session terminée |

### Étudiants (public, sans compte)

Le jeton reçu au `join` est envoyé dans l'en-tête `X-Participant-Token`.

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/public/config` | `{ publicUrl }` (URL utilisée dans le QR code) |
| GET | `/api/public/sessions/{code}` | `{ code, title, type, state }` (404 si aucune session active) |
| POST | `/api/public/sessions/{code}/join` `{ pseudo }` | 201 `{ participantId, pseudo, token }` |
| GET | `/api/public/sessions/{code}/state` | état complet de l'écran étudiant (question, déjà répondu, correction, résultat final) |
| POST | `/api/public/sessions/{code}/answers` `{ questionId, choiceIds }` | 201 `{ accepted: true }` |

## WebSocket (STOMP)

Connexion : `ws://<hôte>/ws`. L'enseignant ajoute l'en-tête STOMP `Authorization: Bearer <jwt>` au CONNECT.
Les clients ne publient rien : toutes les actions passent par l'API REST.

Chaque message a la forme `{ "type": "...", "payload": { ... }, "at": "2026-11-05T10:00:00Z" }`.

| Canal | Type | Payload |
|---|---|---|
| `/topic/sessions/{code}` | `QUESTION_OPENED` | `{ id, index, total, text, choiceMode, choices: [{ id, label }] }` (jamais la bonne réponse) |
| | `QUESTION_CLOSED` | `{ questionId, correctChoiceIds, distribution: { choiceId: n }, answerCount }` |
| | `SESSION_ENDED` | `{ code }` → l'étudiant relit son état pour obtenir son score |
| | `SESSION_CANCELLED` | `{ code }` |
| `/topic/sessions/{code}/teacher` (propriétaire uniquement) | `PARTICIPANT_JOINED` | `{ pseudo, participantCount }` |
| | `ANSWER_STATS` | `{ questionId, answerCount, participantCount, distribution }` |
| | `SESSION_RESULTS` | même objet que `GET /results` |

**Règle de reconnexion** : à chaque (re)connexion, le client relit l'état par l'API REST, car des messages ont pu être perdus pendant la coupure.
