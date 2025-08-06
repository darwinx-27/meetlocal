/**
 * Gestion du bouton d'affichage du chat
 */
document.addEventListener('DOMContentLoaded', function() {
    const showParticipantsBtn = document.getElementById('show-participants-btn');
    const showChatBtn = document.getElementById('show-chat-btn');
    const roomUsers = document.getElementById('block_participants');
    const roomChat = document.getElementById('room__chat');
    
    showChatBtn.addEventListener('click', function() {
        const blockParticipants = document.getElementById('block_participants');
        const blockChat = document.getElementById('block_chat');
        
        // Si déjà actif, masquer la section
        if (showChatBtn.classList.contains('active-btn')) {
            showChatBtn.classList.remove('active-btn');
            roomChat.classList.remove('active-section');
            roomChat.classList.add('hidden-section');
            blockChat.style.display = 'none';
        } else {
            // Activer le bouton chat et désactiver le bouton participants
            showChatBtn.classList.add('active-btn');
            showParticipantsBtn.classList.remove('active-btn');
            
            // Afficher le chat et masquer les participants
            roomChat.classList.add('active-section');
            roomChat.classList.remove('hidden-section');
            blockChat.style.display = 'block';
            roomUsers.classList.add('hidden-section');
            roomUsers.classList.remove('active-section');
            blockParticipants.style.display = 'none';
        }
    });
});
