# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic: preview
    - generic [ref=e4]:
      - button [ref=e7] [cursor=pointer]:
        - generic [ref=e9]: 
      - button "Availability Choose date" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: 
        - generic [ref=e16]:
          - generic [ref=e17]: Availability
          - generic [ref=e18]: Choose date
      - button "menu" [ref=e21] [cursor=pointer]:
        - generic [ref=e23]: 
    - main [ref=e26]:
      - img [ref=e28]
  - generic [ref=e41]:
    - generic [ref=e42]: "[plugin:vite:vue] [vue/compiler-sfc] Unexpected token, expected \",\" (78:95) /home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/src/components/map/controls/WdOverlayControl.vue 80 | dt.effectAllowed = 'move';"
    - generic [ref=e43]: /home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/src/components/map/controls/WdOverlayControl.vue:78:95
    - generic [ref=e44]: "76 | function onDragStart(ev: MouseEvent, slug: string): void { 77 | dragSlug.value = slug; 78 | ...= (ev as unknown as { dataTransfer?: { effectAllowed: string; setData: (type: string; value: string) => void } }).... | ^ 79 | if (dt) { 80 | dt.effectAllowed = 'move';"
    - generic [ref=e45]: at constructor (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:369:19) at TypeScriptParserMixin.raise (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:6622:19) at TypeScriptParserMixin.unexpected (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:6642:16) at TypeScriptParserMixin.expect (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:6922:12) at TypeScriptParserMixin.parseBindingList (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:7389:14) at TypeScriptParserMixin.tsParseBindingListForSignature (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:8115:24) at TypeScriptParserMixin.tsFillSignature (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:8107:33) at /home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:8402:54 at TypeScriptParserMixin.tsInAllowConditionalTypesContext (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:8838:14) at TypeScriptParserMixin.tsParseFunctionOrConstructorType (/home/runner/work/wodore-frontend-quasar/wodore-frontend-quasar/node_modules/@vue/compiler-sfc/node_modules/@babel/parser/lib/index.js:8402:10)
    - generic [ref=e46]:
      - text: Click outside, press Esc key, or fix the code to dismiss.
      - text: You can also disable this overlay by setting
      - code [ref=e47]: server.hmr.overlay
      - text: to
      - code [ref=e48]: "false"
      - text: in
      - code [ref=e49]: vite.config.js
      - text: .
```