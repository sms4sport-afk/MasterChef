/**
 * ====================================================
 * MasterChef/VotesManager.gs
 * גרסה: v1.0
 * סטטוס: ✅ STABLE
 * פרויקט: MasterChef
 *
 * תיאור: ניהול הצבעות שבועיות — שמירה, קריאה ואיתור זוכה
 *
 * פונקציות:
 *   saveVote(week, trendName, votes, winner) — שמירת הצבעה לגיליון Votes
 *   getVotes(week)                           — קריאת כל ההצבעות לשבוע נתון
 *   getWinner(week)                          — החזרת הטרנד הזוכה לשבוע נתון
 * ====================================================
 */

// ============================================================
// פונקציות עזר פנימיות
// ============================================================

/**
 * _getVotesSheet — מחזיר את אובייקט הגיליון של טאב Votes
 * במידה והטאב לא קיים — זורק שגיאה
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
var _getVotesSheet = function() {
  // פתיחת הגיליון הראשי לפי SPREADSHEET_ID מ-Config.gs
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  // חיפוש טאב Votes לפי SHEET_VOTES מ-Config.gs
  var sheet = spreadsheet.getSheetByName(SHEET_VOTES);

  // בדיקה שהטאב אכן קיים
  if (!sheet) {
    throw new Error(PROJECT_NAME + ' | _getVotesSheet | טאב "' + SHEET_VOTES + '" לא נמצא בגיליון');
  }

  return sheet;
};

/**
 * _formatDate — מחזיר תאריך מפורמט לפי אזור הזמן של הפרויקט
 * @returns {string} תאריך בפורמט dd/MM/yyyy HH:mm
 */
var _formatDate = function() {
  // שימוש ב-TIMEZONE מ-Config.gs לפורמט תאריך עקבי
  return Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm');
};

// ============================================================
// פונקציה 1: saveVote — שמירת הצבעה
// ============================================================

/**
 * saveVote — שומר שורת הצבעה חדשה בטאב Votes
 *
 * @param {number|string} week      — מספר השבוע (למשל: 1, 2, 42...)
 * @param {string}        trendName — שם הטרנד הקולינרי שהוצבע עליו
 * @param {number}        votes     — מספר הקולות שהתקבלו לטרנד זה
 * @param {string}        winner    — שם הזוכה בהצבעה (או מחרוזת ריקה אם אין עדיין)
 * @returns {boolean} true אם השמירה הצליחה, false אחרת
 */
var saveVote = function(week, trendName, votes, winner) {
  // בדיקת תקינות פרמטרים לפני כל פעולה
  if (week === undefined || week === null) {
    Logger.log(PROJECT_NAME + ' | saveVote | שגיאה: פרמטר week חסר');
    return false;
  }
  if (!trendName || typeof trendName !== 'string' || trendName.trim() === '') {
    Logger.log(PROJECT_NAME + ' | saveVote | שגיאה: פרמטר trendName חסר או לא תקין');
    return false;
  }
  if (votes === undefined || votes === null || isNaN(Number(votes))) {
    Logger.log(PROJECT_NAME + ' | saveVote | שגיאה: פרמטר votes חסר או לא מספרי');
    return false;
  }
  if (winner === undefined || winner === null) {
    winner = '';
  }

  try {
    var sheet = _getVotesSheet();

    // בניית שורה חדשה לפי סדר העמודות מ-Config.gs
    var newRow = [];
    newRow[COL_VOTES_WEEK   - 1] = week;
    newRow[COL_VOTES_TREND  - 1] = trendName.trim();
    newRow[COL_VOTES_COUNT  - 1] = Number(votes);
    newRow[COL_VOTES_WINNER - 1] = winner.trim();
    newRow[COL_VOTES_DATE   - 1] = _formatDate();

    sheet.appendRow(newRow);

    Logger.log(PROJECT_NAME + ' | saveVote | נשמרה הצבעה — שבוע: ' + week + ', טרנד: ' + trendName + ', קולות: ' + votes);
    return true;

  } catch (e) {
    Logger.log(PROJECT_NAME + ' | saveVote | שגיאה בשמירת הצבעה: ' + e.message);
    return false;
  }
};

// ============================================================
// פונקציה 2: getVotes — קריאת הצבעות לפי שבוע
// ============================================================

/**
 * getVotes — מחזיר את כל שורות ההצבעה עבור שבוע מסוים
 *
 * @param {number|string} week — מספר השבוע המבוקש
 * @returns {Array} מערך של אובייקטים עם שדות: week, trendName, votes, winner, date
 */
var getVotes = function(week) {
  if (week === undefined || week === null) {
    Logger.log(PROJECT_NAME + ' | getVotes | שגיאה: פרמטר week חסר');
    return [];
  }

  try {
    var sheet   = _getVotesSheet();
    var lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) {
      Logger.log(PROJECT_NAME + ' | getVotes | אין נתונים בגיליון ' + SHEET_VOTES);
      return [];
    }

    var numRows   = lastRow - DATA_START_ROW + 1;
    var data      = sheet.getRange(DATA_START_ROW, 1, numRows, 5).getValues();
    var result    = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(row[COL_VOTES_WEEK - 1]) === String(week)) {
        result.push({
          week:      row[COL_VOTES_WEEK   - 1],
          trendName: row[COL_VOTES_TREND  - 1],
          votes:     row[COL_VOTES_COUNT  - 1],
          winner:    row[COL_VOTES_WINNER - 1],
          date:      row[COL_VOTES_DATE   - 1]
        });
      }
    }

    Logger.log(PROJECT_NAME + ' | getVotes | נמצאו ' + result.length + ' רשומות לשבוע ' + week);
    return result;

  } catch (e) {
    Logger.log(PROJECT_NAME + ' | getVotes | שגיאה בקריאת הצבעות: ' + e.message);
    return [];
  }
};

// ============================================================
// פונקציה 3: getWinner — מחזיר את הטרנד הזוכה לפי שבוע
// ============================================================

/**
 * getWinner — מחזיר את שם הטרנד עם מספר הקולות הגבוה ביותר לשבוע נתון
 *
 * לוגיקת הזכייה:
 *   1. אם קיימת עמודת winner מאוכלסת — מחזיר אותה ישירות
 *   2. אחרת — מחשב את הטרנד עם הכי הרבה קולות (COL_VOTES_COUNT)
 *   3. במקרה של תיקו — מחזיר את הראשון שנמצא
 *
 * @param {number|string} week — מספר השבוע המבוקש
 * @returns {string|null} שם הטרנד הזוכה, או null אם לא נמצאו נתונים
 */
var getWinner = function(week) {
  if (week === undefined || week === null) {
    Logger.log(PROJECT_NAME + ' | getWinner | שגיאה: פרמטר week חסר');
    return null;
  }

  try {
    var votesForWeek = getVotes(week);

    if (!votesForWeek || votesForWeek.length === 0) {
      Logger.log(PROJECT_NAME + ' | getWinner | לא נמצאו הצבעות לשבוע ' + week);
      return null;
    }

    // ניסיון ראשון: בדיקה אם יש ערך מוגדר בעמודת winner
    for (var i = 0; i < votesForWeek.length; i++) {
      var winnerVal = votesForWeek[i].winner;
      if (winnerVal && String(winnerVal).trim() !== '') {
        Logger.log(PROJECT_NAME + ' | getWinner | זוכה מעמודת winner לשבוע ' + week + ': ' + winnerVal);
        return String(winnerVal).trim();
      }
    }

    // ניסיון שני: חישוב הטרנד עם מרב הקולות
    var maxVotes    = -1;
    var winnerTrend = null;

    for (var j = 0; j < votesForWeek.length; j++) {
      var currentVotes = Number(votesForWeek[j].votes);
      var currentTrend = votesForWeek[j].trendName;
      if (!isNaN(currentVotes) && currentVotes > maxVotes) {
        maxVotes    = currentVotes;
        winnerTrend = currentTrend;
      }
    }

    if (winnerTrend) {
      Logger.log(PROJECT_NAME + ' | getWinner | זוכה לפי קולות לשבוע ' + week + ': ' + winnerTrend + ' (' + maxVotes + ' קולות)');
    } else {
      Logger.log(PROJECT_NAME + ' | getWinner | לא ניתן לקבוע זוכה לשבוע ' + week);
    }

    return winnerTrend;

  } catch (e) {
    Logger.log(PROJECT_NAME + ' | getWinner | שגיאה באיתור הזוכה: ' + e.message);
    return null;
  }
};
