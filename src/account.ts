/// <reference types="google-apps-script" />
import { CONFIG, handleUnknownError } from './utils';

/**
 * 【アカウント初期設定.ts】
 * Threads自動アフィリエイトシステム - 新規アカウント追加専用ファイル
 */

// ==============================================
// 型定義
// ==============================================

interface UserInfo {
  success: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  profilePictureUrl?: string;
  biography?: string;
  fullResponse?: any;
  error?: string;
  responseCode?: number;
}

interface SetupResult {
  success: boolean;
  accountId?: string;
  userInfo?: UserInfo;
  error?: string;
}

interface AddResult {
  success: boolean;
  message: string;
}

interface Account {
  id: string;
  username: string;
  userId: string;
  accessToken?: string;
  lastPostTime?: string;
  dailyPostCount?: number;
  status: string;
}

// ==============================================
// 【メイン機能】新規アカウントセットアップ
// ==============================================

/**
 * 【推奨】新規アカウント追加 - 自動設定版
 */
function setupNewAccount(): SetupResult {
    console.log('🚀 === 新規アカウント追加開始 ===');

    // ⭐⭐⭐ ここに新しいアカウントのアクセストークンを入力 ⭐⭐⭐
    const newAccountToken = 'YOUR_ACCESS_TOKEN_HERE';

    // ⭐⭐⭐ ここにアカウントIDを指定（ACCOUNT_002, ACCOUNT_003...） ⭐⭐⭐
    const accountId = 'ACCOUNT_002';

    if (newAccountToken === 'YOUR_ACCESS_TOKEN_HERE') {
        console.error('❌ アクセストークンを設定してください');
        console.log(
            '👉 上記の const newAccountToken = の行にアクセストークンを貼り付け'
        );
        console.log('👉 accountId も必要に応じて変更してください');
        return { success: false, error: 'アクセストークン未設定' };
    }

    console.log(`🔧 アカウントID: ${accountId}`);
    console.log(`🔑 トークン長: ${newAccountToken.length} 文字`);
    console.log(`🔑 先頭10文字: ${newAccountToken.substring(0, 10)}...`);

    try {
        // Step 1: ユーザー情報取得
        console.log('\n📡 Step 1: ユーザー情報取得...');
        const userInfo = getThreadsUserInfo(newAccountToken);

        if (!userInfo.success) {
            console.error('❌ ユーザー情報取得失敗:', userInfo.error);
            displayTroubleShooting(userInfo.responseCode);
            return { success: false, error: userInfo.error };
        }

        console.log('✅ ユーザー情報取得成功!');
        console.log(`   ユーザーID: ${userInfo.userId}`);
        console.log(`   ユーザー名: ${userInfo.username}`);
        console.log(`   表示名: ${userInfo.displayName}`);

        // Step 2: アクセストークン保存
        console.log('\n🔐 Step 2: アクセストークン保存...');
        setAccountToken(accountId, newAccountToken);
        console.log('✅ アクセストークン保存完了');

        // Step 3: スプレッドシートに追加
        console.log('\n📊 Step 3: スプレッドシートに追加...');
        const addResult = addAccountToSpreadsheetSafe(
            accountId,
            userInfo.username || '',
            userInfo.userId || ''
        );

        if (addResult.success) {
            console.log('✅ スプレッドシート追加完了');
        } else {
            console.log(`⚠️ ${addResult.message}`);
            displayManualInstructions(accountId, userInfo);
        }

        // Step 4: 設定確認・テスト
        console.log('\n🔍 Step 4: 設定確認...');
        verifyAccountSetup(accountId);

        console.log('\n🎉 === 新規アカウント追加完了! ===');
        console.log(
            '🧪 次のコマンドでテスト投稿: testSpecificAccount("' + accountId + '")'
        );
        console.log('🤖 自動投稿でローテーション: main()');

        return {
            success: true,
            accountId: accountId,
            userInfo: userInfo,
        };
    } catch (error: unknown) {
        console.error('❌ セットアップエラー:', handleUnknownError(error));
        return { success: false, error: handleUnknownError(error) };
    }
}

/**
 * 【カスタム版】3垢目以降の追加用
 */
function setupThirdAccount(): SetupResult {
    console.log('🚀 === 3垢目追加 ===');

    // ⭐ 3垢目のアクセストークンを入力 ⭐
    const thirdAccountToken = 'YOUR_ACCESS_TOKEN_HERE';

    return setupAccountWithToken('ACCOUNT_003', thirdAccountToken);
}

/**
 * 【カスタム版】4垢目追加用
 */
function setupFourthAccount(): SetupResult {
    console.log('🚀 === 4垢目追加 ===');

    // ⭐ 4垢目のアクセストークンを入力 ⭐
    const fourthAccountToken = 'YOUR_ACCESS_TOKEN_HERE';

    return setupAccountWithToken('ACCOUNT_004', fourthAccountToken);
}

// ==============================================
// 【ユーティリティ】アカウント情報取得
// ==============================================

/**
 * Threads APIからユーザー情報取得
 */
function getThreadsUserInfo(accessToken: string): UserInfo {
    try {
        if (!accessToken) {
            return { success: false, error: 'アクセストークンが指定されていません' };
        }

        const response = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/me?fields=id,username,name,threads_profile_picture_url,threads_biography`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                muteHttpExceptions: true,
            }
        );

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        console.log(`📡 API応答コード: ${responseCode}`);

        if (responseCode === 200) {
            const userData = JSON.parse(responseText);

            return {
                success: true,
                userId: userData.id,
                username: userData.username,
                displayName: userData.name || '',
                profilePictureUrl: userData.threads_profile_picture_url || '',
                biography: userData.threads_biography || '',
                fullResponse: userData,
            };
        } else {
            console.error(`❌ API呼び出し失敗: ${responseCode}`);
            console.error(`エラー詳細: ${responseText}`);

            return {
                success: false,
                error: `API呼び出し失敗: ${responseCode} - ${responseText}`,
                responseCode: responseCode,
            };
        }
    } catch (error: unknown) {
        console.error('❌ ユーザー情報取得エラー:', handleUnknownError(error));
        return {
            success: false,
            error: handleUnknownError(error),
        };
    }
}

/**
 * 汎用アカウントセットアップ関数
 */
function setupAccountWithToken(accountId: string, accessToken: string): SetupResult {
    if (accessToken === 'YOUR_ACCESS_TOKEN_HERE') {
        console.error(`❌ ${accountId} のアクセストークンを設定してください`);
        return { success: false, error: 'アクセストークン未設定' };
    }

    console.log(`🔧 ${accountId} セットアップ開始...`);

    const userInfo = getThreadsUserInfo(accessToken);
    if (!userInfo.success) {
        console.error(`❌ ${accountId} のユーザー情報取得失敗:`, userInfo.error);
        return userInfo;
    }

    // トークン保存
    setAccountToken(accountId, accessToken);

    // スプレッドシート追加
    const addResult = addAccountToSpreadsheetSafe(
        accountId,
        userInfo.username || '',
        userInfo.userId || ''
    );

    if (addResult.success) {
        console.log(`✅ ${accountId} (${userInfo.username}) 追加完了`);
        verifyAccountSetup(accountId);
        return { success: true, accountId: accountId, userInfo: userInfo };
    } else {
        console.log(`⚠️ ${addResult.message}`);
        displayManualInstructions(accountId, userInfo);
        return { success: false, error: addResult.message };
    }
}

// ==============================================
// 【スプレッドシート操作】安全な追加機能
// ==============================================

/**
 * 安全なアカウント追加（重複チェック付き）
 */
function addAccountToSpreadsheetSafe(accountId: string, username: string, userId: string): AddResult {
    try {
        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(
            CONFIG.SHEET_NAMES?.ACCOUNTS || 'アカウント管理'
        );

        if (!sheet) {
            return {
                success: false,
                message: 'アカウント管理シートが見つかりません',
            };
        }

        // 重複チェック
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
            const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

            // アカウントID重複チェック
            const duplicateId = data.some((row: any[]) => row[0] === accountId);
            if (duplicateId) {
                return {
                    success: false,
                    message: `アカウントID ${accountId} は既に存在します`,
                };
            }

            // ユーザー名重複チェック
            const duplicateUsername = data.some((row: any[]) => row[1] === username);
            if (duplicateUsername) {
                return {
                    success: false,
                    message: `ユーザー名 ${username} は既に存在します`,
                };
            }
        }

        // 新規追加
        sheet.appendRow([
            accountId, // A: アカウントID
            username, // B: ユーザー名
            '2542581129421398', // C: アプリID (現在の設定値)
            userId, // D: ユーザーID
            '', // E: 最終投稿時間
            0, // F: 日次投稿数
            'アクティブ', // G: ステータス
        ]);

        return { success: true, message: `${accountId} を追加しました` };
    } catch (error: unknown) {
        console.error('スプレッドシート追加エラー:', handleUnknownError(error));
        return { success: false, message: `エラー: ${handleUnknownError(error)}` };
    }
}

// ==============================================
// 【確認・テスト機能】
// ==============================================

/**
 * アカウント設定確認
 */
function verifyAccountSetup(accountId: string): boolean {
    try {
        console.log(`🔍 ${accountId} 設定確認中...`);

        const accounts = getActiveAccounts();
        const targetAccount = accounts.find((acc: Account) => acc.id === accountId);

        if (!targetAccount) {
            console.log(`❌ ${accountId} がアクティブアカウントに見つかりません`);
            return false;
        }

        console.log(`✅ アカウント認識: ${targetAccount.username}`);
        console.log(`✅ ユーザーID: ${targetAccount.userId}`);
        console.log(
            `✅ アクセストークン: ${targetAccount.accessToken ? '設定済み' : '未設定'}`
        );

        return true;
    } catch (error: unknown) {
        console.error('設定確認エラー:', handleUnknownError(error));
        return false;
    }
}

/**
 * 指定アカウントでテスト投稿
 */
function testSpecificAccount(accountId: string): void {
    console.log(`🧪 === ${accountId} テスト投稿 ===`);

    const accounts = getActiveAccounts();
    const targetAccount = accounts.find((acc: Account) => acc.id === accountId);

    if (!targetAccount) {
        console.log(`❌ ${accountId} が見つかりません`);
        console.log('💡 setupNewAccount() を先に実行してください');
        return;
    }

    if (!targetAccount.accessToken) {
        console.log(`❌ ${accountId} のアクセストークンが設定されていません`);
        return;
    }

    console.log(`🎯 ${targetAccount.username} でテスト投稿実行...`);

    const content = getContentForPosting();
    if (!content) {
        console.log('❌ 投稿可能なコンテンツがありません');
        return;
    }

    const result = executeMainPostWithCloudinary(targetAccount, content);

    if (result.success) {
        console.log(`🎉 ${accountId} 投稿成功!`);
        console.log(`📍 投稿ID: ${result.postId}`);
        console.log(`🖼️ 画像: ${result.hasImage ? 'あり' : 'なし'}`);
    } else {
        console.log(`❌ ${accountId} 投稿失敗: ${result.error}`);
    }
}

/**
 * 全アカウント状況確認
 */
function checkAllAccountsStatus(): void {
    console.log('🔍 === 全アカウント状況確認 ===');

    try {
        const accounts = getActiveAccounts();
        console.log(`認識されたアカウント数: ${accounts.length}`);

        if (accounts.length === 0) {
            console.log('❌ アクティブなアカウントがありません');
            return;
        }

        accounts.forEach((account: Account, index: number) => {
            console.log(`\n${index + 1}. ${account.id}`);
            console.log(`   ユーザー名: ${account.username}`);
            console.log(`   ユーザーID: ${account.userId}`);
            console.log(
                `   トークン: ${account.accessToken ? '✅ 設定済み' : '❌ 未設定'}`
            );
            console.log(`   最終投稿: ${account.lastPostTime || '未投稿'}`);
            console.log(`   日次投稿数: ${account.dailyPostCount || 0}`);
            console.log(`   ステータス: ${account.status}`);
        });

        console.log(`\n📊 合計 ${accounts.length} アカウントが利用可能です`);
    } catch (error: unknown) {
        console.error('❌ 状況確認エラー:', handleUnknownError(error));
    }
}

// ==============================================
// 【エラー対処・ヘルプ機能】
// ==============================================

/**
 * トラブルシューティング表示
 */
function displayTroubleShooting(responseCode?: number): void {
    console.log('\n🔧 === トラブルシューティング ===');

    switch (responseCode) {
        case 400:
            console.log('🚫 400 Bad Request - リクエスト形式エラー');
            console.log('   対処法: アクセストークンの形式を確認');
            break;

        case 401:
            console.log('🔑 401 Unauthorized - 認証エラー');
            console.log('   対処法1: 新しいアクセストークンを生成');
            console.log('   対処法2: Meta Developers でアプリ設定確認');
            break;

        case 403:
            console.log('🚫 403 Forbidden - 権限不足');
            console.log('   対処法: Threads API の権限を有効化');
            break;

        case 500:
            console.log('💥 500 Internal Server Error - サーバーエラー');
            console.log('   対処法1: しばらく待ってから再実行');
            console.log('   対処法2: Meta Developers でアプリ設定確認');
            break;

        default:
            console.log(`❓ ${responseCode || 'unknown'} 予期しないエラー`);
            console.log('   対処法: Meta Developers サポートに問い合わせ');
    }

    console.log('\n📋 共通確認事項:');
    console.log('   - Threads API が有効化されているか');
    console.log('   - アプリが「本番」モードになっているか');
    console.log('   - 適切な権限が設定されているか');
}

/**
 * 手動設定手順表示
 */
function displayManualInstructions(accountId: string, userInfo: UserInfo): void {
    console.log('\n📋 === 手動設定手順 ===');
    console.log('スプレッドシート「アカウント管理」に以下を追加:');
    console.log('=====================================');
    console.log(`アカウントID: ${accountId}`);
    console.log(`ユーザー名: ${userInfo.username}`);
    console.log(`アプリID: 2542581129421398`);
    console.log(`ユーザーID: ${userInfo.userId}`);
    console.log(`最終投稿時間: (空欄)`);
    console.log(`日次投稿数: 0`);
    console.log(`ステータス: アクティブ`);
    console.log('=====================================');
}

// ==============================================
// 【便利機能】トークン管理
// ==============================================

/**
 * 保存済みトークン一覧表示
 */
function listSavedTokens(): void {
    console.log('🔍 === 保存済みトークン一覧 ===');

    const properties = PropertiesService.getScriptProperties().getProperties();
    const tokenKeys = Object.keys(properties).filter((key: string) =>
        key.startsWith('TOKEN_')
    );

    if (tokenKeys.length === 0) {
        console.log('❌ 保存されているトークンがありません');
        return;
    }

    tokenKeys.forEach((key: string) => {
        const accountId = key.replace('TOKEN_', '');
        const token = properties[key];
        const maskedToken = token.substring(0, 20) + '...';
        console.log(`${accountId}: ${maskedToken}`);
    });

    console.log(`\n📊 合計 ${tokenKeys.length} 個のトークンが保存されています`);
}

/**
 * 特定アカウントのトークン削除
 */
function removeAccountToken(accountId: string): void {
    try {
        PropertiesService.getScriptProperties().deleteProperty(
            `TOKEN_${accountId}`
        );
        console.log(`✅ ${accountId} のトークンを削除しました`);
    } catch (error: unknown) {
        console.error(`❌ ${accountId} のトークン削除エラー:`, handleUnknownError(error));
    }
}

/**
 * アカウントアクセストークン設定
 */
function setAccountToken(accountId: string, accessToken: string): void {
    try {
        PropertiesService.getScriptProperties().setProperty(
            `TOKEN_${accountId}`,
            accessToken
        );
        console.log(`✅ アカウント ${accountId} のトークンを設定しました`);
    } catch (error: unknown) {
        console.error('❌ トークン設定エラー:', handleUnknownError(error));
    }
}

// ==============================================
// 【バッチ処理】複数アカウント一括セットアップ
// ==============================================

interface BulkAccount {
    id: string;
    token: string;
}

/**
 * 複数アカウント一括追加用テンプレート
 */
function bulkSetupAccounts(): void {
    console.log('🚀 === 複数アカウント一括セットアップ ===');
    console.log('⚠️ 以下の配列にアカウント情報を設定してから実行してください');

    // ⭐ ここに複数アカウントの情報を設定 ⭐
    const accountsToAdd: BulkAccount[] = [
        {
            id: 'ACCOUNT_008',
            token: 'THAAkIds0IIlZABUVRHX21CQWt1d1BPZAndlZAVkwVm1TYVB1T2w2WWcydlZA0VGVHYTBnN3g1a2VkZA084dUZAVRUNYenN4bXY0ME1SZAHR6RFBHandoSDk5ZAUM2UlY0VHB2eTEyeVhjZAVo1cm1DU0tXbzc0VkpXVzRBaXlycGFrYlJlUS1HNS1CaWlNR2dNa05MZAFUZD',
        },
        {
            id: 'ACCOUNT_009',
            token: 'THAAkIds0IIlZABUVFrX0lSeU1nZAWlOVXFyTk5FQ19MWVRvcXdaX3NBNEV4SVcwSmtFNjFkUlZAkckNMN09scTNrMG91T0NJRjZAlZA20tSmxWejQ3aE5fbU90cFd4cTV1ZA214eW9KTHJsZA05mUUV4SVRlYkZAhR3JWelZAHWEtRendLY3ptVGM2S2JxZADNKM1dFZAXcZD',
        },
        {
            id: 'ACCOUNT_010',
            token: 'THAAkIds0IIlZABUVNBN3NtcTRoSnJ4NF9yQklLRmpwRVQwSTRicEtzeHc1cmpIdUNHeVk3aDFfV0l0NWFfSmphWHBRT3FtOTRHeTlmNnVVeERZAT0lBNWtQXzdTTzd3VkVZAS2NYclpZAdk8xLW84MVZAfcUxPS0FLTl83S2h1S0o4cmxUQjRGN280Uk5sNllPbkEZD',
        },
        {
            id: 'ACCOUNT_011',
            token: 'THAAkIds0IIlZABUVJweTBKT0pFQ25PSW1UOVh2Slp0dmptdjNIemRNU1ROOXFKYjFuVkoxX1BONzhVQnRXRURPUlhzbndkb0prZADB3dktXWXpiQ0luT1N4MjVwUlN1cVFzNkd1Vm5BRHdNalZA5ZAmEwV0RDN1M5RGVxei1RUk1lOE1lUjRxM2ZAXUWNDb2hBbFEZD',
        },
        // 必要に応じて追加...
    ];

    let successCount = 0;
    let failCount = 0;

    accountsToAdd.forEach((account: BulkAccount, index: number) => {
        console.log(
            `\n🔄 ${index + 1}/${accountsToAdd.length}: ${account.id} 処理中...`
        );

        if (
            account.token === 'YOUR_TOKEN_3_HERE' ||
            account.token === 'YOUR_TOKEN_4_HERE' ||
            account.token === 'YOUR_TOKEN_5_HERE'
        ) {
            console.log(`⚠️ ${account.id}: トークンが未設定`);
            failCount++;
            return;
        }

        const result = setupAccountWithToken(account.id, account.token);

        if (result.success) {
            console.log(`✅ ${account.id}: 成功`);
            successCount++;
        } else {
            console.log(`❌ ${account.id}: 失敗`);
            failCount++;
        }

        // API制限を避けるため待機
        if (index < accountsToAdd.length - 1) {
            Utilities.sleep(2000);
        }
    });

    console.log('\n📊 === 一括セットアップ結果 ===');
    console.log(`✅ 成功: ${successCount} アカウント`);
    console.log(`❌ 失敗: ${failCount} アカウント`);
    console.log(
        `📈 成功率: ${successCount + failCount > 0 ? Math.round((successCount / (successCount + failCount)) * 100) : 0}%`
    );
}

// ==============================================
// 外部関数の型定義（他ファイルからの依存関数）
// ==============================================

declare function getActiveAccounts(): Account[];
declare function getContentForPosting(): any;
declare function executeMainPostWithCloudinary(account: Account, content: any): any;