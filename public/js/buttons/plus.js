
const btn3 = document.getElementById('fullscreen__btn');
const btn4 = document.getElementById('refresh__video__btn');
const btn5 = document.getElementById('show-participants-btn');
const btn6 = document.getElementById('show-chat-btn');
const btn7 = document.getElementById('end__meeting__btn');


btn3.style.display = 'none';
btn4.style.display = 'none';
btn5.style.display = 'none';
btn6.style.display = 'none';
btn7.style.display = 'none';

function toggleButtons() {

    const areVisible = btn3.style.display !== 'none';

    btn3.style.display = areVisible ? 'none' : 'inline-block';
    btn4.style.display = areVisible ? 'none' : 'inline-block';
    btn5.style.display = areVisible ? 'none' : 'inline-block';
    btn6.style.display = areVisible ? 'none' : 'inline-block';
    btn7.style.display = areVisible ? 'none' : 'inline-block';
  }

  // Si tu veux que les boutons soient cachés dès le début :
  // document.getElementById('btn2').style.display = 'none';
  // document.getElementById('btn3').style.display = 'none';
 
                    
                    
                    
                    
                    
                    
                    
                    
                    
                    