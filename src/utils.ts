/// <reference types="google-apps-script" />

// CONFIG設定（main.tsから移動）
export const CONFIG: Config = {
  THREADS_API_BASE: 'https://graph.threads.net/v1.0',
  SPREADSHEET_ID: '1aSOcfrTfeGl5GoogleAppCCZBqIXf0Tr#d-SSrnsm7eD4',
  POST_INTERVAL_MINUTES: 0,
  REPLY_DELAY_MINUTES: 5,
  MAX_DAILY_POSTS: -1,
};

// 安全にSpreadsheetを取得する関数
export function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!spreadsheet) {
    throw new Error('スプレッドシートが見つかりません');
  }
  return spreadsheet;
}

// 安全にSheetを取得する関数
export function getSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    throw new Error(`シート "${name}" が見つかりません`);
  }
  return sheet;
}

// エラーログ関数
export function logError(errorType: string, target: string, errorMessage: string): void {
  try {
    const sheet = getSheet('ログ');
    sheet.appendRow([
      new Date(),
      'エラー',
      errorType,
      target,
      errorMessage
    ]);
  } catch (error) {
    console.error('ログ記録エラー:', error);
  }
}

// HTTP メソッドの型安全な定義
export const HTTP_METHODS = {
  POST: 'post' as GoogleAppsScript.URL_Fetch.HttpMethod,
  GET: 'get' as GoogleAppsScript.URL_Fetch.HttpMethod,
  PUT: 'put' as GoogleAppsScript.URL_Fetch.HttpMethod,
  DELETE: 'delete' as GoogleAppsScript.URL_Fetch.HttpMethod,
};