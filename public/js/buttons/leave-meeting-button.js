/**
 * Gestion du bouton pour quitter la réunion
 */
document.addEventListener('DOMContentLoaded', function() {
    const leaveMeetingBtn = document.getElementById('leave__meeting__btn');
    
    leaveMeetingBtn.addEventListener('click', function() {
        // Demander confirmation avant de quitter
        const confirmLeave = confirm('Êtes-vous sûr de vouloir quitter la réunion ?');
        
        if (confirmLeave) {
            // Référence à la fonction leaveRoom définie dans room.js
            if (typeof window.leaveRoom === 'function') {
                window.leaveRoom();
            } else {
                console.error('La fonction leaveRoom n\'est pas disponible');
                
                // Implémentation de secours pour la démonstration
                console.log('Quitter la réunion');
                // Rediriger vers la page d'accueil
                window.location.href = '/';
            }
        }
    });
});
