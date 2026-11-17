/* 2026-11-16 Claude Code: コレクションサイト v2(夜空 + 星座 + 金の線)。外部ライブラリなし(3D を開いたときだけ v2/render3d.js = three.js を読む)。
   ルート(hash、今までと同じ形 + 新しいもの):
     #/  #/g/<gacha>/                      ホーム(注目の排出をステージに・最近の排出・ランキング・排出率・ギフト)
     #/g/<gacha>/u/<user>                  コレクション(仮想化グリッド)   ?g=<国> &rk=<ランク> &r=<レア度>
     #/g/<gacha>/u/<user>/i/<item>         アイテムの詳細(中央に大きく・左上にガラスの情報・右に丸い一覧)
     (r2: 星座の画面はなくした。国ごとの進み具合はコレクションの国のボタンに細い線で)
     #/g/<gacha>/u/<user>/showcase         ショーケース(画像を作る。v1 と同じ)
     #/g/<gacha>/dex   #/g/<gacha>/i/<item> 図鑑(ユーザーなし)
     #/u/<user>  #/help
   アイテムの表示(items/<gacha>.lite.json の kind / display):
     kind: "vehicle"(既定) | "character"
     display: {type: "image"(既定) | "live2d" | "gltf" | "simple3d", src, poster, scale, offset:[x%,y%]}
     → RENDERERS[type](wrap, d, item, S) がひとつの入口。image は今すぐ、gltf/simple3d は three.js を遅延読み込み、live2d はポスター + TODO。 */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rafT = f => { let q = 0; return () => { if (!q){ q = 1; requestAnimationFrame(() => { q = 0; f(); }); } }; };
const VER = ((document.currentScript && document.currentScript.src.match(/[?&]v=([^&]+)/)) || [])[1] || '0';
const V2 = 'v2/';
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
let REDUCED = RMQ.matches;
const PHONE = matchMedia('(max-width: 760px)');
const setRM = () => document.documentElement.classList.toggle('rm', REDUCED);
setRM(); RMQ.addEventListener && RMQ.addEventListener('change', e => { REDUCED = e.matches; setRM(); });
const LOGIN_ON = ($('meta[name="site-login"]') || {}).content === '1';

/* ===================== i18n ===================== */
const I = {
  ja: {home:'ホーム', coll:'コレクション', dex:'図鑑', show:'ショーケース', login:'ログイン', help:'IDの調べ方',
    search_ph:'@ユーザー名 または 数字のユーザーID', search:'コレクションを見る', featured:'注目の排出', recent:'最近の排出', leader:'コレクターランキング',
    rates:'排出率', gifts:'ギフトと連数', unique:'ユニーク所持', pulls:'総排出', comp:'達成率', notfound:'まだ記録がありません。配信でギフトを送るとここに登録されます。',
    nation:'国', type:'種類', rank:'ランク', br:'BR', tier:'入手', drop:'排出率', owned:'所持', first:'初入手', last:'最終', not_owned:'未所持', ended:'排出終了',
    all:'すべて', owned_only:'所持のみ', sort:'並び', s_rar:'レア度', s_new:'新しい順', s_cnt:'所持数', s_rank:'ランク', s_name:'名前', find:'名前で絞り込み',
    kinds:'種', your_id:'あなたの数字ID(固定・変わりません)', bookmark:'このURLをブックマーク', all_gachas:'全ガチャのコレクション', open:'開く',
    new_acq:'最近の入手', back_coll:'コレクションに戻る', pulled_by:'引いた人', open_detail:'詳しく見る',
    fav_hint:'★ でショーケースのお気に入り(最大9個・この端末に保存)', lock_short:'所有者限定', feat_rule:'最近の排出(最大 100 回)から重複なしで 30 種。レア度の高い順、同じなら新しい順。SR・UR は持ち主以外にはシルエット。', swipe:'左右にスワイプで切り替え',
    lock_note:'このレア度は、持っている本人だけが画像と詳しい情報を見られます。', lock_login:'ログインすると、自分が持っているものは表示されます。', relogin:'ログインし直してください', vehicle:'兵器', character:'キャラクター', no_items:'該当なし',
    first_title:'はじめての方へ', first_ok:'わかった', first_body:'このサイトは、配信でギフトを送って引いたガチャのコレクションを見るサイトです。<br>自分のページは <b>@ユーザー名</b> か <b>数字のユーザーID</b> で開けます。@名は変更できるので、長く使うなら数字IDをブックマークしてください。',
    make:'画像を生成', download:'PNGを保存', share:'共有', story:'ストーリー 9:16', square:'正方形 1:1', cap_ph:'ひとこと(任意)', l2d:'Live2D は準備中(いまは静止画)', e3d:'3D を読み込めませんでした(静止画を表示)',
    help_html:`<h2>自分の数字のユーザーIDの調べ方</h2>
<p><b>いちばん簡単:</b>このサイトの検索欄に <b>@ユーザー名</b> を入れて開くと、ページ上部に数字IDが表示されます(ギフトを1回でも送ったことがある場合)。そのURL <code>/u/数字ID</code> をブックマークすれば、@名を変えても同じページが開けます。</p>
<p><b>自分で調べる方法:</b>TikTokアプリ内の設定画面には数字IDは表示されません(不確定情報)。パソコンのブラウザで自分のプロフィールページを開き、ページのソースから <code>"id":"数字"</code> を探す方法や、外部の「TikTok ID 検索」サービスで調べる方法があります。</p>
<p>数字IDはアカウント作成時に決まり、@ユーザー名を変更しても変わりません。</p>`},
  en: {home:'Home', coll:'Collection', dex:'Catalog', show:'Showcase', login:'Login', help:'Find your ID',
    search_ph:'@username or numeric user ID', search:'Open collection', featured:'Featured pulls', recent:'Recent pulls', leader:'Top collectors',
    rates:'Drop rates', gifts:'Gifts & rolls', unique:'Unique owned', pulls:'Total pulls', comp:'Completion', notfound:'No record yet. Send a gift on stream and you will appear here.',
    nation:'Nation', type:'Type', rank:'Rank', br:'BR', tier:'Source', drop:'Drop rate', owned:'Owned', first:'First', last:'Last', not_owned:'Not owned', ended:'No longer in the gacha',
    all:'All', owned_only:'Owned only', sort:'Sort', s_rar:'Rarity', s_new:'Newest', s_cnt:'Count', s_rank:'Rank', s_name:'Name', find:'Filter by name',
    kinds:'items', your_id:'Your numeric ID (permanent)', bookmark:'Bookmark this URL', all_gachas:'Collections in all gachas', open:'Open',
    new_acq:'Recently acquired', back_coll:'Back to collection', pulled_by:'Pulled by', open_detail:'Details',
    fav_hint:'★ marks showcase favourites (max 9, saved on this device)', lock_short:'Owner only', feat_rule:'Up to 30 distinct items from the latest pulls (max 100), rarest first, then newest. SR/UR show as silhouettes except to their owner.', swipe:'Swipe left/right to switch',
    lock_note:'Items of this rarity are visible in full only to their owner.', lock_login:'Log in to see the ones you own.', relogin:'Please log in again', vehicle:'Vehicle', character:'Character', no_items:'Nothing here',
    first_title:'Welcome', first_ok:'Got it', first_body:'This site shows your gacha collection, pulled by sending gifts on stream.<br>Open your page with your <b>@username</b> or your <b>numeric user ID</b>. Usernames can change, so bookmark the numeric-ID URL.',
    make:'Generate', download:'Save PNG', share:'Share', story:'Story 9:16', square:'Square 1:1', cap_ph:'Caption (optional)', l2d:'Live2D coming soon (still image for now)', e3d:'Could not load 3D (showing the still image)',
    help_html:`<h2>How to find your numeric TikTok user ID</h2>
<p><b>Easiest:</b> type your <b>@username</b> in the search box here. If you have ever sent a gift, your numeric ID is shown at the top of your page. Bookmark <code>/u/&lt;numeric ID&gt;</code> — it keeps working even if you rename your @username.</p>
<p><b>On your own:</b> the TikTok app settings do not show the numeric ID (unverified). On a desktop browser, open your profile page and search the page source for <code>"id":"…digits…"</code>, or use a third-party "TikTok ID lookup" service.</p>
<p>The numeric ID is assigned when the account is created and never changes.</p>`}
};
let LANG = (() => { try{ return localStorage.getItem('wtg_lang'); }catch(e){ return null; } })() || ((navigator.language || '').startsWith('ja') ? 'ja' : 'en');
const t = k => (I[LANG] || I.ja)[k] ?? I.ja[k] ?? k;
const t2 = k => (LANG === 'ja' ? I.en : I.ja)[k] ?? k;   // もう一方の言語(見出しの小さい文字)
const ls = {get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }, set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }};
const GROUP_N = {usa:['アメリカ','USA'],germany:['ドイツ','Germany'],ussr:['ソ連','USSR'],britain:['イギリス','Britain'],japan:['日本','Japan'],china:['中国','China'],italy:['イタリア','Italy'],france:['フランス','France'],sweden:['スウェーデン','Sweden'],israel:['イスラエル','Israel']};
const gn = c => (GROUP_N[c] || [c, c])[LANG === 'ja' ? 0 : 1];
const CAT_N = {ground:['陸','Ground'], air:['空','Air'], heli:['ヘリ','Heli'], naval:['海','Naval']};
const catN = c => (CAT_N[c] || [c, c])[LANG === 'ja' ? 0 : 1];
const CLS_N = {exp_fighter:['戦闘機','Fighter'],exp_tank:['中戦車','Medium tank'],exp_assault:['攻撃機','Strike aircraft'],exp_bomber:['爆撃機','Bomber'],exp_tank_destroyer:['駆逐戦車','Tank destroyer'],
  exp_cruiser:['巡洋艦','Cruiser'],exp_SPAA:['自走対空砲','SPAA'],exp_destroyer:['駆逐艦','Destroyer'],exp_helicopter:['ヘリコプター','Helicopter'],exp_heavy_tank:['重戦車','Heavy tank'],
  exp_torpedo_boat:['魚雷艇','Torpedo boat'],exp_gun_boat:['砲艇','Gunboat'],exp_torpedo_gun_boat:['魚雷砲艇','Torpedo gunboat'],exp_submarine_chaser:['駆潜艇','Sub chaser'],exp_naval_ferry_barge:['輸送艇','Ferry barge'],exp_light_tank:['軽戦車','Light tank']};
const clsN = c => c ? (CLS_N[c] || [c.replace(/^exp_/, ''), c.replace(/^exp_/, '')])[LANG === 'ja' ? 0 : 1] : '';
const TIER_N = {tree:['研究ツリー','Tech tree'], premium:['プレミアム','Premium'], squadron:['分隊','Squadron'], event:['イベント','Event']};
const tierN = c => c ? (TIER_N[c] || [c, c])[LANG === 'ja' ? 0 : 1] : '';
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const fmtTs = ts => ts ? new Date(ts * 1000).toLocaleString(LANG === 'ja' ? 'ja-JP' : 'en-US', {year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '—';
const fmtPct = p => p >= 1 ? p.toFixed(p >= 10 ? 0 : 1) + '%' : p >= 0.1 ? p.toFixed(2) + '%' : p >= 0.001 ? p.toFixed(3) + '%' : p.toPrecision(2) + '%';
const oneIn = p => p > 0 ? '1/' + Math.round(100 / p).toLocaleString() : '—';
const hd = (k, extra = '') => `<h2 class="hd st" style="--i:${extra || 0}"><i></i><span>${esc(t(k))}<small>${esc(t2(k)).toUpperCase()}</small></span><i></i></h2>`;

/* ===================== icons(自作の線のアイコン) ===================== */
const IC = {
  home:'<path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5"/><path d="M12 7.6l1 1.4-1 1.4-1-1.4z" fill="currentColor"/>',
  coll:'<path d="M7 3.5l3.5 3.5L7 10.5 3.5 7zM17 3.5l3.5 3.5-3.5 3.5L13.5 7zM7 13.5l3.5 3.5L7 20.5 3.5 17zM17 13.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>',
  dex:'<path d="M12 6.5C9.5 4.8 6.5 4.5 3.5 5v13.5c3-.5 6 0 8.5 1.5 2.5-1.5 5.5-2 8.5-1.5V5c-3-.5-6-.2-8.5 1.5zM12 6.5V20"/>',
  show:'<rect x="3.5" y="6" width="17" height="13" rx="1.5"/><path d="M8.5 6l1.5-2.5h4L15.5 6"/><circle cx="12" cy="12.5" r="3.3"/>',
  login:'<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  help:'<path d="M12 2.8 21.2 12 12 21.2 2.8 12z"/><path d="M10 9.7c.3-1.3 1.1-1.9 2.1-1.9 1.2 0 2.1.8 2.1 1.9 0 1.6-2.2 1.6-2.2 3.4"/><circle cx="12" cy="15.8" r=".6" fill="currentColor"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 3.5 2 3.5H5"/>', type:'<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="7.5"/>', rank:'<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>',
  br:'<path d="M4 18h16M6 18V10M10 18V6M14 18v-5M18 18V8"/>', tier:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>', drop:'<path d="M12 3c3.5 4.5 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.5 12 3z"/>',
  own:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', lock:'<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>', time:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>', user:'<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>'
};
const ico = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k] || ''}</svg>`;
const STAR = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9z" fill="currentColor"/></svg>';
// r2: 彫りの輪(自作)。中央の表示の後ろでゆっくり回る
const RING = `<svg class="ring" viewBox="-310 -310 620 620" fill="none" stroke="#e9cf86" stroke-width=".7" aria-hidden="true"><g class="rot"><circle r="300"/><circle r="272" stroke-dasharray="2 6"/><circle r="205" opacity=".45"/>
  <g opacity=".75">${Array.from({length: 60}, (_, k) => `<line x1="0" y1="-300" x2="0" y2="${k % 5 ? -291 : -282}" transform="rotate(${k * 6})"/>`).join('')}</g>
  <path d="M0 -312 6 -300 0 -288 -6 -300Z M0 312 6 300 0 288 -6 300Z M-312 0-300 6-288 0-300-6Z M312 0 300 6 288 0 300-6Z" fill="#e9cf86" stroke="none"/></g></svg>`;
const PED = `<svg viewBox="-200 -50 400 100" aria-hidden="true"><defs><radialGradient id="pg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e6c27a" stop-opacity=".28"/><stop offset="1" stop-color="#e6c27a" stop-opacity="0"/></radialGradient></defs>
  <ellipse rx="190" ry="38" fill="url(#pg)"/><g transform="scale(1 .2)"><g class="rot"><circle r="185" fill="none" stroke="#e6c27a" stroke-opacity=".55" stroke-width="2"/><circle r="168" fill="none" stroke="#e6c27a" stroke-opacity=".25" stroke-width="1" stroke-dasharray="4 10"/>
  ${Array.from({length:12}, (_, i) => `<path transform="rotate(${i * 30}) translate(0 -185)" d="M0 -9 6 0 0 9 -6 0z" fill="#e6c27a" fill-opacity="${i % 3 ? .45 : .9}"/>`).join('')}</g></g></svg>`;

/* ===================== data(site_export の JSON をそのまま) ===================== */
const _c = {};
const J = p => (_c[p] ||= fetch(p, {cache:'no-cache'}).then(r => r.ok ? r.json() : null).catch(() => null));
let GJ = null;
const gachas = async () => GJ ||= (await J('gachas.json')) || {gachas: [], configs: {}};
const GS = {};
const RTHEME = {C:{n:1, medal:'C'}, R:{n:2, medal:'R'}, SR:{n:3, medal:'SR'}, UR:{n:4, medal:'UR', holo:true}};
async function useG(id){
  const G = await gachas();
  id = id || G.active || (G.gachas[0] || {}).id;
  if (!id || !G.configs[id]) return null;
  if (GS[id]) return GS[id];
  const cfg = G.configs[id], lite = await J('items/' + encodeURIComponent(id) + '.lite.json');
  if (!lite) return null;
  const cols = lite.cols, items = lite.items.map(row => { const o = {}; cols.forEach((c, i) => { if (row[i] != null) o[c] = row[i]; }); o.kind = o.kind || 'vehicle'; return o; });
  const by = {}; items.forEach(v => by[v.id] = v);
  const RAR = (cfg.rarities || []).map(r => r.key), RB = Object.fromEntries((cfg.rarities || []).map(r => [r.key, r]));
  const pool = items.filter(v => v.pool);
  const pbr = {}; pool.forEach(v => pbr[v.rarity] = (pbr[v.rarity] || 0) + 1);
  const w = cfg.rarity_weights || Object.fromEntries((cfg.rarities || []).map(r => [r.key, r.weight || 0]));
  const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const S = GS[id] = {id, cfg, RAR, RB, items, by, pool, poolIds: new Set(pool.map(v => v.id)), pbr, w, tot, imgPat: lite.img_pat || '',
    prot: new Set(cfg.site_protect || lite.protect || [])};
  await ownerLoad(S);
  return S;
}
// r2: 守るレア度(既定 SR・UR)は、公開のデータには名前・レア度・数だけ。ログインした本人が持っているものだけ、Worker から全部の項目と本物の画像を受け取る
const API = (() => { const m = $('meta[name="login-api"]'); const v = m && m.content; return v && !v.includes('{{') ? v.replace(/\/$/, '') : ''; })();
let OWNER_ERR = '';
async function ownerLoad(S){
  const s = loginState(); if (!s || !s.session || !API || !S.prot.size) return;
  try{
    const r = await fetch(API + '/owned?g=' + encodeURIComponent(S.id), {headers: {Authorization: 'Bearer ' + s.session}});
    if (r.status === 401){ OWNER_ERR = 'session'; return; }
    const d = await r.json(); if (!d.ok) return;
    S.ownerKey = d.key;
    const cols = d.cols || [];
    for (const [id, row] of Object.entries(d.items || {})){
      if (!S.by[id]) continue;
      const o = {}; cols.forEach((c, i) => { if (row[i] != null) o[c] = row[i]; });
      o.kind = o.kind || 'vehicle'; o.img = '';
      Object.assign(S.by[id], o, {_full: true});
    }
  }catch(e){}
}
const isLocked = (S, v) => !!(S.prot && S.prot.has(v.rarity) && !v._full);
const isPA = (S, v) => !!(S.prot && S.prot.has(v.rarity) && v._full);
const silUrl = (S, v) => 'img/' + encodeURIComponent(S.id) + '/sil/' + encodeURIComponent(v.id) + '.webp';
const paKind = v => { const d = v.display || {}; return d.poster ? 'poster' : (d.src && (!d.type || d.type === 'image' || d.type === 'simple3d')) ? 'src' : 'img'; };
const PA = {c: new Map(), q: [], n: 0,   // 本物の画像(Worker から、本人のセッションで)。同時に 4 つまで
  url(g, i, k){ const key = g + '|' + i + '|' + k; if (!this.c.has(key)){ const pr = this.get(g, i, k); pr.catch(() => this.c.delete(key)); this.c.set(key, pr); } return this.c.get(key); },
  async get(g, i, k){ const s = loginState(); if (!s || !API) throw new Error('login');
    while (this.n >= 4) await new Promise(r => this.q.push(r));
    this.n++;
    try{ const r = await fetch(`${API}/asset/${encodeURIComponent(g)}/${encodeURIComponent(i)}/${k}`, {headers: {Authorization: 'Bearer ' + s.session}});
      if (!r.ok) throw new Error(String(r.status)); return URL.createObjectURL(await r.blob()); }
    finally{ this.n--; const f = this.q.shift(); if (f) f(); } }};
function hydrate(root){ if (!root) return; root.querySelectorAll('img[data-pa]').forEach(im => { const [g, i, k] = im.dataset.pa.split('|'); im.removeAttribute('data-pa');
  PA.url(g, i, k).then(u => { im.src = u; im.classList.remove('sil'); }).catch(() => {}); }); }
const rIdx = (S, r) => S.RAR.indexOf(r);
const rinfo = (S, r) => { const th = RTHEME[r] || {n: rIdx(S, r) + 1}; const rb = S.RB[r] || {}; return {...th, key: r, label: LANG === 'ja' ? (rb.label || r) : (rb.label_en || rb.label || r)}; };
const medal = (r, cls = '') => RTHEME[r] ? `<img class="${cls}" src="${V2}medal/${RTHEME[r].medal}_mini.png" alt="${esc(r)}" width="64" height="64">` : '';
const starsHtml = (S, r) => `<span class="stars r-${esc(r)}">${STAR.repeat(Math.max(1, rinfo(S, r).n))}</span>`;
const vname = v => (LANG === 'ja' || !v.name_en) ? (v.name || v.id) : v.name_en;
const vname2 = v => (LANG === 'ja' ? v.name_en : v.name) || '';
const imgUrl = (S, v) => 'img/' + encodeURIComponent(S.id) + '/' + encodeURIComponent(v.id) + '.webp';
const imgAlt = (S, v) => v.img != null ? v.img : (S.imgPat ? S.imgPat.replace('{id}', v.id) : '');
const isTall = (v) => v.kind === 'character' || (v.display && v.display.aspect === 'tall');
const flagHtml = v => { if (v.kind === 'character' || !v.group) return ''; const s = window.flagImg ? (() => { try{ return flagImg({country: v.group, operator: v.operator || ''}); }catch(e){ return ''; } })() : '';
  return `<i class="fl" data-c="${esc(v.group)}" data-o="${esc(v.operator || '')}">${s}</i>`; };
const dropPct = (S, v) => S.poolIds.has(v.id) ? ((S.w[v.rarity] || 0) / S.tot * 100) / Math.max(1, S.pbr[v.rarity] || 1) : 0;

window.v2ImgErr = img => {   // 画像: 1 サイトの WebP → 2 公式 URL → 3 シルエット + 「画像なし」
  const d = img.dataset;
  if (d.alt && !d.tried){ d.tried = '1'; img.src = d.alt; return; }
  const box = document.createElement('div'); box.className = 'noimg';
  box.innerHTML = ((window.SIL && d.k && SIL[d.k]) || '') + '<span>画像なし / No image</span>';
  const gl = img.parentElement && img.parentElement.querySelector('.glint'); if (gl) gl.remove();
  img.replaceWith(box);
};
const imgTag = (S, v, cls = '') => isLocked(S, v) ? `<img class="${cls} sil" loading="lazy" decoding="async" alt="" src="${esc(silUrl(S, v))}" onerror="this.style.visibility='hidden'">`
  : isPA(S, v) ? `<img class="${cls} sil" loading="lazy" decoding="async" alt="" src="${esc(silUrl(S, v))}" data-pa="${esc(S.id + '|' + v.id + '|' + paKind(v))}" onerror="this.style.visibility='hidden'">`
  : `<img class="${cls}" loading="lazy" decoding="async" alt="" src="${esc(dispOf(S, v).poster)}" data-alt="${esc(imgAlt(S, v))}" data-k="${esc(window.silKind ? silKind(v) : '')}" onerror="v2ImgErr(this)">`;

// users(v1 の静的モードと同じ探し方)
async function idxRows(h){ const ix = await J('users_index.json'); if (!ix) return [];
  if (!ix.shards) return ix.users || [];
  const ch = /^[a-z0-9]/.test(h) ? h[0] : '_', f = ix.shards[ch]; if (!f) return []; const sh = await J(f); return (sh && sh.users) || []; }
async function findUser(q){
  q = (q || '').trim(); const h = q.replace(/^@/, '').toLowerCase();
  if (/^[0-9]{1,30}$/.test(q)){ const d = await J('users/' + q + '.json'); if (d) return {d}; }
  const rows = await idxRows(h);
  const hit = rows.find(r => r[0] === h) || rows.find(r => r[1] === q) || rows.find(r => r[2] === q);
  if (hit){ const d = await J('users/' + encodeURIComponent(hit[1]) + '.json'); if (d) return {d}; }
  return {cand: h ? rows.filter(r => r[0].startsWith(h)).slice(0, 10).map(r => ({user_id: r[2], handle: r[3]})) : []};
}
const uidOf = u => u.user_id || ('@' + (u.handle || ''));
const upath = (gid, u, more = '') => `#/g/${encodeURIComponent(gid)}/u/${encodeURIComponent(u)}${more}`;
const loginState = () => { if (!LOGIN_ON) return null; try{ const s = JSON.parse(localStorage.getItem('tt_login') || 'null'); return s && s.exp > Date.now() / 1000 ? s : null; }catch(e){ return null; } };
function myUser(){ const s = loginState(); if (s && s.match && s.match.key) return s.match.key; return ls.get('wtg_last_u', ''); }

/* ===================== 表示の入口(レンダラー) ===================== */
function dispOf(S, v){
  if (isLocked(S, v)){ const u = silUrl(S, v); return {type: 'image', src: u, poster: u, alt: '', scale: 1, offset: [0, 0], tall: isTall(v), raw: {}, locked: true}; }
  const d = v.display || {}, type = d.type || 'image';
  if (isPA(S, v)){   // 本人: 本物は Worker から(mountDisplay で blob の URL にする)
    const src = 'pa:' + (d.src ? 'src' : 'img'), poster = 'pa:' + (d.poster ? 'poster' : (d.src && (type === 'image' || type === 'simple3d') ? 'src' : 'img'));
    return {type, src, poster, alt: '', scale: +d.scale || 1, offset: d.offset || [0, 0], tall: isTall(v), raw: d, pa: true};
  }
  const at = s => !s ? '' : (/^(https?:)?\/\//.test(s) || s.startsWith('/')) ? s : 'display/' + encodeURIComponent(S.id) + '/' + s.split('/').map(encodeURIComponent).join('/');
  const img = imgUrl(S, v);
  const src = d.src ? at(d.src) : img;
  return {type, src, poster: d.poster ? at(d.poster) : ((type === 'image' || type === 'simple3d') && d.src ? src : img), alt: imgAlt(S, v), scale: +d.scale || 1, offset: d.offset || [0, 0], tall: isTall(v), raw: d};
}
function imageR(wrap, d, v, S){
  const k = window.silKind ? silKind(v) : '';
  wrap.innerHTML = `<img class="main" alt="${esc(vname(v))}" src="${esc(d.poster || d.src)}" data-alt="${esc(d.alt)}" data-k="${esc(k)}" onerror="v2ImgErr(this)">` + (REDUCED ? '' : '<div class="glint"></div>');
  const im = wrap.querySelector('img.main'), gl = wrap.querySelector('.glint');
  if (d.scale !== 1 || d.offset[0] || d.offset[1]) im.style.transform = `translate(${+d.offset[0] || 0}%,${+d.offset[1] || 0}%) scale(${d.scale})`;
  // CSS 変数の url() は app.css から見た場所になるので絶対 URL に
  if (gl){ gl.style.setProperty('--m', `url("${new URL(d.poster || d.src, location.href).href.replace(/"/g, '%22')}")`); if (im.style.transform) gl.style.transform = im.style.transform; }
  return {destroy(){}};
}
const RENDERERS = {
  image: imageR,
  live2d(wrap, d, v, S){
    /* TODO(Live2D): Cubism Core のライセンス(本人が決める)が決まったら、ここで live2dcubismcore.min.js と描画ライブラリを
       遅延読み込みして d.src(model3.json)を描く。今は Cubism Core を同梱しない = ポスター画像 + 「準備中」の表示だけ。 */
    const h = imageR(wrap, {...d, src: d.poster}, v, S);
    wrap.insertAdjacentHTML('beforeend', `<div class="badge3d">LIVE2D</div><div class="todo">${esc(t('l2d'))}</div>`);
    return h;
  },
  gltf: (wrap, d, v, S) => three(wrap, d, v, S),
  simple3d: (wrap, d, v, S) => three(wrap, d, v, S)
};
async function three(wrap, d, v, S){
  imageR(wrap, {...d, src: d.poster || d.src}, v, S);
  wrap.insertAdjacentHTML('beforeend', '<div class="badge3d">3D</div>');
  let m;
  try{ m = await import(new URL(V2 + 'render3d.js?v=' + VER, location.href).href); }
  catch(e){ wrap.insertAdjacentHTML('beforeend', `<div class="todo">${esc(t('e3d'))}</div>`); return {destroy(){}}; }
  if (!wrap.isConnected) return {destroy(){}};
  return m.mount(wrap, d, {reduced: REDUCED, onFail: () => wrap.insertAdjacentHTML('beforeend', `<div class="todo">${esc(t('e3d'))}</div>`)});
}
async function mountDisplay(hold, S, v){
  const d = dispOf(S, v);
  if (d.pa){
    const res = async x => x && x.startsWith('pa:') ? PA.url(S.id, v.id, x.slice(3)).catch(() => silUrl(S, v)) : x;
    d.poster = await res(d.poster);
    d.src = d.type === 'live2d' ? d.poster : await res(d.src);
  }
  const wrap = document.createElement('div');
  wrap.className = 'itm' + (d.tall ? ' tall' : '') + (d.locked ? ' locked' : '') + (REDUCED ? '' : ' swap-in');
  hold.replaceChildren(wrap);
  const h = (RENDERERS[d.type] || imageR)(wrap, d, v, S);
  if (d.locked) wrap.insertAdjacentHTML('beforeend', `<div class="lockb">${ico('lock')}<span>OWNER ONLY</span></div>`);
  return h;
}

/* ===================== 仮想化グリッド(見えている行だけ DOM に置く・はじめて見えたカードだけ動かす) ===================== */
class VGrid {
  constructor(host, o){ this.h = host; this.o = o; this.items = []; this.m = new Map(); this.seen = new Set(); this.first = true;
    this._s = rafT(() => this.upd()); addEventListener('scroll', this._s, {passive: true});
    this.ro = new ResizeObserver(rafT(() => this.layout())); this.ro.observe(host); }
  set(items){ this.items = items; this.m.forEach(e => e.remove()); this.m.clear(); this.first = true; this.layout(); }
  layout(){
    const W = this.h.clientWidth; if (!W) return;
    const g = this.o.gap || 10, mn = PHONE.matches ? (this.o.minP || 132) : (this.o.min || 168);
    const cols = Math.max(2, Math.floor((W + g) / (mn + g))), cw = (W - (cols - 1) * g) / cols, rh = Math.round(cw / 2 + (this.o.extra || 52));
    if (cols !== this.cols || Math.abs(cw - (this.cw || 0)) > .5){ this.cols = cols; this.cw = cw; this.rh = rh; this.m.forEach(e => e.remove()); this.m.clear(); }
    const rows = Math.ceil(this.items.length / cols);
    this.h.style.height = (rows ? rows * (rh + g) - g : 0) + 'px';
    this.upd();
  }
  upd(){
    if (!this.cols || !this.h.isConnected) return;
    const r = this.h.getBoundingClientRect(), g = this.o.gap || 10, step = this.rh + g, vh = innerHeight, nrows = Math.ceil(this.items.length / this.cols);
    const a = Math.max(0, Math.floor((-r.top - vh * .3) / step)), b = Math.min(nrows - 1, Math.floor((-r.top + vh * 1.3) / step));
    const lo = a * this.cols, hi = Math.min(this.items.length - 1, (b + 1) * this.cols - 1);
    for (const [k, e] of this.m) if (k < lo || k > hi){ e.remove(); this.m.delete(k); }
    if (b < a) return;
    let n = 0; const fr = document.createDocumentFragment();
    for (let k = lo; k <= hi; k++){
      if (this.m.has(k)) continue;
      const it = this.items[k], e = this.o.render(it, k), row = Math.floor(k / this.cols), col = k % this.cols;
      e.style.left = col * (this.cw + g) + 'px'; e.style.top = row * step + 'px'; e.style.width = this.cw + 'px'; e.style.height = this.rh + 'px';
      const key = this.o.key(it);
      if (!this.seen.has(key)){ this.seen.add(key); if (!REDUCED){ e.classList.add('rv'); e.style.setProperty('--d', Math.min(n * (this.first ? 45 : 24), 900) + 'ms'); n++; } }
      fr.appendChild(e); this.m.set(k, e);
    }
    this.h.appendChild(fr); this.first = false; hydrate(this.h);
  }
  destroy(){ removeEventListener('scroll', this._s); this.ro.disconnect(); }
}
const el1 = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
function cardHtml(S, v, o = {}){
  const r = v.rarity, ri = rinfo(S, r), tall = isTall(v);
  const sub = o.sub != null ? o.sub : isLocked(S, v) ? rinfo(S, r).label + ' · ' + t('lock_short') : (v.kind === 'character' ? (v.group || '') : [gn(v.group), v.category ? catN(v.category) : '', v.rank ? ROMAN[v.rank] : '', v.br ? 'BR ' + v.br : ''].filter(Boolean).join(' · '));
  const lk = isLocked(S, v);
  return `<div class="cd r-${esc(r)}${ri.holo ? ' ur' : ''}${lk ? ' lk' : ''}${o.owned === false ? ' no' : ''}${o.isNew ? ' new' : ''}" data-id="${esc(v.id)}" tabindex="0" role="link" aria-label="${esc(vname(v))}">
    <div class="im${tall ? ' tall' : ''}">${imgTag(S, v, 'vi')}${medal(r, 'md')}${starsHtml(S, r)}${o.n > 1 ? `<span class="cnt">×${o.n}</span>` : ''}</div>
    <div class="tx"><div class="nm">${flagHtml(v)}${esc(vname(v))}</div><div class="sb">${esc(sub)}</div></div>
    ${o.fav != null && o.owned ? `<button class="fav${o.fav ? ' on' : ''}" type="button" data-fav aria-label="favorite">★</button>` : ''}<span class="newb">NEW</span></div>`;
}

/* ===================== 星空(1 枚のキャンバス。見えない・動きを減らす設定なら止める) ===================== */
function sky(){
  const cv = $('#sky'), g = cv.getContext('2d'); let W = 0, H = 0, stars = [], last = 0, run = true, px = 0, py = 0, shoot = null, nextShoot = 6000;
  function resize(){
    const dpr = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(320, Math.max(90, W * H / 4200)));
    let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    stars = Array.from({length: n}, () => ({x: rnd() * W, y: rnd() * H * 1.5, z: rnd() ** 2.2, tw: rnd() * 6.28, sp: .4 + rnd() * 1.4, gold: rnd() > .9}));
    draw(performance.now());
  }
  function draw(now){
    g.clearRect(0, 0, W, H);
    const sy = scrollY;
    for (const s of stars){
      const par = .03 + .22 * s.z;
      let y = (s.y - sy * par) % (H * 1.5); if (y < 0) y += H * 1.5; if (y > H + 4) continue;
      const x = s.x + px * (2 + 14 * s.z), a = (.25 + .75 * s.z) * (REDUCED ? .8 : (.62 + .38 * Math.sin(now * .001 * s.sp + s.tw))), r = .35 + 1.35 * s.z;
      g.globalAlpha = a; g.fillStyle = s.gold ? '#ffe3a3' : '#dfe6ff';
      if (r > 1.1){ g.beginPath(); g.arc(x, y + py * 8 * s.z, r, 0, 6.283); g.fill(); if (s.z > .82){ g.globalAlpha = a * .35; g.fillRect(x - r * 3, y - .25, r * 6, .5); g.fillRect(x - .25, y - r * 3, .5, r * 6); } }
      else g.fillRect(x, y + py * 8 * s.z, r * 1.6, r * 1.6);
    }
    if (shoot){ const k = (now - shoot.t) / 900; if (k > 1) shoot = null; else {
      const x = shoot.x + shoot.dx * k, y = shoot.y + shoot.dy * k, gr = g.createLinearGradient(x, y, x - shoot.dx * .25, y - shoot.dy * .25);
      gr.addColorStop(0, 'rgba(255,236,190,.9)'); gr.addColorStop(1, 'rgba(255,236,190,0)'); g.globalAlpha = 1 - k; g.strokeStyle = gr; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - shoot.dx * .25, y - shoot.dy * .25); g.stroke(); } }
    g.globalAlpha = 1;
  }
  function loop(now){
    if (!run) return;
    requestAnimationFrame(loop);
    if (now - last < 33) return;   // 30fps で十分(電池)
    last = now;
    if (!REDUCED && now > nextShoot && !shoot){ shoot = {t: now, x: Math.random() * W * .7 + W * .2, y: Math.random() * H * .3, dx: -W * .25, dy: H * .12}; nextShoot = now + 9000 + Math.random() * 9000; }
    draw(now);
  }
  addEventListener('resize', rafT(resize));
  addEventListener('scroll', rafT(() => { if (REDUCED) draw(performance.now()); }), {passive: true});
  if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', rafT(() => {}), {passive: true});
  addEventListener('pointermove', e => { if (REDUCED || !matchMedia('(pointer: fine)').matches) return; px = (e.clientX / W - .5); py = (e.clientY / H - .5); }, {passive: true});
  document.addEventListener('visibilitychange', () => { run = !document.hidden && !REDUCED; if (run) requestAnimationFrame(loop); });
  resize();
  run = !REDUCED; if (run) requestAnimationFrame(loop);
  RMQ.addEventListener && RMQ.addEventListener('change', () => { run = !REDUCED; if (run) requestAnimationFrame(loop); else draw(performance.now()); });
}

/* ===================== 枠(左のメニュー・ヘッダー) ===================== */
let CUR = {name: '', gid: ''};
function chrome(S){
  const gid = S ? S.id : '', mu = myUser();
  const items = [['home', `#/g/${encodeURIComponent(gid)}/`], ['coll', mu ? upath(gid, mu) : '#/?find=1'], ['dex', `#/g/${encodeURIComponent(gid)}/dex`]];
  if (LOGIN_ON) items.push(['login', 'login/']);
  items.push(['help', '#/help']);
  $('#rail').innerHTML = items.map(([k, h]) => `<a href="${h}" class="${CUR.name === k ? 'on' : ''}" aria-label="${esc(t(k))}">${ico(k)}<span class="tip">${esc(t(k))} · ${esc(t2(k))}</span><span class="lb">${esc(t(k))}</span></a>`).join('');
  gachas().then(G => { const gs = G.gachas || [];
    $('#gtabs').innerHTML = gs.length > 1 ? gs.map(g => `<a href="#/g/${encodeURIComponent(g.id)}/" class="${g.id === gid ? 'on' : ''}">${esc(LANG === 'ja' ? g.name : (g.name_en || g.name))}</a>`).join('') : ''; });
  const s = loginState();
  // r2b: アバターは TikTok の画像。読めない・無いときは @名の頭文字(金の丸)
  const un = (s && s.profile && (s.profile.username || s.profile.display_name)) || '', ini = (un.replace(/^@/, '')[0] || '★').toUpperCase();
  $('#me').innerHTML = !LOGIN_ON ? '' : s ? `<a class="mechip" href="${s.match && s.match.key ? upath(gid || 'wt', s.match.key) : 'login/'}" title="${esc(t('coll'))}"><span class="av"><b>${esc(ini)}</b>${s.profile && s.profile.avatar_url ? `<img src="${esc(s.profile.avatar_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span><span class="un">@${esc((s.profile || {}).username || '')}</span></a>`
    : `<a class="mechip out" href="login/">${esc(LANG === 'ja' ? 'TikTokでログイン' : 'Login with TikTok')}</a>`;
  $('#langBtn').textContent = LANG === 'ja' ? 'EN' : '日本語';
  document.documentElement.lang = LANG;
}

/* ===================== router(hash。画面の切り替えはフェード + スライド) ===================== */
let SEQ = 0, LEAVE = [];
const onLeave = f => LEAVE.push(f);
let LASTLIST = null;   // {ctx, ids} 一覧から詳細へ: 右の丸い一覧は同じ並び
async function route(){
  const seq = ++SEQ, alive = () => seq === SEQ;
  let p = location.hash.slice(1) || '/';
  const [path, qs] = p.split('?'); const Q = new URLSearchParams(qs || '');
  let parts; try{ parts = path.split('/').filter(Boolean).map(decodeURIComponent); }catch(e){ parts = []; }
  const view = $('#view'), old = view.firstElementChild;
  if (old && !REDUCED){ old.classList.add('out'); await sleep(170); }
  if (!alive()) return;
  LEAVE.forEach(f => { try{ f(); }catch(e){} }); LEAVE = [];
  const el = document.createElement('div'); el.className = 'v2v'; view.replaceChildren(el);
  scrollTo(0, 0);
  let name = 'home', S = null;
  try{
    if (parts[0] === 'help'){ name = 'help'; S = await useG(''); setChrome(name, S); return viewHelp(el); }
    if (parts[0] === 'u' && parts[1]){ name = 'coll'; S = await useG(''); setChrome(name, S); const G = await gachas(); if ((G.gachas || []).length > 1) return viewAll(el, parts[1], alive); return viewColl(el, S, parts[1], Q, alive); }
    if (parts[0] === 'g' && parts[1]){
      S = await useG(parts[1]); if (!S){ el.innerHTML = `<div class="empty">unknown gacha: ${esc(parts[1])}</div>`; return; }
      if (parts[2] === 'dex'){ setChrome('dex', S); return viewDex(el, S, Q, alive); }
      if (parts[2] === 'i' && parts[3]){ setChrome('dex', S); return viewItem(el, S, null, parts[3], alive); }
      if (parts[2] === 'u' && parts[3]){
        if (parts[4] === 'showcase'){ setChrome('coll', S); return viewShowcase(el, S, parts[3], alive); }
        if (parts[4] === 'i' && parts[5]){ setChrome('coll', S); return viewItem(el, S, parts[3], parts[5], alive); }
        setChrome('coll', S); return viewColl(el, S, parts[3], Q, alive);
      }
      setChrome('home', S); return viewHome(el, S, Q, alive);
    }
    S = await useG(''); setChrome('home', S); return viewHome(el, S, Q, alive);
  }catch(e){ console.error(e); el.innerHTML = `<div class="empty">error: ${esc(e.message)}</div>`; }
}
function setChrome(name, S){ CUR = {name, gid: S ? S.id : ''}; chrome(S); }
addEventListener('hashchange', route);
$('#langBtn').onclick = () => { LANG = LANG === 'ja' ? 'en' : 'ja'; ls.set('wtg_lang', LANG); route(); };

/* ===================== ステージ(詳細の画面: 中央に大きく、左上にガラスの情報、右に丸い一覧) ===================== */
function stage(host, S, list, idx, ctx){
  host.innerHTML = `<div class="stage"><div class="pnl glass orn"></div><div class="disp"><div class="glow"></div>${RING}<div class="ped">${PED}</div><div class="hold"></div></div><div class="ros" tabindex="-1"><div class="sp"></div></div></div>`;
  const pnl = $('.pnl', host), disp = $('.disp', host), hold = $('.hold', host), ros = $('.ros', host), sp = $('.sp', host);
  let cur = -1, handle = null, tok = 0, horiz = PHONE.matches;
  const STEP = 70, mounted = new Map();
  function rsize(){ horiz = PHONE.matches; mounted.forEach(e => e.remove()); mounted.clear();
    if (horiz){ sp.style.width = (list.length * STEP + 10) + 'px'; sp.style.height = '72px'; } else { sp.style.height = (list.length * STEP + 12) + 'px'; sp.style.width = '100%'; }
    rupd(); }
  function rupd(){
    const pos = horiz ? ros.scrollLeft : ros.scrollTop, len = (horiz ? ros.clientWidth : ros.clientHeight) || 600;
    const a = Math.max(0, Math.floor(pos / STEP) - 4), b = Math.min(list.length - 1, Math.ceil((pos + len) / STEP) + 4);
    for (const [k, e] of mounted) if (k < a || k > b){ e.remove(); mounted.delete(k); }
    for (let k = a; k <= b; k++){
      if (mounted.has(k)) continue;
      const v = list[k], ri = rinfo(S, v.rarity);
      const e = el1(`<button type="button" class="ro r-${esc(v.rarity)}${ri.holo ? ' ur' : ''}${isTall(v) ? ' tall' : ''}${k === cur ? ' on' : ''}" data-k="${k}" aria-label="${esc(vname(v))}">${imgTag(S, v)}</button>`);
      if (horiz){ e.style.left = (k * STEP + 6) + 'px'; } else { e.style.top = (k * STEP + 6) + 'px'; }
      sp.appendChild(e); mounted.set(k, e);
    }
    hydrate(sp);
  }
  ros.addEventListener('scroll', rafT(rupd), {passive: true});
  ros.addEventListener('click', e => { const b = e.target.closest('.ro'); if (b) show(+b.dataset.k); });
  const mqh = () => rsize(); PHONE.addEventListener && PHONE.addEventListener('change', mqh);
  function center(i){ const len = (horiz ? ros.clientWidth : ros.clientHeight) || 600; const to = Math.max(0, i * STEP - len / 2 + STEP / 2);
    ros.scrollTo(horiz ? {left: to, behavior: REDUCED ? 'auto' : 'smooth'} : {top: to, behavior: REDUCED ? 'auto' : 'smooth'}); }
  async function show(i){
    if (!list.length) return;
    i = (i + list.length) % list.length; if (i === cur) return; cur = i;
    const v = list[i], my = ++tok;
    mounted.forEach((e, k) => e.classList.toggle('on', k === i)); center(i);
    disp.className = 'disp r-' + v.rarity;
    pnl.className = 'pnl glass orn r-' + v.rarity;
    pnl.innerHTML = panelHtml(S, v, ctx, i, list.length);
    if (handle){ try{ handle.destroy(); }catch(e){} handle = null; }
    const h = await mountDisplay(hold, S, v);
    if (my !== tok){ try{ h.destroy(); }catch(e){} return; }
    handle = h;
    if (ctx.onChange) ctx.onChange(v, i);
  }
  // 少しだけ傾ける(マウスのとき)
  if (!REDUCED && matchMedia('(pointer: fine)').matches){
    let rx = 0, ry = 0; const ap = rafT(() => { hold.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; });
    disp.addEventListener('pointermove', e => { const r = disp.getBoundingClientRect(); ry = ((e.clientX - r.left) / r.width - .5) * 8; rx = -((e.clientY - r.top) / r.height - .5) * 6; ap(); });
    disp.addEventListener('pointerleave', () => { rx = ry = 0; ap(); });
  }
  // スマホ: 左右にスワイプで切り替え(3D のキャンバスの上は回す操作なので除く)
  let sx = null, sy = 0;
  disp.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || (e.target.closest && e.target.closest('canvas'))) return; sx = e.clientX; sy = e.clientY; }, {passive: true});
  disp.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) show(cur + (dx < 0 ? 1 : -1)); });
  disp.addEventListener('pointercancel', () => { sx = null; });
  const key = e => { if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); show(cur + 1); } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); show(cur - 1); } };
  if (ctx.keys) addEventListener('keydown', key);
  onLeave(() => { removeEventListener('keydown', key); PHONE.removeEventListener && PHONE.removeEventListener('change', mqh); if (handle) try{ handle.destroy(); }catch(e){} });
  rsize(); show(idx);
  return {show, get cur(){ return cur; }};
}
function panelHtml(S, v, ctx, i, n){
  const ri = rinfo(S, v.rarity), o = ctx.owned && ctx.owned[v.id], ch = v.kind === 'character';
  if (isLocked(S, v)){   // r2: 本人以外 = 名前・レア度・数だけ
    const row = (ic, k, val) => `<dt>${ico(ic)}${esc(t(k))}</dt><dd>${val}</dd>`, p = dropPct(S, v);
    let rows = row('drop', 'drop', p ? `${fmtPct(p)} <span class="mut">(${oneIn(p)})</span>` : `<span class="mut">${esc(t('ended'))}</span>`);
    if (ctx.owned) rows += o ? row('own', 'owned', `<b>×${o.n}</b>`) : row('own', 'owned', `<span class="mut">${esc(t('not_owned'))}</span>`);
    if (ctx.meta && ctx.meta[v.id]){ const m = ctx.meta[v.id]; rows += row('user', 'pulled_by', `<a href="${upath(S.id, m.uid)}">@${esc(m.handle || m.uid)}</a>`) + row('time', 'last', esc(fmtTs(m.ts))); }
    const s = loginState();
    return `<div class="kd st" style="--i:0">OWNER ONLY · <span>No.${i + 1}<span class="mut"> / ${n}</span></span></div>
      <h3 class="st nmf${ri.holo ? ' holo-t' : ''}" style="--i:1">${esc(vname(v))}</h3>${vname2(v) && vname2(v) !== vname(v) ? `<div class="en2 st" style="--i:1">${esc(vname2(v))}</div>` : ''}
      <div class="rk st" style="--i:2;margin-top:10px">${medal(v.rarity, 'emb')}${starsHtml(S, v.rarity)}<span class="rl${ri.holo ? ' holo-t' : ''}">${esc(v.rarity)} · ${esc(ri.label)}</span></div>
      <div class="engr st" style="--i:3"></div>
      <p class="locknote st" style="--i:3">${ico('lock')}<span>${esc(t('lock_note'))}${LOGIN_ON && !s ? `<br><a href="login/">${esc(t('lock_login'))}</a>` : ''}${OWNER_ERR ? `<br><a href="login/">${esc(t('relogin'))}</a>` : ''}</span></p>
      <dl class="st" style="--i:4">${rows}</dl>${ctx.acts ? `<div class="acts st" style="--i:5">${ctx.acts(v)}</div>` : ''}`;
  }
  const kind = ch ? 'CHARACTER' : ({ground: 'GROUND VEHICLE', air: 'AIRCRAFT', heli: 'HELICOPTER', naval: 'NAVAL VESSEL'}[v.category] || 'ITEM');
  const row = (ic, k, val) => val === '' || val == null ? '' : `<dt>${ico(ic)}${esc(t(k))}</dt><dd>${val}</dd>`;
  const p = dropPct(S, v);
  let rows = '';
  if (ch){ for (const s of (v.stats || [])) rows += `<dt>${ico('rank')}${esc(LANG === 'ja' ? s.ja : (s.en || s.ja))}</dt><dd>${esc(s.v)}</dd>`; }
  else rows += row('flag', 'nation', flagHtml(v) + esc(gn(v.group))) + row('type', 'type', esc([catN(v.category), clsN(v.cls)].filter(Boolean).join(' · '))) +
      row('rank', 'rank', v.rank ? ROMAN[v.rank] : '') + row('br', 'br', v.br ? esc(v.br) : '') + row('tier', 'tier', esc(tierN(v.tier)));
  rows += row('drop', 'drop', p ? `${fmtPct(p)} <span class="mut">(${oneIn(p)})</span>` : `<span class="mut">${esc(t('ended'))}</span>`);
  if (ctx.owned) rows += o ? row('own', 'owned', `<b>×${o.n}</b>`) + row('time', 'first', esc(fmtTs(o.first))) + (o.n > 1 ? row('time', 'last', esc(fmtTs(o.last))) : '') : row('own', 'owned', `<span class="mut">${esc(t('not_owned'))}</span>`);
  if (ctx.meta && ctx.meta[v.id]){ const m = ctx.meta[v.id]; rows += row('user', 'pulled_by', `<a href="${upath(S.id, m.uid)}">@${esc(m.handle || m.uid)}</a>`) + row('time', 'last', esc(fmtTs(m.ts))); }
  const isNew = ctx.newIds && ctx.newIds.has(v.id);
  const desc = ch ? (LANG === 'ja' ? v.desc : (v.desc_en || v.desc)) : '';
  return `<div class="kd st" style="--i:0">${kind} · <span>No.${i + 1}<span class="mut"> / ${n}</span></span></div>
    <h3 class="st nmf${ri.holo ? ' holo-t' : ''}" style="--i:1">${esc(vname(v))}${isNew ? '<span class="newt">NEW</span>' : ''}</h3>${vname2(v) && vname2(v) !== vname(v) ? `<div class="en2 st" style="--i:1">${esc(vname2(v))}</div>` : ''}
    <div class="rk st" style="--i:2;margin-top:10px">${medal(v.rarity, 'emb')}${starsHtml(S, v.rarity)}<span class="rl${ri.holo ? ' holo-t' : ''}">${esc(v.rarity)} · ${esc(ri.label)}</span></div>
    <div class="engr st" style="--i:3"></div>${desc ? `<p class="mut st" style="--i:3">${esc(desc)}</p>` : ''}
    <dl class="st" style="--i:4">${rows}</dl>${ctx.acts ? `<div class="acts st" style="--i:5">${ctx.acts(v)}</div>` : ''}`;
}

/* ===================== ホーム ===================== */
async function viewHome(el, S, Q, alive){
  const cfg = S.cfg, ja = LANG === 'ja';
  el.innerHTML = `<section class="hero"><svg class="emb2 st" style="--i:0" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width=".6"/><circle cx="20" cy="20" r="15.5" fill="none" stroke="currentColor" stroke-width=".3" stroke-dasharray="1 2"/><path d="M20 3 L22.4 17.6 L37 20 L22.4 22.4 L20 37 L17.6 22.4 L3 20 L17.6 17.6Z" fill="currentColor"/><path d="M20 9 L21 19 L31 20 L21 21 L20 31 L19 21 L9 20 L19 19Z" fill="#0a0a1f" opacity=".5"/></svg>
      <h1 class="st" style="--i:1">${esc(ja ? cfg.name : (cfg.name_en || cfg.name))}</h1><div class="en st" style="--i:2">COLLECTION · LIBRARY</div>
      <p class="st" style="--i:3">${esc(ja ? cfg.subtitle : (cfg.subtitle_en || cfg.subtitle))}</p>
      <div class="search st" style="--i:4"><input class="inp" id="q" placeholder="${esc(t('search_ph'))}" autocomplete="off"><button class="btn pri" id="go" type="button">${esc(t('search'))}</button></div>
      <div class="mut st" style="--i:5;margin-top:8px"><a href="#/help">${esc(t('help'))}</a></div></section>
    ${hd('featured', 5)}<p class="rule">${esc(t('feat_rule'))}</p><div id="stg"></div>
    ${hd('recent')}<div class="strip" id="strip"></div>
    <div class="g2" style="margin-top:8px"><div>${hd('leader')}<div class="glass orn"><table class="tbl" id="lb"></table></div></div><div>${hd('rates')}<div class="glass orn"><div class="rates" id="rates"></div></div></div></div>
    ${hd('gifts')}<div class="glass orn" id="gifts"></div>`;
  const goq = () => { const q = $('#q', el).value.trim(); if (q) location.hash = upath(S.id, q); };
  $('#go', el).onclick = goq; $('#q', el).onkeydown = e => { if (e.key === 'Enter') goq(); };
  if (Q.get('find')) setTimeout(() => $('#q', el) && $('#q', el).focus(), 300);
  if (!ls.get('wtg_seen_intro', '')) intro();
  const R = await J('recent.json'); if (!alive()) return;
  const rec = (((R || {}).gachas || {})[S.id] || []).filter(r => S.by[r.vehicle_id]);
  // 注目: 最近の排出(重複なし)をステージに。いちばんレアなものから
  const seen = new Set(), feat = [], meta = {};
  for (const r of rec){ if (seen.has(r.vehicle_id)) continue; seen.add(r.vehicle_id); feat.push(S.by[r.vehicle_id]); meta[r.vehicle_id] = {uid: r.user_id || ('@' + r.handle), handle: r.handle, ts: r.ts}; if (feat.length >= 30) break; }
  feat.sort((a, b) => rIdx(S, b.rarity) - rIdx(S, a.rarity) || (meta[b.id].ts || 0) - (meta[a.id].ts || 0));   // r2b: 決まり = レア度の高い順、同じなら新しい順
  if (feat.length) stage($('#stg', el), S, feat, 0, {meta, acts: v => `<a class="btn sm" href="${upath(S.id, meta[v.id].uid, '/i/' + encodeURIComponent(v.id))}">${esc(t('open_detail'))}</a>`});
  else $('#stg', el).innerHTML = `<div class="empty">—</div>`;
  const strip = $('#strip', el);
  strip.innerHTML = rec.slice(0, 12).map((r, k) => cardHtml(S, S.by[r.vehicle_id], {sub: '@' + (r.handle || r.user_id), isNew: !!r.is_new})).join('') || '<div class="empty">—</div>';
  hydrate(strip);
  [...strip.children].forEach((c, k) => { c.dataset.u = rec[k] ? (rec[k].user_id || '@' + rec[k].handle) : ''; if (!REDUCED){ c.classList.add('rv'); c.style.setProperty('--d', (k * 110) + 'ms'); } });
  strip.onclick = e => { const c = e.target.closest('.cd'); if (c) location.hash = upath(S.id, c.dataset.u, '/i/' + encodeURIComponent(c.dataset.id)); };
  const L = await J('leaderboard.json'); if (!alive()) return;
  const lb = ((L || {}).gachas || {})[S.id] || {leaderboard: []}, leg = (lb.legendary || cfg.legendary || []).join('/') || 'UR', hi = (lb.high || []).join('/') || 'SR';
  $('#lb', el).innerHTML = `<tr><th>#</th><th></th><th style="text-align:right">${esc(t('unique'))}</th><th style="text-align:right">${esc(leg)}</th><th style="text-align:right">${esc(hi)}</th><th style="text-align:right">${esc(t('pulls'))}</th></tr>` +
    lb.leaderboard.map((u, i) => `<tr><td class="rnk">${ROMAN[i + 1] || i + 1}</td><td><a href="${upath(S.id, u.user_id || '@' + u.handle)}">@${esc(u.handle || u.user_id)}</a></td><td class="n">${u.uniq.toLocaleString()}</td><td class="n">${u.ur}</td><td class="n">${u.sr}</td><td class="n">${u.pulls.toLocaleString()}</td></tr>`).join('');
  $('#rates', el).innerHTML = [...S.RAR].reverse().map(r => { const p = (S.w[r] || 0) / S.tot * 100, ri = rinfo(S, r);
    return `<div class="rate r-${esc(r)}">${medal(r)}<div><b class="${ri.holo ? 'holo-t' : ''}" style="color:var(--rc)">${esc(r)}</b> <span>${esc(ri.label)}</span> ${starsHtml(S, r)}<div class="mut">${(S.pbr[r] || 0).toLocaleString()} ${esc(t('kinds'))}</div></div><div style="text-align:right"><b>${fmtPct(p)}</b><div class="mut">${oneIn(p)}</div></div></div>`; }).join('');
  $('#gifts', el).innerHTML = giftsHtml(S);
}
function giftsHtml(S){
  const cfg = S.cfg, ja = LANG === 'ja', fmt = v => Number(v).toLocaleString();
  if (!(cfg.gifts || []).length) return `<div class="mut">—</div>`;
  const ord = k => rIdx(S, k);
  const gt = gu => { const es = Object.entries(gu || {}).sort((a, b) => ord(b[0]) - ord(a[0])); if (!es.length) return {t: '', r: ''};
    return {t: ja ? es.map(([k, v]) => k + v).join('+') + '確定' : es.map(([k, v]) => k + ' ' + v).join(' + ') + ' guaranteed', r: es[0][0]}; };
  return `<div class="gl">` + cfg.gifts.map(x => { const b = (x.rolls || 0) - (x.coins || 0), g = gt(x.guarantee);
    return `<div class="gli r-${esc(g.r || 'C')}" style="--gc:var(--rc)"><img src="img/gifts/${encodeURIComponent(x.gift_id)}_256.webp" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div><b>${esc(ja ? x.ja : x.en)}</b> <span class="mut">${esc(x.en !== x.ja ? (ja ? x.en : x.ja) : '')}</span><div class="mut">${g.t ? `<span style="color:var(--rc)">${esc(g.t)}</span>` : ''}</div></div>
      <div class="v3">${ja ? 'コイン' : 'Coins'} <b>${fmt(x.coins)}</b> · ${ja ? '連数' : 'Rolls'} <b>${fmt(x.rolls)}</b>${b > 0 ? ` <span style="color:#9ff0c0">+${fmt(b)}</span>` : ''}</div></div>`; }).join('') +
    `</div><div class="mut" style="margin-top:8px">${ja ? 'この表のギフトだけがガチャになります(ほかのギフトでは引けません)' : 'Only the gifts in this table roll the gacha.'}</div>`;
}
function intro(){
  const m = $('#modal');
  m.innerHTML = `<div class="modal"><div class="glass orn"><h2 class="hd"><i></i><span>${esc(t('first_title'))}<small>${esc(t2('first_title')).toUpperCase()}</small></span><i></i></h2><p>${t('first_body')}</p><div class="row"><button class="btn pri" id="okb" type="button">${esc(t('first_ok'))}</button><a class="btn" href="#/help" id="hb">${esc(t('help'))}</a></div></div></div>`;
  const close = () => { ls.set('wtg_seen_intro', '1'); m.innerHTML = ''; };
  $('#okb').onclick = close; $('#hb').addEventListener('click', close);
}

/* ===================== コレクション ===================== */
async function loadUserG(S, q){
  const f = await findUser(q);
  if (!f.d) return {miss: true, cand: f.cand || []};
  const d = f.d, g = (d.gachas || {})[S.id];
  if (!g) return {miss: true, cand: []};
  return {d, user: d.user, uid: uidOf(d.user), key: d.key, owned: g.owned || {}, recent: g.recent || [], stats: g.stats || {}, g};
}
const notFound = (el, S, q, cand) => { el.innerHTML = `<div class="glass orn" style="margin-top:20px"><h3 style="font-family:var(--serif);margin:0">${esc(q)}</h3><p>${esc(t('notfound'))}</p>
  ${cand && cand.length ? `<div class="mut">${LANG === 'ja' ? 'もしかして' : 'Did you mean'}:</div><div class="row" style="margin:8px 0 12px">${cand.map(c => `<a class="btn sm" href="${upath(S.id, c.user_id || '@' + c.handle)}">@${esc(c.handle || c.user_id)}</a>`).join('')}</div>` : ''}
  <a class="btn" href="#/g/${encodeURIComponent(S.id)}/">${esc(t('home'))}</a></div>`; };
const favKey = (S, uid) => 'wtg_fav_' + S.id + '_' + uid;
const getFav = (S, uid) => { try{ return JSON.parse(ls.get(favKey(S, uid), '[]')) || []; }catch(e){ return []; } };
function userHead(S, U){
  const u = U.user, st = U.stats, ja = LANG === 'ja';
  const comp = st.pool_total ? (st.unique / st.pool_total * 100) : 0;
  const book = location.origin + location.pathname + upath(S.id, u.user_id || '@' + u.handle);
  return `<div class="glass orn st" style="--i:0;margin-top:8px"><div class="uh"><div><div class="mut" style="font-family:var(--cin);letter-spacing:.3em;color:var(--gold)">COLLECTOR</div>
      <div class="nm">@${esc(u.handle || u.user_id)}</div><div class="mut">${esc(t('first'))} ${esc(fmtTs(u.first_seen))} · ${esc(t('last'))} ${esc(fmtTs(u.last_seen))}</div>
      ${u.user_id ? `<div style="margin-top:8px"><div class="mut">${esc(t('your_id'))}</div><div class="idbox">${esc(u.user_id)}</div><div class="mut" style="word-break:break-all">${esc(t('bookmark'))}: <code>${esc(book)}</code></div></div>` : ''}</div>
    <div class="row" style="justify-content:flex-end"><a class="btn" href="${upath(S.id, U.uid, '/showcase')}">${ico('show')}${esc(t('show'))}</a></div></div>
    <div class="kpis"><div class="kpi"><div class="k">${esc(t('unique'))}</div><div class="v">${(st.unique || 0).toLocaleString()} <small>/ ${(st.pool_total || 0).toLocaleString()}${st.retired ? ` (+${st.retired} ${ja ? '排出終了' : 'ended'})` : ''}</small></div></div>
      <div class="kpi"><div class="k">${esc(t('pulls'))}</div><div class="v">${(st.pulls || 0).toLocaleString()}</div></div><div class="kpi"><div class="k">${esc(t('comp'))}</div><div class="v">${comp.toFixed(1)}<small>%</small></div></div></div>
    <div class="rbars">${[...S.RAR].reverse().map((r, i) => { const o = (st.by_rarity || {})[r] || 0, tt = (st.pool_by_rarity || {})[r] || S.pbr[r] || 0, ri = rinfo(S, r);
      return `<div class="rbar r-${esc(r)}${ri.holo ? ' ur' : ''}" style="--i:${i}"><div class="rk">${medal(r)}<span class="${ri.holo ? 'holo-t' : ''}" style="color:var(--rc);font-family:var(--cin)">${esc(r)}</span></div><div class="tr2"><i style="--w:${tt ? (o / tt * 100).toFixed(2) : 0}%"></i></div><div class="n">${o.toLocaleString()} / ${tt.toLocaleString()}</div></div>`; }).join('')}</div></div>`;
}
async function viewColl(el, S, q, Q, alive){
  el.innerHTML = `<div class="loading">LOADING</div>`;
  const U = await loadUserG(S, q); if (!alive()) return;
  if (U.miss) return notFound(el, S, q, U.cand);
  ls.set('wtg_last_u', U.uid); chrome(S);
  const owned = U.owned, st = {g: Q.get('g') || '', c: Q.get('c') || '', r: Q.get('r') || '', rk: Q.get('rk') || '', own: Q.get('own') !== '0', sort: Q.get('s') || 'rar', q: ''};
  const newIds = new Set(U.recent.filter(r => r.is_new).map(r => r.vehicle_id));
  let fav = getFav(S, U.uid).filter(id => owned[id]);
  const RET = Object.keys(owned).filter(id => !S.poolIds.has(id) && S.by[id]).map(id => S.by[id]);
  const ALL = S.pool.concat(RET);
  const byG = {}; S.pool.forEach(v => { if (S.prot.has(v.rarity)) return; const g = v.group || ''; (byG[g] ||= {t: 0, o: 0}).t++; if (owned[v.id]) byG[g].o++; });
  const groups = Object.keys(byG).filter(Boolean).sort((a, b) => byG[b].t - byG[a].t);
  const cats = [...new Set(S.pool.map(v => v.category).filter(Boolean))];
  const ranks = [...new Set(S.pool.map(v => v.rank).filter(Boolean))].sort((a, b) => a - b);
  // 最近の入手(順番に現れて NEW は光る)
  const rs = [], rseen = new Set(); for (const r of U.recent){ if (rseen.has(r.vehicle_id) || !S.by[r.vehicle_id]) continue; rseen.add(r.vehicle_id); rs.push(r); if (rs.length >= 12) break; }
  el.innerHTML = userHead(S, U) + (rs.length ? hd('new_acq') + `<div class="strip" id="strip"></div>` : '') + hd('coll') +
    `<div class="glass orn flt"><div class="chips" id="fG"></div><div class="chips" id="fC"></div><div class="chips" id="fR"></div>${ranks.length ? '<div class="chips" id="fK"></div>' : ''}
      <div class="row2"><input class="inp" id="fq" placeholder="${esc(t('find'))}" style="max-width:260px;font-size:14px;padding:6px 10px">
      <label class="chip" id="fO"></label><select class="sel" id="fS">${[['rar', 's_rar'], ['new', 's_new'], ['cnt', 's_cnt'], ['rank', 's_rank'], ['name', 's_name']].map(([k, l]) => `<option value="${k}">${esc(t('sort'))}: ${esc(t(l))}</option>`).join('')}</select>
      <span class="mut" id="cnt"></span><span class="mut">${esc(t('fav_hint'))}</span></div></div><div class="vg" id="vg"></div>`;
  if (rs.length){ const s = $('#strip', el); s.innerHTML = rs.map(r => cardHtml(S, S.by[r.vehicle_id], {n: (owned[r.vehicle_id] || {}).n, isNew: !!r.is_new})).join('');
    hydrate(s); [...s.children].forEach((c, k) => { if (!REDUCED){ c.classList.add('rv'); c.style.setProperty('--d', (300 + k * 120) + 'ms'); } });
    s.onclick = e => { const c = e.target.closest('.cd'); if (c) location.hash = upath(S.id, U.uid, '/i/' + encodeURIComponent(c.dataset.id)); }; }
  const chips = (id, arr, key) => { const e = $('#' + id, el); if (!e) return;
    e.innerHTML = [['', t('all')], ...arr].map(([k, l]) => `<button type="button" class="chip${String(st[key]) === String(k) ? ' on' : ''}" data-k="${esc(k)}">${l}</button>`).join('');
    e.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; st[key] = b.dataset.k; render(); }; };
  const grid = new VGrid($('#vg', el), {key: v => v.id, render: v => el1(cardHtml(S, v, {owned: !!owned[v.id], n: (owned[v.id] || {}).n, isNew: newIds.has(v.id), fav: fav.includes(v.id)}))});
  onLeave(() => grid.destroy());
  function list(){
    const nq = st.q.toLowerCase();
    const L = ALL.filter(v => (!st.g || v.group === st.g) && (!st.c || v.category === st.c) && (!st.r || v.rarity === st.r) && (!st.rk || String(v.rank) === st.rk) && (!st.own || owned[v.id]) &&
      (!nq || (v.name || '').toLowerCase().includes(nq) || (v.name_en || '').toLowerCase().includes(nq)));
    const o = id => owned[id] || {};
    const by = {rar: (a, b) => (o(b.id).n ? 1 : 0) - (o(a.id).n ? 1 : 0) || rIdx(S, b.rarity) - rIdx(S, a.rarity) || (b.rank || 0) - (a.rank || 0),
      new: (a, b) => (o(b.id).last || 0) - (o(a.id).last || 0), cnt: (a, b) => (o(b.id).n || 0) - (o(a.id).n || 0) || rIdx(S, b.rarity) - rIdx(S, a.rarity),
      rank: (a, b) => (b.rank || 0) - (a.rank || 0) || rIdx(S, b.rarity) - rIdx(S, a.rarity), name: (a, b) => vname(a).localeCompare(vname(b))}[st.sort] || (() => 0);
    return L.sort(by);
  }
  function render(){
    chips('fG', groups.map(g => [g, `${flagHtml({group: g})}${esc(gn(g))}<span class="c2">${byG[g].o}/${byG[g].t}</span><i class="pb" style="width:${(byG[g].o / Math.max(1, byG[g].t) * 100).toFixed(1)}%"></i>`]), 'g');
    chips('fC', cats.map(c => [c, esc(catN(c))]), 'c');
    chips('fR', [...S.RAR].reverse().map(r => [r, `${esc(r)}`]), 'r');
    chips('fK', ranks.map(k => [String(k), (LANG === 'ja' ? 'ランク ' : 'Rank ') + ROMAN[k]]), 'rk');
    $('#fO', el).className = 'chip' + (st.own ? ' on' : ''); $('#fO', el).textContent = (st.own ? '☑ ' : '☐ ') + t('owned_only');
    $('#fS', el).value = st.sort;
    const L = list();
    LASTLIST = {ctx: S.id + '|' + U.uid, ids: L.map(v => v.id)};
    $('#cnt', el).textContent = `${L.filter(v => owned[v.id]).length.toLocaleString()} / ${L.length.toLocaleString()}`;
    grid.set(L);
    if (!L.length) $('#vg', el).innerHTML = `<div class="empty">${esc(t('no_items'))}</div>`;
  }
  $('#fO', el).onclick = () => { st.own = !st.own; render(); };
  $('#fS', el).onchange = e => { st.sort = e.target.value; render(); };
  let qt; $('#fq', el).oninput = e => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); render(); }, 180); };
  $('#vg', el).addEventListener('click', e => { const f = e.target.closest('[data-fav]'), c = e.target.closest('.cd'); if (!c) return;
    const id = c.dataset.id;
    if (f){ e.stopPropagation(); if (fav.includes(id)) fav = fav.filter(x => x !== id); else { if (fav.length >= 9) return alert(LANG === 'ja' ? 'お気に入りは9個までです' : 'Max 9 favorites'); fav.push(id); }
      ls.set(favKey(S, U.uid), JSON.stringify(fav)); f.classList.toggle('on', fav.includes(id)); return; }
    location.hash = upath(S.id, U.uid, '/i/' + encodeURIComponent(id)); });
  $('#vg', el).addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('cd')) e.target.click(); });
  render();
}

/* ===================== 図鑑(ユーザーなし) ===================== */
async function viewDex(el, S, Q, alive){
  const st = {g: Q.get('g') || '', c: Q.get('c') || '', r: Q.get('r') || '', q: ''};
  const groups = [...new Set(S.pool.map(v => v.group).filter(Boolean))].sort((a, b) => S.pool.filter(v => v.group === b).length - S.pool.filter(v => v.group === a).length);
  const cats = [...new Set(S.pool.map(v => v.category).filter(Boolean))];
  el.innerHTML = `${hd('dex')}<div class="glass orn flt"><div class="chips" id="fG"></div><div class="chips" id="fC"></div><div class="chips" id="fR"></div>
    <div class="row2"><input class="inp" id="fq" placeholder="${esc(t('find'))}" style="max-width:260px;font-size:14px;padding:6px 10px"><span class="mut" id="cnt"></span></div></div><div class="vg" id="vg"></div>`;
  const grid = new VGrid($('#vg', el), {key: v => v.id, render: v => el1(cardHtml(S, v))}); onLeave(() => grid.destroy());
  const chips = (id, arr, key) => { const e = $('#' + id, el); e.innerHTML = [['', t('all')], ...arr].map(([k, l]) => `<button type="button" class="chip${st[key] === k ? ' on' : ''}" data-k="${esc(k)}">${l}</button>`).join('');
    e.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; st[key] = b.dataset.k; render(); }; };
  function render(){
    chips('fG', groups.map(g => [g, flagHtml({group: g}) + esc(gn(g))]), 'g'); chips('fC', cats.map(c => [c, esc(catN(c))]), 'c'); chips('fR', [...S.RAR].reverse().map(r => [r, esc(r)]), 'r');
    const nq = st.q.toLowerCase();
    const L = S.pool.filter(v => (!st.g || v.group === st.g) && (!st.c || v.category === st.c) && (!st.r || v.rarity === st.r) && (!nq || (v.name || '').toLowerCase().includes(nq) || (v.name_en || '').toLowerCase().includes(nq)))
      .sort((a, b) => rIdx(S, b.rarity) - rIdx(S, a.rarity) || (b.rank || 0) - (a.rank || 0));
    LASTLIST = {ctx: S.id + '|', ids: L.map(v => v.id)};
    $('#cnt', el).textContent = L.length.toLocaleString() + ' ' + t('kinds');
    grid.set(L);
  }
  let qt; $('#fq', el).oninput = e => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); render(); }, 180); };
  $('#vg', el).addEventListener('click', e => { const c = e.target.closest('.cd'); if (c) location.hash = `#/g/${encodeURIComponent(S.id)}/i/${encodeURIComponent(c.dataset.id)}`; });
  render();
}

/* ===================== アイテムの詳細 ===================== */
async function viewItem(el, S, q, id, alive){
  el.innerHTML = `<div class="loading">LOADING</div>`;
  let U = null, list;
  if (q){ U = await loadUserG(S, q); if (!alive()) return; if (U.miss) return notFound(el, S, q, U.cand); ls.set('wtg_last_u', U.uid); }
  const ctxKey = S.id + '|' + (U ? U.uid : '');
  if (LASTLIST && LASTLIST.ctx === ctxKey && LASTLIST.ids.includes(id)) list = LASTLIST.ids.map(i => S.by[i]).filter(Boolean);
  else if (U){ list = Object.keys(U.owned).map(i => S.by[i]).filter(Boolean).sort((a, b) => rIdx(S, b.rarity) - rIdx(S, a.rarity) || (b.rank || 0) - (a.rank || 0)); if (!list.some(v => v.id === id) && S.by[id]) list.unshift(S.by[id]); }
  else { const v0 = S.by[id]; list = v0 ? S.pool.filter(v => v.group === v0.group && v.category === v0.category).sort((a, b) => (a.rank || 0) - (b.rank || 0) || rIdx(S, b.rarity) - rIdx(S, a.rarity)) : []; if (v0 && !list.includes(v0)) list.unshift(v0); }
  if (!list.length){ el.innerHTML = `<div class="empty">${esc(t('no_items'))}</div>`; return; }
  const back = U ? `<a class="btn sm" href="${upath(S.id, U.uid)}">← @${esc(U.user.handle || U.uid)} · ${esc(t('back_coll'))}</a>` : `<a class="btn sm" href="#/g/${encodeURIComponent(S.id)}/dex">← ${esc(t('dex'))}</a>`;
  el.innerHTML = `<div class="row st" style="--i:0;margin-top:6px">${back}<span class="mut khint">← → / ↑ ↓</span><span class="mut thint">${esc(t('swipe'))}</span></div><div id="stg"></div>`;
  const newIds = U ? new Set(U.recent.filter(r => r.is_new).map(r => r.vehicle_id)) : null;
  const base = U ? upath(S.id, U.uid, '/i/') : `#/g/${encodeURIComponent(S.id)}/i/`;
  stage($('#stg', el), S, list, Math.max(0, list.findIndex(v => v.id === id)), {owned: U ? U.owned : null, newIds, keys: true,
    onChange: v => { const h = base + encodeURIComponent(v.id); if (location.hash !== h) history.replaceState(null, '', h); }});
}

/* ===================== 全ガチャ・ヘルプ ===================== */
async function viewAll(el, q, alive){
  const f = await findUser(q); if (!alive()) return; const G = await gachas();
  const S0 = await useG('');
  if (!f.d) return notFound(el, S0, q, f.cand);
  const u = f.d.user;
  el.innerHTML = `<div class="glass orn" style="margin-top:8px"><div class="uh"><div><div class="nm" style="font-family:var(--serif);font-size:34px;font-weight:800">@${esc(u.handle || u.user_id)}</div>${u.user_id ? `<div class="mut">${esc(t('your_id'))}</div><div class="idbox">${esc(u.user_id)}</div>` : ''}</div></div></div>
    ${hd('all_gachas')}<div class="strip" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${Object.entries(f.d.gachas || {}).map(([k, v], i) => { const c = (G.configs || {})[k] || {}, s = v.stats || {};
      return `<a class="glass orn gc st" style="--i:${i}" href="${upath(k, uidOf(u))}"><h3>${esc(LANG === 'ja' ? c.name || k : (c.name_en || c.name || k))}</h3><div>${esc(t('unique'))} <b>${s.unique || 0}</b> <span class="mut">/ ${s.pool_total || 0}</span> · ${esc(t('pulls'))} <b>${s.pulls || 0}</b></div><div class="mut">${esc(t('open'))} →</div></a>`; }).join('')}</div>`;
}
function viewHelp(el){ el.innerHTML = `<div class="glass orn help" style="margin-top:12px">${t('help_html')}</div>`; }

/* ===================== ショーケース(v1 と同じ画像づくり。色だけ v2) ===================== */
async function viewShowcase(el, S, q, alive){
  el.innerHTML = `<div class="loading">LOADING</div>`;
  const U = await loadUserG(S, q); if (!alive()) return;
  if (U.miss) return notFound(el, S, q, U.cand);
  const u = U.user, uid = U.uid, owned = U.owned, st = U.stats, VBY = S.by, RAR = S.RAR;
  let fav = getFav(S, uid).filter(id => owned[id]);
  if (!fav.length) fav = Object.keys(owned).sort((a, b) => rIdx(S, (VBY[b] || {}).rarity) - rIdx(S, (VBY[a] || {}).rarity) || ((VBY[b] || {}).rank || 0) - ((VBY[a] || {}).rank || 0)).slice(0, 9);
  el.innerHTML = `<div class="row st" style="--i:0;margin-top:6px"><a class="btn sm" href="${upath(S.id, uid)}">← @${esc(u.handle || uid)}</a></div>${hd('show', 1)}
    <div class="glass orn"><div class="row"><select id="fmt" class="sel"><option value="story">${esc(t('story'))}</option><option value="square">${esc(t('square'))}</option></select>
      <input class="inp" id="cap" placeholder="${esc(t('cap_ph'))}" style="flex:1;min-width:160px;font-size:14px;padding:6px 10px">
      <button class="btn pri sm" id="mk" type="button">${esc(t('make'))}</button><button class="btn sm" id="dl" type="button">${esc(t('download'))}</button><button class="btn sm" id="sh" type="button">${esc(t('share'))}</button></div>
      <div class="mut" style="margin-top:6px">${esc(t('fav_hint'))}</div>
      <div class="sc-wrap" style="margin-top:10px"><div id="cvWrap"><canvas id="cv"></canvas></div><div style="flex:1;min-width:260px"><div class="strip" id="pick"></div></div></div></div>`;
  const pick = $('#pick', el);
  const renderPick = () => { const L = Object.keys(owned).filter(id => VBY[id]).sort((a, b) => rIdx(S, VBY[b].rarity) - rIdx(S, VBY[a].rarity));
    pick.innerHTML = L.slice(0, 120).map(id => cardHtml(S, VBY[id], {owned: true, n: owned[id].n, fav: fav.includes(id)})).join(''); hydrate(pick); };
  pick.onclick = e => { const c = e.target.closest('.cd'); if (!c) return; const id = c.dataset.id;
    if (fav.includes(id)) fav = fav.filter(x => x !== id); else { if (fav.length >= 9) return alert(LANG === 'ja' ? '9個までです' : 'Max 9'); fav.push(id); }
    ls.set(favKey(S, uid), JSON.stringify(fav)); renderPick(); draw(); };
  renderPick();
  const cv = $('#cv', el), title = (LANG === 'ja' ? S.cfg.name : (S.cfg.name_en || S.cfg.name)) || 'GACHA';
  const RCOL = {C: '#f3efe6', R: '#c9d2de', SR: '#e9c46a', UR: '#eef2f8'}, HOLO = ['#ffd1f2', '#d9c9ff', '#bfefff', '#cfffe6', '#fff1bf'];
  const RC = r => RCOL[r] || (S.RB[r] || {}).color || '#fff', isH = r => !!rinfo(S, r).holo;
  const hGrad = (g, x0, x1, y0, y1) => { const gr = g.createLinearGradient(x0, y0 || 0, x1, y1 || 0); HOLO.concat(HOLO[0]).forEach((c, k, a) => gr.addColorStop(k / (a.length - 1), c)); return gr; };
  const IMG = id => { const v = VBY[id]; return isLocked(S, v) ? silUrl(S, v) : isPA(S, v) ? PA.url(S.id, id, paKind(v)).catch(() => silUrl(S, v)) : imgUrl(S, v); };
  const IMG_ALT = id => (S.prot.has(VBY[id].rarity) ? '' : imgAlt(S, VBY[id]));
  let FX = [];
  function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function fitText(g, s, x, y, mw){ while (g.measureText(s).width > mw && s.length > 3) s = s.slice(0, -2) + '…'; g.fillText(s, x, y); }
  async function draw(){
    const story = $('#fmt', el).value === 'story', W = 1080, H = story ? 1920 : 1080; cv.width = W; cv.height = H; const g = cv.getContext('2d'); FX = [];
    try{ await document.fonts.ready; }catch(e){}
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b0b26'); bg.addColorStop(.6, '#120f34'); bg.addColorStop(1, '#1a0f2e'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const neb = g.createRadialGradient(W * .3, H * .25, 0, W * .3, H * .25, W * .7); neb.addColorStop(0, 'rgba(122,92,255,.25)'); neb.addColorStop(1, 'rgba(122,92,255,0)'); g.fillStyle = neb; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++){ g.fillStyle = Math.random() > .9 ? `rgba(255,227,163,${Math.random() * .8})` : `rgba(223,230,255,${Math.random() * .6})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, 7); g.fill(); }
    const F = w => `${w} "Shippori Mincho B1", serif`, gold = '#e6c27a';
    const top = story ? 140 : 70;
    g.textAlign = 'center'; g.font = F('700 ' + (story ? 64 : 48) + 'px'); g.shadowColor = gold; g.shadowBlur = 20; g.fillStyle = gold; g.fillText(title, W / 2, top); g.shadowBlur = 0;
    g.strokeStyle = 'rgba(230,194,122,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 - 300, top + 16); g.lineTo(W / 2 + 300, top + 16); g.stroke();
    g.font = F('700 ' + (story ? 28 : 21) + 'px'); g.fillStyle = '#cfd3ee'; g.fillText(`${S.cfg.streamer || ''} LIVE  ·  ${location.host}`, W / 2, top + (story ? 54 : 42));
    g.font = F('700 ' + (story ? 58 : 42) + 'px'); g.fillStyle = '#fff'; g.fillText('@' + (u.handle || u.user_id), W / 2, top + (story ? 136 : 100));
    g.font = F('700 ' + (story ? 28 : 21) + 'px'); g.fillStyle = '#a9add0'; g.fillText(`${t('unique')} ${st.unique} / ${st.pool_total}`, W / 2, top + (story ? 180 : 134));
    const RR = [...RAR].reverse(), bx = 120, bw = W - 240, by = top + (story ? 230 : 170), bh = story ? 24 : 16, gap = story ? 44 : 30;
    RR.forEach((r, i) => { const y = by + i * gap, f = Math.min(1, (st.by_rarity[r] || 0) / Math.max(1, st.pool_by_rarity[r] || 0)); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(bx, y, bw, bh);
      g.fillStyle = isH(r) ? hGrad(g, bx, bx + Math.max(24, bw * f)) : RC(r); g.shadowColor = RC(r); g.shadowBlur = 12; g.fillRect(bx, y, bw * f, bh); g.shadowBlur = 0;
      g.font = F('700 ' + (story ? 21 : 15) + 'px'); g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(`${r}  ${st.by_rarity[r] || 0}/${st.pool_by_rarity[r] || 0}`, bx + 8, y + bh - (story ? 4 : 3)); });
    const n = fav.length, cols = 3, rows = Math.ceil(n / cols) || 1, gy = by + RR.length * gap + (story ? 40 : 20), avail = H - gy - (story ? 170 : 110);
    const cw = (W - 80 - (cols - 1) * 20) / cols, chh = Math.min(cw, avail / rows - 20);
    const flags = await Promise.all(fav.map(id => { const v = VBY[id] || {}; return window.flagImages ? flagImages({country: v.group || '', operator: v.operator || ''}).catch(() => []) : Promise.resolve([]); }));
    const load1 = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const imgs = await Promise.all(fav.map(async id => (await load1(await IMG(id))) || (await load1(IMG_ALT(id)))));
    fav.forEach((id, i) => { const v = VBY[id]; if (!v) return; const x = 40 + (i % cols) * (cw + 20), y = gy + Math.floor(i / cols) * (chh + 20), col = RC(v.rarity);
      g.fillStyle = 'rgba(14,12,40,.75)'; roundRect(g, x, y, cw, chh, 6); g.fill();
      if (isH(v.rarity)){ g.strokeStyle = hGrad(g, x, x + cw, y, y + chh); g.lineWidth = 6; g.shadowColor = '#d9c9ff'; g.shadowBlur = 24; roundRect(g, x, y, cw, chh, 6); g.stroke(); g.shadowBlur = 0; FX.push({x, y, w: cw, h: chh}); }
      else { g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 16; roundRect(g, x, y, cw, chh, 6); g.stroke(); g.shadowBlur = 0; }
      const im = imgs[i], ih = chh * .56, iw = Math.min(cw - 24, ih * 2); if (im) g.drawImage(im, x + (cw - iw) / 2, y + 14, iw, ih);
      g.font = F('700 ' + (story ? 18 : 14) + 'px'); g.textAlign = 'left'; g.fillStyle = isH(v.rarity) ? hGrad(g, x + 12, x + 52) : col; g.fillText(v.rarity, x + 12, y + (story ? 26 : 20));
      g.fillStyle = '#fff'; g.font = F('700 ' + (story ? 23 : 16) + 'px');
      const fh = story ? 20 : 14, fw = fh * 1.5, ty = y + chh - (story ? 36 : 26), fl = flags[i] || [], fwAll = fl.length * (fw + 4); let txt = vname(v);
      while (g.measureText(txt).width > cw - 30 - fwAll && txt.length > 3) txt = txt.slice(0, -2) + '…';
      const tw = g.measureText(txt).width, sx = x + cw / 2 - (tw + fwAll + 4) / 2; fl.forEach((fi, j) => g.drawImage(fi, sx + j * (fw + 4), ty - fh + 3, fw, fh)); g.fillText(txt, sx + fwAll + 4, ty);
      g.textAlign = 'center'; g.font = F('700 ' + (story ? 16 : 12) + 'px'); g.fillStyle = '#a9add0'; g.fillText([gn(v.group), v.rank ? ROMAN[v.rank] : '', v.br ? 'BR ' + v.br : '', owned[id].n > 1 ? '×' + owned[id].n : ''].filter(Boolean).join(' · '), x + cw / 2, y + chh - (story ? 12 : 9)); });
    const cap = $('#cap', el).value.trim();
    if (cap){ g.font = F('700 ' + (story ? 34 : 24) + 'px'); g.textAlign = 'center'; g.fillStyle = '#fff'; fitText(g, cap, W / 2, H - (story ? 110 : 70), W - 120); }
    if (S.cfg.credit){ g.font = F('700 ' + (story ? 22 : 16) + 'px'); g.fillStyle = '#777'; g.textAlign = 'center'; g.fillText(S.cfg.credit, W / 2, H - (story ? 40 : 24)); }
    const wr = $('#cvWrap', el); wr.querySelectorAll('.cvfx').forEach(e => e.remove());
    FX.forEach(f => { const d = document.createElement('div'); d.className = 'cvfx'; Object.assign(d.style, {left: (f.x / W * 100) + '%', top: (f.y / H * 100) + '%', width: (f.w / W * 100) + '%', height: (f.h / H * 100) + '%'}); wr.appendChild(d); });
  }
  $('#mk', el).onclick = draw; $('#fmt', el).onchange = draw; $('#cap', el).onchange = draw;
  const fname = () => `${S.id}gacha_${(u.handle || u.user_id || 'me').replace(/[^\w]/g, '')}.png`;
  $('#dl', el).onclick = () => { const a = document.createElement('a'); a.download = fname(); a.href = cv.toDataURL('image/png'); a.click(); };
  $('#sh', el).onclick = () => cv.toBlob(async b => { const f = new File([b], fname(), {type: 'image/png'});
    if (navigator.canShare && navigator.canShare({files: [f]})){ try{ await navigator.share({files: [f], text: title}); }catch(e){} } else $('#dl', el).click(); });
  await draw();
}

/* ===================== start ===================== */
sky();
route();
// 国旗とシルエット(flags.js 470KB)は最初の表示の後に読む → 読めたら空の国旗を埋める
const loadFlags = () => { const s = document.createElement('script'); s.src = 'flags.js'; s.async = true;
  s.onload = () => document.querySelectorAll('.fl:empty').forEach(e => { try{ e.innerHTML = flagImg({country: e.dataset.c, operator: e.dataset.o}); }catch(x){} });
  document.head.appendChild(s); };
if ('requestIdleCallback' in window) requestIdleCallback(loadFlags, {timeout: 2500}); else setTimeout(loadFlags, 1200);
})();
