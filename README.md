# QuizFlow

Plateforme d'interaction en temps réel pour la classe (dans l'esprit de Wooclap) : l'enseignant lance un quiz ou un
sondage, les étudiants rejoignent avec un QR code depuis leur téléphone, et les résultats s'affichent en direct.
Une IA aide l'enseignant à générer des questions à partir de son cours.

Projet d'initiation — ENSAM Meknès — Youssra Haddouch et Ikram Ech-Charqy.

## Architecture

```
Navigateur (React)  ──REST /api──►  Backend Spring Boot  ──►  PostgreSQL (sessions, participants, réponses, résultats)
        ▲                │                │            └──►  MongoDB (activités, questions, choix)
        └──WebSocket /ws─┘ (STOMP)        └──HTTP──►  Service IA Python (FastAPI) ──► LLM (Groq / Gemini)
```

| Dossier | Contenu | Technologies |
|---|---|---|
| `backend/` | API REST, temps réel, règles métier | Java 21, Spring Boot 3, Spring Security (JWT), JPA + Flyway, MongoDB, STOMP |
| `frontend/` | interface enseignant et écran étudiant | React 19, TypeScript, Vite, @stomp/stompjs, qrcode.react |
| `ai-service/` | génération de questions par LLM | Python 3.12, FastAPI, httpx, pytest |
| `docs/` | contrat front/back, feuille de route IA | — |

La conception (workflows W1 à W7, UML, MCD/MLD) correspond aux documents P1 et P2.

## Démarrer avec Docker (le plus simple)

Prérequis : Docker Desktop.

```bash
cp .env.example .env          # puis mettre la clé Groq dans LLM_API_KEY (facultatif)
docker compose up --build
```

Ouvrir http://localhost:3000, créer un compte enseignant, créer un quiz, le lancer.

**Pour tester avec des téléphones** : ils doivent être sur le même Wi-Fi que le PC. Mettre l'adresse IP du PC dans
`PUBLIC_URL` (par exemple `PUBLIC_URL=http://192.168.1.20:3000`), relancer, et ouvrir QuizFlow sur le PC avec cette
même adresse. Le QR code pointe alors vers une URL que les téléphones peuvent ouvrir.

Sans clé d'API, le service IA fonctionne en mode `mock` (questions de démonstration) : toute la chaîne reste testable.

## Développer

Lancer seulement les bases et l'IA dans Docker, puis le backend et le frontend en local (rechargement à chaud) :

```bash
docker compose up postgres mongo ai-service

# Terminal 2 : backend (ou bouton Run dans IntelliJ sur QuizflowApplication)
cd backend && mvn spring-boot:run          # http://localhost:8081/swagger-ui.html

# Terminal 3 : frontend
cd frontend && npm install && npm run dev  # http://localhost:5173
```

Le serveur Vite redirige `/api` et `/ws` vers le backend, et il est accessible depuis le Wi-Fi (`http://<IP-du-PC>:5173`).

Service IA seul, sans Docker :

```bash
cd ai-service
python -m venv .venv && .venv/bin/pip install -r requirements.txt   # Windows : .venv\Scripts\pip
LLM_API_KEY=... .venv/bin/uvicorn app.main:app --reload --port 8000  # docs : http://localhost:8000/docs
```

## Tests

```bash
cd backend && mvn verify            # règles W2, score et classement
cd frontend && npm run lint && npm run build
cd ai-service && python -m pytest -q
```

La CI GitHub Actions (`.github/workflows/ci.yml`) lance ces trois commandes à chaque pull request.

## Organisation du binôme

- `main` est toujours démontrable ; personne n'y pousse directement.
- Une branche par tâche : `feature/12-nuage-de-mots`, `fix/...`, `docs/...`.
- Petites pull requests relues par l'autre, CI verte avant fusion.
- Commits au format Conventional Commits : `feat:`, `fix:`, `docs:`, `test:`.
- Toute modification d'une route ou d'un message temps réel passe d'abord par [`docs/CONTRAT.md`](docs/CONTRAT.md).

## État du projet

**MVP fait** : comptes enseignants (JWT) ; activités quiz et sondage (choix unique ou multiple) avec brouillon, statut
calculé, duplication, archivage, verrouillage après utilisation (R1) ; lancement d'une session avec code et QR code ;
participation anonyme par pseudo avec reconnexion ; questions pilotées par l'enseignant ; réponses et statistiques en
direct ; correction affichée à la fermeture ; clôture avec scores, classement et statistiques ; historique et export
CSV ; fin automatique des sessions abandonnées (R7) ; génération de questions par IA avec relecture.

**Suite prévue** : voir [`docs/IA.md`](docs/IA.md) (RAG sur les PDF de cours, évaluation des modèles, analyse des
réponses libres) et les bonus : nuage de mots, bouton « je suis perdu », minuteur, test de charge à 50 participants.
