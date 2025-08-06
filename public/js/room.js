/**
 * MUMBLE2 - Room.js
 * ---------------------------------------------
 * Script principal pour la page du salon de discussion
 * Gère les communications en temps réel, la vidéo/audio et l'interface utilisateur
 */

//=============================================================================
// INITIALISATION ET VARIABLES GLOBALES
//=============================================================================

/**
 * Configuration de la connexion Socket.IO et des paramètres de la salle
 */
const socket = io(); // Connexion au serveur Socket.IO
const roomId = new URLSearchParams(window.location.search).get('room'); // Récupération de l'ID de salle depuis l'URL
const userName = localStorage.getItem('display_name'); // Nom d'utilisateur stocké localement

// Variable pour indiquer si l'utilisateur est l'administrateur de la salle
let isCreator = false;

let screenStream = null;
let isScreenSharing = false; // Variable globale pour suivre l'état du partage

/**
 * Met à jour l'interface utilisateur en fonction du statut d'administrateur
 * Affiche ou masque les contrôles spécifiques à l'administrateur
 * @param {boolean} isAdmin - Indique si l'utilisateur est administrateur
 */
function updateAdminInterface(isAdmin) {
    // Mettre à jour la variable globale
    isCreator = isAdmin;
    
    // Persister le statut dans le localStorage
    localStorage.setItem('room_creator', isAdmin ? 'true' : 'false');
    
    // Gérer l'affichage du badge administrateur
    const creatorStatus = document.getElementById('creator-status');
    if (creatorStatus) {
        creatorStatus.style.display = isAdmin ? 'block' : 'none';
    }
    
    // Gérer le bouton pour terminer la réunion
    const endMeetingBtn = document.getElementById('end__meeting__btn');
    if (endMeetingBtn) {
        // Seul l'administrateur peut arrêter définitivement la réunion
        endMeetingBtn.style.display = isAdmin ? 'block' : 'none';
        
        // Sécurité supplémentaire pour empêcher les non-admins d'accéder à la fonctionnalité
        if (!isAdmin) {
            endMeetingBtn.disabled = true;
            endMeetingBtn.classList.add('disabled-btn');
            endMeetingBtn.style.display = 'none';
        } else {
            endMeetingBtn.disabled = false;
            endMeetingBtn.classList.remove('disabled-btn');
            endMeetingBtn.style.display = 'block';
        }
    }
    
    // Gérer tous les éléments marqués comme admin-only
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    adminOnlyElements.forEach(element => {
        element.style.display = isAdmin ? 'block' : 'none';
    });
    
    console.log(`Statut d'administrateur mis à jour: ${isAdmin ? 'Administrateur' : 'Participant'} de la réunion`);
    
    // Informer l'administrateur de son rôle (à la première visite uniquement)
    if (isAdmin && !window.adminMessageShown) {

        //=========================================================================================
        // 	 ------> MODIFICATIONS : Enlevement des messages de creation du meet par dafault
        //=========================================================================================

        //addMessage("Vous êtes l'administrateur de cette réunion. Si vous quittez, la réunion sera automatiquement terminée.");
        
        //========================================================================================
     	//	------> MODIFICATIONS Fin: 
    	//========================================================================================
    	
        window.adminMessageShown = true;
    }
}

/**
 * Initialisation de l'interface au chargement de la page
 */
document.addEventListener('DOMContentLoaded', () => {
    // Appliquer le statut administrateur stocké localement (sera mis à jour par le serveur)
    const initialCreatorStatus = localStorage.getItem('room_creator') === 'true';
    updateAdminInterface(initialCreatorStatus);
});

//=============================================================================
// RÉFÉRENCES AUX ÉLÉMENTS DU DOM
//=============================================================================

// Liste des utilisateurs et chat
const usersList = document.getElementById('users__list');
const messagesContainer = document.getElementById('messages__container');
const messageForm = document.getElementById('message__form');

// Conteneur vidéo principal
const videoContainer = document.getElementById('video__container');

// Références aux boutons encore utilisés dans ce fichier
// Ces références devraient éventuellement être déplacées vers leurs modules respectifs
const startStreamButton = document.getElementById('start__stream__btn');
const stopStreamButton = document.getElementById('stop__stream__btn');
const startScreenButton = document.getElementById('start__screen__btn');
const stopScreenButton = document.getElementById('stop__screen__btn');
const refreshVideoButton = document.getElementById('refresh__video__btn');
const muteAudioButton = document.getElementById('mute__audio__btn');
const unmuteAudioButton = document.getElementById('unmute__audio__btn');
const volumeSlider = document.getElementById('volume-slider');
const fullscreenButton = document.getElementById('fullscreen__btn');
const endMeetingButton = document.getElementById('end__meeting__btn');
const leaveMeetingButton = document.getElementById('leave__meeting__btn');

//=============================================================================
// VARIABLES DE GESTION DES MÉDIAS
//=============================================================================

// Variables d'état audio et vidéo
let isAudioMuted = false;
let currentFullscreenVideo = null;

// Flux média locaux et distants
let localStream = null; // Flux de la caméra locale
let remoteStreams = {}; // Stockage des flux distants par utilisateur
let videoElements = {}; // Références aux éléments vidéo du DOM
let peerConnections = {}; // Connexions WebRTC avec les autres utilisateurs

/**
 * Configuration des serveurs ICE pour WebRTC - Configuration locale simplifiée
 */
const iceServers = {
    iceServers: [],
    iceCandidatePoolSize: 10
};

//=======================================================================================
// INITIALISATION DE LA SALLE ET AFFICHAGE D'INFORMATIONS
//=======================================================================================
// Affichage des informations de connexion directement sans appel fetch externe

//========================================================================================
//      ------> MODIFICATIONS : Enlevement des messages de creation du meet par dafault
//========================================================================================
// addMessage(`ID de la réunion: ${roomId}`);
// addMessage("Vous pouvez partager cet ID avec les participants ou utiliser l'adresse de connexion disponible sur la page d'accueil.");

//========================================================================================
//	------> MODIFICATIONS Fin: 
//========================================================================================


// Vérifier si on rejoint une réunion existante
if (roomId) {
    socket.emit('joinRoom', { roomId, userName }, (success, response) => {
        if (!success) {
            // Gérer les différentes erreurs possibles
            if (response && response.error === 'NAME_ALREADY_TAKEN') {
                alert(response.message || "Ce nom est déjà utilisé dans cette réunion. Veuillez choisir un autre nom.");
                // Redirection vers la page d'accueil pour entrer un nom différent
                localStorage.removeItem('display_name'); // Forcer l'utilisateur à entrer un nouveau nom
                window.location.href = '/';
                return;
            } else {
                // Autres erreurs (réunion inexistante, etc.)
                alert("La réunion n'existe pas ou n'est plus disponible.");
                window.location.href = '/';
                return;
            }
        }
        
        // Mettre à jour le statut d'administrateur en fonction de la réponse du serveur
        if (response && response.hasOwnProperty('isCreator')) {
            updateAdminInterface(response.isCreator);
        }
        
        // Connexion réussie, demander la liste des utilisateurs
        socket.emit('getUsers', roomId);
    });
} else {
    // Créer une nouvelle réunion
    socket.emit('createRoom', { 
        roomName: 'Nouvelle réunion',
        userName 
    });
}

// Gestion de WebRTC
socket.on('user-connected', (userId) => {
    console.log('Nouvel utilisateur connecté:', userId);
    connectToNewUser(userId);
});

socket.on('user-disconnected', (userId) => {
    console.log('Utilisateur déconnecté:', userId);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    
    // Supprimer la vidéo de l'utilisateur déconnecté
    if (videoElements[userId]) {
        videoElements[userId].remove();
        delete videoElements[userId];
    }
});

socket.on('offer', async ({ offer, userId }) => {
    console.log('Offre reçue de:', userId);
    try {
        const peerConnection = createPeerConnection(userId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, to: userId, from: socket.id });
    } catch (error) {
        console.error('Erreur lors du traitement de l\'offre:', error);
    }
});

socket.on('answer', async ({ answer, from }) => {
    console.log('Réponse reçue de:', from);
    try {
        const peerConnection = peerConnections[from];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
    } catch (error) {
        console.error('Erreur lors du traitement de la réponse:', error);
    }
});

socket.on('ice-candidate', async ({ candidate, from }) => {
    console.log('Candidat ICE reçu de:', from);
    try {
        const peerConnection = peerConnections[from];
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du candidat ICE:', error);
    }
});

function createPeerConnection(userId) {
    if (peerConnections[userId]) {
        return peerConnections[userId];
    }

    const peerConnection = new RTCPeerConnection(iceServers);
    peerConnections[userId] = peerConnection;

    // Gestion des candidats ICE
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { 
                candidate: event.candidate,
                to: userId,
                roomId
            });
        }
    };

    // Journalisation de l'état de la connexion ICE
    peerConnection.oniceconnectionstatechange = () => {
        console.log(`État de la connexion ICE avec ${userId}: ${peerConnection.iceConnectionState}`);
        
        if (peerConnection.iceConnectionState === 'failed' || 
            peerConnection.iceConnectionState === 'disconnected' || 
            peerConnection.iceConnectionState === 'closed') {
            console.warn(`Connexion perdue avec ${userId}`);
        }
    };

    // Gestion des flux de média entrants
    peerConnection.ontrack = (event) => {
        console.log(`Piste reçue de ${userId}:`, event.track.kind);
        
        const stream = event.streams[0];
        if (!remoteStreams[userId]) {
            remoteStreams[userId] = stream;
            
            // Créer un wrapper pour l'élément vidéo
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'video-wrapper';
            videoWrapper.setAttribute('data-user-id', userId); // Identifier la vidéo par l'ID de l'utilisateur distant
            videoContainer.appendChild(videoWrapper);
            
            // Créer un élément vidéo pour l'utilisateur distant
            const videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.srcObject = stream;
            videoWrapper.appendChild(videoElement);
            
            // Stocker la référence au wrapper
            videoElements[userId] = videoWrapper;
            
            // Obtenir le nom d'utilisateur pour l'affichage
            getUserNameById(userId).then(userName => {
                if (userName) {
                    // Ajouter une étiquette avec le nom d'utilisateur
                    const userLabel = document.createElement('div');
                    userLabel.className = 'user-label';
                    userLabel.textContent = userName;
                    videoWrapper.appendChild(userLabel);
                    
                    // Ajouter un indicateur de volume
                    const volumeIndicator = document.createElement('div');
                    volumeIndicator.className = 'volume-indicator';
                    videoWrapper.appendChild(volumeIndicator);
                    
                    // Configurer l'indicateur de volume pour les pistes audio
                    const audioTracks = stream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        setupVolumeIndicator(stream, volumeIndicator);
                    }
                }
            });
        }
    };

    // Ajouter les flux locaux au pair
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    if (screenStream) {
        screenStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, screenStream);
        });
    }

    return peerConnection;
}

// Fonction pour obtenir le nom d'utilisateur par ID
function getUserNameById(userId) {
    const users = document.querySelectorAll('#users__list li');
    for (const userEl of users) {
        if (userEl.dataset.userId === userId) {
            return userEl.textContent.split(' ')[0]; // Prendre le nom sans les indicateurs
        }
    }
    return null;
}

// Configuration de l'indicateur de volume
function setupVolumeIndicator(stream, volumeIndicator) {
    // Vérifier si le flux a des pistes audio
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !window.AudioContext) {
        return;
    }
    
    try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
        
        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;
        
        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);
        
        javascriptNode.onaudioprocess = function() {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            let values = 0;
            
            const length = array.length;
            for (let i = 0; i < length; i++) {
                values += array[i];
            }
            
            const average = values / length;
            volumeIndicator.style.width = Math.min(100, average * 100 / 150) + '%';
        };
    } catch (e) {
        console.error('Erreur lors de la configuration de l\'indicateur de volume:', e);
    }
}

async function connectToNewUser(userId) {
    try {
        const peerConnection = createPeerConnection(userId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { offer, to: userId, from: socket.id });
    } catch (error) {
        console.error('Erreur lors de la connexion à un nouvel utilisateur:', error);
    }
}

socket.on('roomCreated', ({ roomId }) => {
    // Mettre à jour l'URL avec l'ID de la réunion
    window.history.replaceState({}, '', `?room=${roomId}`);
    // Afficher l'ID de la réunion dans le chat
    addMessage(`ID de la réunion: ${roomId}`);
});

socket.on('userJoined', ({ userName, userId, isCreator, rejoining }) => {
    console.log(`L'utilisateur ${userName} a rejoint le salon`);
    
    // Les messages de connexion sont supprimés comme demandé
    
    // Si c'est nous qui venons de rejoindre et que nous sommes administrateur
    if (userId === socket.id && isCreator) {
        // Mettre à jour notre interface d'administrateur
        updateAdminInterface(true);
    }
    
    // Utiliser la fonction de rafraîchissement intelligente au lieu de simplement mettre à jour la liste
    refreshVideoDisplay();
    if (messagesContainer.lastChild) {
        messagesContainer.lastChild.style.background = 'var(--blue-light)';
    }
    updateUsersList();
    
    // Connexion WebRTC au nouvel utilisateur
    if (userId && userId !== socket.id) {
        connectToNewUser(userId);
        
        // Activer la fonction de rafraîchissement
        refreshVideoDisplay();
    }
});

// Fonction pour rafraîchir l'affichage vidéo tout en préservant les flux actifs
function refreshVideoDisplay() {
    console.log('Rafraîchissement intelligent de l\'affichage vidéo suite à une nouvelle connexion');
    
    // Sauvegarder l'état des flux actifs
    const hasLocalStream = localStream !== null;
    const hasScreenStream = screenStream !== null;
    
    // Enregistrer les participants actuels et leurs états
    const currentVideoElements = {};
    const videoWrappers = videoContainer.querySelectorAll('.video-wrapper');
    
    // Débug - afficher les wrappers vidéo actuels
    console.log(`Nombre de wrappers vidéo avant rafraîchissement: ${videoWrappers.length}`);
    
    // Sauvegarder les éléments vidéo existants pour les réutiliser
    videoWrappers.forEach(wrapper => {
        const userId = wrapper.getAttribute('data-user-id');
        if (userId) {
            currentVideoElements[userId] = wrapper;
            console.log(`Vidéo existante pour l'utilisateur: ${userId}`);
        } else {
            console.log('Wrapper vidéo sans ID utilisateur détecté');
        }
    });
    
    // Actualiser la liste des utilisateurs sans perturber les flux vidéo existants
    updateUsersList();
    
    // Compter les vidéos après la mise à jour
    const updatedVideoWrappers = videoContainer.querySelectorAll('.video-wrapper');
    const totalVideos = updatedVideoWrappers.length;
    
    console.log(`Nombre de wrappers vidéo après rafraîchissement: ${updatedVideoWrappers.length}`);
    
    // Appliquer la classe appropriée au conteneur vidéo en fonction du nombre de vidéos
    videoContainer.classList.remove('single-video', 'multiple-videos', 'grid-videos');
    
    if (totalVideos === 1) {
        videoContainer.classList.add('single-video');
    } else if (totalVideos === 2) {
        videoContainer.classList.add('multiple-videos');
    } else if (totalVideos >= 3) {
        videoContainer.classList.add('grid-videos');
    }
    
    // Animer uniquement les nouveaux éléments vidéo
    updatedVideoWrappers.forEach(wrapper => {
        const userId = wrapper.getAttribute('data-user-id');
        
        // Si c'est un nouvel élément qui n'existait pas avant
        if (userId && !currentVideoElements[userId]) {
            console.log(`Nouvelle vidéo détectée pour l'utilisateur: ${userId}`);
            
            // Animation d'apparition pour les nouveaux flux uniquement
            wrapper.style.transition = 'all 0.5s ease';
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                wrapper.style.opacity = '1';
                wrapper.style.transform = 'scale(1)';
            }, 100);
            
            // Afficher un message pour le nouveau flux
            const userName = wrapper.querySelector('.user-label')?.textContent || 'Un participant';
            addMessage(`Nouveau flux vidéo de ${userName} ajouté`);
        }
    });
    
    // Afficher un message de rafraîchissement uniquement s'il y a eu des changements
    if (updatedVideoWrappers.length !== videoWrappers.length) {
        const refreshMessage = `Affichage actualisé - ${totalVideos} ${totalVideos > 1 ? 'flux vidéo actifs' : 'flux vidéo actif'}`;
        addMessage(refreshMessage);
    }
}

socket.on('userLeft', ({ userName }) => {
    // Message de déconnexion supprimé comme demandé
    
    // Utiliser la fonction de rafraîchissement intelligente
    refreshVideoDisplay();
});

socket.on('message', ({ userName, message }) => {
    addMessage(message, userName);
});

socket.on('streamStarted', ({ userName, userId }) => {
    addMessage(`${userName} a commencé à diffuser`);
    if (messagesContainer.lastChild) {
        messagesContainer.lastChild.style.background = 'var(--blue-gradient)';
    }
    // Délai court pour permettre à la connexion WebRTC d'établir le flux vidéo
    setTimeout(() => {
        console.log(`Rafraîchissement vidéo déclenché par streamStarted de ${userName}`);
        refreshVideoDisplay();
    }, 500);
});

socket.on('streamStopped', ({ userName }) => {
    addMessage(`${userName} a arrêté sa diffusion`);
    if (messagesContainer.lastChild) {
        messagesContainer.lastChild.style.background = 'var(--blue-gradient-dark)';
    }
    // Délai court pour permettre à la connexion WebRTC de mettre à jour l'état
    setTimeout(() => {
        console.log(`Rafraîchissement vidéo déclenché par streamStopped de ${userName}`);
        refreshVideoDisplay();
    }, 500);
});

socket.on('screenStarted', ({ userName }) => {
    addMessage(`${userName} a commencé à partager son écran`);
    if (messagesContainer.lastChild) {
        messagesContainer.lastChild.style.background = 'var(--green-gradient)';
    }
    // Délai court pour permettre à la connexion WebRTC d'établir le flux vidéo
    setTimeout(() => {
        console.log(`Rafraîchissement vidéo déclenché par screenStarted de ${userName}`);
        refreshVideoDisplay();
    }, 500);
});

socket.on('screenStopped', ({ userName }) => {
    addMessage(`${userName} a arrêté le partage d'écran`);
    if (messagesContainer.lastChild) {
        messagesContainer.lastChild.style.background = 'var(--green-gradient-dark)';
    }
    // Délai court pour permettre à la connexion WebRTC de mettre à jour l'état
    setTimeout(() => {
        console.log(`Rafraîchissement vidéo déclenché par screenStopped de ${userName}`);
        refreshVideoDisplay();
    }, 500);
});

//=============================================================================
// GESTION DU CHAT ET DES MESSAGES
//=============================================================================

/**
 * Gestionnaire d'événement pour l'envoi de messages via le formulaire de chat
 * Intercepte la soumission du formulaire et envoie le message au serveur via Socket.IO
 */
messageForm.addEventListener('submit', (e) => {
    // Empêcher le comportement par défaut du formulaire (rechargement de la page)
    e.preventDefault();
    
    // Récupérer le champ de saisie du message et son contenu
    const messageInput = messageForm.querySelector('input[name="message"]');
    const message = messageInput.value.trim();
    
    // N'envoyer que si le message n'est pas vide
    if (message) {
        // Émettre l'événement 'message' avec l'ID de la salle et le contenu du message
        socket.emit('message', { roomId, message });
        
        // Vider le champ de saisie après l'envoi
        messageInput.value = '';
        
        // Le message sera affiché pour tous les utilisateurs lorsque le serveur renverra
        // l'événement 'message' avec le nom d'utilisateur et le contenu du message
    }
});

startStreamButton.addEventListener('click', async () => {
    try {
        // Configuration améliorée pour la capture vidéo
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }, 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Créer un wrapper pour la vidéo
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.setAttribute('data-user-id', 'local'); // Identifier la vidéo locale
        videoContainer.appendChild(videoWrapper);

        // Ajouter la vidéo dans le wrapper
        const videoElement = document.createElement('video');
        videoElement.id = 'local-video';
        videoElement.srcObject = localStream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true; // Mute local video
        videoWrapper.appendChild(videoElement);

        // Ajouter une étiquette d'utilisateur
        const userLabel = document.createElement('div');
        userLabel.className = 'user-label';
        userLabel.textContent = `${userName} (Vous)`;
        videoWrapper.appendChild(userLabel);

        // Stocker la référence à l'élément vidéo
        videoElements['local'] = videoWrapper;

        // Ajouter les pistes aux connexions existantes
        Object.values(peerConnections).forEach(peerConnection => {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        });

        socket.emit('startStream', { roomId });
        startStreamButton.style.display = 'none';
        stopStreamButton.style.display = 'block';

        // Déclencher le rafraîchissement vidéo après activation de la caméra locale
        setTimeout(() => {
            console.log('Rafraîchissement vidéo après activation de la caméra locale');
            refreshVideoDisplay();
        }, 200);
    } catch (error) {
        console.error('Erreur lors de l\'accès à la caméra:', error);
        alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
});

stopStreamButton.addEventListener('click', () => {
   
        // Arrêter toutes les pistes
        localStream.getTracks().forEach(track => {
            track.stop();
            
            // Retirer les pistes des connexions existantes
            Object.values(peerConnections).forEach(peerConnection => {
                const senders = peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track === track) {
                        peerConnection.removeTrack(sender);
                    }
                });
            });
        });
        
        localStream = null;
        
        // Seulement supprimer la vidéo locale
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.remove();
        }
        delete videoElements['local'];
        
        socket.emit('stopStream', { roomId });
        startStreamButton.style.display = 'block';
        stopStreamButton.style.display = 'none';
    
});

startScreenButton.addEventListener('click', async () => {
    try {
        // Configuration améliorée pour le partage d'écran
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor',
                logicalSurface: true,
                frameRate: { ideal: 30, max: 60 }
            },
            audio: true // Permettre le partage audio avec l'écran
        });

        // Créer un wrapper pour la vidéo de partage d'écran
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.setAttribute('data-user-id', 'local-screen'); // Identifier le partage d'écran local
        videoContainer.appendChild(videoWrapper);

        // Ajouter la vidéo dans le wrapper
        const videoElement = document.createElement('video');
        videoElement.id = 'local-screen';
        videoElement.srcObject = screenStream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true; // Mute local video
        videoWrapper.appendChild(videoElement);

        // Ajouter une étiquette d'utilisateur
        const userLabel = document.createElement('div');
        userLabel.className = 'user-label';
        userLabel.textContent = `${userName} (Partage d'écran)`;
        videoWrapper.appendChild(userLabel);

        // Stocker la référence à l'élément vidéo
        videoElements['local-screen'] = videoWrapper;

        // Ajouter les pistes aux connexions existantes
        Object.values(peerConnections).forEach(peerConnection => {
            screenStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, screenStream);
            });
        });

        socket.emit('startScreen', { roomId });

        // Déclencher le rafraîchissement vidéo après activation du partage d'écran
        setTimeout(() => {
            console.log('Rafraîchissement vidéo après activation du partage d\'écran');
            refreshVideoDisplay();
        }, 200);

        startScreenButton.style.display = 'none';
        stopScreenButton.style.display = 'block';

        // Arrêter le partage d'écran si l'utilisateur clique sur le bouton "Arrêter le partage" dans la barre de contrôle
        screenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };
    } catch (error) {
        console.error('Erreur lors du partage d\'écran:', error);
        alert('Impossible de partager l\'écran. Veuillez vérifier les permissions.');
    }
});

stopScreenButton.addEventListener('click', stopScreenShare);

function stopScreenShare() {
    if (screenStream) {
        // Arrêter toutes les pistes
        screenStream.getTracks().forEach(track => {
            track.stop();
            
            // Retirer les pistes des connexions existantes
            Object.values(peerConnections).forEach(peerConnection => {
                const senders = peerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track === track) {
                        peerConnection.removeTrack(sender);
                    }
                });
            });
        });
        
        screenStream = null;
        
        // Seulement supprimer la vidéo du partage d'écran
        const localScreenVideo = document.getElementById('local-screen');
        if (localScreenVideo) {
            localScreenVideo.remove();
        }
        delete videoElements['local-screen'];
        
        socket.emit('stopScreen', { roomId });
        startScreenButton.style.display = 'block';
        stopScreenButton.style.display = 'none';
    }
}

/**
 * Ajoute un message dans la zone de chat
 * @param {string} message - Le contenu du message à afficher
 * @param {string} [sender] - Nom de l'expéditeur (optionnel)
 */
function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    // Récupère le nom de l'utilisateur courant
    const currentUser = localStorage.getItem('display_name');
    if (sender) {
        if (sender === currentUser) {
            // Si c'est moi qui ai envoyé, bleu (sent)
            messageElement.classList.add('sent');
        } else {
            // Sinon, vert (received)
            messageElement.classList.add('received');
        }
        // Affiche le nom de l'expéditeur
        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = sender + ' : ';
        messageElement.appendChild(senderSpan);

        messageElement.appendChild(document.createTextNode(message));
    } else {
        // Message système
        messageElement.textContent = message;
    }

    // Ajoute le message au conteneur
    const messagesContainer = document.getElementById('messages__container');
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

//MODIFICATION APORTER POUR LES LETTRES DES PARTICIPANT
function getInitials(name) {
    const parts = name.trim().split(/\s+/); // découpe par espace

    if (parts.length === 1) {
        // Ex: "Alice" => "AL"
        return parts[0].substring(0, 2).toUpperCase();
    } else {
        // Ex: "Jean Luc" => "JL"
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
}
function updateUsersList() {
    socket.emit('getUsers', { roomId }, (users) => {
        usersList.innerHTML = '';

        users.forEach(user => {
            const userElement = document.createElement('li');

            const initials = document.createElement('div');
            initials.className = 'user-avatar';
            initials.textContent = getInitials(user.name);

            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';

            const name = document.createElement('span');
            name.className = 'user-name';
            name.textContent = user.name;

            const status = document.createElement('span');
            status.className = 'user-status';

            const streaming = user.isStreaming ? '📹 En direct' : '';
            const sharing = user.isScreenSharing ? '🖥️ Partage d\'écran' : '';
            status.textContent = [streaming, sharing].filter(Boolean).join(' • ');

            userInfo.appendChild(name);
            if (status.textContent) userInfo.appendChild(status);

            userElement.appendChild(initials);
            userElement.appendChild(userInfo);
            usersList.appendChild(userElement);
        });

        // ✅ Met à jour le compteur
        const userCount = document.getElementById('user-count');
        if (userCount) {
            userCount.textContent = `(${users.length})`;
        }
    });
}

// Gestion du bouton pour arrêter la réunion
// Gestionnaire d'événement pour le bouton de rafraîchissement vidéo
refreshVideoButton.addEventListener('click', () => {
    console.log('Rafraîchissement complet de la page');
    // Afficher un message dans le chat
    addMessage('Rafraîchissement de la page en cours...');
    // Fonction de rafraîchissement qui recharge la page
    function rafraichirPage() {
      location.reload();
    }
    // Exécuter la fonction de rafraîchissement
    rafraichirPage();
});

// Gestion du son
muteAudioButton.addEventListener('click', () => {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks.forEach(track => {
                track.enabled = false;
            });
            isAudioMuted = true;
            muteAudioButton.style.display = 'none';
            unmuteAudioButton.style.display = 'block';
            addMessage('Votre microphone est désactivé');
            
            // Ajouter un indicateur visuel sur la vidéo locale
            const localVideoWrapper = videoElements['local'];
            if (localVideoWrapper) {
                let audioStatus = localVideoWrapper.querySelector('.audio-status');
                if (!audioStatus) {
                    audioStatus = document.createElement('div');
                    audioStatus.className = 'audio-status';
                    localVideoWrapper.appendChild(audioStatus);
                }
                audioStatus.textContent = '🔇 Micro coupé';
                audioStatus.classList.add('muted');
            }
        }
    }
});

unmuteAudioButton.addEventListener('click', () => {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks.forEach(track => {
                track.enabled = true;
            });
            isAudioMuted = false;
            muteAudioButton.style.display = 'block';
            unmuteAudioButton.style.display = 'none';
            addMessage('Votre microphone est activé');
            
            // Mettre à jour l'indicateur visuel sur la vidéo locale
            const localVideoWrapper = videoElements['local'];
            if (localVideoWrapper) {
                const audioStatus = localVideoWrapper.querySelector('.audio-status');
                if (audioStatus) {
                    audioStatus.remove();
                }
            }
        }
    }
});

// Gestion du volume
volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value / 100;
    // Appliquer le volume aux vidéos des autres participants
    const videos = document.querySelectorAll('video:not(#local-video):not(#local-screen)');
    videos.forEach(video => {
        video.volume = volume;
    });
});

// Gestion du plein écran
fullscreenButton.addEventListener('click', () => {
    // Si une vidéo est déjà en plein écran, la remettre en mode normal
    if (currentFullscreenVideo) {
        exitFullscreenMode();
        return;
    }
    
    // Afficher une liste des vidéos disponibles pour le plein écran
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    if (videoWrappers.length === 0) {
        addMessage('Aucune vidéo disponible pour le plein écran');
        return;
    }
    
    // Créer un menu de sélection
    const selectionMenu = document.createElement('div');
    selectionMenu.className = 'fullscreen-selection-menu';
    selectionMenu.style.position = 'fixed';
    selectionMenu.style.top = '50%';
    selectionMenu.style.left = '50%';
    selectionMenu.style.transform = 'translate(-50%, -50%)';
    selectionMenu.style.background = 'white';
    selectionMenu.style.padding = '20px';
    selectionMenu.style.borderRadius = '10px';
    selectionMenu.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.3)';
    selectionMenu.style.zIndex = '10000';
    
    const title = document.createElement('h3');
    title.textContent = 'Sélectionner une vidéo pour le plein écran';
    title.style.marginBottom = '15px';
    selectionMenu.appendChild(title);
    
    videoWrappers.forEach((wrapper, index) => {
        const userId = wrapper.getAttribute('data-user-id');
        const userLabel = wrapper.querySelector('.user-label');
        const userName = userLabel ? userLabel.textContent : `Vidéo ${index + 1}`;
        
        const button = document.createElement('button');
        button.className = 'fullscreen-select-btn';
        button.textContent = userName;
        button.style.display = 'block';
        button.style.width = '100%';
        button.style.padding = '10px';
        button.style.margin = '5px 0';
        button.style.background = 'var(--blue-gradient)';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        
        button.addEventListener('click', () => {
            enterFullscreenMode(wrapper);
            selectionMenu.remove();
        });
        
        selectionMenu.appendChild(button);
    });
    
    // Bouton pour annuler
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Annuler';
    cancelButton.style.display = 'block';
    cancelButton.style.width = '100%';
    cancelButton.style.padding = '10px';
    cancelButton.style.margin = '15px 0 5px';
    cancelButton.style.background = '#ccc';
    cancelButton.style.color = 'black';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '5px';
    cancelButton.style.cursor = 'pointer';
    
    cancelButton.addEventListener('click', () => {
        selectionMenu.remove();
    });
    
    selectionMenu.appendChild(cancelButton);
    document.body.appendChild(selectionMenu);
});

// Fonction pour entrer en mode plein écran
function enterFullscreenMode(videoWrapper) {
    // Sauvegarder les informations pour pouvoir restaurer la vidéo plus tard
    currentFullscreenVideo = {
        wrapper: videoWrapper,
        parent: videoWrapper.parentNode,
        index: Array.from(videoWrapper.parentNode.children).indexOf(videoWrapper),
        objectFit: 'cover' // Mode par défaut: couvre tout l'écran
    };
    
    // Détacher la vidéo de son parent et l'ajouter directement au body pour un vrai plein écran
    document.body.appendChild(videoWrapper);
    
    // Ajouter la classe fullscreen-video
    videoWrapper.classList.add('fullscreen-video');
    
    // Appliquer le mode d'affichage par défaut
    const video = videoWrapper.querySelector('video');
    if (video) {
        video.style.objectFit = currentFullscreenVideo.objectFit;
    }
    
    // Créer les contrôles pour quitter le mode plein écran et changer le mode d'affichage
    const controls = document.createElement('div');
    controls.className = 'fullscreen-controls';
    
    // Bouton pour changer le mode d'affichage
    const toggleModeButton = document.createElement('button');
    toggleModeButton.className = 'fullscreen-btn';
    toggleModeButton.textContent = 'Mode d\'affichage: Plein écran';
    toggleModeButton.addEventListener('click', () => {
        if (currentFullscreenVideo) {
            const video = currentFullscreenVideo.wrapper.querySelector('video');
            if (video) {
                // Basculer entre les modes d'affichage
                if (currentFullscreenVideo.objectFit === 'cover') {
                    currentFullscreenVideo.objectFit = 'contain';
                    video.style.objectFit = 'contain';
                    toggleModeButton.textContent = 'Mode d\'affichage: Complet';
                    addMessage('Mode d\'affichage: Vidéo complète (peut avoir des bordures)');
                } else {
                    currentFullscreenVideo.objectFit = 'cover';
                    video.style.objectFit = 'cover';
                    toggleModeButton.textContent = 'Mode d\'affichage: Plein écran';
                    addMessage('Mode d\'affichage: Plein écran (peut couper les bords)');
                }
            }
        }
    });
    
    // Bouton pour quitter le plein écran
    const exitButton = document.createElement('button');
    exitButton.className = 'fullscreen-btn';
    exitButton.textContent = 'Quitter le plein écran';
    exitButton.addEventListener('click', exitFullscreenMode);
    
    controls.appendChild(toggleModeButton);
    controls.appendChild(exitButton);
    videoWrapper.appendChild(controls);
    
    // Ajouter un message dans le chat
    addMessage('Mode plein écran activé');
}

// Fonction pour quitter le mode plein écran
function exitFullscreenMode() {
    if (!currentFullscreenVideo) return;
    
    const { wrapper, parent, index } = currentFullscreenVideo;
    
    // Supprimer les contrôles de plein écran
    const controls = wrapper.querySelector('.fullscreen-controls');
    if (controls) controls.remove();
    
    // Retirer la classe fullscreen-video
    wrapper.classList.remove('fullscreen-video');
    
    // Remettre la vidéo à sa place d'origine
    if (index === 0) {
        parent.prepend(wrapper);
    } else if (index >= parent.children.length) {
        parent.appendChild(wrapper);
    } else {
        parent.insertBefore(wrapper, parent.children[index]);
    }
    
    currentFullscreenVideo = null;
    addMessage('Mode plein écran désactivé');
}

// Gestionnaire pour quitter la réunion
leaveMeetingButton.addEventListener('click', () => {
    // Message de confirmation différent selon si l'utilisateur est l'administrateur ou non
    let confirmMessage = 'Êtes-vous sûr de vouloir quitter cette réunion ?';
    
    if (isCreator) {
        confirmMessage = 'Êtes-vous sûr de vouloir quitter cette réunion ? En tant qu\'administrateur, votre départ mettra fin à la réunion pour tous les participants.';
    }
    
    const confirmLeave = confirm(confirmMessage);
    
    if (confirmLeave) {
        // Arrêter tous les flux (caméra et partage d'écran)
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
        
        // Fermer toutes les connexions peer
        Object.values(peerConnections).forEach(connection => {
            if (connection) {
                connection.close();
            }
        });
        
        // Si l'utilisateur est l'administrateur, terminer la réunion
        if (isCreator) {
            socket.emit('endMeeting', { roomId, userName });
            
            // Supprimer les informations de réunion du stockage local
            localStorage.removeItem('room_id');
            localStorage.removeItem('room_creator');
            localStorage.removeItem('active_room_name');
            localStorage.removeItem('room_created_time');
        } else {
            // Sinon, simplement quitter la réunion
            socket.emit('leaveRoom', { roomId, userName });
        }
        
        // Rediriger vers la page d'accueil
        window.location.href = '/';
    }
});

// Gestionnaire pour arrêter définitivement la réunion (seulement pour le créateur)
endMeetingButton.addEventListener('click', () => {
    // Triple vérification pour s'assurer que l'utilisateur est bien l'administrateur
    const isCreator = localStorage.getItem('room_creator') === 'true';
    const hasAdminClass = endMeetingButton.classList.contains('admin-only');
    const isAdminElementVisible = document.getElementById('creator-status').style.display === 'block';
    
    // Sécurité renforcée: Seul le créateur peut arrêter définitivement la réunion
    if (!isCreator || !isAdminElementVisible) {
        alert('Seul l\'administrateur de la réunion peut l\'arrêter définitivement.');
        console.error('Tentative non autorisée d\'arrêt de réunion par un non-administrateur');
        return;
    }
    
    // Masquer ce bouton pour tous les non-administrateurs - sécurité supplémentaire
    if (!hasAdminClass) {
        endMeetingButton.classList.add('admin-only');
        if (!isCreator) {
            endMeetingButton.style.display = 'none';
            return;
        }
    }
    
    const confirmEnd = confirm('Êtes-vous sûr de vouloir arrêter définitivement cette réunion ? Tous les participants seront déconnectés et la réunion ne sera plus accessible.');
    
    if (confirmEnd) {
        // Arrêter tous les flux (caméra et partage d'écran)
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }
        
        // Fermer toutes les connexions peer
        Object.values(peerConnections).forEach(connection => {
            if (connection) {
                connection.close();
            }
        });
        
        // Arrêter définitivement la réunion
        socket.emit('endMeeting', { roomId, userName });
        
        // Supprimer les informations de réunion du stockage local
        localStorage.removeItem('room_id');
        localStorage.removeItem('room_creator');
        localStorage.removeItem('active_room_name');
        localStorage.removeItem('room_created_time');
        
        // Rediriger vers la page d'accueil
        window.location.href = '/';
    }
});

// Écouter l'événement de fin de réunion (quand le créateur arrête la réunion)
socket.on('meetingEnded', ({ message }) => {
    alert(message);
    
    // Arrêter tous les flux
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    
    // Nettoyer le stockage local
    localStorage.removeItem('room_id');
    localStorage.removeItem('room_creator');
    localStorage.removeItem('active_room_name');
    localStorage.removeItem('room_created_time');
    
    // Rediriger vers la page d'accueil
    window.location.href = '/';
});

// Écouter l'événement de déconnexion de l'administrateur (la réunion reste active)
socket.on('adminDisconnected', ({ message }) => {
    // Message de déconnexion de l'administrateur supprimé comme demandé
    console.log('Administrateur déconnecté:', message);
    
    // Ajouter une notification visuelle dans l'interface (sans message dans le chat)
    const notification = document.createElement('div');
    notification.className = 'admin-notification';
    notification.textContent = message;
    notification.style.background = 'rgba(255, 152, 0, 0.2)';
    notification.style.padding = '10px';
    notification.style.margin = '5px 0';
    notification.style.borderRadius = '5px';
    notification.style.textAlign = 'center';
    notification.style.animation = 'fadeIn 0.5s';
    
    // Ajouter la notification au début de la liste des utilisateurs
    const usersList = document.getElementById('users__list');
    if (usersList) {
        usersList.insertBefore(notification, usersList.firstChild);
        
        // Faire disparaître la notification après 10 secondes
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 10000);
    }
});

/**
 * Gestion du partage d'écran
 * @param {boolean} start - true pour démarrer, false pour arrêter
 * @returns {Promise<boolean>} - true si l'opération a réussi
 */
window.toggleScreenShare = async function(start) {
    try {
        if (start) {
            // Vérifier si un partage d'écran est déjà en cours
            if (isScreenSharing || screenStream) {
                console.log('Un partage d\'écran est déjà en cours');
                return false;
            }

            // Démarrer le partage d'écran
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            isScreenSharing = true; // Mettre à jour l'état global

            // Ajouter l'écouteur pour détecter l'arrêt manuel du partage
            screenStream.getVideoTracks()[0].onended = () => {
                isScreenSharing = false;
                window.toggleScreenShare(false);
            };

            // Créer un élément vidéo pour le partage d'écran
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.autoplay = true;
            screenVideo.playsInline = true;

            // Créer un conteneur pour la vidéo
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'video-wrapper screen-share';
            videoWrapper.appendChild(screenVideo);

            // Ajouter le conteneur à la page
            videoContainer.appendChild(videoWrapper);

            // Envoyer le flux aux autres participants
            Object.keys(peerConnections).forEach(userId => {
                const peerConnection = peerConnections[userId];
                screenStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, screenStream);
                });
            });

            return true;
        } else {
            // Arrêter le partage d'écran
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
                isScreenSharing = false; // Réinitialiser l'état global

                // Supprimer l'élément vidéo
                const screenShareElement = document.querySelector('.screen-share');
                if (screenShareElement) {
                    screenShareElement.remove();
                }

                // Informer les autres participants
                socket.emit('screen-share-ended', roomId);
            }
            return true;
        }
    } catch (error) {
        console.error('Erreur lors du partage d\'écran:', error);
        isScreenSharing = false; // Réinitialiser l'état en cas d'erreur
        return false;
    }
};
