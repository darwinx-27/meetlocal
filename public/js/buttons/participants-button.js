/**
 * Gestion du bouton d'affichage des participants
 */
document.addEventListener('DOMContentLoaded', function() {
    const showParticipantsBtn = document.getElementById('show-participants-btn');
    const showChatBtn = document.getElementById('show-chat-btn');
    const roomUsers = document.getElementById('block_participants');
    const roomChat = document.getElementById('room__chat');
    
    showParticipantsBtn.addEventListener('click', function() {
        const blockParticipants = document.getElementById('block_participants');
        const blockChat = document.getElementById('block_chat');
        
        // Si déjà actif, masquer la section
        if (showParticipantsBtn.classList.contains('active-btn')) {
            showParticipantsBtn.classList.remove('active-btn');
            roomUsers.classList.remove('active-section');
            roomUsers.classList.add('hidden-section');
            blockParticipants.style.display = 'none';
        } else {
            // Activer le bouton participants et désactiver le bouton chat
            showParticipantsBtn.classList.add('active-btn');
            showChatBtn.classList.remove('active-btn');
            
            // Afficher les participants et masquer le chat
            roomUsers.classList.add('active-section');
            roomUsers.classList.remove('hidden-section');
            blockParticipants.style.display = 'block';
            roomChat.classList.add('hidden-section');
            roomChat.classList.remove('active-section');
            blockChat.style.display = 'none';
        }
    });
});
