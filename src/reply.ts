/// <reference types="google-apps-script" />
import { CONFIG, HTTP_METHODS } from './utils';
import { Account, AffiliateContent } from './types';

/**
 * 待機中のリプライ取得
 */
function getPendingReplies() {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.SCHEDULE);
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return [];
      
      const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const now = new Date();
      
      return data.filter(row => {
        return row[5] === '待機中' && new Date(row[4]) <= now;
      }).map((row, index) => ({
        id: index + 2,
        accountId: row[1],
        contentId: row[2],
        parentPostId: row[3],
        executeTime: row[4],
        status: row[5]
      }));
    } catch (error) {
      console.error('待機中リプライ取得エラー:', error);
      return [];
    }
  }
  
  /**
   * リプライ完了マーク
   */
  function markReplyAsCompleted(replyId) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.SCHEDULE);
      
      sheet.getRange(replyId, 6).setValue('完了');
      sheet.getRange(replyId, 7).setValue(new Date());
      
      console.log(`リプライ ${replyId} を完了マークしました`);
    } catch (error) {
      console.error('リプライ完了マークエラー:', error);
    }
  }
  
  // ==============================================
  // アフィリエイトデータ管理
  // ==============================================
  
  /**
   * アフィリエイトコンテンツ取得
   * ※メイン処理.gsと重複のため、そちらを使用推奨
   */
  function getAffiliateContentFromReply(contentId) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.AFFILIATE);
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return null;
      
      const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      
      const affiliateRow = data.find(row => row[1] === contentId);
      if (!affiliateRow) return null;
      
      return {
        id: affiliateRow[0],
        contentId: affiliateRow[1],
        appName: affiliateRow[2],
        description: affiliateRow[3],
        affiliateUrl: affiliateRow[4],
        callToAction: affiliateRow[5]
      };
    } catch (error) {
      console.error('アフィリエイトコンテンツ取得エラー:', error);
      return null;
    }
  }
  
  // ==============================================
  // リプライ投稿実行
  // ==============================================
  
  /**
   * スレッドリプライ実行
   * ※メイン処理.gsのexecuteThreadReplySimpleを使用推奨
   */
  function executeThreadReplyFromReplyFile(account, affiliateContent, parentPostId) {
    try {
      if (!account || !affiliateContent || !parentPostId) {
        return {
          success: false,
          error: '必要なパラメータが不足しています'
        };
      }
      
      const response = UrlFetchApp.fetch(
        `${CONFIG.THREADS_API_BASE}/${account.userId}/threads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({
            text: replyText,
            media_type: 'TEXT',
            reply_to_id: parentPostId
          })
        }
      );
      
      if (response.getResponseCode() === 200) {
        const result = JSON.parse(response.getContentText());
        
        const publishResponse = UrlFetchApp.fetch(
          `${CONFIG.THREADS_API_BASE}/${account.userId}/threads_publish`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
              'Content-Type': 'application/json'
            },
            payload: JSON.stringify({
              creation_id: result.id
            })
          }
        );
        
        if (publishResponse.getResponseCode() === 200) {
          const publishResult = JSON.parse(publishResponse.getContentText());
          logAffiliateActivity(account, affiliateContent, publishResult.id);
          
          return {
            success: true,
            postId: publishResult.id,
            creationId: result.id
          };
        }
      }
      
      return {
        success: false,
        error: `HTTP ${response.getResponseCode()}: ${response.getContentText()}`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.toString()
      };
    }
  }
  
  // ==============================================
  // アフィリエイト追跡・分析
  // ==============================================
  
  /**
   * アフィリエイト活動ログ
   */
  function logAffiliateActivity(account, affiliateContent, postId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      let sheet = spreadsheet.getSheetByName('アフィリエイト追跡');
      
      if (!sheet) {
        sheet = spreadsheet.insertSheet('アフィリエイト追跡');
        
        sheet.getRange(1, 1, 1, 8).setValues([[
          '投稿日時', 'アカウント', 'アプリ名', '投稿ID', 'アフィリエイトURL', 'クリック数推定', '成果数', '備考'
        ]]);
        
        sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
        sheet.getRange(1, 1, 1, 8).setBackground('#4a90e2');
        sheet.getRange(1, 1, 1, 8).setFontColor('white');
      }
      
      sheet.appendRow([
        new Date(),
        account.username,
        affiliateContent.appName,
        postId,
        affiliateContent.affiliateUrl,
        0,
        0,
        'リプライ投稿'
      ]);
      
      console.log(`アフィリエイト活動をログしました: ${affiliateContent.appName}`);
    } catch (error) {
      console.error('アフィリエイト活動ログエラー:', error);
    }
  }
  
  /**
   * アフィリエイト成果レポート生成
   */
  function generateAffiliateReport() {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName('アフィリエイト追跡');
      
      if (!sheet) {
        console.log('アフィリエイト追跡シートが見つかりません');
        return null;
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        console.log('アフィリエイトデータがありません');
        return null;
      }
      
      const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const thisMonthData = data.filter(row => {
        const postDate = new Date(row[0]);
        return postDate.getMonth() === currentMonth && postDate.getFullYear() === currentYear;
      });
      
      const report = {
        totalPosts: thisMonthData.length,
        totalClicks: thisMonthData.reduce((sum, row) => sum + (row[5] || 0), 0),
        totalConversions: thisMonthData.reduce((sum, row) => sum + (row[6] || 0), 0),
        conversionRate: 0,
        topApps: {}
      };
      
      if (report.totalClicks > 0) {
        report.conversionRate = (report.totalConversions / report.totalClicks * 100).toFixed(2);
      }
      
      thisMonthData.forEach(row => {
        const appName = row[2];
        if (!report.topApps[appName]) {
          report.topApps[appName] = { posts: 0, clicks: 0, conversions: 0 };
        }
        report.topApps[appName].posts++;
        report.topApps[appName].clicks += row[5] || 0;
        report.topApps[appName].conversions += row[6] || 0;
      });
      
      console.log('=== 今月のアフィリエイト成果レポート ===');
      console.log(`投稿数: ${report.totalPosts}`);
      console.log(`推定クリック数: ${report.totalClicks}`);
      console.log(`成果数: ${report.totalConversions}`);
      console.log(`コンバージョン率: ${report.conversionRate}%`);
      console.log('アプリ別成果:', report.topApps);
      
      return report;
      
    } catch (error) {
      console.error('レポート生成エラー:', error);
      return null;
    }
  }
  
  // ==============================================
  // 日次メンテナンス機能
  // ==============================================
  
  /**
   * 日次クリーンアップ処理
   * ※メイン処理.gsと重複のため、そちらを使用推奨
   */
  function dailyCleanupFromReply() {
    try {
      console.log('=== 日次クリーンアップ開始（リプライファイル版） ===');
      
      resetDailyPostCountsFromReply();
      cleanupCompletedSchedules();
      cleanupOldTriggers();
      
      console.log('=== 日次クリーンアップ完了 ===');
      
    } catch (error) {
      console.error('クリーンアップエラー:', error);
    }
  }
  
  /**
   * アカウントの日次投稿数リセット
   */
  function resetDailyPostCountsFromReply() {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.ACCOUNTS);
      
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 6, lastRow - 1, 1).setValue(0);
        console.log('日次投稿数をリセットしました');
      }
    } catch (error) {
      console.error('日次投稿数リセットエラー:', error);
    }
  }
  
  /**
   * 完了したスケジュール削除
   */
  function cleanupCompletedSchedules() {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.SCHEDULE);
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;
      
      const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][5] === '完了' && new Date(data[i][0]) < cutoffDate) {
          sheet.deleteRow(i + 2);
          deletedCount++;
        }
      }
      
      console.log(`完了済みスケジュール ${deletedCount} 件を削除しました`);
    } catch (error) {
      console.error('完了スケジュール削除エラー:', error);
    }
  }
  
  /**
   * 古いトリガー削除
   */
  function cleanupOldTriggers() {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      const now = new Date();
      let deletedCount = 0;
      
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'executeReplyPost') {
          const triggerTime = trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK ?
            new Date(trigger.getTriggerSourceId()) : null;
          
          if (triggerTime && triggerTime < new Date(now.getTime() - 60 * 60 * 1000)) {
            ScriptApp.deleteTrigger(trigger);
            deletedCount++;
          }
        }
      });
      
      console.log(`古いトリガー ${deletedCount} 件を削除しました`);
    } catch (error) {
      console.error('古いトリガー削除エラー:', error);
    }
  }