/**
 * ====================================================
 * MasterChef/ResultsManager.gs
 * גרסה: v1.5 (20/05/2026)
 * סטטוס: ✅ STABLE
 * פרויקט: MasterChef
 *
 * תיאור: ניהול תוצאות שבועיות — שמירה, קריאה, עדכון סטטוס שליחה
 *
 * פונקציות:
 *   saveResult(week, trendName, video, ingredients, cost, sent) — שמירת תוצאה שבועית
 *   getResults()         — קריאת כל התוצאות מהגיליון
 *   getResultByWeek(week)— קריאת תוצאה לפי מספר שבוע
 *   markAsSent(week)     — סימון שורה כנשלחה
 * ====================================================
 */

// ============================================================
// פונקציה פנימית — קבלת הגיליון הרלוונטי
// ============================================================

/**
 * מחזיר את אובייקט הגיליון של Results Manager
 * @returns {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function _getResultsSheet() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_RESULTS_MGR);

    // אם הגיליון לא קיים — מחזיר null ומתעד שגיאה
    if (!sheet) {
      Logger.log('[ResultsManager] שגיאה: גיליון "' + SHEET_RESULTS_MGR + '" לא נמצא.');
      return null;
    }

    return sheet;
  } catch (e) {
    Logger.log('[ResultsManager] שגיאה בפתיחת הגיליון: ' + e.message);
    return null;
  }
}

// ============================================================
// saveResult — שמירת תוצאה שבועית
// ============================================================

/**
 * שומר תוצאה שבועית חדשה בגיליון Results Manager.
 * אם קיימת כבר שורה עם אותו שבוע — היא תוחלף.
 *
 * @param {number}  week        — מספר השבוע
 * @param {string}  trendName   — שם הטרנד הקולינרי
 * @param {string}  video       — קישור לסרטון
 * @param {string}  ingredients — רשימת מצרכים
 * @param {number}  cost        — עלות משוערת
 * @param {boolean} sent        — האם נשלח לקבוצה
 * @returns {boolean} true בהצלחה, false בכישלון
 */
function saveResult(week, trendName, video, ingredients, cost, sent) {
  try {
    // ולידציה בסיסית של פרמטרים
    if (week === undefined || week === null) {
      Logger.log('[saveResult] שגיאה: פרמטר "week" חסר.');
      return false;
    }

    var sheet = _getResultsSheet();
    if (!sheet) {
      return false;
    }

    // חיפוש שורה קיימת עם אותו מספר שבוע
    var existingRow = _findRowByWeek(sheet, week);

    // זמן שמירה נוכחי
    var savedAt = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    // ערכים לשמירה — לפי סדר עמודות ב-Config
    var rowData = [
      week,
      trendName   || '',
      video       || '',
      ingredients || '',
      cost        || 0,
      sent        ? 'TRUE' : 'FALSE',
      savedAt
    ];

    if (existingRow > 0) {
      // עדכון שורה קיימת
      sheet.getRange(existingRow, COL_RM_WEEK, 1, rowData.length).setValues([rowData]);
      Logger.log('[saveResult] עודכנה שורה קיימת לשבוע ' + week + ' בשורה ' + existingRow);
    } else {
      // הוספת שורה חדשה בסוף הנתונים
      var lastRow = sheet.getLastRow();
      var newRow  = (lastRow < DATA_START_ROW) ? DATA_START_ROW : lastRow + 1;
      sheet.getRange(newRow, COL_RM_WEEK, 1, rowData.length).setValues([rowData]);
      Logger.log('[saveResult] נשמרה שורה חדשה לשבוע ' + week + ' בשורה ' + newRow);
    }

    return true;

  } catch (e) {
    Logger.log('[saveResult] שגיאה בשמירת תוצאה לשבוע ' + week + ': ' + e.message);
    return false;
  }
}

// ============================================================
// getResults — קריאת כל התוצאות
// ============================================================

/**
 * מחזיר מערך של כל התוצאות השמורות בגיליון.
 * כל פריט במערך הוא אובייקט עם שדות מובנים.
 *
 * @returns {Array<Object>|null} מערך תוצאות, או null בכישלון
 */
function getResults() {
  try {
    var sheet = _getResultsSheet();
    if (!sheet) {
      return null;
    }

    var lastRow = sheet.getLastRow();

    // אם אין נתונים מעבר לשורת הכותרת
    if (lastRow < DATA_START_ROW) {
      Logger.log('[getResults] הגיליון ריק — אין תוצאות.');
      return [];
    }

    // קריאת כל שורות הנתונים
    var numRows = lastRow - DATA_START_ROW + 1;
    var numCols = COL_RM_SAVED_AT; // עמודה G — האחרונה
    var data    = sheet.getRange(DATA_START_ROW, 1, numRows, numCols).getValues();

    var results = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];

      // דילוג על שורות ריקות (שבוע ריק)
      if (!row[COL_RM_WEEK - 1] && row[COL_RM_WEEK - 1] !== 0) {
        continue;
      }

      results.push(_rowToObject(row));
    }

    Logger.log('[getResults] נטענו ' + results.length + ' תוצאות.');
    return results;

  } catch (e) {
    Logger.log('[getResults] שגיאה בקריאת תוצאות: ' + e.message);
    return null;
  }
}

// ============================================================
// getResultByWeek — קריאת תוצאה לפי שבוע
// ============================================================

/**
 * מחזיר את התוצאה של שבוע ספציפי.
 *
 * @param  {number} week — מספר השבוע המבוקש
 * @returns {Object|null} אובייקט תוצאה, null אם לא נמצא, false בכישלון
 */
function getResultByWeek(week) {
  try {
    if (week === undefined || week === null) {
      Logger.log('[getResultByWeek] שגיאה: פרמטר "week" חסר.');
      return false;
    }

    var sheet = _getResultsSheet();
    if (!sheet) {
      return false;
    }

    var rowIndex = _findRowByWeek(sheet, week);

    if (rowIndex < 1) {
      Logger.log('[getResultByWeek] לא נמצאה תוצאה לשבוע ' + week);
      return null;
    }

    // קריאת שורת הנתונים
    var numCols = COL_RM_SAVED_AT;
    var rowData = sheet.getRange(rowIndex, 1, 1, numCols).getValues()[0];

    Logger.log('[getResultByWeek] נמצאה תוצאה לשבוע ' + week + ' בשורה ' + rowIndex);
    return _rowToObject(rowData);

  } catch (e) {
    Logger.log('[getResultByWeek] שגיאה בקריאת תוצאה לשבוע ' + week + ': ' + e.message);
    return false;
  }
}

// ============================================================
// markAsSent — סימון תוצאה כנשלחה
// ============================================================

/**
 * מסמן את שדה "נשלח" כ-TRUE עבור שבוע נתון.
 *
 * @param  {number} week — מספר השבוע לסימון
 * @returns {boolean} true בהצלחה, false בכישלון
 */
function markAsSent(week) {
  try {
    if (week === undefined || week === null) {
      Logger.log('[markAsSent] שגיאה: פרמטר "week" חסר.');
      return false;
    }

    var sheet = _getResultsSheet();
    if (!sheet) {
      return false;
    }

    var rowIndex = _findRowByWeek(sheet, week);

    if (rowIndex < 1) {
      Logger.log('[markAsSent] לא נמצאה שורה לסימון עבור שבוע ' + week);
      return false;
    }

    // עדכון תא עמודת "נשלח" בלבד
    sheet.getRange(rowIndex, COL_RM_SENT).setValue('TRUE');

    Logger.log('[markAsSent] שבוע ' + week + ' סומן כנשלח בשורה ' + rowIndex);
    return true;

  } catch (e) {
    Logger.log('[markAsSent] שגיאה בסימון שבוע ' + week + ': ' + e.message);
    return false;
  }
}

// ============================================================
// פונקציות עזר פנימיות
// ============================================================

/**
 * מחפש שורה בגיליון לפי מספר שבוע.
 * מחזיר את מספר השורה (1-based) או -1 אם לא נמצא.
 *
 * @param  {GoogleAppsScript.Spreadsheet.Sheet} sheet — הגיליון לחיפוש
 * @param  {number} week — מספר השבוע
 * @returns {number} מספר שורה (1-based) או -1
 */
function _findRowByWeek(sheet, week) {
  try {
    var lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) {
      return -1;
    }

    var numRows   = lastRow - DATA_START_ROW + 1;
    var weekRange = sheet.getRange(DATA_START_ROW, COL_RM_WEEK, numRows, 1).getValues();

    for (var i = 0; i < weekRange.length; i++) {
      // השוואה רגישת טיפוס — ממיר לסטרינג לצורך השוואה בטוחה
      if (String(weekRange[i][0]) === String(week)) {
        return DATA_START_ROW + i;
      }
    }

    return -1;

  } catch (e) {
    Logger.log('[_findRowByWeek] שגיאה בחיפוש שורה לשבוע ' + week + ': ' + e.message);
    return -1;
  }
}

/**
 * ממיר מערך שורה גולמי לאובייקט תוצאה מובנה.
 *
 * @param  {Array} row — מערך ערכים מהגיליון
 * @returns {Object} אובייקט תוצאה
 */
function _rowToObject(row) {
  return {
    week:        row[COL_RM_WEEK        - 1],
    trendName:   row[COL_RM_TREND       - 1],
    video:       row[COL_RM_VIDEO       - 1],
    ingredients: row[COL_RM_INGREDIENTS - 1],
    cost:        row[COL_RM_COST        - 1],
    sent:        String(row[COL_RM_SENT - 1]).toUpperCase() === 'TRUE',
    savedAt:     row[COL_RM_SAVED_AT    - 1]
  };
}
