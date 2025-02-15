// Define instances outside the object
const instances = new WeakSet();

// Constants for cache configuration
const CACHE_CONFIG = {
    RETENTION: {
        MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,    // 7 days
        UNUSED_AGE_MS: 3 * 24 * 60 * 60 * 1000, // 3 days without use
        CLEANUP_INTERVAL_MS: 12 * 60 * 60 * 1000, // Every 12 hours
        USAGE_THRESHOLD: 0.8,                    // 80% of space used
        BATCH_SIZE: 50,                          // Items per batch
        CRITICAL_THRESHOLD: 0.9                  // 90% is critical
    },
    RETRY: {
        MAX_RETRY_ATTEMPTS: 3,
        BASE_RETRY_DELAY: 100, // 100ms
        MAX_RETRY_DELAY: 1000, // 1 second
        COMPRESSION_TIMEOUT: 2000 // 2 seconds
    },
    LIMITS: {
        KEY_MAX_LENGTH: 128,          // Maximum key length
        KEY_MIN_LENGTH: 1,            // Minimum key length
        VALUE_MAX_SIZE: 512 * 1024,   // 512KB per individual value
        TOTAL_QUOTA: 5 * 1024 * 1024, // 5MB total
        KEY_PREFIX_MAX: 32,           // Maximum prefix length
        STORAGE_WARNING_THRESHOLD: 0.8 // Warning at 80% usage
    }
};

class CacheService {
    constructor() {
        // Falta validar disponibilidad de localStorage
        if (!window.localStorage) {
            throw new Error('localStorage is not available');
        }
        this.storage = window.localStorage;
        this.prefix = 'app_';
        this.cleanupInterval = null;
        this.maxValueSize = 512 * 1024; // 512KB default
        
        // Use configuration from CACHE_CONFIG
        this.limits = CACHE_CONFIG.LIMITS;
        this.retryConfig = CACHE_CONFIG.RETRY;
        this.retentionConfig = CACHE_CONFIG.RETENTION;

        // Register instance for global cleanup
        instances.add(this);
        
        // Add version handling
        this.VERSION = '1.0.0';
        this.CACHE_VERSION_KEY = 'app_cache_version';
        this.migrations = new Map([
            ['1.0.0', this.migrateTo100.bind(this)]
        ]);

        // Cleanup metrics
        this.cleanupMetrics = {
            lastCleanup: null,
            itemsRemoved: 0,
            spaceRecovered: 0,
            cleanupAttempts: 0,
            errors: []
        };

        // Initialize with version check
        this.initialize();
        
        // Register cleanup on unload
        window.addEventListener('unload', () => this.dispose());
    }

    initialize() {
        try {
            const currentVersion = this.storage.getItem(this.CACHE_VERSION_KEY);
            
            if (!currentVersion) {
                // First installation
                this.storage.setItem(this.CACHE_VERSION_KEY, this.VERSION);
            } else if (currentVersion !== this.VERSION) {
                // Needs migration
                this.migrateCache(currentVersion, this.VERSION);
            }

            // Stop any existing cleanup before starting new one
            this.stopPeriodicCleanup();
            this.startPeriodicCleanup();

        } catch (error) {
            console.error('Cache initialization failed:', error);
            // Try recovery by clearing cache
            this.clear();
            this.storage.setItem(this.CACHE_VERSION_KEY, this.VERSION);
        }
    }

    dispose() {
        try {
            // Clear intervals
            this.stopPeriodicCleanup();
            
            // Clear in-memory data
            this.clearMemoryCache();
            
            // Remove instance from global registry
            instances.delete(this);
            
            // Clear references
            this.storage = null;
            this.cleanupInterval = null;
        } catch (error) {
            console.error('Error during cache disposal:', error);
        }
    }

    clearMemoryCache() {
        // Clear any accumulated in-memory cache
        try {
            this._memoryCache?.clear();
        } catch (error) {
            console.warn('Error clearing memory cache:', error);
        }
    }

    async retryOperation(operation, context = '') {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryConfig.MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return await Promise.race([
                    operation(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timeout')), 
                        this.retryConfig.COMPRESSION_TIMEOUT)
                    )
                ]);
            } catch (error) {
                lastError = error;
                console.warn(`${context} attempt ${attempt} failed:`, error);

                if (attempt === this.retryConfig.MAX_RETRY_ATTEMPTS) break;

                // Calculate delay with exponential backoff and jitter
                const delay = Math.min(
                    this.retryConfig.BASE_RETRY_DELAY * Math.pow(2, attempt - 1) + 
                    Math.random() * this.retryConfig.BASE_RETRY_DELAY,
                    this.retryConfig.MAX_RETRY_DELAY
                );
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw new Error(`All ${this.retryConfig.MAX_RETRY_ATTEMPTS} retry attempts failed: ${lastError.message}`);
    }

    async compress(value) {
        if (value === null || value === undefined) {
            throw new TypeError('Cannot compress null or undefined');
        }

        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        const valueSize = new Blob([stringValue]).size;

        if (valueSize > this.limits.VALUE_MAX_SIZE) {
            throw new Error(`Value size (${valueSize} bytes) exceeds limit (${this.limits.VALUE_MAX_SIZE} bytes)`);
        }

        return this.retryOperation(async () => {
            try {
                const compressed = LZString.compress(stringValue);
                if (!compressed) {
                    throw new Error('Compression failed');
                }
                
                const compressedSize = new Blob([compressed]).size;
                if (compressedSize > valueSize) {
                    // Si la compresión resulta en un tamaño mayor, usar valor original
                    return stringValue;
                }
                
                return compressed;
            } catch (error) {
                throw new Error(`Compression failed: ${error.message}`);
            }
        }, 'Compression');
    }

    async decompress(compressed) {
        if (!compressed || typeof compressed !== 'string') {
            return null;
        }

        return this.retryOperation(async () => {
            const decompressed = LZString.decompress(compressed);
            if (!decompressed) {
                throw new Error('Decompression failed');
            }

            try {
                return JSON.parse(decompressed);
            } catch (error) {
                throw new Error(`Failed to parse decompressed data: ${error.message}`);
            }
        }, 'Decompression');
    }

    /**
     * Calculates the space used in localStorage
     * @returns {number} Bytes used
     */
    getUsedSpace() {
        try {
            let totalSize = 0;
            for (let key in this.storage) {
                if (this.storage.hasOwnProperty(key)) {
                    totalSize += (this.storage[key].length + key.length) * 2; // Approximation in bytes
                }
            }
            return totalSize;
        } catch (error) {
            console.error('Error calculating storage size:', error);
            return 0;
        }
    }

    /**
     * Checks if there is enough space to store data
     * @param {string} value Value to store
     * @returns {boolean}
     */
    hasEnoughSpace(value) {
        try {
            const availableSpace = 5 * 1024 * 1024; // 5MB typical limit
            const valueSize = (JSON.stringify(value).length * 2); // Approximation in bytes
            const usedSpace = this.getUsedSpace();
            
            return (usedSpace + valueSize) <= availableSpace;
        } catch (error) {
            console.error('Error checking available space:', error);
            return false;
        }
    }

    async set(key, value, ttl = null) {
        try {
            // Validate parameters
            this.validateKey(key);
            this.validateValue(value);
            
            if (ttl !== null) {
                if (!Number.isFinite(ttl) || ttl < 0) {
                    throw new TypeError('TTL must be a positive number or null');
                }
            }

            // Validate size before compressing
            const valueSize = this.validateValueSize(value, key);
            
            // Determine if compression is needed based on size
            const shouldCompress = valueSize > 1024;
            const processedValue = shouldCompress ? await this.compress(value) : value;

            const item = {
                value: processedValue,
                compressed: shouldCompress,
                timestamp: Date.now(),
                ttl,
                schemaVersion: this.VERSION // Add schema version
            };

            const serializedItem = JSON.stringify(item);

            // Check space before storing
            if (!this.hasEnoughSpace(serializedItem)) {
                // Try to free up space
                const spaceFreed = this.freeUpSpace();
                if (!spaceFreed || !this.hasEnoughSpace(serializedItem)) {
                    throw new Error('Insufficient storage space');
                }
            }

            try {
                this.storage.setItem(this.prefix + key, serializedItem);
            } catch (e) {
                if (this.isQuotaExceeded(e)) {
                    // Try space freeing strategies
                    if (!this.handleStorageFull(key, serializedItem)) {
                        throw new Error('Storage quota exceeded and cleanup failed');
                    }
                } else {
                    throw e;
                }
            }
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            // Record storage error metrics
            this.recordStorageMetrics(error);
            return false;
        }
    }

    isQuotaExceeded(error) {
        return error.name === 'QuotaExceededError' ||
               error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
               error.code === 22;
    }

    async get(key) {
        try {
            this.validateKey(key);
            
            const raw = this.storage.getItem(this.prefix + key);
            if (raw === null) return null;

            let item;
            try {
                item = JSON.parse(raw);
                // Update last access
                item.lastAccess = Date.now();
                this.storage.setItem(this.prefix + key, JSON.stringify(item));
            } catch {
                // If JSON is invalid, remove the entry
                this.remove(key);
                return null;
            }

            // Validate item structure
            if (!this.isValidItem(item)) {
                this.remove(key);
                return null;
            }

            // Check schema version
            if (item.schemaVersion && item.schemaVersion !== this.VERSION) {
                // If item has a different version, force update
                this.remove(key);
                return null;
            }

            if (item.ttl && Date.now() - item.timestamp > item.ttl) {
                this.remove(key);
                return null;
            }

            const value = item.compressed ? await this.decompress(item.value) : item.value;
            
            // Validate value after decompress
            if (value === null || value === undefined) {
                this.remove(key);
                return null;
            }

            return value;

        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    remove(key) {
        try {
            this.validateKey(key);
            this.storage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Cache remove error:', error);
            return false;
        }
    }

    clear() {
        Object.keys(this.storage)
            .filter(key => key.startsWith(this.prefix))
            .forEach(key => this.storage.removeItem(key));
    }

    clearOldest() {
        const items = Object.keys(this.storage)
            .filter(key => key.startsWith(this.prefix))
            .map(key => ({
                key,
                timestamp: JSON.parse(this.storage.getItem(key)).timestamp
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        // Remove the oldest 20% of items
        const itemsToRemove = Math.ceil(items.length * 0.2);
        items.slice(0, itemsToRemove).forEach(item => {
            this.storage.removeItem(item.key);
        });
    }

    clearExpired() {
        const now = Date.now();
        Object.keys(this.storage)
            .filter(key => key.startsWith(this.prefix))
            .forEach(key => {
                try {
                    const item = JSON.parse(this.storage.getItem(key));
                    if (item.ttl && now - item.timestamp > item.ttl) {
                        this.storage.removeItem(key);
                    }
                } catch (error) {
                    console.error('Error clearing expired item:', error);
                }
            });
    }

    startPeriodicCleanup(intervalMinutes = 30) {
        // Ensure any existing interval is cleared
        this.stopPeriodicCleanup();

        // Convert minutes to milliseconds for interval
        const interval = Math.min(
            intervalMinutes * 60 * 1000,
            this.retentionConfig.CLEANUP_INTERVAL_MS
        );

        // Use WeakRef for garbage collection
        const weakThis = new WeakRef(this);
        
        this.cleanupInterval = setInterval(() => {
            const instance = weakThis.deref();
            if (!instance) {
                // Instance was garbage collected, clear interval
                clearInterval(this.cleanupInterval);
                return;
            }

            try {
                instance.clearExpired();
            } catch (error) {
                console.error('Error in periodic cleanup:', error);
                // Stop interval if there's a serious error
                instance.stopPeriodicCleanup();
            }
        }, interval);

        // Register interval for global cleanup
        if (!window._cacheIntervals) {
            window._cacheIntervals = new Set();
        }
        window._cacheIntervals.add(this.cleanupInterval);

        // Add old cache cleanup
        const cleanupInterval = setInterval(async () => {
            const instance = this;
            if (!instance) return;

            try {
                const stats = instance.getStorageStats();
                if (!stats) return;

                // Check if we need cleanup
                const needsCleanup = 
                    !this.cleanupMetrics.lastCleanup ||
                    (Date.now() - this.cleanupMetrics.lastCleanup > this.retentionConfig.CLEANUP_INTERVAL_MS) ||
                    (stats.usagePercentage > this.retentionConfig.USAGE_THRESHOLD * 100);

                if (needsCleanup) {
                    await instance.performStorageCleanup();
                }
            } catch (error) {
                console.error('Error in periodic cleanup:', error);
            }
        }, this.retentionConfig.CLEANUP_INTERVAL_MS);

        // Register for global cleanup
        if (!window._cacheCleanupIntervals) {
            window._cacheCleanupIntervals = new Set();
        }
        window._cacheCleanupIntervals.add(cleanupInterval);
    }

    stopPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            // Remove from global registry
            window._cacheIntervals?.delete(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    setMaxValueSize(bytes) {
        this.maxValueSize = bytes;
    }

    /**
     * Handles the situation of full storage
     * @returns {boolean} True if space was freed
     */
    handleStorageFull(key, value) {
        try {
            // Intentar liberar espacio primero
            this.cleanupExpired();
            this.freeUpSpace();
            
            // Verificar espacio después de limpieza
            if (!this.hasEnoughSpace(value)) {
                this.handleEmergencyCleanup();
                if (!this.hasEnoughSpace(value)) {
                    return false;
                }
            }
            
            // Intentar guardar de nuevo
            this.storage.setItem(key, value);
            return true;
        } catch (error) {
            if (this.isQuotaExceeded(error)) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Frees up space by removing less important items
     * @returns {boolean} True if space was freed
     */
    freeUpSpace() {
        try {
            const items = this.getAllItems();
            
            // Sort by priority and age
            items.sort((a, b) => {
                // Prioritize keeping recent and non-expired items
                const aAge = Date.now() - a.timestamp;
                const bAge = Date.now() - b.timestamp;
                
                // If one is expired and the other is not
                const aExpired = a.ttl && (aAge > a.ttl);
                const bExpired = b.ttl && (bAge > b.ttl);
                if (aExpired !== bExpired) return aExpired ? -1 : 1;
                
                // Sort by age
                return bAge - aAge;
            });

            // Remove the oldest 20% of items
            const itemsToRemove = Math.ceil(items.length * 0.2);
            let removedCount = 0;

            for (let i = 0; i < itemsToRemove && i < items.length; i++) {
                try {
                    this.storage.removeItem(this.prefix + items[i].key);
                    removedCount++;
                } catch (e) {
                    console.warn('Error removing item:', e);
                }
            }

            return removedCount > 0;

        } catch (error) {
            console.error('Error freeing up space:', error);
            return false;
        }
    }

    /**
     * Gets all stored items
     * @returns {Array} Array of items with metadata
     */
    getAllItems() {
        const items = [];
        try {
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key?.startsWith(this.prefix)) {
                    const value = JSON.parse(this.storage.getItem(key));
                    items.push({
                        key: key.slice(this.prefix.length),
                        ...value
                    });
                }
            }
        } catch (error) {
            console.error('Error getting stored items:', error);
        }
        return items;
    }

    /**
     * Emergency cleanup when other strategies fail
     */
    handleEmergencyCleanup(newKey, newValue) {
        try {
            // 1. Remove everything except critical data
            const criticalKeys = ['user_settings', 'auth_token'];
            
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key?.startsWith(this.prefix) && 
                    !criticalKeys.some(ck => key.includes(ck))) {
                    this.storage.removeItem(key);
                }
            }

            // 2. Try storing again
            try {
                this.storage.setItem(this.prefix + newKey, newValue);
                return true;
            } catch (e) {
                if (!this.isQuotaExceeded(e)) throw e;
                return false;
            }

        } catch (error) {
            console.error('Emergency cleanup failed:', error);
            return false;
        }
    }

    /**
     * Records storage error metrics
     */
    recordStorageMetrics(error) {
        try {
            const metrics = JSON.parse(this.storage.getItem('storage_metrics') || '{}');
            metrics.lastError = {
                timestamp: Date.now(),
                message: error.message,
                usedSpace: this.getUsedSpace()
            };
            this.storage.setItem('storage_metrics', JSON.stringify(metrics));
        } catch (e) {
            console.error('Error recording storage metrics:', e);
        }
    }

    /**
     * Validates a value before storing it
     * @throws {TypeError} If the value is invalid
     */
    validateValue(value) {
        // Validate null or undefined value
        if (value === null || value === undefined) {
            throw new TypeError('Value cannot be null or undefined');
        }

        // Validate NaN or Infinity
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new TypeError('Invalid number value');
        }

        // Validate circular objects
        try {
            JSON.stringify(value);
        } catch (e) {
            throw new TypeError('Value contains circular references or is not serializable');
        }

        return true;
    }

    /**
     * Validates a key before using it
     * @throws {TypeError} If the key is invalid
     */
    validateKey(key) {
        if (key === null || key === undefined) {
            throw new TypeError('Key cannot be null or undefined');
        }
        
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }

        const keyLength = key.length;
        if (keyLength < this.limits.KEY_MIN_LENGTH) {
            throw new TypeError(`Key length must be at least ${this.limits.KEY_MIN_LENGTH} characters`);
        }
        
        if (keyLength > this.limits.KEY_MAX_LENGTH) {
            throw new TypeError(`Key exceeds maximum length of ${this.limits.KEY_MAX_LENGTH} characters`);
        }

        // Validate invalid characters
        if (!/^[\w.-]+$/.test(key)) {
            throw new TypeError('Key contains invalid characters');
        }

        // Validate prefix
        const fullKey = this.prefix + key;
        if (fullKey.length > this.limits.KEY_PREFIX_MAX + this.limits.KEY_MAX_LENGTH) {
            throw new TypeError('Key with prefix exceeds maximum length');
        }

        return true;
    }

    /**
     * Validates the structure of a stored item
     */
    isValidItem(item) {
        return item &&
               typeof item === 'object' &&
               'value' in item &&
               'timestamp' in item &&
               typeof item.timestamp === 'number' &&
               (!('ttl' in item) || item.ttl === null || typeof item.ttl === 'number') &&
               typeof item.compressed === 'boolean';
    }

    /**
     * Validates the size of the value before storing
     * @throws {Error} If the value exceeds limits
     */
    validateValueSize(value, key) {
        const serialized = JSON.stringify(value);
        const valueSize = new Blob([serialized]).size;

        if (valueSize > this.limits.VALUE_MAX_SIZE) {
            throw new Error(`Value for key "${key}" exceeds maximum size of ${this.limits.VALUE_MAX_SIZE} bytes`);
        }

        // Check available space
        const totalUsed = this.getUsedSpace();
        if (totalUsed + valueSize > this.limits.TOTAL_QUOTA) {
            throw new Error('Storage quota would be exceeded');
        }

        // Emit warning if approaching limit
        if (totalUsed + valueSize > this.limits.TOTAL_QUOTA * this.limits.STORAGE_WARNING_THRESHOLD) {
            console.warn('Storage usage approaching limit:', {
                used: totalUsed,
                adding: valueSize,
                remaining: this.limits.TOTAL_QUOTA - totalUsed
            });
        }

        return valueSize;
    }

    /**
     * Gets storage usage statistics
     */
    getStorageStats() {
        try {
            const totalSpace = this.limits.TOTAL_QUOTA;
            const usedSpace = this.getUsedSpace();
            const itemCount = Object.keys(this.storage)
                .filter(key => key.startsWith(this.prefix))
                .length;

            return {
                totalSpace,
                usedSpace,
                availableSpace: totalSpace - usedSpace,
                itemCount,
                usagePercentage: (usedSpace / totalSpace) * 100,
                isNearLimit: usedSpace > totalSpace * this.limits.STORAGE_WARNING_THRESHOLD
            };
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return null;
        }
    }

    async migrateCache(fromVersion, toVersion) {
        console.info(`Migrating cache from ${fromVersion} to ${toVersion}`);
        
        try {
            // Get all current data
            const currentData = this.getAllItems();
            
            // Create backup
            const backup = {
                version: fromVersion,
                data: currentData,
                timestamp: Date.now()
            };
            
            this.storage.setItem('cache_backup_' + fromVersion, JSON.stringify(backup));

            // Execute migrations in order
            const versions = this.getSortedVersions(fromVersion, toVersion);
            
            for (const version of versions) {
                const migrationFn = this.migrations.get(version);
                if (migrationFn) {
                    await migrationFn(currentData);
                }
            }

            // Update version
            this.storage.setItem(this.CACHE_VERSION_KEY, toVersion);
            console.info('Cache migration completed successfully');

        } catch (error) {
            console.error('Cache migration failed:', error);
            // Restore backup
            this.restoreBackup(fromVersion);
            throw error;
        }
    }

    getSortedVersions(fromVersion, toVersion) {
        return Array.from(this.migrations.keys())
            .filter(version => 
                this.compareVersions(version, fromVersion) > 0 && 
                this.compareVersions(version, toVersion) <= 0
            )
            .sort(this.compareVersions);
    }

    compareVersions(a, b) {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (partsA[i] > partsB[i]) return 1;
            if (partsA[i] < partsB[i]) return -1;
        }
        return 0;
    }

    restoreBackup(version) {
        try {
            const backupKey = 'cache_backup_' + version;
            const backupData = JSON.parse(this.storage.getItem(backupKey));
            
            if (!backupData) {
                throw new Error('No backup found');
            }

            // Clear current cache
            this.clear();

            // Restore data from backup
            backupData.data.forEach(item => {
                this.set(item.key, item.value, item.ttl);
            });

            // Restore previous version
            this.storage.setItem(this.CACHE_VERSION_KEY, version);
            
            console.info('Cache backup restored successfully');

        } catch (error) {
            console.error('Failed to restore cache backup:', error);
            // If restoration fails, clear everything
            this.clear();
            this.storage.setItem(this.CACHE_VERSION_KEY, this.VERSION);
        }
    }

    // Example migration to version 1.0.0
    async migrateTo100(data) {
        // Example: Add new field to all items
        data.forEach(item => {
            if (item.value && typeof item.value === 'object') {
                item.value.schemaVersion = '1.0.0';
                this.set(item.key, item.value, item.ttl);
            }
        });
    }

    async performStorageCleanup(aggressive = false) {
        try {
            const startTime = Date.now();
            let itemsRemoved = 0;
            let bytesRecovered = 0;

            // Get current statistics
            const stats = this.getStorageStats();
            if (!stats) return;

            // Determine if aggressive cleanup is needed
            const isStorageCritical = stats.usagePercentage > this.retentionConfig.CRITICAL_THRESHOLD * 100;
            aggressive = aggressive || isStorageCritical;

            // Get all items with metadata
            const items = await this.getAllItemsWithMetadata();
            
            // Prioritize items for cleanup
            const itemsToProcess = this.prioritizeItemsForCleanup(items, aggressive);

            // Process in batches
            for (let i = 0; i < itemsToProcess.length; i += this.retentionConfig.BATCH_SIZE) {
                const batch = itemsToProcess.slice(i, i + this.retentionConfig.BATCH_SIZE);
                
                // Process batch
                const result = await this.processBatchRemoval(batch);
                itemsRemoved += result.removed;
                bytesRecovered += result.bytes;

                // Check if we have freed enough space
                const currentStats = this.getStorageStats();
                if (!aggressive && currentStats.usagePercentage < this.retentionConfig.USAGE_THRESHOLD * 100) {
                    break;
                }
            }

            // Update metrics
            this.cleanupMetrics = {
                lastCleanup: startTime,
                itemsRemoved: itemsRemoved + (this.cleanupMetrics?.itemsRemoved || 0),
                spaceRecovered: bytesRecovered + (this.cleanupMetrics?.spaceRecovered || 0),
                cleanupAttempts: (this.cleanupMetrics?.cleanupAttempts || 0) + 1,
                errors: this.cleanupMetrics?.errors || []
            };

            return {
                duration: Date.now() - startTime,
                itemsRemoved,
                bytesRecovered,
                aggressive
            };

        } catch (error) {
            console.error('Storage cleanup failed:', error);
            this.cleanupMetrics.errors.push({
                timestamp: Date.now(),
                message: error.message
            });
            throw error;
        }
    }

    prioritizeItemsForCleanup(items, aggressive) {
        const now = Date.now();
        
        return items
            .map(item => ({
                ...item,
                priority: this.calculateCleanupPriority(item, now, aggressive)
            }))
            .filter(item => item.priority > 0)
            .sort((a, b) => b.priority - a.priority);
    }

    calculateCleanupPriority(item, now, aggressive) {
        let priority = 0;
        const age = now - item.timestamp;

        // Expired items have highest priority
        if (item.ttl && now > item.timestamp + item.ttl) {
            return 100;
        }

        // Priority based on age
        if (age > this.retentionConfig.MAX_AGE_MS) {
            priority += 75;
        } else if (age > this.retentionConfig.UNUSED_AGE_MS) {
            priority += 50;
        }

        // Priority based on last access
        if (item.lastAccess) {
            const unused = now - item.lastAccess;
            if (unused > this.retentionConfig.UNUSED_AGE_MS) {
                priority += 25;
            }
        }

        // In aggressive mode, increase priorities
        if (aggressive) {
            priority *= 1.5;
        }

        // Adjust for size - larger items have higher priority
        const sizeScore = Math.min(25, Math.floor(item.size / 1024)); // max 25 points for size
        priority += sizeScore;

        return Math.min(100, priority);
    }

    async processBatchRemoval(batch) {
        let removed = 0;
        let bytesRecovered = 0;

        for (const item of batch) {
            try {
                const beforeSize = await this.getItemSize(item.key);
                await this.remove(item.key);
                removed++;
                bytesRecovered += beforeSize;
            } catch (error) {
                console.warn(`Failed to remove item ${item.key}:`, error);
            }
        }

        return { removed, bytes: bytesRecovered };
    }

    async getAllItemsWithMetadata() {
        const items = [];
        const now = Date.now();

        for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (!key?.startsWith(this.prefix)) continue;

            try {
                const raw = this.storage.getItem(key);
                const item = JSON.parse(raw);
                const size = raw.length * 2; // Approximation in bytes

                items.push({
                    key: key.slice(this.prefix.length),
                    timestamp: item.timestamp,
                    ttl: item.ttl,
                    lastAccess: item.lastAccess || item.timestamp,
                    size,
                    compressed: item.compressed
                });
            } catch (error) {
                console.warn(`Error processing item ${key}:`, error);
            }
        }

        return items;
    }

    async getItemSize(key) {
        try {
            const item = this.storage.getItem(this.prefix + key);
            return item ? item.length * 2 : 0;
        } catch (error) {
            console.warn(`Error getting item size for ${key}:`, error);
            return 0;
        }
    }
}

// Global cleanup with the same logic
window.addEventListener('unload', () => {
    // Clear registered intervals
    window._cacheIntervals?.forEach(intervalId => {
        try {
            clearInterval(intervalId);
        } catch (error) {
            console.warn('Error clearing interval:', error);
        }
    });
    window._cacheIntervals?.clear();

    // Clear registered instances
    instances.forEach(instance => {
        try {
            instance.dispose();
        } catch (error) {
            console.warn('Error disposing cache instance:', error);
        }
    });
});

// Create instance
const cacheInstance = new CacheService();

export default cacheInstance;
