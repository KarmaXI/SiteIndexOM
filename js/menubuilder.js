import { MenuConfig } from "./MenuConfig.js";

// Create a shared instance of MenuBuilder that persists between navigations
let menuBuilderInstance = null;

class MenuBuilder {
  constructor() {
    this.apiUrl = null;
    this.useFontAwesomeCDN = false;
    this.currentListFields = [];
    this.currentListTitle = "";
    this.fieldsModal = null; // Store the modal instance
    this.currentViews = [];
    this.currentViewFields = [];
    this.exportPreviewCount = 10; // Default preview count for slider
    this.notificationTimeout = null; // Store timeout for notifications
    
    // Add navigation history tracking
    this.navigationHistory = [];
    this.currentSiteData = null;
  }

  init(apiUrl, useFontAwesomeCDN = false) {
    console.log("Initializing MenuBuilder with URL:", apiUrl);
    
    this.apiUrl = apiUrl;
    this.useFontAwesomeCDN = useFontAwesomeCDN;
    this.fieldsModal = new bootstrap.Modal(
      document.getElementById("fieldsModal")
    ); // Initialize modal

    // Display API URL for debugging
    this.showNotification({
      type: 'info',
      title: 'Initializing',
      message: `API URL: ${apiUrl}`,
      icon: 'fa-code',
      duration: 5000
    });

    // Initialize navigation history with the root site
    const rootSiteData = {
      url: apiUrl,
      title: "Home",
      isRoot: true
    };
    
    // Only add to history if it's a new navigation (not already in history)
    if (this.navigationHistory.length === 0) {
      this.navigationHistory.push(rootSiteData);
      this.currentSiteData = rootSiteData;
    }
    
    // Update breadcrumbs first
    this.updateBreadcrumbs();
    
    // Then load data
    this.loadLists(apiUrl);
    this.loadSubsites(apiUrl);
    this.setupEventListeners(); // Setup event listeners *once* during init
    this.setupThemeToggle();
  }

  setupThemeToggle() {
    // Check for saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }

    // Add event listener to theme toggle
    $('#themeToggle').on('click', () => {
      document.body.classList.toggle('dark-mode');
      // Save preference
      const isDarkMode = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      
      // Show notification
      this.showNotification({
        type: 'info',
        title: isDarkMode ? 'Dark Mode Enabled' : 'Light Mode Enabled',
        message: `Theme preference saved. You can change it anytime.`,
        icon: isDarkMode ? 'fa-moon' : 'fa-sun'
      });
    });
  }

  setupEventListeners() {
    // Event listener for the "Show Standard Fields" switch
    $("#showStandardFieldsSwitch").on("change", () => {
      this.filterAndDisplayFields(); // Re-filter and display
    });

    // Event delegation for standard field checkboxes
    $("#standardFieldsCheckboxes").on(
      "change",
      ".standard-field-checkbox",
      () => {
        this.filterAndDisplayFields(); // Update and re-display
      }
    );

    // Event listener for view selector
    $("#viewSelector").on("change", () => {
      this.filterFieldsBySelectedView();
    });

    // Event listener for exclude standard fields checkbox
    $("#excludeStandardFieldsCheckbox").on("change", () => {
      this.updateExportPreview();
    });

    // Event listener for export preview slider
    $("#exportPreviewSlider").on("input", (e) => {
      this.exportPreviewCount = parseInt(e.target.value);
      $("#exportPreviewCount").text(this.exportPreviewCount);
      this.updateExportPreview();
    });

    // Event listeners for export and copy buttons
    $("#exportFieldsBtn").on("click", () => this.exportFields());
    $("#copyFieldsBtn").on("click", () => this.copyFieldsToClipboard());
  }

  makeRequest(url, successCallback, errorCallback) {
    console.log("Making API request to:", url);
    
    // Show debug notification for each request
    this.showNotification({
      type: 'info',
      title: 'API Request',
      message: `Requesting: ${url.substring(0, 50)}...`,
      icon: 'fa-network-wired',
      duration: 2000
    });
    
    $.ajax({
      url: url,
      method: "GET",
      headers: { Accept: "application/json;odata=verbose" },
      xhrFields: { withCredentials: true },
      success: (data) => {
        console.log("API request succeeded:", data);
        if (successCallback) successCallback(data);
      },
      error: (xhr) => {
        console.error("API request failed:", xhr);
        // Show detailed error information
        this.showNotification({
          type: 'error',
          title: 'API Request Failed',
          message: `Error ${xhr.status}: ${xhr.statusText}`,
          icon: 'fa-triangle-exclamation',
          duration: 5000
        });
        if (errorCallback) errorCallback(xhr);
      },
    });
  }

  loadLists(siteUrl) {
    console.log("Loading lists for site:", siteUrl);
    
    // Ensure siteUrl ends with a slash for consistent API calls
    if (siteUrl && !siteUrl.endsWith('/')) {
      siteUrl += '/';
      console.log("URL adjusted to:", siteUrl);
    }
    
    // Clear existing lists first
    $("#listsContainer").html(
      '<div class="p-4 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>'
    );
    
    // Fix the API URL
    const apiEndpoint = siteUrl +
        "/_api/web/lists?$select=Title,ItemCount,Hidden,BaseTemplate,EffectiveBasePermissions,Id,DefaultViewUrl";
    
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
          
          console.log("Lists data received:", data.d.results);
          
          // Filter visible lists with read permissions
          const lists = data.d.results.filter(
            (list) =>
              !list.Hidden &&
              list.EffectiveBasePermissions &&
              (list.EffectiveBasePermissions.High > 0 ||
                list.EffectiveBasePermissions.Low > 0)
          );

          // Update counter
          $("#listsCount").text(lists.length);

          if (lists.length === 0) {
            $("#listsContainer").html(
              '<div class="p-4 text-center text-muted">No lists found</div>'
            );
            return;
          }

          // Build HTML - Fixed template string formatting
          let html = "";
          lists.forEach((list) => {
            const icon = list.BaseTemplate === 101 ? "fa-file-lines" : "fa-table";
            const listId = list.Id;
            const viewUrl = list.DefaultViewUrl;

            html += `
              <div class="list-item">
                <div>
                  <i class="fas ${icon} text-primary me-2"></i>
                  <span class="fw-bold list-title">
                    <a href="${viewUrl}" target="_blank">${list.Title}</a>
                  </span>
                  <button class="btn btn-sm btn-outline-primary ms-2"
                    data-list-id="${listId}" data-list-title="${list.Title}">
                    <i class="fas fa-list-ul"></i> Fields
                  </button>
                  <small class="text-muted d-block mt-1">GUID: ${listId}
                    <button class="btn btn-sm btn-outline-secondary ms-2 copy-guid-btn"
                            data-guid="${listId}"
                            title="Copy GUID">
                      <i class="fas fa-copy"></i>
                    </button>
                  </small>
                </div>
                <span class="badge badge-count">${list.ItemCount} items</span>
              </div>
            `;
          });

          $("#listsContainer").html(html);

          // Attach event listeners to the "Fields" buttons
          $("#listsContainer").on("click", ".btn-outline-primary", (event) => {
            const listId = $(event.currentTarget).data("list-id");
            const listTitle = $(event.currentTarget).data("list-title");
            this.showListFields(listId, listTitle);
          });

          // Attach event listener to the copy GUID icon
          // Replace alert() calls with notification logic
          $("#listsContainer").on("click", ".copy-guid-btn", (event) => {
            const guid = $(event.currentTarget).data("guid");
            navigator.clipboard.writeText(guid).then(() => {
              // Show success notification
              this.showNotification({
                type: 'success',
                title: 'GUID Copied',
                message: 'The GUID has been copied to your clipboard.',
                icon: 'fa-check'
              });
            }).catch((err) => {
              console.error("Failed to copy: ", err);
              // Show error notification
              this.showNotification({
                type: 'error',
                title: 'Copy Failed',
                message: 'There was an error copying the GUID to your clipboard.',
                icon: 'fa-triangle-exclamation'
              });
            });
            // Prevent event propagation
            event.stopPropagation();
          });
        } catch (error) {
          console.error("Error processing lists data:", error);
          $("#listsContainer").html(
            `<div class="p-4 text-center text-danger">Error processing lists data: ${error.message}</div>`
          );
          // Show error notification
          this.showNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to process lists data: ${error.message}`,
            icon: 'fa-triangle-exclamation'
          });
        }
      },
      (xhr) => {
        console.error("Failed to load lists:", xhr);
        $("#listsContainer").html(
          `<div class="p-4 text-center text-danger">Failed to load lists: ${xhr.status} ${xhr.statusText}</div>`
        );
        // Show error notification
        this.showNotification({
          type: 'error',
          title: 'Connection Error',
          message: `Failed to load lists from SharePoint (${xhr.status}: ${xhr.statusText})`,
          icon: 'fa-wifi'
        });
      }
    );
  }

  loadSubsites(siteUrl) {
    console.log("Loading subsites for site:", siteUrl);
    
    // Ensure siteUrl ends with a slash for consistent API calls
    if (siteUrl && !siteUrl.endsWith('/')) {
      siteUrl += '/';
      console.log("URL adjusted to:", siteUrl);
    }
    
    // Clear existing subsites first
    $("#subsitesContainer").html(
      '<div class="p-4 text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>'
    );
    
    const apiEndpoint = siteUrl +
        "/_api/web/GetSubwebsFilteredForCurrentUser(nWebTemplateFilter=-1)";
        
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
          
          console.log("Subsites data received:", data.d.results);
          const subsites = data.d.results;

          // Update counter
          $("#subsitesCount").text(subsites.length);

          if (!subsites || subsites.length === 0) {
            $("#subsitesContainer").html(
              '<div class="p-4 text-center text-muted">No subsites found</div>'
            );
            return;
          }

          // Build HTML - Fixed template string formatting
          let html = "";
          subsites.forEach((subsite) => {
            const escapedTitle = subsite.Title.replace(/'/g, "\\'");
            
            html += `
              <div class="list-item">
                <div>
                  <i class="fas fa-folder text-primary me-2"></i>
                  <span class="fw-bold">${subsite.Title}</span>
                  <small class="text-muted d-block mt-1">${subsite.ServerRelativeUrl}</small>
                </div>
                <button class="btn btn-sm btn-action navigate-to-subsite"
                  data-url="${subsite.ServerRelativeUrl}" 
                  data-title="${escapedTitle}">
                  <i class="fas fa-arrow-right me-1"></i> View
                </button>
              </div>
            `;
          });

          $("#subsitesContainer").html(html);
          
          // Clean up any existing event handlers to avoid duplicates
          $("#subsitesContainer").off("click", ".navigate-to-subsite");
          
          // Attach event listeners to the subsite navigation buttons
          $("#subsitesContainer").on("click", ".navigate-to-subsite", (event) => {
            const url = $(event.currentTarget).data("url");
            const title = $(event.currentTarget).data("title");
            
            console.log("Navigating to subsite:", url, title);
            this.navigateToSubsite(url, title);
          });
        } catch (error) {
          console.error("Error processing subsites data:", error);
          $("#subsitesContainer").html(
            `<div class="p-4 text-center text-danger">Error processing subsites: ${error.message}</div>`
          );
          // Show error notification
          this.showNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to process subsites data: ${error.message}`,
            icon: 'fa-triangle-exclamation'
          });
        }
      },
      (xhr) => {
        console.error("Failed to load subsites:", xhr);
        $("#subsitesContainer").html(
          `<div class="p-4 text-center text-danger">Failed to load subsites: ${xhr.status} ${xhr.statusText}</div>`
        );
        // Show error notification
        this.showNotification({
          type: 'error',
          title: 'Connection Error',
          message: `Failed to load subsites from SharePoint (${xhr.status}: ${xhr.statusText})`,
          icon: 'fa-wifi'
        });
      }
    );
  }
  
  // New method to navigate to a subsite
  navigateToSubsite(url, title) {
    console.log("NavigateToSubsite called with:", url, title);
    
    // Ensure the URL has the correct format
    // Make sure it's an absolute URL with the same base as the current site
    const baseUrl = window.location.origin;
    let fullUrl = url;
    
    // If the URL doesn't start with the base URL, add it
    if (!url.includes('://')) {
      if (url.startsWith('/')) {
        fullUrl = baseUrl + url;
      } else {
        fullUrl = baseUrl + '/' + url;
      }
    }
    
    console.log("Full URL for navigation:", fullUrl);
    
    // Update the site path display
    $("#currentSiteUrl").text(url);
    
    // Create new site data
    const siteData = {
      url: url, // Store the server-relative URL
      title: title,
      isRoot: false
    };
    
    // Check if we're navigating to a site that's already in our history
    const existingIndex = this.findSiteInHistory(url);
    
    if (existingIndex !== -1) {
      // If we're navigating to a site in history, truncate the history at that point
      this.navigationHistory = this.navigationHistory.slice(0, existingIndex + 1);
      console.log("Truncated history to existing site at index:", existingIndex);
    } else {
      // Add new site to navigation history
      this.navigationHistory.push(siteData);
      console.log("Added new site to history:", siteData);
    }
    
    // Update current site
    this.currentSiteData = siteData;
    
    // Update breadcrumbs
    this.updateBreadcrumbs();
    
    // Load lists and subsites for the selected site
    this.loadLists(url);
    this.loadSubsites(url);
    
    // Show notification
    this.showNotification({
      type: 'info',
      title: 'Subsite Loaded',
      message: `Viewing subsite: ${title}`,
      icon: 'fa-folder-open',
      duration: 3000
    });
  }
  
  // Find a site in history by URL
  findSiteInHistory(url) {
    for (let i = 0; i < this.navigationHistory.length; i++) {
      if (this.navigationHistory[i].url === url) {
        return i;
      }
    }
    return -1;
  }
  
  // Update breadcrumbs based on navigation history
  updateBreadcrumbs() {
    console.log("Updating breadcrumbs with history:", this.navigationHistory);
    
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
    console.log("Breadcrumb HTML updated");
    
    // Clean up existing event handlers to avoid duplicates
    $("#breadcrumbContainer").off("click", ".breadcrumb-link");
    
    // Attach event listeners to breadcrumb links
    $("#breadcrumbContainer").on("click", ".breadcrumb-link", (event) => {
      event.preventDefault();
      const index = $(event.currentTarget).data("index");
      console.log("Breadcrumb clicked for index:", index);
      
      const site = this.navigationHistory[index];
      if (!site) {
        console.error("No site found at index:", index);
        return;
      }
      
      // Navigate to the selected site
      this.navigateToSubsite(site.url, site.title);
    });
  }

  showListFields(listId, listTitle) {
    // Set up modal
    $("#fieldsModalLabel").text(`Fields in "${listTitle}"`);
    $("#fieldsTableContainer").html(
      `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`
    );

    // Reset the switches and selectors
    $("#showStandardFieldsSwitch").prop("checked", false);
    $("#excludeStandardFieldsCheckbox").prop("checked", true);
    $("#standardFieldsCheckboxes")
      .hide()
      .find(".standard-field-checkbox")
      .prop("checked", false);
      
    // Add export controls section to the modal
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
        
      // Add event listeners for the select/deselect all buttons
      $("#selectAllFieldsBtn").on("click", () => this.toggleAllFieldExport(true));
      $("#deselectAllFieldsBtn").on("click", () => this.toggleAllFieldExport(false));
    }
    
    $("#viewSelector").html('<option value="">Loading...</option>');
    
    // Reset export preview slider
    $("#exportPreviewSlider").val(10);
    $("#exportPreviewCount").text(10);
    this.exportPreviewCount = 10;
    
    // Clear export preview
    $("#exportPreviewContainer").html('<div class="text-center text-muted py-4">Export preview will appear here.</div>');

    // Show modal
    this.fieldsModal.show();

    // Load fields data and views
    this.currentListTitle = listTitle;
    this.loadFullFieldData(listId);
  }

  loadFullFieldData(listId) {
    // Use Promise.all to handle multiple requests concurrently
    Promise.all([
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${this.apiUrl}/_api/web/lists(guid'${listId}')/fields?$select=Title,InternalName,TypeAsString,Hidden,Description,Required,EnforceUniqueValues,MaxLength,Choices,DefaultValue,ValidationFormula,ValidationMessage,Indexed,ReadOnlyField`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${this.apiUrl}/_api/web/lists(guid'${listId}')?$select=EnableAttachments,EnableFolderCreation,EnableVersioning,MajorVersionLimit,EnableMinorVersions,MinorVersionLimit`,
          (data) => resolve(data.d),
          (xhr) => reject(xhr)
        );
      }),
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${this.apiUrl}/_api/web/lists(guid'${listId}')/contenttypes?$select=Name,Description,Id`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
      new Promise((resolve, reject) => {
        this.makeRequest(
          `${this.apiUrl}/_api/web/lists(guid'${listId}')/views?$select=Title,DefaultView,PersonalView,ViewQuery,Id`,
          (data) => resolve(data.d.results),
          (xhr) => reject(xhr)
        );
      }),
    ])
      .then(([fields, listProps, contentTypes, views]) => {
        // Process and store the combined data
        this.currentListFields = fields.map((field) => ({
          ...field,
          isStandard:
            field.InternalName.match(/^[a-zA-Z0-9_]+$/) && field.Hidden, // Identify standard fields
          selected: !field.Hidden, // Initially select only non-hidden fields
          typeDescription: this.getFieldTypeDescription(field.TypeAsString),
          options:
            (field.TypeAsString === "Choice" ||
              field.TypeAsString === "MultiChoice") &&
            field.Choices
              ? field.Choices.results
              : [],
        }));

        this.listProperties = listProps;
        this.contentTypes = contentTypes;
        this.currentViews = views;

        // Populate view selector
        this.populateViewSelector(views);
        
        // Load view fields for the default view
        const defaultView = views.find(view => view.DefaultView) || views[0];
        if (defaultView) {
          this.loadViewFields(defaultView.Id, listId);
        }

        this.filterAndDisplayFields(); // Initial display
        this.generateStandardFieldCheckboxes();
        this.updateExportPreview(); // Initialize export preview
      })
      .catch((error) => {
        console.error("Error loading full field data:", error);
        $("#fieldsTableContainer").html(
          '<div class="p-4 text-center text-danger">Error loading field data.</div>'
        );
        $("#viewSelector").html('<option value="">No views available</option>');
        
        // Show error notification
        this.showNotification({
          type: 'error',
          title: 'Data Loading Error',
          message: 'Failed to load field data for the selected list.',
          icon: 'fa-database'
        });
      });
  }

  populateViewSelector(views) {
    let options = '<option value="">-- All Fields --</option>';
    
    views.forEach(view => {
      const isDefault = view.DefaultView ? ' (Default)' : '';
      options += `<option value="${view.Id}"${view.DefaultView ? ' selected' : ''}>${view.Title}${isDefault}</option>`;
    });
    
    $("#viewSelector").html(options);
  }

  loadViewFields(viewId, listId) {
    this.makeRequest(
      `${this.apiUrl}/_api/web/lists(guid'${listId}')/views(guid'${viewId}')/viewfields`,
      (data) => {
        if (data.d && data.d.Items && data.d.Items.results) {
          this.currentViewFields = data.d.Items.results;
          this.filterFieldsBySelectedView();
        }
      },
      (error) => {
        console.error("Error loading view fields:", error);
        // Fall back to showing all fields
        this.currentViewFields = [];
        this.filterAndDisplayFields();
        
        // Show warning notification
        this.showNotification({
          type: 'warning',
          title: 'View Data Incomplete',
          message: 'Could not load fields for the selected view. Displaying all fields instead.',
          icon: 'fa-exclamation-circle'
        });
      }
    );
  }

  filterFieldsBySelectedView() {
    const selectedViewId = $("#viewSelector").val();
    
    if (!selectedViewId) {
      // If no view is selected, show all fields based on standard fields setting
      this.filterAndDisplayFields();
      return;
    }
    
    // Load fields for the selected view
    const listId = this.currentListFields.length > 0 ? 
      this.currentListFields[0].ListId : 
      window.location.href.match(/guid='([^']+)'/)[1];
    
    this.loadViewFields(selectedViewId, listId);
  }

  generateStandardFieldCheckboxes() {
    const standardFields = this.currentListFields.filter(
      (field) => field.isStandard
    );
    let html = "";
    standardFields.forEach((field) => {
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
  }

  filterAndDisplayFields() {
    const showStandard = $("#showStandardFieldsSwitch").is(":checked");
    const selectedViewId = $("#viewSelector").val();

    let displayedFields = this.currentListFields.filter((field) => {
      // Filter by standard field setting
      if (!showStandard && field.isStandard) {
        return false; // Hide standard fields if switch is off
      }
      if (showStandard && field.isStandard) {
        // If switch is on, respect checkbox state
        return $(`#field-${field.InternalName}`).is(":checked");
      }
      return true; // Show custom fields
    });

    // Filter by selected view if applicable
    if (selectedViewId && this.currentViewFields.length > 0) {
      displayedFields = displayedFields.filter(field => 
        this.currentViewFields.includes(field.InternalName)
      );
    }

    this.renderFieldData(displayedFields);
    this.updateExportPreview();
  }

  renderFieldData(fields) {
    if (fields.length === 0) {
      $("#fieldsTableContainer").html(
        '<div class="p-4 text-center text-muted">No fields selected or found.</div>'
      );
      return;
    }

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
              <th>Max Length</th>
            </tr>
          </thead>
          <tbody>
    `;

    fields.forEach((field) => {
      // Add exportEnabled property if it doesn't exist
      if (field.exportEnabled === undefined) {
        field.exportEnabled = true; // Default to enabled
      }

      tableHtml += `
        <tr>
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