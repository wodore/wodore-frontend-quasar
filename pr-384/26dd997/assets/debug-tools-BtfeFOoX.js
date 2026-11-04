function E(){return navigator.connection??null}const P={slow3g:{label:"Simulated Slow 3G (~400 kbps, +400 ms)",kbps:400},"3g":{label:"Simulated 3G (~800 kbps, +250 ms)",kbps:800},fast3g:{label:"Simulated Fast 3G (~1.6 Mbps, +150 ms)",kbps:1600},slow4g:{label:"Simulated Slow 4G (~3 Mbps, +250 ms)",kbps:3e3}};function c(){window.location.reload()}async function m(){try{const e=await navigator.serviceWorker.getRegistrations();await Promise.all(e.map(n=>n.unregister()));const t=await caches.keys();await Promise.all(t.map(n=>caches.delete(n)))}catch{}}function D(){let e=null,t=null,n=null;const r=()=>{if(!e)return;const o=t?.downlink;e.textContent=typeof o=="number"&&o>0?`${String(o)} Mbps`:"Unavailable"};return{name:"nettools",init(o){const l=o,s=typeof l.get=="function"?l.get(0):o;n=s;const v=g("wd-net")??"",k=g("wd-cache")==="off",x=['<option value="">No throttling (maximum speed)</option>',...Object.entries(P).sort(([,i],[,p])=>i.kbps-p.kbps).map(([i,p])=>`<option value="${i}"${i===v?" selected":""}>${p.label}</option>`)].join(""),S=`
        <div style="padding: 15px; font-family: sans-serif; color: #fff; background: #111; height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch;">
          <h3 style="margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 8px;">Network Utilities</h3>

          <div style="margin-bottom: 20px; background: #222; padding: 12px; border-radius: 6px;">
            <h4 style="margin: 0 0 5px 0; color: #888; font-size: 12px; text-transform: uppercase;">Estimated Downlink</h4>
            <div id="wd-netplus-speed" style="font-size: 24px; font-weight: bold; color: #00ffcc;">…</div>
          </div>

          <label style="display: flex; align-items: center; cursor: pointer; background: #222; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
            <input type="checkbox" id="wd-netplus-cache"${k?" checked":""} style="margin-right: 12px; transform: scale(1.3);">
            <div>
              <strong>Disable Cache</strong>
              <div style="font-size: 11px; color: #888; margin-top: 2px;">No-store + service worker bypass — every load is a cold load. Reloads the app.</div>
            </div>
          </label>

          <div style="background: #222; padding: 12px; border-radius: 6px;">
            <strong style="display: block; margin-bottom: 8px;">Simulate Network Profile</strong>
            <select id="wd-netplus-net" style="width: 100%; padding: 10px; background: #333; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 14px;">
              ${x}
            </select>
            <div id="wd-netplus-msg" style="margin-top: 8px; font-size: 11px; color: #888;">
              Throttles app assets + the /v1 API proxy (not cross-origin tiles). Selecting a profile auto-enables Disable Cache — the service worker would serve its precache at full speed otherwise. Reloads the app.
            </div>
          </div>
        </div>
      `;if(typeof l.html=="function")l.html(S);else throw new Error("eruda plugin API shape unexpected: $el.html missing");e=s.querySelector("#wd-netplus-speed");const d=s.querySelector("#wd-netplus-cache"),w=s.querySelector("#wd-netplus-net");d?.addEventListener("change",()=>{const i=d.checked;a("wd-cache",i?"off":null),i?m().then(c):c()}),w?.addEventListener("change",()=>{const i=w.value;a("wd-net",i||null),i&&g("wd-cache")!=="off"&&(a("wd-cache","off"),d&&(d.checked=!0)),i?m().then(c):c()}),t=E(),t?.addEventListener("change",r),r()},show(){n&&(n.style.display="block")},hide(){n&&(n.style.display="none")},destroy(){t?.removeEventListener("change",r),t=null,e=null,n=null}}}const f="wodore:debug";function a(e,t){document.cookie=t===null?`${e}=; Path=/; Max-Age=0`:`${e}=${t}; Path=/`}function g(e){for(const t of document.cookie.split(";")){const n=t.indexOf("=");if(n>0&&t.slice(0,n).trim()===e)return t.slice(n+1).trim()||null}return null}const b={eruda:"https://cdn.jsdelivr.net/npm/eruda@3",timing:"https://cdn.jsdelivr.net/npm/eruda-timing"};function $(){try{return localStorage.getItem(f)==="1"}catch{return!1}}function u(e){try{e?localStorage.setItem(f,"1"):localStorage.removeItem(f)}catch{}}function y(e,t){return new Promise((n,r)=>{if(document.getElementById(t)){n();return}const o=document.createElement("script");o.src=e,o.id=t,o.addEventListener("load",()=>n(),{once:!0}),o.addEventListener("error",()=>r(new Error(`debug-tools: failed to load ${e}`)),{once:!0}),document.head.appendChild(o)})}let h=null;function C(){return u(!0),h??=(async()=>{try{await y(b.eruda,"wd-eruda");const e=window.eruda;if(!e)return;e.init();try{e.position?.({x:Math.round(window.innerWidth/2-20),y:window.innerHeight-60})}catch{}await Promise.allSettled([y(b.timing,"wd-eruda-timing").then(()=>{window.erudaTiming&&e.add(window.erudaTiming)})]).then(()=>{e.add(D())})}catch(e){console.warn("[debug-tools] eruda could not be loaded — skipping:",e)}})(),h}function L(){u(!1),a("wd-net",null),a("wd-cache",null),window.eruda?.destroy(),h=null}function R(){try{const t=new URL(window.location.href).searchParams.get("debug");return t===null?null:t==="1"?(u(!0),"1"):(u(!1),"0")}catch{return null}}function I(e){try{const t=new URL(window.location.href);if(!t.searchParams.has("debug"))return;t.searchParams.set("debug",e?"1":"0"),window.history.replaceState(null,"",t.toString())}catch{}}export{R as a,u as b,L as d,C as e,$ as i,I as s};
//# sourceMappingURL=debug-tools-BtfeFOoX.js.map
