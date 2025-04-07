/**
 * SharePoint Explorer Configuration
 * Contains application-wide settings
 */
const MenuConfig = {
    // API Configuration
    API_CONFIG: {
        // Default attribute name for API URL on body element
        apiUrlAttribute: 'data-api-url',

        // Authentication settings
        withCredentials: true,

        // Request timeout in milliseconds
        timeout: 30000,

        // Default headers for SharePoint REST API
        headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
        }
    },

    // UI Configuration
    UI_CONFIG: {
        // Default number of items to show in export preview
        defaultExportPreviewCount: 10,

        // Maximum export preview items
        maxExportPreviewCount: 50,

        // Default state for showing hidden items
        showHiddenByDefault: false,

        // Animation settings
        animations: {
            enabled: true,
            duration: 300
        }
    },

    // Notification Configuration
    NOTIFICATION_CONFIG: {
        defaultDuration: 4000,  // Default notification duration in ms
        successDuration: 3000,  // Success notification duration
        errorDuration: 5000,    // Error notification duration
        warningDuration: 4000,  // Warning notification duration
        infoDuration: 3000      // Info notification duration
    },

    // Theme Configuration
    THEME_CONFIG: {
        storageKey: 'sharepoint-explorer-theme',
        defaultTheme: 'light'
    },

    // Debug Configuration
    DEBUG_CONFIG: {
        enabled: true,
        logApiCalls: true,
        logNavigation: true,
        updateInterval: 2000  // Debug panel update interval in ms
    },

    // Fields Configuration
    FIELDS_CONFIG: {
        // Field types to consider as standard SharePoint fields
        standardFieldPatterns: [
            /^_/,
            /^owsh?/,
            /^doc/,
            /^(Created|Modified)(By|)$/,
            /^(File|Content).*/,
            /^(ID|GUID)$/
        ],

        // Human-readable field type descriptions
        typeDescriptions: {
            'Text': 'Single line of text',
            'Note': 'Multiple lines of text',
            'Number': 'Number',
            'DateTime': 'Date and Time',
            'Choice': 'Choice',
            'MultiChoice': 'Multiple Choice',
            'Boolean': 'Yes/No',
            'User': 'Person or Group',
            'Lookup': 'Lookup',
            'URL': 'Hyperlink or Picture',
            'Calculated': 'Calculated',
            'Currency': 'Currency',
            'TaxonomyFieldType': 'Managed Metadata',
            'Counter': 'ID (Counter)',
            'Attachments': 'Attachments',
            'ContentTypeId': 'Content Type ID'
        },

        // Fields to include by default in export
        defaultExportFields: [
            'Title',
            'InternalName',
            'TypeAsString',
            'Required',
            'EnforceUniqueValues',
            'Description'
        ]
    }
};

export { MenuConfig };
