// Accessibility utilities and helpers

export const ARIA_LABELS = {
  close: 'Close',
  menu: 'Main menu',
  navigation: 'Main navigation',
  search: 'Search',
  loading: 'Loading',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  info: 'Information',
  expandSection: 'Expand section',
  collapseSection: 'Collapse section',
  selectOption: 'Select option',
  clearInput: 'Clear input',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  previousPage: 'Go to previous page',
  nextPage: 'Go to next page',
  firstPage: 'Go to first page',
  lastPage: 'Go to last page',
  sortColumn: 'Sort column',
  filterColumn: 'Filter column',
  toggleTheme: 'Toggle theme',
  notifications: 'Notifications',
  userMenu: 'User menu',
  mobileMenu: 'Mobile menu'
} as const;

export const ROLE_ATTRIBUTES = {
  button: 'button',
  link: 'link',
  menuitem: 'menuitem',
  tab: 'tab',
  tabpanel: 'tabpanel',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  banner: 'banner',
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  search: 'search',
  form: 'form',
  region: 'region',
  alert: 'alert',
  status: 'status',
  progressbar: 'progressbar',
  slider: 'slider',
  spinbutton: 'spinbutton',
  checkbox: 'checkbox',
  radio: 'radio',
  combobox: 'combobox',
  listbox: 'listbox',
  option: 'option',
  tree: 'tree',
  treeitem: 'treeitem',
  grid: 'grid',
  gridcell: 'gridcell',
  columnheader: 'columnheader',
  rowheader: 'rowheader'
} as const;

// Screen reader announcements
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Focus management
export const focusElement = (selector: string, container?: HTMLElement) => {
  const element = (container || document).querySelector(selector) as HTMLElement;
  if (element) {
    element.focus();
    return true;
  }
  return false;
};

export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const selectors = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  return Array.from(container.querySelectorAll(selectors)).filter(
    (element) => {
      const htmlElement = element as HTMLElement;
      return (
        htmlElement.offsetWidth > 0 &&
        htmlElement.offsetHeight > 0 &&
        !htmlElement.hidden &&
        getComputedStyle(htmlElement).visibility !== 'hidden'
      );
    }
  ) as HTMLElement[];
};

// Keyboard navigation helpers
export const KEYBOARD_KEYS = {
  Enter: 'Enter',
  Space: ' ',
  Escape: 'Escape',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown'
} as const;

export const handleKeyboardNavigation = (
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect?: (index: number) => void,
  orientation: 'horizontal' | 'vertical' = 'vertical'
) => {
  const { key } = event;
  let newIndex = currentIndex;

  switch (key) {
    case KEYBOARD_KEYS.ArrowUp:
      if (orientation === 'vertical') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      break;
    case KEYBOARD_KEYS.ArrowDown:
      if (orientation === 'vertical') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      }
      break;
    case KEYBOARD_KEYS.ArrowLeft:
      if (orientation === 'horizontal') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      break;
    case KEYBOARD_KEYS.ArrowRight:
      if (orientation === 'horizontal') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      }
      break;
    case KEYBOARD_KEYS.Home:
      event.preventDefault();
      newIndex = 0;
      break;
    case KEYBOARD_KEYS.End:
      event.preventDefault();
      newIndex = items.length - 1;
      break;
    case KEYBOARD_KEYS.Enter:
    case KEYBOARD_KEYS.Space:
      event.preventDefault();
      onSelect?.(currentIndex);
      return currentIndex;
  }

  if (newIndex !== currentIndex && items[newIndex]) {
    items[newIndex].focus();
    return newIndex;
  }

  return currentIndex;
};

// Color contrast utilities
export const getContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    // Simplified luminance calculation
    // In a real implementation, you'd want a more robust color parsing library
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const [rs, gs, bs] = [r, g, b].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

export const meetsWCAGStandard = (
  contrastRatio: number, 
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): boolean => {
  if (level === 'AAA') {
    return isLargeText ? contrastRatio >= 4.5 : contrastRatio >= 7;
  }
  return isLargeText ? contrastRatio >= 3 : contrastRatio >= 4.5;
};

// Reduced motion preferences
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// High contrast mode detection
export const prefersHighContrast = (): boolean => {
  return window.matchMedia('(prefers-contrast: high)').matches;
};

// Screen reader detection
export const hasScreenReader = (): boolean => {
  // This is a simplified check - in practice, you might want to check for
  // specific screen reader software or use a more sophisticated method
  return !!navigator.userAgent.match(/JAWS|NVDA|SAPI|VoiceOver|Window-Eyes|dragon|ZoomText|MagPie/i);
};

// Generate unique IDs for accessibility
let idCounter = 0;
export const generateId = (prefix: string = 'accessibility'): string => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

// Validation helpers
export const validateAriaLabel = (element: HTMLElement): boolean => {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const textContent = element.textContent?.trim();
  
  return !!(ariaLabel || ariaLabelledBy || textContent);
};

export const validateFormAccessibility = (form: HTMLFormElement): string[] => {
  const errors: string[] = [];
  const inputs = form.querySelectorAll('input, select, textarea');
  
  inputs.forEach((input) => {
    const htmlInput = input as HTMLInputElement;
    const label = form.querySelector(`label[for="${htmlInput.id}"]`);
    const ariaLabel = htmlInput.getAttribute('aria-label');
    const ariaLabelledBy = htmlInput.getAttribute('aria-labelledby');
    
    if (!label && !ariaLabel && !ariaLabelledBy) {
      errors.push(`Input element missing label: ${htmlInput.name || htmlInput.id || 'unknown'}`);
    }
    
    if (htmlInput.required && !htmlInput.getAttribute('aria-required')) {
      htmlInput.setAttribute('aria-required', 'true');
    }
  });
  
  return errors;
};