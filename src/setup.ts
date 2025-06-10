/// <reference types="google-apps-script" />
import { CONFIG } from './utils';

/**
 * 初期セットアップ実行（最初に一度だけ実行）
 */
function initialSetup() {
    try {
      console.log('🚀 === 初期セットアップ開始 ===');
      
      const spreadsheetId = createInitialSpreadsheet();
      console.log(`✅ スプレッドシート作成完了: ${spreadsheetId}`);
      console.log('📋 このIDをメイン処理.gsのCONFIG.SPREADSHEET_IDに設定してください');
      
      setupTriggers();
      insertSampleData(spreadsheetId);
      
      console.log('🎉 === 初期セットアップ完了 ===');
      console.log('📝 次の手順:');
      console.log('1. メイン処理.gsのCONFIG.SPREADSHEET_IDを更新');
      console.log('2. アカウント情報を「アカウント管理」シートに入力');
      console.log('3. setAccountToken()でアクセストークンを設定');
      console.log('4. 「コンテンツ」シートに投稿内容を入力');
      console.log('5. 「アフィリエイト」シートにアフィリエイト情報を入力');
      console.log('6. mainWithSimpleReply()でテスト投稿実行');
      
      return spreadsheetId;
      
    } catch (error) {
      console.error('❌ 初期セットアップエラー:', error);
      throw error;
    }
  }
  
  // ==============================================
  // スプレッドシート作成機能
  // ==============================================
  
  /**
   * スプレッドシート作成・初期化
   */
  function createInitialSpreadsheet() {
    try {
      const spreadsheet = SpreadsheetApp.create('Threads自動アフィリエイトシステム');
      const spreadsheetId = spreadsheet.getId();
      
      console.log('📊 スプレッドシート作成中...');
      
      // 必要なシートを順番に作成
      createAccountSheet(spreadsheet);
      createContentSheet(spreadsheet);
      createScheduleSheet(spreadsheet);
      createLogsSheet(spreadsheet);
      createAffiliateSheet(spreadsheet);
      createAffiliateTrackingSheet(spreadsheet);
      
      // デフォルトシートを削除
      deleteDefaultSheet(spreadsheet);
      
      console.log('✅ 全シート作成完了');
      return spreadsheetId;
      
    } catch (error) {
      console.error('❌ スプレッドシート作成エラー:', error);
      throw error;
    }
  }
  
  /**
   * デフォルトシート削除
   */
  function deleteDefaultSheet(spreadsheet) {
    try {
      const defaultSheet = spreadsheet.getSheetByName('シート1');
      if (defaultSheet && spreadsheet.getSheets().length > 1) {
        spreadsheet.deleteSheet(defaultSheet);
        console.log('🗑️ デフォルトシートを削除しました');
      }
    } catch (error) {
      console.log('⚠️ デフォルトシートの削除をスキップ（権限不足）');
    }
  }
  
  /**
   * アカウント管理シート作成
   */
  function createAccountSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('アカウント管理');
    
    const headers = [
      'アカウントID', 'ユーザー名', 'アプリID', 'ユーザーID', 
      '最終投稿時間', '日次投稿数', 'ステータス'
    ];
    
    // ヘッダー設定
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    const columnWidths = [100, 150, 150, 150, 150, 100, 100];
    columnWidths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });
    
    // ステータスのデータ検証
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['アクティブ', '停止中', 'エラー'])
      .build();
    sheet.getRange(2, 7, 1000, 1).setDataValidation(statusRule);
    
    console.log('✅ アカウント管理シート作成完了');
  }
  
  /**
   * コンテンツシート作成
   */
  function createContentSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('コンテンツ');
    
    const headers = [
      'コンテンツID', 'メイン投稿文', '使用回数', '画像使用フラグ'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    sheet.setColumnWidth(1, 120); // コンテンツID
    sheet.setColumnWidth(2, 500); // メイン投稿文
    sheet.setColumnWidth(3, 80);  // 使用回数
    sheet.setColumnWidth(4, 120); // 画像使用フラグ
    
    // 画像使用フラグのデータ検証
    const imageRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['YES', 'NO'])
      .build();
    sheet.getRange(2, 4, 1000, 1).setDataValidation(imageRule);
    
    console.log('✅ コンテンツシート作成完了');
  }
  
  /**
   * 投稿スケジュールシート作成
   */
  function createScheduleSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('投稿スケジュール');
    
    const headers = [
      '作成日時', 'アカウントID', 'コンテンツID', '親投稿ID', 
      '実行予定時間', 'ステータス', '実行結果'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    const columnWidths = [150, 100, 100, 200, 150, 100, 200];
    columnWidths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });
    
    console.log('✅ 投稿スケジュールシート作成完了');
  }
  
  /**
   * 実行ログシート作成
   */
  function createLogsSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('実行ログ');
    
    const headers = [
      '実行日時', 'アカウント', 'コンテンツ', 'タイプ', 
      '結果', '投稿ID', 'エラー詳細'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    const columnWidths = [150, 120, 200, 120, 80, 200, 300];
    columnWidths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });
    
    console.log('✅ 実行ログシート作成完了');
  }
  
  /**
   * アフィリエイトシート作成
   */
  function createAffiliateSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('アフィリエイト');
    
    const headers = [
      'アフィリエイトID', 'コンテンツID', 'アプリ名', 
      '説明文', 'アフィリエイトURL', 'CTA文'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    const columnWidths = [120, 120, 150, 300, 300, 200];
    columnWidths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });
    
    console.log('✅ アフィリエイトシート作成完了');
  }
  
  /**
   * アフィリエイト追跡シート作成
   */
  function createAffiliateTrackingSheet(spreadsheet) {
    const sheet = spreadsheet.insertSheet('アフィリエイト追跡');
    
    const headers = [
      '投稿日時', 'アカウント', 'アプリ名', '投稿ID', 
      'アフィリエイトURL', 'クリック数推定', '成果数', '備考'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeader(sheet, 1, headers.length);
    
    // 列幅最適化
    const columnWidths = [150, 120, 150, 200, 300, 100, 100, 200];
    columnWidths.forEach((width, index) => {
      sheet.setColumnWidth(index + 1, width);
    });
    
    console.log('✅ アフィリエイト追跡シート作成完了');
  }
  
  /**
   * ヘッダー書式設定共通関数
   */
  function formatHeader(sheet, row, columnCount) {
    const headerRange = sheet.getRange(row, 1, 1, columnCount);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4a90e2');
    headerRange.setFontColor('white');
    headerRange.setHorizontalAlignment('center');
  }
  
  // ==============================================
  // トリガー・サンプルデータ設定
  // ==============================================
  
  /**
   * 定期実行トリガー設定
   */
  function setupTriggers() {
    try {
      // 既存トリガー削除
      deleteAllTriggers();
      
      // メイン処理トリガー（3時間毎）
      ScriptApp.newTrigger('main')
        .timeBased()
        .everyHours(3)
        .create();
      
      // 日次クリーンアップトリガー（毎日午前1時）
      ScriptApp.newTrigger('dailyCleanup')
        .timeBased()
        .everyDays(1)
        .atHour(1)
        .create();
      
      console.log('⏰ 定期実行トリガー設定完了');
      console.log('  - メイン投稿: 3時間毎');
      console.log('  - クリーンアップ: 毎日午前1時');
      
    } catch (error) {
      console.error('❌ トリガー設定エラー:', error);
    }
  }
  
  /**
   * サンプルデータ挿入
   */
  function insertSampleData(spreadsheetId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      
      // サンプルコンテンツ（最新フォーマット対応）
      const contentSheet = spreadsheet.getSheetByName('コンテンツ');
      const sampleContent = [
        ['CONTENT_001', '今からオ〇しようと思うけど、もうしこった〜？🍌おかずいる？？笑笑', 0, 'NO'],
        ['CONTENT_002', '最近のスマホアプリって種類多すぎて選べないよね🤔\nみんなはどうやって選んでる？', 0, 'NO'],
        ['CONTENT_003', '作業効率を10倍にしたツールがあるって聞いたんだけど...\n本当にそんなのある？🤯', 0, 'NO']
      ];
      
      contentSheet.getRange(2, 1, sampleContent.length, sampleContent[0].length)
        .setValues(sampleContent);
      
      // サンプルアフィリエイト
      const affiliateSheet = spreadsheet.getSheetByName('アフィリエイト');
      const sampleAffiliate = [
        ['AFF_001', 'CONTENT_001', '', 'ここに載せてるから好きに見ていいよ❤', 'https://1link.jp/is001', ''],
        ['AFF_002', 'CONTENT_002', 'おすすめアプリ', 'ユーザー評価4.8の人気アプリ！', 'https://example.com/affiliate/app1', '無料ダウンロードはこちら👆'],
        ['AFF_003', 'CONTENT_003', '効率化アプリ', '作業効率が本当に上がる神アプリ', 'https://example.com/affiliate/app2', '今すぐ試してみる🚀']
      ];
      
      affiliateSheet.getRange(2, 1, sampleAffiliate.length, sampleAffiliate[0].length)
        .setValues(sampleAffiliate);
      
      console.log('📝 サンプルデータ挿入完了');
      console.log('  - コンテンツ: 3件');
      console.log('  - アフィリエイト: 3件');
      
    } catch (error) {
      console.error('❌ サンプルデータ挿入エラー:', error);
    }
  }
  
  // ==============================================
  // 実用的なヘルパー関数
  // ==============================================
  
  /**
   * 本番用コンテンツ追加（改良版）
   */
  function addContentEasy(contentId, mainText, useImage = 'NO') {
    try {
      if (!CONFIG || !CONFIG.SPREADSHEET_ID) {
        console.error('❌ CONFIG.SPREADSHEET_IDが設定されていません');
        return false;
      }
      
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName('コンテンツ');
      
      sheet.appendRow([
        contentId,
        mainText,
        0, // 使用回数
        useImage
      ]);
      
      console.log(`✅ コンテンツ追加: ${contentId}`);
      return true;
      
    } catch (error) {
      console.error('❌ コンテンツ追加エラー:', error);
      return false;
    }
  }
  
  /**
   * 本番用アフィリエイト追加（改良版）
   */
  function addAffiliateEasy(affiliateId, contentId, appName, description, affiliateUrl, callToAction = '') {
    try {
      if (!CONFIG || !CONFIG.SPREADSHEET_ID) {
        console.error('❌ CONFIG.SPREADSHEET_IDが設定されていません');
        return false;
      }
      
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName('アフィリエイト');
      
      sheet.appendRow([
        affiliateId,
        contentId,
        appName,
        description,
        affiliateUrl,
        callToAction
      ]);
      
      console.log(`✅ アフィリエイト追加: ${affiliateId} (${appName})`);
      return true;
      
    } catch (error) {
      console.error('❌ アフィリエイト追加エラー:', error);
      return false;
    }
  }
  
  /**
   * アカウント情報追加
   */
  function addAccountEasy(accountId, username, appId, userId, status = 'アクティブ') {
    try {
      if (!CONFIG || !CONFIG.SPREADSHEET_ID) {
        console.error('❌ CONFIG.SPREADSHEET_IDが設定されていません');
        return false;
      }
      
      const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName('アカウント管理');
      
      sheet.appendRow([
        accountId,
        username,
        appId,
        userId,
        '', // 最終投稿時間
        0,  // 日次投稿数
        status
      ]);
      
      console.log(`✅ アカウント追加: ${username} (${accountId})`);
      return true;
      
    } catch (error) {
      console.error('❌ アカウント追加エラー:', error);
      return false;
    }
  }
  
  // ==============================================
  // 管理・メンテナンス関数
  // ==============================================
  
  /**
   * 全トリガー削除
   */
  function deleteAllTriggers() {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
      console.log(`🗑️ ${triggers.length} 個のトリガーを削除しました`);
    } catch (error) {
      console.error('❌ トリガー削除エラー:', error);
    }
  }
  
  /**
   * スプレッドシート再作成
   */
  function recreateSpreadsheet() {
    try {
      console.log('🔄 === スプレッドシート再作成開始 ===');
      
      const newSpreadsheetId = createInitialSpreadsheet();
      insertSampleData(newSpreadsheetId);
      
      console.log(`✅ 新しいスプレッドシートID: ${newSpreadsheetId}`);
      console.log('📋 メイン処理.gsのCONFIG.SPREADSHEET_IDを更新してください');
      console.log('🔄 === スプレッドシート再作成完了 ===');
      
      return newSpreadsheetId;
    } catch (error) {
      console.error('❌ スプレッドシート再作成エラー:', error);
    }
  }
  
  /**
   * システム完全リセット
   */
  function resetSystem() {
    try {
      console.log('🔄 === システム完全リセット開始 ===');
      
      deleteAllTriggers();
      const newSpreadsheetId = recreateSpreadsheet();
      setupTriggers();
      
      console.log('🎉 === システム完全リセット完了 ===');
      console.log('📝 次の手順:');
      console.log('1. メイン処理.gsのCONFIG.SPREADSHEET_IDを更新');
      console.log('2. アカウント情報を再設定');
      console.log('3. アクセストークンを再設定');
      console.log('4. mainWithSimpleReply()でテスト投稿');
      
      return newSpreadsheetId;
    } catch (error) {
      console.error('❌ システムリセットエラー:', error);
    }
  }
  
  // ==============================================
  // セットアップ確認・テスト機能
  // ==============================================
  
  /**
   * セットアップ状況確認
   */
  function checkSetupStatus() {
    try {
      console.log('🔍 === セットアップ状況確認 ===');
      
      // CONFIG確認
      if (!CONFIG || !CONFIG.SPREADSHEET_ID) {
        console.log('❌ CONFIG.SPREADSHEET_IDが未設定');
        return false;
      }
      
      // スプレッドシート確認
      try {
        const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
        console.log('✅ スプレッドシート接続成功');
        
        // 必要シート確認
        const requiredSheets = ['アカウント管理', 'コンテンツ', 'アフィリエイト', '実行ログ'];
        const missingSheets = [];
        
        requiredSheets.forEach(sheetName => {
          const sheet = spreadsheet.getSheetByName(sheetName);
          if (sheet) {
            console.log(`✅ ${sheetName}シート: 存在`);
          } else {
            console.log(`❌ ${sheetName}シート: 不在`);
            missingSheets.push(sheetName);
          }
        });
        
        if (missingSheets.length > 0) {
          console.log('⚠️ 不足シートがあります。recreateSpreadsheet()で再作成してください');
          return false;
        }
        
      } catch (error) {
        console.log('❌ スプレッドシート接続失敗');
        return false;
      }
      
      // アカウント確認
      const accounts = getActiveAccounts();
      if (accounts.length === 0) {
        console.log('❌ アクティブなアカウントがありません');
        return false;
      } else {
        console.log(`✅ アクティブアカウント: ${accounts.length}件`);
      }
      
      // コンテンツ確認
      const content = getContentForPosting();
      if (!content) {
        console.log('❌ 投稿可能なコンテンツがありません');
        return false;
      } else {
        console.log('✅ 投稿可能なコンテンツ: あり');
      }
      
      console.log('🎉 セットアップ完了！mainWithSimpleReply()でテスト投稿可能です');
      return true;
      
    } catch (error) {
      console.error('❌ セットアップ確認エラー:', error);
      return false;
    }
  }