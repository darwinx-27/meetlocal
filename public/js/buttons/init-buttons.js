/**
 * Initialisation des boutons de la salle de réunion
 * Ce script est chargé après tous les scripts de boutons individuels
 * et s'assure que tous les boutons sont correctement initialisés
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialisation des boutons de bascule (participants/chat)
    const showParticipantsBtn = document.getElementById('show-participants-btn');
    const showChatBtn = document.getElementById('show-chat-btn');
    
    // Désactiver les deux boutons au démarrage
    showParticipantsBtn.classList.remove('active-btn');
    showChatBtn.classList.remove('active-btn');
    
    // S'assurer que les divisions sont masquées au démarrage
    const blockParticipants = document.getElementById('block_participants');
    const blockChat = document.getElementById('block_chat');
    const roomChat = document.getElementById('room__chat');
    
    if (blockParticipants) blockParticipants.style.display = 'none';
    if (blockChat) blockChat.style.display = 'none';
    
    // Exposer les fonctions nécessaires globalement pour les scripts de boutons
    // Cela permet aux fichiers de boutons individuels d'accéder à ces fonctions
    
    // Créer un namespace pour éviter de polluer l'espace global
    window.mumble2 = window.mumble2 || {};
    
    // Fonction d'état pour vérifier si un bouton est actif
    window.mumble2.isButtonActive = function(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn(`Bouton ${buttonId} non trouvé`);
            return false;
        }
        return button.classList.contains('active-btn');
    };
    
    // Fonction pour activer/désactiver un bouton
    window.mumble2.toggleButton = function(buttonId, active) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn(`Bouton ${buttonId} non trouvé`);
            return;
        }
        if (active) {
            button.classList.add('active-btn');
        } else {
            button.classList.remove('active-btn');
        }
    };
    
    console.log('Initialisation des boutons terminée');
});
