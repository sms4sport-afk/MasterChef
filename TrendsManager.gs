/**
 * ====================================================
 * MasterChef/TrendsManager.gs
 * גרסה: v1.0
 * פרויקט: MasterChef
 *
 * תיאור: ניהול טרנדים קולינריים — שמירה, שליפה ועדכון סטטוס
 *        בגיליון הטרנדים של פרויקט מאסטר שף
 *
 * פונקציות:
 *   saveTrend(trendData)           — שמירת טרנד חדש בגיליון
 *   getTrends()                    — שליפת כל הטרנדים
 *   getTrendsByStatus(status)      — שליפת טרנדים לפי סטטוס
 *   updateTrendStatus(row, status) — עדכון סטטוס טרנד קיים
 * ====================================================
 */

// ============================================================
// קבועים מקומיים — ערכי ברירת מחדל למקרה שחסרים ב-Config.gs
// ============================================================

// שם טאב הטרנדים — בשימוש אם SHEET_TRENDS לא מוגדר ב-Config.gs
var _SHEET_TRENDS_DEFAULT = 'Trends';

// סטטוסים — בשימוש אם TREND_STATUS_* לא מוגדרים ב-Config.gs
var _TREND_STATUS_NEW_DEFAULT      = 'NEW';      // טרנד חדש שנסרק
var _TREND_STATUS_SENT_DEFAULT     = 'SENT';     // טרנד שנשלח לסקר
var _TREND_STATUS_SELECTED_DEFAULT = 'SELECTED'; // טרנד שנבחר על ידי הקבוצה
var _TREND_STATUS_DONE_DEFAULT     = 'DONE';     // טרנד שהושלם

// עמודות טרנדים (1-based) — בשימוש אם COL_TRENDS_* לא מוגדרים ב-Config.gs
var _COL_TRENDS_ID_DEFAULT          = 1; // עמודה A: מזהה ייחודי
var _COL_TRENDS_DATE_DEFAULT        = 2; // עמודה B: תאריך סריקה
var _COL_TRENDS_TITLE_DEFAULT       = 3; // עמודה C: שם הטרנד
var _COL_TRENDS_DESCRIPTION_DEFAULT = 4; // עמודה D: תיאור הטרנד
var _COL_TRENDS_SOURCE_DEFAULT      = 5; // עמודה E: מקור / לינק
var _COL_TRENDS_STATUS_DEFAULT      = 6; // עמודה F: סטטוס

// ============================================================
// פונקציות עזר פנימיות
// ============================================================

/**
 * _getEffectiveValue — מחזיר ערך קבוע מ-Config.gs אם קיים, אחרת ברירת מחדל
 */
var _getEffectiveValue = function(configValue, defaultValue) {
  return (typeof configValue !== 'undefined' && configValue !== null)
    ? configValue
    : defaultValue;
};

/**
 * _getSheet — מחזיר את אובייקט הגיליון של הטרנדים, יוצר אם לא קיים
 */
var _getSheet = function() {
  var sheetName = _getEffectiveValue(
    (typeof SHEET_TRENDS !== 'undefined' ? SHEET_TRENDS : undefined),
    _SHEET_TRENDS_DEFAULT
  );

  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet       = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager: גיליון "' + sheetName + '" לא נמצא — יוצר חדש');
    sheet = spreadsheet.insertSheet(sheetName);
    _initSheetHeaders(sheet);
  }

  return sheet;
};

/**
 * _initSheetHeaders — אתחול שורת כותרות בגיליון חדש
 */
var _initSheetHeaders = function(sheet) {
  var colId          = _getEffectiveValue(typeof COL_TRENDS_ID          !== 'undefined' ? COL_TRENDS_ID          : undefined, _COL_TRENDS_ID_DEFAULT);
  var colDate        = _getEffectiveValue(typeof COL_TRENDS_DATE        !== 'undefined' ? COL_TRENDS_DATE        : undefined, _COL_TRENDS_DATE_DEFAULT);
  var colTitle       = _getEffectiveValue(typeof COL_TRENDS_TITLE       !== 'undefined' ? COL_TRENDS_TITLE       : undefined, _COL_TRENDS_TITLE_DEFAULT);
  var colDescription = _getEffectiveValue(typeof COL_TRENDS_DESCRIPTION !== 'undefined' ? COL_TRENDS_DESCRIPTION : undefined, _COL_TRENDS_DESCRIPTION_DEFAULT);
  var colSource      = _getEffectiveValue(typeof COL_TRENDS_SOURCE      !== 'undefined' ? COL_TRENDS_SOURCE      : undefined, _COL_TRENDS_SOURCE_DEFAULT);
  var colStatus      = _getEffectiveValue(typeof COL_TRENDS_STATUS      !== 'undefined' ? COL_TRENDS_STATUS      : undefined, _COL_TRENDS_STATUS_DEFAULT);

  var totalCols = Math.max(colId, colDate, colTitle, colDescription, colSource, colStatus);
  var headers   = new Array(totalCols);

  headers[colId          - 1] = 'ID';
  headers[colDate        - 1] = 'תאריך סריקה';
  headers[colTitle       - 1] = 'שם הטרנד';
  headers[colDescription - 1] = 'תיאור';
  headers[colSource      - 1] = 'מקור';
  headers[colStatus      - 1] = 'סטטוס';

  var headerRow = _getEffectiveValue(
    (typeof HEADER_ROW !== 'undefined' ? HEADER_ROW : undefined), 1
  );
  sheet.getRange(headerRow, 1, 1, totalCols).setValues([headers]);

  Logger.log('[' + PROJECT_NAME + '] TrendsManager: כותרות גיליון אותחלו בהצלחה');
};

/**
 * _generateId — יצירת מזהה ייחודי לטרנד חדש בפורמט TREND_YYYYMMDD_HHmmss
 */
var _generateId = function() {
  return 'TREND_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmmss');
};

/**
 * _getNow — תאריך ושעה נוכחיים כמחרוזת קריאה
 */
var _getNow = function() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
};

/**
 * _rowToTrendObject — המרת שורת נתונים לאובייקט טרנד
 */
var _rowToTrendObject = function(rowData, rowIndex) {
  var colId          = _getEffectiveValue(typeof COL_TRENDS_ID          !== 'undefined' ? COL_TRENDS_ID          : undefined, _COL_TRENDS_ID_DEFAULT);
  var colDate        = _getEffectiveValue(typeof COL_TRENDS_DATE        !== 'undefined' ? COL_TRENDS_DATE        : undefined, _COL_TRENDS_DATE_DEFAULT);
  var colTitle       = _getEffectiveValue(typeof COL_TRENDS_TITLE       !== 'undefined' ? COL_TRENDS_TITLE       : undefined, _COL_TRENDS_TITLE_DEFAULT);
  var colDescription = _getEffectiveValue(typeof COL_TRENDS_DESCRIPTION !== 'undefined' ? COL_TRENDS_DESCRIPTION : undefined, _COL_TRENDS_DESCRIPTION_DEFAULT);
  var colSource      = _getEffectiveValue(typeof COL_TRENDS_SOURCE      !== 'undefined' ? COL_TRENDS_SOURCE      : undefined, _COL_TRENDS_SOURCE_DEFAULT);
  var colStatus      = _getEffectiveValue(typeof COL_TRENDS_STATUS      !== 'undefined' ? COL_TRENDS_STATUS      : undefined, _COL_TRENDS_STATUS_DEFAULT);

  return {
    row:         rowIndex,
    id:          rowData[colId          - 1] || '',
    date:        rowData[colDate        - 1] || '',
    title:       rowData[colTitle       - 1] || '',
    description: rowData[colDescription - 1] || '',
    source:      rowData[colSource      - 1] || '',
    status:      rowData[colStatus      - 1] || ''
  };
};

// ============================================================
// פונקציות ציבוריות
// ============================================================

/**
 * saveTrend — שמירת טרנד חדש בגיליון הטרנדים
 * @param {Object} trendData — { title (חובה), description, source }
 * @return {Object|null} אובייקט הטרנד שנשמר, או null בכישלון
 */
var saveTrend = function(trendData) {
  if (!trendData || !trendData.title || trendData.title.toString().trim() === '') {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.saveTrend: שגיאה — שדה title הוא חובה');
    return null;
  }

  try {
    var sheet = _getSheet();

    var colId          = _getEffectiveValue(typeof COL_TRENDS_ID          !== 'undefined' ? COL_TRENDS_ID          : undefined, _COL_TRENDS_ID_DEFAULT);
    var colDate        = _getEffectiveValue(typeof COL_TRENDS_DATE        !== 'undefined' ? COL_TRENDS_DATE        : undefined, _COL_TRENDS_DATE_DEFAULT);
    var colTitle       = _getEffectiveValue(typeof COL_TRENDS_TITLE       !== 'undefined' ? COL_TRENDS_TITLE       : undefined, _COL_TRENDS_TITLE_DEFAULT);
    var colDescription = _getEffectiveValue(typeof COL_TRENDS_DESCRIPTION !== 'undefined' ? COL_TRENDS_DESCRIPTION : undefined, _COL_TRENDS_DESCRIPTION_DEFAULT);
    var colSource      = _getEffectiveValue(typeof COL_TRENDS_SOURCE      !== 'undefined' ? COL_TRENDS_SOURCE      : undefined, _COL_TRENDS_SOURCE_DEFAULT);
    var colStatus      = _getEffectiveValue(typeof COL_TRENDS_STATUS      !== 'undefined' ? COL_TRENDS_STATUS      : undefined, _COL_TRENDS_STATUS_DEFAULT);

    var defaultStatus = _getEffectiveValue(
      (typeof TREND_STATUS_NEW !== 'undefined' ? TREND_STATUS_NEW : undefined),
      _TREND_STATUS_NEW_DEFAULT
    );

    var trendId   = _generateId();
    var now       = _getNow();
    var totalCols = Math.max(colId, colDate, colTitle, colDescription, colSource, colStatus);
    var newRow    = new Array(totalCols).fill('');

    newRow[colId          - 1] = trendId;
    newRow[colDate        - 1] = now;
    newRow[colTitle       - 1] = trendData.title.toString().trim();
    newRow[colDescription - 1] = trendData.description ? trendData.description.toString().trim() : '';
    newRow[colSource      - 1] = trendData.source      ? trendData.source.toString().trim()      : '';
    newRow[colStatus      - 1] = defaultStatus;

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();

    var savedRowNum = sheet.getLastRow();
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.saveTrend: נשמר — ' + trendId + ' (שורה ' + savedRowNum + ')');
    return _rowToTrendObject(newRow, savedRowNum);

  } catch (err) {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.saveTrend: שגיאה — ' + err.message);
    return null;
  }
};

/**
 * getTrends — שליפת כל הטרנדים מהגיליון
 * @return {Array} מערך אובייקטי טרנד
 */
var getTrends = function() {
  try {
    var sheet        = _getSheet();
    var dataStartRow = _getEffectiveValue(
      (typeof DATA_START_ROW !== 'undefined' ? DATA_START_ROW : undefined), 2
    );
    var lastRow = sheet.getLastRow();

    if (lastRow < dataStartRow) {
      Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrends: אין טרנדים בגיליון');
      return [];
    }

    var numRows = lastRow - dataStartRow + 1;
    var data    = sheet.getRange(dataStartRow, 1, numRows, sheet.getLastColumn()).getValues();
    var trends  = [];

    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) { // מדלג על שורות ריקות
        trends.push(_rowToTrendObject(data[i], dataStartRow + i));
      }
    }

    Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrends: נשלפו ' + trends.length + ' טרנדים');
    return trends;

  } catch (err) {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrends: שגיאה — ' + err.message);
    return [];
  }
};

/**
 * getTrendsByStatus — שליפת טרנדים לפי סטטוס
 * @param {string} status — הסטטוס המבוקש (NEW / SENT / SELECTED / DONE)
 * @return {Array} מערך אובייקטי טרנד מסוננים
 */
var getTrendsByStatus = function(status) {
  try {
    if (!status) {
      Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrendsByStatus: שגיאה — status הוא חובה');
      return [];
    }

    var filtered = getTrends().filter(function(t) { return t.status === status; });
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrendsByStatus: ' + filtered.length + ' טרנדים בסטטוס ' + status);
    return filtered;

  } catch (err) {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.getTrendsByStatus: שגיאה — ' + err.message);
    return [];
  }
};

/**
 * updateTrendStatus — עדכון סטטוס טרנד קיים לפי מספר שורה
 * @param {number} row    — מספר השורה בגיליון (1-based)
 * @param {string} status — הסטטוס החדש
 * @return {boolean} true אם הצליח, false אם נכשל
 */
var updateTrendStatus = function(row, status) {
  try {
    if (!row || !status) {
      Logger.log('[' + PROJECT_NAME + '] TrendsManager.updateTrendStatus: שגיאה — row ו-status הם חובה');
      return false;
    }

    var sheet     = _getSheet();
    var colStatus = _getEffectiveValue(
      (typeof COL_TRENDS_STATUS !== 'undefined' ? COL_TRENDS_STATUS : undefined),
      _COL_TRENDS_STATUS_DEFAULT
    );

    sheet.getRange(row, colStatus).setValue(status);
    SpreadsheetApp.flush();

    Logger.log('[' + PROJECT_NAME + '] TrendsManager.updateTrendStatus: שורה ' + row + ' עודכנה לסטטוס ' + status);
    return true;

  } catch (err) {
    Logger.log('[' + PROJECT_NAME + '] TrendsManager.updateTrendStatus: שגיאה — ' + err.message);
    return false;
  }
};
