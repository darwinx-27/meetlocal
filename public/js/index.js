const socket = io();

// DOM Elements
const createRoomForm = document.getElementById('create__room__form');
const joinRoomForm = document.getElementById('join__room__form');
const roomsList = document.getElementById('rooms__list');
const connectionDetails = document.getElementById('connection-details');

// Button elements
const createMeetingBtn = document.getElementById('create-meeting-btn');
const joinMeetingBtn = document.getElementById('join-meeting-btn');
const connectionInfoBtn = document.getElementById('connection-info-btn');

// Form sections
const createRoomSection = document.getElementById('create__room');
const joinRoomSection = document.getElementById('join__room');
const connectionInfoSection = document.getElementById('connection-info');
const activeRoomsSection = document.getElementById('active__rooms');

// Stocker le nom d'utilisateur et l'ID de la réunion dans localStorage pour persistance
function saveUserName(userName) {
    localStorage.setItem('display_name', userName);
}

function saveRoomId(roomId) {
    localStorage.setItem('room_id', roomId);
    localStorage.setItem('room_creator', 'true'); // Marquer l'utilisateur comme créateur
}

// Vérifier si l'utilisateur a déjà une réunion active
function hasActiveRoom() {
    return localStorage.getItem('room_id') && localStorage.getItem('room_creator') === 'true';
}

// Afficher un message d'erreur
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error__message';
    errorDiv.style.background = 'linear-gradient(90deg, #ff5858 0%, #f09819 100%)';
    errorDiv.style.color = '#fff';
    errorDiv.style.transition = 'opacity 0.4s';
    errorDiv.textContent = message;
    
    // Supprimer l'ancien message d'erreur s'il existe
    const oldError = document.querySelector('.error__message');
    if (oldError) {
        oldError.remove();
    }
    
    // Ajouter le nouveau message d'erreur au formulaire approprié
    const targetForm = document.getElementById('join__room__form');
    targetForm.insertBefore(errorDiv, targetForm.firstChild);
    
    // Supprimer le message après 3 secondes
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        setTimeout(() => {
            errorDiv.remove();
        }, 400);
    }, 3000);
}

// Afficher un message de succès
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success__message';
    successDiv.style.background = 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)';
    successDiv.style.color = '#0d473a';
    successDiv.style.transition = 'opacity 0.4s';
    successDiv.textContent = message;
    
    // Supprimer l'ancien message de succès s'il existe
    const oldSuccess = document.querySelector('.success__message');
    if (oldSuccess) {
        oldSuccess.remove();
    }
    
    // Ajouter le nouveau message de succès au formulaire approprié
    const targetForm = document.getElementById('create__room__form');
    targetForm.insertBefore(successDiv, targetForm.firstChild);
    
    // Supprimer le message après 3 secondes
    setTimeout(() => {
        successDiv.style.opacity = '0';
        setTimeout(() => {
            successDiv.remove();
        }, 400);
    }, 3000);
}

// Mettre à jour la liste des salons disponibles
function updateRoomsList(rooms) {
    roomsList.innerHTML = '';
    roomsList.style.opacity = 0;
    setTimeout(() => {
        roomsList.style.opacity = 1;
    }, 150);
    
    if (rooms && rooms.length > 0) {
        const roomsContainer = document.createElement('div');
        roomsContainer.className = 'rooms__container';
        
        rooms.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room__item';
            
            // Ajouter une classe spéciale pour les réunions persistantes
            if (room.persistent) {
                roomElement.classList.add('persistent-room');
            }
            
            // Afficher un badge pour les réunions persistantes
            const persistentBadge = room.persistent ? 
                `<span class="persistent-badge" style="background-color: #3498db; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 8px;">Permanente</span>` : '';
            
            // Afficher le nombre d'utilisateurs actifs et déconnectés pour les réunions persistantes
            let usersInfo = '';
            if (room.persistent && room.disconnectedUsers > 0) {
                usersInfo = `<p>${room.users.length} participant${room.users.length > 1 ? 's' : ''} actif${room.users.length > 1 ? 's' : ''} + ${room.disconnectedUsers} déconnecté${room.disconnectedUsers > 1 ? 's' : ''}</p>`;
            } else {
                usersInfo = `<p>${room.users.length} participant${room.users.length > 1 ? 's' : ''}</p>`;
            }
            
            roomElement.innerHTML = `
                <div class="room__info">
                    <h3>${room.name} ${persistentBadge}</h3>
                    <p>ID: ${room.id}</p>
                    ${usersInfo}
                </div>
                <button class="join__room__btn" data-room-id="${room.id}">Rejoindre</button>
            `;
            roomsContainer.appendChild(roomElement);
        });
        
        roomsList.appendChild(roomsContainer);

        // Ajouter les écouteurs d'événements pour les boutons "Rejoindre"
        document.querySelectorAll('.join__room__btn').forEach(button => {
            button.addEventListener('click', () => {
                const roomId = button.dataset.roomId;
                const userNameInput = document.querySelector('#join__room__form input[name="userName"]');
                const userName = userNameInput.value.trim();
                
                if (userName) {
                    saveUserName(userName);
                    saveRoomId(roomId);
                    
                    // Vérifier si la réunion existe avant de rediriger
                    socket.emit('checkRoom', { roomId }, (exists) => {
                        if (exists) {
                            window.location.href = `/room.html?room=${roomId}`;
                        } else {
                            showError('Cette réunion n\'existe plus');
                            socket.emit('getRoomsList'); // Actualiser la liste
                        }
                    });
                } else {
                    showError('Veuillez entrer votre nom avant de rejoindre une réunion');
                    userNameInput.focus();
                }
            });
        });
    } else {
        roomsList.innerHTML = '<p class="no__rooms">Aucune réunion active</p>';
    }
}

// Créer une nouvelle réunion
createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Utiliser le formulaire directement pour accéder aux champs par leur nom
    const userName = e.target.elements.userName.value.trim();
    const roomName = e.target.elements.roomName.value.trim();
    
    if (!userName) {
        showError('Veuillez entrer votre nom');
        return;
    }
    
    if (!roomName) {
        showError('Veuillez donner un nom à votre réunion');
        return;
    }
    
    // Stocker le nom d'utilisateur pour les utilisations futures
    saveUserName(userName);
    
    // Envoyer les données de création de salon au serveur
    // Toujours utiliser un ID généré aléatoirement
    socket.emit('createRoom', {
        userName,
        roomName,
        customRoomId: '' // Envoyer une chaîne vide pour forcer la génération aléatoire
    });
    
    // Afficher un message de chargement
    showSuccess('Création de la réunion...');
});

// Rejoindre une réunion existante
joinRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userName = e.target.userName.value.trim();
    
    if (!userName) {
        showError('Veuillez entrer votre nom');
        return;
    }
    
    // Sauvegarder le nom de l'utilisateur localement
    saveUserName(userName);
    
    // Montrer un indicateur de chargement
    showLoading('Recherche de réunions disponibles...');
    
    // Demander la liste des réunions actives pour rejoindre automatiquement une réunion
    socket.emit('getRoomsList');
    
    // Écouter temporairement la liste des réunions pour rejoindre la première disponible
    const tempListener = (rooms) => {
        // Désabonner après usage
        socket.off('roomsList', tempListener);
        hideLoading(); // Cacher l'indicateur de chargement
        
        if (rooms && rooms.length > 0) {
            // Prendre la première réunion disponible
            const roomId = rooms[0].id;
            
            // Tenter de rejoindre la réunion avec vérification du nom
            socket.emit('joinRoom', { roomId, userName }, (success, response) => {
                if (!success) {
                    // Gérer les différentes erreurs possibles
                    if (response && response.error === 'NAME_ALREADY_TAKEN') {
                        showError(response.message || "Ce nom est déjà utilisé dans cette réunion. Veuillez choisir un autre nom.");
                        // Ne pas rediriger, laisser l'utilisateur modifier son nom
                        return;
                    } else {
                        // Autres erreurs (réunion inexistante, etc.)
                        showError("La réunion n'existe pas ou n'est plus disponible.");
                        return;
                    }
                } else {
                    // Si tout va bien, rediriger vers la salle de réunion
                    // Stocker le statut d'admin si fourni par le serveur
                    if (response && response.hasOwnProperty('isCreator')) {
                        localStorage.setItem('room_creator', response.isCreator ? 'true' : 'false');
                    }
                    
                    window.location.href = `/room.html?room=${roomId}`;
                }
            });
        } else {
            showError('Aucune réunion active disponible. Veuillez créer une nouvelle réunion.');
        }
    };
    
    // S'abonner temporairement à l'événement roomsList
    socket.on('roomsList', tempListener);
});

// Gestion des boutons de menu
createMeetingBtn.addEventListener('click', () => {
    hideAllSections();
    createRoomSection.style.display = 'block';
    
    // Vérifier si l'utilisateur a déjà une réunion active
    if (hasActiveRoom()) {
        const roomId = localStorage.getItem('room_id');
        const roomName = localStorage.getItem('active_room_name') || 'Votre réunion';
        
        // Afficher un message avec option de rejoindre la réunion existante
        const activeRoomNotice = document.createElement('div');
        activeRoomNotice.className = 'active-room-notice';
        activeRoomNotice.innerHTML = `
            <div style="background: linear-gradient(90deg, #4b6cb7 0%, #182848 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3>Vous avez déjà une réunion active!</h3>
                <p>Réunion: ${roomName}</p>
                <p>ID: ${roomId}</p>
                <button id="rejoin-room-btn" style="background: white; color: #182848; border: none; padding: 8px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 10px;">Rejoindre maintenant</button>
            </div>
        `;
        
        // Supprimer l'ancienne notice si elle existe
        const oldNotice = document.querySelector('.active-room-notice');
        if (oldNotice) {
            oldNotice.remove();
        }
        
        // S'assurer que createRoomForm existe avant d'insérer la notice
        if (createRoomForm) {
            createRoomForm.insertBefore(activeRoomNotice, createRoomForm.firstChild);
            
            // Ajouter l'event listener pour le bouton de rejoindre
            const rejoinBtn = document.getElementById('rejoin-room-btn');
            if (rejoinBtn) {
                rejoinBtn.addEventListener('click', () => {
                    window.location.href = `/room.html?room=${roomId}`;
                });
            }
        }
    }
});

joinMeetingBtn.addEventListener('click', () => {
    hideAllSections();
    joinRoomSection.style.display = 'block';
    activeRoomsSection.style.display = 'block';
});

connectionInfoBtn.addEventListener('click', () => {
    hideAllSections();
    connectionInfoSection.style.display = 'block';
    // Charger les infos de connexion
    loadConnectionInfo();
});

// Fonction pour cacher toutes les sections
function hideAllSections() {
    createRoomSection.style.display = 'none';
    joinRoomSection.style.display = 'none';
    connectionInfoSection.style.display = 'none';
    activeRoomsSection.style.display = 'none';
}

// Charger les informations de connexion
function loadConnectionInfo() {
    fetch('/get-connection-info')
        .then(response => response.json())
        .then(data => {
            const protocol = data.protocol || 'https';
            const connectionInfo = `${protocol}://${data.ip}:${data.port}`;
            connectionDetails.innerHTML = `
                <p><strong>Adresse du serveur:</strong> ${connectionInfo}</p>
                <p>Partagez cette adresse avec les participants pour qu'ils puissent se connecter à vos réunions.</p>
            `;
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des informations de connexion:', error);
            connectionDetails.textContent = 'Impossible de récupérer les informations de connexion.';
        });
}

// Écouter les événements du serveur
socket.on('roomsList', (rooms) => {
    updateRoomsList(rooms);
});

socket.on('error', ({ message }) => {
    showError(message);
});

// Gestion de la création de réunion et sauvegarde de l'ID
socket.on('roomCreated', ({ roomId, roomName }) => {
    saveRoomId(roomId);
    
    // Sauvegarder les détails de la réunion dans localStorage pour persistance
    // Si roomName n'est pas fourni par le serveur, récupérer du formulaire
    const roomNameToSave = roomName || document.querySelector('#create__room__form input[name="roomName"]').value;
    localStorage.setItem('active_room_name', roomNameToSave);
    localStorage.setItem('room_created_time', new Date().toISOString());
    // Marquer l'utilisateur comme créateur de la réunion
    localStorage.setItem('room_creator', 'true');
    
    console.log('Réunion créée et conservée avec ID:', roomId, 'Nom:', roomNameToSave, '(Vous êtes le créateur)');
    
    // Attendre un court instant pour s'assurer que le serveur a bien enregistré la réunion
    setTimeout(() => {
        // Rediriger vers la page de réunion
        window.location.href = `/room.html?room=${roomId}`;
    }, 500);
});

// Gestion des erreurs de création de réunion
socket.on('roomError', (data) => {
    const { error, message } = data;
    console.log('Erreur de création de réunion:', error, message);
    
    // Afficher le message d'erreur approprié
    if (error === 'NAME_ALREADY_EXISTS') {
        showError('Ce nom de réunion est déjà utilisé. Veuillez en choisir un autre.');
        document.querySelector('#create__room__form input[name="roomName"]').focus();
    } else if (error === 'ID_ALREADY_EXISTS') {
        showError('Cet ID de réunion est déjà utilisé. Veuillez en choisir un autre.');
        document.querySelector('#create__room__form input[name="customRoomId"]').focus();
    } else {
        showError(message || 'Une erreur est survenue lors de la création de la réunion.');
    }
});

// Demander la liste des salons au chargement
socket.emit('getRoomsList');

// Initialiser la page en cachant toutes les sections au chargement
hideAllSections();

// Rafraîchir la liste toutes les 3 secondes
setInterval(() => {
    socket.emit('getRoomsList');
}, 3000);

// Variable pour stocker l'élément de chargement
let loadingElement = null;

// Fonction pour afficher un indicateur de chargement
function showLoading(message = 'Chargement en cours...') {
    // Si un élément de chargement existe déjà, le supprimer
    hideLoading();
    
    // Créer un élément de chargement
    loadingElement = document.createElement('div');
    loadingElement.className = 'loading-overlay';
    loadingElement.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <span>${message}</span>
        </div>
    `;
    
    // Ajouter des styles CSS si nécessaire
    if (!document.getElementById('loading-styles')) {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.innerHTML = `
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .loading-overlay.visible {
                opacity: 1;
            }
            .loading-content {
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 10px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Ajouter au body
    document.body.appendChild(loadingElement);
    
    // Animer l'apparition
    setTimeout(() => {
        loadingElement.classList.add('visible');
    }, 10);
}

// Fonction pour cacher l'indicateur de chargement
function hideLoading() {
    if (loadingElement) {
        loadingElement.classList.remove('visible');
        setTimeout(() => {
            loadingElement.remove();
            loadingElement = null;
        }, 300);
    }
}