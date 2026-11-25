# QuizFlow

🇬🇧 [English version](README.md)

Plateforme d'interaction en temps réel pour la classe  : l'enseignant lance un quiz ou un
sondage, les étudiants rejoignent avec un QR code depuis leur téléphone, et les résultats s'affichent en direct.
Une IA aide l'enseignant à générer des questions à partir de son cours : texte collé ou PDF importé (RAG, avec la page source de chaque question).

Projet d'initiation — ENSAM Meknès — Youssra Haddouch et Ikram Ech-Charqy.

## Architecture

```
Navigateur (React)  ──REST /api──►  Backend Spring Boot  ──►  PostgreSQL (sessions, participants, réponses, résultats)
        ▲                │                │            └──►  MongoDB (activités, questions, choix)
        └──WebSocket /ws─┘ (STOMP)        └──HTTP──►  Service IA Python (FastAPI) ──► LLM (Groq / Gemini)
                                                                         └─► PostgreSQL + pgvector (PDF, embeddings e5)
```

| Dossier | Contenu | Technologies |
|---|---|---|
| `backend/` | API REST, temps réel, règles métier | Java 21, Spring Boot 3, Spring Security (JWT), JPA + Flyway, MongoDB, STOMP |
| `frontend/` | interface enseignant et écran étudiant | React 19, TypeScript, Vite, @stomp/stompjs, qrcode.react |
| `ai-service/` | génération de questions par LLM, RAG sur les PDF | Python 3.12, FastAPI, pypdf, fastembed (multilingual-e5-small), pgvector, pytest |
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

## Connexion Google en local

Dans le fichier **`.env` à la racine du projet** (ignoré par Git), renseigner
`GOOGLE_CLIENT_ID=<votre-identifiant-Web>.apps.googleusercontent.com`.
Ne pas remplacer un `.env` existant par le modèle : il peut contenir d'autres secrets.
Ne pas mettre la vraie valeur dans `.env.example`, le code ou un commit.
Le client ID est un identifiant public transmis au navigateur ; aucun **client secret**
Google n'est nécessaire pour ce flux et il ne faut pas en ajouter au frontend.

Dans Google Auth Platform, choisir un client OAuth **Application Web** et autoriser
les origines JavaScript `http://localhost`, `http://localhost:3000` (Docker) et
`http://localhost:5173` (Vite). Ajouter le port exact si différent, par exemple 5174.
Configurer l'audience/écran de consentement et les utilisateurs de test si nécessaire.
Ce flux utilise un callback JavaScript, pas une URL de redirection OAuth.
Utiliser localhost pour ce test : une IP privée en HTTP n'est pas un remplacement.
Voir la [configuration officielle Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

Avec Docker Desktop démarré, depuis la racine :

```powershell
docker compose up -d --build backend frontend
```

Compose lit `.env` et transmet `GOOGLE_CLIENT_ID` au backend. Un simple
`docker compose restart` ne recharge pas les variables d'environnement.
Pour Spring Boot lancé directement, `.env` n'est **pas** chargé automatiquement :
définir `GOOGLE_CLIENT_ID` dans l'environnement de la configuration Run de l'IDE
(configuration locale non partagée), ou charger uniquement cette valeur depuis
`.env` dans le terminal PowerShell avant Maven, sans l'afficher :

```powershell
# Depuis la racine ; format attendu dans .env : GOOGLE_CLIENT_ID=valeur
$googleLine = Get-Content -LiteralPath .env | Where-Object { $_ -match '^\s*GOOGLE_CLIENT_ID\s*=' } | Select-Object -Last 1
if (-not $googleLine) { throw 'GOOGLE_CLIENT_ID absent de .env' }
$env:GOOGLE_CLIENT_ID = ($googleLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
Remove-Variable googleLine
Set-Location backend
mvn spring-boot:run
```

Aucune variable `VITE_GOOGLE_CLIENT_ID` n'est utilisée. Le frontend appelle
`POST /api/auth/google/challenge` via le proxy Vite/nginx, reçoit le client ID et
un nonce, puis charge Google Identity Services. Le backend garde une preuve dans
un cookie HttpOnly et vérifie la signature, l'émetteur, l'audience, l'expiration
et le nonce du jeton envoyé à `POST /api/auth/google/session` avant de créer la
session QuizFlow. Le challenge est à usage unique et expire après cinq minutes.

Vérification : ouvrir `/login` ou `/register` et consulter l'onglet Réseau.
Le challenge doit répondre 200 avec un cookie HttpOnly (204 signifie désactivé).
Choisir un compte Gmail ou Google Workspace ; la session doit répondre 200 et
rediriger vers `/dashboard`. Recharger pour vérifier la persistance de la session.
Ne pas copier les jetons ni les cookies dans les logs ou captures partagées.
Une adresse tierce associée à Google doit utiliser la connexion par email.
Si la page est restée ouverte plus de cinq minutes, réessayer pour renouveler le challenge.

## Tests

```bash
cd backend && mvn verify            # règles W2, score et classement
cd frontend && npm run lint && npm run build
cd ai-service && pip install -r requirements-dev.txt && python -m pytest -q
# tests RAG avec la base : TEST_DATABASE_URL=postgresql://quizflow:quizflow@localhost:5432/quizflow
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
CSV ; fin automatique des sessions abandonnées (R7) ; génération de questions par IA avec relecture ; bibliothèque de PDF
et génération RAG avec page source et extrait justificatif.

**Suite prévue** : voir [`docs/IA.md`](docs/IA.md) (évaluation des modèles et du RAG, analyse des
réponses libres) et les bonus : nuage de mots, bouton « je suis perdu », minuteur, test de charge à 50 participants.
