/**
 * MUMBLE2 - Application de chat local avec salons
 * ---------------------------------------------
 * Serveur principal gérant les connexions WebSocket, les salons de discussion et WebRTC
 */

//=============================================================================
// IMPORTS ET CONFIGURATION DE BASE
//=============================================================================

// Modules de base
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

/**
 * Configuration SSL pour le serveur HTTPS
 * Les certificats sont auto-signés et stockés dans le dossier /ssl
 */
const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl/cert.pem')),
    // Renforcer la sécurité avec les paramètres TLS recommandés
    minVersion: 'TLSv1.2',
    ciphers: [
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true
};

// Création du serveur HTTPS sécurisé
const server = https.createServer(options, app);

/**
 * Configuration de Socket.IO pour les communications en temps réel
 * Inclut des paramètres de sécurité et de performance
 */
const io = require('socket.io')(server, {
    cors: {
        origin: function(origin, callback) {
            // En production, vous devriez limiter les origines
            // Pour le développement, nous acceptons toutes les origines
            callback(null, true);
        },
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    // Améliorer la sécurité et la stabilité des WebSockets
    allowEIO3: true,
    pingTimeout: 30000,
    pingInterval: 25000
});

//=============================================================================
// MIDDLEWARE ET CONFIGURATION EXPRESS
//=============================================================================

/**
 * Middleware de sécurité
 * Ajoute des en-têtes HTTP pour renforcer la sécurité de l'application
 */
app.use((req, res, next) => {
    // Définir des entêtes de sécurité
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Autoriser les requêtes CORS nécessaires pour WebRTC
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Configuration pour servir les fichiers statiques depuis le dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Port du serveur (utilise 3001 par défaut)
const PORT = process.env.PORT || 3001;

//=============================================================================
// GESTION DES ERREURS SERVEUR
//=============================================================================

/**
 * Gestionnaire d'erreurs pour le serveur HTTPS
 * Fournit des messages utiles pour diagnostiquer les problèmes courants
 */
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`Le port ${PORT} est déjà utilisé. Veuillez arrêter le processus qui l'utilise ou utiliser un autre port.`);
        console.log('Vous pouvez utiliser la commande "lsof -i :3001" pour voir quel processus utilise ce port.');
        console.log('Puis "kill -9 PID" pour terminer ce processus.');
    } else {
        console.error(`Erreur lors du démarrage du serveur:`, e);
    }
    process.exit(1);
});

//=============================================================================
// ROUTES HTTP DE L'APPLICATION
//=============================================================================

/**
 * Route pour obtenir les informations de connexion réseau
 * Récupère l'adresse IP locale pour faciliter la connexion d'autres appareils
 */
app.get('/get-connection-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';
    
    // Trouver l'adresse IP locale (non-interne, IPv4)
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ip = iface.address;
                break;
            }
        }
    }
    
    // Renvoie les informations de connexion sécurisée HTTPS
    res.json({
        ip: ip,
        port: PORT,
        protocol: 'https',
        secure: true
    });
});

/**
 * Route de santé du serveur
 * Utilisée pour vérifier si le serveur est opérationnel
 */
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date() });
});

/**
 * Routes pour les pages principales de l'application
 */
// Page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Page de réunion/salon
app.get('/room.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

//=============================================================================
// GESTION DES SALONS DE DISCUSSION
//=============================================================================

// Structure de données pour stocker les informations des salons
const rooms = new Map();

/**
 * Diffuse la liste des salons à tous les clients connectés
 * Filtre les informations pour n'envoyer que les données pertinentes et sécurisées
 */
function broadcastRoomsList() {
    const roomsList = Array.from(rooms.entries()).map(([id, room]) => {
        // Filtrer les utilisateurs pour n'inclure que ceux qui ne sont pas déconnectés
        const activeUsers = room.users.filter(user => !user.disconnected);
        const disconnectedUsers = room.users.filter(user => user.disconnected).length;
        
        // Construire un objet avec uniquement les informations nécessaires
        return {
            id,
            name: room.name,
            persistent: room.persistent === true,
            users: activeUsers.map(user => ({
                name: user.name,
                isCreator: user.isCreator,
                isStreaming: user.isStreaming,
                isScreenSharing: user.isScreenSharing
            })),
            disconnectedUsers: disconnectedUsers,
            totalUsers: room.users.length
        };
    });
    
    console.log('Diffusion de la liste des réunions:', roomsList);
    io.emit('roomsList', roomsList); // Envoi à tous les clients connectés
}

//=============================================================================
// GESTION DES ÉVÉNEMENTS SOCKET.IO
//=============================================================================

/**
 * Gestionnaire principal des connexions Socket.IO
 * Gère tous les événements liés aux salons et aux communications en temps réel
 */
io.on('connection', (socket) => {
    console.log('Un utilisateur s\'est connecté');
    
    /**
     * Envoyer la liste des salons actifs au client qui vient de se connecter
     */
    socket.emit('roomsList', Array.from(rooms.entries()).map(([id, room]) => {
        // Préparation des données utilisateurs pour l'affichage
        const activeUsers = room.users.filter(user => !user.disconnected);
        const disconnectedUsers = room.users.filter(user => user.disconnected).length;
        
        return {
            id,
            name: room.name,
            persistent: room.persistent === true,
            users: activeUsers.map(user => ({
                name: user.name,
                isCreator: user.isCreator,
                isStreaming: user.isStreaming,
                isScreenSharing: user.isScreenSharing
            })),
            disconnectedUsers: disconnectedUsers,
            totalUsers: room.users.length
        };
    }));
    console.log('Envoi de la liste des réunions à un client:', Array.from(rooms.keys()));
    
    // Vérifier si une réunion existe
    socket.on('checkRoom', ({ roomId }, callback) => {
        console.log('Vérification de la réunion:', roomId);
        console.log('Réunions existantes:', Array.from(rooms.keys()));
        const exists = rooms.has(roomId);
        console.log('La réunion existe:', exists);
        callback(exists);
    });

    socket.on('createRoom', (data) => {
        const { roomName, userName, keepAlive, customRoomId } = data;
        // Utiliser l'ID personnalisé fourni par l'utilisateur ou générer un ID aléatoire si non fourni
        const roomId = customRoomId || Math.random().toString(36).substring(7);
        
        console.log('Tentative de création d\'une réunion:', roomId, 'Nom:', roomName, 'Persistante:', keepAlive);
        
        // Vérifier si l'ID de réunion existe déjà
        if (rooms.has(roomId)) {
            console.log('Erreur: ID de réunion déjà utilisé:', roomId);
            socket.emit('roomError', { error: 'ID_ALREADY_EXISTS', message: 'Cet ID de réunion est déjà utilisé.' });
            return;
        }
        
        // Vérifier si le nom de réunion existe déjà
        const roomNameExists = Array.from(rooms.values()).some(room => room.name === roomName);
        if (roomNameExists) {
            console.log('Erreur: Nom de réunion déjà utilisé:', roomName);
            socket.emit('roomError', { error: 'NAME_ALREADY_EXISTS', message: 'Ce nom de réunion est déjà utilisé.' });
            return;
        }
        
        rooms.set(roomId, {
            name: roomName,
            persistent: true, // Toutes les réunions sont persistantes par défaut
            createdAt: new Date().toISOString(),
            users: [{
                id: socket.id,
                name: userName,
                isCreator: true, // Marquer l'utilisateur comme créateur
                isStreaming: false,
                isScreenSharing: false
            }]
        });

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, roomName });
        
        // Mettre à jour la liste des salons pour tous les clients
        broadcastRoomsList();
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomId, userName } = data;
        console.log('Tentative de rejoindre la réunion:', roomId);
        console.log('Réunions existantes:', Array.from(rooms.keys()));
        
        const room = rooms.get(roomId);

        if (room) {
            console.log('Réunion trouvée, vérification du nom d\'utilisateur');
            
            // Vérifier si c'est un créateur qui se reconnecte
            const existingUserIndex = room.users.findIndex(user => 
                user.name === userName && user.disconnected === true);
            
            // Vérifier si le nom d'utilisateur est déjà utilisé par un participant actif
            const nameIsTaken = room.users.some(user => 
                user.name === userName && user.disconnected !== true && (existingUserIndex === -1 || user.id !== room.users[existingUserIndex].id));
            
            if (nameIsTaken) {
                console.log(`Nom d'utilisateur déjà utilisé dans la réunion: ${userName}`);
                callback(false, { error: 'NAME_ALREADY_TAKEN', message: 'Ce nom est déjà utilisé dans cette réunion. Veuillez choisir un autre nom.' });
                return;
            }
            
            if (existingUserIndex !== -1) {
                // C'est un créateur qui se reconnecte, mettre à jour son ID et son statut
                console.log(`Le créateur ${userName} se reconnecte à la réunion ${roomId}`);
                room.users[existingUserIndex].id = socket.id;
                room.users[existingUserIndex].disconnected = false;
                socket.join(roomId);
                
                // Notifier tous les participants du retour du créateur
                io.to(roomId).emit('userJoined', { 
                    userName, 
                    userId: socket.id,
                    isCreator: room.users[existingUserIndex].isCreator === true,
                    rejoining: true
                });
            } else {
                // C'est un nouvel utilisateur qui rejoint
                const isFirstUser = room.users.length === 0;
                room.users.push({
                    id: socket.id,
                    name: userName,
                    isCreator: isFirstUser, // Seul le premier utilisateur peut être créateur
                    isStreaming: false,
                    isScreenSharing: false
                });
                socket.join(roomId);
                
                // Notifier tous les participants
                io.to(roomId).emit('userJoined', { 
                    userName, 
                    userId: socket.id,
                    isCreator: isFirstUser
                });
            }
            
            // Envoyer la liste des utilisateurs à tous les participants
            // Filtrer les utilisateurs déconnectés
            io.to(roomId).emit('getUsers', room.users.filter(u => !u.disconnected));
            
            // Notifier aux autres clients de la salle qu'un nouvel utilisateur est connecté pour WebRTC
            socket.to(roomId).emit('user-connected', socket.id);
            
            // Indiquer que la jointure a réussi et envoyer le statut de créateur
            const userInfo = room.users.find(user => user.id === socket.id);
            callback(true, { isCreator: userInfo && userInfo.isCreator === true });
            return;
            
            // Envoyer l'état actuel des streams aux nouveaux participants
            room.users.forEach(user => {
                if (!user.disconnected && (user.isStreaming || user.isScreenSharing)) {
                    socket.emit('streamStarted', { userName: user.name, userId: user.id });
                }
            });

            // Mettre à jour la liste des salons pour tous les clients
            broadcastRoomsList();
            
            // Ajouter un callback de succès
            if (typeof callback === 'function') {
                callback(true);
            }
        } else {
            console.log('Réunion non trouvée');
            socket.emit('error', { message: 'Salon non trouvé' });
            
            // Ajouter un callback d'échec
            if (typeof callback === 'function') {
                callback(false);
            }
        }
    });

    socket.on('leaveRoom', (data) => {
        const { roomId, userName } = data;
        const room = rooms.get(roomId);
        
        if (room) {
            const userIndex = room.users.findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                room.users.splice(userIndex, 1);
                
                socket.leave(roomId);
                io.to(roomId).emit('userLeft', { userName });
                
                // Ne jamais supprimer les réunions, elles sont toutes persistantes
                if (room.users.length === 0) {
                    console.log(`La réunion ${roomId} est vide mais reste active car elle est persistante.`);
                }
                io.to(roomId).emit('getUsers', room.users.filter(u => !u.disconnected));
                
                broadcastRoomsList();
            }
        }
    });
    
    // Événement pour arrêter définitivement une réunion (suppression complète)
    socket.on('endMeeting', (data) => {
        const { roomId, userName } = data;
        const room = rooms.get(roomId);
        
        if (room) {
            // Vérifier si l'utilisateur est le créateur de la réunion
            // Deux vérifications : soit par le socket.id, soit par le statut isCreator
            const user = room.users.find(u => u.id === socket.id);
            const isCreator = user && (user.isCreator || room.users.indexOf(user) === 0);
            
            if (isCreator) {
                console.log(`Réunion ${roomId} arrêtée définitivement par le créateur ${userName}`);
                
                // Notifier tous les participants que la réunion est terminée
                io.to(roomId).emit('meetingEnded', { 
                    message: `La réunion a été arrêtée définitivement par ${userName}` 
                });
                
                // Supprimer la réunion, même si elle est persistante
                rooms.delete(roomId);
                
                // Mettre à jour la liste des réunions pour tous les clients
                broadcastRoomsList();
                
                console.log(`Réunion ${roomId} supprimée de la liste des réunions actives`);
            } else {
                // Si ce n'est pas le créateur, refuser l'action et notifier l'utilisateur
                socket.emit('error', { message: 'Seul le créateur de la réunion peut l\'arrêter définitivement.' });
                console.log(`Tentative non autorisée d'arrêt de réunion par ${userName} (non créateur)`);
            }
        }
    });

    socket.on('startStream', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isStreaming = true;
                io.to(roomId).emit('streamStarted', { userName: user.name, userId: user.id });
                io.to(roomId).emit('getUsers', room.users);
                broadcastRoomsList();
            }
        }
    });

    socket.on('stopStream', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isStreaming = false;
                io.to(roomId).emit('streamStopped', { userName: user.name });
                io.to(roomId).emit('getUsers', room.users);
                broadcastRoomsList();
            }
        }
    });

    socket.on('startScreen', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isScreenSharing = true;
                io.to(roomId).emit('screenStarted', { userName: user.name });
                io.to(roomId).emit('getUsers', room.users);
                broadcastRoomsList();
            }
        }
    });

    socket.on('stopScreen', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                user.isScreenSharing = false;
                io.to(roomId).emit('screenStopped', { userName: user.name });
                io.to(roomId).emit('getUsers', room.users);
                broadcastRoomsList();
            }
        }
    });

    // Gérer les signaux WebRTC
    socket.on('offer', ({ offer, to }) => {
        console.log(`Transmission d'une offre de ${socket.id} à ${to}`);
        socket.to(to).emit('offer', { offer, userId: socket.id });
    });
    
    socket.on('answer', ({ answer, to }) => {
        console.log(`Transmission d'une réponse de ${socket.id} à ${to}`);
        socket.to(to).emit('answer', { answer, from: socket.id });
    });
    
    socket.on('ice-candidate', ({ candidate, to }) => {
        console.log(`Transmission d'un candidat ICE de ${socket.id} à ${to}`);
        socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('message', (data) => {
        const { roomId, message } = data;
        const room = rooms.get(roomId);
        if (room) {
            const user = room.users.find(u => u.id === socket.id);
            if (user) {
                io.to(roomId).emit('message', {
                    userName: user.name,
                    message
                });
            }
        }
    });

    socket.on('getUsers', (data, callback) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        // Vérifier si callback est une fonction avant de l'appeler
        if (typeof callback === 'function') {
            if (room) {
                callback(room.users.map(user => ({ 
                    name: user.name,
                    isStreaming: user.isStreaming,
                    isScreenSharing: user.isScreenSharing
                })));
            } else {
                callback([]);
            }
        } else {
            // Si pas de callback, émettre l'événement de mise à jour des utilisateurs directement
            if (room && roomId) {
                io.to(roomId).emit('getUsers', room.users.map(user => ({
                    name: user.name,
                    isStreaming: user.isStreaming,
                    isScreenSharing: user.isScreenSharing
                })));
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
        rooms.forEach((room, roomId) => {
            const userIndex = room.users.findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                const userName = room.users[userIndex].name;
                const isCreator = room.users[userIndex].isCreator === true;
                
                // Si c'est le créateur/administrateur, marquer comme déconnecté mais garder la réunion active
                if (isCreator) {
                    console.log(`L'administrateur ${userName} s'est déconnecté de la réunion ${roomId}. La réunion reste active.`);
                    
                    // Marquer l'utilisateur comme déconnecté au lieu de le supprimer
                    room.users[userIndex].disconnected = true;
                    
                    // Notifier les autres participants de la déconnexion de l'administrateur
                    io.to(roomId).emit('adminDisconnected', { 
                        message: `L'administrateur ${userName} s'est déconnecté mais la réunion reste active.` 
                    });
                    
                    // Notifier les autres utilisateurs de la déconnexion pour WebRTC
                    io.to(roomId).emit('user-disconnected', socket.id);
                    
                    // Mettre à jour les utilisateurs actifs pour les autres participants
                    io.to(roomId).emit('getUsers', room.users.filter(u => !u.disconnected));
                } else {
                    // Si ce n'est pas le créateur, supprimer normalement l'utilisateur
                    room.users.splice(userIndex, 1);
                    
                    // Notifier les autres utilisateurs
                    io.to(roomId).emit('userLeft', { userName });
                    
                    // Ne supprimer la réunion que si elle est vide
                    if (room.users.length === 0) {
                        console.log('Suppression de la réunion vide:', roomId);
                        rooms.delete(roomId);
                    } else {
                        // Mettre à jour les utilisateurs actifs pour les autres participants
                        io.to(roomId).emit('getUsers', room.users);
                        // Notifier les autres utilisateurs de la déconnexion pour WebRTC
                        io.to(roomId).emit('user-disconnected', socket.id);
                    }
                }
                
                // Mettre à jour la liste des réunions pour tous les clients
                broadcastRoomsList();
            }
        });
    });
});

//=============================================================================
// DÉMARRAGE DU SERVEUR HTTPS
//=============================================================================

/**
 * Démarrage du serveur HTTPS sur le port spécifié
 * Affiche des informations de connexion et gère les erreurs de démarrage
 */
server.listen(PORT, () => {
    console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
    console.log(`Accédez à l'application via https://localhost:${PORT}`);
    console.log('IMPORTANT: Comme les certificats sont auto-signés, vous devrez accepter l\'avertissement de sécurité dans votre navigateur.');
}).on('error', (err) => {
    // Gestion des erreurs au démarrage du serveur
    if (err.code === 'EADDRINUSE') {
        console.error(`Le port ${PORT} est déjà utilisé. Veuillez choisir un autre port.`);
        process.exit(1);
    } else {
        console.error('Erreur lors du démarrage du serveur:', err);
        process.exit(1);
    }
});

//=============================================================================
// GESTION DE L'ARRÊT PROPRE DU SERVEUR
//=============================================================================

/**
 * Gestionnaires d'événements pour arrêter proprement le serveur
 * Permet de libérer les ressources et de fermer les connexions correctement
 */

// Interruption par Ctrl+C ou signal d'interruption
process.on('SIGINT', () => {
    console.log('Arrêt du serveur...');
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});

// Signal de terminaison (envoyé par les gestionnaires de processus comme systemd)
process.on('SIGTERM', () => {
    console.log('Arrêt du serveur...');
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});