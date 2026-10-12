// Kansho — 対象サイト（SNS）のアダプタ（基盤層）。
// クイズと同様の登録制。各サイトが「どのページを・どの単位でロックするか」を
// 定義し、基盤（host.js）はサイト固有の事情を知らずに委譲する。
//
//   spec.id     : 一意なID（選択パネル・storage の enabledSites と対応）
//   spec.title  : 選択パネルでの表示名
//   spec.match  : function(hostname) → このサイトのページか
//   spec.lockId : function(href) → ロック対象なら一意なID文字列、対象外ページなら null
//   spec.isAd   : (任意) function(video) → その <video> が広告再生中か。
//                 広告は止めずに消音で流しきる（止めると解除後に結局見せられるため）
//   spec.adWatch: (任意) 広告の開始／終了でクラスが変わる要素のセレクタ。
//                 そのクラス変化を監視して、広告の消音・広告明けの停止を即座に行う
//
// 解除は「site.id + ":" + lockId」の単位で、タブのセッション中だけ保持される
// （sessionStorage。タブを閉じて開き直すと再出題）。
// YouTube は動画単位、他のSNSはサイト全体を1つの単位としてロックする。
(function () {
  "use strict";

  var K = window.Kansho || (window.Kansho = {});
  K.sites = K.sites || {}; // id -> site spec

  K.registerSite = function (spec) {
    if (!spec || !spec.id || typeof spec.match !== "function" ||
        typeof spec.lockId !== "function") {
      throw new Error("Kansho.registerSite: id / match(hostname) / lockId(href) が必要です");
    }
    K.sites[spec.id] = spec;
  };

  // 現在のホストに対応する「有効な」サイトを返す。
  // enabledSites（選択パネルの保存値）が未設定なら YouTube のみ（従来どおり）。
  K.getActiveSite = function (hostname) {
    var enabled = K.config.enabledSites;
    if (!enabled || !enabled.length) enabled = ["youtube"];
    for (var i = 0; i < enabled.length; i++) {
      var s = K.sites[enabled[i]];
      if (s && s.match(hostname)) return s;
    }
    return null;
  };

  function hostIs(hostname, domain) {
    return hostname === domain || hostname.slice(-(domain.length + 1)) === "." + domain;
  }

  // ---- YouTube: 動画ページ（/watch, /shorts）を動画単位でロック ------------
  K.registerSite({
    id: "youtube",
    title: "YouTube",
    match: function (h) { return hostIs(h, "youtube.com"); },
    lockId: function (href) {
      try {
        var u = new URL(href);
        if (u.pathname === "/watch") {
          var v = u.searchParams.get("v");
          return v ? "v:" + v : null;
        }
        var m = u.pathname.match(/^\/shorts\/([^/?#]+)/);
        if (m) return "s:" + m[1];
        return null;
      } catch (e) {
        return null;
      }
    },
    // 広告中はプレーヤー（通常・ショートとも .html5-video-player）に
    // ad-showing クラスが付く。広告も本編と同じ <video> 要素で再生される。
    adWatch: ".html5-video-player",
    isAd: function (video) {
      return !!(video.closest && video.closest(".html5-video-player.ad-showing"));
    }
  });

  // ---- サイト全体をロックする系（どのページでも同じ1単位） -----------------
  function wholeSite(id, title, domains) {
    K.registerSite({
      id: id,
      title: title,
      match: function (h) {
        for (var i = 0; i < domains.length; i++) {
          if (hostIs(h, domains[i])) return true;
        }
        return false;
      },
      lockId: function () { return "site"; }
    });
  }

  wholeSite("x", "X (Twitter)", ["x.com", "twitter.com"]);
  wholeSite("facebook", "Facebook", ["facebook.com"]);
  wholeSite("instagram", "Instagram", ["instagram.com"]);
  wholeSite("tiktok", "TikTok", ["tiktok.com"]);
  wholeSite("reddit", "Reddit", ["reddit.com"]);
})();
