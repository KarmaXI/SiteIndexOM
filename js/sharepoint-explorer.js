/**
 * SharePoint Explorer
 * A web application for navigating through SharePoint sites, lists, and libraries
 * 
 * This script is the main entry point for the application and provides a modern interface
 * for exploring SharePoint content.
 */

import { MenuConfig } from "./MenuConfig.js";

// Create a shared instance of SharePointExplorer that persists between navigations
let sharePointExplorerInstance = null;

class SharePointExplorer {
  constructor() {
    // Configuration
    this.config = {
      apiUrl: document.body.getAttribute(MenuConfig.API_CONFIG.apiUrlAttribute) || '',
      showHidden: MenuConfig.UI_CONFIG.showHiddenByDefault,
      defaultTheme: MenuConfig.THEME_CONFIG.defaultTheme,
      animations: MenuConfig.UI_CONFIG.animations
    };

    // State
    this.currentSiteData = null;
    this.navigationHistory = [];
    this.currentListFields = [];
    this.currentListTitle = "";
    this.currentListId = "";
    this.currentViews = [];
    this.currentViewFields = [];
    this.exportPreviewCount = MenuConfig.UI_CONFIG.defaultExportPreviewCount;
    this.notificationTimeout = null;
    this.fieldsModal = null;
    this.isLoading = false;

    // Initialize the application when DOM is fully loaded
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    console.log("Initializing SharePoint Explorer with URL:", this.config.apiUrl);
    
    // Check if API URL is valid
    if (!this.config.apiUrl) {
      this.showNotification({
        type: 'error',
        title: 'Configuration Error',
        message: 'No API URL provided. Please set the data-api-url attribute on the body element.',
        icon: 'fa-exclamation-triangle',
        duration: MenuConfig.NOTIFICATION_CONFIG.errorDuration
      });
      return;
    }

    // Initialize UI components
    this.initializeUIComponents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Apply saved theme
    this.applySavedTheme();
    
    // Initialize navigation with the root site
    this.initializeNavigation();
    
    // Load initial data
    this.loadInitialData();
    
    // Show welcome notification
    this.showNotification({
      type: 'info',
      title: 'SharePoint Explorer Ready',
      message: 'Browsing from ' + this.config.apiUrl,
      icon: 'fa-info-circle',
      duration: MenuConfig.NOTIFICATION_CONFIG.infoDuration
    });
  }

  /**
   * Initialize UI components
   */
  initializeUIComponents() {
    // Initialize Bootstrap modal
    const fieldsModalElement = document.getElementById("fieldsModal");
    if (fieldsModalElement) {
      this.fieldsModal = new bootstrap.Modal(fieldsModalElement);
    }
    
    // Initialize toggle switches
    const showHiddenToggle = document.getElementById('showHiddenToggle');
    if (showHiddenToggle) {
      showHiddenToggle.checked = this.config.showHidden;
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Global event listeners
    this.setupNavigationListeners();
    this.setupThemeToggle();
    this.setupFieldsModalListeners();
    this.setupUtilityListeners();
    
    // Setup show hidden toggle
    const showHiddenToggle = document.getElementById('showHiddenToggle');
    if (showHiddenToggle) {
      showHiddenToggle.addEventListener('change', (e) => {
        this.config.showHidden = e.target.checked;
        this.reloadCurrentSite();
        
        this.showNotification({
          type: 'info',
          title: e.target.checked ? 'Hidden Items Shown' : 'Hidden Items Hidden',
          message: e.target.checked ? 'Now showing hidden lists and libraries.' : 'Hidden items are now hidden.',
          icon: e.target.checked ? 'fa-eye' : 'fa-eye-slash',
          duration: MenuConfig.NOTIFICATION_CONFIG.infoDuration
        });
      });
    }
  }

  /**
   * Set up navigation related event listeners
   */
  setupNavigationListeners() {
    // Use event delegation for navigation buttons
    document.addEventListener('click', (event) => {
      // Find closest button with the navigate-to-subsite class
      const navigateBtn = event.target.closest('.navigate-to-subsite');
      if (navigateBtn) {
        const url = navigateBtn.dataset.url;
        const title = navigateBtn.dataset.title;
        if (url && title) {
          this.navigateToSubsite(url, title);
        }
      }
      
      // Breadcrumb navigation
      const breadcrumbLink = event.target.closest('.breadcrumb-link');
      if (breadcrumbLink) {
        event.preventDefault();
        const index = parseInt(breadcrumbLink.dataset.index, 10);
        if (!isNaN(index) && this.navigationHistory[index]) {
          this.navigateToHistoryIndex(index);
        }
      }
    });
  }

  /**
   * Set up theme toggle functionality
   */
  setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem(MenuConfig.THEME_CONFIG.storageKey, isDarkMode ? 'dark' : 'light');
        
        this.showNotification({
          type: 'info',
          title: isDarkMode ? 'Dark Mode Enabled' : 'Light Mode Enabled',
          message: 'Theme preference saved.',
          icon: isDarkMode ? 'fa-moon' : 'fa-sun',
          duration: MenuConfig.NOTIFICATION_CONFIG.infoDuration
        });
      });
    }
  }

  /**
   * Set up fields modal event listeners
   */
  setupFieldsModalListeners() {
    // Event listeners for fields modal
    $("#showStandardFieldsSwitch").on("change", () => {
      this.filterAndDisplayFields();
    });

    $("#standardFieldsCheckboxes").on("change", ".standard-field-checkbox", () => {
      this.filterAndDisplayFields();
    });

    $("#viewSelector").on("change", () => {
      this.filterFieldsBySelectedView();
    });

    $("#excludeStandardFieldsCheckbox").on("change", () => {
      this.updateExportPreview();
    });

    $("#exportPreviewSlider").on("input", (e) => {
      this.exportPreviewCount = parseInt(e.target.value, 10);
      $("#exportPreviewCount").text(this.exportPreviewCount);
      this.updateExportPreview();
    });

    $("#exportFieldsBtn").on("click", () => this.exportFields());
    $("#copyFieldsBtn").on("click", () => this.copyFieldsToClipboard());
    
    // Field list listeners with delegation
    $(document).on("click", ".btn-outline-primary[data-list-id]", (event) => {
      const listId = $(event.currentTarget).data("list-id");
      const listTitle = $(event.currentTarget).data("list-title");
      if (listId && listTitle) {
        this.showListFields(listId, listTitle);
      }
    });
  }

  /**
   * Set up utility event listeners (e.g., copy buttons)
   */
  setupUtilityListeners() {
    // Attach event listener for GUID copy buttons
    $(document).on("click", ".copy-guid-btn", (event) => {
      event.stopPropagation();
      const guid = $(event.currentTarget).data("guid");
      this.copyToClipboard(guid, 'GUID copied to clipboard');
    });
    
    // Select/deselect all fields buttons
    $(document).on("click", "#selectAllFieldsBtn", () => this.toggleAllFieldExport(true));
    $(document).on("click", "#deselectAllFieldsBtn", () => this.toggleAllFieldExport(false));
  }

  /**
   * Apply saved theme preference
   */
  applySavedTheme() {
    const savedTheme = localStorage.getItem(MenuConfig.THEME_CONFIG.storageKey);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }

  /**
   * Initialize navigation state
   */
  initializeNavigation() {
    // Initialize with the root site
    const rootSiteData = {
      url: this.config.apiUrl,
      title: "Home",
      isRoot: true
    };
    
    // Start with root in navigation history
    this.navigationHistory = [rootSiteData];
    this.currentSiteData = rootSiteData;
    
    // Update URL display
    this.updateSitePathDisplay(this.config.apiUrl);
    
    // Update breadcrumbs
    this.updateBreadcrumbs();
  }

  /**
   * Load initial site data
   */
  loadInitialData() {
    this.loadLists(this.config.apiUrl);
    this.loadSubsites(this.config.apiUrl);
  }

  /**
   * Reload data for the current site
   */
  reloadCurrentSite() {
    if (this.currentSiteData) {
      this.loadLists(this.currentSiteData.url);
      this.loadSubsites(this.currentSiteData.url);
    }
  }

  /**
   * Make a SharePoint REST API request
   * @param {string} url - The API URL
   * @param {function} successCallback - Success callback function
   * @param {function} errorCallback - Error callback function
   */
  makeRequest(url, successCallback, errorCallback) {
    if (MenuConfig.DEBUG_CONFIG.logApiCalls) {
      console.log("Making API request to:", url);
    }
    
    // Set loading state
    this.isLoading = true;
    
    // Make the AJAX request
    $.ajax({
      url: url,
      method: "GET",
      timeout: MenuConfig.API_CONFIG.timeout,
      headers: MenuConfig.API_CONFIG.headers,
      xhrFields: { withCredentials: MenuConfig.API_CONFIG.withCredentials },
      success: (data) => {
        this.isLoading = false;
        
        if (MenuConfig.DEBUG_CONFIG.logApiCalls) {
          console.log("API request succeeded:", url);
        }
        
        if (successCallback) successCallback(data);
      },
      error: (xhr, status, error) => {
        this.isLoading = false;
        console.error("API request failed:", xhr, status, error);
        
        this.showNotification({
          type: 'error',
          title: 'API Request Failed',
          message: `Error ${xhr.status}: ${xhr.statusText}`,
          icon: 'fa-triangle-exclamation',
          duration: MenuConfig.NOTIFICATION_CONFIG.errorDuration
        });
        
        if (errorCallback) errorCallback(xhr, status, error);
      },
    });
  }

  /**
   * Navigate to a subsite
   * @param {string} url - The subsite URL
   * @param {string} title - The subsite title
   */
  navigateToSubsite(url, title) {
    if (MenuConfig.DEBUG_CONFIG.logNavigation) {
      console.log("Navigating to subsite:", url, title);
    }
    
    // Ensure the URL has the correct format
    const normalizedUrl = this.normalizeUrl(url);
    
    // Update the site path display
    this.updateSitePathDisplay(normalizedUrl);
    
    // Create new site data
    const siteData = {
      url: normalizedUrl,
      title: title,
      isRoot: false
    };
    
    // Check if we're navigating to a site that's already in our history
    const existingIndex = this.findSiteInHistory(normalizedUrl);
    
    if (existingIndex !== -1) {
      // If we're navigating to a site in history, truncate the history at that point
      this.navigationHistory = this.navigationHistory.slice(0, existingIndex + 1);
    } else {
      // Add new site to navigation history
      this.navigationHistory.push(siteData);
    }
    
    // Update current site
    this.currentSiteData = siteData;
    
    // Update breadcrumbs
    this.updateBreadcrumbs();
    
    // Load lists and subsites for the selected site
    this.loadLists(normalizedUrl);
    this.loadSubsites(normalizedUrl);
    
    // Show notification
    this.showNotification({
      type: 'info',
      title: 'Navigation',
      message: `Viewing: ${title}`,
      icon: 'fa-folder-open',
      duration: MenuConfig.NOTIFICATION_CONFIG.infoDuration
    });
  }

  /**
   * Navigate to a site at a specific index in the history
   * @param {number} index - History index
   */
  navigateToHistoryIndex(index) {
    if (index < 0 || index >= this.navigationHistory.length) {
      console.error("Invalid history index:", index);
      return;
    }
    
    const siteData = this.navigationHistory[index];
    this.navigateToSubsite(siteData.url, siteData.title);
  }

  /**
   * Update the site path display in the UI
   * @param {string} url - The site URL
   */
  updateSitePathDisplay(url) {
    $("#currentSiteUrl").text(url);
  }

  /**
   * Update breadcrumbs based on navigation history
   */
  updateBreadcrumbs() {
    let breadcrumbHtml = '';
    
    this.navigationHistory.forEach((site, index) => {
      if (index === this.navigationHistory.length - 1) {
        // Current site (active)
        breadcrumbHtml += `<li class="breadcrumb-item active">${site.title}</li>`;
      } else {
        // Previous site (clickable)
        breadcrumbHtml += `
          <li class="breadcrumb-item">
            <a href="#" class="breadcrumb-link" data-index="${index}">${site.title}</a>
          </li>
        `;
      }
    });
    
    $("#breadcrumbContainer ol").html(breadcrumbHtml);
  }

  /**
   * Find a site in the navigation history by URL
   * @param {string} url - The site URL
   * @returns {number} - The index in history or -1 if not found
   */
  findSiteInHistory(url) {
    for (let i = 0; i < this.navigationHistory.length; i++) {
      if (this.navigationHistory[i].url === url) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Normalize a URL by ensuring it ends with a slash
   * @param {string} url - The URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeUrl(url) {
    // Ensure URL ends with a slash for consistent API calls
    return url.endsWith('/') ? url : url + '/';
  }

  /**
   * Load lists for a site
   * @param {string} siteUrl - The site URL
   */
  loadLists(siteUrl) {
    if (MenuConfig.DEBUG_CONFIG.logApiCalls) {
      console.log("Loading lists for site:", siteUrl);
    }
    
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(siteUrl);
    
    // Clear existing lists and show loading spinner
    $("#listsContainer").html(
      '<div class="p-4 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>'
    );
    
    // Build API endpoint - Get both lists and document libraries
    const apiEndpoint = `${normalizedUrl}_api/web/lists?$select=Title,ItemCount,Hidden,BaseTemplate,EffectiveBasePermissions,Id,DefaultViewUrl`;
    
    this.makeRequest(
      apiEndpoint,
      (data) => {
        try {
          // Check if we received valid data
          if (!data || !data.d || !data.d.results) {
            console.error("Invalid data structure received:", data);
            $("#listsContainer").html(
              '<div class="p-4 text-center text-danger">Invalid data received from API</div>'
            );
            return;
          }
          
          // Filter lists based on visibility and permissions
          let lists = data.d.results.filter(list => 
            (this.config.showHidden || !list.Hidden) && 
            list.EffectiveBasePermissions && 
            (list.EffectiveBasePermissions.High > 0 || list.EffectiveBasePermissions.Low > 0)
          );
          
          // Sort lists: Document Libraries first, then alphabetically by title
          lists = lists.sort((a, b) => {
            // First sort by type (Document Library first)
            if (a.BaseTemplate === 101 && b.BaseTemplate !== 101) return -1;
            if (a.BaseTemplate !== 101 && b.BaseTemplate === 101) return 1;
            
            // Then sort alphabetically
            return a.Title.localeCompare(b.Title);
          });

          // Update counter
          $("#listsCount").text(lists.length);

          if (lists.length === 0) {
            $("#listsContainer").html(
              '<div class="p-4 text-center text-muted">No lists found</div>'
            );
            return;
          }

          // Build HTML
          let html = "";
          lists.forEach((list) => {
            const isDocLib = list.BaseTemplate === 101;
            const icon = isDocLib ? "fa-file-lines" : "fa-table";
            const typeLabel = isDocLib ? "Document Library" : "List";
            const hiddenClass = list.Hidden ? "text-muted" : "";
html += `
  <div class="list-item ${hiddenClass}">
    <div class="w-100">
      <div class="d-flex align-items-center mb-1">
        <strong class="me-2">${list.Title}</strong>
        <button class="btn btn-sm btn-outline-secondary copy-title-btn" data-title="${list.Title}" title="Kopieer titel">
          <i class="fas fa-copy"></i>
        </button>
        <button class="btn btn-sm btn-outline-primary ms-auto open-fields-btn"
          data-list-id="${list.Id}" data-list-title="${list.Title}" title="Toon velden">
          <i class="fas fa-list-ul"></i> Fields
        </button>
      </div>
      <div class="text-muted fst-italic mb-1">${typeLabel}</div>
      <div class="d-flex align-items-center mb-1">
        <small class="text-muted">GUID: ${list.Id}</small>
        <button class="btn btn-sm btn-outline-secondary ms-2 copy-guid-btn" data-guid="${list.Id}" title="Kopieer GUID">
          <i class="fas fa-copy"></i>
        </button>
      </div>
      <div class="d-flex align-items-center mb-1">
        <small class="text-muted">Pad: ${this.currentSiteData?.url || siteUrl}</small>
        <button class="btn btn-sm btn-outline-secondary ms-2 copy-path-btn"
                data-title="${list.Title}"
                data-guid="${list.Id}"
                data-path="${this.currentSiteData?.url || siteUrl}"
                title="Kopieer alles">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    </div>
  </div>
`;

            });

 $("#listsContainer").html(html);

// Kopieerknoppen activeren
$("#listsContainer").on("click", ".copy-title-btn", function () {
  const title = $(this).data("title");
  navigator.clipboard.writeText(title);
});

$("#listsContainer").on("click", ".copy-guid-btn", function () {
  const guid = $(this).data("guid");
  navigator.clipboard.writeText(guid);
});

$("#listsContainer").on("click", ".copy-path-btn", function () {
  const title = $(this).data("title");
  const guid = $(this).data("guid");
  const path = $(this).data("path");
  const combined = `Titel: ${title}\nGUID: ${guid}\nPad: ${path}`;
  navigator.clipboard.writeText(combined);
});

// Fields-modal openen
$("#listsContainer").on("click", ".open-fields-btn", (event) => {
  const listId = $(event.currentTarget).data("list-id");
  const listTitle = $(event.currentTarget).data("list-title");
  this.showListFields(listId, listTitle);
});
        } catch (error) {
          console.error("Error processing lists data:", error);
          $("#listsContainer").html(
            `<div class="p-4 text-center text-danger">Error processing lists data: ${error.message}</div>`
          );
        }
      },
      (xhr) => {
        console.error("Failed to load lists:", xhr);
        $("#listsContainer").html(
          `<div class="p-4 text-center text-danger">Failed to load lists: ${xhr.status} ${xhr.statusText}</div>`
        );
      }
    );
  }

  /**
   * Load subsites for a site
   * @param {string} siteUrl - The site URL
   */
  loadSubsites(siteUrl) {
    if (MenuConfig.DEBUG_CONFIG.logApiCalls) {
      console.log("Loading subsites for site:", siteUrl);
    }
    
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(siteUrl);
    
    // Clear existing subsites and show loading spinner
    $("#subsitesContainer").html(
      '<div class="p-4 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>'
    );
    
    // Build API endpoint - This endpoint gets all subsites the current user has access to
    const apiEndpoint = `${normalizedUrl}_api/web/GetSubwebsFilteredForCurrentUser(nWebTemplateFilter=-1)`;
    
    this.makeRequest(
      apiEndpoint,
      (data) => {
        try {
          // Check if we received valid data
          if (!data || !data.d || !data.d.results) {
            console.error("Invalid subsite data structure received:", data);
            $("#subsitesContainer").html(
              '<div class="p-4 text-center text-danger">Invalid data received from API</div>'
            );
            return;
          }
          
          // Get subsites and sort them alphabetically
          const subsites = data.d.results.sort((a, b) => a.Title.localeCompare(b.Title));
          
          // Update counter
          $("#subsitesCount").text(subsites.length);

          if (!subsites || subsites.length === 0) {
            $("#subsitesContainer").html(
              '<div class="p-4 text-center text-muted">No subsites found</div>'
            );
            return;
          }

          // Build HTML
          let html = "";
          subsites.forEach((subsite) => {
            const escapedTitle = subsite.Title.replace(/'/g, "\\'");
            const relativePath = subsite.ServerRelativeUrl;
            
            html += `
              <div class="list-item">
                <div>
                  <i class="fas fa-folder text-primary me-2"></i>
                  <span class="fw-bold">${subsite.Title}</span>
                  <small class="text-muted d-block mt-1">${relativePath}</small>
                </div>
                <button class="btn btn-sm btn-action navigate-to-subsite"
                  data-url="${relativePath}" 
                  data-title="${escapedTitle}">
                  <i class="fas fa-arrow-right me-1"></i> Browse
                </button>
              </div>
            `;
          });

          $("#subsitesContainer").html(html);
        } catch (error) {
          console.error("Error processing subsites data:", error);
          $("#subsitesContainer").html(
            `<div class="p-4 text-center text-danger">Error processing subsites: ${error.message}</div>`
          );
        }
      },
      (xhr) => {
        console.error("Failed to load subsites:", xhr);
        $("#subsitesContainer").html(
          `<div class="p-4 text-center text-danger">Failed to load subsites: ${xhr.status} ${xhr.statusText}</div>`
        );
      }
    );
  }

  /**
   * Show fields modal for a list
   * @param {string} listId - The list GUID
   * @param {string} listTitle - The list title
   */
  showListFields(listId, listTitle) {
    // Set up modal
    $("#fieldsModalLabel").text(`Fields in "${listTitle}"`);
    
    // Show loading state
    $("#fieldsTableContainer").html(
      `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`
    );

    // Reset form controls
    $("#showStandardFieldsSwitch").prop("checked", false);
    $("#excludeStandardFieldsCheckbox").prop("checked", true);
    $("#standardFieldsCheckboxes").hide();
    
    // Reset view selector
    $("#viewSelector").html('<option value="">Loading views...</option>');
    
    // Reset export preview
    $("#exportPreviewSlider").val(this.exportPreviewCount);
    $("#exportPreviewCount").text(this.exportPreviewCount);
    $("#exportPreviewContainer").html('<div class="text-center text-muted py-4">Export preview will appear here.</div>');
    
    // Ensure export controls container exists
    if (!$("#exportControlsContainer").length) {
      $(`<div id="exportControlsContainer" class="mb-4">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="mb-0 fw-medium">Export Settings:</h6>
            <div>
              <button class="btn btn-sm btn-outline-primary me-2" id="selectAllFieldsBtn">
                <i class="fas fa-check-square"></i> Select All
              </button>
              <button class="btn btn-sm btn-outline-secondary" id="deselectAllFieldsBtn">
                <i class="fas fa-square"></i> Deselect All
              </button>
            </div>
          </div>
          <div class="alert alert-info d-flex align-items-center">
            <i class="fas fa-info-circle fs-5 me-3"></i>
            <div class="small">
              Use the toggles in the table below to select specific fields for export.
            </div>
          </div>
        </div>`).insertBefore("#fieldsTableContainer");
    }

    // Show modal
    this.fieldsModal.show();

    // Store list info
    this.currentListTitle = listTitle;
    this.currentListId = listId;
    
    // Load field data
    this.loadFullFieldData(listId);
  }

  /**
   * Load all field data for a list
   * @param {string} listId - The list GUID
   */
  loadFullFieldData(listId) {
    const apiUrl = this.currentSiteData.url;
    
    // Use Promise.all to load all data concurrently
    Promise.all([
      // Fields data
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${apiUrl}/_api/web/lists(guid'${listId}')/fields?$select=Title,InternalName,TypeAsString,Hidden,Description,Required,EnforceUniqueValues,MaxLength,Choices,DefaultValue,ValidationFormula,ValidationMessage,Indexed,ReadOnlyField,Group`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
      
      // List properties
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${apiUrl}/_api/web/lists(guid'${listId}')?$select=EnableAttachments,EnableFolderCreation,EnableVersioning,MajorVersionLimit,EnableMinorVersions,MinorVersionLimit`,
          (data) => resolve(data.d),
          (xhr) => reject(xhr)
        );
      }),
      
      // Content types
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${apiUrl}/_api/web/lists(guid'${listId}')/contenttypes?$select=Name,Description,Id`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
      
      // Views
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${apiUrl}/_api/web/lists(guid'${listId}')/views?$select=Title,DefaultView,PersonalView,ViewQuery,Id`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
    ])
      .then(([fields, listProps, contentTypes, views]) => {
        // Process and store the combined data
        this.currentListFields = fields.map((field) => ({
          ...field,
          ListId: listId,
          isStandard: this.isStandardField(field),
          selected: !field.Hidden,
          exportEnabled: !field.Hidden,
          typeDescription: this.getFieldTypeDescription(field.TypeAsString),
          options: this.getFieldOptions(field)
        }));

        // Store other data
        this.listProperties = listProps;
        this.contentTypes = contentTypes;
        this.currentViews = views;

        // Populate view selector
        this.populateViewSelector(views);
        
     // 👉 Forceer standaardweergave met onze eigen layout
this.filterAndDisplayFields();

// Wil je tóch de standaard view gebruiken? Zet dit dan aan:
// const defaultView = views.find(view => view.DefaultView) || views[0];
// if (defaultView) {
//   this.loadViewFields(defaultView.Id, listId);
// }
        
        // Generate standard field checkboxes
        this.generateStandardFieldCheckboxes();
        
        // Initialize export preview
        this.updateExportPreview();
      })
      .catch((error) => {
        console.error("Error loading full field data:", error);
        $("#fieldsTableContainer").html(
          '<div class="p-4 text-center text-danger">Error loading field data.</div>'
        );
        $("#viewSelector").html('<option value="">No views available</option>');
        
        this.showNotification({
          type: 'error',
          title: 'Data Loading Error',
          message: 'Failed to load field data for the selected list.',
          icon: 'fa-database',
          duration: MenuConfig.NOTIFICATION_CONFIG.errorDuration
        });
      });
  }

  /**
   * Check if a field is a standard SharePoint field
   * @param {Object} field - Field data
   * @returns {boolean} - True if standard field
   */
  isStandardField(field) {
    return MenuConfig.FIELDS_CONFIG.standardFieldPatterns.some(pattern => 
      pattern.test(field.InternalName)
    ) || field.Hidden;
  }

  /**
   * Get human-readable field type description
   * @param {string} typeString - Field type
   * @returns {string} - Human-readable description
   */
  getFieldTypeDescription(typeString) {
    return MenuConfig.FIELDS_CONFIG.typeDescriptions[typeString] || typeString;
  }

  /**
   * Get field options for choice fields
   * @param {Object} field - Field data
   * @returns {Array} - Field options
   */
  getFieldOptions(field) {
    if ((field.TypeAsString === "Choice" || field.TypeAsString === "MultiChoice") && field.Choices) {
      return field.Choices.results || [];
    }
    return [];
  }

  /**
   * Populate view selector dropdown
   * @param {Array} views - List views
   */
  populateViewSelector(views) {
    // Sort views: Default view first, then alphabetically
    const sortedViews = [...views].sort((a, b) => {
      if (a.DefaultView && !b.DefaultView) return -1;
      if (!a.DefaultView && b.DefaultView) return 1;
      return a.Title.localeCompare(b.Title);
    });
    
    let options = '<option value="">-- All Fields --</option>';
    
    sortedViews.forEach(view => {
      const isDefault = view.DefaultView ? ' (Default)' : '';
      options += `<option value="${view.Id}"${view.DefaultView ? ' selected' : ''}>${view.Title}${isDefault}</option>`;
    });
    
    $("#viewSelector").html(options);
  }

  /**
   * Load fields for a specific view
   * @param {string} viewId - View GUID
   * @param {string} listId - List GUID
   */
  loadViewFields(viewId, listId) {
    const apiUrl = this.currentSiteData.url;
    
    this.makeRequest(
      `${apiUrl}/_api/web/lists(guid'${listId}')/views(guid'${viewId}')/viewfields`,
      (data) => {
        if (data.d && data.d.Items && data.d.Items.results) {
          this.currentViewFields = data.d.Items.results;
          this.filterFieldsBySelectedView();
        }
      },
      (error) => {
        console.error("Error loading view fields:", error);
        this.currentViewFields = [];
        this.filterAndDisplayFields();
        
        this.showNotification({
          type: 'warning',
          title: 'View Data Incomplete',
          message: 'Could not load fields for the selected view. Displaying all fields instead.',
          icon: 'fa-exclamation-circle',
          duration: MenuConfig.NOTIFICATION_CONFIG.warningDuration
        });
      }
    );
  }

  /**
   * Filter fields by the selected view
   */
  filterFieldsBySelectedView() {
    const selectedViewId = $("#viewSelector").val();
    
    if (!selectedViewId) {
      this.filterAndDisplayFields();
      return;
    }
    
    if (this.currentViewFields.length === 0) {
      const listId = this.currentListId;
      if (listId) {
        this.loadViewFields(selectedViewId, listId);
      } else {
        this.filterAndDisplayFields();
      }
    } else {
      this.filterAndDisplayFields();
    }
  }

  /**
   * Generate checkboxes for standard fields
   */
  generateStandardFieldCheckboxes() {
    const standardFields = this.currentListFields.filter(field => field.isStandard);
    
    if (standardFields.length === 0) {
      $("#standardFieldsCheckboxes").hide();
      return;
    }
    
    standardFields.sort((a, b) => a.Title.localeCompare(b.Title));
    
    let html = "";
    standardFields.forEach(field => {
      html += `
        <div class="col-md-4 mb-2">
          <div class="form-check">
            <input class="form-check-input standard-field-checkbox"
              type="checkbox"
              value="${field.InternalName}"
              id="field-${field.InternalName}"
              ${field.selected ? 'checked' : ''}>
            <label class="form-check-label" for="field-${field.InternalName}">
              ${field.Title}
            </label>
          </div>
        </div>
      `;
    });
    
    $("#standardFieldsCheckboxes .row").html(html);
    $("#standardFieldsCheckboxes").show();
  }

  /**
   * Filter and display fields based on current settings
   */
  filterAndDisplayFields() {
  // Reset view field filtering
  this.currentViewFields = [];

  // Determine selected view
  const selectedViewId = $("#viewSelector").val();
  if (selectedViewId) {
    this.loadViewFields(selectedViewId, this.currentListId);
    return;
  }

  // Splits velden op in 'gebruiker' en 'systeem'
  const userFields = this.currentListFields.filter(field => !field.isStandard);
  const systemFields = this.currentListFields.filter(field => field.isStandard);

  const createFieldHtml = (field) => `
    <tr>
      <td><input type="checkbox" class="export-field-checkbox" data-internal-name="${field.InternalName}" ${field.exportEnabled ? 'checked' : ''}></td>
      <td>${field.Title}</td>
      <td>${field.InternalName}</td>
      <td>${field.typeDescription}</td>
      <td>${field.Required ? '✅' : ''}</td>
      <td>${field.Description || ''}</td>
    </tr>
  `;

  let userFieldsHtml = userFields.map(createFieldHtml).join('');
  let systemFieldsHtml = systemFields.map(createFieldHtml).join('');

  const finalHtml = `
    <h6 class="mb-2 mt-4">Door gebruiker gemaakte velden</h6>
    <table class="table table-bordered table-sm mb-4">
      <thead>
        <tr>
          <th>Exporteren</th>
          <th>Weergavenaam</th>
          <th>InternalName</th>
          <th>Type</th>
          <th>Verplicht</th>
          <th>Beschrijving</th>
        </tr>
      </thead>
      <tbody>${userFieldsHtml || '<tr><td colspan="6" class="text-muted">Geen velden gevonden</td></tr>'}</tbody>
    </table>

    <h6 class="mb-2 mt-4">Door systeem gegenereerde velden</h6>
    <table class="table table-bordered table-sm">
      <thead>
        <tr>
          <th>Exporteren</th>
          <th>Weergavenaam</th>
          <th>InternalName</th>
          <th>Type</th>
          <th>Verplicht</th>
          <th>Beschrijving</th>
        </tr>
      </thead>
      <tbody>${systemFieldsHtml || '<tr><td colspan="6" class="text-muted">Geen systeemvelden gevonden</td></tr>'}</tbody>
    </table>
  `;

  $("#fieldsTableContainer").html(finalHtml);
}


  /**
   * Render field data in the table
   * @param {Array} fields - Fields to display
   */
  renderFieldData(fields) {
    if (fields.length === 0) {
      $("#fieldsTableContainer").html(
        '<div class="p-4 text-center text-muted">No fields selected or found.</div>'
      );
      return;
    }

    const sortedFields = [...fields].sort((a, b) => {
      if (a.Required && !b.Required) return -1;
      if (!a.Required && b.Required) return 1;
      return a.Title.localeCompare(b.Title);
    });

    let tableHtml = `
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              <th class="text-center">Export</th>
              <th>Title</th>
              <th>Internal Name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Required</th>
              <th>Unique</th>
              <th>Options/Settings</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedFields.forEach(field => {
      let optionsDisplay = '';
      if (field.MaxLength) {
        optionsDisplay += `<span class="badge bg-light text-dark me-1">Max Length: ${field.MaxLength}</span>`;
      }
      if (field.options && field.options.length > 0) {
        optionsDisplay += `<span class="badge bg-light text-dark me-1">${field.options.length} choices</span>`;
      }
      if (field.DefaultValue) {
        optionsDisplay += `<span class="badge bg-light text-dark me-1">Default: ${field.DefaultValue}</span>`;
      }
      if (field.Indexed) {
        optionsDisplay += `<span class="badge bg-info text-white me-1">Indexed</span>`;
      }
      if (field.ReadOnlyField) {
        optionsDisplay += `<span class="badge bg-secondary text-white me-1">Read-only</span>`;
      }

      tableHtml += `
        <tr class="${field.Hidden ? 'text-muted' : ''}">
          <td class="text-center">
            <div class="form-check form-switch d-flex justify-content-center">
              <input class="form-check-input field-export-switch"
                type="checkbox"
                role="switch"
                data-field-name="${field.InternalName}"
                id="export-${field.InternalName}"
                ${field.exportEnabled ? 'checked' : ''}>
            </div>
          </td>
          <td class="fw-medium">${field.Title}</td>
          <td><code>${field.InternalName}</code></td>
          <td>${field.typeDescription}</td>
          <td>${field.Description || '-'}</td>
          <td>${field.Required ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-muted"></i>'}</td>
          <td>${field.EnforceUniqueValues ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-muted"></i>'}</td>
          <td>${optionsDisplay || '-'}</td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
    `;

    $("#fieldsTableContainer").html(tableHtml);

    // Add event listener for export switches
    $(".field-export-switch").on("change", e => {
      const fieldName = $(e.target).data("field-name");
      const isChecked = $(e.target).prop("checked");
      const fieldIndex = this.currentListFields.findIndex(f => f.InternalName === fieldName);
      if (fieldIndex !== -1) {
        this.currentListFields[fieldIndex].exportEnabled = isChecked;
      }
      this.updateExportPreview();
    });
  }

  /**
   * Toggle export state for all fields
   * @param {boolean} state - Export state to set
   */
  toggleAllFieldExport(state) {
    this.currentListFields.forEach(field => {
      field.exportEnabled = state;
    });
    $(".field-export-switch").prop("checked", state);
    this.updateExportPreview();
    this.showNotification({
      type: 'info',
      title: state ? 'All Fields Selected' : 'All Fields Deselected',
      message: state ? 'All fields are now selected for export.' : 'All fields are now deselected.',
      icon: state ? 'fa-check-square' : 'fa-square',
      duration: MenuConfig.NOTIFICATION_CONFIG.infoDuration
    });
  }

  /**
   * Update the export preview
   */
  updateExportPreview() {
    const excludeStandard = $("#excludeStandardFieldsCheckbox").is(":checked");
    let exportFields = this.currentListFields.filter(field => field.exportEnabled);

    if (excludeStandard) {
      exportFields = exportFields.filter(field => !field.isStandard);
    }

    exportFields.sort((a, b) => a.Title.localeCompare(b.Title));
    const previewFields = exportFields.slice(0, this.exportPreviewCount);

    if (previewFields.length === 0) {
      $("#exportPreviewContainer").html(
        '<div class="text-center text-muted py-4">No fields selected for export.</div>'
      );
      return;
    }

    let csvPreview = 'Title,InternalName,Type,Required,Unique,Description\n';
    previewFields.forEach(field => {
      const title = field.Title.replace(/"/g, '""');
      const desc = (field.Description || '').replace(/"/g, '""');
      csvPreview += `"${title}","${field.InternalName}","${field.typeDescription}",` +
                    `"${field.Required ? 'Yes' : 'No'}","${field.EnforceUniqueValues ? 'Yes' : 'No'}","${desc}"\n`;
    });

    $("#exportPreviewContainer").html(`
      <div class="export-preview-header">
        <strong>Export Preview</strong>
        <span class="badge bg-primary rounded-pill">${exportFields.length} fields selected</span>
      </div>
      <div class="export-preview-content">
        <pre class="m-0 p-2 bg-light rounded">${csvPreview}</pre>
      </div>
      ${exportFields.length > this.exportPreviewCount ? 
        `<div class="text-end text-muted small mt-2">
          Showing ${this.exportPreviewCount} of ${exportFields.length} fields
        </div>` : ''}
    `);
  }

  /**
   * Export fields to CSV file
   */
  exportFields() {
    const excludeStandard = $("#excludeStandardFieldsCheckbox").is(":checked");
    let exportFields = this.currentListFields.filter(field => field.exportEnabled);

    if (excludeStandard) {
      exportFields = exportFields.filter(field => !field.isStandard);
    }

    if (exportFields.length === 0) {
      this.showNotification({
        type: 'warning',
        title: 'No Fields Selected',
        message: 'Please select at least one field for export.',
        icon: 'fa-exclamation-circle',
        duration: MenuConfig.NOTIFICATION_CONFIG.warningDuration
      });
      return;
    }

    exportFields.sort((a, b) => a.Title.localeCompare(b.Title));

    let csvContent = 'Title,InternalName,Type,Required,Unique,Description\n';
    exportFields.forEach(field => {
      const title = field.Title.replace(/"/g, '""');
      const desc = (field.Description || '').replace(/"/g, '""');
      csvContent += `"${title}","${field.InternalName}","${field.typeDescription}",` +
                    `"${field.Required ? 'Yes' : 'No'}","${field.EnforceUniqueValues ? 'Yes' : 'No'}","${desc}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const filename = `${this.currentListTitle.replace(/[^a-z0-9]/gi, '_')}_fields_${timestamp}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    this.showNotification({
      type: 'success',
      title: 'Export Complete',
      message: `Exported ${exportFields.length} fields to CSV.`,
      icon: 'fa-file-csv',
      duration: MenuConfig.NOTIFICATION_CONFIG.successDuration
    });
  }

  /**
   * Copy fields to clipboard
   */
  copyFieldsToClipboard() {
    const excludeStandard = $("#excludeStandardFieldsCheckbox").is(":checked");
    let exportFields = this.currentListFields.filter(field => field.exportEnabled);

    if (excludeStandard) {
      exportFields = exportFields.filter(field => !field.isStandard);
    }

    if (exportFields.length === 0) {
      this.showNotification({
        type: 'warning',
        title: 'No Fields Selected',
        message: 'Please select at least one field for copying.',
        icon: 'fa-exclamation-circle',
        duration: MenuConfig.NOTIFICATION_CONFIG.warningDuration
      });
      return;
    }

    exportFields.sort((a, b) => a.Title.localeCompare(b.Title));

    let csvContent = 'Title,InternalName,Type,Required,Unique,Description\n';
    exportFields.forEach(field => {
      const title = field.Title.replace(/"/g, '""');
      const desc = (field.Description || '').replace(/"/g, '""');
      csvContent += `"${title}","${field.InternalName}","${field.typeDescription}",` +
                    `"${field.Required ? 'Yes' : 'No'}","${field.EnforceUniqueValues ? 'Yes' : 'No'}","${desc}"\n`;
    });

    this.copyToClipboard(csvContent, `Copied ${exportFields.length} fields to clipboard`);
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @param {string} successMessage - Message to show on success
   */
  copyToClipboard(text, successMessage) {
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification({
        type: 'success',
        title: 'Copied to Clipboard',
        message: successMessage,
        icon: 'fa-clipboard-check',
        duration: MenuConfig.NOTIFICATION_CONFIG.successDuration
      });
    }).catch(err => {
      console.error("Failed to copy: ", err);
      this.showNotification({
        type: 'error',
        title: 'Copy Failed',
        message: 'There was an error copying to clipboard.',
        icon: 'fa-triangle-exclamation',
        duration: MenuConfig.NOTIFICATION_CONFIG.errorDuration
      });
    });
  }

  /**
   * Show a notification
   * @param {Object} options - Notification options
   */
  showNotification(options) {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    let container = document.getElementById('notificationContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notificationContainer';
      document.body.appendChild(container);
    }
    
    const settings = {
      type: options.type || 'info',
      title: options.title || 'Notification',
      message: options.message || '',
      icon: options.icon || 'fa-info-circle',
      duration: options.duration || MenuConfig.NOTIFICATION_CONFIG.defaultDuration
    };
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${settings.type} fade-in`;
    
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="fas ${settings.icon}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${settings.title}</div>
        <div class="notification-message">${settings.message}</div>
      </div>
      <button class="notification-dismiss" title="Dismiss">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    container.appendChild(notification);

    notification.querySelector('.notification-dismiss').addEventListener('click', () => {
      this.dismissNotification(notification);
    });
    
    this.notificationTimeout = setTimeout(() => {
      this.dismissNotification(notification);
    }, settings.duration);
    
    return notification;
  }

  /**
   * Dismiss a notification
   * @param {HTMLElement} notification - Notification element
   */
  dismissNotification(notification) {
    notification.style.animation = 'notification-disappear 0.3s forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// Attach one global instance to window, named sharePointExplorerInstance
document.addEventListener('DOMContentLoaded', function() {
  sharePointExplorerInstance = new SharePointExplorer();
  
  // If you have a debug panel
  const debugToggle = document.getElementById('debugToggle');
  const debugPanel = document.getElementById('debugPanel');
  
  if (debugToggle && debugPanel) {
    debugToggle.addEventListener('click', function() {
      debugPanel.classList.toggle('hidden');
      debugToggle.textContent = debugPanel.classList.contains('hidden') ? 'Show Debug' : 'Hide Debug';
      
      if (!debugPanel.classList.contains('hidden')) {
        updateDebugInfo();
      }
    });
  }
  
  function updateDebugInfo() {
    if (debugPanel.classList.contains('hidden')) return;
    document.getElementById('debugUrl').textContent = window.location.href;
    document.getElementById('debugApiUrl').textContent = document.body.getAttribute(MenuConfig.API_CONFIG.apiUrlAttribute);

    if (window.sharePointExplorerInstance) {
      try {
        const histJson = JSON.stringify(window.sharePointExplorerInstance.navigationHistory || []);
        document.getElementById('debugHistory').textContent =
          histJson.substring(0, 100) + (histJson.length > 100 ? '...' : '');
        
        const currentSite = window.sharePointExplorerInstance.currentSiteData 
          ? window.sharePointExplorerInstance.currentSiteData.url
          : 'Not available';
        document.getElementById('debugCurrentSite').textContent = currentSite;
      } catch (e) {
        document.getElementById('debugLog').textContent = e.message;
      }
    } else {
      document.getElementById('debugHistory').textContent = 'sharePointExplorerInstance not available';
    }
  }

  if (MenuConfig.DEBUG_CONFIG.enabled) {
    setInterval(updateDebugInfo, MenuConfig.DEBUG_CONFIG.updateInterval);
  }
});

export default SharePointExplorer;
