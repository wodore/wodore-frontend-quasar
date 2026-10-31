function i(e,o=1500){return typeof window>"u"?Promise.resolve().then(e):typeof window.requestIdleCallback=="function"?new Promise(n=>{window.requestIdleCallback(()=>n(e()),{timeout:o})}):new Promise(n=>{window.setTimeout(()=>n(e()),200)})}export{i as w};
//# sourceMappingURL=idle-DC5trgwT.js.map
