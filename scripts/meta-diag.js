/**
 * META TEŞHİS ARACI — token'ın neyi görebildiğini GÜVENLİ şekilde raporlar.
 *
 * Sadece runner'da (Actions) çalıştırılır: sandbox'tan graph.facebook.com'a
 * çıkış yok. Log'a ASLA token basılmaz — yalnızca izin adları, sayılar ve
 * kimlik ID'leri (zaten herkese açık) yazılır. Repo public; buna göre yazıldı.
 *
 * Kullanım: Actions → "Meta Teşhis" → Run workflow.
 */

const V = 'v21.0';

async function gget(host, pathname, token, params = {}) {
  const u = new URL(`https://${host}/${V}/${pathname}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', token);
  const res = await fetch(u, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function line(ok, label, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
}

async function diagUserToken(token) {
  console.log('\n===== META_USER_TOKEN (Facebook login akışı) =====');
  const me = await gget('graph.facebook.com', 'me', token, { fields: 'id' });
  if (me.data?.error) {
    line(false, 'token geçersiz', me.data.error.message?.slice(0, 120));
    return;
  }
  line(true, 'token geçerli', `user id: ${me.data.id}`);

  const perms = await gget('graph.facebook.com', 'me/permissions', token);
  const plist = (perms.data?.data || []).map((p) => `${p.permission}:${p.status}`);
  console.log('   izinler:', plist.join(', ') || 'BOŞ');
  const need = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
  for (const p of need) {
    const st = (perms.data?.data || []).find((x) => x.permission === p);
    line(st?.status === 'granted', `izin ${p}`, st ? st.status : 'HİÇ İSTENMEMİŞ');
  }

  const acc = await gget('graph.facebook.com', 'me/accounts', token, { fields: 'id,name' });
  const pages = acc.data?.data || [];
  line(pages.length > 0, `erişilebilir Sayfa sayısı: ${pages.length}`);
  for (const p of pages) {
    console.log(`   sayfa: id=${p.id}`);
    const ig = await gget('graph.facebook.com', p.id, token, { fields: 'instagram_business_account' });
    const igid = ig.data?.instagram_business_account?.id;
    line(Boolean(igid), '   bağlı Instagram işletme hesabı', igid ? `id=${igid}` : 'YOK');
  }
  if (!pages.length) {
    console.log('   ↳ TEŞHİS: token Sayfa göremiyor. Ya onay ekranında sayfa işaretlenmedi');
    console.log('     (tik tuzağı) ya da hesapta gerçekten Sayfa yok/rolü eksik.');
  }
}

async function diagIgLoginToken(token) {
  console.log('\n===== META_IG_LOGIN_TOKEN (Instagram login akışı — Sayfasız yol) =====');
  const me = await gget('graph.instagram.com', 'me', token, { fields: 'user_id,username,account_type' });
  if (me.data?.error) {
    line(false, 'IG token geçersiz', me.data.error.message?.slice(0, 120));
    return;
  }
  line(true, 'IG token geçerli', `@${me.data.username} (${me.data.account_type || '?'}, id=${me.data.user_id || me.data.id})`);
  console.log('   ↳ Bu yol Sayfa GEREKTİRMEZ — Reels yayını buradan kurulabilir.');
}

const userTok = (process.env.META_USER_TOKEN || '').trim();
const igTok = (process.env.META_IG_LOGIN_TOKEN || '').trim();
console.log(`META_USER_TOKEN: ${userTok ? 'var (' + userTok.length + ' kr)' : 'YOK'}`);
console.log(`META_IG_LOGIN_TOKEN: ${igTok ? 'var (' + igTok.length + ' kr)' : 'YOK'}`);

if (userTok) await diagUserToken(userTok);
if (igTok) await diagIgLoginToken(igTok);
if (!userTok && !igTok) console.log('Teşhis edilecek token yok — secrets ekleyin.');
console.log('\nTeşhis bitti.');
