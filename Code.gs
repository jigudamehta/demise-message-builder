/**
 * Demise Message Builder PWA - Backend Script
 * 
 * Instructions:
 * 1. Open Google Sheets.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any existing code and paste this file content.
 * 4. Run the "setupSpreadsheet" function once to create the required tables and sample data.
 * 5. Click "Deploy" -> "New deployment".
 * 6. Select type "Web app".
 * 7. Set:
 *    - Description: "Demise Message Builder API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 8. Click "Deploy", authorize the permissions, and copy the Web App URL.
 * 9. Paste the Web App URL in the Settings tab of your Google Sheet and update your PWA app.js config.
 */

// Action Route Handler
function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getData') {
    return handleGetData();
  }
  
  return jsonResponse({
    success: false,
    error: "Invalid get action. Use action=getData."
  });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: "Invalid JSON payload: " + err.toString() });
  }
  
  var action = data.action;
  if (action === 'improveText') {
    return handleImproveText(data.text);
  }
  
  return jsonResponse({
    success: false,
    error: "Invalid post action."
  });
}

// Fetch all database records for the PWA
function handleGetData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({ success: false, error: "Spreadsheet not found. Please run setupSpreadsheet first." });
    }
    
    var data = {
      success: true,
      settings: {},
      templates: [],
      relations: [],
      communities: [],
      translations: {}
    };
    
    // 1. Settings (Exclude private API keys)
    var settingsSheet = ss.getSheetByName("Settings");
    if (settingsSheet) {
      var settingsRows = sheetToObjects(settingsSheet);
      settingsRows.forEach(function(row) {
        var key = row.Key || row.key;
        var val = row.Value || row.value;
        if (key && !key.includes("API_KEY")) { // Expose only safe values
          data.settings[key] = val;
        }
      });
    }
    
    // 2. Templates
    var templatesSheet = ss.getSheetByName("Templates");
    if (templatesSheet) {
      data.templates = sheetToObjects(templatesSheet);
    }
    
    // 3. RelationMaster
    var relationSheet = ss.getSheetByName("RelationMaster");
    if (relationSheet) {
      data.relations = sheetToObjects(relationSheet);
    }
    
    // 4. CommunityMaster
    var communitySheet = ss.getSheetByName("CommunityMaster");
    if (communitySheet) {
      var communities = sheetToObjects(communitySheet);
      data.communities = communities.filter(function(c) {
        return String(c.Active).toUpperCase() === 'TRUE';
      });
    }
    
    // 5. LanguageMaster (For translation dictionaries)
    var langSheet = ss.getSheetByName("LanguageMaster");
    if (langSheet) {
      var langRows = sheetToObjects(langSheet);
      langRows.forEach(function(row) {
        var key = row.TranslationKey || row.translationkey;
        if (key) {
          data.translations[key] = {
            English: row.English || "",
            Gujarati: row.Gujarati || "",
            GUJlish: row.GUJlish || "",
            Hindi: row.Hindi || "",
            Hinglish: row.Hinglish || ""
          };
        }
      });
    }
    
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// AI Improvement proxy handler
function handleImproveText(text) {
  if (!text || text.trim() === "") {
    return jsonResponse({ success: false, error: "Text is empty." });
  }
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settingsSheet = ss.getSheetByName("Settings");
    var settings = {};
    
    if (settingsSheet) {
      var settingsRows = sheetToObjects(settingsSheet);
      settingsRows.forEach(function(row) {
        var key = row.Key || row.key;
        var val = row.Value || row.value;
        if (key) settings[key] = val;
      });
    }
    
    if (String(settings.ENABLE_AI).toUpperCase() !== 'TRUE') {
      return jsonResponse({ success: false, error: "AI feature is disabled in the Settings sheet." });
    }
    
    var priority = settings.AI_PROVIDER_PRIORITY || "Gemini,OpenAI,OpenRouter";
    var providers = priority.split(",").map(function(p) { return p.trim(); });
    
    var resultText = null;
    var errors = [];
    
    for (var i = 0; i < providers.length; i++) {
      var provider = providers[i];
      try {
        if (provider === "Gemini" && settings.GEMINI_API_KEY) {
          resultText = callGemini(text, settings.GEMINI_API_KEY);
          if (resultText) break;
        } else if (provider === "OpenAI" && settings.OPENAI_API_KEY) {
          resultText = callOpenAI(text, settings.OPENAI_API_KEY);
          if (resultText) break;
        } else if (provider === "OpenRouter" && settings.OPENROUTER_API_KEY) {
          resultText = callOpenRouter(text, settings.OPENROUTER_API_KEY);
          if (resultText) break;
        } else {
          errors.push(provider + " was skipped (missing key or unsupported provider).");
        }
      } catch (err) {
        errors.push(provider + " failed: " + err.toString());
      }
    }
    
    if (resultText) {
      return jsonResponse({ success: true, text: resultText });
    } else {
      return jsonResponse({
        success: false,
        error: "All configured AI providers failed. Fallback log: " + errors.join(" | ")
      });
    }
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// Gemini API Call
function callGemini(text, apiKey) {
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey;
  var prompt = getAIPrompt(text);
  
  var payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.2
    }
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var resText = response.getContentText();
  
  if (code !== 200) {
    throw new Error("Gemini HTTP Error " + code + ": " + resText);
  }
  
  var resJson = JSON.parse(resText);
  if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content && resJson.candidates[0].content.parts[0]) {
    return resJson.candidates[0].content.parts[0].text.trim();
  }
  throw new Error("Gemini returned unexpected structure: " + resText);
}

// OpenAI API Call
function callOpenAI(text, apiKey) {
  var url = "https://api.openai.com/v1/chat/completions";
  var prompt = getAIPrompt(text);
  
  var payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a professional formatting assistant. Only return the final formatted text without explanation or markdown styling wrappers." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  };
  
  var options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var resText = response.getContentText();
  
  if (code !== 200) {
    throw new Error("OpenAI HTTP Error " + code + ": " + resText);
  }
  
  var resJson = JSON.parse(resText);
  if (resJson.choices && resJson.choices[0] && resJson.choices[0].message) {
    return resJson.choices[0].message.content.trim();
  }
  throw new Error("OpenAI returned unexpected structure: " + resText);
}

// OpenRouter API Call
function callOpenRouter(text, apiKey) {
  var url = "https://openrouter.ai/api/v1/chat/completions";
  var prompt = getAIPrompt(text);
  
  var payload = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a professional formatting assistant. Only return the final formatted text." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  };
  
  var options = {
    method: "post",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": "https://github.com/demise-builder-pwa",
      "X-Title": "Demise Message Builder PWA"
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var resText = response.getContentText();
  
  if (code !== 200) {
    throw new Error("OpenRouter HTTP Error " + code + ": " + resText);
  }
  
  var resJson = JSON.parse(resText);
  if (resJson.choices && resJson.choices[0] && resJson.choices[0].message) {
    return resJson.choices[0].message.content.trim();
  }
  throw new Error("OpenRouter returned unexpected structure: " + resText);
}

// Prompt Construction
function getAIPrompt(text) {
  return "You are a professional formatting assistant for demise announcements and condolence messages. " +
    "Your task is to refine, clean up, and improve the formatting, spacing, grammar, list alignment, and overall professional presentation of the text below.\n\n" +
    "CRITICAL CONSTRAINTS:\n" +
    "1. Do NOT invent any facts, names, dates, relations, addresses, links, phone numbers, or details.\n" +
    "2. Do NOT add or remove family relatives or edit any existing names.\n" +
    "3. Keep all telephone numbers, dates, locations, and time ranges exactly as they appear in the original.\n" +
    "4. Return ONLY the final formatted announcement text. Do NOT wrap it in HTML, markdown blocks like ```, or add conversational intros/outros (e.g. 'Here is your improved text:'). Just return the final polished text immediately.\n" +
    "5. Format headings using bold formatting (e.g. *Deceased Details*, *Besna*, *Last Rites*, *Condolence Contacts*) to make it clean for WhatsApp.\n\n" +
    "Original announcement text:\n" +
    text;
}

// CORS-enabled JSON Response helper
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Convert a sheet range into an array of JavaScript objects based on header names
function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0];
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = {};
    var hasValues = false;
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var cellVal = data[i][j];
      if (header !== "") {
        row[header] = cellVal;
        if (cellVal !== "" && cellVal !== null && cellVal !== undefined) {
          hasValues = true;
        }
      }
    }
    if (hasValues) {
      rows.push(row);
    }
  }
  return rows;
}

// Setup spreadsheets automatically with standard fields and initial values
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet found. Please run this script bound to a Google Spreadsheet.");
  }
  
  // 1. Setup Settings Sheet
  var settingsSheet = ss.getSheetByName("Settings") || ss.insertSheet("Settings");
  settingsSheet.clear();
  settingsSheet.appendRow(["Key", "Value", "Description"]);
  var settingsData = [
    ["GAS_WEBAPP_URL", "", "The URL of this deployed Web App"],
    ["APP_NAME", "Demise Message Builder", "Name of the PWA"],
    ["APP_VERSION", "1.0.0", "Configuration Version"],
    ["DEFAULT_LANGUAGE", "English", "Initial application language"],
    ["DEFAULT_TEMPLATE", "Traditional English", "Default template to load for new drafts"],
    ["ENABLE_AI", "TRUE", "Toggle for AI features (TRUE/FALSE)"],
    ["GEMINI_API_KEY", "", "Google Gemini API key"],
    ["OPENAI_API_KEY", "", "OpenAI API Key (fallback)"],
    ["OPENROUTER_API_KEY", "", "OpenRouter API Key (fallback)"],
    ["AI_PROVIDER_PRIORITY", "Gemini,OpenAI,OpenRouter", "AI Provider precedence fallback list"],
    ["BRANDING_NAME", "Jigar Pradip Mehta", "Author Name"],
    ["BRANDING_PHONE", "9898393487", "Author Contact Phone"],
    ["WHATSAPP_SHARE_ENABLED", "TRUE", "Toggle sharing to WhatsApp directly (TRUE/FALSE)"]
  ];
  settingsSheet.getRange(2, 1, settingsData.length, 3).setValues(settingsData);
  settingsSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#d9ead3");
  settingsSheet.autoResizeColumns(1, 3);
  
  // 2. Setup Templates Sheet
  var templatesSheet = ss.getSheetByName("Templates") || ss.insertSheet("Templates");
  templatesSheet.clear();
  var templatesHeaders = ["TemplateID", "TemplateVersion", "TemplateName", "Language", "Community", "TemplateBody", "IsActive", "DisplayOrder", "CreatedDate"];
  templatesSheet.appendRow(templatesHeaders);
  var templatesData = [
    [
      "TEM001", 
      "V1", 
      "Traditional English", 
      "English", 
      "All", 
      "🕯️ *DEMISE ANNOUNCEMENT* 🕯️\n\nWith profound grief and sorrow, we inform you about the sad demise of our beloved *{{DECEASED_NAME}}* on {{DATE_OF_DEMISE}} at {{PLACE_OF_DEMISE}}.\n\n*Deceased Details:*\n• Name: *{{DECEASED_NAME}}*\n• Age: {{AGE}} years\n• DOB: {{DATE_OF_BIRTH}}\n\n{{RELATIONS}}\n\n*Ceremony Details:*\n{{LAST_RITES}}\n{{BESNA}}\n{{NO_LAUKIK}}\n\n{{CUSTOM_SECTIONS}}\n\n*Condolence Contacts:*\n{{CONDOLENCE_CONTACTS}}\n\n🙏 *Pranam / Prayers* 🙏", 
      "TRUE", 
      1, 
      new Date()
    ],
    [
      "TEM002", 
      "V1", 
      "Short Condolence", 
      "English", 
      "All", 
      "🕯️ *SAD DEMISE* 🕯️\n\nWe regret to inform you of the passing of *{{DECEASED_NAME}}* (Age: {{AGE}}) on {{DATE_OF_DEMISE}}.\n\n{{RELATIONS}}\n\n*Besna (Prayer Meeting):*\n{{BESNA}}\n\n*Condolence Contacts:*\n{{CONDOLENCE_CONTACTS}}\n\n🙏 May their soul rest in eternal peace.", 
      "TRUE", 
      2, 
      new Date()
    ]
  ];
  templatesSheet.getRange(2, 1, templatesData.length, templatesHeaders.length).setValues(templatesData);
  templatesSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#d9ead3");
  templatesSheet.autoResizeColumns(1, templatesHeaders.length);
  
  // 3. Setup RelationMaster Sheet
  var relationSheet = ss.getSheetByName("RelationMaster") || ss.insertSheet("RelationMaster");
  relationSheet.clear();
  var relationHeaders = ["RelationKey", "English", "ChipLabel", "Gujarati", "GUJlish", "Hindi", "Hinglish", "MaleLabel", "FemaleLabel", "DefaultOrder", "DisplayStyle"];
  relationSheet.appendRow(relationHeaders);
  var relationData = [
    ["SPOUSE", "Spouse", "Spouse (જીવનસાથી)", "જીવનસાથી", "Jivansathi", "जीवनसाथी", "Jeevansathi", "H/o", "W/o", 1, "INLINE"],
    ["PARENTS", "Parents", "Parents (પિતા-માતા)", "પિતા-માતા", "Pita-Mata", "माता-पिता", "Parents", "S/o", "D/o", 2, "INLINE"],
    ["PARENTS_IN_LAW", "Parents-in-Law", "Parents-in-Law (સાસુ-સસરા)", "સાસુ-સસરા", "Sasu-Sasra", "सास-ससुर", "In-laws", "Sil/o", "Dil/o", 3, "INLINE"],
    ["CHILDREN", "Children", "Children (પુત્ર/પુત્રી)", "પુત્ર/પુત્રી", "Putra/Putri", "बच्चे", "Children", "F/o", "M/o", 4, "MULTILINE"],
    ["CHILDREN_IN_LAW", "Children-in-Law", "Children-in-Law (જમાઈ/પુત્રવધૂ)", "જમાઈ/પુત્રવધૂ", "Jamai/Putravadhu", "दामाद/बहू", "In-laws", "Fil/o", "Mil/o", 5, "INLINE"],
    ["GRANDCHILDREN", "Grandchildren", "Grandchildren (પૌત્ર/પૌત્રી)", "પૌત્ર/પૌત્રી", "Pautra/Pautri", "पोते/पोतियां", "Grandchildren", "G/f", "G/m", 6, "BULLETS"],
    ["SIBLINGS", "Siblings", "Siblings (ભાઈ/બહેન)", "ભાઈ/બહેન", "Bhai/Bahen", "भाई-बहन", "Siblings", "B/o", "S/o", 7, "INLINE"],
    ["SISTER_IN_LAW", "Sister-in-Law", "Sister-in-Law (ભાભી/સાળી)", "ભાભી/સાળી", "Bhabhi/Sali", "भाभी/साली", "Sister-in-Law", "Sil/o", "Sil/o", 8, "INLINE"],
    ["BROTHER_IN_LAW", "Brother-in-Law", "Brother-in-Law (બનેવી/સાળો)", "બનેવી/સાળો", "Banevi/Salo", "जीजा/साला", "Brother-in-Law", "Bil/o", "Bil/o", 9, "INLINE"]
  ];
  relationSheet.getRange(2, 1, relationData.length, relationHeaders.length).setValues(relationData);
  relationSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#d9ead3");
  relationSheet.autoResizeColumns(1, relationHeaders.length);
  
  // 4. Setup CommunityMaster Sheet
  var communitySheet = ss.getSheetByName("CommunityMaster") || ss.insertSheet("CommunityMaster");
  communitySheet.clear();
  var communityHeaders = ["CommunityID", "CommunityName", "DisplayOrder", "Active"];
  communitySheet.appendRow(communityHeaders);
  var communityData = [
    ["COM001", "Palanpuri Samaj", 1, "TRUE"],
    ["COM002", "Dhanera Samaj", 2, "TRUE"],
    ["COM003", "Tharad Samaj", 3, "TRUE"],
    ["COM004", "Gadh Samaj", 4, "TRUE"],
    ["COM005", "12 Gam Samaj", 5, "TRUE"],
    ["COM006", "Khimat Samaj", 6, "TRUE"],
    ["COM007", "Deesa Samaj", 7, "TRUE"],
    ["COM008", "Bhabhar Samaj", 8, "TRUE"],
    ["COM009", "Diyodar Samaj", 9, "TRUE"],
    ["COM010", "Custom", 10, "TRUE"]
  ];
  communitySheet.getRange(2, 1, communityData.length, communityHeaders.length).setValues(communityData);
  communitySheet.getRange("A1:D1").setFontWeight("bold").setBackground("#d9ead3");
  communitySheet.autoResizeColumns(1, communityHeaders.length);
  
  // 5. Setup LanguageMaster Sheet
  var langSheet = ss.getSheetByName("LanguageMaster") || ss.insertSheet("LanguageMaster");
  langSheet.clear();
  var langHeaders = ["TranslationKey", "English", "Gujarati", "GUJlish", "Hindi", "Hinglish"];
  langSheet.appendRow(langHeaders);
  var langData = [
    ["APP_TITLE", "Demise Announcement Builder", "શ્રદ્ધાંજલિ પત્રક નિર્માતા", "Shradhanjali Patrak Nirmata", "शोक संदेश निर्माता", "Shok Sandesh Maker"],
    ["DECEASED_DETAILS", "Deceased Details", "સ્વર્ગસ્થની વિગતો", "Swargasth ni Vigato", "दिवंगत विवरण", "Divangat Vivaran"],
    ["FULL_NAME", "Full Name of Deceased", "સ્વર્ગસ્થનું નામ", "Swargasth nu Naam", "दिवंगत का नाम", "Divangat Ka Naam"],
    ["GENDER", "Gender", "જાતિ", "Jati", "लिंग", "Gender"],
    ["MALE", "Male", "પુરુષ", "Purush", "पुरुष", "Male"],
    ["FEMALE", "Female", "સ્ત્રી", "Stree", "महिला", "Female"],
    ["AGE", "Age", "ઉંમર", "Umar", "आयु", "Umar"],
    ["DATE_OF_DEMISE", "Date of Demise", "અવસાન તારીખ", "Avasan Tarikh", "निधन तिथि", "Nidhan Tithi"],
    ["PLACE_OF_DEMISE", "Place of Demise", "અવસાન સ્થળ", "Avasan Sthal", "निधन स्थल", "Nidhan Sthal"],
    ["DATE_OF_BIRTH", "Date of Birth (Optional)", "જન્મ તારીખ", "Janma Tarikh", "जन्म तिथि", "Janm Tithi"],
    ["RELATION_BUILDER", "Relation Builder", "કુટુંબ સભ્યો", "Kutumb Sabhyo", "संबंध निर्माता", "Sambandh Builder"],
    ["CEREMONY_DETAILS", "Ceremony Details", "ઉત્તરક્રિયા / બેસણું વિગત", "Uttarkriya / Besnu Vigat", "संस्कार / प्रार्थना सभा विवरण", "Ceremony Details"],
    ["CONTACTS", "Condolence Contacts", "ટેલિફોનિક શોક સંદેશ સંપર્ક", "Telephonic Shok Sandesh Sampark", "शोक संवेदना संपर्क", "Condolence Contacts"],
    ["NO_LAUKIK", "No Laukik Vyavahar / Simple Rites", "લૌકિક પ્રથા બંધ રાખેલ છે", "Laukik Pratha Bandh Rakhel Che", "लौकिक व्यवहार बंद है", "Laukik Vyavahar Bandh Hai"]
  ];
  langSheet.getRange(2, 1, langData.length, langHeaders.length).setValues(langData);
  langSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#d9ead3");
  langSheet.autoResizeColumns(1, langHeaders.length);
  
  // Clean default sheets if sheet count is high
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch(e) {}
  }
}
