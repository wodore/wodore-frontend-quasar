function a(){if(typeof window>"u")return!0;try{const t=window.localStorage.getItem("umami.disabled");return t!==null&&t!=="false"}catch{return!1}}function i(t,e){if(!a())if(typeof umami<"u")console.debug('track data: "'+t+'"',e),umami.track(t,e);else{console.warn("Umami is not available.");return}}export{i as t,a as u};
//# sourceMappingURL=analytics-BWw6z3B_.js.map
