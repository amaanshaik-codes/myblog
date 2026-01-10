(function () {
  'use strict';

  const API_BASE = 'https://hewlett.tail16475c.ts.net';
  const API_ENDPOINT = `${API_BASE}/api/generate`;
  const MODEL_NAME = 'hermes3:3b';

  const elements = {
    messages: document.getElementById('mygpt-messages'),
    form: document.getElementById('mygpt-form'),
    input: document.getElementById('mygpt-input'),
    send: document.getElementById('mygpt-send'),
    status: document.getElementById('mygpt-status'),
  };

  let isGenerating = false;
  let currentChunkTimeout = null;
  let conversationMessages = [];

  // Modal management
  function initializeModal() {
    const modal = document.getElementById('mygpt-modal');
    const overlay = document.getElementById('mygpt-modal-overlay');
    const dismissBtn = document.getElementById('mygpt-modal-dismiss');
    const infoBtn = document.getElementById('mygpt-info-btn');
    let lastFocusedElement = null;
    
    // Gracefully handle if modal elements don't exist
    if (!modal || !overlay || !dismissBtn) return;
    
    // Show modal every time the page loads
    setTimeout(() => {
      openModal();
    }, 300);
    
    function openModal() {
      lastFocusedElement = document.activeElement;
      overlay.classList.add('mygpt-modal-active');
      modal.classList.add('mygpt-modal-active');
      overlay.setAttribute('aria-hidden', 'false');
      modal.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
    }
    
    function closeModal() {
      overlay.classList.remove('mygpt-modal-active');
      modal.classList.remove('mygpt-modal-active');
      overlay.setAttribute('aria-hidden', 'true');
      modal.setAttribute('aria-hidden', 'true');
      if (lastFocusedElement && lastFocusedElement !== document.body) {
        lastFocusedElement.focus();
      }
    }
    
    // ESC key handler
    function handleEscape(e) {
      if (e.key === 'Escape' && modal.classList.contains('mygpt-modal-active')) {
        closeModal();
      }
    }
    
    // Focus trap
    function trapFocus(e) {
      if (!modal.classList.contains('mygpt-modal-active')) return;
      
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
    
    if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', trapFocus);
    
    // Info button opens modal
    if (infoBtn) {
      infoBtn.addEventListener('click', openModal);
    }
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

  // Create loading indicator with "thinking" text
  function createLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mygpt-message mygpt-message--assistant mygpt-message--loading';
    loadingDiv.id = 'loading-indicator';
    
    const thinkingSpan = document.createElement('span');
    thinkingSpan.className = 'mygpt-thinking';
    thinkingSpan.textContent = 'thinking';
    
    loadingDiv.appendChild(thinkingSpan);
    return loadingDiv;
  }

  // Smooth text reveal animation
  function revealText(element, newText, delay = 0) {
    return new Promise((resolve) => {
      if (currentChunkTimeout) {
        clearTimeout(currentChunkTimeout);
      }

      currentChunkTimeout = setTimeout(() => {
        // Simply update the text content - no complex DOM manipulation
        element.textContent = newText;
        
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
    conversationMessages.push({ content: message, role: 'user' });
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

    // Set timeout to show "hold on" message after 5 seconds
    let longGenerationShown = false;
    const longGenerationTimeout = setTimeout(() => {
      if (isGenerating && loadingIndicator.parentNode) {
        // Replace or update the loading indicator
        const thinkingSpan = loadingIndicator.querySelector('.mygpt-thinking');
        if (thinkingSpan) {
          thinkingSpan.innerHTML = `thinking<br><span style="font-size: 0.75rem; margin-top: 0.5rem; display: block; opacity: 0.7;">hold on... this model takes a moment to think deeply. it's processing your question carefully.</span>`;
          scrollToBottom();
          longGenerationShown = true;
        }
      }
    }, 5000);

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
        clearTimeout(longGenerationTimeout);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Remove loading indicator
      clearTimeout(longGenerationTimeout);
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
      clearTimeout(longGenerationTimeout);
      await revealText(textSpan, fullResponse, 0);
      
      // Add token info to message element
      if (totalTokens > 0 || evalTokens > 0) {
        assistantMessage.dataset.tokens = totalTokens || evalTokens;
        addTokenDisplay(assistantMessage, totalTokens, evalTokens);
      }
      
      // Save to conversation with token data
      conversationMessages.push({ content: fullResponse, role: 'assistant', tokens: totalTokens || evalTokens });
      
      setStatus('online');
    } catch (error) {
      console.error('Error:', error);
      clearTimeout(longGenerationTimeout);
      
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

  // Mobile keyboard handling - prevent viewport shift
  function setupMobileKeyboardHandling() {
    const container = document.querySelector('.mygpt-container');
    const inputWrapper = document.querySelector('.mygpt-input-wrapper');
    
    if (!container || !inputWrapper) return;
    
    // Use visualViewport API for better mobile keyboard detection
    if (window.visualViewport) {
      let initialHeight = window.visualViewport.height;
      
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const keyboardHeight = initialHeight - currentHeight;
        
        if (keyboardHeight > 100) {
          // Keyboard is open
          container.style.height = `${currentHeight}px`;
          document.body.classList.add('keyboard-open');
          
          // Scroll to bottom after a small delay
          setTimeout(() => scrollToBottom(false), 50);
        } else {
          // Keyboard is closed
          container.style.height = '';
          document.body.classList.remove('keyboard-open');
        }
      });
      
      window.visualViewport.addEventListener('scroll', () => {
        // Prevent iOS scroll-to-top behavior
        if (document.body.classList.contains('keyboard-open')) {
          window.scrollTo(0, 0);
        }
      });
    }
    
    // Prevent page scroll on input focus (iOS Safari)
    elements.input.addEventListener('focus', () => {
      // Small delay to let keyboard animate
      setTimeout(() => {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }, 100);
    });
    
    // Handle blur to reset
    elements.input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA') {
          window.scrollTo(0, 0);
        }
      }, 100);
    });
  }

  // Initialize
  initializeModal();
  checkAPI();
  setupMobileKeyboardHandling();

  // Periodic health check
  setInterval(checkAPI, 30000); // Check every 30 seconds
})();
