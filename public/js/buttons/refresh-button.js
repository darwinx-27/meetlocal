/**
 * Gestion du bouton de rafraîchissement de l'affichage
 */
document.addEventListener('DOMContentLoaded', function() {
    const refreshVideoBtn = document.getElementById('refresh__video__btn');
    
    refreshVideoBtn.addEventListener('click', function() {
        // Référence à la fonction de rafraîchissement définie dans room.js
        if (typeof window.refreshVideoDisplay === 'function') {
            window.refreshVideoDisplay();
        } else {
            console.error('La fonction refreshVideoDisplay n\'est pas disponible');
            
            // Implémentation de secours pour la démonstration
            console.log('Rafraîchissement de l\'affichage vidéo');
            // Effet visuel pour montrer que le bouton a été cliqué
            refreshVideoBtn.classList.add('active-btn');
            setTimeout(() => {
                refreshVideoBtn.classList.remove('active-btn');
            }, 300);
        }
    });
});
