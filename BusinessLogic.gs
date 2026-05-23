/**
 * ====================================================
 * MasterChef/BusinessLogic.gs
 * גרסה: v1.5
 * תיאור: לוגיקה עסקית — קביעת זוכה, שליחת סקר, שליחת חומרים שבועיים
 * ====================================================
 */

// ============================================================
// קביעת זוכה השבוע
// ============================================================

/**
 * קובעת את זוכה השבוע לפי תוצאות ההצבעה בגיליון Votes
 * @param {number} week - מספר השבוע
 * @return {string|null} שם הזוכה או null בכישלון
 */
function determineWinner(week) {
  try {
    // בדיקת קלט
    if (!week || isNaN(week)) {
      throw new Error('מספר שבוע לא תקין: ' + week);
    }

    var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet   = ss.getSheetByName(SHEET_VOTES);

    if (!sheet) {
      throw new Error('טאב Votes לא נמצא');
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      Logger.log('determineWinner: אין נתונים בטאב Votes');
      return null;
    }

    var data = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, 5).getValues();

    // חיפוש השורות של השבוע הנוכחי
    var weekRows = [];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][COL_VOTES_WEEK - 1]) === String(week)) {
        weekRows.push(data[i]);
      }
    }

    if (weekRows.length === 0) {
      Logger.log('determineWinner: לא נמצאו נתונים לשבוע ' + week);
      return null;
    }

    // מציאת מקסימום קולות
    var maxVotes  = 0;
    var winner    = '';
    var tieCount  = 0;

    for (var j = 0; j < weekRows.length; j++) {
      var votes = Number(weekRows[j][COL_VOTES_COUNT - 1]);
      if (votes > maxVotes) {
        maxVotes = votes;
        winner   = weekRows[j][COL_VOTES_WINNER - 1];
        tieCount = 1;
      } else if (votes === maxVotes) {
        tieCount++;
      }
    }

    // טיפול בתיקו — בונוס כפול לזוכה הראשון שנמצא
    if (tieCount > 1) {
      Logger.log('determineWinner: תיקו — מוחל מכפיל ' + TIE_BONUS_MULTIPLIER);
      maxVotes = maxVotes * TIE_BONUS_MULTIPLIER;
    }

    Logger.log('determineWinner: זוכה שבוע ' + week + ' — ' + winner + ' (' + maxVotes + ' קולות)');
    return winner || null;

  } catch (e) {
    Logger.log('שגיאה ב-determineWinner: ' + e.message);
    return null;
  }
}

// ============================================================
// שליחת סקר לקבוצת ווטסאפ
// ============================================================

/**
 * שולחת סקר לקבוצת ווטסאפ עם הטרנדים שנמצאו
 * @param {Array} trends - מערך שמות טרנדים לשליחה בסקר
 * @return {boolean} הצלחה/כישלון
 */
function sendPoll(trends) {
  try {
    // בדיקת קלט
    if (!trends || !Array.isArray(trends)) {
      throw new Error('רשימת טרנדים לא תקינה');
    }

    if (trends.length < MIN_TRENDS_FOR_POLL) {
      throw new Error('מספר טרנדים ' + trends.length + ' קטן מהמינימום ' + MIN_TRENDS_FOR_POLL);
    }

    // חיתוך לפי מקסימום
    var pollTrends = trends.slice(0, MAX_TRENDS_FOR_POLL);

    // בניית הודעת סקר
    var message = '🍳 *סקר המאסטר שף השבועי!*\n\n';
    message += 'מה הטרנד הקולינרי שתרצו לנסות השבוע? 👇\n\n';

    for (var i = 0; i < pollTrends.length; i++) {
      message += (i + 1) + '. ' + pollTrends[i] + '\n';
    }

    message += '\nהצביעו עם מספר הטרנד המועדף עליכם! 🗳️';

    // קריאת Script Properties לטוקן
    var props      = PropertiesService.getScriptProperties();
    var token      = props.getProperty('GREEN_API_TOKEN');
    var instanceId = props.getProperty('INSTANCE_ID');

    if (!token || !instanceId) {
      throw new Error('GREEN_API_TOKEN או INSTANCE_ID חסרים ב-Script Properties');
    }

    // שליחה דרך Green API
    var url     = 'https://api.green-api.com/waInstance' + instanceId + '/sendMessage/' + token;
    var payload = {
      chatId:  WHATSAPP_GROUP_ID,
      message: message
    };

    var options = {
      method:      'POST',
      contentType: 'application/json',
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();

    if (code !== 200) {
      throw new Error('Green API החזיר קוד ' + code + ': ' + response.getContentText());
    }

    // שמירת תאריך שליחה ב-Properties
    var props2 = PropertiesService.getScriptProperties();
    props2.setProperty(PROP_KEY_LAST_SURVEY, new Date().toISOString());

    Logger.log('sendPoll: סקר נשלח בהצלחה עם ' + pollTrends.length + ' טרנדים');
    return true;

  } catch (e) {
    Logger.log('שגיאה ב-sendPoll: ' + e.message);
    return false;
  }
}

// ============================================================
// שליחת חומרים שבועיים לקבוצה
// ============================================================

/**
 * שולחת חומרים שבועיים (מתכון, סרטון, מצרכים) לקבוצת ווטסאפ
 * @param {number} week - מספר השבוע
 * @return {boolean} הצלחה/כישלון
 */
function sendWeeklyContent(week) {
  try {
    // בדיקת קלט
    if (!week || isNaN(week)) {
      throw new Error('מספר שבוע לא תקין: ' + week);
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_RESULTS_MGR);

    if (!sheet) {
      throw new Error('טאב Results לא נמצא');
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) {
      throw new Error('אין נתונים בטאב Results');
    }

    var data    = sheet.getRange(DATA_START_ROW, 1, lastRow - HEADER_ROW, 7).getValues();
    var content = null;
    var rowIndex = -1;

    // חיפוש שורת השבוע
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][COL_RM_WEEK - 1]) === String(week)) {
        content  = data[i];
        rowIndex = i + DATA_START_ROW;
        break;
      }
    }

    if (!content) {
      throw new Error('לא נמצאו חומרים לשבוע ' + week);
    }

    // בדיקה אם כבר נשלח
    if (content[COL_RM_SENT - 1] === true || content[COL_RM_SENT - 1] === 'TRUE') {
      Logger.log('sendWeeklyContent: חומרי שבוע ' + week + ' כבר נשלחו — מדלג');
      return true;
    }

    var trend       = content[COL_RM_TREND - 1]       || 'לא צוין';
    var video       = content[COL_RM_VIDEO - 1]       || '';
    var ingredients = content[COL_RM_INGREDIENTS - 1] || 'לא צוינו';
    var cost        = content[COL_RM_COST - 1]        || 'לא ידוע';

    // בניית הודעה
    var message = '🍽️ *חומרי השבוע — ' + trend + '*\n\n';
    message += '📋 *מצרכים:*\n' + ingredients + '\n\n';
    message += '💰 *עלות משוערת:* ' + cost + '\n\n';

    if (video) {
      message += '🎬 *סרטון הכנה:* ' + video + '\n\n';
    }

    message += 'בהצלחה לכולם! 👨‍🍳👩‍🍳';

    // קריאת Script Properties
    var props      = PropertiesService.getScriptProperties();
    var token      = props.getProperty('GREEN_API_TOKEN');
    var instanceId = props.getProperty('INSTANCE_ID');

    if (!token || !instanceId) {
      throw new Error('GREEN_API_TOKEN או INSTANCE_ID חסרים ב-Script Properties');
    }

    // שליחה דרך Green API
    var url     = 'https://api.green-api.com/waInstance' + instanceId + '/sendMessage/' + token;
    var payload = {
      chatId:  WHATSAPP_GROUP_ID,
      message: message
    };

    var options = {
      method:      'POST',
      contentType: 'application/json',
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();

    if (code !== 200) {
      throw new Error('Green API החזיר קוד ' + code + ': ' + response.getContentText());
    }

    // עדכון עמודת "נשלח" בגיליון
    sheet.getRange(rowIndex, COL_RM_SENT).setValue(true);
    sheet.getRange(rowIndex, COL_RM_SAVED_AT).setValue(
      Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
    );

    Logger.log('sendWeeklyContent: חומרי שבוע ' + week + ' נשלחו בהצלחה');
    return true;

  } catch (e) {
    Logger.log('שגיאה ב-sendWeeklyContent: ' + e.message);
    return false;
  }
}
