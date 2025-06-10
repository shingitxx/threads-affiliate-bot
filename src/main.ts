/**
 * 【完成版】Threads自動アフィリエイトシステム - メイン処理.gs
 * 制限削除・時間指定維持・完全無制限対応版
 * 
 * 🔧 修正内容（問題点のみ）:
 * 1. getContentForPostingFallback関数: アカウントIDパラメータ追加・フィルタリング実装
 * 2. getContentForPostingIntegrated関数: アカウントID渡し修正
 * 3. executeAllAccountsReliable関数: メイン処理.gsに移植
 * 4. checkScheduledTime関数: 呼び出し優先順位修正
 * 
 * 機能:
 * - 時間指定投稿システム（維持）
 * - 手動投稿完全無制限
 * - アカウント別ランダム投稿・アフィリエイト
 * - Cloudinary画像投稿
 * - 複数アカウント管理
 */

// ==============================================
// CONFIG設定（完全無制限対応）
// ==============================================

/// <reference types="google-apps-script" />
import { CONFIG, getSheet, logError, HTTP_METHODS, formatAffiliateReplyText } from './utils';
import { Account, Content, AffiliateContent, PostResult } from './types';

// 重複しているCONFIG定義を削除（utils.tsから既にインポート済み）
// 重複している型定義も削除（types.tsから既にインポート済み）

// Google Apps Script型定義のインポート
/// <reference types="google-apps-script" />

/**
 * Cloudinary署名生成
 */
function generateCloudinarySignature(params, apiSecret) {
    try {
        const cleanParams = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                cleanParams[key] = params[key];
            }
        });

        const sortedParams = Object.keys(cleanParams)
            .sort()
            .map(key => `${key}=${cleanParams[key]}`)
            .join('&');

        const stringToSign = `${sortedParams}${apiSecret}`;

        const hash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_1,
            stringToSign,
            Utilities.Charset.UTF_8
        );

        return Array.from(hash)
            .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
            .join('');

    } catch (error) {
        console.error('署名生成エラー:', error);
        return null;
    }
}

/**
 * Cloudinaryアップロード
 */
function uploadToCloudinary(imageData) {
    try {
        const base64Data = Utilities.base64Encode(imageData.blob.getBytes());
        const dataUri = `data:${imageData.mimeType};base64,${base64Data}`;
        const timestampString = Math.floor(Date.now() / 1000).toString();

        const paramsToSign = { timestamp: timestampString };
        const signature = generateCloudinarySignature(paramsToSign, CONFIG.CLOUDINARY.API_SECRET);

        if (!signature) {
            return { success: false, error: '署名生成に失敗しました' };
        }

        const uploadUrl = `${CONFIG.CLOUDINARY.BASE_URL}/${CONFIG.CLOUDINARY.CLOUD_NAME}/image/upload`;

        const response = UrlFetchApp.fetch(uploadUrl, {
            method: HTTP_METHODS.POST,
            payload: {
                file: dataUri,
                api_key: CONFIG.CLOUDINARY.API_KEY,
                timestamp: timestampString,
                signature: signature
            }
        });

        if (response.getResponseCode() === 200) {
            const result = JSON.parse(response.getContentText());
            return {
                success: true,
                imageUrl: result.secure_url,
                publicId: result.public_id,
                cloudinaryResponse: result
            };
        } else {
            return {
                success: false,
                error: `HTTP ${response.getResponseCode()}: ${response.getContentText()}`
            };
        }

    } catch (error) {
        console.error('Cloudinaryアップロードエラー:', error);
        return { success: false, error: (error as Error).toString() };
    }
}

/**
 * Googleドライブから画像取得
 */
function getImageFromDriveByContentId(contentId) {
    try {
        const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
        if (!folders.hasNext()) {
            return null;
        }

        const folder = folders.next();

        for (const ext of CONFIG.IMAGE_EXTENSIONS) {
            const filename = `${contentId}_image.${ext}`;
            const files = folder.getFilesByName(filename);

            if (files.hasNext()) {
                const file = files.next();
                const mimeType = file.getBlob().getContentType();

                if (!CONFIG.SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
                    continue;
                }

                const sizeInMB = file.getSize() / (1024 * 1024);
                if (sizeInMB > CONFIG.MAX_IMAGE_SIZE_MB) {
                    continue;
                }

                return {
                    file: file,
                    blob: file.getBlob(),
                    mimeType: mimeType,
                    size: sizeInMB,
                    name: filename,
                    contentId: contentId
                };
            }
        }

        return null;

    } catch (error) {
        console.error('画像取得エラー:', error);
        return null;
    }
}

/**
 * コンテンツIDから画像をCloudinaryにアップロード
 */
function getCloudinaryImageUrl(contentId) {
    try {
        if (!contentId) return null;

        const imageData = getImageFromDriveByContentId(contentId);
        if (!imageData) {
            return null;
        }

        const cloudinaryResult = uploadToCloudinary(imageData);
        if (!cloudinaryResult.success) {
            return null;
        }

        return {
            success: true,
            imageUrl: cloudinaryResult.imageUrl,
            publicId: cloudinaryResult.publicId,
            originalFile: imageData.name,
            contentId: contentId
        };

    } catch (error) {
        console.error('Cloudinary画像処理エラー:', error);
        return null;
    }
}

// ==============================================
// テキストフォーマット機能（変更なし）
// ==============================================

/**
 * メイン投稿テキストフォーマット
 */
function formatMainPostText(content) {
    return content.mainText;
}

/**
 * メイン投稿実行（画像対応・制限なし）
 */
function executeMainPostWithCloudinary(account, content) {
    try {
        const postText = formatMainPostText(content);

        if (content.useImage !== 'YES' && content.useImage !== true) {
            return executeTextOnlyPost(account, content, postText);
        }

        const cloudinaryResult = getCloudinaryImageUrl(content.id);
        if (!cloudinaryResult || !cloudinaryResult.success) {
            return executeTextOnlyPost(account, content, postText);
        }

        const result = executeImagePostToThreads(account, content, postText, cloudinaryResult.imageUrl);

        if (result.success) {
            result.cloudinaryInfo = cloudinaryResult;
        }

        return result;

    } catch (error) {
        console.error('Cloudinary対応投稿エラー:', error);
        return executeTextOnlyPost(account, content, formatMainPostText(content));
    }
}

/**
 * Threads画像投稿実行（制限削除済み）
 */
function executeImagePostToThreads(account, content, postText, imageUrl) {
    try {
        const response = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/${account.userId}/threads`,
            {
                method: HTTP_METHODS.POST,
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({
                    text: postText,
                    image_url: imageUrl,
                    media_type: 'IMAGE'
                })
            }
        );

        if (response.getResponseCode() === 200) {
            const result = JSON.parse(response.getContentText());

            Utilities.sleep(3000);
            const publishResult = publishPost(account, result.id);

            if (publishResult.success) {
                // 制限削除：updateAccountLastPost と incrementContentUsage は記録用のみ
                updateAccountLastPostUnlimited(account.id);
                incrementContentUsageUnlimited(content.id);

                return {
                    success: true,
                    postId: publishResult.postId,
                    creationId: result.id,
                    hasImage: true,
                    imageUrl: imageUrl,
                    contentId: content.id
                };
            } else {
                return { success: false, error: `公開失敗: ${publishResult.error}` };
            }
        } else {
            return {
                success: false,
                error: `投稿作成失敗: HTTP ${response.getResponseCode()}: ${response.getContentText()}`
            };
        }

    } catch (error) {
        return { success: false, error: (error as Error).toString() };
    }
}

/**
 * テキストのみ投稿実行（制限削除済み）
 */
function executeTextOnlyPost(account, content, postText) {
    try {
        const response = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/${account.userId}/threads`,
            {
                method: HTTP_METHODS.POST,
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({
                    text: postText,
                    media_type: 'TEXT'
                })
            }
        );

        if (response.getResponseCode() === 200) {
            const result = JSON.parse(response.getContentText());

            Utilities.sleep(2000);
            const publishResult = publishPost(account, result.id);

            if (publishResult.success) {
                // 制限削除：記録用のみ
                updateAccountLastPostUnlimited(account.id);
                incrementContentUsageUnlimited(content.id);

                return {
                    success: true,
                    postId: publishResult.postId,
                    creationId: result.id,
                    hasImage: false,
                    contentId: content.id
                };
            }
        }

        return {
            success: false,
            error: `HTTP ${response.getResponseCode()}: ${response.getContentText()}`
        };

    } catch (error) {
        return { success: false, error: (error as Error).toString() };
    }
}

/**
 * 投稿公開
 */
function publishPost(account, creationId) {
    try {
        const publishResponse = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/${account.userId}/threads_publish`,
            {
                method: HTTP_METHODS.POST,
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({ creation_id: creationId })
            }
        );

        if (publishResponse.getResponseCode() === 200) {
            const result = JSON.parse(publishResponse.getContentText());
            return { success: true, postId: result.id };
        }

        return {
            success: false,
            error: `公開失敗: ${publishResponse.getResponseCode()}`
        };

    } catch (error) {
        return { success: false, error: (error as Error).toString() };
    }
}

// ==============================================
// データ取得・管理機能（制限削除済み）
// ==============================================

/**
 * アクティブなアカウント取得
 */
function getActiveAccounts() {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.ACCOUNTS);

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

    return data.filter(row => row[6] === 'アクティブ').map(row => ({
        id: row[0],
        username: row[1],
        accessToken: PropertiesService.getScriptProperties().getProperty(`TOKEN_${row[0]}`),
        userId: row[3],
        lastPostTime: row[4],
        dailyPostCount: row[5],
        status: row[6]
    })).filter(account => account.accessToken);
}

/**
 * 【完全無制限版】投稿用アカウント選択
 */
function selectAccountForPosting(accounts) {
    // 制限削除：時間制限チェックを完全に削除
    if (accounts.length === 0) return null;

    console.log('🚀 制限なしでアカウント選択中...');

    // ランダム選択（制限なし）
    const selectedAccount = accounts[Math.floor(Math.random() * accounts.length)];
    console.log(`✅ 選択: ${selectedAccount.username} (制限なし)`);

    return selectedAccount;
}

/**
 * 今日の投稿数取得（参考用のみ）
 */
function getTodayPostCount() {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.LOGS);

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return 0;

    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    return data.filter(row => {
        const logDate = Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        return logDate === today;
    }).length;
}

/**
 * IDでアカウント取得
 */
function getAccountById(accountId) {
    try {
        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.ACCOUNTS);

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return null;

        const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

        const accountRow = data.find(row => row[0] === accountId);
        if (!accountRow) return null;

        return {
            id: accountRow[0],
            username: accountRow[1],
            accessToken: PropertiesService.getScriptProperties().getProperty(`TOKEN_${accountRow[0]}`),
            userId: accountRow[3],
            lastPostTime: accountRow[4],
            dailyPostCount: accountRow[5],
            status: accountRow[6]
        };
    } catch (error) {
        console.error('アカウント取得エラー:', error);
        return null;
    }
}

// ==============================================
// アカウント別ランダムコンテンツ選択機能（変更なし）
// ==============================================

/**
 * アカウント別ランダムコンテンツ取得
 */
function getRandomContentForAccount(accountId) {
    try {
        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`🎲 [DEBUG] ${accountId} 用ランダムコンテンツ取得開始`);
        }

        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.CONTENT);

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) {
            console.log(`❌ コンテンツシートが空です`);
            return null;
        }

        const lastCol = sheet.getLastColumn();
        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        const accountContent = data.filter(row => {
            const contentAccountId = row[0];
            const contentId = row[1];
            const mainText = row[2];

            return contentAccountId === accountId && mainText && mainText.trim() !== '';
        });

        if (accountContent.length === 0) {
            console.log(`❌ ${accountId} 用のコンテンツがありません`);

            if (CONFIG.RANDOM_CONTENT.ENABLE_SHARED_CONTENT) {
                console.log(`🔄 ${accountId}: 共通コンテンツを検索中...`);
                return getSharedContentForAccount(accountId, data);
            }

            return null;
        }

        console.log(`📝 ${accountId} 用コンテンツ数: ${accountContent.length}件`);

        const selectedRow = selectRandomContentWithAvoidance(accountId, accountContent);

        if (!selectedRow) {
            console.log(`❌ ${accountId}: 選択可能なコンテンツがありません`);
            return null;
        }

        const content = {
            id: selectedRow[1],
            accountId: selectedRow[0],
            mainText: selectedRow[2],
            usedCount: selectedRow[3] || 0,
            useImage: selectedRow[4] || 'NO'
        };

        recordContentSelection(accountId, content.id);

        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`🎯 [DEBUG] ${accountId} 選択: ${content.id} - ${content.mainText.substring(0, 30)}...`);
        }

        return content;

    } catch (error) {
        console.error(`❌ ${accountId} ランダムコンテンツ取得エラー:`, error);
        return null;
    }
}

/**
 * 重複回避を考慮したランダム選択
 */
function selectRandomContentWithAvoidance(accountId, contentArray) {
    try {
        if (!CONFIG.RANDOM_CONTENT.AVOID_RECENT_CONTENT) {
            const randomIndex = Math.floor(Math.random() * contentArray.length);
            return contentArray[randomIndex];
        }

        const recentContent = getRecentContentSelections(accountId);

        const availableContent = contentArray.filter(row => {
            const contentId = row[1];
            return !recentContent.includes(contentId);
        });

        if (availableContent.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableContent.length);
            return availableContent[randomIndex];
        }

        console.log(`⚠️ ${accountId}: 最近使用したコンテンツのみのため、全体から選択`);
        const randomIndex = Math.floor(Math.random() * contentArray.length);
        return contentArray[randomIndex];

    } catch (error) {
        console.error('❌ ランダム選択エラー:', error);
        const randomIndex = Math.floor(Math.random() * contentArray.length);
        return contentArray[randomIndex];
    }
}

/**
 * 共通コンテンツ取得（フォールバック用）
 */
function getSharedContentForAccount(accountId, allData) {
    try {
        const contentGroups = {};

        allData.forEach(row => {
            const contentId = row[1];
            const rowAccountId = row[0];

            if (!contentGroups[contentId]) {
                contentGroups[contentId] = [];
            }
            contentGroups[contentId].push(row);
        });

        const sharedContent = [];
        Object.keys(contentGroups).forEach(contentId => {
            if (contentGroups[contentId].length > 1) {
                const firstRow = contentGroups[contentId][0];
                sharedContent.push(firstRow);
            }
        });

        if (sharedContent.length === 0) {
            console.log(`❌ ${accountId}: 共通コンテンツも見つかりません`);
            return null;
        }

        console.log(`🔄 ${accountId}: 共通コンテンツ ${sharedContent.length}件から選択`);

        const selectedRow = selectRandomContentWithAvoidance(accountId, sharedContent);

        return {
            id: selectedRow[1],
            accountId: accountId,
            mainText: selectedRow[2],
            usedCount: selectedRow[3] || 0,
            useImage: selectedRow[4] || 'NO',
            isSharedContent: true
        };

    } catch (error) {
        console.error('❌ 共通コンテンツ取得エラー:', error);
        return null;
    }
}

// ==============================================
// コンテンツ選択履歴管理（変更なし）
// ==============================================

/**
 * コンテンツ選択履歴記録
 */
function recordContentSelection(accountId, contentId) {
    try {
        const properties = PropertiesService.getScriptProperties();
        const historyKey = `CONTENT_HISTORY_${accountId}`;

        const existingHistory = properties.getProperty(historyKey);
        let history = existingHistory ? JSON.parse(existingHistory) : [];

        history.unshift({
            contentId: contentId,
            timestamp: new Date().getTime()
        });

        if (history.length > CONFIG.RANDOM_CONTENT.RECENT_CONTENT_LIMIT) {
            history = history.slice(0, CONFIG.RANDOM_CONTENT.RECENT_CONTENT_LIMIT);
        }

        properties.setProperty(historyKey, JSON.stringify(history));

        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`📝 [DEBUG] ${accountId} 選択履歴記録: ${contentId}`);
        }

    } catch (error) {
        console.error('❌ 選択履歴記録エラー:', error);
    }
}

/**
 * 最近使用したコンテンツ取得
 */
function getRecentContentSelections(accountId) {
    try {
        const properties = PropertiesService.getScriptProperties();
        const historyKey = `CONTENT_HISTORY_${accountId}`;

        const existingHistory = properties.getProperty(historyKey);
        if (!existingHistory) {
            return [];
        }

        const history = JSON.parse(existingHistory);
        return history.map(item => item.contentId);

    } catch (error) {
        console.error('❌ 最近使用コンテンツ取得エラー:', error);
        return [];
    }
}

/**
 * 選択履歴リセット
 */
function clearContentSelectionHistory(accountId = null) {
    try {
        const properties = PropertiesService.getScriptProperties();

        if (accountId) {
            const historyKey = `CONTENT_HISTORY_${accountId}`;
            properties.deleteProperty(historyKey);
            console.log(`✅ ${accountId} の選択履歴をクリアしました`);
        } else {
            const allProperties = properties.getProperties();
            let clearedCount = 0;

            Object.keys(allProperties).forEach(key => {
                if (key.startsWith('CONTENT_HISTORY_')) {
                    properties.deleteProperty(key);
                    clearedCount++;
                }
            });

            console.log(`✅ 全アカウントの選択履歴をクリアしました (${clearedCount}件)`);
        }

    } catch (error) {
        console.error('❌ 選択履歴クリアエラー:', error);
    }
}

// ==============================================
// アカウント別ランダムアフィリエイト選択機能（変更なし）
// ==============================================

/**
 * アカウント別ランダムアフィリエイト取得
 */
function getRandomAffiliateForAccount(contentId, accountId) {
    try {
        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`🎲 [DEBUG] ${accountId} 用アフィリエイト取得: ${contentId}`);
        }

        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.AFFILIATE);

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) {
            console.log(`❌ アフィリエイトシートが空です`);
            return getDefaultAffiliateContent();
        }

        const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

        const contentMatchedAffiliates = data.filter(row => {
            const affiliateContentId = row[2];
            return affiliateContentId === contentId;
        });

        if (contentMatchedAffiliates.length === 0) {
            console.log(`❌ ${contentId} に対応するアフィリエイトがありません`);
            return getDefaultAffiliateContent();
        }

        const accountSpecificAffiliates = contentMatchedAffiliates.filter(row => {
            const affiliateAccountId = row[1];
            return affiliateAccountId === accountId;
        });

        if (accountSpecificAffiliates.length === 0) {
            console.log(`❌ ${accountId} 用の ${contentId} アフィリエイトがありません`);

            if (CONFIG.RANDOM_CONTENT.ENABLE_SHARED_CONTENT) {
                console.log(`🔄 ${accountId}: 共通アフィリエイトを検索中...`);
                return getSharedAffiliateForContent(contentId, contentMatchedAffiliates, accountId);
            }

            return getDefaultAffiliateContent();
        }

        console.log(`📝 ${accountId} 用 ${contentId} アフィリエイト数: ${accountSpecificAffiliates.length}件`);

        const selectedRow = selectRandomAffiliateWithAvoidance(accountId, contentId, accountSpecificAffiliates);

        if (!selectedRow) {
            console.log(`❌ ${accountId}: 選択可能なアフィリエイトがありません`);
            return getDefaultAffiliateContent();
        }

        const affiliate = {
            id: selectedRow[0],
            accountId: selectedRow[1],
            contentId: selectedRow[2],
            appName: '',
            description: selectedRow[3],
            affiliateUrl: selectedRow[4],
            callToAction: ''
        };

        recordAffiliateSelection(accountId, contentId, affiliate.id);

        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`🎯 [DEBUG] ${accountId} 選択アフィリエイト: ${affiliate.id}`);
        }

        return affiliate;

    } catch (error) {
        console.error(`❌ ${accountId} ランダムアフィリエイト取得エラー:`, error);
        return getDefaultAffiliateContent();
    }
}

/**
 * 重複回避を考慮したアフィリエイトランダム選択
 */
function selectRandomAffiliateWithAvoidance(accountId, contentId, affiliateArray) {
    try {
        if (!CONFIG.RANDOM_CONTENT.AVOID_RECENT_CONTENT) {
            const randomIndex = Math.floor(Math.random() * affiliateArray.length);
            return affiliateArray[randomIndex];
        }

        const recentAffiliates = getRecentAffiliateSelections(accountId, contentId);

        const availableAffiliates = affiliateArray.filter(row => {
            const affiliateId = row[0];
            return !recentAffiliates.includes(affiliateId);
        });

        if (availableAffiliates.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableAffiliates.length);
            return availableAffiliates[randomIndex];
        }

        console.log(`⚠️ ${accountId}(${contentId}): 最近使用したアフィリエイトのみのため、全体から選択`);
        const randomIndex = Math.floor(Math.random() * affiliateArray.length);
        return affiliateArray[randomIndex];

    } catch (error) {
        console.error('❌ アフィリエイトランダム選択エラー:', error);
        const randomIndex = Math.floor(Math.random() * affiliateArray.length);
        return affiliateArray[randomIndex];
    }
}

/**
 * 共通アフィリエイト取得（フォールバック用）
 */
function getSharedAffiliateForContent(contentId, contentMatchedAffiliates, accountId) {
    try {
        const affiliateGroups = {};

        contentMatchedAffiliates.forEach(row => {
            const affiliateId = row[0];
            const rowAccountId = row[1];

            if (!affiliateGroups[affiliateId]) {
                affiliateGroups[affiliateId] = [];
            }
            affiliateGroups[affiliateId].push(row);
        });

        const sharedAffiliates = [];
        Object.keys(affiliateGroups).forEach(affiliateId => {
            if (affiliateGroups[affiliateId].length > 1) {
                const firstRow = affiliateGroups[affiliateId][0];
                sharedAffiliates.push(firstRow);
            }
        });

        if (sharedAffiliates.length === 0) {
            console.log(`❌ ${accountId}(${contentId}): 共通アフィリエイトも見つかりません`);
            return getDefaultAffiliateContent();
        }

        console.log(`🔄 ${accountId}(${contentId}): 共通アフィリエイト ${sharedAffiliates.length}件から選択`);

        const selectedRow = selectRandomAffiliateWithAvoidance(accountId, contentId, sharedAffiliates);

        return {
            id: selectedRow[0],
            accountId: accountId,
            contentId: selectedRow[2],
            appName: '',
            description: selectedRow[3],
            affiliateUrl: selectedRow[4],
            callToAction: '',
            isSharedAffiliate: true
        };

    } catch (error) {
        console.error('❌ 共通アフィリエイト取得エラー:', error);
        return getDefaultAffiliateContent();
    }
}

// ==============================================
// アフィリエイト選択履歴管理（変更なし）
// ==============================================

/**
 * アフィリエイト選択履歴記録
 */
function recordAffiliateSelection(accountId: string, contentId: string, affiliateId: string): void {
    try {
        const properties = PropertiesService.getScriptProperties();
        const historyKey = `AFFILIATE_HISTORY_${accountId}_${contentId}`;

        const existingHistory = properties.getProperty(historyKey);
        let history = existingHistory ? JSON.parse(existingHistory) : [];

        history.unshift({
            affiliateId: affiliateId,
            timestamp: new Date().getTime()
        });

        if (history.length > CONFIG.RANDOM_CONTENT.RECENT_CONTENT_LIMIT) {
            history = history.slice(0, CONFIG.RANDOM_CONTENT.RECENT_CONTENT_LIMIT);
        }

        properties.setProperty(historyKey, JSON.stringify(history));

        if (CONFIG.RANDOM_CONTENT.DEBUG_MODE) {
            console.log(`📝 [DEBUG] ${accountId}(${contentId}) アフィリエイト選択履歴記録: ${affiliateId}`);
        }

    } catch (error) {
        console.error('❌ アフィリエイト選択履歴記録エラー:', error);
    }
}

/**
 * 最近使用したアフィリエイト取得
 */
function getRecentAffiliateSelections(accountId: string, contentId: string): string[] {
    try {
        const properties = PropertiesService.getScriptProperties();
        const historyKey = `AFFILIATE_HISTORY_${accountId}_${contentId}`;

        const existingHistory = properties.getProperty(historyKey);
        if (!existingHistory) {
            return [];
        }

        const history = JSON.parse(existingHistory);
        return history.map(item => item.affiliateId);

    } catch (error) {
        console.error('❌ 最近使用アフィリエイト取得エラー:', error);
        return [];
    }
}

/**
 * アフィリエイト選択履歴リセット
 */
function clearAffiliateSelectionHistory(accountId = null, contentId = null) {
    try {
        const properties = PropertiesService.getScriptProperties();

        if (accountId && contentId) {
            const historyKey = `AFFILIATE_HISTORY_${accountId}_${contentId}`;
            properties.deleteProperty(historyKey);
            console.log(`✅ ${accountId}(${contentId}) のアフィリエイト選択履歴をクリアしました`);
        } else if (accountId) {
            const allProperties = properties.getProperties();
            let clearedCount = 0;

            Object.keys(allProperties).forEach(key => {
                if (key.startsWith(`AFFILIATE_HISTORY_${accountId}_`)) {
                    properties.deleteProperty(key);
                    clearedCount++;
                }
            });

            console.log(`✅ ${accountId} の全アフィリエイト選択履歴をクリアしました (${clearedCount}件)`);
        } else {
            const allProperties = properties.getProperties();
            let clearedCount = 0;

            Object.keys(allProperties).forEach(key => {
                if (key.startsWith('AFFILIATE_HISTORY_')) {
                    properties.deleteProperty(key);
                    clearedCount++;
                }
            });

            console.log(`✅ 全アフィリエイト選択履歴をクリアしました (${clearedCount}件)`);
        }

    } catch (error) {
        console.error('❌ アフィリエイト選択履歴クリアエラー:', error);
    }
}

// ==============================================
// 統合済みコンテンツ・アフィリエイト取得（🔧 修正済み）
// ==============================================

/**
 * 統合版コンテンツ取得（アカウント別ランダム対応）
 */
function getContentForPostingIntegrated(accountId = null) {
    try {
        if (CONFIG.RANDOM_CONTENT && CONFIG.RANDOM_CONTENT.ENABLE_RANDOM_SELECTION && accountId) {
            return getRandomContentForAccount(accountId);
        } else {
            // 🔧 修正: アカウントIDを渡す
            return getContentForPostingFallback(accountId);
        }

    } catch (error) {
        console.error('❌ 統合コンテンツ取得エラー:', error);
        // 🔧 修正: アカウントIDを渡す
        return getContentForPostingFallback(accountId);
    }
}

/**
 * 🔧 修正版：フォールバック用コンテンツ取得（アカウントIDフィルタリング対応）
 */
function getContentForPostingFallback(accountId = null) {
    try {
        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.CONTENT);

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) {
            return null;
        }

        const lastCol = sheet.getLastColumn();
        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        // 🔧 修正: 全コンテンツをマッピング
        let availableContent = data.map(row => {
            return {
                accountId: row[0],
                id: row[1],
                mainText: row[2],
                usedCount: row[3] || 0,
                useImage: row[4] || 'NO'
            };
        });

        // 🔧 追加: アカウント指定時のフィルタリング
        if (accountId) {
            const accountSpecific = availableContent.filter(content =>
                content.accountId === accountId
            );

            if (accountSpecific.length > 0) {
                availableContent = accountSpecific;
                console.log(`📝 ${accountId} 専用コンテンツ: ${accountSpecific.length}件`);
            } else {
                console.log(`⚠️ ${accountId} 専用コンテンツなし、全体から選択: ${availableContent.length}件`);
            }
        }

        if (availableContent.length === 0) {
            return null;
        }

        const selectedContent = availableContent[Math.floor(Math.random() * availableContent.length)];
        console.log(`🎯 選択: ${selectedContent.id} (${selectedContent.accountId}) - ${selectedContent.mainText.substring(0, 30)}...`);

        return selectedContent;

    } catch (error) {
        console.error('フォールバックコンテンツ取得エラー:', error);
        return null;
    }
}

/**
 * 統合版アフィリエイト取得（アカウント別ランダム対応）
 */
function getAffiliateContentIntegrated(contentId, accountId = null) {
    try {
        if (CONFIG.RANDOM_CONTENT && CONFIG.RANDOM_CONTENT.ENABLE_RANDOM_SELECTION && accountId) {
            return getRandomAffiliateForAccount(contentId, accountId);
        } else {
            return getAffiliateContent(contentId);
        }

    } catch (error) {
        console.error('❌ 統合アフィリエイト取得エラー:', error);
        return getAffiliateContent(contentId);
    }
}

// ==============================================
// 既存アフィリエイト機能（後方互換性・変更なし）
// ==============================================

/**
 * アフィリエイトコンテンツ取得
 */
function getAffiliateContent(contentId) {
    try {
        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.AFFILIATE);

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return getDefaultAffiliateContent();

        const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

        const affiliateRow = data.find(row => row[2] === contentId);
        if (!affiliateRow) {
            return getDefaultAffiliateContent();
        }

        return {
            id: affiliateRow[0],
            contentId: affiliateRow[2],
            appName: '',
            description: affiliateRow[3],
            affiliateUrl: affiliateRow[4],
            callToAction: ''
        };
    } catch (error) {
        console.error('アフィリエイトコンテンツ取得エラー:', error);
        return getDefaultAffiliateContent();
    }
}

/**
 * デフォルトアフィリエイトコンテンツ
 */
function getDefaultAffiliateContent() {
    return {
        id: 'DEFAULT_001',
        contentId: '',
        appName: 'おすすめアプリ',
        description: '実際に使って便利だったアプリです',
        affiliateUrl: 'https://example.com/affiliate/default',
        callToAction: 'チェックしてみて！'
    };
}

// ==============================================
// リプライ投稿機能（制限削除済み）
// ==============================================

/**
 * リプライ投稿をスケジュール（制限削除済み）
 */
function scheduleReplyPost(account, content, parentPostId) {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName(CONFIG.SHEET_NAMES.SCHEDULE);

    const executeTime = new Date(Date.now() + (CONFIG.REPLY_DELAY_MINUTES * 60 * 1000));

    sheet.appendRow([
        new Date(),
        account.id,
        content.id,
        parentPostId,
        executeTime,
        '待機中',
        ''
    ]);

    ScriptApp.newTrigger('executeReplyPost')
        .timeBased()
        .at(executeTime)
        .create();
}

/**
 * シンプルリプライ実行（制限削除済み）
 */
function executeThreadReplySimple(account, affiliateContent, parentPostId) {
    try {
        if (!account || !affiliateContent || !parentPostId) {
            return { success: false, error: '必要なパラメータが不足しています' };
        }

        const replyText = formatAffiliateReplyText(affiliateContent);

        const createResponse = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/${account.userId}/threads`,
            {
                method: HTTP_METHODS.POST,
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({
                    text: replyText,
                    media_type: 'TEXT',
                    reply_to_id: parentPostId
                }),
                muteHttpExceptions: true
            }
        );

        const createCode = createResponse.getResponseCode();
        if (createCode !== 200) {
            return {
                success: false,
                error: `リプライ作成失敗: ${createCode} - ${createResponse.getContentText()}`
            };
        }

        const createResult = JSON.parse(createResponse.getContentText());
        Utilities.sleep(2000);

        const publishResponse = UrlFetchApp.fetch(
            `${CONFIG.THREADS_API_BASE}/${account.userId}/threads_publish`,
            {
                method: HTTP_METHODS.POST,
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json'
                },
                payload: JSON.stringify({ creation_id: createResult.id }),
                muteHttpExceptions: true
            }
        );

        const publishCode = publishResponse.getResponseCode();
        if (publishCode === 200) {
            const publishResult = JSON.parse(publishResponse.getContentText());
            return {
                success: true,
                postId: publishResult.id,
                creationId: createResult.id
            };
        } else {
            return {
                success: false,
                error: `リプライ公開失敗: ${publishCode} - ${publishResponse.getContentText()}`
            };
        }

    } catch (error) {
        console.error('シンプルリプライエラー:', error);
        return { success: false, error: (error as Error).toString() };
    }
}
/**
 * スケジュールリプライ実行（制限削除済み）
 */
function executeReplyPost() {
        try {
            console.log('🔄 === スケジュールリプライ実行（制限なし） ===');

            const pendingReplies = getPendingReplies();

            if (pendingReplies.length === 0) {
                console.log('⏰ 実行待ちのリプライがありません');
                return;
            }

            console.log(`📋 実行対象リプライ数: ${pendingReplies.length}`);

            for (const reply of pendingReplies) {
                console.log(`🔄 リプライ実行中: ${reply.accountId} -> ${reply.parentPostId}`);

                const account = getAccountById(reply.accountId);
                const affiliateContent = getAffiliateContentIntegrated(reply.contentId, reply.accountId);

                const replyResult = executeThreadReplySimple(account, affiliateContent, reply.parentPostId);

                if (replyResult.success) {
                    console.log(`✅ リプライ投稿成功: ${replyResult.postId}`);
                    markReplyAsCompleted(reply.id);
                    logPostActivity(account, affiliateContent, replyResult, 'reply_scheduled_unlimited');
                } else {
                    console.error(`❌ リプライ投稿失敗: ${replyResult.error}`);
                    logError('ランダムリプライ投稿失敗', account.username, replyResult.error);
                }
            }

            console.log('🎉 === スケジュールリプライ完了（制限なし） ===');

        } catch (error) {
            console.error('❌ リプライ処理エラー:', error);
            logError('リプライシステムエラー', 'system', (error as Error).toString());
        }
    }


    // ==============================================
    // 🔧 修正版：確実な全アカウント投稿関数（メイン処理.gsに移植）
    // ==============================================

    /**
     * 🔧 修正版：確実な全アカウント順次投稿（時間指定投稿用）
     */
    function executeAllAccountsReliable() {
        console.log('🚀 === 修正版全アカウント投稿開始 ===');

        const startTime = new Date();
        console.log(`⏰ 開始時刻: ${startTime.toLocaleTimeString()}`);

        let results = [];
        let totalSuccess = 0;
        let totalFailure = 0;

        try {
            // アカウント取得
            const accounts = getActiveAccounts();
            console.log(`👥 対象アカウント数: ${accounts.length}`);

            if (!accounts || accounts.length === 0) {
                console.log('❌ アクティブなアカウントがありません');
                return {
                    success: false,
                    error: 'アクティブなアカウントなし',
                    results: []
                };
            }

            // 各アカウントの詳細ログ
            accounts.forEach((account, index) => {
                console.log(`👤 [${index + 1}] ${account.username} (${account.id})`);
                console.log(`  🔑 トークン: ${account.accessToken ? '設定済み' : '未設定'}`);
                console.log(`  📱 ユーザーID: ${account.userId}`);
            });

            console.log('\n🚀 === 順次投稿実行開始 ===');

            // 各アカウントを順次処理
            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                const accountStartTime = new Date();

                console.log(`\n🔄 [${i + 1}/${accounts.length}] ${account.username} 投稿開始`);
                console.log(`⏰ アカウント処理開始時刻: ${accountStartTime.toLocaleTimeString()}`);

                try {
                    // ステップ1: コンテンツ取得
                    console.log(`📝 ${account.username}: コンテンツ取得中...`);
                    // 🔧 修正: 確実にアカウントIDを渡す
                    const content = getContentForPostingIntegrated(account.id);

                    if (!content) {
                        console.log(`❌ ${account.username}: コンテンツ取得失敗`);
                        results.push({
                            account: account.username,
                            success: false,
                            error: 'コンテンツ取得失敗',
                            step: 'content_acquisition'
                        });
                        totalFailure++;
                        continue; // 次のアカウントへ
                    }

                    console.log(`✅ ${account.username}: コンテンツ取得成功 - ${content.id}`);
                    console.log(`  📝 内容: ${content.mainText.substring(0, 30)}...`);

                    // ステップ2: メイン投稿実行
                    console.log(`🚀 ${account.username}: メイン投稿実行中...`);
                    const mainPostStartTime = new Date();

                    const mainPostResult = executeMainPostWithCloudinary(account, content);

                    const mainPostEndTime = new Date();
                    const mainPostDuration = mainPostEndTime.getTime() - mainPostStartTime.getTime();
                    console.log(`⏱️ ${account.username}: メイン投稿処理時間 ${mainPostDuration}ms`);

                    if (!mainPostResult.success) {
                        console.log(`❌ ${account.username}: メイン投稿失敗 - ${mainPostResult.error}`);
                        results.push({
                            account: account.username,
                            success: false,
                            error: mainPostResult.error,
                            step: 'main_post',
                            duration: mainPostDuration
                        });
                        totalFailure++;
                        continue; // 次のアカウントへ
                    }

                    console.log(`✅ ${account.username}: メイン投稿成功 - ${mainPostResult.postId}`);

                    // ステップ3: リプライ準備（5秒待機）
                    console.log(`⏸️ ${account.username}: リプライ準備中（5秒待機）...`);
                    Utilities.sleep(5000);

                    // ステップ4: アフィリエイト取得
                    console.log(`🔗 ${account.username}: アフィリエイト取得中...`);
                    const affiliateContent = getAffiliateContentIntegrated(content.id, account.id);

                    let replyResult = null;
                    if (affiliateContent) {
                        console.log(`✅ ${account.username}: アフィリエイト取得成功 - ${affiliateContent.id}`);

                        // ステップ5: リプライ投稿実行
                        console.log(`💬 ${account.username}: リプライ投稿実行中...`);
                        const replyStartTime = new Date();

                        replyResult = executeThreadReplySimple(account, affiliateContent, mainPostResult.postId);

                        const replyEndTime = new Date();
                        const replyDuration = replyEndTime.getTime() - replyStartTime.getTime();
                        console.log(`⏱️ ${account.username}: リプライ処理時間 ${replyDuration}ms`);

                        if (replyResult.success) {
                            console.log(`✅ ${account.username}: リプライ投稿成功 - ${replyResult.postId}`);
                        } else {
                            console.log(`⚠️ ${account.username}: リプライ投稿失敗 - ${replyResult.error}`);
                        }
                    } else {
                        console.log(`⚠️ ${account.username}: アフィリエイトコンテンツなし`);
                    }

                    // 成功記録
                    results.push({
                        account: account.username,
                        success: true,
                        mainPostId: mainPostResult.postId,
                        replySuccess: replyResult ? replyResult.success : false,
                        replyPostId: replyResult ? replyResult.postId : null,
                        contentId: content.id,
                        affiliateId: affiliateContent ? affiliateContent.id : null,
                        duration: mainPostDuration
                    });
                    totalSuccess++;

                    // ステップ6: 次のアカウントまでの安全間隔
                    if (i < accounts.length - 1) {
                        console.log(`⏸️ 次のアカウントまで30秒待機... (${i + 1}/${accounts.length}完了)`);
                        Utilities.sleep(30000); // 30秒間隔
                    }

                    const accountEndTime = new Date();
                    const accountDuration = accountEndTime.getTime() - accountStartTime.getTime();
                    console.log(`✅ ${account.username}: アカウント処理完了 (${accountDuration}ms)`);

                } catch (accountError) {
                    console.error(`❌ ${account.username}: 例外発生 - ${(accountError as Error).message}`);
                    console.error(`  スタック: ${accountError.stack}`);

                    results.push({
                        account: account.username,
                        success: false,
                        error: accountError.message,
                        step: 'exception',
                        stack: accountError.stack
                    });
                    totalFailure++;

                    // 例外が発生しても次のアカウントは処理を続行
                    console.log(`🔄 ${account.username}: エラーが発生しましたが、次のアカウントを処理します`);
                }
            }

            const endTime = new Date();
            const totalDuration = endTime.getTime() - startTime.getTime();

            console.log('\n🎯 === 全アカウント投稿結果サマリー ===');
            console.log(`⏰ 総処理時間: ${totalDuration}ms (${Math.round(totalDuration / 1000)}秒)`);
            console.log(`✅ 成功: ${totalSuccess}アカウント`);
            console.log(`❌ 失敗: ${totalFailure}アカウント`);
            console.log(`📈 成功率: ${Math.round((totalSuccess / accounts.length) * 100)}%`);

            // 詳細結果表示
            results.forEach((result, index) => {
                console.log(`\n📊 [${index + 1}] ${result.account}:`);
                if (result.success) {
                    console.log(`  ✅ メイン投稿: ${result.mainPostId}`);
                    console.log(`  💬 リプライ: ${result.replySuccess ? result.replyPostId : '失敗/なし'}`);
                    console.log(`  📝 コンテンツ: ${result.contentId}`);
                    console.log(`  🔗 アフィリエイト: ${result.affiliateId || 'なし'}`);
                } else {
                    console.log(`  ❌ エラー: ${result.error}`);
                    console.log(`  🔍 段階: ${result.step}`);
                }
            });

            // ログ記録
            logScheduledExecution(
                new Date().getHours(),
                totalSuccess,
                totalFailure,
                Math.round((totalSuccess / accounts.length) * 100)
            );

            return {
                success: totalSuccess > 0,
                totalSuccess: totalSuccess,
                totalFailure: totalFailure,
                results: results,
                duration: totalDuration
            };

        } catch (error) {
            console.error('❌ 全アカウント投稿システムエラー:', error);
            console.error(`  スタック: ${error.stack}`);

            logError('全アカウント投稿システムエラー', 'system', (error as Error).toString());

            return {
                success: false,
                error: error.message,
                results: results,
                duration: new Date().getTime() - startTime.getTime()
            };
        }
    }

    // ==============================================
    // 【完全無制限版】メイン実行機能
    // ==============================================

    /**
     * 【完全無制限版】単一アカウント投稿（推奨メイン関数）
     */
    function mainWithSimpleReply() {
        try {
            console.log('🚀 === 完全無制限投稿システム ===');
            console.log('✅ 日次制限: 無制限');
            console.log('✅ 投稿間隔: 無制限');
            console.log('✅ アカウント制限: 無制限');

            const accounts = getActiveAccounts();
            if (accounts.length === 0) {
                console.log('❌ アクティブなアカウントがありません');
                return;
            }

            // 制限削除：無制限でアカウント選択
            const selectedAccount = selectAccountForPosting(accounts);
            if (!selectedAccount) {
                console.log('❌ アカウント選択に失敗しました');
                return;
            }

            console.log(`🎯 使用アカウント: ${selectedAccount.username} (${selectedAccount.id})`);

            // 統合版コンテンツ取得
            const content = getContentForPostingIntegrated(selectedAccount.id);
            if (!content) {
                console.log('❌ 投稿するコンテンツがありません');
                return;
            }

            console.log(`📝 選択コンテンツ: ${content.id} - ${content.mainText.substring(0, 30)}...`);

            const mainPostResult = executeMainPostWithCloudinary(selectedAccount, content);
            if (!mainPostResult.success) {
                logError('メイン投稿失敗', selectedAccount.username, mainPostResult.error);
                console.error(`❌ メイン投稿失敗: ${mainPostResult.error}`);
                return;
            }

            console.log(`✅ メイン投稿成功: ${mainPostResult.postId}`);

            Utilities.sleep(5000);

            // 統合版アフィリエイト取得
            const affiliateContent = getAffiliateContentIntegrated(content.id, selectedAccount.id);
            if (affiliateContent) {
                const replyResult = executeThreadReplySimple(selectedAccount, affiliateContent, mainPostResult.postId);

                if (replyResult.success) {
                    console.log(`🎉 リプライ投稿成功: ${replyResult.postId}`);
                    const affiliateType = affiliateContent.isSharedAffiliate ? 'reply_shared_affiliate' : 'reply_account_affiliate';
                    logPostActivity(selectedAccount, affiliateContent, replyResult, affiliateType + '_unlimited');
                } else {
                    console.log(`⚠️ リプライ投稿失敗: ${replyResult.error}`);
                    logError('リプライ投稿失敗', selectedAccount.username, replyResult.error);
                }
            } else {
                console.log('⚠️ アフィリエイトコンテンツが見つかりません');
            }

            const postType = mainPostResult.hasImage ? 'main_with_cloudinary_image_unlimited' : 'main_text_only_unlimited';
            logPostActivity(selectedAccount, content, mainPostResult, postType);

            console.log('🎉 === 完全無制限投稿完了 ===');

        } catch (error) {
            console.error('❌ 無制限投稿エラー:', error);
            logError('無制限投稿システムエラー', 'system', (error as Error).toString());
        }
    }

    // ==============================================
    // 時間指定投稿システム（維持・無制限統合）
    // ==============================================

    /**
     * 時間指定投稿実行（無制限統合版）
     */
    function executeScheduledPostingWithRandomUnlimited() {
        try {
            console.log('🕐 === 時間指定投稿（無制限統合版） ===');

            const currentTime = new Date();
            const currentHour = currentTime.getHours();

            if (!CONFIG.SCHEDULE.ENABLED) {
                console.log('❌ 時間指定投稿システムが無効です');
                return;
            }

            if (!CONFIG.SCHEDULE.POSTING_HOURS.includes(currentHour)) {
                console.log(`⏰ 現在${currentHour}時 - 投稿時間外です`);
                console.log(`📅 投稿時間: ${CONFIG.SCHEDULE.POSTING_HOURS.join(', ')}時`);
                return;
            }

            console.log(`✅ 投稿時間です: ${currentHour}時`);
            console.log('🚀 時間指定投稿も無制限で実行');

            const accounts = getActiveAccounts();
            if (accounts.length === 0) {
                console.log('❌ アクティブなアカウントがありません');
                return;
            }

            console.log(`👥 対象アカウント数: ${accounts.length}`);
            console.log('🎲 ランダム選択: 有効');
            console.log('🚀 制限: なし');
            console.log(`⏱️ アカウント間隔: ${CONFIG.SCHEDULE.ACCOUNT_INTERVAL_SECONDS}秒`);

            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < accounts.length; i++) {
                const account = accounts[i];
                console.log(`\n🔄 [${i + 1}/${accounts.length}] ${account.username} 投稿中...`);

                const content = getContentForPostingIntegrated(account.id);
                if (!content) {
                    console.log(`❌ ${account.username}: コンテンツなし`);
                    failureCount++;
                    continue;
                }

                console.log(`📝 使用コンテンツ: ${content.id} - ${content.mainText.substring(0, 30)}...`);

                const mainPostResult = executeMainPostWithCloudinary(account, content);
                if (mainPostResult.success) {
                    const imageInfo = mainPostResult.hasImage ? ' 🖼️' : ' 📝';
                    console.log(`✅ ${account.username}: 投稿成功 - ${mainPostResult.postId}${imageInfo}`);

                    // 5分後リプライをスケジュール
                    const affiliateContent = getAffiliateContentIntegrated(content.id, account.id);
                    if (affiliateContent) {
                        scheduleReplyPost(account, affiliateContent, mainPostResult.postId);
                        console.log(`⏰ リプライを5分後にスケジュール`);
                    }

                    successCount++;
                    logPostActivity(account, content, mainPostResult, 'scheduled_unlimited');
                } else {
                    console.error(`❌ ${account.username}: 投稿失敗 - ${mainPostResult.error}`);
                    failureCount++;
                    logError('時間指定投稿失敗', account.username, mainPostResult.error);
                }

                // 次のアカウントまで待機
                if (i < accounts.length - 1) {
                    console.log(`⏸️ 次のアカウントまで${CONFIG.SCHEDULE.ACCOUNT_INTERVAL_SECONDS}秒待機...`);
                    Utilities.sleep(CONFIG.SCHEDULE.ACCOUNT_INTERVAL_SECONDS * 1000);
                }
            }

            const successRate = Math.round((successCount / accounts.length) * 100);
            console.log(`\n📊 === [${currentHour}:00] 時間指定投稿結果サマリー（無制限版） ===`);
            console.log(`✅ 成功: ${successCount} アカウント`);
            console.log(`❌ 失敗: ${failureCount} アカウント`);
            console.log(`📈 成功率: ${successRate}%`);
            console.log(`🚀 制限: なし`);

            // 時間指定ログシートに記録
            logScheduledExecution(currentHour, successCount, failureCount, successRate);

        } catch (error) {
            console.error('❌ 時間指定投稿無制限版エラー:', error);
            logError('時間指定投稿無制限システムエラー', 'system', (error as Error).toString());
        }
    }

    /**
     * 時間指定実行ログ記録
     */
    function logScheduledExecution(hour: number, successCount: number, failureCount: number, successRate: number): void {
        try {
            const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                .getSheetByName(CONFIG.SCHEDULE.EXECUTION_LOG_SHEET);

            sheet.appendRow([
                new Date(),
                `${hour}:00`,
                successCount + failureCount,
                successCount,
                failureCount,
                `${successRate}%`,
                '無制限版実行',
                '完了'
            ]);

        } catch (error) {
            console.error('時間指定ログ記録エラー:', error);
        }
    }

    // ==============================================
    // ヘルパー・ユーティリティ関数（制限削除済み）
    // ==============================================

    /**
     * アカウントの最終投稿時間更新（記録用のみ）
     */
    function updateAccountLastPostUnlimited(accountId) {
        try {
            const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                .getSheetByName(CONFIG.SHEET_NAMES.ACCOUNTS);

            const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();

            for (let i = 0; i < data.length; i++) {
                if (data[i][0] === accountId) {
                    // 時間は記録するが制限チェックには使用しない
                    sheet.getRange(i + 2, 5).setValue(new Date());
                    // 投稿数は記録するが制限チェックには使用しない
                    sheet.getRange(i + 2, 6).setValue((data[i][5] || 0) + 1);
                    break;
                }
            }
            console.log(`📝 ${accountId}: 記録更新（制限なし）`);
        } catch (error) {
            console.error('記録更新エラー:', error);
        }
    }

    /**
     * コンテンツ使用回数増加（記録用のみ）
     */
    function incrementContentUsageUnlimited(contentId) {
        try {
            const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                .getSheetByName(CONFIG.SHEET_NAMES.CONTENT);

            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

            for (let i = 0; i < data.length; i++) {
                if (data[i][1] === contentId) {
                    // 使用回数は記録するが制限チェックには使用しない
                    sheet.getRange(i + 2, 4).setValue((data[i][3] || 0) + 1);
                    break;
                }
            }
            console.log(`📝 ${contentId}: 使用回数記録（制限なし）`);
        } catch (error) {
            console.error('使用回数記録エラー:', error);
        }
    }

    /**
     * ログ記録（無制限対応）
     */
    function logPostActivity(account: Account, content: Content, result: PostResult, type: string): void {
        const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
            .getSheetByName(CONFIG.SHEET_NAMES.LOGS);

        let logMessage = '無制限投稿';

        if (result.hasImage && result.cloudinaryInfo) {
            logMessage = `Cloudinary画像付き投稿（無制限） (${result.cloudinaryInfo.originalFile})`;
        }

        const contentTitle = content.title || content.id || '不明';

        sheet.appendRow([
            new Date(),
            account.username,
            contentTitle,
            type,
            result.success ? '成功' : '失敗',
            result.postId || '',
            result.error || logMessage
        ]);
    }

    // ==============================================
    // アクセストークン管理（変更なし）
    // ==============================================

    /**
     * アカウントアクセストークン設定
     */
    function setAccountToken(accountId, accessToken) {
        try {
            PropertiesService.getScriptProperties().setProperty(`TOKEN_${accountId}`, accessToken);
            console.log(`✅ アカウント ${accountId} のトークンを設定しました`);
        } catch (error) {
            console.error('❌ トークン設定エラー:', error);
        }
    }

    /**
     * 🔧 修正版：時間指定投稿チェック関数（関数呼び出し優先順位修正）
     */
    function checkScheduledTime() {
        console.log('🕐 checkScheduledTime 実行開始');
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            console.log(`現在時刻: ${currentHour}:${currentMinute}`);

            // 投稿時間：2,5,8,12,17,20,22,0時の0-5分の間
            const scheduledHours = [2, 5, 8, 12, 17, 20, 22, 0];

            // 現在が投稿時間かチェック（0-5分の間）
            if (scheduledHours.includes(currentHour) && currentMinute >= 0 && currentMinute <= 5) {
                console.log(`✅ 投稿時間です: ${currentHour}時`);

                // 今日の同じ時間に既に実行済みかチェック
                const today = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                const executionKey = `SCHEDULED_${today}_${currentHour}`;
                const properties = PropertiesService.getScriptProperties();
                const alreadyExecuted = properties.getProperty(executionKey);

                if (alreadyExecuted) {
                    console.log(`⏭️ ${currentHour}時の投稿は既に実行済み`);
                    return 'already_executed';
                }

                // 🔧 修正：修正版全アカウント投稿を優先実行
                console.log('🚀 時間指定投稿実行中...');
                let result = null;

                if (typeof executeAllAccountsReliable === 'function') {
                    console.log('executeAllAccountsReliable を使用');
                    result = executeAllAccountsReliable();
                } else if (typeof mainWithSimpleReply === 'function') {
                    console.log('mainWithSimpleReply を使用');
                    result = mainWithSimpleReply();
                } else {
                    console.log('❌ 利用可能な投稿関数がありません');
                    return 'no_function';
                }

                // 実行済みフラグを設定
                properties.setProperty(executionKey, 'executed');
                console.log(`✅ ${currentHour}時の投稿完了 - 実行済みフラグ設定`);

                // 実行ログに記録
                try {
                    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                        .getSheetByName('時間指定ログ');
                    if (sheet) {
                        sheet.appendRow([
                            now,
                            `${currentHour}:00投稿`,
                            '時間指定投稿',
                            '成功',
                            result ? 'OK' : 'エラー'
                        ]);
                        console.log('📝 時間指定ログに記録完了');
                    }
                } catch (logError) {
                    console.log('⚠️ ログ記録エラー:', logError.message);
                }

                return 'executed';
            } else {
                console.log(`⏸️ 投稿時間外: ${currentHour}:${currentMinute}`);
                return 'not_time';
            }
        } catch (error) {
            console.error('❌ checkScheduledTime エラー:', error);

            // エラーログ記録
            try {
                const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                    .getSheetByName('実行ログ');
                if (sheet) {
                    sheet.appendRow([
                        new Date(),
                        '時間指定チェック',
                        'システム',
                        'checkScheduledTime エラー',
                        '失敗',
                        error.message
                    ]);
                }
            } catch (logError) {
                console.log('エラーログ記録失敗:', logError.message);
            }

            return 'error';
        }
    }

    /**
     * 実行済みフラグをリセット（日次リセット用）
     */
    function resetDailyFlags() {
        console.log('🔄 日次フラグリセット実行');

        try {
            const properties = PropertiesService.getScriptProperties();
            const allProperties = properties.getProperties();

            // 古い実行済みフラグを削除（昨日以前のもの）
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');

            Object.keys(allProperties).forEach(key => {
                if (key.startsWith('SCHEDULED_') && key.includes(yesterdayStr)) {
                    properties.deleteProperty(key);
                    console.log(`🗑️ 古いフラグ削除: ${key}`);
                }
            });

            console.log('✅ 日次フラグリセット完了');
        } catch (error) {
            console.error('❌ 日次フラグリセットエラー:', error);
        }
    }

    // ==============================================
    // システム管理・テスト機能（無制限対応）
    // ==============================================

    /**
     * システム状況確認（無制限対応版）
     */
    function checkSystemStatus() {
        try {
            console.log('🔍 === システム状況確認（無制限版） ===');

            const accounts = getActiveAccounts();
            console.log(`👥 アクティブアカウント数: ${accounts.length}`);

            const content = getContentForPostingIntegrated();
            const todayPosts = getTodayPostCount();

            console.log(`📝 投稿可能コンテンツ: ${content ? 'あり' : 'なし'}`);
            console.log(`📊 今日の投稿数: ${todayPosts} (参考値・制限なし)`);

            const pendingReplies = getPendingReplies();
            console.log(`⏰ 待機中リプライ: ${pendingReplies.length}件`);

            console.log('\n⚙️ === 設定値（無制限版） ===');
            console.log(`ランダム選択: ${CONFIG.RANDOM_CONTENT.ENABLE_RANDOM_SELECTION ? '有効' : '無効'}`);
            console.log(`投稿間隔: 無制限`);
            console.log(`リプライ遅延: ${CONFIG.REPLY_DELAY_MINUTES}分`);
            console.log(`日次上限: 無制限`);
            console.log(`時間指定投稿: ${CONFIG.SCHEDULE.ENABLED ? '有効' : '無効'} (${CONFIG.SCHEDULE.POSTING_HOURS.join(', ')}時)`);

            console.log('\n🎯 === システム状態 ===');
            if (accounts.length === 0) {
                console.log('❌ アカウントを設定してください');
            } else if (accounts.length === 1) {
                console.log('💡 2つ目のアカウントを追加推奨');
            } else {
                console.log('✅ システム正常稼働中（完全無制限モード）');
            }

            console.log('\n🚀 === 無制限機能確認 ===');
            console.log('✅ 手動投稿: 無制限');
            console.log('✅ 時間指定投稿: 維持（設定通り）');
            console.log('⚠️ 注意: API制限・アカウント安全性にご注意ください');

        } catch (error) {
            console.error('❌ システム状況確認エラー:', error);
        }
    }

    /**
     * 使用ガイド（無制限版）
     */
    function showUsageGuide() {
        console.log('🎯 === Threads自動投稿システム 完全無制限版使用ガイド ===');
        console.log('');
        console.log('🚀 【システム特徴】:');
        console.log('  ✅ 手動投稿: 完全無制限');
        console.log('  ✅ 時間指定投稿: 維持（設定通り）');
        console.log('  ✅ 投稿制限: 全て削除済み');
        console.log('');
        console.log('📚 【メイン機能】:');
        console.log('  mainWithSimpleReply() - 完全無制限投稿（推奨）');
        console.log('  executeAllAccountsReliable() - 全アカウント無制限順次投稿');
        console.log('  executeScheduledPostingWithRandomUnlimited() - 時間指定無制限投稿');
        console.log('');
        console.log('📚 【システム確認】:');
        console.log('  checkSystemStatus() - システム状況確認（無制限版）');
        console.log('');
        console.log('⚠️ 【注意事項】:');
        console.log('  • API制限: Threadsの1日あたりAPI制限にご注意');
        console.log('  • アカウント制限: 短時間での大量投稿はアカウント制限の可能性');
        console.log('  • 安全間隔: 30秒間隔での投稿を推奨');
        console.log('  • 時間指定: 既存の時間指定投稿システムは維持');
        console.log('');
        console.log('💡 【推奨実行順序（無制限版）】:');
        console.log('  1. checkSystemStatus() - 状況確認');
        console.log('  2. mainWithSimpleReply() - 無制限投稿実行');
        console.log('  3. executeAllAccountsReliable() - 全アカウント無制限投稿');
        console.log('');
        console.log('🎉 【完成機能】:');
        console.log('  🚀 手動投稿の全制限削除完了');
        console.log('  ⏰ 時間指定投稿システム維持');
        console.log('  🎲 アカウント別ランダム機能完全対応');
        console.log('  🖼️ Cloudinary画像投稿対応');
        console.log('  📊 完全無制限ログ記録');
    }