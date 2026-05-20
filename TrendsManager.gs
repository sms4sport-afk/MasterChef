/**
 * ====================================================
 * MasterChef/TrendsManager.gs
 * גרסה: v1.4 (19/05/2026)
 * סטטוס: ✅ STABLE
 * פרויקט: MasterChef
 *
 * תיאור: ניהול רשימת הטרנדים הקולינריים מטאב Trends
 *
 * פונקציות:
 *   — getTrends(): מחזירה רשימת טרנדים קולינריים מהגיליון
 * ====================================================
 */

// ============================================================
// פונקציה ראשית: שליפת רשימת טרנדים
// ============================================================

/**
 * מחזירה רשימת טרנדים קולינריים מטאב Trends בגיליון
 *
 * @returns {string[]} מערך של שמות טרנדים (עד MAX_TRENDS_TO_RETURN פריטים)
 *                     מערך ריק במקרה של שגיאה
 */
function getTrends() {
  try {
    // פתיחת הגיליון והטאב הרלוונטי
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName(SHEET_TRENDS);

    // בדיקה שהטאב קיים
    if (!sheet) {
      Logger.log('[' + PROJECT_NAME + '] שגיאה: טאב "' + SHEET_TRENDS + '" לא נמצא בגיליון');
      return [];
    }

    // שליפת כל השורות הקיימות (מ-DATA_START_ROW ואילך)
    var lastRow = sheet.getLastRow();

    // בדיקה שיש נתונים מעבר לשורת הכותרת
    if (lastRow < DATA_START_ROW) {
      Logger.log('[' + PROJECT_NAME + '] אין טרנדים בטאב "' + SHEET_TRENDS + '"');
      return [];
    }

    // חישוב מספר השורות לקריאה (עד MAX_TRENDS_TO_RETURN)
    var numRows = Math.min(lastRow - DATA_START_ROW + 1, MAX_TRENDS_TO_RETURN);

    // שליפת עמודת שמות הטרנדים בלבד (TRENDS_COL_TREND = עמודה B)
    var range = sheet.getRange(DATA_START_ROW, TRENDS_COL_TREND, numRows, 1);
    var values = range.getValues();

    // בניית מערך התוצאות — סינון שורות ריקות
    var trends = [];
    for (var i = 0; i < values.length; i++) {
      var trendName = String(values[i][0]).trim();

      // דילוג על שורות ריקות
      if (trendName === '' || trendName === 'undefined') {
        continue;
      }

      trends.push(trendName);
    }

    Logger.log('[' + PROJECT_NAME + '] נמצאו ' + trends.length + ' טרנדים בטאב "' + SHEET_TRENDS + '"');
    return trends;

  } catch (error) {
    Logger.log('[' + PROJECT_NAME + '] שגיאה בפונקציה getTrends: ' + error.message);
    return [];
  }
}
