// Cache manager for DOM elements
const DOMCache = {
    _cache: new Map(),
    _maxSize: 100,
    _selectorSizes: new Map(),
    _observers: new Map(),
    _subscribers: new Map(),
    
    // Nuevo método para inicializar el observer
    _createObserver(selector) {
        if (typeof selector !== 'string') {
            throw new TypeError('selector debe ser una cadena');
        }

        // Limpiar observer existente si hay uno
        this._cleanupObserver(selector);

        const observer = new MutationObserver((mutations) => {
            if (!document.querySelector(selector)) {
                // Si el elemento ya no existe, limpiar el observer
                this._cleanupObserver(selector);
                return;
            }
            mutations.forEach((mutation) => {
                if (this._shouldInvalidateCache(mutation, selector)) {
                    this.invalidateCache(selector);
                    this._notifySubscribers(selector);
                }
            });
        });

        return observer;
    },

    // Evaluar si un cambio debe invalidar el caché
    _shouldInvalidateCache(mutation, selector) {
        try {
            // Verificar parámetros de entrada
            if (!mutation || !selector) {
                console.warn('Invalid parameters for cache invalidation check');
                return true; // Invalidar por seguridad
            }

            // Tipos de mutaciones a verificar
            switch (mutation.type) {
                case 'attributes':
                    // Verificar cambios en atributos críticos
                    if (mutation.target.matches(selector)) {
                        const attributeName = mutation.attributeName;
                        // Lista de atributos críticos que siempre invalidan el caché
                        const criticalAttributes = ['id', 'class', 'name', 'role', 'hidden', 'disabled'];
                        if (criticalAttributes.includes(attributeName)) {
                            return true;
                        }

                        // Verificar cambios en data-attributes
                        if (attributeName?.startsWith('data-')) {
                            return true;
                        }

                        // Verificar cambios en aria-attributes
                        if (attributeName?.startsWith('aria-')) {
                            return true;
                        }

                        // Verificar cambios en style que afecten visibilidad
                        if (attributeName === 'style') {
                            const oldValue = mutation.oldValue || '';
                            const newValue = mutation.target.getAttribute('style') || '';
                            const criticalStyles = ['display', 'visibility', 'opacity', 'position'];
                            return criticalStyles.some(style => 
                                oldValue.includes(style) || newValue.includes(style)
                            );
                        }
                    }
                    
                    // Verificar si el cambio afecta a elementos hijos que coincidan
                    return !!mutation.target.querySelector(selector);

                case 'childList':
                    // Verificar nodos agregados
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Verificar si el nodo agregado coincide
                            if (node.matches && node.matches(selector)) {
                                return true;
                            }
                            // Verificar si algún hijo del nodo agregado coincide
                            if (node.querySelector && node.querySelector(selector)) {
                                return true;
                            }
                        }
                    }

                    // Verificar nodos eliminados
                    for (const node of mutation.removedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Verificar si el nodo eliminado coincidía
                            if (node.matches && node.matches(selector)) {
                                return true;
                            }
                            // Verificar si algún hijo del nodo eliminado coincidía
                            if (node.querySelector && node.querySelector(selector)) {
                                return true;
                            }
                        }
                    }

                    // Verificar si el padre del cambio coincide o contiene elementos que coincidan
                    return mutation.target.matches(selector) || 
                           !!mutation.target.querySelector(selector);

                case 'characterData':
                    // Verificar cambios en el contenido de texto
                    const textNode = mutation.target;
                    const parentElement = textNode.parentElement;
                    
                    // Si el padre coincide con el selector o contiene elementos que coincidan
                    if (parentElement && (
                        parentElement.matches(selector) || 
                        parentElement.querySelector(selector)
                    )) {
                        // Verificar si el cambio de texto es significativo
                        const oldValue = mutation.oldValue || '';
                        const newValue = textNode.textContent || '';
                        return oldValue.trim() !== newValue.trim();
                    }
                    break;

                case 'subtree':
                    // Cambios profundos en el subárbol siempre invalidan para prevenir
                    return true;
            }

            return false;
        } catch (error) {
            console.error('Error evaluating DOM changes:', error);
            // En caso de error, invalidar el caché por seguridad
            return true;
        }
    },

    // Modificar el método get para incluir observación
    get(selector) {
        if (typeof selector !== 'string') {
            throw new TypeError('El selector debe ser una cadena');
        }

        try {
            if (!this._observers.has(selector)) {
                const observer = this._createObserver(selector);
                this._observers.set(selector, observer);
                
                // Observar el documento para cambios
                observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'id', 'style']
                });
            }

            if (!this._cache.has(selector)) {
                const element = document.querySelector(selector);
                if (element) {
                    if (!element.isConnected) {
                        return null;
                    }
                    this._cache.set(selector, element);
                }
            }

            return this._cache.get(selector);
        } catch (error) {
            console.error('Error accessing DOM cache:', error);
            return null;
        }
    },

    // Nuevo método para suscribirse a cambios
    subscribe(selector, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Callback debe ser una función');
        }

        if (!this._subscribers.has(selector)) {
            this._subscribers.set(selector, new Set());
        }
        
        this._subscribers.get(selector).add(callback);

        // Retornar función para desuscribirse
        return () => this.unsubscribe(selector, callback);
    },

    // Nuevo método para desuscribirse
    unsubscribe(selector, callback) {
        const subscribers = this._subscribers.get(selector);
        if (subscribers) {
            subscribers.delete(callback);
            
            // Limpiar si no hay más suscriptores
            if (subscribers.size === 0) {
                this._subscribers.delete(selector);
                this._cleanupObserver(selector);
            }
        }
    },

    // Nuevo método para notificar suscriptores
    _notifySubscribers(selector) {
        const subscribers = this._subscribers.get(selector);
        if (subscribers) {
            const element = this.get(selector);
            subscribers.forEach(callback => {
                try {
                    callback(element);
                } catch (error) {
                    console.error('Error in subscriber callback:', error);
                }
            });
        }
    },

    // Nuevo método para limpiar observers
    _cleanupObserver(selector) {
        const observer = this._observers.get(selector);
        if (observer) {
            observer.disconnect();
            this._observers.delete(selector);
        }
    },

    // Modificar clear para incluir limpieza de observers
    clear() {
        try {
            this._cache.clear();
            this._observers.forEach(observer => observer.disconnect());
            this._observers.clear();
            this._subscribers.clear();
            this._selectorSizes.clear();
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    },

    // Modificar clearSelector para incluir limpieza de observer
    clearSelector(selector) {
        this._cache.delete(selector);
        this._selectorSizes.delete(selector);
        this._cleanupObserver(selector);
        this._subscribers.delete(selector);
    },

    // Modificar invalidateCache
    invalidateCache(selector) {
        if (this._cache.has(selector)) {
            this._cache.delete(selector);
            // Intentar obtener el elemento nuevamente
            this.get(selector);
        }
    },

    getAll(selector) {
        if (typeof selector !== 'string') {
            throw new TypeError('El selector debe ser una cadena');
        }
        if (!this._cache.has(selector)) {
            const elements = [...document.querySelectorAll(selector)];
            if (elements.length) {
                this._cache.set(selector, elements);
            }
        }
        return this._cache.get(selector) || [];
    },
    
    clear() {
        this._cache.clear();
    },

    clearSelector(selector) {
        // Limpiar cache específico de un selector
        this._cache.delete(selector);
        this._selectorSizes.delete(selector);
    },

    addEventListenerWithTracking(element, type, handler) {
        if (!(element instanceof EventTarget)) {
            throw new TypeError('element debe ser una instancia de EventTarget');
        }
        if (!document.body.contains(element)) {
            throw new Error('Element is not attached to the DOM');
        }
        element.addEventListener(type, handler);
    }
};

// Agregar constante para configuración de validación
const VALIDATION_CONFIG = {
    MAX_NODELIST_SIZE: 1000,
    ALLOWED_NODE_TYPES: [Node.ELEMENT_NODE],
    REQUIRED_ATTRIBUTES: ['id', 'role'],
    MAX_DEPTH: 10
};

// Reemplazar la función validateNodeList actual
const validateNodeList = (nodeList, context = '') => {
    // Validar parámetros de entrada
    if (!nodeList) {
        throw new TypeError(`${context}: NodeList es null o undefined`);
    }

    // Validar que sea una NodeList o HTMLCollection válida
    if (!(nodeList instanceof NodeList) && !(nodeList instanceof HTMLCollection)) {
        throw new TypeError(`${context}: El elemento debe ser una NodeList o HTMLCollection válida`);
    }

    // Validar tamaño máximo
    if (nodeList.length > VALIDATION_CONFIG.MAX_NODELIST_SIZE) {
        throw new RangeError(`${context}: NodeList excede el tamaño máximo de ${VALIDATION_CONFIG.MAX_NODELIST_SIZE} elementos`);
    }

    // Validar que no esté vacía
    if (nodeList.length === 0) {
        throw new Error(`${context}: NodeList está vacía`);
    }

    // Validar cada elemento
    return Array.from(nodeList).map((node, index) => {
        const itemContext = `${context}[${index}]`;

        // Validar que el nodo exista
        if (!node) {
            throw new Error(`${itemContext}: Elemento es null o undefined`);
        }

        // Validar tipo de nodo
        if (!VALIDATION_CONFIG.ALLOWED_NODE_TYPES.includes(node.nodeType)) {
            throw new TypeError(
                `${itemContext}: Tipo de nodo inválido ${node.nodeType}. ` +
                `Permitidos: ${VALIDATION_CONFIG.ALLOWED_NODE_TYPES.join(', ')}`
            );
        }

        // Validar que sea un HTMLElement
        if (!(node instanceof HTMLElement)) {
            throw new TypeError(`${itemContext}: El elemento debe ser una instancia de HTMLElement`);
        }

        // Validar que el elemento esté en el DOM
        if (!document.body.contains(node)) {
            throw new Error(`${itemContext}: El elemento no está conectado al DOM`);
        }

        // Validar atributos requeridos
        VALIDATION_CONFIG.REQUIRED_ATTRIBUTES.forEach(attr => {
            if (!node.hasAttribute(attr)) {
                throw new Error(`${itemContext}: Falta el atributo requerido "${attr}"`);
            }
        });

        // Validar profundidad del elemento
        let depth = 0;
        let parent = node.parentElement;
        while (parent && depth < VALIDATION_CONFIG.MAX_DEPTH) {
            parent = parent.parentElement;
            depth++;
        }
        if (depth >= VALIDATION_CONFIG.MAX_DEPTH) {
            throw new Error(`${itemContext}: El elemento excede la profundidad máxima de ${VALIDATION_CONFIG.MAX_DEPTH}`);
        }

        // Validar IDs únicos si el elemento tiene ID
        if (node.id) {
            const duplicates = document.querySelectorAll(`#${node.id}`);
            if (duplicates.length > 1) {
                throw new Error(`${itemContext}: ID duplicado encontrado: ${node.id}`);
            }
        }

        return node;
    });
};

// Batch DOM updates manager
const BatchDOM = {
    updates: new Map(),
    scheduled: false,
    
    // Agregar configuración de límites
    limits: {
        maxUpdatesPerElement: 100,    // Máximo de actualizaciones por elemento
        maxTotalUpdates: 1000,        // Máximo total de actualizaciones en cola
        maxBatchSize: 50,             // Máximo de actualizaciones por lote
        oldestUpdateAge: 30000        // 30 segundos máximo de antigüedad
    },

    // Agregar tracking de métricas
    metrics: {
        totalUpdates: 0,
        droppedUpdates: 0,
        lastCleanup: Date.now()
    },

    schedule(element, updates) {
        if (!(element instanceof HTMLElement)) {
            throw new TypeError('element debe ser una instancia de HTMLElement');
        }
        if (typeof updates !== 'function') {
            throw new TypeError('updates debe ser una función');
        }

        // Verificar límites por elemento
        const elementUpdates = this.updates.get(element) || [];
        if (elementUpdates.length >= this.limits.maxUpdatesPerElement) {
            console.warn(`Exceeded max updates per element (${this.limits.maxUpdatesPerElement}), dropping oldest`);
            elementUpdates.shift(); // Eliminar la actualización más antigua
            this.metrics.droppedUpdates++;
        }

        // Verificar límite total de actualizaciones
        let totalUpdates = 0;
        this.updates.forEach(updates => totalUpdates += updates.length);
        
        if (totalUpdates >= this.limits.maxTotalUpdates) {
            this.cleanOldUpdates();
            // Verificar de nuevo después de limpieza
            totalUpdates = Array.from(this.updates.values()).reduce((sum, arr) => sum + arr.length, 0);
            if (totalUpdates >= this.limits.maxTotalUpdates) {
                console.warn(`Exceeded max total updates (${this.limits.maxTotalUpdates}), dropping update`);
                this.metrics.droppedUpdates++;
                return;
            }
        }

        // Agregar timestamp a la actualización
        const updateWithTimestamp = {
            fn: updates,
            timestamp: Date.now()
        };

        if (!this.updates.has(element)) {
            this.updates.set(element, []);
        }
        this.updates.get(element).push(updateWithTimestamp);
        this.metrics.totalUpdates++;

        if (!this.scheduled) {
            this.scheduled = true;
            requestAnimationFrame(() => this.flush());
        }
    },

    cleanOldUpdates() {
        const now = Date.now();
        this.metrics.lastCleanup = now;
        
        this.updates.forEach((updates, element) => {
            // Filtrar actualizaciones antiguas
            const validUpdates = updates.filter(update => 
                now - update.timestamp < this.limits.oldestUpdateAge
            );
            
            if (validUpdates.length < updates.length) {
                this.metrics.droppedUpdates += updates.length - validUpdates.length;
                this.updates.set(element, validUpdates);
            }
        });

        // Eliminar elementos sin actualizaciones
        for (const [element, updates] of this.updates.entries()) {
            if (updates.length === 0) {
                this.updates.delete(element);
            }
        }
    },

    flush() {
        const errors = [];
        let processedCount = 0;
        
        try {
            this.updates.forEach((updates, element) => {
                if (!element.isConnected) {
                    this.updates.delete(element);
                    return;
                }

                const fragment = document.createDocumentFragment();
                const batchUpdates = updates.slice(0, this.limits.maxBatchSize);

                batchUpdates.forEach(update => {
                    try {
                        update.fn(fragment);
                        processedCount++;
                    } catch (error) {
                        errors.push(error);
                        console.error('Update error:', error);
                    }
                });

                try {
                    element.appendChild(fragment);
                    // Eliminar actualizaciones procesadas
                    this.updates.set(element, updates.slice(this.limits.maxBatchSize));
                } catch (error) {
                    errors.push(error);
                    console.error('DOM append error:', error);
                }
            });
        } catch (error) {
            errors.push(error);
            console.error('Batch processing error:', error);
        } finally {
            this.scheduled = false;

            // Si quedan actualizaciones, programar siguiente flush
            if (this.hasPendingUpdates()) {
                requestAnimationFrame(() => this.flush());
            }
        }

        // Actualizar métricas
        this.metrics.totalUpdates -= processedCount;

        if (errors.length > 0) {
            throw new AggregateError(errors, 'Batch update failed');
        }
    },

    hasPendingUpdates() {
        return Array.from(this.updates.values()).some(updates => updates.length > 0);
    },

    // Método para obtener métricas actuales
    getMetrics() {
        return {
            ...this.metrics,
            pendingUpdates: Array.from(this.updates.values())
                .reduce((sum, arr) => sum + arr.length, 0),
            elementCount: this.updates.size
        };
    },

    // Método para limpiar todo
    clear() {
        this.updates.clear();
        this.scheduled = false;
        this.metrics.totalUpdates = 0;
        this.metrics.droppedUpdates = 0;
        this.metrics.lastCleanup = Date.now();
    }
};

// Virtual DOM implementation for UI updates
const VirtualDOM = {
    // Agregar mapa de refs
    _refs: new WeakMap(),
    
    // Método para obtener elemento por ref
    getRef(ref) {
        return this._refs.get(ref);
    },

    // Método para limpiar ref
    clearRef(ref) {
        this._refs.delete(ref);
    },

    // Constantes para validación
    VALID_HTML_TAGS: new Set([
        'div', 'span', 'p', 'a', 'button', 'input', 'form', 'label',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'ul', 'ol', 'li',
        'table', 'tr', 'td', 'th', 'thead', 'tbody', 'select', 'option',
        'textarea', 'nav', 'header', 'footer', 'main', 'section', 'article'
    ]),

    VALID_ARIA_ATTRIBUTES: new Set([
        'aria-label', 'aria-describedby', 'aria-hidden', 'aria-expanded',
        'aria-haspopup', 'aria-controls', 'aria-pressed', 'aria-current',
        'role', 'aria-selected', 'aria-required', 'aria-invalid'
    ]),

    VALID_EVENT_HANDLERS: new Set([
        'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onKeyUp',
        'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave',
        'onTouchStart', 'onTouchEnd'
    ]),

    createElement(type, props = {}, ...children) {
        // Validar tipo
        if (typeof type !== 'string') {
            throw new TypeError('El tipo debe ser una cadena');
        }

        if (!this.VALID_HTML_TAGS.has(type.toLowerCase())) {
            throw new Error(`Tag HTML no válido: ${type}`);
        }

        // Validar props
        if (props !== null && typeof props !== 'object') {
            throw new TypeError('props debe ser un objeto o null');
        }

        // Extraer y validar ref
        const { ref, className, style, ...restProps } = props || {};

        // Validar ref
        if (ref !== undefined && ref !== null && typeof ref !== 'object') {
            throw new TypeError('ref debe ser un objeto o null');
        }

        // Validar className
        if (className !== undefined && typeof className !== 'string') {
            throw new TypeError('className debe ser una cadena');
        }

        // Validar style
        if (style !== undefined) {
            if (typeof style !== 'object' || Array.isArray(style)) {
                throw new TypeError('style debe ser un objeto');
            }
            // Validar propiedades CSS válidas
            Object.keys(style).forEach(key => {
                if (!/^[a-zA-Z]+[a-zA-Z0-9]*$/.test(key)) {
                    throw new Error(`Propiedad CSS inválida: ${key}`);
                }
            });
        }

        // Validar eventos
        Object.keys(restProps).forEach(key => {
            if (key.startsWith('on')) {
                if (!this.VALID_EVENT_HANDLERS.has(key)) {
                    throw new Error(`Evento no soportado: ${key}`);
                }
                if (typeof restProps[key] !== 'function') {
                    throw new TypeError(`Handler para ${key} debe ser una función`);
                }
            }
        });

        // Validar atributos ARIA
        Object.keys(restProps).forEach(key => {
            if (key.startsWith('aria-') || key === 'role') {
                if (!this.VALID_ARIA_ATTRIBUTES.has(key)) {
                    throw new Error(`Atributo ARIA no válido: ${key}`);
                }
                if (typeof restProps[key] !== 'string') {
                    throw new TypeError(`Valor de ${key} debe ser una cadena`);
                }
            }
        });

        // Validar y sanitizar children
        const sanitizedChildren = children.flat(Infinity).map(child => {
            if (child === null || child === undefined) {
                return '';
            }
            if (typeof child === 'boolean') {
                return '';
            }
            if (typeof child === 'number' || typeof child === 'string') {
                return child.toString();
            }
            if (typeof child === 'object' && 'type' in child) {
                return child;
            }
            throw new TypeError(
                `Hijo inválido: ${typeof child}. ` +
                'Los hijos deben ser string, number, null, undefined o elementos virtuales'
            );
        });

        // Validar profundidad máxima de children
        const validateChildrenDepth = (children, depth = 0) => {
            const MAX_DEPTH = 32;
            if (depth > MAX_DEPTH) {
                throw new Error(`Profundidad máxima de children excedida (${MAX_DEPTH})`);
            }
            children.forEach(child => {
                if (child && typeof child === 'object' && 'children' in child) {
                    validateChildrenDepth(child.children, depth + 1);
                }
            });
        };
        validateChildrenDepth(sanitizedChildren);

        // Sanitizar props finales
        const sanitizedProps = {
            ...restProps,
            ...(className ? { className } : {}),
            ...(style ? { style } : {})
        };

        // Validar tamaño total del elemento
        const elementSize = JSON.stringify({ type, props: sanitizedProps, children: sanitizedChildren }).length;
        if (elementSize > 100000) { // 100KB límite
            throw new Error('Elemento demasiado grande');
        }

        return {
            type,
            props: sanitizedProps,
            children: sanitizedChildren,
            ref: ref || null,
            key: props.key || null
        };
    },

    // Modificar render para manejar refs
    render(node) {
        if (!node) return document.createTextNode('');
        
        if (typeof node === 'string' || typeof node === 'number') {
            return document.createTextNode(node.toString());
        }

        const element = document.createElement(node.type);

        // Manejar ref si existe
        if (node.ref) {
            this._refs.set(node.ref, element);
        }

        // Set properties
        if (node.props && typeof node.props === 'object') {
            Object.entries(node.props).forEach(([name, value]) => {
                if (name.startsWith('on')) {
                    const eventName = name.toLowerCase().substring(2);
                    element.addEventListener(eventName, value);
                } else if (name === 'className') {
                    element.setAttribute('class', value);
                } else if (name === 'style' && typeof value === 'object') {
                    Object.entries(value).forEach(([prop, val]) => {
                        element.style[prop] = val;
                    });
                } else {
                    element[name] = value;
                }
            });
        }

        // Render children
        if (node.children) {
            node.children.forEach(child => {
                const childElement = this.render(child);
                if (childElement) {
                    element.appendChild(childElement);
                }
            });
        }

        return element;
    },

    patch(parent, patches, index = 0) {
        if (!patches) return;

        if (!parent.$currentElement) {
            parent.$currentElement = parent.firstElementChild;
        }

        const currentElement = parent.$currentElement;

        switch (patches.type) {
            case 'CREATE': {
                const newElement = this.render(patches.newNode);
                parent.appendChild(newElement);
                break;
            }
            case 'REMOVE': {
                if (currentElement) {
                    // Limpiar refs antes de remover
                    this.cleanupRefs(currentElement);
                    parent.removeChild(currentElement);
                }
                break;
            }
            case 'REPLACE': {
                const newElement = this.render(patches.newNode);
                if (currentElement) {
                    // Limpiar refs antes de reemplazar
                    this.cleanupRefs(currentElement);
                    parent.replaceChild(newElement, currentElement);
                } else {
                    parent.appendChild(newElement);
                }
                break;
            }
            case 'UPDATE': {
                const element = currentElement;
                // Actualizar ref si cambió
                if (patches.newNode && patches.newNode.ref) {
                    this._refs.set(patches.newNode.ref, element);
                }
                
                Object.keys(patches.props).forEach(key => {
                    element[key] = patches.props[key];
                });
                patches.children.forEach((childPatch, i) => {
                    this.patch(element, childPatch, i);
                });
                break;
            }
        }
    },

    // Nuevo método para limpiar refs recursivamente
    cleanupRefs(element) {
        // Buscar y limpiar ref del elemento actual
        for (const [ref, el] of this._refs) {
            if (el === element) {
                this._refs.delete(ref);
                break;
            }
        }

        // Limpiar refs de hijos recursivamente
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
            this.cleanupRefs(children[i]);
        }
    },

    // Nuevo método para validar refs
    validateRef(ref) {
        if (ref !== null && typeof ref !== 'object') {
            throw new TypeError('ref debe ser un objeto o null');
        }
        return true;
    }
};

// Optimized event delegation
const EventDelegate = {
    handlers: new Map(),
    metrics: {
        totalHandlers: 0,
        orphanedHandlers: 0,
        lastCleanup: Date.now()
    },
    
    // Configuración de limpieza
    cleanupConfig: {
        interval: 5 * 60 * 1000, // 5 minutos
        maxAge: 30 * 60 * 1000,  // 30 minutos
        inactiveThreshold: 15 * 60 * 1000 // 15 minutos
    },

    _cleanupInterval: null,

    startCleanup() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        
        this._cleanupInterval = setInterval(() => {
            this.cleanupOrphanedHandlers();
        }, this.cleanupConfig.interval);
    },

    stopCleanup() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
    },

    isValidSelector(selector) {
        try {
            document.querySelector(selector);
            return true;
        } catch (e) {
            return false;
        }
    },

    on(eventType, selector, handler) {
        if (typeof selector !== 'string' || !this.isValidSelector(selector)) {
            throw new TypeError('El selector proporcionado no es válido');
        }
        if (typeof handler !== 'function') {
            throw new TypeError('El handler debe ser una función');
        }
        
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Map());
            document.addEventListener(eventType, this.handleEvent.bind(this), true);
        }

        // Agregar metadata al handler
        const handlerData = {
            fn: handler,
            selector,
            lastUsed: Date.now(),
            useCount: 0,
            errorCount: 0
        };

        this.handlers.get(eventType).set(selector, handlerData);
        this.metrics.totalHandlers++;

        // Iniciar limpieza si no está activa
        if (!this._cleanupInterval) {
            this.startCleanup();
        }

        // Retornar función para eliminar handler
        return () => this.off(eventType, selector);
    },

    off(eventType, selector) {
        const eventHandlers = this.handlers.get(eventType);
        if (eventHandlers) {
            if (eventHandlers.delete(selector)) {
                this.metrics.totalHandlers--;
            }
            if (eventHandlers.size === 0) {
                this.handlers.delete(eventType);
                document.removeEventListener(eventType, this.handleEvent, true);
            }
        }
    },

    handleEvent(event) {
        const eventHandlers = this.handlers.get(event.type);
        if (!eventHandlers) return;

        eventHandlers.forEach((handlerData, selector) => {
            try {
                const targets = document.querySelectorAll(selector);
                const target = event.target.closest(selector);

                // Verificar si el selector aún encuentra elementos
                if (targets.length === 0) {
                    handlerData.orphaned = true;
                    return;
                }

                if (target) {
                    // Actualizar métricas del handler
                    handlerData.lastUsed = Date.now();
                    handlerData.useCount++;
                    handlerData.orphaned = false;

                    // Ejecutar handler
                    handlerData.fn.call(target, event, target);
                }
            } catch (error) {
                console.error('Error in event handler:', error);
                handlerData.errorCount++;
                
                // Marcar para limpieza si hay demasiados errores
                if (handlerData.errorCount > 3) {
                    handlerData.orphaned = true;
                }
            }
        });
    },

    cleanupOrphanedHandlers() {
        const now = Date.now();
        let cleanedCount = 0;

        this.handlers.forEach((eventHandlers, eventType) => {
            eventHandlers.forEach((handlerData, selector) => {
                const shouldClean = 
                    // Handler marcado como huérfano
                    handlerData.orphaned ||
                    // No se ha usado en mucho tiempo
                    (now - handlerData.lastUsed > this.cleanupConfig.maxAge) ||
                    // Tiene demasiados errores
                    handlerData.errorCount > 3 ||
                    // El selector ya no encuentra elementos
                    document.querySelectorAll(selector).length === 0;

                if (shouldClean) {
                    this.off(eventType, selector);
                    cleanedCount++;
                    this.metrics.orphanedHandlers++;
                }
            });
        });

        if (cleanedCount > 0) {
            console.info(`Cleaned up ${cleanedCount} orphaned handlers`);
        }

        this.metrics.lastCleanup = now;

        // Detener interval si no hay más handlers
        if (this.metrics.totalHandlers === 0) {
            this.stopCleanup();
        }
    },

    getMetrics() {
        const now = Date.now();
        let activeHandlers = 0;
        let inactiveHandlers = 0;

        this.handlers.forEach(eventHandlers => {
            eventHandlers.forEach(handlerData => {
                if (now - handlerData.lastUsed > this.cleanupConfig.inactiveThreshold) {
                    inactiveHandlers++;
                } else {
                    activeHandlers++;
                }
            });
        });

        return {
            ...this.metrics,
            activeHandlers,
            inactiveHandlers,
            timeSinceLastCleanup: now - this.metrics.lastCleanup
        };
    },

    dispose() {
        // Limpiar todos los handlers
        this.handlers.forEach((eventHandlers, eventType) => {
            eventHandlers.forEach((_, selector) => {
                this.off(eventType, selector);
            });
        });

        // Detener limpieza automática
        this.stopCleanup();

        // Resetear métricas
        this.metrics = {
            totalHandlers: 0,
            orphanedHandlers: 0,
            lastCleanup: Date.now()
        };
    }
};

// Add navigation handlers
const tabListeners = new Map(); // Track tab-specific listeners

const handleNavClick = (event, target) => {
    if (!target || !target.dataset.tab) return;
    
    const tabId = target.dataset.tab;
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');
    
    // Cleanup old listeners before removing active classes
    contents.forEach(content => {
        const listeners = tabListeners.get(content);
        if (listeners) {
            listeners.forEach(({type, fn}) => content.removeEventListener(type, fn));
            tabListeners.delete(content);
        }
    });
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    target.classList.add('active');
    const content = document.getElementById(`${tabId}Tab`);
    if (content) {
        content.classList.add('active');
        // Register new content listeners if needed
        const contentListeners = setupTabContentListeners(content);
        if (contentListeners.length > 0) {
            tabListeners.set(content, contentListeners);
        }
    }
};

const setupTabContentListeners = (content) => {
    const listeners = [];
    // Add any tab-specific listeners here
    // Example:
    // const listener = {type: 'click', fn: (e) => handleTabContentClick(e)};
    // content.addEventListener(listener.type, listener.fn);
    // listeners.push(listener);
    return listeners;
};

const handleDropdownClick = (event, target) => {
    const action = target.dataset.action;
    if (!action) return;
    
    // Handle dropdown actions
    switch (action) {
        case 'new-analysis':
            document.getElementById('queryForm')?.reset();
            break;
        case 'history':
            // Handle history action
            break;
        case 'settings':
            // Handle settings action
            break;
    }
};

// Remove this event listener - it will be handled in app.js
// document.addEventListener('DOMContentLoaded', () => {
//     EventDelegate.on('click', '.nav-item', handleNavClick);
//     EventDelegate.on('click', '.dropdown-item', handleDropdownClick);
    
//     // Cache frequently accessed elements
//     elements = {
//         form: DOMCache.get('#queryForm'),
//         input: DOMCache.get('#queryInput'),
//         responseContainer: DOMCache.get('#responseContainer'),
//     };
// });

export { DOMCache, BatchDOM, VirtualDOM, EventDelegate, tabListeners };