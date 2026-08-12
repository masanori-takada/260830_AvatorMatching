/* =========================================================================
   AIアバター自動マッチング PoCデモ
   依存ライブラリなし / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  /* ===== 端末枠のスケーリング ===== */
  // ビューポートが 375x812 に満たない環境では .phone を縮小して収める
  function fitPhone() {
    var scale = Math.min(
      1,
      (window.innerHeight - 24) / 812,
      (window.innerWidth - 24) / 375
    );
    document.documentElement.style.setProperty('--phone-scale', String(Math.max(0.3, scale)));
  }

  /* ===== 初期化 ===== */
  function init() {
    fitPhone();
    window.addEventListener('resize', fitPhone);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
