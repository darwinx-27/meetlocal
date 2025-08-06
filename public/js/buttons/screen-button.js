/**
 * Gestion des boutons de partage d'écran
 */
document.addEventListener('DOMContentLoaded', function() {
    const startScreenShareBtn = document.getElementById('start__screen__btn');
    const stopScreenShareBtn = document.getElementById('stop__screen__btn');
    const plusBtn = document.getElementById('plus__btn');
    
    // Variable pour suivre l'état du partage d'écran
    let isScreenSharing = false;
    
    // Fonction pour gérer l'état visuel des boutons
    function toggleScreenShareState(isSharing) {
        if (isSharing) {
            // Quand le partage est actif
            startScreenShareBtn.style.display = 'none';
            stopScreenShareBtn.style.display = 'flex';
            stopScreenShareBtn.classList.add('active');
            startScreenShareBtn.classList.remove('active');
            
            // Masquer le bouton plus pendant le partage
            if (plusBtn) {
                plusBtn.style.display = 'none';
            }
        } else {
            // Quand le partage est inactif
            startScreenShareBtn.style.display = 'flex';
            stopScreenShareBtn.style.display = 'none';
            startScreenShareBtn.classList.add('active');
            stopScreenShareBtn.classList.remove('active');
            
            // Réafficher le bouton plus quand le partage est arrêté
            if (plusBtn) {
                plusBtn.style.display = 'flex';
            }
        }
    }
    
    // Gestionnaire pour le bouton de démarrage du partage d'écran
    startScreenShareBtn.addEventListener('click', async () => {
        if (window.isScreenSharing) {
            console.log('Un partage d\'écran est déjà en cours');
            return;
        }
        
        try {
            const success = await window.toggleScreenShare(true);
            if (success) {
                toggleScreenShareState(true);
            }
        } catch (error) {
            console.error('Erreur lors du démarrage du partage d\'écran:', error);
            toggleScreenShareState(false);
        }
    });
    
    // Gestionnaire pour le bouton d'arrêt du partage d'écran
    stopScreenShareBtn.addEventListener('click', async () => {
        try {
            const success = await window.toggleScreenShare(false);
            if (success) {
                toggleScreenShareState(false);
            }
        } catch (error) {
            console.error('Erreur lors de l\'arrêt du partage d\'écran:', error);
            toggleScreenShareState(false);
        }
    });
    
    // Nettoyage lors de la fermeture de la page
    window.addEventListener('beforeunload', () => {
        if (window.isScreenSharing) {
            window.toggleScreenShare(false);
        }
    });
    
    // Initialisation de l'état
    toggleScreenShareState(false);
});
