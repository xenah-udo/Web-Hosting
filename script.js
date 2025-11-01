/* SmartCalc main script
   - Normal & Scientific modes
   - History (localStorage)
   - Theme (localStorage)
   - PWA install prompt handling
*/

const displayEl = document.getElementById('display');
const buttonsGrid = document.getElementById('buttonsGrid');
const modeToggle = document.getElementById('modeToggle');
const themeToggle = document.getElementById('themeToggle');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const installBtn = document.getElementById('installBtn');
const historyPanel = document.getElementById('historyPanel');

let currentExpression = '';
let history = JSON.parse(localStorage.getItem('smartcalc_history') || '[]');
let currentMode = localStorage.getItem('smartcalc_mode') || 'normal'; // 'normal' or 'scientific'
let isDark = localStorage.getItem('smartcalc_theme') === 'dark';
let deferredPrompt = null;

// button definitions
const normalButtons = [
  { id:'clear', label:'C', cls:'clear' },
  { id:'/', label:'÷', cls:'operator' },
  { id:'*', label:'×', cls:'operator' },
  { id:'back', label:'⌫', cls:'operator' },

  { id:'7', label:'7', cls:'num' },
  { id:'8', label:'8', cls:'num' },
  { id:'9', label:'9', cls:'num' },
  { id:'-', label:'−', cls:'operator' },

  { id:'4', label:'4', cls:'num' },
  { id:'5', label:'5', cls:'num' },
  { id:'6', label:'6', cls:'num' },
  { id:'+', label:'+', cls:'operator' },

  { id:'1', label:'1', cls:'num' },
  { id:'2', label:'2', cls:'num' },
  { id:'3', label:'3', cls:'num' },
  { id:'=', label:'=', cls:'equal', rowspan:2 },

  { id:'(', label:'(', cls:'operator' },
  { id:'0', label:'0', cls:'num' },
  { id:')', label:')', cls:'operator' }
];

const sciButtons = [
  // first row
  { id:'clear', label:'C', cls:'clear' },
  { id:'pi', label:'π', cls:'operator' },
  { id:'e', label:'e', cls:'operator' },
  { id:'back', label:'⌫', cls:'operator' },

  { id:'sin', label:'sin', cls:'operator' },
  { id:'cos', label:'cos', cls:'operator' },
  { id:'tan', label:'tan', cls:'operator' },
  { id:'^', label:'^', cls:'operator' },

  { id:'7', label:'7', cls:'num' },
  { id:'8', label:'8', cls:'num' },
  { id:'9', label:'9', cls:'num' },
  { id:'/', label:'÷', cls:'operator' },

  { id:'4', label:'4', cls:'num' },
  { id:'5', label:'5', cls:'num' },
  { id:'6', label:'6', cls:'num' },
  { id:'*', label:'×', cls:'operator' },

  { id:'1', label:'1', cls:'num' },
  { id:'2', label:'2', cls:'num' },
  { id:'3', label:'3', cls:'num' },
  { id:'-', label:'−', cls:'operator' },

  { id:'sqrt', label:'√', cls:'operator' },
  { id:'0', label:'0', cls:'num' },
  { id:'log', label:'log', cls:'operator' },
  { id:'+', label:'+', cls:'operator' },

  { id:'(', label:'(', cls:'operator' },
  { id:')', label:')', cls:'operator' },
  { id:'=', label:'=', cls:'equal' }
];

// helpers
function saveHistory(){
  localStorage.setItem('smartcalc_history', JSON.stringify(history.slice(0, 50)));
}

function formatForEval(expr){
  // convert unicode operators to JS
  let s = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'Math.PI');
  // caret to exponent operator **
  s = s.replace(/\^/g,'**');
  // functions mapping
  s = s.replace(/√\(/g,'Math.sqrt(');
  s = s.replace(/\blog\(/g,'Math.log10('); // log base 10
  s = s.replace(/\bln\(/g,'Math.log('); // natural log if needed
  s = s.replace(/\bsin\(/g,'Math.sin(');
  s = s.replace(/\bcos\(/g,'Math.cos(');
  s = s.replace(/\btan\(/g,'Math.tan(');
  // ensure Math.* appears for pow usage, etc.
  return s;
}

function evaluateExpression(expr){
  try{
    if (!expr || expr.trim()==='') return '';
    const safe = formatForEval(expr);
    // use Function instead of eval (slightly better)
    const result = Function(`"use strict"; return (${safe})`)();
    return (typeof result === 'number' && !Number.isFinite(result)) ? 'Error' : result;
  }catch(e){
    return 'Error';
  }
}

function pushToHistory(expr, result){
  if(!expr) return;
  const item = { expr, result, ts: Date.now() };
  history.unshift(item);
  if(history.length > 50) history.length = 50;
  saveHistory();
  renderHistory();
}

function renderHistory(){
  historyList.innerHTML = '';
  history.slice(0,10).forEach((h, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="h-expr">${h.expr}</span>
                    <div>
                      <button class="use" data-index="${idx}">Use</button>
                      <button class="del" data-index="${idx}">✕</button>
                    </div>`;
    historyList.appendChild(li);
  });
}

// buttons rendering
function renderButtons(){
  buttonsGrid.innerHTML = '';
  const btns = currentMode === 'scientific' ? sciButtons : normalButtons;
  btns.forEach(b => {
    const el = document.createElement('button');
    el.className = `button ${b.cls || ''}`;
    el.textContent = b.label;
    el.dataset.id = b.id;
    if(b.rowspan) el.style.gridRow = `span ${b.rowspan}`;
    el.addEventListener('click', onButtonClick);
    buttonsGrid.appendChild(el);
  });
}

// button click handler
function onButtonClick(e){
  const id = e.currentTarget.dataset.id;
  if(id === 'clear'){
    currentExpression = '';
    updateDisplay();
    return;
  }
  if(id === 'back'){
    currentExpression = currentExpression.slice(0,-1);
    updateDisplay();
    return;
  }
  if(id === '='){
    const res = evaluateExpression(currentExpression);
    if(res === 'Error' || res === undefined || res === '') {
      displayEl.textContent = 'Error';
      setTimeout(()=> updateDisplay(), 900);
      return;
    }
    displayEl.textContent = String(res);
    pushToHistory(currentExpression, String(res));
    currentExpression = String(res);
    return;
  }

  // scientific helper insertions
  if(id === 'pi'){ currentExpression += 'π'; updateDisplay(); return; }
  if(id === 'e'){ currentExpression += 'Math.E'; updateDisplay(); return; }
  if(id === 'sin' || id === 'cos' || id === 'tan' || id === 'log' || id === 'sqrt'){
    if(id === 'sqrt') currentExpression += '√(';
    else currentExpression += `${id}(`;
    updateDisplay();
    return;
  }

  // default: number/operator/parenthesis/caret
  currentExpression += id;
  updateDisplay();
}

function updateDisplay(){
  displayEl.textContent = currentExpression || '0';
}

// history click delegation
historyList.addEventListener('click', (e) => {
  const useBtn = e.target.closest('button.use');
  const delBtn = e.target.closest('button.del');
  if(useBtn){
    const idx = Number(useBtn.dataset.index);
    const item = history[idx];
    if(item){ currentExpression = item.result.toString(); updateDisplay(); }
  } else if(delBtn){
    const idx = Number(delBtn.dataset.index);
    if(history[idx]){ history.splice(idx,1); saveHistory(); renderHistory(); }
  }
});

clearHistoryBtn.addEventListener('click', () => {
  history = []; saveHistory(); renderHistory();
});

// mode toggle
modeToggle.addEventListener('click', () => {
  currentMode = currentMode === 'normal' ? 'scientific' : 'normal';
  localStorage.setItem('smartcalc_mode', currentMode);
  modeToggle.textContent = currentMode === 'scientific' ? 'Scientific' : 'Normal';
  renderButtons();
});

// theme toggle
function applyTheme(){
  const appRoot = document.querySelector('.app');
  if(isDark){
    appRoot.classList.add('dark');
    themeToggle.textContent = '☀️';
  } else {
    appRoot.classList.remove('dark');
    themeToggle.textContent = '🌙';
  }
  localStorage.setItem('smartcalc_theme', isDark ? 'dark' : 'light');
}
themeToggle.addEventListener('click', () => { isDark = !isDark; applyTheme(); });

// keyboard support
window.addEventListener('keydown', (e) => {
  const allowed = '0123456789+-*/().^';
  if(allowed.includes(e.key)) {
    currentExpression += e.key;
    updateDisplay();
  } else if(e.key === 'Backspace'){ currentExpression = currentExpression.slice(0,-1); updateDisplay(); }
  else if(e.key === 'Enter'){ // evaluate
    const res = evaluateExpression(currentExpression);
    displayEl.textContent = res === 'Error' ? 'Error' : String(res);
    if(res !== 'Error') pushToHistory(currentExpression, String(res));
    currentExpression = String(res);
  }
});

// install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  installBtn.hidden = true;
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
});

// initialization
(function init(){
  // init localStorage data
  renderHistory();
  currentMode = localStorage.getItem('smartcalc_mode') || 'normal';
  modeToggle.textContent = currentMode === 'scientific' ? 'Scientific' : 'Normal';
  isDark = localStorage.getItem('smartcalc_theme') === 'dark' ? true : false;
  applyTheme();
  renderButtons();
  updateDisplay();
})();