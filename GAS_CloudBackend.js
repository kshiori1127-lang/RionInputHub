/**
 * ==============================================================================
 * 🌸 RionInputHub Ver.2 - 完全無料クラウドバックエンド (Google Apps Script) 🌸
 * ==============================================================================
 * 
 * 【概要】
 * スマホアプリ「RionInputHub (index.html)」からの送信を受け取り、
 * 無料の Gemini API を使って朝のブリーフィングや夜の日誌（思考と感情のログ）を自動生成し、
 * Googleドライブ内の Obsidian フォルダ（2nd-Brain/05_日誌/）へ直接書き込みを行うサーバーコードです。
 * PCの電源が切れていても24時間完全自動で動作します！
 * 
 * 【設定手順（たった3ステップ・3分で完了！）】
 * 1. Google AI Studio ( https://aistudio.google.com/ ) にアクセスし、「Get API key」から
 *    無料の API キーを1つ作成し、下の GEMINI_API_KEY の "" の中に貼り付けます。
 * 2. このコード全体をコピーし、Google ドライブ上で作成した Google Apps Script のエディタに貼り付けます。
 * 3. 右上の「デプロイ」➡️「新しいデプロイ」をクリックし、
 *    ・種類の選択：「ウェブアプリ」
 *    ・アクセスできるユーザー：「全員 (Anyone)」
 *    にして「デプロイ」をクリック！発行された Web アプリ URL を RionInputHub に設定すれば完成です✨
 * ==============================================================================
 */

// 👇 Step 1 で取得した無料の Gemini API キーをここに貼り付けます
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// 👇 Obsidian の日誌フォルダ名（Googleドライブ内）
const JOURNAL_FOLDER_NAME = "05_日誌";

/**
 * スマホアプリ RionInputHub から POST データを受け取るメイン窓口
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const command = data.command || "";      // "/today-start" または "/today-finish" または ""
    const message = data.message || "";      // 朝の一言、または夜の音声テキスト（思考と感情のログ）
    const category = data.category || "";
    
    // 今日の日付を取得 (YYYY-MM-DD)
    const todayStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    const fileName = todayStr + ".md";
    
    // 1. Google ドライブから「05_日誌」フォルダを探す
    const folders = DriveApp.getFoldersByName(JOURNAL_FOLDER_NAME);
    if (!folders.hasNext()) {
      return createJsonResponse({ status: "error", error: "Googleドライブ内に『" + JOURNAL_FOLDER_NAME + "』フォルダが見つかりませんでした。" });
    }
    const journalFolder = folders.next();
    
    // 2. 今日の日誌ファイルを探す（なければ新規作成用に空文字）
    let existingContent = "";
    let targetFile = null;
    const files = journalFolder.getFilesByName(fileName);
    if (files.hasNext()) {
      targetFile = files.next();
      existingContent = targetFile.getBlob().getDataAsString("UTF-8");
    }
    
    // 3. Gemini API に渡すプロンプトの作成
    let systemPrompt = "";
    if (command === "/today-start" || category.includes("朝の開始")) {
      systemPrompt = `あなたはしおりさんの優しく頼れる専属秘書ライオンくんです。
以下の入力（またはコマンドのみ）を受け取り、本日の日誌の初期フォーマット作成と、スマホアプリ画面用に短く簡潔に整理した要約・ブリーフィング・スキマ提案・最重要タスク(Big3)を生成してください。

【しおりさんからの朝のメッセージ】: "${message || '（コマンドのみ送信・今日もよろしく！）'}"
【今日の日付】: ${todayStr}

出力は以下のJSON形式のみで返してください：
{
  "journalMarkdown": "---/nyamlフロントマターや今日の目標、スケジュール等を含んだMarkdown日誌テンプレート---",
  "userStartLogSummary": "しおりさんの朝の宣言・目標・本日のスケジュールから過度に削りすぎず、具体的な持ち物・予定・行動項目を含めつつスマホで見やすい 5〜8行程度 で分かりやすく整理したテキスト🌸",
  "briefingComment": "秘書ライオンくんからの朝のブリーフィング。要点を4〜6行にスッキリまとめた温かい応援メッセージ🦁🌸",
  "proactiveSuggestions": [
    "📱 【午前スキマ】モアクトやfantask等でのポチポチ作業やココナラ確認",
    "📱 【午後スキマ】予定表やプリントがあればスマホカメラで自動登録✨",
    "🎧 【移動スキマ】耳学習や短時間の情報整理☕"
  ],
  "big3Tasks": [
    "ココナラ・依頼チェック＆フォロー連絡",
    "実家やご家族との時間を大切に過ごす🌿",
    "スマホ完結ポチポチ作業のコツコツ継続📱"
  ]
}`;
    } else if (command === "/today-finish" || category.includes("夜の完了")) {
      systemPrompt = `あなたはしおりさんの優しく頼れる専属秘書ライオンくんです。
しおりさんが夜のベッドの中で音声またはテキストで一気に吐き出した「思考と感情のログ（今日何があったか、何を感じたか、明日の計画など）」が届きました。
これをもとに、今日の日誌の「### 🧠 思考と感情のログ (Context Stream)」セクションを綺麗に整理して追記・完成させ、さらにスマホアプリ画面用に簡潔に分離整理した要約・フィードバックを生成してください。

【既存の今日の日誌内容】:
${existingContent || '（今日の日誌ベースが未作成のため、新規で全体を作成してください）'}

【夜に吐き出された音声ログ・テキスト】:
"${message}"

出力は以下のJSON形式のみで返してください：
{
  "journalMarkdown": "（思考と感情のログや振り返りを追加して完成させた今日の日誌全体のMarkdown）",
  "userFinishLogSummary": "しおりさんの夜の思考ログ・実践振り返りから過度に削りすぎず、具体的な実践内容を変えずにスマホで見やすい 5〜8行程度 で分かりやすく整理したテキスト🌙",
  "briefingComment": "秘書ライオンくんからの夜の労いフィードバック。要点を4〜6行にスッキリまとめた温かな言葉🦁🌙",
  "xPostDraft": "（Xポスト案・140字以内）",
  "proactiveSuggestions": [
    "📱 【明日スキマ】スマホ完結ポイ活とルーティン継続",
    "📝 【明日スキマ】今日思いついたアイデアの整理",
    "☕ 【夜リラックス】今夜はゆっくり休んで明日に備える🌿"
  ],
  "big3Tasks": [
    "明日の最優先タスク1",
    "明日の最優先タスク2",
    "明日の最優先タスク3"
  ]
}`;
    } else {
      // 📝 フェーズ1: 通常メモ、タスク、その他のコマンドを Inbox フォルダへ投下
      const inboxFolders = DriveApp.getFoldersByName("Inbox");
      if (!inboxFolders.hasNext()) {
        return createJsonResponse({ status: "error", error: "Googleドライブ内に『Inbox』フォルダが見つかりませんでした。PC側で作成してください。" });
      }
      const inboxFolder = inboxFolders.next();
      const timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
      
      // ファイル名を作成（コマンドがあればプレフィックスにする）
      let prefix = command ? command.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15) : 'Memo';
      if (!prefix) prefix = 'Memo';
      const fileName = `Inbox_${prefix}_${timestamp}.md`;
      
      // Markdownコンテンツの作成
      const fileContent = `---
date: ${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss")}
category: ${category}
command: ${command}
---

${message}
`;
      inboxFolder.createFile(fileName, fileContent, MimeType.PLAIN_TEXT);

      return createJsonResponse({
        status: "success",
        command: command,
        date: todayStr,
        startSummary: "Inboxに保存完了✨",
        briefing: `「${category || command || 'メモ'}」をInboxに格納しました！PCを開いた時に確認できます🦁`,
        finishSummary: "夜の完了ログを待機中です🦁🌙",
        finishFeedback: "今夜ログが送信されるとここにフィードバックが表示されます🌸",
        xPost: "",
        suggestions: [],
        big3: []
      });
    }
    
    // 4. Gemini API 呼び出し (無料 Flash モデル)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseJson = JSON.parse(response.getContentText());
    
    if (responseJson.error) {
      // API一時エラー時もローカル抽出フォールバック
      const fallbackData = extractLocalSummary(existingContent || message, todayStr, fileName);
      return createJsonResponse({
        status: "success",
        command: command,
        date: todayStr,
        startSummary: fallbackData.startSummary,
        briefing: fallbackData.briefing,
        finishSummary: fallbackData.finishSummary,
        xPost: fallbackData.xPost,
        suggestions: fallbackData.suggestions,
        big3: fallbackData.big3
      });
    }
    
    let aiText = responseJson.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/i, '').replace(/```/g, '').trim();
    let aiResult;
    try {
      aiResult = JSON.parse(aiText);
    } catch(e) {
      const fallbackData = extractLocalSummary(existingContent || message, todayStr, fileName);
      return createJsonResponse({
        status: "success",
        command: command,
        date: todayStr,
        startSummary: fallbackData.startSummary,
        briefing: fallbackData.briefing,
        finishSummary: fallbackData.finishSummary,
        xPost: fallbackData.xPost,
        suggestions: fallbackData.suggestions,
        big3: fallbackData.big3
      });
    }
    
    // 5. Googleドライブ上の Obsidian 日誌へ直接書き込み (新規作成 または 上書き保存)
    if (targetFile && aiResult.journalMarkdown) {
      targetFile.setContent(aiResult.journalMarkdown);
    } else if (aiResult.journalMarkdown) {
      journalFolder.createFile(fileName, aiResult.journalMarkdown, MimeType.PLAIN_TEXT);
    }
    
    // 6. スマホアプリへフィードバック結果を返す
    return createJsonResponse({
      status: "success",
      command: command,
      date: todayStr,
      startSummary: aiResult.userStartLogSummary || message || "ワンタップでスタートしました🌸",
      briefing: aiResult.briefingComment || "処理が完了しました！🌸",
      finishSummary: aiResult.userFinishLogSummary || message || "夜の完了ログが記録されました🌙",
      xPost: aiResult.xPostDraft || "",
      suggestions: aiResult.proactiveSuggestions || [],
      big3: aiResult.big3Tasks || []
    });
    
  } catch (err) {
    return createJsonResponse({ status: "error", error: err.toString() });
  }
}

/**
 * スマホアプリ RionInputHub から GET リクエストを受け取り、
 * Google ドライブ上の「今日の日誌（YYYY-MM-DD.md）」の内容を変えずに簡潔に要約・分離して返す窓口
 */
function doGet(e) {
  try {
    const todayStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    const fileName = todayStr + ".md";
    
    const folders = DriveApp.getFoldersByName(JOURNAL_FOLDER_NAME);
    if (!folders.hasNext()) {
      return createJsonResponse({ status: "error", error: "Googleドライブ内に『" + JOURNAL_FOLDER_NAME + "』フォルダが見つかりませんでした。" });
    }
    const journalFolder = folders.next();
    const files = journalFolder.getFilesByName(fileName);
    
    if (!files.hasNext()) {
      return createJsonResponse({
        status: "notFound",
        date: todayStr,
        fileName: fileName,
        message: "まだ今日（" + todayStr + "）の日誌ファイルは作成されていません🌸 「🌅 朝の開始」から送信するか、PCのAntigravityで作成を行ってくださいね✨"
      });
    }
    
    const targetFile = files.next();
    const content = targetFile.getBlob().getDataAsString("UTF-8");
    
    // Gemini APIに投げてスマホ画面向けに具体性を残してスッキリ分離したデータに整理
    const systemPrompt = `あなたはしおりさんの優しく頼れる専属秘書ライオンくんです。
以下の「今日の日誌（Obsidian Markdown全文）」を分析し、スマホ画面(RionInputHub)で短時間でサクッと把握できるよう、内容や具体性を変えずに見やすく整理してJSONで返してください。

【今日の日誌（Markdown全文）】:
${content}

【出力要件（過度な短縮はNG！具体的な予定・持ち物・タスクをしっかり残して見やすく分離！）】:
1. "startSummary": しおりさんの朝の宣言・本日のスケジュール・具体的な持ち物・予定・意気込みから、生のMarkdown記号や余計なメタデータを綺麗に削ぎ落としつつも、過度に削りすぎず「具体的な予定や行動項目（箇条書き含む）」がスマホでパッと分かるように 5〜8行程度 で分かりやすく整理してください。
2. "briefing": 秘書ライオンくんからの応援＆ブリーフィングコメント。要点を4〜6行程度にまとめた温かなフィードバック。
3. "suggestions": 今日の実際の予定やポイ活リスト（モアクト、fantask等）を反映した具体的なスキマ提案を3項目（各1〜2行）の配列。
4. "big3": 日誌の優先タスクやBig3から抽出した具体的な3項目（各1行）の配列。
5. "finishSummary": 「思考と感情のログ」や実践振り返りがある場合、生のMarkdown記号を整えつつ具体的内容を変えずに 5〜8行程度 で見やすく整理（未記載なら「夜の完了ログは未入力です🦁🌙」）。
6. "finishFeedback": 夜の労いフィードバックメッセージを4〜6行で整理（未記載なら「今夜ログが送信されるとここにフィードバックが表示されます🌸」）。
7. "xPost": Xポスト案がある場合は140字以内で抽出（未記載なら空文字）。

出力は以下のJSON形式のみで返してください：
{
  "startSummary": "...",
  "briefing": "...",
  "suggestions": ["...", "...", "..."],
  "big3": ["...", "...", "..."],
  "finishSummary": "...",
  "finishFeedback": "...",
  "xPost": "..."
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseJson = JSON.parse(response.getContentText());
    
    if (responseJson.error) {
      // API一時エラーやクォータ制限時は、日誌Markdown本文からローカル抽出して返す（ダミー文字NG！）
      const fallbackData = extractLocalSummary(content, todayStr, fileName);
      return createJsonResponse(fallbackData);
    }
    
    try {
      let aiText = responseJson.candidates[0].content.parts[0].text;
      aiText = aiText.replace(/```json/i, '').replace(/```/g, '').trim();
      const aiResult = JSON.parse(aiText);
      
      return createJsonResponse({
        status: "success",
        date: todayStr,
        fileName: fileName,
        startSummary: aiResult.startSummary || extractLocalSummary(content, todayStr, fileName).startSummary,
        briefing: aiResult.briefing || "今日も一日応援しています！🦁✨",
        suggestions: aiResult.suggestions || extractLocalSummary(content, todayStr, fileName).suggestions,
        big3: aiResult.big3 || extractLocalSummary(content, todayStr, fileName).big3,
        finishSummary: aiResult.finishSummary || "夜の完了ログを待機中です🦁🌙",
        finishFeedback: aiResult.finishFeedback || "今夜ログが送信されるとここにフィードバックが表示されます🌸",
        xPost: aiResult.xPost || ""
      });
    } catch (parseErr) {
      // JSONパース失敗時もローカル抽出で具体データを返す
      const fallbackData = extractLocalSummary(content, todayStr, fileName);
      return createJsonResponse(fallbackData);
    }
  } catch (err) {
    return createJsonResponse({ status: "error", error: err.toString() });
  }
}

/**
 * Gemini APIの一時的なエラーやパース失敗時、またはAPIを使わない場合でも、
 * 実際のObsidian日誌テンプレート（2026-07-10.md等）の正確な見出し構造から
 * 各専用UIカード向けに重複なく綺麗に分離抽出するローカル要約ヘルパー
 */
function extractLocalSummary(content, todayStr, fileName) {
  const body = content.replace(/^---[\s\S]*?---/, '').trim();
  
  // 1. 朝の宣言・戦略まとめ（startSummary）：📌【AI専属秘書が整理した本日の優先順位】や Today's Tasks から抽出
  let startSummary = "";
  const priorityMatch = body.match(/📌\s*\*\*【AI専属秘書が整理した本日の優先順位】\*\*[\s\S]*?(?=(?:\*\*💡|##|$))/i);
  if (priorityMatch) {
    startSummary = priorityMatch[0].replace(/📌\s*\*\*【AI専属秘書が整理した本日の優先順位】\*\*/i, '').trim();
  } else {
    const tasksMatch = body.match(/##\s*✅\s*Today's Tasks[\s\S]*?(?=(?:##|$))/i);
    if (tasksMatch) {
      const taskLines = tasksMatch[0].split('\n').filter(l => l.includes('- [ ]') || l.includes('- [x]')).slice(0, 5);
      startSummary = taskLines.join('\n');
    }
  }
  if (!startSummary || startSummary.length < 15) {
    const startSectionMatch = body.match(/##\s*🌞\s*今日が始まるよ！[\s\S]*?(?=(?:##|$))/i);
    if (startSectionMatch && startSectionMatch[0].replace(/##.*$|\/today-start/gm, '').trim().length > 15) {
      startSummary = startSectionMatch[0].replace(/##.*$|\/today-start/gm, '').trim();
    } else {
      startSummary = "今日の日誌データと正常に接続されています🌸 本日の優先順位とタスクをご確認ください✨";
    }
  }

  // 2. 秘書コメント・ブリーフィング抽出（briefing）：## ☕ 秘書の朝のブリーフィング から 📌優先順位 の手前までを抽出
  let briefing = "しおりさん、今日の日誌データと連携されています！ご自身のペースでコツコツ進めていきましょう🦁✨";
  const briefingMatch = body.match(/##\s*☕\s*秘書の(?:朝の)?ブリーフィング[\s\S]*?(?=(?:📌|\*\*💡|##|$))/i);
  if (briefingMatch) {
    briefing = briefingMatch[0].replace(/##\s*☕\s*秘書の(?:朝の)?ブリーフィング.*$/gm, '').trim().slice(0, 300);
  }

  // 3. 優先タスク/Big3抽出（big3）：## 🦁 エージェントの提案 (Big 3) から 1. 2. 3. を抽出
  let big3 = ["本日の最優先タスクを一つずつ確実に進める🌸", "スマホ完結ポチポチ作業のコツコツ継続📱", "ご家族とのリラックスタイムを大切にする🌿"];
  const big3Match = body.match(/##\s*🦁\s*エージェントの提案\s*\(Big\s*3\)[\s\S]*?(?=(?:---|##|$))/i);
  if (big3Match) {
    const lines = big3Match[0].split('\n').filter(l => l.match(/^[0-9１２３1-3][.・]/) || l.includes('- [ ]') || l.includes('- [x]'));
    if (lines.length > 0) {
      big3 = lines.slice(0, 3).map(l => l.replace(/^[0-9１２３1-3][.・\s]+|[-*・\s[\]x/]+/g, '').trim()).filter(Boolean);
    }
  }

  // 4. スキマ提案抽出（suggestions）：**💡 今日の提案 (Proactive Suggestions)** から抽出
  let suggestions = [
    "📱 【午前スキマ】モアクト＆fantask等でのポチポチ作業やココナラ確認",
    "📱 【午後スキマ】予定表やプリントがあればスマホカメラで自動登録✨",
    "🎧 【移動スキマ】耳学習や短時間の情報整理☕"
  ];
  const sugsMatch = body.match(/\*\*💡\s*今日の提案[\s\S]*?(?=(?:\*\*✨|##|$))/i);
  if (sugsMatch) {
    const lines = sugsMatch[0].split('\n').filter(l => l.includes('- [ ]') || l.includes('- [x]') || l.includes('Proposal'));
    if (lines.length > 0) {
      suggestions = lines.slice(0, 3).map(l => l.replace(/^[-*・\s[\]x/]+(?:\*\*\[Proposal\]\*\*\s*|\*\*\[Reminder\]\*\*\s*)?/, '').trim()).filter(Boolean);
    }
  }

  // 5. 夜のブリーフィング＆思考ログ抽出（finishSummary / finishFeedback）
  let finishFeedback = "まだ本日の夜のフィードバックは未記録です。「🌙 夜の完了」ボタンから今日のログを送ると、ここに温かく簡潔にまとめた労いメッセージが表示されます🦁🌸";
  const nightBriefMatch = body.match(/##\s*☕\s*秘書の夜のブリーフィング[\s\S]*?(?=(?:##|###|---|$))/i);
  const hasNightBrief = nightBriefMatch && nightBriefMatch[0].replace(/##\s*☕\s*秘書の夜のブリーフィング.*$/gm, '').trim().length > 15;
  if (hasNightBrief) {
    finishFeedback = nightBriefMatch[0].replace(/##\s*☕\s*秘書の夜のブリーフィング.*$/gm, '').trim().slice(0, 300);
  }

  let finishSummary = "夜の完了ログを待機中です🦁🌙";
  const finishMatch = body.match(/###\s*(?:🧠\s*)?思考と感情のログ[\s\S]*?(?=(?:##|↓|$))/i);
  if (finishMatch) {
    const logText = finishMatch[0].replace(/###\s*(?:🧠\s*)?思考と感情のログ/i, '').replace(/^[*\s・(（何があったか.*）)]+/gm, '').trim();
    if (logText.length > 10) {
      if (hasNightBrief) {
        finishSummary = logText.slice(0, 350) + (logText.length > 350 ? "..." : "");
      } else {
        finishSummary = "【🌙 夜の完了(/today-finish) 待機中】\n💡 本日ここまでの思考・音声メモストック:\n" + logText.slice(0, 320) + (logText.length > 320 ? "..." : "");
      }
    }
  }

  return {
    status: "success",
    date: todayStr || "",
    fileName: fileName || "",
    startSummary: startSummary,
    briefing: briefing,
    suggestions: suggestions,
    big3: big3,
    finishSummary: finishSummary,
    finishFeedback: finishFeedback,
    xPost: ""
  };
}

/**
 * JSON レスポンス生成ヘルパー (CORS 対応)
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
