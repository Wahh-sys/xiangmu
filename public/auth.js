/* Demo access: server cookie sessions, with a session-only file-preview fallback. */
(() => {
  'use strict';
  const view = document.currentScript.dataset.view;
  const fileMode = location.protocol === 'file:';
  const offlineKey = 'eco-offline-session';
  function redirectLogin() { location.replace(fileMode ? 'login.html' : '/login'); }
  function offlineUser() { try { return JSON.parse(sessionStorage.getItem(offlineKey)); } catch { return null; } }
  async function getUser() {
    if (fileMode) return offlineUser();
    try {
      const response = await fetch('/api/session', {cache:'no-store'});
      return response.ok ? (await response.json()).user : null;
    } catch { return null; }
  }
  async function login(username, password) {
    if (fileMode) {
      if (username !== 'admin' || password !== '123456') throw new Error('账号或密码不正确，请使用下方演示账号。');
      try { sessionStorage.setItem(offlineKey, JSON.stringify({username:'admin',name:'比赛演示用户'})); }
      catch { throw new Error('浏览器未允许保存会话，请从已部署的网站打开。'); }
      return;
    }
    let response;
    try { response = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); }
    catch { throw new Error('暂时无法连接服务，请检查网络并稍后重试。'); }
    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || '登录未完成，请稍后重试。');
    }
  }
  async function logout() {
    if (fileMode) { try { sessionStorage.removeItem(offlineKey); } catch {} redirectLogin(); return; }
    try {
      const response = await fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if (!response.ok) throw new Error('logout failed');
      redirectLogin();
    } catch { alert('退出未完成，请检查网络或服务状态后重试。'); }
  }
  const ready = getUser().then(user => {if(view === 'dashboard' && !user) redirectLogin();return user;});
  if (view === 'dashboard') window.addEventListener('pageshow', async event => {if(event.persisted && !await getUser())redirectLogin();});
  window.DemoAuth = {ready,login,logout,fileMode};
})();
