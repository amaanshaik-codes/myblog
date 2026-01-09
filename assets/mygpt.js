(function () {
  'use strict';

  const API_BASE = 'https://hewlett.tail16475c.ts.net';
  const API_ENDPOINT = `${API_BASE}/api/generate`;
  const MODEL_NAME = 'amaan-gpt:latest';

  const elements = {
    messages: document.getElementById('mygpt-messages'),
    form: document.getElementById('mygpt-form'),
    input: document.getElementById('mygpt-input'),
    send: document.getElementById('mygpt-send'),
    clear: document.getElementById('mygpt-clear'),
    status: document.getElementById('mygpt-status'),
  };

  let isGenerating = false;
  let currentChunkTimeout = null;
  const STORAGE_KEY = 'mygpt-conversation';
  let conversationMessages = [];

  // Message persistence
  function saveConversation() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationMessages));
  }

  function loadConversation() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const messages = JSON.parse(stored);
        if (messages && messages.length > 0) {
          // Hide welcome screen
          const welcomeMsg = elements.messages.querySelector('.mygpt-welcome');
          if (welcomeMsg) {
            welcomeMsg.style.display = 'none';
          }
          
          // Restore messages
          messages.forEach(msg => {
            const msgEl = createMessage(msg.content, msg.role);
            if (msg.tokens) {
              msgEl.dataset.tokens = msg.tokens;
            }
            elements.messages.appendChild(msgEl);
          });
          
          conversationMessages = messages;
          scrollToBottom(false);
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }

  function addToConversation(content, role, tokens = null) {
    const msg = { content, role };
    if (tokens) msg.tokens = tokens;
    conversationMessages.push(msg);
    saveConversation();
  }

  // Modal management
  function initializeModal() {
    const modal = document.getElementById('mygpt-modal');
    const overlay = document.getElementById('mygpt-modal-overlay');
    const closeBtn = document.getElementById('mygpt-modal-close');
    const dismissBtn = document.getElementById('mygpt-modal-dismiss');
    
    const hasSeenModal = localStorage.getItem('mygpt-modal-dismissed');
    
    if (!hasSeenModal) {
      // Show modal on first visit
      setTimeout(() => {
        overlay.classList.add('mygpt-modal-active');
        modal.classList.add('mygpt-modal-active');
      }, 300);
    }
    
    function closeModal() {
      overlay.classList.remove('mygpt-modal-active');
      modal.classList.remove('mygpt-modal-active');
      localStorage.setItem('mygpt-modal-dismissed', 'true');
    }
    
    closeBtn.addEventListener('click', closeModal);
    dismissBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
  }

  // Status management (gracefully handle missing status UI)
  function setStatus(status) {
    if (!elements.status) return; // Status UI removed, skip updates
    
    const statusText = elements.status.querySelector('.mygpt-status-text');
    if (!statusText) return;
    
    elements.status.setAttribute('data-status', status);
    
    switch (status) {
      case 'online':
        statusText.textContent = 'online';
        break;
      case 'offline':
        statusText.textContent = 'offline';
        break;
      case 'generating':
        statusText.textContent = 'thinking...';
        break;
      default:
        statusText.textContent = 'connecting...';
    }
  }

  // Check if API is available
  async function checkAPI() {
    try {
      const response = await fetch(`${API_BASE}/api/tags`, {
        method: 'GET',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        setStatus('online');
        return true;
      }
      console.warn('API responded with status:', response.status);
      setStatus('offline');
      return false;
    } catch (error) {
      console.error('API check failed:', error.message);
      if (error.message.includes('CORS') || error.message.includes('fetch')) {
        console.warn('This may be a CORS issue. Ensure Ollama has OLLAMA_ORIGINS set correctly.');
      }
      setStatus('offline');
      return false;
    }
  }

  // Auto-resize textarea
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }

  // Scroll to bottom with smooth animation
  function scrollToBottom(smooth = true) {
    elements.messages.scrollTo({
      top: elements.messages.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  // Create message element (minimal Grok-style - no cards, no avatars)
  function createMessage(content, role = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `mygpt-message mygpt-message--${role}`;
    
    if (role === 'assistant') {
      const textSpan = document.createElement('span');
      textSpan.className = 'mygpt-message-text';
      textSpan.textContent = content;
      messageDiv.appendChild(textSpan);
      
      // Add message actions container
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'mygpt-message-actions';
      
      // Add copy button
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mygpt-message-copy';
      copyBtn.title = 'Copy message';
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>';
      
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          copyBtn.classList.add('mygpt-message-copy--copied');
          setTimeout(() => {
            copyBtn.classList.remove('mygpt-message-copy--copied');
          }, 2000);
        } catch (error) {
          console.error('Failed to copy:', error);
        }
      });
      
      actionsDiv.appendChild(copyBtn);
      messageDiv.appendChild(actionsDiv);
    } else {
      // User message - styled as a pill/bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'mygpt-user-bubble';
      userBubble.textContent = content;
      messageDiv.appendChild(userBubble);
    }
    
    return messageDiv;
  }

  // Add token display to message
  function addTokenDisplay(messageEl, totalTokens, evalTokens) {
    let tokenText = '';
    if (evalTokens > 0 && totalTokens > 0) {
      tokenText = `${evalTokens} tokens`;
    } else if (totalTokens > 0) {
      tokenText = `${totalTokens} tokens`;
    } else if (evalTokens > 0) {
      tokenText = `${evalTokens} tokens`;
    }
    
    if (tokenText) {
      const tokenBadge = document.createElement('div');
      tokenBadge.className = 'mygpt-message-tokens';
      tokenBadge.textContent = tokenText;
      const actionsDiv = messageEl.querySelector('.mygpt-message-actions');
      if (actionsDiv) {
        actionsDiv.appendChild(tokenBadge);
      }
    }
  }

  // Create loading indicator (9-dot grid animation)
  function createLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mygpt-message mygpt-message--assistant mygpt-message--loading';
    loadingDiv.id = 'loading-indicator';
    
    const dotsGrid = document.createElement('div');
    dotsGrid.className = 'mygpt-loading-grid';
    
    // Create 9 dots in a 3x3 grid
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('span');
      dotsGrid.appendChild(dot);
    }
    
    loadingDiv.appendChild(dotsGrid);
    return loadingDiv;
  }

  // Smooth text reveal animation with word-by-word blur effect
  function revealText(element, newText, delay = 0) {
    return new Promise((resolve) => {
      if (currentChunkTimeout) {
        clearTimeout(currentChunkTimeout);
      }

      currentChunkTimeout = setTimeout(() => {
        // Get the current text and split into words
        const currentText = element.textContent || '';
        const currentWords = currentText.split(/\s+/).filter(w => w);
        const newWords = newText.split(/\s+/).filter(w => w);
        
        // Find new words that need to be added
        if (newWords.length > currentWords.length) {
          // Clear element and rebuild with all words
          element.innerHTML = '';
          
          // Add all words
          newWords.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.textContent = word;
            
            // Add blur animation class to new words
            if (index >= currentWords.length) {
              wordSpan.className = 'mygpt-word-reveal';
            }
            
            element.appendChild(wordSpan);
            
            // Add space after word (except last word)
            if (index < newWords.length - 1) {
              element.appendChild(document.createTextNode(' '));
            }
          });
        } else {
          // Just update text if no new words (final update)
          element.textContent = newText;
        }
        
        // Trigger smooth scroll as text appears
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
        
        resolve();
      }, delay);
    });
  }

  // Send message to API
  async function sendMessage(message) {
    if (!message.trim() || isGenerating) return;

    // Hide welcome message if it exists
    const welcomeMsg = elements.messages.querySelector('.mygpt-welcome');
    if (welcomeMsg) {
      welcomeMsg.style.display = 'none';
    }

    // Add user message
    const userMessage = createMessage(message, 'user');
    elements.messages.appendChild(userMessage);
    addToConversation(message, 'user');
    scrollToBottom();

    // Clear input
    elements.input.value = '';
    autoResize(elements.input);

    // Disable input
    isGenerating = true;
    elements.input.disabled = true;
    elements.send.disabled = true;
    setStatus('generating');

    // Add loading indicator
    const loadingIndicator = createLoadingIndicator();
    elements.messages.appendChild(loadingIndicator);
    scrollToBottom();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt: message,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Remove loading indicator
      loadingIndicator.remove();

      // Create assistant message
      const assistantMessage = createMessage('', 'assistant');
      elements.messages.appendChild(assistantMessage);
      const textSpan = assistantMessage.querySelector('.mygpt-message-text');

      // Read stream with smooth text reveal
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let lastUpdateTime = Date.now();
      const minUpdateInterval = 16; // ~60fps
      let totalTokens = 0;
      let evalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              
              // Throttle updates for smoother animation
              const now = Date.now();
              if (now - lastUpdateTime >= minUpdateInterval) {
                await revealText(textSpan, fullResponse, 0);
                lastUpdateTime = now;
              }
            }
            
            // Capture token info from final message
            if (json.eval_count !== undefined) {
              evalTokens = json.eval_count;
            }
            if (json.prompt_eval_count !== undefined) {
              totalTokens = json.prompt_eval_count + evalTokens;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }

      // Final update to ensure all text is shown
      await revealText(textSpan, fullResponse, 0);
      
      // Add token info to message element
      if (totalTokens > 0 || evalTokens > 0) {
        assistantMessage.dataset.tokens = totalTokens || evalTokens;
        addTokenDisplay(assistantMessage, totalTokens, evalTokens);
      }
      
      // Save to conversation with token data
      addToConversation(fullResponse, 'assistant', totalTokens || evalTokens);
      
      setStatus('online');
    } catch (error) {
      console.error('Error:', error);
      
      // Remove loading indicator
      const loading = document.getElementById('loading-indicator');
      if (loading) loading.remove();

      // Determine error type for better messaging
      let errorText = 'sorry, i encountered an error. ';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorText += 'could not connect to the server. this might be a cors issue or the server is offline.';
      } else if (error.message.includes('HTTP error')) {
        errorText += `server returned ${error.message}. the model might not be available.`;
      } else {
        errorText += 'please check if the server is running and try again.';
      }

      // Show error message
      const errorMessage = createMessage(errorText, 'assistant');
      errorMessage.classList.add('mygpt-message--error');
      elements.messages.appendChild(errorMessage);
      
      setStatus('offline');
    } finally {
      // Re-enable input
      isGenerating = false;
      elements.input.disabled = false;
      elements.send.disabled = false;
      elements.input.focus();
      scrollToBottom();
    }
  }

  // Handle form submission
  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = elements.input.value.trim();
    if (message) {
      sendMessage(message);
    }
  });

  // Handle clear button
  elements.clear.addEventListener('click', (e) => {
    e.preventDefault();
    // Show welcome screen and clear messages
    const messagesContainer = elements.messages;
    messagesContainer.innerHTML = `
      <div class="mygpt-welcome">
        <h1 class="mygpt-welcome-brand">mygpt</h1>
        <p class="mygpt-welcome-description">a self-hosted large language model running on my home server. powered by ollama.</p>
      </div>
    `;
    elements.input.value = '';
    autoResize(elements.input);
    conversationMessages = [];
    localStorage.removeItem(STORAGE_KEY);
  });

  // Handle textarea input
  elements.input.addEventListener('input', () => {
    autoResize(elements.input);
  });

  // Handle Shift + Enter for new line, Enter to send
  elements.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.form.dispatchEvent(new Event('submit'));
    }
  });

  // Initialize
  initializeModal();
  loadConversation();
  checkAPI();
  elements.input.focus();

  // Periodic health check
  setInterval(checkAPI, 30000); // Check every 30 seconds
})();
