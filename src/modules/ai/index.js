import { isAvailable, complete } from '../../services/ai-engine.js';
import { renderHealthScoreSVG, calculateFinancialHealth as calculateHealthScore } from './health-score.js';
import { generateInsights } from './insights.js';
import { privacyManager, PRIVACY_MODES } from '../../services/privacy-manager.js';

export function createFinBotUI(containerElement) {
  const wrapper = document.createElement('div');
  wrapper.className = 'finbot-wrapper';
  wrapper.innerHTML = `
    <style>
      .finbot-wrapper { position: fixed; bottom: 20px; right: 20px; z-index: 1000; font-family: 'Inter', sans-serif; }
      .finbot-btn {
        width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #a855f7);
        color: white; border: none; font-size: 24px; cursor: pointer; box-shadow: 0 4px 15px rgba(99,102,241,0.4);
        position: relative; transition: transform 0.2s;
      }
      .finbot-btn:hover { transform: scale(1.05); }
      .finbot-badge {
        position: absolute; top: -5px; right: -5px; background: #22c55e; color: white;
        font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: bold; border: 2px solid white;
      }
      .finbot-panel {
        position: absolute; bottom: 80px; right: 0; width: 350px; height: 500px;
        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
        border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        display: flex; flex-direction: column; overflow: hidden;
        transform: translateY(20px); opacity: 0; pointer-events: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255,255,255,0.5);
      }
      .finbot-panel.active { transform: translateY(0); opacity: 1; pointer-events: all; }
      .finbot-header {
        padding: 15px 20px; background: linear-gradient(135deg, #6366f1, #a855f7); color: white;
        display: flex; justify-content: space-between; align-items: center; font-weight: 600;
      }
      .close-btn { background: none; border: none; color: white; cursor: pointer; font-size: 18px; }
      .finbot-messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
      .msg { max-width: 80%; padding: 10px 15px; border-radius: 15px; font-size: 14px; line-height: 1.4; }
      .msg.user { background: #f3f4f6; color: #1f2937; align-self: flex-end; border-bottom-right-radius: 5px; }
      .msg.ai { background: linear-gradient(135deg, #e0e7ff, #f3e8ff); color: #3730a3; align-self: flex-start; border-bottom-left-radius: 5px; }
      .finbot-input-area { padding: 15px; border-top: 1px solid #e5e7eb; display: flex; gap: 10px; background: white; }
      .finbot-input { flex: 1; border: 1px solid #d1d5db; border-radius: 20px; padding: 10px 15px; outline: none; transition: border-color 0.2s; }
      .finbot-input:focus { border-color: #6366f1; }
      .finbot-send, .finbot-voice { background: none; border: none; font-size: 20px; cursor: pointer; color: #6366f1; transition: color 0.2s; }
      .finbot-send:hover, .finbot-voice:hover { color: #4f46e5; }
      .suggestions { padding: 0 15px 10px; display: flex; flex-wrap: wrap; gap: 8px; }
      .suggestion-chip { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 5px 10px; border-radius: 15px; font-size: 12px; cursor: pointer; color: #4b5563; }
      .suggestion-chip:hover { background: #e5e7eb; }
      .typing-indicator { display: none; align-self: flex-start; padding: 10px 15px; background: #f3f4f6; border-radius: 15px; }
      .typing-indicator span { display: inline-block; width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; margin: 0 2px; animation: bounce 1.4s infinite ease-in-out both; }
      .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
      .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    </style>
    <button class="finbot-btn" id="finbotToggle">
      🤖
      <span class="finbot-badge" id="finbotStatus">...</span>
    </button>
    <div class="finbot-panel" id="finbotPanel">
      <div class="finbot-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>FinBot ✨</span>
          <span id="finbotPrivacyBadge" style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,0.25);">🔒 Local</span>
        </div>
        <button class="close-btn" id="finbotClose">×</button>
      </div>
      <div class="finbot-messages" id="finbotMessages">
        <div class="msg ai">Hello! I'm FinBot, your personal financial assistant. How can I help you today?</div>
      </div>
      <div class="suggestions" id="finbotSuggestions">
        <div class="suggestion-chip">How much did I spend on food?</div>
        <div class="suggestion-chip">Summarize my finances</div>
      </div>
      <div class="typing-indicator" id="finbotTyping"><span></span><span></span><span></span></div>
      <div class="finbot-input-area">
        <button class="finbot-voice" id="finbotVoice" title="Voice Input">🎤</button>
        <input type="text" class="finbot-input" id="finbotInput" placeholder="Ask about your finances...">
        <button class="finbot-send" id="finbotSend">➤</button>
      </div>
    </div>
  `;
  containerElement.appendChild(wrapper);
  
  setTimeout(() => initFinBotEvents(), 0);
}

function initFinBotEvents() {
  const toggleBtn = document.getElementById('finbotToggle');
  const panel = document.getElementById('finbotPanel');
  const closeBtn = document.getElementById('finbotClose');
  const sendBtn = document.getElementById('finbotSend');
  const input = document.getElementById('finbotInput');
  const messagesDiv = document.getElementById('finbotMessages');
  const typingDiv = document.getElementById('finbotTyping');
  const voiceBtn = document.getElementById('finbotVoice');
  const statusBadge = document.getElementById('finbotStatus');

  const updateStatus = () => {
    const tier = isAvailable();
    const mode = privacyManager.getMode();
    const privacyBadge = document.getElementById('finbotPrivacyBadge');

    if (privacyBadge) {
      if (mode === PRIVACY_MODES.LOCAL_ONLY) {
        privacyBadge.textContent = '🔒 Local Only';
        privacyBadge.title = 'Financial data never leaves your device.';
      } else if (mode === PRIVACY_MODES.PRIVACY_ENHANCED) {
        privacyBadge.textContent = '🛡️ Enhanced';
        privacyBadge.title = 'External AI blocked; rates enabled.';
      } else {
        privacyBadge.textContent = '🌐 External AI';
        privacyBadge.title = 'Sanitized aggregate summary sent to AI provider.';
      }
    }

    if (tier === 'webllm') statusBadge.textContent = 'Gemma 2B ✓';
    else if (tier === 'api') statusBadge.textContent = 'API ✓';
    else statusBadge.textContent = 'Basic';
  };
  
  setInterval(updateStatus, 2000);
  updateStatus();

  toggleBtn.addEventListener('click', () => panel.classList.toggle('active'));
  closeBtn.addEventListener('click', () => panel.classList.remove('active'));

  const appendMessage = (text, sender) => {
    const msg = document.createElement('div');
    msg.className = `msg ${sender}`;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  const handleSend = async (textToUse, isVoice = false) => {
    const text = textToUse || input.value.trim();
    if (!text) return;

    input.value = '';
    document.getElementById('finbotSuggestions').style.display = 'none';
    
    // Quick Add heuristic for voice or explicit add commands
    if (isVoice || text.toLowerCase().startsWith('add ') || text.toLowerCase().startsWith('spent ')) {
      const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1]);
        const words = text.toLowerCase().split(/\s+/);
        let matchedCategory = '';
        const catMap = {
          food: 'food', groceries: 'food', coffee: 'food', lunch: 'food', dinner: 'food',
          transport: 'transport', taxi: 'transport', uber: 'transport', petrol: 'transport',
          shopping: 'shopping', clothes: 'shopping', amazon: 'shopping',
          bills: 'bills', electricity: 'bills', rent: 'bills',
          entertainment: 'entertainment', movie: 'entertainment',
          health: 'health', doctor: 'health',
        };
        for (const w of words) {
           if (catMap[w]) { matchedCategory = catMap[w]; break; }
        }
        
        // Open modal and close bot
        import('../transactions/index.js').then(({ openModal }) => {
           panel.classList.remove('active');
           openModal({
             amount,
             category: matchedCategory || 'other',
             type: 'expense',
             notes: text
           });
        });
        return; // Bypass chat
      }
    }

    appendMessage(text, 'user');
    
    typingDiv.style.display = 'block';
    messagesDiv.appendChild(typingDiv); 
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      const dummyContext = "Current month: August 2026. Total income: ₹85,000. Total expenses: ₹52,300. Top categories: Food (₹12,400), Transport (₹8,200), Shopping (₹9,100). Savings rate: 38.5%. Active budgets: Food limit ₹15,000 (82% used), Transport ₹10,000 (82% used). Profile: Individual, Salaried, Goal: Emergency Fund";
      const response = await complete(text, dummyContext);
      typingDiv.style.display = 'none';
      appendMessage(response, 'ai');
    } catch (e) {
      typingDiv.style.display = 'none';
      appendMessage("Sorry, I encountered an error. Is the AI engine fully loaded? " + e.message, 'ai');
    }
  };

  sendBtn.addEventListener('click', () => handleSend());
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => handleSend(chip.textContent));
  });

  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      voiceBtn.textContent = '🔴';
      input.placeholder = "Listening...";
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      handleSend(transcript, true);
    };

    recognition.onend = () => {
      voiceBtn.textContent = '🎤';
      input.placeholder = "Ask about your finances...";
    };

    voiceBtn.addEventListener('click', () => {
      recognition.start();
    });
  } else {
    voiceBtn.style.display = 'none';
  }
}

export { renderHealthScoreSVG, calculateHealthScore, generateInsights };
