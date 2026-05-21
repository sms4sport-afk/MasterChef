/**
 * ====================================================
 * MasterChef/BusinessLogic.gs
 * לוגיקה עסקית — קביעת זוכה, שליחת סקר, שליחת חומרים שבועיים
 * ====================================================
 */

// ============================================================
// קביעת זוכה השבוע
// ============================================================

/**
 * determineWinner — קובע את הזוכה על פי תוצאות ההצבעה של השבוע
 * @param {number} week — מספר השבוע לבדיקה
 * @return {string|null} שם הזוכה או null בכישלון
 */
function determineWinner(week) {
  try {
    var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
    var shVotes = ss.getSheetByName(SHEET_VOTES);

    if (!shVotes) {
      Logger.log('determineWinner: טאב Votes לא נמצא');
      return null;
    }

    var data     = shVotes.getDataRange().getValues();
    var bestRow  = null;
    var bestCount = -1;
    var tieCount  = 0;

    // סריקת שורות — מדלגים על כותרת
    for (var i = DATA_START_ROW - 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[COL_VOTES_WEEK - 1]) !== String(week)) continue;

      var count = Number(row[COL_VOTES_COUNT - 1]) || 0;
      if (count > bestCount) {
        bestCount = count;
        bestRow   = row;
        tieCount  = 1;
      } else if (count === bestCount) {
        tieCount++;
      }
    }

    if (!bestRow) {
      Logger.log('determineWinner: לא נמצאו הצבעות לשבוע ' + week);
      return null;
    }

    var winner = String(bestRow[COL_VOTES_WINNER - 1]);

    // בונוס תיקו
    if (tieCount > 1) {
      bestCount = bestCount * TIE_BONUS_MULTIPLIER;
      Logger.log('determineWinner: תיקו — הופעל מכפיל ' + TIE_BONUS_MULTIPLIER);
    }

    // שמירת הזוכה ב-Results
    var shResults = ss.getSheetByName(SHEET_MAIN);
    if (shResults) {
      shResults.appendRow([
        new Date(),
        bestRow[COL_VOTES_TREND - 1],
        winner,
        '',
        ''
      ]);
    }

    Logger.log('determineWinner: זוכה שבוע ' + week + ' — ' + winner);
    return winner;

  } catch (e) {
    Logger.log('determineWinner — שגיאה: ' + e.message);
    return null;
  }
}

// ============================================================
// שליחת סקר לקבוצת ווטסאפ
// ============================================================

/**
 * sendPoll — שולח הצבעה לקבוצת ווטסאפ על בסיס רשימת טרנדים
 * @param {Array} trends — מערך שמות טרנדים
 * @return {boolean} האם השליחה הצליחה
 */
function sendPoll(trends) {
  try {
    if (!trends || trends.length < MIN_TRENDS_FOR_POLL) {
      Logger.log('sendPoll: מספר טרנדים לא מספיק (' + (trends ? trends.length : 0) + ')');
      return false;
    }

    // חיתוך לפי מקסימום מוגדר
    var pollTrends = trends.slice(0, MAX_TRENDS_FOR_POLL);

    // בניית הודעת סקר
    var msg = '🍳 *סקר המאסטרשף השבועי* 🍳\n\n';
    msg += 'בחרו את הטרנד הקולינרי של השבוע:\n\n';
    for (var i = 0; i < pollTrends.length; i++) {
      msg += (i + 1) + '. ' + pollTrends[i] + '\n';
    }
    msg += '\nענו במספר בלבד 🙏';

    // שליחה דרך Green API
    var props       = PropertiesService.getScriptProperties();
    var instanceId  = props.getProperty('INSTANCE_ID');
    var apiToken    = props.getProperty('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      Logger.log('sendPoll: חסרים INSTANCE_ID או GREEN_API_TOKEN ב-Script Properties');
      return false;
    }

    var url     = 'https://api.green-api.com/waInstance' + instanceId + '/sendMessage/' + apiToken;
    var payload = JSON.stringify({
      chatId:  WHATSAPP_GROUP_ID,
      message: msg
    });

    var options = {
      method:             'post',
      contentType:        'application/json',
      payload:            payload,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();

    if (code !== 200) {
      Logger.log('sendPoll: שגיאת HTTP ' + code + ' — ' + response.getContentText());
      return false;
    }

    // רישום זמן שליחה ב-Results
    var ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
    var shResults = ss.getSheetByName(SHEET_MAIN);
    if (shResults) {
      shResults.appendRow([
        new Date(),
        pollTrends.join(', '),
        '',
        '',
        new Date()
      ]);
    }

    // שמירת טרנד נוכחי ב-Properties
    PropertiesService.getScriptProperties().setProperty(
      PROP_KEY_LAST_SURVEY,
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd')
    );

    Logger.log('sendPoll: נשלח בהצלחה עם ' + pollTrends.length + ' טרנדים');
    return true;

  } catch (e) {
    Logger.log('sendPoll — שגיאה: ' + e.message);
    return false;
  }
}

// ============================================================
// שליחת חומרים שבועיים לקבוצה
// ============================================================

/**
 * sendWeeklyContent — שולח חומרי שבוע (סרטון, מצרכים, עלות) לקבוצת ווטסאפ
 * @param {number} week — מספר השבוע לשליחה
 * @return {boolean} האם השליחה הצליחה
 */
function sendWeeklyContent(week) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var shRM  = ss.getSheetByName(SHEET_RESULTS_MGR);

    if (!shRM) {
      Logger.log('sendWeeklyContent: טאב Results לא נמצא');
      return false;
    }

    var data    = shRM.getDataRange().getValues();
    var content = null;

    // מאתרים את שורת השבוע המבוקש
    for (var i = DATA_START_ROW - 1; i < data.length; i++) {
      if (String(data[i][COL_RM_WEEK - 1]) === String(week)) {
        content = data[i];
        break;
      }
    }

    if (!content) {
      Logger.log('sendWeeklyContent: לא נמצאו חומרים לשבוע ' + week);
      return false;
    }

    var trend       = content[COL_RM_TREND       - 1];
    var video       = content[COL_RM_VIDEO       - 1];
    var ingredients = content[COL_RM_INGREDIENTS - 1];
    var cost        = content[COL_RM_COST        - 1];

    // בניית הודעה
    var msg = '🍽️ *חומרי השבוע — ' + trend + '* 🍽️\n\n';
    if (video)       msg += '🎬 סרטון: ' + video + '\n\n';
    if (ingredients) msg += '🛒 מצרכים:\n' + ingredients + '\n\n';
    if (cost)        msg += '💰 עלות משוערת: ' + cost + '\n\n';
    msg += 'בהצלחה לכולם! 👨‍🍳';

    // שליחה דרך Green API
    var props      = PropertiesService.getScriptProperties();
    var instanceId = props.getProperty('INSTANCE_ID');
    var apiToken   = props.getProperty('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      Logger.log('sendWeeklyContent: חסרים INSTANCE_ID או GREEN_API_TOKEN');
      return false;
    }

    var url     = 'https://api.green-api.com/waInstance' + instanceId + '/sendMessage/' + apiToken;
    var payload = JSON.stringify({
      chatId:  WHATSAPP_GROUP_ID,
      message: msg
    });

    var options = {
      method:             'post',
      contentType:        'application/json',
      payload:            payload,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var code     = response.getResponseCode();

    if (code !== 200) {
      Logger.log('sendWeeklyContent: שגיאת HTTP ' + code + ' — ' + response.getContentText());
      return false;
    }

    // עדכון סטטוס שליחה בגיליון
    for (var r = DATA_START_ROW - 1; r < data.length; r++) {
      if (String(data[r][COL_RM_WEEK - 1]) === String(week)) {
        shRM.getRange(r + 1, COL_RM_SENT).setValue(true);
        shRM.getRange(r + 1, COL_RM_SAVED_AT).setValue(new Date());
        break;
      }
    }

    Logger.log('sendWeeklyContent: חומרי שבוע ' + week + ' נשלחו בהצלחה');
    return true;

  } catch (e) {
    Logger.log('sendWeeklyContent — שגיאה: ' + e.message);
    return false;
  }
}
