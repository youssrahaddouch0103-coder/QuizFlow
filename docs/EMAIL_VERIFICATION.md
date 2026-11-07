# Vérification email — lot backend

Le formulaire d'inscription gère la réponse 202 puis affiche la saisie du code,
son expiration et le renvoi. Le JWT est enregistré uniquement après confirmation.
Le challenge est conservé dans sessionStorage pour reprendre après actualisation,
sans conserver le mot de passe ni le code. Le script smoke utilise désormais un compte
confirmé via SMOKE_EMAIL et SMOKE_PASSWORD. Google, récupération de mot de passe,
renouvellement/révocation des JWT et vérification rétroactive ne font pas partie de ce lot.

## Configuration avant démarrage (aucune valeur secrète dans Git)

Définir dans l'environnement du backend :

| Variable | Usage |
|---|---|
| `APP_EMAILVERIFICATION_HMACKEY` | Clé aléatoire d'au moins 32 octets, encodée en Base64, distincte du secret JWT |
| `APP_EMAILVERIFICATION_FROM` | Adresse d'expédition autorisée par le prestataire SMTP |
| `SPRING_MAIL_HOST` | Serveur SMTP |
| `SPRING_MAIL_PORT` | Port SMTP (habituellement 587 pour STARTTLS) |
| `SPRING_MAIL_USERNAME` | Identifiant SMTP |
| `SPRING_MAIL_PASSWORD` | Secret SMTP |

Les noms Spring correspondants sont `app.email-verification.hmac-key`,
`app.email-verification.from` et `spring.mail.*`. Aucun fichier `.env` n'est chargé
automatiquement par Spring Boot. Docker Compose transmet ces paramètres depuis son
environnement ou le fichier .env local. Ne jamais versionner les secrets SMTP ou HMAC.

Paramètres facultatifs : `app.email-verification.code-ttl=10m`, `resend-delay=60s`,
`retention=24h`, `max-attempts=5`, `email-requests-per-hour=5`, `ip-requests-per-minute=60`.
Les durées/quota sont validés. La clé, l'expéditeur et le serveur SMTP sont obligatoires.
La rotation de la clé invalide les codes existants et change les clés des quotas ; prévoir
une transition contrôlée. Ne pas exposer les configurations via les endpoints d'administration.

Le client SMTP impose des délais de connexion/lecture/écriture de 5 secondes, vérifie le nom
du serveur TLS et désactive les traces SMTP. STARTTLS est activé et obligatoire par défaut.
Pour un serveur de capture **local uniquement**, configurer
`spring.mail.properties.mail.smtp.starttls.enable=false` et
`spring.mail.properties.mail.smtp.starttls.required=false` dans une configuration locale
hors dépôt. Ne pas désactiver TLS pour un fournisseur distant.

## Données et concurrence

`V2__email_verification.sql` ajoute uniquement des tables/index. Elle ne modifie pas les comptes
existants. Flyway l'appliquera au prochain démarrage autorisé : ne pas démarrer le backend sur
une base existante sans sauvegarde et validation de la configuration d'envoi.

Les projections temporaires utilisent JDBC, déjà fourni par JPA, sans nouvelle dépendance.
La création du compte utilise le repository JPA existant. Les deux participent à la même
transaction Spring/DataSource. Les verrous transactionnels PostgreSQL sérialisent les opérations
par email, y compris avant création d'une ligne ; le verrou de ligne protège contre le nettoyage.
La consommation, la création du compte et la preuve de vérification sont atomiques.

Les quotas utilisent des transactions indépendantes et des incréments PostgreSQL atomiques.
Le compteur d'un code incorrect est validé avant de lever l'erreur HTTP. Les quotas par email
survivent au renvoi et empêchent de réinitialiser indéfiniment le budget d'essais.
Le HMAC associe code, identifiant et version. Aucun code brut n'est conservé dans la base.
Les données temporaires sont supprimées après 24 heures par un nettoyage horaire : la rétention
physique peut donc atteindre 25 heures ; le refus logique intervient dès 24 heures.

L'envoi SMTP est synchrone, dans la transaction d'inscription/renvoi, avec attentes réseau bornées.
Une erreur SMTP annule la nouvelle inscription ou conserve l'ancien code lors d'un renvoi.
Une acceptation SMTP suivie d'une erreur de commit peut produire un email inutilisable : l'utilisateur
doit recommencer. Une boîte de sortie asynchrone pourra être étudiée si la charge le justifie.
L'acceptation SMTP ne garantit pas la livraison en boîte de réception.

Les réponses courantes sont neutres pour les adresses déjà utilisées. Elles ne garantissent
pas une indistinguabilité temporelle parfaite (l'envoi SMTP est synchrone). Une nouvelle demande
ne révèle pas l'identifiant en cours et ne remplace jamais son mot de passe. Conserver le
`challengeId` initial ; si perdu, attendre la fin de rétention pour recommencer. Ce compromis
évite de remplacer les identifiants choisis par le premier demandeur ; une reprise par email
sera un parcours distinct si nécessaire.

Le quota réseau utilise l'adresse du pair, **pas un X-Forwarded-For fourni par le client**.
Derrière Nginx/Vite, plusieurs utilisateurs peuvent partager ce quota. Avant production,
configurer explicitement la chaîne de proxies de confiance et une limitation au niveau de l'entrée
réseau ; ne pas accepter aveuglément des en-têtes transférés. Les quotas email restent individuels.

## Tests

`mvn test` : tests unitaires et HTTP isolés ; tests PostgreSQL via Testcontainers si Docker est actif.
La classe `EmailVerificationPostgresTest` utilise exclusivement l'URL d'un conteneur éphémère,
exécute V1/V2 dessus et ne se connecte jamais à la base de développement.
Sans Docker, ces tests sont signalés comme ignorés : cela ne valide pas les migrations/concurrence.
Les tests email utilisent un expéditeur simulé et ne prouvent pas une livraison SMTP réelle.
Java 21 est la version cible. Avec Java 25 et la version Mockito gérée par Spring Boot 3.3.5,
un lancement de tests peut nécessiter `-Dnet.bytebuddy.experimental=true`.
