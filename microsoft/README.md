# QuizFlow dans PowerPoint et Teams

Pas besoin de déployer le site : QuizFlow tourne toujours sur votre PC avec `docker compose up --build`.
Il faut seulement une adresse **HTTPS**, car PowerPoint et Teams refusent le HTTP.

| Pour | Adresse HTTPS | Comment |
|---|---|---|
| PowerPoint | `https://localhost:3443` | certificat de développement Microsoft (étape 1) |
| Teams | `https://xxxx.trycloudflare.com` | tunnel Cloudflare gratuit (étape 3) |

Toutes les commandes se lancent dans PowerShell, depuis le dossier du projet
(`cd C:\projet_initiation\QuizFlow\quizflow`).

---

## 1. Activer HTTPS (une seule fois)

```powershell
npx office-addin-dev-certs install
New-Item -ItemType Directory -Force certs
Copy-Item "$env:USERPROFILE\.office-addin-dev-certs\localhost.*" certs\
docker compose up --build -d
```

Windows demande d'accepter un certificat : répondez **Oui**.
Vérifiez ensuite que `https://localhost:3443` ouvre QuizFlow dans le navigateur, sans alerte.

Le dossier `certs/` contient une clé privée : il est ignoré par Git, ne le partagez pas.

## 2. Complément PowerPoint

```powershell
node microsoft/build.mjs
npx office-addin-dev-settings sideload microsoft\out\powerpoint-manifest.xml desktop
```

PowerPoint s'ouvre avec le complément installé. Ensuite :

1. Onglet **Accueil > Compléments** (ou **Insertion > Mes compléments**), puis choisissez **QuizFlow**. Un cadre apparaît sur la diapositive : agrandissez-le.
2. Connectez-vous, puis choisissez l'activité. Le choix est enregistré dans le fichier .pptx.
3. Pendant le diaporama, cliquez sur **Lancer la session** : le code, le QR code et les résultats s'affichent dans la diapositive.

Avec PowerPoint en ligne (office.com) : **Accueil > Compléments > Plus de paramètres > Charger mon complément**, puis choisissez `microsoft\out\powerpoint-manifest.xml`.

> Le QR code pointe vers `localhost` : les téléphones ne peuvent pas l'ouvrir. Mettez `PUBLIC_URL=http://<IP du PC>:3000`
> dans `.env` (ou l'adresse du tunnel de l'étape 3), puis relancez `docker compose up -d`.

## 3. Application Teams

### a) Ouvrir un tunnel (à chaque séance)

```powershell
winget install --id Cloudflare.cloudflared      # une seule fois
cloudflared tunnel --url http://localhost:3000
```

Laissez cette fenêtre ouverte. Elle affiche une adresse comme `https://abcd-efgh.trycloudflare.com`.
Cette adresse change à chaque lancement du tunnel.

Bonus : avec cette adresse, les téléphones peuvent rejoindre QuizFlow depuis n'importe quel réseau, et le scan
du QR code par la caméra marche, puisque c'est du HTTPS.

### b) Créer le paquet Teams (dans une autre fenêtre PowerShell)

```powershell
node microsoft/build.mjs abcd-efgh.trycloudflare.com
```

Le fichier `microsoft\out\quizflow-teams.zip` est créé.

### c) Installer dans Teams

1. Teams, puis **Applications > Gérer vos applications > Charger une application > Charger une application personnalisée**, et choisissez le .zip.
2. Ouvrez une **réunion planifiée**, puis **Applications (+) > QuizFlow > Enregistrer**. QuizFlow apparaît dans le panneau de la réunion.
3. L'enseignant se connecte et clique sur **Lancer**, puis sur **Afficher pour tous les participants** : la page pour rejoindre s'affiche sur l'écran de la réunion, et chacun répond dans Teams.
4. **Piloter la session** ouvre l'écran de l'enseignant (questions suivantes, résultats).

Si le menu « Charger une application personnalisée » n'apparaît pas, c'est que le compte Microsoft 365 de l'école
bloque les applications personnalisées. Il faut alors demander au service informatique, ou utiliser un autre compte
Microsoft 365 qui les autorise.

Quand l'adresse du tunnel change, refaites les étapes b) et c). Dans Teams, utilisez **Mettre à jour** sur l'application.
