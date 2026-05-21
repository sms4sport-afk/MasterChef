```javascript
/**
 * ====================================================
 * MasterChef/BusinessLogic.gs
 * גרסה: v1.5 (20/05/2026)
 * סטטוס: ✅ STABLE
 * פרויקט: MasterChef
 *
 * תיאור: לוגיקה עסקית מרכזית של פרויקט MasterChef —
 *        קביעת זוכה, שליחת סקר לווטסאפ, שליחת חומרים שבועיים
 *
 * פונקציות:
 *   determineWinner(week)      — קובע זוכה שבוע לפי הצבעות, בשוויון: גורל שווה פי 2
 *   sendPoll(trends)           — שולח סקר לקבוצת ווטסאפ עם 3-4 טרנדים
 *   sendWeeklyContent(week)    — שולח חומרים מלאים לזוכה השבועי
 * ====================================================
 */

// ============================================================
// קביעת זוכה השבוע לפי הצבעות
// ============================================================

/**
 * determineWinner
 * ---------------
 * קורא את טאב Votes, מסנן לפי מספר שבוע,
 * מוצא את הטרנד עם הכי הרבה קולות.
 * בשוויון — גורל שווה משוקלל (שוויון מקבל פי 2 סיכוי).
 *
 * @param {number} week — מספר השבוע לקביעת הזוכה
 * @returns {string|null} שם הטרנד הזוכה, או null בכישלון
 */
function determineWinner(week) {
  try {
    // ולידציה של הפרמטר
    if (!week || isNaN(week)) {
      Logger.log('[' + PROJECT_NAME + '] determineWinner — שבוע לא תקין: ' + week);
      return null;
    }

    // פתיחת הגיליון
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var votesSheet = ss.getSheetByName(SHEET_VOTES);
    if (!votesSheet) {
      Logger.log('[' + PROJECT_NAME + '] determineWinner — טאב Votes לא נמצא');
      return null;
    }

    // קריאת כל הנתונים
    var lastRow = votesSheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      Logger.log('[' + PROJECT_NAME + '] determineWinner — אין נתוני הצבעה בגיליון');
      return null;
    }

    var data = votesSheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 5).getValues();

    // איסוף קולות לפי טרנד עבור השבוע הנבחר
    var votesMap = {};
    for (var i = 0; i < data.length; i++) {
      var rowWeek  = Number(data[i][COL_VOTES_WEEK  - 1]);
      var rowTrend = String(data[i][COL_VOTES_TREND - 1]).trim();
      var rowCount = Number(data[i][COL_VOTES_COUNT - 1]);

      // סינון לפי שבוע
      if (rowWeek !== Number(week)) continue;
      if (!rowTrend) continue;

      // צבירת קולות
      if (votesMap[rowTrend] === undefined) {
        votesMap[rowTrend] = 0;
      }
      votesMap[rowTrend] += rowCount;
    }

    // בדיקה שיש נתונים
    var trendNames = Object.keys(votesMap);
    if (trendNames.length === 0) {
      Logger.log('[' + PROJECT_NAME + '] determineWinner — לא נמצאו הצבעות לשבוע ' + week);
      return null;
    }

    // מציאת מספר הקולות המקסימלי
    var maxVotes = 0;
    for (var j = 0; j < trendNames.length; j++) {
      if (votesMap[trendNames[j]] > maxVotes) {
        maxVotes = votesMap[trendNames[j]];
      }
    }

    // איסוף כל הטרנדים עם הקולות המרביים (מצב שוויון)
    var winners = [];
    for (var k = 0; k < trendNames.length; k++) {
      if (votesMap[trendNames[k]] === maxVotes) {
        winners.push(trendNames[k]);
      }
    }

    var chosenWinner = '';

    // אם יש זוכה אחד ברור — הוא הזוכה
    if (winners.length === 1) {
      chosenWinner = winners[0];
      Logger.log('[' + PROJECT_NAME + '] determineWinner — זוכה ברור: ' + chosenWinner + ' (' + maxVotes + ' קולות)');

    } else {
      // שוויון — גורל משוקלל: כל טרנד בשוויון מקבל פי 2 מהטרנדים שאינם בשוויון
      // כיוון שכולם בשוויון, נבנה מערך משוקלל עם כפל עבור כל אחד מהם
      Logger.log('[' + PROJECT_NAME + '] determineWinner — שוויון בין ' + winners.length + ' טרנדים, מפעיל גורל משוקלל');

      var weightedPool = [];
      for (var w = 0; w < winners.length; w++) {
        // כל טרנד בשוויון נכנס פי 2 לסל הגורל
        weightedPool.push(winners[w]);
        weightedPool.push(winners[w]);
      }

      // בחירה אקראית מתוך הסל המשוקלל
      var randomIndex = Math.floor(Math.random() * weightedPool.length);
      chosenWinner = weightedPool[randomIndex];
      Logger.log('[' + PROJECT_NAME + '] determineWinner — זוכה גורל: ' + chosenWinner);
    }

    // שמירת הזוכה בעמודה D של Votes
    for (var r = 0; r < data.length; r++) {
      var rowWeekCheck  = Number(data[r][COL_VOTES_WEEK  - 1]);
      var rowTrendCheck = String(data[r][COL_VOTES_TREND - 1]).trim();
      if (rowWeekCheck === Number(week) && rowTrendCheck === chosenWinner) {
        votesSheet.getRange(DATA_START_ROW + r, COL_VOTES_WINNER).setValue(chosenWinner);
        break;
      }
    }

    // שמירת הזוכה ב-Script Properties לשימוש עתידי
    PropertiesService.getScriptProperties().setProperty(PROP_KEY_CURRENT_TREND, chosenWinner);

    Logger.log('[' + PROJECT_NAME + '] determineWinner — הסתיים בהצלחה. זוכה: ' + chosenWinner);
    return chosenWinner;

  } catch (e) {
    Logger.log('[' + PROJECT_NAME + '] determineWinner — שגיאה: ' + e.message);
    return null;
  }
}

// ============================================================
// שליחת סקר לקבוצת ווטסאפ
// ============================================================

/**
 * sendPoll
 * --------
 * מקבל מערך של 3-4 טרנדים קולינריים ושולח הודעת סקר
 * לקבוצת הווטסאפ דרך Green API.
 * הסקר מנוסח בעברית עם הוראות הצבעה ברורות.
 *
 * @param {Array<string>} trends — מערך שמות טרנדים (3 עד 4 פריטים)
 * @returns {boolean} האם השליחה הצליחה
 */
function sendPoll(trends) {
  try {
    // ולידציה של הפרמטר
    if (!trends || !Array.isArray(trends)) {
      Logger.log('[' + PROJECT_NAME + '] sendPoll — פרמטר trends אינו מערך תקין');
      return false;
    }

    if (trends.length < 3 || trends.length > 4) {
      Logger.log('[' + PROJECT_NAME + '] sendPoll — מספר טרנדים לא תקין: ' + trends.length + ' (נדרש 3-4)');
      return false;
    }

    // בניית הודעת הסקר
    var pollMessage = '🍳 *סקר שבועי — מאסטר שף!* 🍳\n\n';
    pollMessage += 'הגיע הזמן לבחור את הטרנד הקולינרי של השבוע! 🌟\n\n';
    pollMessage += 'הצביעו למועדפכם:\n\n';

    var options = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    for (var i = 0; i < trends.length; i++) {
      pollMessage += options[i] + ' *' + trends[i] + '*\n';
    }

    pollMessage += '\nשלחו את מספר הבחירה שלכם בתגובה! ⬇️\n';
    pollMessage += '🗳️ ההצבעה תיסגר מחר בצהריים (12:00)';

    // קריאת פרטי Green API מ-Script Properties
    var props        = PropertiesService.getScriptProperties();
    var apiToken     = props.getProperty('GREEN_API_TOKEN');
    var instanceId   = props.getProperty('INSTANCE_ID');

    if (!apiToken || !instanceId) {
      Logger.log('[' + PROJECT_NAME + '] sendPoll — GREEN_API_TOKEN או INSTANCE_ID חסרים ב-Script Properties');
      return false;
    }

    // בניית ה-URL לשליחת הודעה דרך Green API
    var apiUrl = 'https://api.green-api.com/waInstance' + instanceId + '/sendMessage/' + apiToken;

    // בניית גוף הבקשה
    var payload = {
      chatId:  WHATSAPP_GROUP_ID,
      message: pollMessage
    };

    // הגדרות הבקשה
    var options = {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // שליחה עם ניסיונות חוזרים
    var success  = false;
    var attempt  = 0;
    var response = null;

    while (attempt < MAX_RETRIES && !success) {
      attempt++;
      Logger.log('[' + PROJECT_NAME + '] sendPoll — ניסיון ' + attempt + '/' + MAX_RETRIES);

      try {
        response = UrlFetchApp.fetch(apiUrl, options);
        var responseCode = response.getResponseCode();

        if (responseCode === 200) {
          success = true;
          Logger.log('[' + PROJECT_NAME + '] sendPoll — נשלח בהצלחה. קוד תגובה: ' + responseCode);
        } else {
          Logger.log('[' + PROJECT_NAME + '] sendPoll — קוד תגובה לא תקין: ' + responseCode + ' | תגובה: ' + response.getContentText());
          if (attempt < MAX_RETRIES) {
            Utilities.sleep(RETRY_SLEEP_MS);
          }
        }
      } catch (fetchError) {
        Logger.log('[' + PROJECT_NAME + '] sendPoll — שגיאת fetch בניסיון ' + attempt + ': ' + fetchError.message);
        if (attempt < MAX_RETRIES) {
          Utilities.sleep(RETRY_SLEEP_MS);
        }
      }
    }

    if (!success) {
      Logger.log('[' + PROJECT_NAME + '] sendPoll — נכשל לאחר ' + MAX_RETRIES + ' ניסיונות');
      return false;
    }

    // שמירת תאריך שליחת הסקר
    var now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    PropertiesService.getScriptProperties().setProperty(PROP_KEY_LAST_SURVEY, now);

    // רישום בגיליון Results — עמודת זמן שליחה
    try {
      var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
      var resultsSheet = ss.getSheetByName(SHEET_MAIN);
      if (resultsSheet) {
        var lastRow = resultsSheet.getLastRow();
        if (lastRow >= DATA_START_ROW) {
          // עדכון שורה אחרונה עם זמן שליחה
          resultsSheet.getRange(lastRow, COL_RESULTS_SENT_AT).setValue(now);
        }
      }
    } catch (sheetError) {
      // שגיאה בגיליון לא אמורה לבטל הצלחת השליחה
      Logger.log('[' + PROJECT_NAME + '] sendPoll — שגיאה ברישום בגיליון: ' + sheetError.message);
    }

    Logger.log('[' + PROJECT_NAME + '] sendPoll — הסתיים בהצלחה');
    return true;

  } catch (e) {
    Logger.log('[' + PROJECT_NAME + '] sendPoll — שגיאה: ' + e.message);
    return false;
  }
}

// ============================================================
// שליחת חומרים שבועיים לזוכה
// ============================================================

/**
 * sendWeeklyContent
 * -----------------
 * מאחזר את חומרי השבוע מטאב Results Manager ושולח אותם
 * לקבוצת הווטסאפ. כולל: שם טרנד, סרטון, מצרכים ועלות.
 *
 * @param {number} week — מספר השבוע שחומריו ישלחו
 * @returns {boolean} האם השליחה הצליחה
 */
function sendWeeklyContent(week) {
  try {
    // ולידציה של הפרמטר
    if (!week || isNaN(week)) {
      Logger.log('[' + PROJECT_NAME + '] sendWeeklyContent — שבוע ל