/**
 * Gestion du bouton pour arrêter définitivement la réunion (administrateur uniquement)
 */
document.addEventListener('DOMContentLoaded', function() {
    const endMeetingBtn = document.getElementById('end__meeting__btn');
    
    endMeetingBtn.addEventListener('click', function() {
        // Vérifier si l'utilisateur est administrateur
        const isCreator = localStorage.getItem('room_creator') === 'true';
        
        // Sécurité: seul l'administrateur peut arrêter la réunion
        if (!isCreator) {
            alert('Seul l\'administrateur de la réunion peut l\'arrêter définitivement.');
            console.error('Tentative non autorisée d\'arrêt de réunion par un non-administrateur');
            return;
        }
        
        // Demander confirmation avant d'arrêter
        const confirmEnd = confirm('Êtes-vous sûr de vouloir arrêter définitivement cette réunion ? Tous les participants seront déconnectés et la réunion ne sera plus accessible.');
        
        if (confirmEnd) {
            // Référence à la fonction endMeeting définie dans room.js
            if (typeof window.endMeeting === 'function') {
                window.endMeeting();
            } else {
                console.error('La fonction endMeeting n\'est pas disponible');
                
                // Implémentation de secours pour la démonstration
                console.log('Arrêt définitif de la réunion');
                
                // Récupération de l'ID de la salle
                const roomId = new URLSearchParams(window.location.search).get('room');
                const userName = localStorage.getItem('display_name');
                
                // Émettre l'événement via socket.io si disponible
                if (window.socket) {
                    window.socket.emit('endMeeting', { roomId, userName });
                }
                
                // Nettoyer le stockage local
                localStorage.removeItem('room_id');
                localStorage.removeItem('room_creator');
                localStorage.removeItem('active_room_name');
                localStorage.removeItem('room_created_time');
                
                // Rediriger vers la page d'accueil
                window.location.href = '/';
            }
        }
    });
});
