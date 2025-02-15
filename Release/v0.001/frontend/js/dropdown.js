class Dropdown {
    constructor(element) {
        if (!document.body.contains(element)) {
            throw new Error('Element is not attached to the DOM');
        }

        if (!(element instanceof HTMLElement)) {
            throw new TypeError('El elemento debe ser una instancia de HTMLElement');
        }

        this.dropdown = element;

        // Validar existencia y estructura del dropdown
        if (!this.dropdown.classList.contains('dropdown')) {
            throw new Error('Element must have "dropdown" class');
        }

        // Obtener y validar elementos internos
        this.toggle = this.validateElement(
            this.dropdown.querySelector('.dropdown-toggle'),
            'toggle'
        );
        this.menu = this.validateElement(
            this.dropdown.querySelector('.dropdown-menu'),
            'menu'
        );
        
        // Validar items del menú
        const itemsList = this.dropdown.querySelectorAll('.dropdown-item');
        this.items = this.validateNodeList(itemsList, 'items');

        // Asegurar IDs únicos
        this.ensureUniqueIds();

        // Validar toggle
        if (!(this.toggle instanceof HTMLElement)) {
            throw new TypeError('Elemento toggle no encontrado o inválido');
        }
        // Asegurarnos de que el toggle tenga un ID antes de usarlo
        if (!this.toggle.id) {
            this.toggle.id = `dropdown-toggle-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Validar menú
        if (!(this.menu instanceof HTMLElement)) {
            throw new TypeError('Elemento menu no encontrado o inválido');
        }
        // Asegurar que el menú tenga un ID para aria-controls
        if (!this.menu.id) {
            this.menu.id = `dropdown-menu-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Establecer relación aria-controls correctamente
        this.toggle.setAttribute('aria-controls', this.menu.id);

        // Validar que exista al menos un item o un elemento dentro del menú
        if (!this.items.length && !this.menu.children.length) {
            this.menu.setAttribute('aria-empty', 'true');
            console.warn('Dropdown menu is empty');
        }

        // Store bound methods for cleanup
        this._boundHandleToggle = this.handleToggle.bind(this);
        this._boundHandleClickOutside = this.handleClickOutside.bind(this);
        this._boundHandleKeyDown = this.handleKeyDown.bind(this);
        this._boundHandleFocusOut = this.handleFocusOut.bind(this);
        this._boundHandleAriaExpanded = this.handleAriaExpanded.bind(this);

        this.init();
    }

    validateElement(element, name) {
        if (!element) {
            throw new Error(`Dropdown ${name} element not found`);
        }
        if (!(element instanceof HTMLElement)) {
            throw new TypeError(`Dropdown ${name} is not a valid HTML element`);
        }
        if (!document.body.contains(element)) {
            throw new Error(`Dropdown ${name} is not attached to the DOM`);
        }
        return element;
    }

    validateNodeList(nodeList, name) {
        if (!nodeList) {
            throw new Error(`${name} NodeList is null or undefined`);
        }
        if (!(nodeList instanceof NodeList)) {
            throw new TypeError(`${name} is not a valid NodeList`);
        }
        // Convertir a array y validar cada elemento
        return Array.from(nodeList).map((item, index) => 
            this.validateElement(item, `${name}[${index}]`)
        );
    }

    ensureUniqueIds() {
        // Generar IDs únicos si no existen
        if (!this.toggle.id) {
            this.toggle.id = this.generateUniqueId('toggle');
        }
        if (!this.menu.id) {
            this.menu.id = this.generateUniqueId('menu');
        }

        // Verificar uniqueness en el documento
        this.validateUniqueId(this.toggle.id);
        this.validateUniqueId(this.menu.id);
    }

    generateUniqueId(prefix) {
        const uniqueId = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
        if (document.getElementById(uniqueId)) {
            return this.generateUniqueId(prefix); // Recursión si el ID ya existe
        }
        return uniqueId;
    }

    validateUniqueId(id) {
        const elements = document.querySelectorAll(`#${id}`);
        if (elements.length > 1) {
            throw new Error(`Duplicate ID found: ${id}`);
        }
    }

    init() {
        try {
            // Validate duplicate elements
            const existingDropdown = Dropdown.getInstanceByElement(this.dropdown);
            if (existingDropdown) {
                throw new Error('Dropdown already initialized for this element');
            }

            // Initialize state
            this.isOpen = false;
            this.eventListeners = new Set();

            // Set ARIA attributes
            this.toggle.setAttribute('aria-haspopup', 'true');
            this.toggle.setAttribute('aria-expanded', 'false');
            this.toggle.setAttribute('aria-controls', this.menu.id || this.generateMenuId());
            this.menu.setAttribute('role', 'menu');
            
            try {
                // Configurar items dentro de un bloque try separado
                if (this.items.length) {
                    this.items.forEach((item, index) => {
                        item.setAttribute('role', 'menuitem');
                        item.setAttribute('tabindex', '-1');
                        item.setAttribute('aria-posinset', index + 1);
                        item.setAttribute('aria-setsize', this.items.length);
                    });
                } else {
                    const emptyMessage = document.createElement('div');
                    emptyMessage.className = 'dropdown-empty';
                    emptyMessage.setAttribute('role', 'note');
                    emptyMessage.textContent = 'No hay opciones disponibles';
                    this.menu.appendChild(emptyMessage);
                }
            } catch (error) {
                this.cleanupEventListeners(); // Limpiar listeners si falla la configuración de items
                throw error;
            }

            try {
                // Add event listeners with tracking
                this.addEventListenerWithTracking(this.toggle, 'click', this._boundHandleToggle);
                this.addEventListenerWithTracking(document, 'click', this._boundHandleClickOutside);
                this.addEventListenerWithTracking(this.dropdown, 'keydown', this._boundHandleKeyDown);
                this.addEventListenerWithTracking(this.dropdown, 'focusout', this._boundHandleFocusOut);
                this.addEventListenerWithTracking(this.toggle, 'aria-expanded', this._boundHandleAriaExpanded);

                // Mobile support
                if ('ontouchstart' in window) {
                    this._boundHandleTouchStart = this.handleTouchStart.bind(this);
                    this.addEventListenerWithTracking(this.dropdown, 'touchstart', this._boundHandleTouchStart);
                }
            } catch (error) {
                this.cleanupEventListeners(); // Limpiar listeners si falla la adición de eventos
                throw error;
            }

            // Validate duplicate IDs después de todo para limpiar si falla
            if (this.menu.id) {
                const duplicateMenu = document.querySelectorAll(`#${this.menu.id}`);
                if (duplicateMenu.length > 1) {
                    this.cleanupEventListeners();
                    throw new Error(`Duplicate menu ID found: ${this.menu.id}`);
                }
            }

            // Store instance reference safely using WeakMap
            if (!Dropdown.instances) {
                Dropdown.instances = new WeakMap();
            }
            Dropdown.instances.set(this.dropdown, this);

        } catch (error) {
            // Asegurar limpieza en caso de error
            this.cleanupEventListeners();
            console.error('Dropdown initialization failed:', error);
            throw error;
        }
    }

    cleanupEventListeners() {
        try {
            if (this.eventListeners) {
                this.eventListeners.forEach(({ element, type, handler }) => {
                    try {
                        element.removeEventListener(type, handler);
                    } catch (e) {
                        console.warn(`Failed to remove event listener: ${type}`, e);
                    }
                });
                this.eventListeners.clear();
            }
        } catch (error) {
            console.error('Error cleaning up event listeners:', error);
        }
    }

    handleToggle(event) {
        event.stopPropagation();
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;

        // Close any other open dropdowns
        document.querySelectorAll('.dropdown.open').forEach(dropdown => {
            if (dropdown !== this.dropdown) {
                dropdown._dropdownInstance?.close();
            }
        });

        this.isOpen = true;
        this.dropdown.classList.add('open');
        this.toggle.setAttribute('aria-expanded', 'true');
        this.menu.style.display = 'block';

        // Focus first item solo si existen items
        if (this.items.length) {
            this.items[0].focus();
        } else {
            // Si no hay items, mantener el foco en el toggle
            this.toggle.focus();
        }

        // Add mobile backdrop if needed
        if (window.innerWidth <= 768) {
            this.addBackdrop();
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.dropdown.classList.remove('open');
        this.toggle.setAttribute('aria-expanded', 'false');
        this.menu.style.display = 'none';

        // Remove mobile backdrop if exists
        this.removeBackdrop();
    }

    handleClickOutside(event) {
        if (!this.dropdown.contains(event.target)) {
            this.close();
        }
    }

    handleKeyDown(event) {
        // No procesar eventos de teclado para navegación si no hay items
        if (!this.items.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            return;
        }

        try {
            const keyHandlers = {
                'Enter': () => {
                    event.preventDefault();
                    if (!this.isOpen) {
                        this.open();
                    } else if (document.activeElement !== this.toggle) {
                        document.activeElement.click();
                    }
                },
                ' ': () => {
                    event.preventDefault();
                    if (!this.isOpen) this.open();
                },
                'Escape': () => {
                    if (this.isOpen) {
                        event.preventDefault();
                        this.close();
                        this.toggle.focus();
                    }
                },
                'ArrowDown': () => {
                    event.preventDefault();
                    if (!this.isOpen) {
                        this.open();
                    } else {
                        this.focusNextItem();
                    }
                },
                'ArrowUp': () => {
                    event.preventDefault();
                    if (!this.isOpen) {
                        this.open();
                        this.focusLastItem();
                    } else {
                        this.focusPreviousItem();
                    }
                },
                'Home': () => {
                    if (this.isOpen) {
                        event.preventDefault();
                        this.focusFirstItem();
                    }
                },
                'End': () => {
                    if (this.isOpen) {
                        event.preventDefault();
                        this.focusLastItem();
                    }
                },
                'Tab': () => {
                    if (this.isOpen) {
                        if (!event.shiftKey && document.activeElement === this.getLastFocusableElement()) {
                            event.preventDefault();
                            this.close();
                            this.toggle.focus();
                        } else if (event.shiftKey && document.activeElement === this.toggle) {
                            event.preventDefault();
                            this.close();
                        }
                    }
                },
                'PageUp': () => {
                    if (this.isOpen) {
                        event.preventDefault();
                        this.focusFirstItem();
                    }
                },
                'PageDown': () => {
                    if (this.isOpen) {
                        event.preventDefault();
                        this.focusLastItem();
                    }
                }
            };

            const handler = keyHandlers[event.key];
            if (handler) {
                handler();
            } else if (this.isOpen && event.key.length === 1) {
                // Handle character search when menu is open
                this.handleCharacterSearch(event.key);
            }
        } catch (error) {
            console.error('Error handling keyboard event:', error);
            this.close();
        }
    }

    handleCharacterSearch(char) {
        clearTimeout(this._searchTimeout);
        this._searchText = (this._searchText || '') + char.toLowerCase();

        const items = Array.from(this.items);
        const match = items.find(item => 
            item.textContent.toLowerCase().startsWith(this._searchText)
        );

        if (match) {
            match.focus();
        }

        // Clear search text after 500ms
        this._searchTimeout = setTimeout(() => {
            this._searchText = '';
        }, 500);
    }

    getLastFocusableElement() {
        const focusables = this.menu.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        return focusables[focusables.length - 1];
    }

    handleFocusOut(event) {
        try {
            if (!this.dropdown.contains(event.relatedTarget)) {
                this.close();
            }
        } catch (error) {
            console.error('Error handling focus out:', error);
            this.close();
        }
    }

    handleAriaExpanded() {
        const expanded = this.toggle.getAttribute('aria-expanded') === 'true';
        this.toggle.setAttribute('aria-expanded', !expanded);
    }

    addEventListenerWithTracking(element, type, handler) {
        if (!(element instanceof EventTarget)) {
            throw new TypeError('element debe ser una instancia de EventTarget');
        }
        if (typeof type !== 'string') {
            throw new TypeError('type debe ser una cadena');
        }
        if (typeof handler !== 'function') {
            throw new TypeError('handler debe ser una función');
        }
        
        try {
            element.addEventListener(type, handler);
            this.eventListeners.add({ element, type, handler });
        } catch (error) {
            console.error(`Failed to add event listener: ${type}`, error);
        }
    }

    generateMenuId() {
        const id = `dropdown-menu-${Math.random().toString(36).substr(2, 9)}`;
        this.menu.id = id;
        return id;
    }

    focusFirstItem() {
        if (this.items.length) {
            this.items[0].focus();
        }
    }

    focusLastItem() {
        if (this.items.length) {
            this.items[this.items.length - 1].focus();
        }
    }

    addBackdrop() {
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'dropdown-backdrop';
        this._boundHandleBackdropClick = this.close.bind(this);
        this.backdrop.addEventListener('click', this._boundHandleBackdropClick);
        document.body.appendChild(this.backdrop);
    }

    removeBackdrop() {
        if (this.backdrop) {
            this.backdrop.removeEventListener('click', this._boundHandleBackdropClick);
            this.backdrop.remove();
            this.backdrop = null;
            this._boundHandleBackdropClick = null;
        }
    }

    destroy() {
        try {
            this.cleanupEventListeners();
            // Remove from instances immediately to prevent memory leaks
            if (Dropdown.instances) {
                Dropdown.instances.delete(this.dropdown);
                
                // Clean up instances WeakMap if empty
                if (!Dropdown.instances.size) {
                    Dropdown.instances = null;
                }
            }

            // Clear search state
            clearTimeout(this._searchTimeout);
            this._searchText = '';

            // Limpiar referencias circulares
            this.eventListeners?.forEach(listener => {
                listener.element = null;
                listener.handler = null;
            });
            this.eventListeners?.clear();

            // Remove all tracked event listeners
            this.eventListeners.forEach(({ element, type, handler }) => {
                element.removeEventListener(type, handler);
            });
            this.eventListeners.clear();

            // Remove ARIA attributes
            this.toggle.removeAttribute('aria-haspopup');
            this.toggle.removeAttribute('aria-expanded');
            this.toggle.removeAttribute('aria-controls');
            this.menu.removeAttribute('role');

            // Remove backdrop if exists
            this.removeBackdrop();

            // Remove instance reference
            if (Dropdown.instances) {
                Dropdown.instances.delete(this.dropdown);
            }

            if (Dropdown.instances?.size === 0) {
                Dropdown.instances = null;
            }

            // Clean up references
            this.dropdown = null;
            this.toggle = null;
            this.menu = null;
            this.items = null;
            this._boundHandleToggle = null;
            this._boundHandleClickOutside = null;
            this._boundHandleKeyDown = null;
            this._boundHandleFocusOut = null;
            this._boundHandleAriaExpanded = null;
            this._boundHandleTouchStart = null;

        } catch (error) {
            console.error('Error during dropdown cleanup:', error);
            throw error;
        }
    }

    // Static method to get instance
    static getInstance(element) {
        return Dropdown.instances?.get(element);
    }

    static getInstanceByElement(element) {
        return Dropdown.instances?.get(element);
    }
}

// Modificar la inicialización para validar el DOM primero
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Validar que el DOM está listo
        if (!document.body) {
            throw new Error('Document body not available');
        }

        // Validar selector antes de usar
        if (!document.querySelector('.dropdown')) {
            console.warn('No dropdown elements found in the document');
            return;
        }

        const processedElements = new WeakSet();
        const dropdowns = document.querySelectorAll('.dropdown');

        // Validar que la NodeList es válida
        if (!(dropdowns instanceof NodeList)) {
            throw new TypeError('Invalid dropdown elements query result');
        }

        dropdowns.forEach(dropdown => {
            if (!document.body.contains(dropdown)) {
                console.warn('Dropdown element is not attached to the DOM', dropdown);
                return;
            }

            if (processedElements.has(dropdown)) {
                console.warn('Dropdown already initialized', dropdown);
                return;
            }
            
            try {
                new Dropdown(dropdown);
                processedElements.add(dropdown);
            } catch (error) {
                console.error(`Failed to initialize dropdown:`, error);
            }
        });
    } catch (error) {
        console.error('Failed to initialize dropdowns:', error);
    }
});

// Exportar clase correctamente
export default Dropdown;
