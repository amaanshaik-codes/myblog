(function () {
  'use strict';

  const API_BASE = 'https://hewlett.tail16475c.ts.net';
  const API_ENDPOINT = `${API_BASE}/api/generate`;
  const MODEL_NAME = 'hermes3:3b';
  const SYSTEM_PROMPT = `You are Hermes, the assistant running on Amaan's home server. Speak like a normal person — not robotic or vague. Do not use phrases such as "As an AI", "I cannot", "I don’t have the context", or similar disclaimers. Avoid apologies that signal lack of ability. Be concise and direct: use short sentences for simple questions and only write long paragraphs when the topic requires detail.

Tone: slightly quirky but restrained — not overly friendly. No emojis, no slang that breaks clarity. Prefer plain, clear language that sounds like a person talking. If you must refuse (safety/legal/medical), do so briefly and give a short, practical explanation or safe alternative.`;

  const elements = {
    messages: document.getElementById('hermes-messages'),
    form: document.getElementById('hermes-form'),
    input: document.getElementById('hermes-input'),
    send: document.getElementById('hermes-send'),
    status: document.getElementById('hermes-status'),
  };

  let isGenerating = false;
  let currentChunkTimeout = null;
  let conversationMessages = [];

  // Modal management
  function initializeModal() {
    const modal = document.getElementById('hermes-modal');
    const overlay = document.getElementById('hermes-modal-overlay');
    const dismissBtn = document.getElementById('hermes-modal-dismiss');
    const infoBtn = document.getElementById('hermes-info-btn');
    let lastFocusedElement = null;
    
    // Gracefully handle if modal elements don't exist
    if (!modal || !overlay || !dismissBtn) return;
    
    // Show modal every time the page loads
    setTimeout(() => {
      openModal();
    }, 300);
    
    function openModal() {
      lastFocusedElement = document.activeElement;
      overlay.classList.add('hermes-modal-active');
      modal.classList.add('hermes-modal-active');
      overlay.setAttribute('aria-hidden', 'false');
      modal.setAttribute('aria-hidden', 'false');
      dismissBtn.focus();
    }
    
    function closeModal() {
      overlay.classList.remove('hermes-modal-active');
      modal.classList.remove('hermes-modal-active');
      overlay.setAttribute('aria-hidden', 'true');
      modal.setAttribute('aria-hidden', 'true');
      if (lastFocusedElement && lastFocusedElement !== document.body) {
        lastFocusedElement.focus();
      }
    }
    
    // ESC key handler
    function handleEscape(e) {
      if (e.key === 'Escape' && modal.classList.contains('hermes-modal-active')) {
        closeModal();
      }
    }
    
    // Focus trap
    function trapFocus(e) {
      if (!modal.classList.contains('hermes-modal-active')) return;
      
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
    
    const statusText = elements.status.querySelector('.hermes-status-text');
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
    messageDiv.className = `hermes-message hermes-message--${role}`;
    
    if (role === 'assistant') {
      const textSpan = document.createElement('span');
      textSpan.className = 'hermes-message-text';
      textSpan.textContent = content;
      messageDiv.appendChild(textSpan);
      
      // Add message actions container
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'hermes-message-actions';
      
      // Add copy button
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'hermes-message-copy';
      copyBtn.title = 'Copy message';
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>';
      
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          copyBtn.classList.add('hermes-message-copy--copied');
          setTimeout(() => {
            copyBtn.classList.remove('hermes-message-copy--copied');
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
      userBubble.className = 'hermes-user-bubble';
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
      tokenBadge.className = 'hermes-message-tokens';
      tokenBadge.textContent = tokenText;
      const actionsDiv = messageEl.querySelector('.hermes-message-actions');
      if (actionsDiv) {
        actionsDiv.appendChild(tokenBadge);
      }
    }
  }

  // Create loading indicator with "thinking" text
  function createLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'hermes-message hermes-message--assistant hermes-message--loading';
    loadingDiv.id = 'loading-indicator';
    
    const thinkingSpan = document.createElement('span');
    thinkingSpan.className = 'hermes-thinking';
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
    const welcomeMsg = elements.messages.querySelector('.hermes-welcome');
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
        const thinkingSpan = loadingIndicator.querySelector('.hermes-thinking');
        if (thinkingSpan) {
          thinkingSpan.innerHTML = `thinking<br><span style="font-size: 0.75rem; margin-top: 0.5rem; display: block; opacity: 0.7;">hold on... this model takes a moment to think deeply. it's processing your question carefully.</span>`;
          scrollToBottom();
          longGenerationShown = true;
        }
      }
    }, 5000);

    try {
      // Build messages array with system prompt
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationMessages
      ];

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          prompt: messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}`;
            if (m.role === 'user') return `User: ${m.content}`;
            return `Assistant: ${m.content}`;
          }).join('\n\n') + '\n\nAssistant:',
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
      const textSpan = assistantMessage.querySelector('.hermes-message-text');

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
        addTokenDisplay(assistantMessage, totalTokens, evalTokens);
      }

      // Save assistant message
      conversationMessages.push({ content: fullResponse, role: 'assistant' });

    } catch (error) {
      console.error('Send message failed:', error);
      const errorMessage = createMessage('Something went wrong. Please try again.', 'assistant');
      errorMessage.classList.add('hermes-message--error');
      elements.messages.appendChild(errorMessage);
    } finally {
      isGenerating = false;
      elements.input.disabled = false;
      elements.send.disabled = false;
      setStatus('online');
      scrollToBottom(false);
    }
  }

  // Initialize UI bindings
  function init() {
    if (!elements.messages) return;

    // Modal
    initializeModal();

    // Form handling
    if (elements.form) {
      elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage(elements.input.value.trim());
      });
    }

    if (elements.input) {
      elements.input.addEventListener('input', () => autoResize(elements.input));
      elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (elements.send && !elements.send.disabled) {
            elements.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('hermes-prompt-btn')) {
        const prompt = e.target.getAttribute('data-prompt') || '';
        if (prompt) {
          sendMessage(prompt);
        }
      }
    });

    checkAPI().then(() => setStatus('online'));
  }

  // Run when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

})();