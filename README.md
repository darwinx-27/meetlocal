# LocalMeet - Application de Réunion Locale

LocalMeet est une application de messagerie instantanée et de visioconférence en temps réel, basée sur Mumble2. Elle permet aux utilisateurs de communiquer via des salons de discussion sécurisés avec support de la messagerie texte et des appels vocaux/vidéo en utilisant WebRTC pour une communication peer-to-peer.

## Fonctionnalités Principales

- 🎤 Communication vocale et vidéo en temps réel via WebRTC
- 💬 Messagerie instantanée dans des salons de discussion
- 🔒 Connexion sécurisée avec HTTPS et WebSockets
- 👥 Gestion des utilisateurs et des salons
- 🌐 Interface web moderne et réactive

## Prérequis

- Node.js (version 14 ou supérieure)
- npm (gestionnaire de paquets Node.js)
- Navigateur web moderne (Chrome, Firefox, Edge, etc.)

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone [URL_DU_DEPOT]
   cd localmeet
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration SSL**
   - Assurez-vous d'avoir un dossier `ssl/` contenant les certificats SSL (`key.pem` et `cert.pem`)
   - Pour le développement, vous pouvez générer des certificats auto-signés avec OpenSSL

4. **Démarrer le serveur**
   ```bash
   npm start
   ```

5. **Accéder à l'application**
   Ouvrez votre navigateur et allez à l'adresse : `https://localhost:3000`
   > **Note** : En raison des certificats auto-signés, votre navigateur pourra afficher un avertissement de sécurité que vous devrez ignorer pour le développement.

## Architecture Technique

- **Backend** : Node.js avec Express et Socket.IO
- **Frontend** : HTML5, CSS3, JavaScript natif
- **Communication** : WebSocket pour la messagerie, WebRTC pour la voix
- **Sécurité** : HTTPS, gestion des CORS, validation des entrées

## Structure des Fichiers

```
localmeet/
├── public/           # Fichiers statiques (HTML, CSS, JS, images)
├── ssl/              # Certificats SSL
├── server.js         # Serveur principal
├── package.json      # Dépendances et scripts
└── README.md         # Ce fichier
```

## Développement

### Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```
PORT=3000
NODE_ENV=development
```

### Scripts utiles

- `npm start` : Démarre le serveur en mode production
- `npm run dev` : Démarre le serveur en mode développement avec rechargement automatique

## Sécurité

- Toutes les communications sont chiffrées avec TLS 1.2 ou supérieur
- Validation des entrées utilisateur côté serveur
- Gestion des sessions et des autorisations
- Protection contre les attaques XSS et CSRF

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Auteur

[Charles Kamga] - [charleskamgapr@gmail.com]

## Remerciements

- [Socket.IO](https://socket.io/) pour la gestion des WebSockets
- [Express](https://expressjs.com/) pour le serveur web
- [WebRTC](https://webrtc.org/) pour la communication en temps réel
