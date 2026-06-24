/**
 * Demise Message Builder PWA - Frontend Application Logic
 * Premium vanilla JS implementation with offline draft caching.
 */

// Connection endpoint (Configure your Google Apps Script URL here or set it in the PWA help panel)
let GAS_WEBAPP_URL = localStorage.getItem('demise_gas_url') || "";

// Default Static Data (used as fallback when offline or if Apps Script endpoint is not yet connected)
const DEFAULT_CONFIG = {
  settings: {
    APP_NAME: "Demise Message Builder",
    APP_VERSION: "1.0.0",
    DEFAULT_LANGUAGE: "English",
    ENABLE_AI: "TRUE",
    BRANDING_NAME: "Jigar Pradip Mehta",
    BRANDING_PHONE: "9898393487",
    WHATSAPP_SHARE_ENABLED: "TRUE"
  },
  templates: [
    {
      TemplateID: "TEM001",
      TemplateVersion: "V1",
      TemplateName: "Traditional English",
      Language: "English",
      Community: "All",
      IsActive: "TRUE",
      TemplateBody: `🕯️ *DEMISE ANNOUNCEMENT* 🕯️\n\nWith profound grief and sorrow, we inform you about the sad demise of our beloved *{{DECEASED_NAME}}* on {{DATE_OF_DEMISE}} at {{PLACE_OF_DEMISE}}.\n\n*Deceased Details:*\n• Name: *{{DECEASED_NAME}}*\n• Age: {{AGE}} years\n{{DATE_OF_BIRTH_BLOCK}}\n\n{{RELATIONS}}\n\n*Ceremony Details:*\n{{LAST_RITES}}\n\n{{BESNA}}\n\n{{NO_LAUKIK}}\n\n{{CUSTOM_SECTIONS}}\n\n*Condolence Contacts:*\n{{CONDOLENCE_CONTACTS}}\n\n🙏 *Pranam / Prayers* 🙏`
    },
    {
      TemplateID: "TEM002",
      TemplateVersion: "V1",
      TemplateName: "Short Condolence",
      Language: "English",
      Community: "All",
      IsActive: "TRUE",
      TemplateBody: `🕯️ *SAD DEMISE* 🕯️\n\nWe regret to inform you of the passing of *{{DECEASED_NAME}}* (Age: {{AGE}}) on {{DATE_OF_DEMISE}}.\n\n{{RELATIONS}}\n\n{{BESNA}}\n\n*Condolence Contacts:*\n{{CONDOLENCE_CONTACTS}}\n\n🙏 May their soul rest in eternal peace.`
    }
  ],
  relations: [
    { RelationKey: "SPOUSE", English: "Spouse", MaleLabel: "Wife", FemaleLabel: "Husband", DisplayStyle: "INLINE", DefaultOrder: 1 },
    { RelationKey: "SON", English: "Son", MaleLabel: "Father of", FemaleLabel: "Mother of", DisplayStyle: "MULTILINE", DefaultOrder: 2 },
    { RelationKey: "DAUGHTER", English: "Daughter", MaleLabel: "Father of", FemaleLabel: "Mother of", DisplayStyle: "MULTILINE", DefaultOrder: 3 },
    { RelationKey: "DAUGHTER_IN_LAW", English: "Daughter-in-Law", MaleLabel: "Father-in-Law of", FemaleLabel: "Mother-in-Law of", DisplayStyle: "INLINE", DefaultOrder: 4 },
    { RelationKey: "SON_IN_LAW", English: "Son-in-Law", MaleLabel: "Father-in-Law of", FemaleLabel: "Mother-in-Law of", DisplayStyle: "INLINE", DefaultOrder: 5 },
    { RelationKey: "GRANDCHILDREN", English: "Grandchildren", MaleLabel: "Grandfather of", FemaleLabel: "Grandmother of", DisplayStyle: "BULLETS", DefaultOrder: 6 },
    { RelationKey: "BROTHER", English: "Brother", MaleLabel: "Brother of", FemaleLabel: "Sister-in-Law of", DisplayStyle: "INLINE", DefaultOrder: 7 },
    { RelationKey: "SISTER", English: "Sister", MaleLabel: "Brother-in-Law of", FemaleLabel: "Sister of", DisplayStyle: "INLINE", DefaultOrder: 8 }
  ],
  communities: [
    { CommunityID: "COM001", CommunityName: "Palanpuri Samaj", DisplayOrder: 1, Active: "TRUE" },
    { CommunityID: "COM002", CommunityName: "Dhanera Samaj", DisplayOrder: 2, Active: "TRUE" },
    { CommunityID: "COM003", CommunityName: "Tharad Samaj", DisplayOrder: 3, Active: "TRUE" },
    { CommunityID: "COM004", CommunityName: "Gadh Samaj", DisplayOrder: 4, Active: "TRUE" },
    { CommunityID: "COM005", CommunityName: "12 Gam Samaj", DisplayOrder: 5, Active: "TRUE" },
    { CommunityID: "COM010", CommunityName: "Custom", DisplayOrder: 10, Active: "TRUE" }
  ]
};

// Global App State
let appState = {
  config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)), // Cloned default config
  currentStep: 1,
  draft: {
    deceasedName: "",
    gender: "Male",
    age: "",
    dateOfDemise: "",
    placeOfDemise: "",
    dateOfBirth: "",
    community: "Custom",
    customCommunity: "",
    photoBase64: null,
    additionalNotes: "",
    relations: [],
    besnaAddress: "",
    besnaDate: "",
    besnaTime: "",
    ritesAddress: "",
    ritesDate: "",
    ritesTime: "",
    mapLink: "",
    noLaukik: true,
    contacts: [],
    customSections: [],
    selectedTemplateId: "TEM001",
    selectedTemplateVersion: "V1"
  },
  cropState: {
    img: null,
    scale: 1.0,
    rotation: 0,
    x: 0,
    y: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  }
};

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('Service Worker registered successfully.', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// Startup Initialization
document.addEventListener("DOMContentLoaded", () => {
  initFontAdjuster();
  initFormNavigation();
  initRelationsEngine();
  initContactsEngine();
  initSectionsEngine();
  initImageCropper();
  initSharingActions();
  
  // Try fetching configuration from GAS Web App
  fetchConfigData();
  
  // Check for auto-saved draft
  setTimeout(checkForDraft, 300);
});

// Font Size Adjuster Logic
function initFontAdjuster() {
  const root = document.documentElement;
  let currentSize = parseInt(localStorage.getItem("fontSize") || "16");
  root.style.setProperty("--base-font-size", currentSize + "px");
  
  document.getElementById("btn-font-inc").addEventListener("click", () => {
    if (currentSize < 24) {
      currentSize += 1;
      root.style.setProperty("--base-font-size", currentSize + "px");
      localStorage.setItem("fontSize", currentSize);
    }
  });
  
  document.getElementById("btn-font-dec").addEventListener("click", () => {
    if (currentSize > 13) {
      currentSize -= 1;
      root.style.setProperty("--base-font-size", currentSize + "px");
      localStorage.setItem("fontSize", currentSize);
    }
  });
}

// Fetch database configuration from Google Apps Script Web App
function fetchConfigData() {
  if (!GAS_WEBAPP_URL) {
    console.log("No Apps Script URL configured. Using offline default config.");
    setupCommunityDropdown();
    setupTemplatesDropdown();
    
    // Expose AI Optimizer panel if enabled in default config
    const enableAI = String(appState.config.settings.ENABLE_AI).toUpperCase() === 'TRUE';
    document.getElementById("ai-card-wrapper").style.display = enableAI ? "flex" : "none";
    
    updateLivePreview();
    return;
  }
  
  const url = `${GAS_WEBAPP_URL}?action=getData`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log("Fetched database config successfully:", data);
        appState.config = data;
        
        // Cache in localStorage for offline launches
        localStorage.setItem("demise_config_cache", JSON.stringify(data));
        
        // Update components
        setupCommunityDropdown();
        setupTemplatesDropdown();
        setupRelationSuggestions();
        
        // Expose AI Optimizer panel if enabled
        const enableAI = String(data.settings.ENABLE_AI).toUpperCase() === 'TRUE';
        document.getElementById("ai-card-wrapper").style.display = enableAI ? "flex" : "none";
        
        updateLivePreview();
        showToast("Configurations synced online!");
      } else {
        console.warn("GAS endpoint returned failure: ", data.error);
        loadCachedConfig();
      }
    })
    .catch(err => {
      console.error("Failed to connect to Apps Script: ", err);
      loadCachedConfig();
    });
}

function loadCachedConfig() {
  const cached = localStorage.getItem("demise_config_cache");
  if (cached) {
    console.log("Loading configurations from offline cache.");
    appState.config = JSON.parse(cached);
  } else {
    console.log("No cache found. Using built-in config fallback.");
  }
  setupCommunityDropdown();
  setupTemplatesDropdown();
  setupRelationSuggestions();
  
  // Expose AI Optimizer panel if enabled in cached or fallback config
  const enableAI = String(appState.config.settings.ENABLE_AI).toUpperCase() === 'TRUE';
  document.getElementById("ai-card-wrapper").style.display = enableAI ? "flex" : "none";
  
  updateLivePreview();
}

// Setup Form Communities Dropdown
function setupCommunityDropdown() {
  // Clone the select element to remove any previously attached duplicate listeners
  const oldSelect = document.getElementById("community-select");
  const select = oldSelect.cloneNode(false); // clone without children
  oldSelect.parentNode.replaceChild(select, oldSelect);
  select.id = "community-select";
  
  const originalVal = appState.draft.community || "Custom";
  
  // Populate options
  select.innerHTML = '<option value="Custom">Custom / Enter manually...</option>';
  
  appState.config.communities.forEach(com => {
    if (com.CommunityName !== "Custom") {
      const opt = document.createElement("option");
      opt.value = com.CommunityName;
      opt.textContent = com.CommunityName;
      select.appendChild(opt);
    }
  });
  
  // Restore value
  if (select.querySelector(`option[value="${originalVal}"]`)) {
    select.value = originalVal;
  } else {
    select.value = "Custom";
  }
  
  // Show/hide custom input based on restored value
  const customGrp = document.getElementById("custom-community-group");
  customGrp.style.display = (select.value === "Custom") ? "block" : "none";
  
  select.addEventListener("change", (e) => {
    if (e.target.value === "Custom") {
      customGrp.style.display = "block";
    } else {
      customGrp.style.display = "none";
    }
    appState.draft.community = e.target.value;
    autoSaveDraft();
    updateLivePreview();
  });
}

// Setup Templates Dropdown
function setupTemplatesDropdown() {
  // Clone to clear any previously attached duplicate listeners
  const oldSelect = document.getElementById("template-select");
  const select = oldSelect.cloneNode(false);
  oldSelect.parentNode.replaceChild(select, oldSelect);
  select.id = "template-select";
  
  const originalVal = appState.draft.selectedTemplateId || "TEM001";
  select.innerHTML = "";
  
  appState.config.templates.forEach(tpl => {
    const opt = document.createElement("option");
    opt.value = tpl.TemplateID;
    opt.textContent = `${tpl.TemplateName} (${tpl.TemplateVersion || 'V1'})`;
    select.appendChild(opt);
  });
  
  if (originalVal && select.querySelector(`option[value="${originalVal}"]`)) {
    select.value = originalVal;
  }
  
  select.addEventListener("change", (e) => {
    appState.draft.selectedTemplateId = e.target.value;
    
    const tplObj = appState.config.templates.find(t => t.TemplateID === e.target.value);
    if (tplObj) {
      appState.draft.selectedTemplateVersion = tplObj.TemplateVersion || "V1";
    }
    
    autoSaveDraft();
    updateLivePreview();
  });
}

// Wizard Steps Logic
function initFormNavigation() {
  const tabs = document.querySelectorAll(".step-tab");
  const panels = document.querySelectorAll(".step-panel");
  const btnNext = document.getElementById("btn-next");
  const btnPrev = document.getElementById("btn-prev");
  
  function setStep(step) {
    if (step < 1 || step > 4) return;
    
    appState.currentStep = step;
    
    // Update Tab UI
    tabs.forEach(tab => {
      const tabStep = parseInt(tab.getAttribute("data-step"));
      if (tabStep === step) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
    
    // Update Panels UI
    panels.forEach(panel => {
      const panelId = panel.getAttribute("id");
      if (panelId === `panel-step-${step}`) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });
    
    // Navigation Buttons
    btnPrev.style.visibility = step === 1 ? "hidden" : "visible";
    
    if (step === 4) {
      btnNext.innerHTML = "Check Preview &rarr;";
    } else {
      btnNext.innerHTML = "Next &rarr;";
    }
    
    // Scroll form to top
    document.querySelector(".form-pane").scrollTop = 0;
  }
  
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetStep = parseInt(tab.getAttribute("data-step"));
      if (validateStep(appState.currentStep) || targetStep < appState.currentStep) {
        setStep(targetStep);
      }
    });
  });
  
  btnNext.addEventListener("click", () => {
    if (validateStep(appState.currentStep)) {
      if (appState.currentStep < 4) {
        setStep(appState.currentStep + 1);
      } else {
        // Desktop handles split, mobile scroll to preview
        if (window.innerWidth <= 900) {
          document.querySelector(".preview-pane").scrollIntoView({ behavior: 'smooth' });
        }
        showToast("Review announcement preview!");
      }
    }
  });
  
  btnPrev.addEventListener("click", () => {
    if (appState.currentStep > 1) {
      setStep(appState.currentStep - 1);
    }
  });
  
  // Connect Form Data to State
  const formInputs = [
    { id: "deceased-name", key: "deceasedName" },
    { id: "deceased-age", key: "age" },
    { id: "date-of-demise", key: "dateOfDemise" },
    { id: "place-of-demise", key: "placeOfDemise" },
    { id: "date-of-birth", key: "dateOfBirth" },
    { id: "custom-community", key: "customCommunity" },
    { id: "additional-notes", key: "additionalNotes" },
    
    { id: "besna-address", key: "besnaAddress" },
    { id: "besna-date", key: "besnaDate" },
    { id: "besna-time", key: "besnaTime" },
    
    { id: "rites-address", key: "ritesAddress" },
    { id: "rites-date", key: "ritesDate" },
    { id: "rites-time", key: "ritesTime" },
    
    { id: "map-link", key: "mapLink" }
  ];
  
  formInputs.forEach(item => {
    const el = document.getElementById(item.id);
    el.addEventListener("input", (e) => {
      appState.draft[item.key] = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
  });
  
  // Handle gender radio buttons
  document.getElementById("gender-male").addEventListener("change", (e) => {
    if(e.target.checked) {
      appState.draft.gender = "Male";
      setupRelationSuggestions();
      autoSaveDraft();
      updateLivePreview();
    }
  });
  document.getElementById("gender-female").addEventListener("change", (e) => {
    if(e.target.checked) {
      appState.draft.gender = "Female";
      setupRelationSuggestions();
      autoSaveDraft();
      updateLivePreview();
    }
  });
  
  // Laukik Toggle
  document.getElementById("laukik-toggle").addEventListener("change", (e) => {
    appState.draft.noLaukik = e.target.checked;
    autoSaveDraft();
    updateLivePreview();
  });
}

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById("deceased-name").value.trim();
    const age = document.getElementById("deceased-age").value.trim();
    const demiseDate = document.getElementById("date-of-demise").value;
    const demisePlace = document.getElementById("place-of-demise").value.trim();
    
    if (!name) {
      showToast("Please enter the Deceased Name.");
      document.getElementById("deceased-name").focus();
      return false;
    }
    if (!age) {
      showToast("Please enter the Deceased Age.");
      document.getElementById("deceased-age").focus();
      return false;
    }
    if (!demiseDate) {
      showToast("Please select the Date of Demise.");
      document.getElementById("date-of-demise").focus();
      return false;
    }
    if (!demisePlace) {
      showToast("Please enter the Place of Demise.");
      document.getElementById("place-of-demise").focus();
      return false;
    }
  }
  return true;
}

// SMART RELATION BUILDER ENGINE
function initRelationsEngine() {
  setupRelationSuggestions();
  
  document.getElementById("btn-add-custom-relation").addEventListener("click", () => {
    addRelationRow("", "", "AUTO");
  });
}

// Generate suggestion chips based on Deceased Gender
function setupRelationSuggestions() {
  const container = document.getElementById("relation-suggestion-chips");
  container.innerHTML = "";
  
  const gender = appState.draft.gender; // Male / Female
  
  appState.config.relations.forEach(rel => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    
    // Choose appropriate label based on deceased gender
    const heading = (gender === "Male" ? rel.MaleLabel : rel.FemaleLabel) || rel.English;
    chip.textContent = heading;
    
    chip.addEventListener("click", () => {
      // Add standard relation block
      addRelationRow(heading, "", rel.DisplayStyle || "AUTO");
    });
    
    container.appendChild(chip);
  });
}

function addRelationRow(heading, names, style) {
  const relationId = "rel_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  
  const relObj = {
    id: relationId,
    heading: heading,
    names: names,
    style: style
  };
  
  appState.draft.relations.push(relObj);
  renderRelations();
  autoSaveDraft();
  updateLivePreview();
}

function renderRelations() {
  const container = document.getElementById("relations-container");
  container.innerHTML = "";
  
  if (appState.draft.relations.length === 0) {
    container.innerHTML = `<p style="font-size:0.9rem;color:var(--color-text-muted);text-align:center;padding:1rem;">No relations added yet. Use the suggestion chips above or click Add Custom Relation.</p>`;
    return;
  }
  
  appState.draft.relations.forEach((rel, index) => {
    const row = document.createElement("div");
    row.className = "list-item-row";
    row.setAttribute("data-id", rel.id);
    
    row.innerHTML = `
      <div class="list-item-content multi-col">
        <div class="form-group">
          <label>Relation Heading (e.g. Son / Wife)</label>
          <input type="text" class="input-rel-heading" value="${rel.heading}" placeholder="e.g. Son">
        </div>
        <div class="form-group">
          <label>Display Format</label>
          <select class="select-rel-style">
            <option value="AUTO" ${rel.style === 'AUTO' ? 'selected' : ''}>Auto</option>
            <option value="INLINE" ${rel.style === 'INLINE' ? 'selected' : ''}>Inline (A, B & C)</option>
            <option value="MULTILINE" ${rel.style === 'MULTILINE' ? 'selected' : ''}>Multiline (One per line)</option>
            <option value="BULLETS" ${rel.style === 'BULLETS' ? 'selected' : ''}>Bullets (• A)</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>Names (one per line, or commas)</label>
          <textarea class="textarea-rel-names" placeholder="Enter relative names here...">${rel.names}</textarea>
        </div>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-move-up" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▲</button>
        <button type="button" class="btn-move-down" title="Move Down" ${index === appState.draft.relations.length - 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▼</button>
        <button type="button" class="btn-delete-item" title="Delete Block">✕</button>
      </div>
    `;
    
    // Event listeners for inputs
    row.querySelector(".input-rel-heading").addEventListener("input", (e) => {
      rel.heading = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    
    row.querySelector(".select-rel-style").addEventListener("change", (e) => {
      rel.style = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    
    row.querySelector(".textarea-rel-names").addEventListener("input", (e) => {
      rel.names = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    
    // Up / Down / Delete triggers
    row.querySelector(".btn-move-up").addEventListener("click", () => {
      if (index > 0) {
        const temp = appState.draft.relations[index];
        appState.draft.relations[index] = appState.draft.relations[index - 1];
        appState.draft.relations[index - 1] = temp;
        renderRelations();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-move-down").addEventListener("click", () => {
      if (index < appState.draft.relations.length - 1) {
        const temp = appState.draft.relations[index];
        appState.draft.relations[index] = appState.draft.relations[index + 1];
        appState.draft.relations[index + 1] = temp;
        renderRelations();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-delete-item").addEventListener("click", () => {
      appState.draft.relations.splice(index, 1);
      renderRelations();
      autoSaveDraft();
      updateLivePreview();
    });
    
    container.appendChild(row);
  });
}

// CONDOLENCE CONTACTS ENGINE
function initContactsEngine() {
  document.getElementById("btn-add-contact").addEventListener("click", () => {
    const contactId = "con_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appState.draft.contacts.push({
      id: contactId,
      name: "",
      relation: "",
      mobile: "",
      showRelation: true
    });
    renderContacts();
    autoSaveDraft();
    updateLivePreview();
  });
}

function renderContacts() {
  const container = document.getElementById("contacts-container");
  container.innerHTML = "";
  
  if (appState.draft.contacts.length === 0) {
    container.innerHTML = `<p style="font-size:0.9rem;color:var(--color-text-muted);text-align:center;padding:1rem;">No condolence contacts added yet. Click Add Contact.</p>`;
    return;
  }
  
  appState.draft.contacts.forEach((con, index) => {
    const row = document.createElement("div");
    row.className = "list-item-row";
    
    row.innerHTML = `
      <div class="list-item-content">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="input-con-name" value="${con.name}" placeholder="e.g. Rameshbhai">
          </div>
          <div class="form-group">
            <label>Mobile Number</label>
            <input type="text" class="input-con-mobile" value="${con.mobile}" placeholder="e.g. 9876543210">
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <div class="form-group" style="flex:1; margin-right:15px; display: ${con.showRelation ? 'block' : 'none'};">
            <label>Relation (Optional)</label>
            <input type="text" class="input-con-relation" value="${con.relation}" placeholder="e.g. Brother">
          </div>
          <div class="switch-wrapper" style="width: auto; gap:8px;">
            <label style="font-size: 0.8rem;">Show Relation</label>
            <label class="switch">
              <input type="checkbox" class="toggle-con-show" ${con.showRelation ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-move-up" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▲</button>
        <button type="button" class="btn-move-down" title="Move Down" ${index === appState.draft.contacts.length - 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▼</button>
        <button type="button" class="btn-delete-item" title="Delete Block">✕</button>
      </div>
    `;
    
    // Connect listeners
    row.querySelector(".input-con-name").addEventListener("input", (e) => {
      con.name = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    row.querySelector(".input-con-mobile").addEventListener("input", (e) => {
      con.mobile = e.target.value.replace(/[^0-9+\-\s]/g, ""); // allow basic formatting
      autoSaveDraft();
      updateLivePreview();
    });
    row.querySelector(".input-con-relation").addEventListener("input", (e) => {
      con.relation = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    row.querySelector(".toggle-con-show").addEventListener("change", (e) => {
      con.showRelation = e.target.checked;
      row.querySelector(".input-con-relation").parentElement.style.display = e.target.checked ? 'block' : 'none';
      autoSaveDraft();
      updateLivePreview();
    });
    
    row.querySelector(".btn-move-up").addEventListener("click", () => {
      if (index > 0) {
        const temp = appState.draft.contacts[index];
        appState.draft.contacts[index] = appState.draft.contacts[index - 1];
        appState.draft.contacts[index - 1] = temp;
        renderContacts();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-move-down").addEventListener("click", () => {
      if (index < appState.draft.contacts.length - 1) {
        const temp = appState.draft.contacts[index];
        appState.draft.contacts[index] = appState.draft.contacts[index + 1];
        appState.draft.contacts[index + 1] = temp;
        renderContacts();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-delete-item").addEventListener("click", () => {
      appState.draft.contacts.splice(index, 1);
      renderContacts();
      autoSaveDraft();
      updateLivePreview();
    });
    
    container.appendChild(row);
  });
}

// ADDITIONAL CUSTOM SECTIONS ENGINE
function initSectionsEngine() {
  document.getElementById("btn-add-section").addEventListener("click", () => {
    const sectionId = "sec_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    appState.draft.customSections.push({
      id: sectionId,
      title: "",
      content: ""
    });
    renderSections();
    autoSaveDraft();
    updateLivePreview();
  });
}

function renderSections() {
  const container = document.getElementById("sections-container");
  container.innerHTML = "";
  
  if (appState.draft.customSections.length === 0) {
    return;
  }
  
  appState.draft.customSections.forEach((sec, index) => {
    const row = document.createElement("div");
    row.className = "list-item-row";
    
    row.innerHTML = `
      <div class="list-item-content">
        <div class="form-group">
          <label>Section Title (e.g. Live Stream / Prayer Meeting)</label>
          <input type="text" class="input-sec-title" value="${sec.title}" placeholder="e.g. Live Streaming Link">
        </div>
        <div class="form-group">
          <label>Section Content</label>
          <textarea class="textarea-sec-content" placeholder="Enter details here...">${sec.content}</textarea>
        </div>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn-move-up" title="Move Up" ${index === 0 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▲</button>
        <button type="button" class="btn-move-down" title="Move Down" ${index === appState.draft.customSections.length - 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''}>▼</button>
        <button type="button" class="btn-delete-item" title="Delete Block">✕</button>
      </div>
    `;
    
    row.querySelector(".input-sec-title").addEventListener("input", (e) => {
      sec.title = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    
    row.querySelector(".textarea-sec-content").addEventListener("input", (e) => {
      sec.content = e.target.value;
      autoSaveDraft();
      updateLivePreview();
    });
    
    row.querySelector(".btn-move-up").addEventListener("click", () => {
      if (index > 0) {
        const temp = appState.draft.customSections[index];
        appState.draft.customSections[index] = appState.draft.customSections[index - 1];
        appState.draft.customSections[index - 1] = temp;
        renderSections();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-move-down").addEventListener("click", () => {
      if (index < appState.draft.customSections.length - 1) {
        const temp = appState.draft.customSections[index];
        appState.draft.customSections[index] = appState.draft.customSections[index + 1];
        appState.draft.customSections[index + 1] = temp;
        renderSections();
        autoSaveDraft();
        updateLivePreview();
      }
    });
    
    row.querySelector(".btn-delete-item").addEventListener("click", () => {
      appState.draft.customSections.splice(index, 1);
      renderSections();
      autoSaveDraft();
      updateLivePreview();
    });
    
    container.appendChild(row);
  });
}

// IMAGE CROPPER INTERACTION (Pure client side, zero dependency)
function initImageCropper() {
  const photoInput = document.getElementById("photo-input");
  const modalCropper = document.getElementById("modal-cropper");
  const cropperTarget = document.getElementById("cropper-target-image");
  const btnClose = document.getElementById("btn-close-cropper");
  const btnCancel = document.getElementById("btn-crop-cancel");
  const btnSave = document.getElementById("btn-crop-save");
  const btnRemove = document.getElementById("btn-remove-photo");
  
  // Cropper Controls
  const btnZoomIn = document.getElementById("btn-crop-zoom-in");
  const btnZoomOut = document.getElementById("btn-crop-zoom-out");
  const btnRotate = document.getElementById("btn-crop-rotate");
  
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        appState.cropState.img = img;
        appState.cropState.scale = 1.0;
        appState.cropState.rotation = 0;
        appState.cropState.x = 0;
        appState.cropState.y = 0;
        
        cropperTarget.src = event.target.result;
        applyCropperTransform();
        modalCropper.classList.add("active");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
  
  // Dragging logic
  let isDragging = false;
  let startX = 0, startY = 0;
  
  function startDrag(e) {
    isDragging = true;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    startX = clientX - appState.cropState.x;
    startY = clientY - appState.cropState.y;
    e.preventDefault();
  }
  
  function doDrag(e) {
    if (!isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    appState.cropState.x = clientX - startX;
    appState.cropState.y = clientY - startY;
    applyCropperTransform();
  }
  
  function stopDrag() {
    isDragging = false;
  }
  
  cropperTarget.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", doDrag);
  window.addEventListener("mouseup", stopDrag);
  
  // Touch support for mobile cropper
  cropperTarget.addEventListener("touchstart", startDrag);
  window.addEventListener("touchmove", doDrag);
  window.addEventListener("touchend", stopDrag);
  
  // Zoom & Rotation clicks
  btnZoomIn.addEventListener("click", () => {
    appState.cropState.scale = Math.min(appState.cropState.scale + 0.1, 4.0);
    applyCropperTransform();
  });
  
  btnZoomOut.addEventListener("click", () => {
    appState.cropState.scale = Math.max(appState.cropState.scale - 0.1, 0.2);
    applyCropperTransform();
  });
  
  btnRotate.addEventListener("click", () => {
    appState.cropState.rotation = (appState.cropState.rotation + 90) % 360;
    applyCropperTransform();
  });
  
  function applyCropperTransform() {
    cropperTarget.style.transform = `translate(${appState.cropState.x}px, ${appState.cropState.y}px) scale(${appState.cropState.scale}) rotate(${appState.cropState.rotation}deg)`;
  }
  
  // Close / Cancel Dialog
  btnClose.addEventListener("click", closeCropper);
  btnCancel.addEventListener("click", closeCropper);
  
  function closeCropper() {
    modalCropper.classList.remove("active");
    photoInput.value = ""; // clear inputs
  }
  
  // Apply Crop
  btnSave.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    
    // Clear and draw cropped region
    ctx.clearRect(0, 0, 400, 400);
    
    // Shift coordinate system to canvas center
    ctx.translate(200, 200);
    ctx.rotate(appState.cropState.rotation * Math.PI / 180);
    ctx.scale(appState.cropState.scale, appState.cropState.scale);
    
    const img = appState.cropState.img;
    
    // Draw centered on drag coordinates
    // We scale the offset relative to the current scaling
    const drawX = (appState.cropState.x / appState.cropState.scale) - (img.naturalWidth / 2);
    const drawY = (appState.cropState.y / appState.cropState.scale) - (img.naturalHeight / 2);
    
    ctx.drawImage(img, drawX, drawY);
    
    // Get Base64 image string
    const croppedUrl = canvas.toDataURL("image/jpeg", 0.85);
    
    appState.draft.photoBase64 = croppedUrl;
    
    // Update Upload Box UI
    document.getElementById("photo-placeholder").style.display = "none";
    const displayImg = document.getElementById("photo-display");
    displayImg.src = croppedUrl;
    displayImg.style.display = "block";
    btnRemove.style.display = "inline-flex";
    
    // Update Preview Box UI
    document.getElementById("wa-bubble-image-wrapper").style.display = "block";
    document.getElementById("wa-bubble-image").src = croppedUrl;
    
    closeCropper();
    autoSaveDraft();
    updateLivePreview();
    showToast("Photo cropped successfully!");
  });
  
  // Remove Photo Trigger
  btnRemove.addEventListener("click", () => {
    appState.draft.photoBase64 = null;
    document.getElementById("photo-placeholder").style.display = "block";
    document.getElementById("photo-display").style.display = "none";
    btnRemove.style.display = "none";
    
    document.getElementById("wa-bubble-image-wrapper").style.display = "none";
    document.getElementById("wa-bubble-image").src = "";
    
    autoSaveDraft();
    updateLivePreview();
    showToast("Photo removed.");
  });
}

// LIVE PREVIEW COMPILER (TEMPLATE ENGINE)
function updateLivePreview() {
  const tplId = appState.draft.selectedTemplateId || "TEM001";
  const template = appState.config.templates.find(t => t.TemplateID === tplId);
  
  if (!template) {
    document.getElementById("whatsapp-preview-text").textContent = "Select template to generate.";
    return;
  }
  
  // Populate Preview Info Panel
  document.getElementById("info-template-name").textContent = template.TemplateName;
  document.getElementById("info-template-version").textContent = template.TemplateVersion || "V1";
  
  let body = template.TemplateBody;
  
  // Replace Deceased Info
  const decName = appState.draft.deceasedName.trim() || "[DECEASED NAME]";
  const age = appState.draft.age.trim() || "[AGE]";
  
  body = body.replace(/\{\{DECEASED_NAME\}\}/g, decName);
  body = body.replace(/\{\{AGE\}\}/g, age);
  
  // Place of Demise
  const place = appState.draft.placeOfDemise.trim() || "[PLACE OF DEMISE]";
  body = body.replace(/\{\{PLACE_OF_DEMISE\}\}/g, place);
  
  // Date of Demise (Format nicely — parse as local date to avoid UTC timezone shift)
  let demiseDateFormatted = "[DATE OF DEMISE]";
  if (appState.draft.dateOfDemise) {
    const parts = appState.draft.dateOfDemise.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    demiseDateFormatted = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  body = body.replace(/\{\{DATE_OF_DEMISE\}\}/g, demiseDateFormatted);
  
  // Date of Birth block — parse as local date to avoid UTC timezone shift
  if (appState.draft.dateOfBirth) {
    const dobParts = appState.draft.dateOfBirth.split('-');
    const dob = new Date(parseInt(dobParts[0]), parseInt(dobParts[1]) - 1, parseInt(dobParts[2]));
    const dobFormatted = dob.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    body = body.replace(/\{\{DATE_OF_BIRTH_BLOCK\}\}/g, `• Date of Birth: ${dobFormatted}`);
    body = body.replace(/\{\{DATE_OF_BIRTH\}\}/g, dobFormatted);
  } else {
    body = body.replace(/\{\{DATE_OF_BIRTH_BLOCK\}\}/g, "");
    body = body.replace(/\{\{DATE_OF_BIRTH\}\}/g, "");
  }
  
  // Community / Samaj
  const community = (appState.draft.community === "Custom" ? appState.draft.customCommunity.trim() : appState.draft.community) || "";
  body = body.replace(/\{\{COMMUNITY\}\}/g, community);
  
  // RELATIONS LIST COMPILATION
  let relationsText = "";
  if (appState.draft.relations && appState.draft.relations.length > 0) {
    relationsText = "*Family Members:*\n";
    appState.draft.relations.forEach(rel => {
      if (!rel.heading || !rel.names) return;
      
      const relativeNames = parseRelativeNames(rel.names, rel.style);
      relationsText += `• *${rel.heading}:* ${relativeNames}\n`;
    });
  }
  body = body.replace(/\{\{RELATIONS\}\}/g, relationsText.trim());
  
  // CEREMONIES COMPILATION
  // Besna
  let besnaText = "";
  if (appState.draft.besnaAddress || appState.draft.besnaDate || appState.draft.besnaTime) {
    besnaText = `*Besna (Prayer Meeting):*\n`;
    if (appState.draft.besnaAddress) besnaText += `📍 Venue: ${appState.draft.besnaAddress}\n`;
    if (appState.draft.besnaDate) besnaText += `📅 Date: ${appState.draft.besnaDate}\n`;
    if (appState.draft.besnaTime) besnaText += `⏰ Time: ${appState.draft.besnaTime}\n`;
  }
  body = body.replace(/\{\{BESNA\}\}/g, besnaText.trim());
  
  // Last Rites
  let ritesText = "";
  if (appState.draft.ritesAddress || appState.draft.ritesDate || appState.draft.ritesTime) {
    ritesText = `*Funeral / Last Rites:*\n`;
    if (appState.draft.ritesAddress) ritesText += `📍 Place: ${appState.draft.ritesAddress}\n`;
    if (appState.draft.ritesDate) ritesText += `📅 Date: ${appState.draft.ritesDate}\n`;
    if (appState.draft.ritesTime) ritesText += `⏰ Time: ${appState.draft.ritesTime}\n`;
    if (appState.draft.mapLink) ritesText += `🗺️ Google Maps: ${appState.draft.mapLink}\n`;
  }
  body = body.replace(/\{\{LAST_RITES\}\}/g, ritesText.trim());
  
  // Laukik Notice
  if (appState.draft.noLaukik) {
    body = body.replace(/\{\{NO_LAUKIK\}\}/g, "🙏 *Note: Laukik Vyavahar (condolence visits) is strictly restricted. Please send messages/calls instead.*");
  } else {
    body = body.replace(/\{\{NO_LAUKIK\}\}/g, "");
  }
  
  // CONDOLENCE CONTACTS COMPILATION
  let contactsText = "";
  if (appState.draft.contacts && appState.draft.contacts.length > 0) {
    appState.draft.contacts.forEach(con => {
      if (!con.name || !con.mobile) return;
      const relationLabel = (con.showRelation && con.relation) ? ` (${con.relation})` : "";
      contactsText += `• ${con.name}${relationLabel}: ${con.mobile}\n`;
    });
  }
  body = body.replace(/\{\{CONDOLENCE_CONTACTS\}\}/g, contactsText.trim());
  
  // CUSTOM ADDITIONAL SECTIONS
  let customText = "";
  if (appState.draft.customSections && appState.draft.customSections.length > 0) {
    appState.draft.customSections.forEach(sec => {
      if (!sec.title || !sec.content) return;
      customText += `*${sec.title}:*\n${sec.content}\n\n`;
    });
  }
  body = body.replace(/\{\{CUSTOM_SECTIONS\}\}/g, customText.trim());
  
  // Clean double newlines that result from omitted blocks
  body = body.replace(/\n{3,}/g, "\n\n");
  
  // Update UI Text elements
  const outputEl = document.getElementById("whatsapp-preview-text");
  outputEl.innerHTML = formatWhatsAppMarkdown(body);
  outputEl.setAttribute("data-raw-text", body);
  
  // Set current time in WhatsApp bubble
  const now = new Date();
  document.getElementById("preview-time").textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Convert commas and newlines inside relative lists into professional inline or bullet structures
function parseRelativeNames(namesStr, displayStyle) {
  // Split names by commas or newlines
  const names = namesStr.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== "");
  
  if (names.length === 0) return "";
  
  if (displayStyle === "INLINE" || (displayStyle === "AUTO" && names.length <= 3)) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
  } else if (displayStyle === "BULLETS") {
    return "\n" + names.map(n => `  • ${n}`).join("\n");
  } else {
    // MULTILINE Format
    return "\n" + names.join("\n");
  }
}

// Simulates WhatsApp bolding styling *text* -> <strong>text</strong>
function formatWhatsAppMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Replace bolds *text* with <strong>text</strong>
  html = html.replace(/\*(.*?)\*/g, "<strong>$1</strong>");
  
  // Replace italics _text_ with <em>text</em>
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");
  
  // Replace strikethroughs ~text~ with <del>text</del>
  html = html.replace(/~(.*?)~/g, "<del>$1</del>");
  
  // Replace newlines with <br>
  html = html.replace(/\n/g, "<br>");
  
  return html;
}

// SHARE & ACTIONS LOGIC
function initSharingActions() {
  const btnCopy = document.getElementById("btn-copy");
  const btnShare = document.getElementById("btn-share-whatsapp");
  const btnDownload = document.getElementById("btn-download-txt");
  const btnSaveManual = document.getElementById("btn-save-custom-draft");
  const btnAI = document.getElementById("btn-ai-improve");
  
  // Copy to Clipboard
  btnCopy.addEventListener("click", () => {
    const rawText = document.getElementById("whatsapp-preview-text").getAttribute("data-raw-text");
    navigator.clipboard.writeText(rawText)
      .then(() => showToast("Copied announcement to clipboard!"))
      .catch(err => {
        console.error("Copy failed: ", err);
        showToast("Copy failed, please select and copy manually.");
      });
  });
  
  // WhatsApp Share
  btnShare.addEventListener("click", () => {
    const rawText = document.getElementById("whatsapp-preview-text").getAttribute("data-raw-text");
    
    // Check if image is uploaded and browser supports Web Share File API
    if (appState.draft.photoBase64 && navigator.share && navigator.canShare) {
      try {
        // Convert Base64 Cropped Image to a Blob and File object
        const parts = appState.draft.photoBase64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        
        const blob = new Blob([uInt8Array], { type: contentType });
        const file = new File([blob], "announcement_photo.jpg", { type: contentType });
        
        const shareData = {
          files: [file],
          title: "Demise Announcement",
          text: rawText
        };
        
        if (navigator.canShare(shareData)) {
          navigator.share(shareData)
            .then(() => showToast("Announcement shared successfully!"))
            .catch(err => {
              if (err.name !== "AbortError") {
                console.error("Web Share failed, falling back to URL link: ", err);
                openWhatsAppUrlFallback(rawText);
              }
            });
          return; // Stop execution
        }
      } catch (err) {
        console.warn("Could not structure file sharing: ", err);
      }
    }
    
    // Fallback: Share Text via direct WhatsApp API
    openWhatsAppUrlFallback(rawText);
  });
  
  function openWhatsAppUrlFallback(text) {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    showToast("Opening WhatsApp...");
  }
  
  // Download as TXT file
  btnDownload.addEventListener("click", () => {
    const rawText = document.getElementById("whatsapp-preview-text").getAttribute("data-raw-text");
    const name = appState.draft.deceasedName.replace(/[^a-zA-Z0-9]/g, "_") || "Deceased";
    
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Demise_Message_${name}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("Downloaded TXT File!");
  });
  
  // Save Manual Draft
  btnSaveManual.addEventListener("click", () => {
    const customLabel = prompt("Enter a label for this draft:", `Draft for ${appState.draft.deceasedName || "New Announcement"}`);
    if (customLabel === null) return;
    
    const savedDrafts = JSON.parse(localStorage.getItem("demise_saved_drafts") || "[]");
    
    const draftEntry = {
      id: "draft_" + Date.now(),
      label: customLabel || `Draft ${savedDrafts.length + 1}`,
      timestamp: new Date().toLocaleString(),
      draftData: JSON.parse(JSON.stringify(appState.draft))
    };
    
    savedDrafts.push(draftEntry);
    localStorage.setItem("demise_saved_drafts", JSON.stringify(savedDrafts));
    showToast("Draft saved to history!");
  });
  
  // Manage Saved Drafts Trigger
  document.getElementById("btn-drafts-history").addEventListener("click", () => {
    showDraftsHistoryModal();
  });
  
  document.getElementById("btn-close-drafts-list").addEventListener("click", closeDraftsModal);
  document.getElementById("btn-close-drafts-modal").addEventListener("click", closeDraftsModal);
  
  function closeDraftsModal() {
    document.getElementById("modal-drafts-list").classList.remove("active");
  }
  
  // AI Improvement Call
  btnAI.addEventListener("click", () => {
    if (!GAS_WEBAPP_URL) {
      const urlInput = prompt("To use the AI optimizer, please enter your deployed Google Apps Script URL:");
      if (urlInput) {
        GAS_WEBAPP_URL = urlInput.trim();
        localStorage.setItem("demise_gas_url", GAS_WEBAPP_URL);
        showToast("Apps Script Webapp URL saved!");
      } else {
        return;
      }
    }
    
    const rawText = document.getElementById("whatsapp-preview-text").getAttribute("data-raw-text");
    
    // Toggle Loading
    const btnText = document.getElementById("ai-btn-text");
    const originalText = btnText.textContent;
    btnAI.disabled = true;
    btnText.innerHTML = `<span class="loading-spinner"></span> Optimizing...`;
    
    fetch(GAS_WEBAPP_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain" // GAS handles text payloads easiest
      },
      body: JSON.stringify({
        action: "improveText",
        text: rawText
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.text) {
        // Inject improved text directly into preview
        const outputEl = document.getElementById("whatsapp-preview-text");
        outputEl.innerHTML = formatWhatsAppMarkdown(data.text);
        outputEl.setAttribute("data-raw-text", data.text);
        showToast("Text layout optimized by AI!");
      } else {
        console.error("AI Error:", data.error);
        showToast(`AI Formatting failed: ${data.error || 'Server error'}`);
      }
    })
    .catch(err => {
      console.error("AI Network request failed: ", err);
      showToast("Unable to reach AI proxy. Check internet connection.");
    })
    .finally(() => {
      btnAI.disabled = false;
      btnText.textContent = originalText;
    });
  });
}

// Toast Helper
function showToast(message) {
  const el = document.getElementById("toast-message");
  el.textContent = message;
  el.classList.add("show");
  
  setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
}

// Auto Save draft on change
function autoSaveDraft() {
  localStorage.setItem("demise_current_draft", JSON.stringify(appState.draft));
}

// Checks if an unsaved draft was stored
function checkForDraft() {
  const stored = localStorage.getItem("demise_current_draft");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure it contains data
      if (parsed.deceasedName || parsed.relations.length > 0 || parsed.contacts.length > 0) {
        document.getElementById("modal-resume-draft").classList.add("active");
        
        document.getElementById("btn-resume-confirm").onclick = () => {
          loadDraftIntoForm(parsed);
          document.getElementById("modal-resume-draft").classList.remove("active");
          showToast("Draft restored!");
        };
        
        document.getElementById("btn-resume-discard").onclick = () => {
          localStorage.removeItem("demise_current_draft");
          document.getElementById("modal-resume-draft").classList.remove("active");
          showToast("Started fresh draft.");
        };
      }
    } catch(e) {
      console.error(e);
    }
  }
}

// Populate saved draft data back to form elements
function loadDraftIntoForm(draftData) {
  appState.draft = draftData;
  
  // Fill text fields
  document.getElementById("deceased-name").value = draftData.deceasedName || "";
  document.getElementById("deceased-age").value = draftData.age || "";
  document.getElementById("date-of-demise").value = draftData.dateOfDemise || "";
  document.getElementById("place-of-demise").value = draftData.placeOfDemise || "";
  document.getElementById("date-of-birth").value = draftData.dateOfBirth || "";
  document.getElementById("custom-community").value = draftData.customCommunity || "";
  document.getElementById("additional-notes").value = draftData.additionalNotes || "";
  
  document.getElementById("besna-address").value = draftData.besnaAddress || "";
  document.getElementById("besna-date").value = draftData.besnaDate || "";
  document.getElementById("besna-time").value = draftData.besnaTime || "";
  
  document.getElementById("rites-address").value = draftData.ritesAddress || "";
  document.getElementById("rites-date").value = draftData.ritesDate || "";
  document.getElementById("rites-time").value = draftData.ritesTime || "";
  
  document.getElementById("map-link").value = draftData.mapLink || "";
  
  // Gender Radios
  if (draftData.gender === "Female") {
    document.getElementById("gender-female").checked = true;
  } else {
    document.getElementById("gender-male").checked = true;
  }
  
  // Community selection
  const selectCom = document.getElementById("community-select");
  selectCom.value = draftData.community || "Custom";
  if (selectCom.value === "Custom") {
    document.getElementById("custom-community-group").style.display = "block";
  } else {
    document.getElementById("custom-community-group").style.display = "none";
  }
  
  // Photo
  const displayImg = document.getElementById("photo-display");
  const placeholder = document.getElementById("photo-placeholder");
  const btnRemove = document.getElementById("btn-remove-photo");
  const waImageWrapper = document.getElementById("wa-bubble-image-wrapper");
  const waImg = document.getElementById("wa-bubble-image");
  
  if (draftData.photoBase64) {
    placeholder.style.display = "none";
    displayImg.src = draftData.photoBase64;
    displayImg.style.display = "block";
    btnRemove.style.display = "inline-flex";
    
    waImageWrapper.style.display = "block";
    waImg.src = draftData.photoBase64;
  } else {
    placeholder.style.display = "block";
    displayImg.style.display = "none";
    btnRemove.style.display = "none";
    
    waImageWrapper.style.display = "none";
    waImg.src = "";
  }
  
  // Laukik toggle
  document.getElementById("laukik-toggle").checked = draftData.noLaukik !== false;
  
  // Load templates
  const selectTpl = document.getElementById("template-select");
  if (selectTpl && draftData.selectedTemplateId) {
    selectTpl.value = draftData.selectedTemplateId;
  }
  
  // Re-render arrays
  renderRelations();
  renderContacts();
  renderSections();
  
  // Update Preview
  updateLivePreview();
}

// Show multi-draft selector
function showDraftsHistoryModal() {
  const modal = document.getElementById("modal-drafts-list");
  const listContainer = document.getElementById("drafts-history-list");
  listContainer.innerHTML = "";
  
  const saved = JSON.parse(localStorage.getItem("demise_saved_drafts") || "[]");
  
  if (saved.length === 0) {
    listContainer.innerHTML = `<p style="font-size:0.9rem;text-align:center;padding:1rem;color:var(--color-text-muted);">No saved drafts found in your history.</p>`;
  } else {
    saved.forEach((item, index) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-app); padding:0.8rem; border:1px solid var(--color-border); border-radius:8px;";
      
      row.innerHTML = `
        <div style="flex:1; cursor:pointer;" class="btn-load-saved-draft">
          <div style="font-weight:700; color:var(--color-primary); font-size:0.95rem;">${item.label}</div>
          <div style="font-size:0.75rem; color:var(--color-text-muted);">${item.timestamp}</div>
        </div>
        <button type="button" class="btn btn-danger btn-sm btn-delete-saved-draft" style="padding:6px 10px; border-radius:50%; min-width:32px;">✕</button>
      `;
      
      row.querySelector(".btn-load-saved-draft").addEventListener("click", () => {
        if (confirm(`Load "${item.label}"? Your current draft will be overwritten.`)) {
          loadDraftIntoForm(item.draftData);
          modal.classList.remove("active");
        }
      });
      
      row.querySelector(".btn-delete-saved-draft").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${item.label}"?`)) {
          saved.splice(index, 1);
          localStorage.setItem("demise_saved_drafts", JSON.stringify(saved));
          showDraftsHistoryModal(); // Refresh modal
          showToast("Draft deleted.");
        }
      });
      
      listContainer.appendChild(row);
    });
  }
  
  modal.classList.add("active");
}
