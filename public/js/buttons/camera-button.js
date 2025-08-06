/**
 * Gestion des boutons de caméra
 */
document.addEventListener('DOMContentLoaded', function() {
    const startStreamButton = document.getElementById('start__stream__btn');
    const stopStreamButton = document.getElementById('stop__stream__btn');
    
    // Fonction pour gérer l'état de la caméra
    function toggleCamera(isActive) {
        if (isActive) {
            startStreamButton.style.display = 'none';
            stopStreamButton.style.display = 'block';
            stopStreamButton.classList.add('active-btn');
            startStreamButton.classList.remove('active-btn');
        } else {
            stopStreamButton.style.display = 'none';
            startStreamButton.style.display = 'block';
            startStreamButton.classList.add('active-btn');
            stopStreamButton.classList.remove('active-btn');
        }
    }
    
    // Référence à la fonction toggleStream définie dans room.js
    if (typeof window.toggleVideoStream === 'function') {
        startStreamButton.addEventListener('click', function() {
            window.toggleVideoStream(true);
            toggleCamera(true);
        });
        
        stopStreamButton.addEventListener('click', function() {
            window.toggleVideoStream(false);
            toggleCamera(false);
        });
    } else {
        console.error('La fonction toggleVideoStream n\'est pas disponible');
        
        // Implémentation de secours pour la démonstration
        startStreamButton.addEventListener('click', function() {
            console.log('Démarrage de la caméra');
            toggleCamera(true);
        });
        
        stopStreamButton.addEventListener('click', function() {
            console.log('Arrêt de la caméra');
            toggleCamera(false);
        });
    }
    
    // Initialiser l'état de la caméra
    toggleCamera(false);
});
