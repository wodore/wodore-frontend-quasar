import { d as defineComponent, o as openBlock, a as createElementBlock, f as createBaseVNode, e as createVNode, Q as QIcon, M as QBtn, _ as _export_sfc } from "./index-CAHSu7Ql.js";
const _hoisted_1 = { class: "fullscreen bg-primary text-white text-center q-pa-md flex flex-center" };
const _hoisted_2 = { href: "/" };
const _hoisted_3 = /* @__PURE__ */ createBaseVNode("div", {
  style: { "font-size": "12vh" },
  class: "text-white"
}, "404", -1);
const _hoisted_4 = /* @__PURE__ */ createBaseVNode("div", {
  class: "text-h4",
  style: { "opacity": "0.4" }
}, "Oops. Wrong way...", -1);
const _sfc_main = /* @__PURE__ */ defineComponent({
  ...{
    name: "ErrorNotFound"
  },
  __name: "ErrorNotFound",
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", null, [
          createBaseVNode("a", _hoisted_2, [
            createVNode(QIcon, {
              size: "13vh",
              name: "img:/errors/logo_404.svg"
            })
          ]),
          _hoisted_3,
          _hoisted_4,
          createVNode(QBtn, {
            class: "q-mt-xl",
            color: "accent",
            "text-color": "accent",
            to: "/",
            size: "lg",
            label: "back on track",
            flat: "",
            "no-caps": ""
          })
        ])
      ]);
    };
  }
});
const ErrorNotFound = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "ErrorNotFound.vue"]]);
export {
  ErrorNotFound as default
};
