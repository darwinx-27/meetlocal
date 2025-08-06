/**
 * Gestion des boutons de microphone
 */
document.addEventListener('DOMContentLoaded', function() {
    const muteBtn = document.getElementById('mute__audio__btn');
    const unmuteBtn = document.getElementById('unmute__audio__btn');
    const volumeSliderContainer = document.querySelector('.volume-slider-container');
    
    // Afficher le slider de volume lors d'un clic long sur le bouton micro
    let pressTimer;
    
    // Fonction pour gérer l'état du microphone
    function toggleMicrophone(isMuted) {
        if (isMuted) {
            muteBtn.style.display = 'none';
            unmuteBtn.style.display = 'block';
            unmuteBtn.classList.add('active-btn');
            muteBtn.classList.remove('active-btn');
        } else {
            unmuteBtn.style.display = 'none';
            muteBtn.style.display = 'block';
            muteBtn.classList.add('active-btn');
            unmuteBtn.classList.remove('active-btn');
        }
    }
    
    // Bouton mute
    muteBtn.addEventListener('click', function() {
        if (typeof window.toggleAudioStream === 'function') {
            window.toggleAudioStream(false);
        }
        toggleMicrophone(true);
    });
    
    muteBtn.addEventListener('mousedown', function() {
        pressTimer = window.setTimeout(function() {
            volumeSliderContainer.style.display = 'flex';
        }, 500);
    });
    
    muteBtn.addEventListener('mouseup', function() {
        clearTimeout(pressTimer);
    });
    
    muteBtn.addEventListener('mouseleave', function() {
        clearTimeout(pressTimer);
    });
    
    // Bouton unmute
    unmuteBtn.addEventListener('click', function() {
        if (typeof window.toggleAudioStream === 'function') {
            window.toggleAudioStream(true);
        }
        toggleMicrophone(false);
    });
    
    unmuteBtn.addEventListener('mousedown', function() {
        pressTimer = window.setTimeout(function() {
            volumeSliderContainer.style.display = 'flex';
        }, 500);
    });
    
    unmuteBtn.addEventListener('mouseup', function() {
        clearTimeout(pressTimer);
    });
    
    unmuteBtn.addEventListener('mouseleave', function() {
        clearTimeout(pressTimer);
    });
    
    // Masquer le slider après un délai sans interaction
    document.addEventListener('click', function(e) {
        if (!volumeSliderContainer.contains(e.target) && 
            e.target !== muteBtn && 
            e.target !== unmuteBtn) {
            volumeSliderContainer.style.display = 'none';
        }
    });
    
    // Initialiser l'état du microphone
    toggleMicrophone(false);
});
