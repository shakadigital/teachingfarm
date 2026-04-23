// ═══════════════════════════════════════════════════
// MOBILE FORMS UX - Teaching Farm UB
// ═══════════════════════════════════════════════════

class MobileFormsUX {
  constructor() {
    this.init();
  }

  init() {
    this.enhanceInputs();
    this.enhanceModals();
    this.addKeyboardHandling();
    this.addFormValidation();
    this.addAutoComplete();
  }

  enhanceInputs() {
    // Add focus/blur effects for better mobile UX
    document.addEventListener('focusin', (e) => {
      if (this.isFormInput(e.target)) {
        this.handleInputFocus(e.target);
      }
    });

    document.addEventListener('focusout', (e) => {
      if (this.isFormInput(e.target)) {
        this.handleInputBlur(e.target);
      }
    });

    // Add input type optimization for mobile keyboards
    this.optimizeInputTypes();
  }

  isFormInput(element) {
    return element.matches('input, textarea, select');
  }

  handleInputFocus(input) {
    // Add focused class for styling
    input.classList.add('mobile-focused');
    
    // Scroll input into view on mobile
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        input.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 300); // Wait for keyboard animation
    }

    // Add haptic feedback
    if (window.hapticFeedback) {
      window.hapticFeedback('light');
    }
  }

  handleInputBlur(input) {
    input.classList.remove('mobile-focused');
  }

  optimizeInputTypes() {
    // Optimize input types for better mobile keyboards
    const inputs = document.querySelectorAll('input');
    
    inputs.forEach(input => {
      const placeholder = input.placeholder?.toLowerCase() || '';
      const name = input.name?.toLowerCase() || '';
      const id = input.id?.toLowerCase() || '';
      
      // Email inputs
      if (placeholder.includes('email') || name.includes('email') || id.includes('email')) {
        input.type = 'email';
        input.autocomplete = 'email';
      }
      
      // Phone inputs
      if (placeholder.includes('phone') || placeholder.includes('telp') || 
          name.includes('phone') || name.includes('telp') ||
          id.includes('phone') || id.includes('telp')) {
        input.type = 'tel';
        input.autocomplete = 'tel';
      }
      
      // Number inputs with better mobile handling
      if (input.type === 'number') {
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
      }
      
      // Date inputs
      if (input.type === 'date') {
        input.autocomplete = 'bday';
      }
      
      // Password inputs
      if (input.type === 'password') {
        input.autocomplete = 'current-password';
      }
      
      // Add mobile-optimized attributes
      if (window.innerWidth <= 768) {
        // Prevent zoom on focus for iOS
        if (parseFloat(input.style.fontSize) < 16) {
          input.style.fontSize = '16px';
        }
      }
    });
  }

  enhanceModals() {
    // Improve modal UX for mobile
    const modals = document.querySelectorAll('.modal-overlay');
    
    modals.forEach(modal => {
      // Add swipe-down to close gesture
      this.addSwipeToCloseModal(modal);
      
      // Improve modal positioning on mobile
      this.improveModalPositioning(modal);
    });
  }

  addSwipeToCloseModal(modalOverlay) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const modal = modalOverlay.querySelector('.modal');
    if (!modal) return;

    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = false;
    }, { passive: true });

    modal.addEventListener('touchmove', (e) => {
      if (startY === 0) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Only allow downward swipe from top of modal
      if (deltaY > 0 && modal.scrollTop === 0) {
        isDragging = true;
        modal.style.transform = `translateY(${Math.min(deltaY * 0.5, 100)}px)`;
        modal.style.opacity = Math.max(1 - (deltaY / 300), 0.5);
      }
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      
      const deltaY = currentY - startY;
      
      if (deltaY > 100) {
        // Close modal
        const modalId = modalOverlay.id;
        if (typeof closeModal === 'function') {
          closeModal(modalId);
        }
        
        if (window.hapticFeedback) {
          window.hapticFeedback('medium');
        }
      } else {
        // Snap back
        modal.style.transform = 'translateY(0)';
        modal.style.opacity = '1';
      }
      
      startY = 0;
      currentY = 0;
      isDragging = false;
    }, { passive: true });
  }

  improveModalPositioning(modalOverlay) {
    const modal = modalOverlay.querySelector('.modal');
    if (!modal) return;

    // Add mobile-specific classes
    if (window.innerWidth <= 768) {
      modal.classList.add('mobile-modal');
    }

    // Handle keyboard appearance on mobile
    window.addEventListener('resize', () => {
      if (modalOverlay.style.display !== 'none') {
        this.adjustModalForKeyboard(modal);
      }
    });
  }

  adjustModalForKeyboard(modal) {
    // Adjust modal position when keyboard appears
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const windowHeight = window.innerHeight;
    
    if (viewportHeight < windowHeight * 0.75) {
      // Keyboard is likely open
      modal.style.maxHeight = `${viewportHeight - 40}px`;
      modal.style.top = '20px';
      modal.style.transform = 'translateX(-50%)';
    } else {
      // Keyboard is closed
      modal.style.maxHeight = 'calc(100vh - 40px)';
      modal.style.top = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
    }
  }

  addKeyboardHandling() {
    // Handle Enter key in forms
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.isFormInput(e.target)) {
        this.handleEnterKey(e);
      }
    });

    // Handle form submission with haptic feedback
    document.addEventListener('submit', (e) => {
      if (window.hapticFeedback) {
        window.hapticFeedback('medium');
      }
    });
  }

  handleEnterKey(e) {
    const form = e.target.closest('form') || e.target.closest('.modal-body') || e.target.closest('.card-body');
    if (!form) return;

    // Find next input or submit button
    const inputs = Array.from(form.querySelectorAll('input, textarea, select, button'));
    const currentIndex = inputs.indexOf(e.target);
    
    if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
      // Focus next input
      const nextInput = inputs[currentIndex + 1];
      if (nextInput.type !== 'submit' && nextInput.type !== 'button') {
        e.preventDefault();
        nextInput.focus();
        
        if (window.hapticFeedback) {
          window.hapticFeedback('light');
        }
      }
    }
  }

  addFormValidation() {
    // Add real-time validation with visual feedback
    document.addEventListener('input', (e) => {
      if (this.isFormInput(e.target)) {
        this.validateInput(e.target);
      }
    });
  }

  validateInput(input) {
    const isValid = input.checkValidity();
    
    // Remove existing validation classes
    input.classList.remove('valid', 'invalid');
    
    // Add appropriate class
    if (input.value.trim() !== '') {
      input.classList.add(isValid ? 'valid' : 'invalid');
    }
    
    // Add haptic feedback for invalid input
    if (!isValid && input.value.trim() !== '' && window.hapticFeedback) {
      window.hapticFeedback('error');
    }
  }

  addAutoComplete() {
    // Add smart autocomplete for common fields
    const commonValues = {
      kandang: ['Kandang 1', 'Kandang 2', 'Kandang 3'],
      supplier: ['PT Pakan Jaya', 'CV Ternak Makmur', 'Toko Pakan Sejahtera'],
      kategori: ['Operasional Harian', 'Pembelian Pakan', 'Obat & Vitamin', 'Listrik & Air']
    };

    // Add datalist elements for autocomplete
    Object.keys(commonValues).forEach(key => {
      const datalist = document.createElement('datalist');
      datalist.id = `${key}-list`;
      
      commonValues[key].forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        datalist.appendChild(option);
      });
      
      document.body.appendChild(datalist);
      
      // Link inputs to datalist
      const inputs = document.querySelectorAll(`input[name*="${key}"], input[id*="${key}"]`);
      inputs.forEach(input => {
        input.setAttribute('list', `${key}-list`);
      });
    });
  }

  // Add visual feedback for button presses
  addButtonFeedback() {
    document.addEventListener('touchstart', (e) => {
      if (e.target.matches('button, .btn-add, .btn-save, .btn-primary, .btn-secondary')) {
        e.target.classList.add('haptic-feedback');
        
        if (window.hapticFeedback) {
          window.hapticFeedback('light');
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (e.target.matches('button, .btn-add, .btn-save, .btn-primary, .btn-secondary')) {
        setTimeout(() => {
          e.target.classList.remove('haptic-feedback');
        }, 200);
      }
    }, { passive: true });
  }
}

// Initialize mobile forms UX
document.addEventListener('DOMContentLoaded', () => {
  window.mobileFormsUX = new MobileFormsUX();
});