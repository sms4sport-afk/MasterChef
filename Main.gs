// Main.gs — נקודת הכניסה לפרויקט Master Chef
// כל הקבועים הגלובליים נמצאים ב-Config.gs

// ─── פונקציות ציבוריות (טריגרים) ───────────────────────────────────────────────

// סריקת ראשון — מופעלת אוטומטית ביום ראשון
function sundayScan() {
  try {
    log_('sundayScan — התחלת סריקה', 'INFO');
  } catch (e) {
    handleError_('sundayScan', e);
  }
}

// שליחת סקר ביום שני
function mondaySurvey() {
  try {
    log_('mondaySurvey — שליחת סקר', 'INFO');
  } catch (e) {
    handleError_('mondaySurvey', e);
  }
}

// קריאת תוצאות ביום שלישי בצהריים
function tuesdayResults() {
  try {
    log_('tuesdayResults — קריאת תוצאות', 'INFO');
  } catch (e) {
    handleError_('tuesdayResults', e);
  }
}

// שליחת חומרים ביום שלישי בערב
function tuesdayMaterials() {
  try {
    log_('tuesdayMaterials — שליחת חומרים', 'INFO');
  } catch (e) {
    handleError_('tuesdayMaterials', e);
  }
}

// ─── הגדרת טריגרים ──────────────────────────────────────────────────────────────────

// מוחק את הטריגרים הקיימים ויוצר מחדש את כל הטריגרים של הפרויקט
function setupTriggers() {
  try {
    deleteAllTriggers_();
    ScriptApp.newTrigger(TRIGGER_NAMES.SUNDAY_SCAN).timeBased().onWeekDay(DAYS.SUNDAY).atHour(TRIGGER_HOURS.SUNDAY_SCAN).create();
    ScriptApp.newTrigger(TRIGGER_NAMES.MONDAY_SURVEY).timeBased().onWeekDay(DAYS.MONDAY).atHour(TRIGGER_HOURS.MONDAY_SURVEY).create();
    ScriptApp.newTrigger(TRIGGER_NAMES.TUESDAY_RESULTS).timeBased().onWeekDay(DAYS.TUESDAY).atHour(TRIGGER_HOURS.TUESDAY_RESULTS).create();
    ScriptApp.newTrigger(TRIGGER_NAMES.TUESDAY_MATERIALS).timeBased().onWeekDay(DAYS.TUESDAY).atHour(TRIGGER_HOURS.TUESDAY_MATERIALS).create();
  } catch (e) {
    handleError_('setupTriggers', e);
  }
}

// ─── פונקציות עזר פרטיות ──────────────────────────────────────────────────────────────

// מוחק רק טריגרים ששמם מופיע ב-TRIGGER_NAMES
function deleteAllTriggers_() {
  try {
    var knownNames = Object.keys(TRIGGER_NAMES).map(function(key) {
      return TRIGGER_NAMES[key];
    });
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (knownNames.indexOf(trigger.getHandlerFunction()) !== -1) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  } catch (e) {
    handleError_('deleteAllTriggers_', e);
  }
}

// רושם הודעת לוג עם חותמת זמן ישראלית ל-Logger ול-console
function log_(message, level) {
  var timestamp   = new Date().toLocaleString('he-IL', { timeZone: TIMEZONE });
  var prefix      = '[' + PROJECT_NAME + '] [' + (level || 'INFO') + '] ' + timestamp + ' — ';
  var fullMessage = prefix + message;
  Logger.log(fullMessage);
  console.log(fullMessage);
}

// מטפל בשגיאה — רושם ללוג וזורק שגיאה חדשה עם הקשר מלא
function handleError_(functionName, error) {
  var msg = 'שגיאה ב-' + functionName + ': ' + error.message;
  log_(msg, 'ERROR');
  throw new Error('[' + PROJECT_NAME + '] ' + functionName + ': ' + error.message);
}
