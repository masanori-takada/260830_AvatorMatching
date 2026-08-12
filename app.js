/* =========================================================================
   AIアバター自動マッチング PoCデモ
   依存ライブラリなし / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     固定データ
     ======================================================================= */

  var STORAGE_KEY = 'avatarMatchingDemo.v1';

  // インタビュー設問(選択式4問+自由記述2問)
  var QUESTIONS = [
    { id: 'q1', type: 'choice', text: '休日の過ごし方に近いのはどちらですか?',
      options: ['外に出かけて人と会う', '家でゆっくり自分の時間', '日によって半々くらい'] },
    { id: 'q2', type: 'choice', text: '初対面の人と話すとき、あなたは?',
      options: ['自分から話しかける方', '相手が話すのを聞く方', '場の空気を見て決める'] },
    { id: 'q3', type: 'free', text: '最近、思わず時間を忘れて夢中になったことは何ですか?' },
    { id: 'q4', type: 'choice', text: '一緒にいて心地よいと感じるのは、どんな人ですか?',
      options: ['笑いのツボが合う人', '価値観や考え方が近い人', '自分にない視点をくれる人'] },
    { id: 'q5', type: 'choice', text: '将来について、今の気持ちに近いのは?',
      options: ['具体的に考えている', 'なんとなく考えている', 'まだこれから考えたい'] },
    { id: 'q6', type: 'free', text: '相手に、これだけは知っておいてほしいことはありますか?' }
  ];

  // NPC(固定の相手候補)
  var PARTNER = {
    anonymousLabel: 'お相手 A さん',
    compatibility: 82,
    conversation: {
      timeLabel: '昨夜 2:14 – 2:17 の会話より抜粋',
      turns: [
        { speaker: 'self',    text: 'こんばんは。夜遅くにすみません。休日は外に出るより、家でゆっくりしている方が多いみたいですね。' },
        { speaker: 'partner', text: 'こんばんは。そうなんです。人と会うのは好きなんですが、週末はいったん静かにしないと次の週が持たなくて。' },
        { speaker: 'self',    text: '分かります。うちの人も同じことを言っていました。ちなみに、最近何かに夢中になったことはありますか。' },
        { speaker: 'partner', text: '短い文章を書くのにハマっています。誰に見せるわけでもないんですけど、書いていると気持ちが整理されて。' },
        { speaker: 'self',    text: 'それ、いいですね。うちの人は写真を撮るのが好きで、たぶん似た感覚だと思います。残しておきたい、みたいな。' },
        { speaker: 'partner', text: '確かに近いかもしれません。あと、笑いのツボが合う人だとすごく楽だなと思います。真面目な話ばかりだと疲れてしまって。' },
        { speaker: 'self',    text: 'そこも重なりそうです。ただ、うちの人は将来のことをかなり具体的に考えているタイプなんですが、そのあたりはどうでしょう。' },
        { speaker: 'partner', text: '正直、私はまだこれから考えたい段階です。焦って決めたくない、という感じでしょうか。' },
        { speaker: 'self',    text: 'なるほど。そこは温度差がありますね。ただ、方向が違うわけではなさそうなので、話しながら合わせていけそうです。' }
      ]
    },
    axes: [
      { key: 'flow', label: '会話の弾み', score: 88, invertedGood: false,
        comment: '沈黙がなく、互いに話題を足し合っていました。',
        quote: '「分かります。ちなみに、最近何かに夢中になったことはありますか。」' },
      { key: 'values', label: '価値観の一致', score: 84, invertedGood: false,
        comment: '休日の過ごし方や、大切にしたい時間の使い方が重なっています。',
        quote: '「週末はいったん静かにしないと次の週が持たなくて。」' },
      { key: 'humor', label: 'ユーモアの相性', score: 79, invertedGood: false,
        comment: '軽さを求める姿勢が一致。実際の笑いの相性は対面での確認が必要です。',
        quote: '「笑いのツボが合う人だとすごく楽だなと思います。」' },
      { key: 'interest', label: '相互関心', score: 86, invertedGood: false,
        comment: '一方的にならず、双方が相手に質問を返していました。',
        quote: '「短い文章を書くのにハマっています。」' },
      { key: 'conflict', label: '不一致の重大度', score: 24, invertedGood: true,
        comment: '将来設計の温度差はありますが、方向性の対立ではありません。',
        quote: '「正直、私はまだこれから考えたい段階です。」' }
    ],
    summary: '価値観と生活リズムの重なりが大きく、会話のテンポも自然でした。相違点はありますが、関係を妨げるほどではありません。',
    revealed: {
      name: '山田 花子(仮名)',
      company: '株式会社カリヤ精機',
      department: '品質保証部',
      ageRange: '30代前半',
      message: '文章を書くのが好きです。よろしくお願いします。'
    },
    slots: [
      { id: 'slot1', label: '9月5日(土) 13:00 – 14:00', place: '刈谷市内 カフェ' },
      { id: 'slot2', label: '9月6日(日) 11:00 – 12:00', place: '刈谷市内 カフェ' },
      { id: 'slot3', label: '9月12日(土) 15:00 – 16:00', place: '刈谷駅前 ラウンジ' }
    ]
  };

  // お知らせ
  var NOTIFICATIONS = [
    { id: 'n1', icon: 'bell', title: '新しいマッチ候補がいます',
      body: '相性基準を満たしたペアが見つかりました。', time: '2時間前', target: 'report' },
    { id: 'n2', icon: 'doc', title: '相性レポートが準備できました',
      body: '会話ログと相性レポートを確認できます。', time: '5時間前', target: 'report' }
  ];

  // 5段階ステップインジケーター
  var STEPS = [
    { label: '登録完了',             icon: 'i-check' },
    { label: 'インタビュー完了',     icon: 'i-chat' },
    { label: 'アバターが会話中',     icon: 'i-avatar-pair' },
    { label: '相性が高い時に通知',   icon: 'i-bell' },
    { label: '会話ログを読んで判断', icon: 'i-doc' }
  ];

  /* =======================================================================
     状態管理と永続化
     ======================================================================= */

  var INITIAL_STATE = {
    version: 1,                 // 保存形式のバージョン。不一致時は初期化
    currentScreen: 'invite',    // 現在表示中の画面名
    inviteCode: '',             // 入力された招待コード(検証はしない)
    registered: false,          // 招待コード登録済みか
    answers: [],                // インタビュー回答 [{ id, question, answer, type }]
    interviewDone: false,       // 全6問の回答完了フラグ
    notified: false,            // マッチ通知が発生済みか
    readNotificationIds: [],    // 既読のお知らせID
    decision: null,             // null | 'accept' | 'decline'
    selectedSlotId: null,       // 選択した面談候補日時のID
    scheduled: false,           // 日程調整を送信済みか
    notificationsEnabled: true  // 設定画面のトグル(表示のみ)
  };

  var state = clone(INITIAL_STATE);
  var waitingTimer = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // localStorage が使えない環境(プライベートモード等)でも例外でデモを止めない
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* メモリ上の state のみで動作を継続する */
    }
  }

  function loadState() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return clone(INITIAL_STATE);
    }
    if (!raw) { return clone(INITIAL_STATE); }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    // 破損 / バージョン不一致 → キーを消して初期状態から開始
    if (!parsed || typeof parsed !== 'object' || parsed.version !== INITIAL_STATE.version) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e2) { /* 無視 */ }
      return clone(INITIAL_STATE);
    }
    // 欠けたキーは初期値で補う
    var next = clone(INITIAL_STATE);
    Object.keys(next).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) { next[key] = parsed[key]; }
    });
    return next;
  }

  function resetDemo() {
    clearWaitingTimer();
    hideToast();
    closeSheet();
    hideLoading();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 無視 */ }
    state = clone(INITIAL_STATE);
    saveState();
    showScreen('invite');
  }

  // ステップインジケーターの状態は state から算出する(重複した状態を持たない)
  function currentStepIndex(s) {
    if (s.decision) { return 4; }       // 会話ログを読んで判断
    if (s.notified) { return 3; }       // 相性が高い時に通知
    if (s.interviewDone) { return 2; }  // アバターが会話中
    if (s.registered) { return 1; }     // インタビュー完了
    return 0;                           // 登録完了
  }

  function clearWaitingTimer() {
    if (waitingTimer !== null) {
      clearTimeout(waitingTimer);
      waitingTimer = null;
    }
  }

  /* =======================================================================
     DOMヘルパー
     ======================================================================= */

  function el(id) { return document.getElementById(id); }

  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  /* =======================================================================
     画面遷移
     ======================================================================= */

  var renderers = {};

  function showScreen(name) {
    // 未登録の状態で後続画面へ入られた場合は招待コード画面へ戻す
    if (!state.registered && name !== 'invite') { name = 'invite'; }

    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (!target) { return; }

    // 待機画面から離れるときはタイマーを止める
    if (name !== 'waiting') { clearWaitingTimer(); }

    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('is-active'); }
    target.classList.add('is-active');

    state.currentScreen = name;
    saveState();

    el('viewport').scrollTop = 0;

    if (renderers[name]) { renderers[name](); }

    updateChrome(name);

    var head = target.querySelector('[data-autofocus]') || target;
    head.focus({ preventScroll: true });
  }

  /* =======================================================================
     共通シェル(ヘッダー / タブバー / トースト / 確認シート / ローディング)
     ======================================================================= */

  // ヘッダーと下部タブバーを出さない画面(オンボーディングの一本道感を出す)
  var CHROME_HIDDEN_SCREENS = ['invite', 'interview'];

  // 画面名 → アクティブにする下部タブ
  var TAB_FOR_SCREEN = {
    home: 'home',
    mypage: 'mypage',
    notifications: 'messages',
    profile: 'profile'
  };

  function updateChrome(name) {
    var showChrome = state.registered && CHROME_HIDDEN_SCREENS.indexOf(name) === -1;
    el('appHeader').hidden = !showChrome;
    el('tabBar').hidden = !showChrome;

    var activeTab = TAB_FOR_SCREEN[name] || null;
    var tabs = el('tabBar').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].getAttribute('data-tab') === activeTab;
      tabs[i].classList.toggle('is-active', isActive);
      if (isActive) { tabs[i].setAttribute('aria-current', 'page'); }
      else { tabs[i].removeAttribute('aria-current'); }
    }

    updateBellBadge();
  }

  function unreadCount() {
    return NOTIFICATIONS.filter(function (n) {
      return state.readNotificationIds.indexOf(n.id) === -1;
    }).length;
  }

  function updateBellBadge() {
    var count = state.notified ? unreadCount() : 0;
    var badge = el('bellBadge');
    badge.textContent = String(count);
    badge.hidden = count === 0;
    el('bellButton').setAttribute('aria-label', count > 0 ? 'お知らせ 未読' + count + '件' : 'お知らせ');
  }

  function markNotificationRead(id) {
    if (state.readNotificationIds.indexOf(id) === -1) {
      state.readNotificationIds.push(id);
      saveState();
    }
    updateBellBadge();
  }

  /* ----- トースト(通知バナー) ----- */

  var toastTimer = null;
  var toastHideTimer = null;

  function showToast(text, onTap) {
    // 直前の非表示タイマーが後から発火して新しいトーストを隠すレースを防ぐ
    clearTimeout(toastHideTimer);
    var toast = el('toast');
    var button = el('toastButton');
    button.querySelector('.toast__text').textContent = text;
    toast.hidden = false;
    // hidden 解除の直後にクラスを付けてスライドインさせる
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    button.onclick = function () {
      hideToast();
      if (onTap) { onTap(); }
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    var toast = el('toast');
    toast.classList.remove('is-visible');
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(function () { toast.hidden = true; }, 300);
  }

  /* ----- 確認シート(window.confirm は使わない) ----- */

  var sheetOnConfirm = null;

  function openSheet(options) {
    el('sheetTitle').textContent = options.title;
    el('sheetMessage').textContent = options.message;
    var confirmButton = el('sheetConfirm');
    confirmButton.textContent = options.confirmLabel;
    confirmButton.classList.toggle('is-danger', options.danger === true);
    sheetOnConfirm = options.onConfirm || null;
    el('sheet').hidden = false;
    el('sheetTitle').focus({ preventScroll: true });
  }

  function closeSheet() {
    el('sheet').hidden = true;
    sheetOnConfirm = null;
  }

  /* ----- ローディング演出 ----- */

  function showLoading(text) {
    el('loadingText').textContent = text;
    el('loading').hidden = false;
  }

  function hideLoading() {
    el('loading').hidden = true;
  }

  function initShell() {
    el('bellButton').addEventListener('click', function () { showScreen('notifications'); });
    el('sheetCancel').addEventListener('click', closeSheet);
    el('sheetBackdrop').addEventListener('click', closeSheet);
    el('sheetConfirm').addEventListener('click', function () {
      var callback = sheetOnConfirm;
      closeSheet();
      if (callback) { callback(); }
    });
  }

  /* =======================================================================
     [1] 招待コード入力画面
     ======================================================================= */

  renderers.invite = function () {
    var input = el('inviteInput');
    input.value = state.inviteCode || '';
    input.classList.remove('is-error');
    el('inviteError').hidden = true;
  };

  function submitInviteCode() {
    var input = el('inviteInput');
    var value = input.value.trim();

    // 唯一のバリデーション: 空欄または空白のみは通さない
    if (value === '') {
      el('inviteError').hidden = false;
      input.classList.add('is-error');
      input.focus();
      return;
    }

    // 空欄でなければ、どんな文字列でも通す(形式・長さ・大文字小文字の検証は行わない)
    state.inviteCode = value;
    state.registered = true;
    saveState();
    showScreen('interview');
  }

  function initInviteScreen() {
    var input = el('inviteInput');

    input.addEventListener('input', function () {
      el('inviteError').hidden = true;
      input.classList.remove('is-error');
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { submitInviteCode(); }
    });

    el('inviteSubmit').addEventListener('click', submitInviteCode);
  }

  /* =======================================================================
     ブラウザ離脱防止ガード(§7.2)
     画面遷移に履歴APIは使わない。戻る/スワイプバックでの離脱のみを防ぐ
     ======================================================================= */

  function installBackGuard() {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', function () {
      history.pushState(null, '', location.href);
    });
  }

  /* =======================================================================
     端末枠のスケーリング
     ======================================================================= */

  function fitPhone() {
    var scale = Math.min(
      1,
      (window.innerHeight - 24) / 812,
      (window.innerWidth - 24) / 375
    );
    document.documentElement.style.setProperty('--phone-scale', String(Math.max(0.3, scale)));
  }

  /* =======================================================================
     初期化
     ======================================================================= */

  function init() {
    state = loadState();

    fitPhone();
    window.addEventListener('resize', fitPhone);
    // file:// 等の環境では history.pushState が SecurityError を投げることがある。
    // ここで例外を握りつぶし、離脱防止ガードが使えなくてもアプリ本体は起動できるようにする。
    try { installBackGuard(); } catch (e) {}
    try { initShell(); } catch (e) {}
    initInviteScreen();

    // data-go="画面名" を持つ要素は共通で画面遷移する
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-go]');
      if (trigger) { showScreen(trigger.getAttribute('data-go')); }
    });

    showScreen(state.currentScreen || 'invite');
  }

  // 展示会での緊急操作用
  window.__demo = {
    reset: resetDemo,
    showScreen: showScreen,
    get state() { return state; }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
