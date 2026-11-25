function e(){return navigator.connection??null}var t={slow3g:{label:`Simulated Slow 3G (~400 kbps, +400 ms)`,kbps:400},"3g":{label:`Simulated 3G (~800 kbps, +250 ms)`,kbps:800},fast3g:{label:`Simulated Fast 3G (~1.6 Mbps, +150 ms)`,kbps:1600},slow4g:{label:`Simulated Slow 4G (~3 Mbps, +250 ms)`,kbps:3e3}};function n(){window.location.reload()}async function r(){try{let e=await navigator.serviceWorker.getRegistrations();await Promise.all(e.map(e=>e.unregister()));let t=await caches.keys();await Promise.all(t.map(e=>caches.delete(e)))}catch{}}function i(){let i=null,a=null,c=null,l=()=>{if(!i)return;let e=a?.downlink;i.textContent=typeof e==`number`&&e>0?`${String(e)} Mbps`:`Unavailable`};return{name:`nettools`,init(u){let d=u,f=typeof d.get==`function`?d.get(0):u;c=f;let p=s(`wd-net`)??``,m=s(`wd-cache`)===`off`,h=[`<option value="">No throttling (maximum speed)</option>`,...Object.entries(t).sort(([,e],[,t])=>e.kbps-t.kbps).map(([e,t])=>`<option value="${e}"${e===p?` selected`:``}>${t.label}</option>`)].join(``),g=`
        <div style="padding: 15px; font-family: sans-serif; color: #fff; background: #111; height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 8px;">Network Utilities</h3>

          <div style="margin-bottom: 20px; background: #222; padding: 12px; border-radius: 6px;">
            <h4 style="margin: 0 0 5px 0; color: #888; font-size: 12px; text-transform: uppercase;">Estimated Downlink</h4>
            <div id="wd-netplus-speed" style="font-size: 24px; font-weight: bold; color: #00ffcc;">…</div>
          </div>

          <label style="display: flex; align-items: center; cursor: pointer; background: #222; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
            <input type="checkbox" id="wd-netplus-cache"${m?` checked`:``} style="margin-right: 12px; transform: scale(1.3);">
            <div>
              <strong>Disable Cache</strong>
              <div style="font-size: 11px; color: #888; margin-top: 2px;">No-store + service worker bypass — every load is a cold load. Reloads the app.</div>
            </div>
          </label>

          <div style="background: #222; padding: 12px; border-radius: 6px;">
            <strong style="display: block; margin-bottom: 8px;">Simulate Network Profile</strong>
            <select id="wd-netplus-net" style="width: 100%; padding: 10px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 14px;">
              ${h}
            </select>
            <div id="wd-netplus-msg" style="margin-top: 8px; font-size: 11px; color: #888;">
              Throttles app assets + the /v1 API proxy (not cross-origin tiles). Selecting a profile auto-enables Disable Cache — the service worker would serve its precache at full speed otherwise. Reloads the app.
            </div>
          </div>
        </div>
      `;if(typeof d.html==`function`)d.html(g);else throw Error(`eruda plugin API shape unexpected: $el.html missing`);i=f.querySelector(`#wd-netplus-speed`);let _=f.querySelector(`#wd-netplus-cache`),v=f.querySelector(`#wd-netplus-net`);_?.addEventListener(`change`,()=>{let e=_.checked;o(`wd-cache`,e?`off`:null),e?r().then(n):n()}),v?.addEventListener(`change`,()=>{let e=v.value;o(`wd-net`,e||null),e&&s(`wd-cache`)!==`off`&&(o(`wd-cache`,`off`),_&&(_.checked=!0)),e?r().then(n):n()}),a=e(),a?.addEventListener(`change`,l),l()},show(){c&&(c.style.display=`block`)},hide(){c&&(c.style.display=`none`)},destroy(){a?.removeEventListener(`change`,l),a=null,i=null,c=null}}}var a=`wodore:debug`;function o(e,t){document.cookie=t===null?`${e}=; Path=/; Max-Age=0`:`${e}=${t}; Path=/`}function s(e){for(let t of document.cookie.split(`;`)){let n=t.indexOf(`=`);if(n>0&&t.slice(0,n).trim()===e)return t.slice(n+1).trim()||null}return null}var c={eruda:`https://cdn.jsdelivr.net/npm/eruda@3`,timing:`https://cdn.jsdelivr.net/npm/eruda-timing`};function l(){try{return localStorage.getItem(a)===`1`}catch{return!1}}function u(e){try{e?localStorage.setItem(a,`1`):localStorage.removeItem(a)}catch{}}function d(e,t){return new Promise((n,r)=>{if(document.getElementById(t)){n();return}let i=document.createElement(`script`);i.src=e,i.id=t,i.addEventListener(`load`,()=>n(),{once:!0}),i.addEventListener(`error`,()=>r(Error(`debug-tools: failed to load ${e}`)),{once:!0}),document.head.appendChild(i)})}var f=null;function p(){return u(!0),f??=(async()=>{try{await d(c.eruda,`wd-eruda`);let e=window.eruda;if(!e)return;e.init();try{e.position?.({x:Math.round(window.innerWidth/2-20),y:window.innerHeight-60})}catch{}await Promise.allSettled([d(c.timing,`wd-eruda-timing`).then(()=>{window.erudaTiming&&e.add(window.erudaTiming)})]).then(()=>{e.add(i())})}catch(e){console.warn(`[debug-tools] eruda could not be loaded — skipping:`,e)}})(),f}function m(){u(!1),o(`wd-net`,null),o(`wd-cache`,null),window.eruda?.destroy(),f=null}function h(){try{let e=new URL(window.location.href).searchParams.get(`debug`);return e===null?null:e===`1`?(u(!0),`1`):(u(!1),`0`)}catch{return null}}function g(e){try{let t=new URL(window.location.href);if(!t.searchParams.has(`debug`))return;t.searchParams.set(`debug`,e?`1`:`0`),window.history.replaceState(null,``,t.toString())}catch{}}export{u as a,l as i,m as n,g as o,p as r,h as t};
//# sourceMappingURL=debug-tools-CTuvvrDW.js.map