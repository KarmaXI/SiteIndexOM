<%@ Page Language="C#" %>
<!DOCTYPE html>
<html lang="nl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SharePoint Explorer</title>

    <!-- Modern Font -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />

    <!-- Bootstrap CSS -->
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65"
      crossorigin="anonymous"
    />

    <!-- Font Awesome -->
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
    />

    <!-- Primary CSS (menubuilder + style) -->
    <link rel="stylesheet" href="css/menubuilder.css" />
    <link rel="stylesheet" href="css/stijl.css" />

    <link rel="icon" href="favicon.ico" type="image/x-icon" />

    <!-- Add debug CSS for testing -->
    <style>
      /* Debugging styles */
      .debug-info {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        color: #00ff00;
        font-family: monospace;
        font-size: 12px;
        padding: 8px;
        z-index: 9999;
        max-height: 120px;
        overflow-y: auto;
      }

      .debug-info.hidden {
        display: none;
      }

      .debug-toggle {
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: #333;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        font-size: 12px;
        z-index: 10000;
        cursor: pointer;
      }
    </style>
  </head>
  <body data-api-url="https://som.org.om.local/sites/MulderT">
    <!-- Debug panel toggle -->
    <button class="debug-toggle" id="debugToggle">Show Debug</button>

    <!-- Debug info panel -->
    <div class="debug-info hidden" id="debugPanel">
      <div><strong>URL: </strong><span id="debugUrl"></span></div>
      <div><strong>API URL: </strong><span id="debugApiUrl"></span></div>
      <div><strong>History: </strong><span id="debugHistory"></span></div>
      <div><strong>Current Site: </strong><span id="debugCurrentSite"></span></div>
      <div><strong>Log: </strong><span id="debugLog"></span></div>
    </div>

    <!-- Theme toggle - Visible in header -->
    <div class="position-fixed top-0 end-0 p-3 z-index-10">
      <div id="themeToggle" class="theme-toggle" title="Toggle Dark Mode"></div>
    </div>

    <div class="header">
      <div class="container">
        <h1>
          <i class="fas fa-sitemap"></i> SharePoint Explorer
        </h1>
        <p class="text-white-50 mt-2 mb-0 d-none d-md-block">
          Navigeer door lijsten en subwebsites
        </p>
      </div>
    </div>

    <div class="container mt-4">
      <!-- Settings Row -->
      <div class="row mb-4">
        <div class="col-md-12">
          <div class="card shadow-sm">
            <div class="card-body">
              <h5 class="card-title">
                <i class="fas fa-cog me-2"></i> Settings
              </h5>
              <div class="form-check form-switch mt-3">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="showHiddenToggle"
                  role="switch"
                />
                <label class="form-check-label" for="showHiddenToggle">
                  Show hidden lists and libraries
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Path and Breadcrumbs Row -->
      <div class="row align-items-center mb-4">
        <div class="col-md-6">
          <div class="site-path">
            <i class="fas fa-link me-2 text-primary"></i>
            <span id="currentSiteUrl">
              https://som.org.om.local/sites/MulderT/
            </span>
          </div>
        </div>
        <div class="col-md-6">
          <div id="breadcrumbContainer">
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb mb-0">
                <!-- Breadcrumbs will be dynamically populated -->
              </ol>
            </nav>
          </div>
        </div>
      </div>

      <!-- Lists and Subsites Row -->
      <div class="row">
        <div class="col-md-6">
          <div class="list-container">
            <div class="list-header">
              <span>
                <i class="fas fa-list"></i> Lists
              </span>
              <span class="badge" id="listsCount">0</span>
            </div>
            <div id="listsContainer" class="list-group slide-in-up"></div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="list-container">
            <div class="list-header">
              <span>
                <i class="fas fa-folder"></i> Subsites
              </span>
              <span class="badge" id="subsitesCount">0</span>
            </div>
            <div id="subsitesContainer" class="list-group slide-in-up"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fields Modal -->
    <div
      class="modal fade"
      id="fieldsModal"
      tabindex="-1"
      aria-labelledby="fieldsModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="fieldsModalLabel">List Fields</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <!-- View Selector -->
            <div class="mb-3">
              <label for="viewSelector" class="form-label fw-medium"
                >Select View:</label
              >
              <select class="form-select" id="viewSelector">
                <option value="">-- All Fields --</option>
              </select>
              <small class="text-muted"
                >Select a view to display only fields within that view</small
              >
            </div>

            <!-- Standard Fields Controls -->
            <div class="row mb-3">
              <div class="col-md-6">
                <div class="form-check form-switch">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="showStandardFieldsSwitch"
                    role="switch"
                  />
                  <label
                    class="form-check-label"
                    for="showStandardFieldsSwitch"
                    >Show standard SharePoint fields</label
                  >
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="excludeStandardFieldsCheckbox"
                    checked
                  />
                  <label
                    class="form-check-label"
                    for="excludeStandardFieldsCheckbox"
                    >Exclude standard fields when exporting</label
                  >
                </div>
              </div>
            </div>

            <!-- Export Controls Container -->
            <div id="exportControlsContainer" class="mb-3">
              <!-- Dynamically populated via JS -->
            </div>

            <!-- Standard Fields Selection -->
            <div
              id="standardFieldsCheckboxes"
              class="mb-3"
              style="display: none"
            >
              <h6 class="mb-3">Select Standard Fields:</h6>
              <div class="row"></div>
            </div>

            <!-- Export Preview Slider -->
            <div class="mb-3">
              <label
                for="exportPreviewSlider"
                class="form-label fw-medium d-flex justify-content-between"
              >
                <span>Export Preview</span>
                <span class="badge bg-primary rounded-pill" id="exportPreviewCount"
                  >10</span
                >
              </label>
              <input
                type="range"
                class="form-range"
                id="exportPreviewSlider"
                min="1"
                max="50"
                value="10"
              />
            </div>

            <!-- Export Preview Container -->
            <div id="exportPreviewContainer" class="export-preview-container mb-3">
              <div class="text-center text-muted py-4">
                Export preview will appear here.
              </div>
            </div>

            <!-- Fields Table -->
            <div id="fieldsTableContainer"></div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              <i class="fas fa-times me-1"></i> Close
            </button>
            <button type="button" class="btn btn-success" id="copyFieldsBtn">
              <i class="fas fa-copy me-1"></i> Copy
            </button>
            <button type="button" class="btn btn-primary" id="exportFieldsBtn">
              <i class="fas fa-download me-1"></i> Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification container -->
    <div id="notificationContainer"></div>

    <!-- jQuery + Bootstrap JS -->
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.3/jquery.min.js"
      integrity="sha512-STof4xm1wgkfm7heWqFJVn58Hm3EtS31XFaagaa8VMReCXAkQnJZ+jEy8PCC/iT18dFy95WcExNHFTqLyp72eQ=="
      crossorigin="anonymous"
      referrerpolicy="no-referrer"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"
      integrity="sha384-kenU1KFdBIe4zVF0s0G1M5b4hcpxyD9F7jL+jjXkk+Q2h455rYXK/7HAuoJl+0I4"
      crossorigin="anonymous"
    ></script>

    <!-- Import config file -->
    <script type="module" src="js/MenuConfig.js"></script>

    <!-- Import main SharePoint Explorer script -->
    <script type="module" src="js/sharepoint-explorer.js"></script>

    <!-- Repeat the CSS references at the end to match the original pattern -->
  </body>
</html>
