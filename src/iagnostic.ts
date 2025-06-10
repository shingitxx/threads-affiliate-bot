/**
 * 緊急診断コード - このコードをGoogle Apps Scriptで実行してください
 */

function emergencyDiagnosisForUI() {
    console.log('🆘 === 緊急診断開始 ===');
    
    const results = {
      configExists: false,
      mainFunctionExists: false,
      spreadsheetAccess: false,
      functionResponse: null,
      errors: []
    };
    
    try {
      // 1. CONFIG確認
      console.log('\n1. CONFIG確認:');
      if (typeof CONFIG !== 'undefined') {
        results.configExists = true;
        console.log('✅ CONFIG存在: YES');
        console.log('  SPREADSHEET_ID:', CONFIG.SPREADSHEET_ID ? '設定済み' : '未設定');
      } else {
        results.errors.push('CONFIG が定義されていません');
        console.log('❌ CONFIG存在: NO');
      }
      
      // 2. getSystemStatusForUI関数確認
      console.log('\n2. getSystemStatusForUI関数確認:');
      if (typeof getSystemStatusForUI === 'function') {
        results.mainFunctionExists = true;
        console.log('✅ getSystemStatusForUI関数: 存在');
        
        // 実際に実行してみる
        try {
          console.log('  実行テスト中...');
          const result = getSystemStatusForUI();
          results.functionResponse = result;
          
          console.log('  実行結果:');
          console.log('    - typeof result:', typeof result);
          console.log('    - result:', result);
          console.log('    - result.success:', result ? result.success : 'undefined');
          console.log('    - result.data:', result ? result.data : 'undefined');
          
        } catch (execError) {
          results.errors.push(`関数実行エラー: ${execError.message}`);
          console.log('  ❌ 実行エラー:', execError.message);
        }
      } else {
        results.errors.push('getSystemStatusForUI関数が存在しません');
        console.log('❌ getSystemStatusForUI関数: 存在しない');
      }
      
      // 3. スプレッドシートアクセス確認
      console.log('\n3. スプレッドシートアクセス確認:');
      if (results.configExists && CONFIG.SPREADSHEET_ID) {
        try {
          const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
          const sheets = spreadsheet.getSheets();
          results.spreadsheetAccess = true;
          console.log('✅ スプレッドシートアクセス: 成功');
          console.log('  シート数:', sheets.length);
          console.log('  シート名:', sheets.map(s => s.getName()));
        } catch (sheetError) {
          results.errors.push(`スプレッドシートエラー: ${sheetError.message}`);
          console.log('❌ スプレッドシートアクセス: 失敗');
          console.log('  エラー:', sheetError.message);
        }
      }
      
      // 4. 推奨解決策
      console.log('\n4. 推奨解決策:');
      if (!results.configExists) {
        console.log('❌ CONFIG未定義 → メイン処理.gsを確認してください');
      }
      if (!results.mainFunctionExists) {
        console.log('❌ 関数未定義 → UI連携バックエンド.gsが正しく保存されているか確認');
      }
      if (results.configExists && results.mainFunctionExists && !results.spreadsheetAccess) {
        console.log('❌ スプレッドシート問題 → SPREADSHEET_IDとアクセス権限を確認');
      }
      
      console.log('\n🆘 === 緊急診断完了 ===');
      console.log('結果:', results);
      
      return results;
      
    } catch (error) {
      console.error('❌ 診断エラー:', error);
      results.errors.push(`診断エラー: ${error.message}`);
      return results;
    }
  }
  
  /**
   * 手動でgetSystemStatusForUIを呼び出してテスト
   */
  function testGetSystemStatusForUIManually() {
    console.log('🧪 === 手動getSystemStatusForUIテスト ===');
    
    try {
      console.log('1. 関数存在確認:', typeof getSystemStatusForUI === 'function');
      console.log('2. CONFIG存在確認:', typeof CONFIG !== 'undefined');
      
      if (typeof getSystemStatusForUI !== 'function') {
        console.log('❌ getSystemStatusForUI関数が存在しません');
        return { success: false, error: 'getSystemStatusForUI関数が存在しません' };
      }
      
      console.log('3. 関数実行中...');
      const result = getSystemStatusForUI();
      
      console.log('4. 実行結果詳細:');
      console.log('  - 戻り値の型:', typeof result);
      console.log('  - 戻り値:', result);
      console.log('  - success プロパティ:', result && typeof result.success !== 'undefined' ? result.success : 'undefined');
      console.log('  - data プロパティ:', result && typeof result.data !== 'undefined' ? result.data : 'undefined');
      console.log('  - message プロパティ:', result && result.message ? result.message : 'undefined');
      
      if (!result) {
        console.log('❌ 関数がnullまたはundefinedを返しました');
        return { success: false, error: '関数がnullまたはundefinedを返しました' };
      }
      
      if (typeof result.success === 'undefined') {
        console.log('❌ 戻り値にsuccessプロパティがありません');
        return { success: false, error: '戻り値にsuccessプロパティがありません' };
      }
      
      console.log('✅ 関数実行成功');
      return result;
      
    } catch (error) {
      console.log('❌ 実行エラー:', error.message);
      console.log('❌ スタック:', error.stack);
      return { success: false, error: error.message };
    }
  }
  
  // 🔍 関数存在確認（実行後削除）
  function checkNewFunctions() {
    console.log('=== 新規追加関数確認 ===');
    
    const functions = [
      'executeAllAccountsForUI',
      'executeSingleAccountForUI', 
      'executeTestPostForUI'
    ];
    
    functions.forEach(funcName => {
      try {
        const exists = typeof eval(funcName) === 'function';
        console.log(`${funcName}: ${exists ? '✅ 存在' : '❌ 不在'}`);
      } catch (error) {
        console.log(`${funcName}: ❌ エラー - ${error.message}`);
      }
    });
  }
  
  /**
   * 🆘 緊急診断：時間指定投稿の部分失敗分析
   * ACC001未投稿、ACCOUNT_002成功の原因特定
   */
  
  // ==============================================
  // 🔍 1. アカウント状態詳細確認
  // ==============================================
  
  /**
   * アカウント別詳細状態確認
   */
  function diagnoseAccountStatus() {
    console.log('🔍 === アカウント別詳細診断開始 ===');
    
    try {
      const accounts = getActiveAccounts();
      
      accounts.forEach(account => {
        console.log(`\n👤 ${account.username} (${account.id}) 詳細診断:`);
        
        // 基本情報
        console.log(`  📱 ユーザーID: ${account.userId}`);
        console.log(`  🔑 トークン状態: ${account.accessToken ? '✅ 設定済み' : '❌ 未設定'}`);
        console.log(`  📅 最終投稿: ${account.lastPostTime || '未投稿'}`);
        console.log(`  📊 投稿数: ${account.dailyPostCount || 0}`);
        console.log(`  🎯 ステータス: ${account.status}`);
        
        // トークン詳細確認
        if (account.accessToken) {
          console.log(`  🔑 トークン長: ${account.accessToken.length}文字`);
          console.log(`  🔑 トークン先頭: ${account.accessToken.substring(0, 20)}...`);
        }
        
        // コンテンツ確認
        const content = getRandomContentForAccount(account.id);
        if (content) {
          console.log(`  ✅ 利用可能コンテンツ: ${content.id}`);
          console.log(`  📝 コンテンツ内容: ${content.mainText.substring(0, 30)}...`);
        } else {
          console.log(`  ❌ 利用可能コンテンツ: なし`);
        }
        
        // アフィリエイト確認
        if (content) {
          const affiliate = getRandomAffiliateForAccount(content.id, account.id);
          if (affiliate) {
            console.log(`  ✅ アフィリエイト: ${affiliate.id}`);
          } else {
            console.log(`  ❌ アフィリエイト: なし`);
          }
        }
      });
      
    } catch (error) {
      console.error('❌ アカウント診断エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 2. 20:00実行ログ詳細確認
  // ==============================================
  
  /**
   * 20:00実行の詳細ログ確認
   */
  function analyze20OClockExecution() {
    console.log('🕐 === 20:00実行ログ詳細分析 ===');
    
    try {
      const logSheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
        .getSheetByName('実行ログ');
      
      const lastRow = logSheet.getLastRow();
      if (lastRow <= 1) {
        console.log('❌ 実行ログが見つかりません');
        return;
      }
      
      const data = logSheet.getRange(2, 1, lastRow - 1, 7).getValues();
      
      // 今日の20:00前後のログを検索
      const today = new Date();
      const targetTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0, 0);
      const timeRange = 10 * 60 * 1000; // 前後10分
      
      console.log(`🔍 検索対象時間: ${targetTime.toLocaleString()} ±10分`);
      
      const relevantLogs = data.filter(row => {
        try {
          const logTime = new Date(row[0]);
          const timeDiff = Math.abs(logTime.getTime() - targetTime.getTime());
          return timeDiff <= timeRange;
        } catch (error) {
          return false;
        }
      });
      
      if (relevantLogs.length === 0) {
        console.log('⚠️ 20:00前後の実行ログが見つかりません');
        console.log('🔍 最近の実行ログ（直近5件）:');
        
        const recentLogs = data.slice(-5);
        recentLogs.forEach(row => {
          console.log(`  ${new Date(row[0]).toLocaleString()} | ${row[1]} | ${row[2]} | ${row[4]}`);
        });
        
      } else {
        console.log(`✅ 20:00前後の実行ログ（${relevantLogs.length}件）:`);
        
        relevantLogs.forEach(row => {
          const logTime = new Date(row[0]);
          console.log(`  🕐 ${logTime.toLocaleTimeString()}`);
          console.log(`    👤 アカウント: ${row[1]}`);
          console.log(`    📝 コンテンツ: ${row[2]}`);
          console.log(`    🎯 タイプ: ${row[3]}`);
          console.log(`    📊 結果: ${row[4]}`);
          console.log(`    🆔 投稿ID: ${row[5] || 'なし'}`);
          console.log(`    💬 詳細: ${row[6] || 'なし'}`);
          console.log('');
        });
      }
      
      // アカウント別成功/失敗の集計
      const accountResults = {};
      relevantLogs.forEach(row => {
        const account = row[1];
        const result = row[4];
        
        if (!accountResults[account]) {
          accountResults[account] = { success: 0, failure: 0 };
        }
        
        if (result === '成功') {
          accountResults[account].success++;
        } else {
          accountResults[account].failure++;
        }
      });
      
      console.log('📊 === アカウント別結果サマリー ===');
      Object.keys(accountResults).forEach(account => {
        const results = accountResults[account];
        console.log(`👤 ${account}: 成功${results.success}件, 失敗${results.failure}件`);
      });
      
    } catch (error) {
      console.error('❌ 20:00実行ログ分析エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 3. トークン有効性テスト
  // ==============================================
  
  /**
   * 各アカウントのトークン有効性テスト
   */
  function testAccountTokens() {
    console.log('🔑 === アカウントトークン有効性テスト ===');
    
    try {
      const accounts = getActiveAccounts();
      
      accounts.forEach(account => {
        console.log(`\n🔑 ${account.username} トークンテスト開始...`);
        
        if (!account.accessToken) {
          console.log(`❌ ${account.username}: トークンが設定されていません`);
          return;
        }
        
        try {
          // 簡単なAPI呼び出しでトークンテスト
          const testResponse = UrlFetchApp.fetch(
            `https://graph.threads.net/v1.0/${account.userId}?fields=id,username`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${account.accessToken}`
              },
              muteHttpExceptions: true
            }
          );
          
          const responseCode = testResponse.getResponseCode();
          const responseText = testResponse.getContentText();
          
          console.log(`📡 ${account.username} API応答: ${responseCode}`);
          
          if (responseCode === 200) {
            const userData = JSON.parse(responseText);
            console.log(`✅ ${account.username}: トークン有効`);
            console.log(`  📱 取得ユーザーID: ${userData.id}`);
            console.log(`  👤 取得ユーザー名: ${userData.username || 'なし'}`);
          } else {
            console.log(`❌ ${account.username}: トークン無効`);
            console.log(`  📄 エラー応答: ${responseText}`);
            
            // よくあるエラーパターンの解説
            if (responseCode === 401) {
              console.log(`  💡 原因: アクセストークンの期限切れまたは無効`);
            } else if (responseCode === 403) {
              console.log(`  💡 原因: 権限不足またはアプリ設定の問題`);
            } else if (responseCode === 400) {
              console.log(`  💡 原因: リクエスト形式の問題`);
            }
          }
          
        } catch (tokenError) {
          console.log(`❌ ${account.username}: API呼び出しエラー`);
          console.log(`  🔍 エラー詳細: ${tokenError.message}`);
        }
      });
      
    } catch (error) {
      console.error('❌ トークンテスト全体エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 4. コンテンツ・アフィリエイト可用性確認
  // ==============================================
  
  /**
   * アカウント別コンテンツ・アフィリエイト可用性確認
   */
  function testContentAvailability() {
    console.log('📝 === コンテンツ・アフィリエイト可用性テスト ===');
    
    try {
      const accounts = getActiveAccounts();
      
      accounts.forEach(account => {
        console.log(`\n📝 ${account.username} コンテンツテスト:`);
        
        // コンテンツ取得テスト（5回）
        let contentSuccess = 0;
        let contentIds = [];
        
        for (let i = 1; i <= 5; i++) {
          const content = getRandomContentForAccount(account.id);
          if (content) {
            contentSuccess++;
            contentIds.push(content.id);
            console.log(`  ${i}. ✅ ${content.id}: ${content.mainText.substring(0, 30)}...`);
            
            // 対応するアフィリエイトテスト
            const affiliate = getRandomAffiliateForAccount(content.id, account.id);
            if (affiliate) {
              console.log(`    🔗 アフィリエイト: ${affiliate.id} - ${affiliate.description.substring(0, 30)}...`);
            } else {
              console.log(`    ❌ アフィリエイト: 見つかりません`);
            }
          } else {
            console.log(`  ${i}. ❌ コンテンツ取得失敗`);
          }
        }
        
        console.log(`  📊 ${account.username} 結果: ${contentSuccess}/5 成功`);
        console.log(`  🎯 コンテンツID: [${contentIds.join(', ')}]`);
        
        if (contentSuccess === 0) {
          console.log(`  ⚠️ ${account.username}: 投稿可能なコンテンツがありません`);
          console.log(`  💡 対策: ${account.id} 用のコンテンツを追加してください`);
        }
      });
      
    } catch (error) {
      console.error('❌ コンテンツ可用性テスト エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 5. 時間指定トリガー状態確認
  // ==============================================
  
  /**
   * 現在のトリガー状態詳細確認
   */
  function analyzeTriggerStatus() {
    console.log('⏰ === トリガー状態詳細分析 ===');
    
    try {
      const triggers = ScriptApp.getProjectTriggers();
      
      console.log(`📊 総トリガー数: ${triggers.length}`);
      
      const scheduleTriggers = triggers.filter(trigger => 
        trigger.getHandlerFunction() === 'checkScheduledTime'
      );
      
      console.log(`🕐 時間指定トリガー数: ${scheduleTriggers.length}`);
      
      scheduleTriggers.forEach((trigger, index) => {
        console.log(`\n⏰ トリガー ${index + 1}:`);
        console.log(`  🎯 関数: ${trigger.getHandlerFunction()}`);
        console.log(`  📅 種類: ${trigger.getEventType()}`);
        console.log(`  🔄 頻度: ${trigger.getTriggerSource()}`);
        
        if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
          console.log(`  ⏱️ 実行間隔: 毎分`);
        }
      });
      
      // 最後に実行されたcheckScheduledTimeの確認
      console.log('\n🔍 PropertiesService確認:');
      const properties = PropertiesService.getScriptProperties();
      const allProperties = properties.getProperties();
      
      // 今日の実行フラグを確認
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('SCHEDULED_') && key.includes(today)) {
          console.log(`  ✅ 実行済みフラグ: ${key}`);
        }
      });
      
    } catch (error) {
      console.error('❌ トリガー状態分析エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 6. 包括的診断実行関数
  // ==============================================
  
  /**
   * 全診断を順次実行
   */
  function runComprehensiveDiagnosis() {
    console.log('🆘 === 包括的診断開始 ===');
    console.log(`🕐 実行時刻: ${new Date().toLocaleString()}`);
    console.log('📋 診断対象: ACC001未投稿、ACCOUNT_002成功の原因特定\n');
    
    try {
      // 1. アカウント状態確認
      diagnoseAccountStatus();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // 2. 20:00実行ログ分析
      analyze20OClockExecution();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // 3. トークン有効性テスト
      testAccountTokens();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // 4. コンテンツ可用性テスト
      testContentAvailability();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // 5. トリガー状態分析
      analyzeTriggerStatus();
      
      console.log('\n🎯 === 診断完了 ===');
      console.log('📊 上記の結果を確認して、ACC001の投稿失敗原因を特定してください');
      console.log('💡 特に注目すべき点:');
      console.log('  1. ACC001のトークン有効性');
      console.log('  2. ACC001用コンテンツの可用性');
      console.log('  3. 20:00前後のエラーログ');
      console.log('  4. 実行順序（ACC001が最初に実行されたか）');
      
    } catch (error) {
      console.error('❌ 包括的診断エラー:', error);
    }
  }
  
  // ==============================================
  // 🔍 7. 簡易修復試行関数
  // ==============================================
  
  /**
   * ACC001問題の簡易修復試行
   */
  function attemptACC001Fix() {
    console.log('🔧 === ACC001簡易修復試行 ===');
    
    try {
      // ACC001単独テスト投稿
      console.log('🧪 ACC001単独テスト投稿を実行...');
      
      const acc001 = getAccountById('ACC001');
      if (!acc001) {
        console.log('❌ ACC001アカウント情報取得失敗');
        return;
      }
      
      console.log(`✅ ACC001情報: ${acc001.username}`);
      
      const content = getRandomContentForAccount('ACC001');
      if (!content) {
        console.log('❌ ACC001用コンテンツ取得失敗');
        return;
      }
      
      console.log(`✅ コンテンツ: ${content.id}`);
      
      const result = executeMainPostWithCloudinary(acc001, content);
      if (result.success) {
        console.log(`✅ ACC001テスト投稿成功: ${result.postId}`);
        
        // リプライも試行
        const affiliate = getRandomAffiliateForAccount(content.id, 'ACC001');
        if (affiliate) {
          Utilities.sleep(5000);
          const replyResult = executeThreadReplySimple(acc001, affiliate, result.postId);
          if (replyResult.success) {
            console.log(`✅ ACC001リプライ成功: ${replyResult.postId}`);
          } else {
            console.log(`❌ ACC001リプライ失敗: ${replyResult.error}`);
          }
        }
        
      } else {
        console.log(`❌ ACC001テスト投稿失敗: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ ACC001修復試行エラー:', error);
    }
  }
  
  // ==============================================
  // 🎯 使用方法
  // ==============================================
  
  /**
   * 診断実行ガイド
   */
  function showDiagnosisGuide() {
    console.log(`
  🆘 === 緊急診断ガイド ===
  
  【🔍 推奨実行順序】
  1. runComprehensiveDiagnosis() - 包括的診断（必須）
  2. attemptACC001Fix() - ACC001修復試行
  3. 結果に基づく対策実行
  
  【📋 各診断関数】
  - diagnoseAccountStatus() - アカウント状態詳細確認
  - analyze20OClockExecution() - 20:00実行ログ分析
  - testAccountTokens() - トークン有効性テスト
  - testContentAvailability() - コンテンツ可用性確認
  - analyzeTriggerStatus() - トリガー状態確認
  
  【🎯 期待される発見】
  - ACC001のトークン期限切れ
  - ACC001用コンテンツの不足
  - 実行順序の問題
  - API制限の発生
  
  まずは runComprehensiveDiagnosis() を実行してください！
    `);
  }
  
  /**
   * 🔍 時間指定投稿で実際に使用される関数を特定
   * 急ぎで正確な関数名を見つける必要があります
   */
  
  /**
   * checkScheduledTime関数の内容確認
   */
  function analyzeCheckScheduledTime() {
    console.log('🔍 === checkScheduledTime関数の内容確認 ===');
    
    try {
      // checkScheduledTime関数のソースコードを確認
      const functionString = checkScheduledTime.toString();
      console.log('📋 checkScheduledTime関数の内容:');
      console.log(functionString);
      
      // 呼び出されている関数を特定
      const functionCalls = [];
      
      // よくある関数名パターンをチェック
      const patterns = [
        'mainWithSimpleReply',
        'mainAllAccountsUnlimited', 
        'executeScheduledPostingWithRandomUnlimited',
        'executeAllAccountsFromUI',
        'mainAllAccountsTest',
        'executeScheduledPosting'
      ];
      
      patterns.forEach(pattern => {
        if (functionString.includes(pattern)) {
          functionCalls.push(pattern);
          console.log(`✅ 発見: ${pattern}が呼び出されています`);
        }
      });
      
      if (functionCalls.length === 0) {
        console.log('⚠️ 明確な関数呼び出しが見つかりません');
        console.log('🔍 手動で関数内容を確認してください');
      }
      
      return functionCalls;
      
    } catch (error) {
      console.error('❌ checkScheduledTime分析エラー:', error);
      return [];
    }
  }
  
  /**
   * 利用可能な全アカウント投稿関数をリストアップ
   */
  function listAllAccountFunctions() {
    console.log('📋 === 利用可能な全アカウント投稿関数一覧 ===');
    
    const possibleFunctions = [
      'mainWithSimpleReply',
      'mainAllAccountsUnlimited',
      'executeScheduledPostingWithRandomUnlimited', 
      'executeAllAccountsFromUI',
      'mainAllAccountsTest',
      'executeScheduledPosting',
      'executeAllAccountsReliable'
    ];
    
    const availableFunctions = [];
    
    possibleFunctions.forEach(funcName => {
      try {
        const func = eval(funcName);
        if (typeof func === 'function') {
          availableFunctions.push(funcName);
          console.log(`✅ ${funcName}: 存在します`);
        } else {
          console.log(`❌ ${funcName}: 存在しません`);
        }
      } catch (error) {
        console.log(`❌ ${funcName}: 存在しません`);
      }
    });
    
    console.log(`\n📊 利用可能な関数: ${availableFunctions.length}個`);
    return availableFunctions;
  }
  
  /**
   * 時間指定投稿の実行パスを解析
   */
  function traceScheduledExecutionPath() {
    console.log('🔍 === 時間指定投稿実行パス解析 ===');
    
    try {
      console.log('📋 実行フロー解析:');
      console.log('1. トリガー → checkScheduledTime()');
      
      // checkScheduledTime関数の中身を確認
      if (typeof checkScheduledTime === 'function') {
        const checkFunc = checkScheduledTime.toString();
        console.log('2. checkScheduledTime → ?');
        
        // 関数内で呼び出されている可能性のある関数を検索
        if (checkFunc.includes('mainWithSimpleReply')) {
          console.log('   ✅ mainWithSimpleReply が呼び出されています');
        }
        if (checkFunc.includes('mainAllAccountsUnlimited')) {
          console.log('   ✅ mainAllAccountsUnlimited が呼び出されています');
        }
        if (checkFunc.includes('executeScheduledPosting')) {
          console.log('   ✅ executeScheduledPosting が呼び出されています');
        }
        
        // 関数の重要部分を抜粋表示
        const lines = checkFunc.split('\n');
        console.log('\n📋 checkScheduledTime関数の重要部分:');
        lines.forEach((line, index) => {
          if (line.includes('main') || line.includes('execute') || line.includes('(')) {
            console.log(`  ${index + 1}: ${line.trim()}`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ 実行パス解析エラー:', error);
    }
  }
  
  /**
   * 緊急：checkScheduledTime関数の実際の内容を表示
   */
  function showCheckScheduledTimeContent() {
    console.log('🆘 === checkScheduledTime関数の完全内容 ===');
    
    try {
      if (typeof checkScheduledTime === 'function') {
        const functionContent = checkScheduledTime.toString();
        console.log('📋 関数の完全な内容:');
        console.log('---開始---');
        console.log(functionContent);
        console.log('---終了---');
        
        // 実行される関数を特定
        const executionPattern = /(\w+)\(\)/g;
        const matches = functionContent.match(executionPattern);
        
        if (matches) {
          console.log('\n🎯 呼び出される関数候補:');
          matches.forEach(match => {
            console.log(`  - ${match}`);
          });
        }
        
      } else {
        console.log('❌ checkScheduledTime関数が見つかりません');
      }
      
    } catch (error) {
      console.error('❌ 関数内容表示エラー:', error);
    }
  }
  
  /**
   * 全分析を実行
   */
  function findActualScheduledFunction() {
    console.log('🔍 === 時間指定投稿関数の完全分析 ===');
    
    // 1. checkScheduledTime関数の内容表示
    showCheckScheduledTimeContent();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 2. 利用可能関数一覧
    const availableFunctions = listAllAccountFunctions();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 3. 実行パス解析
    traceScheduledExecutionPath();
    
    console.log('\n🎯 === 分析完了 ===');
    console.log('📋 上記の結果から、実際に呼び出される関数を特定してください');
    
    return {
      availableFunctions: availableFunctions,
      analysisComplete: true
    };
  }
  
  console.log('🔍 関数特定コード準備完了');
  console.log('🆘 緊急実行: findActualScheduledFunction()');
  console.log('📋 checkScheduledTime内容確認: showCheckScheduledTimeContent()');
  
  console.log('🆘 緊急診断コード準備完了');
  console.log('📋 実行推奨: runComprehensiveDiagnosis()');
  
  // 実行推奨順序
  console.log('🔍 実行推奨順序:');
  console.log('1. emergencyDiagnosisForUI() - 総合診断');
  console.log('2. testGetSystemStatusForUIManually() - 関数単体テスト');
  console.log('');
  console.log('まずは emergencyDiagnosisForUI() を実行してください！');