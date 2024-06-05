import { d as defineComponent, t as computed, o as openBlock, c as createBlock, L as withCtx, f as createBaseVNode, e as createVNode, Q as QIcon, n as normalizeStyle, a7 as normalizeClass, ao as toDisplayString, a as createElementBlock, g as createTextVNode, P as createCommentVNode, M as QBtn, _ as _export_sfc, h as createComponent, D as h, F as hSlot, u as useRouter, O as unref, a_ as QCard, a$ as QCardSection, b0 as QSeparator, b1 as QCardActions, b2 as pushScopeId, b3 as popScopeId } from "./index-CAHSu7Ql.js";
import { g as getImageUrl, b as QImg, Q as QScrollArea, a as QSpace } from "./imageService-CRS5yRFk.js";
import { u as useQuasar } from "./use-quasar-dzbiZ5mn.js";
import "./QScrollObserver-9xiBCqI1.js";
import "./use-hydration-DGAnypCl.js";
import "./_commonjsHelpers-Dm6U3U_N.js";
const _hoisted_1$2 = { class: "q-py-md row justify-center" };
const _hoisted_2$1 = {
  key: 0,
  class: "text-caption text-primary-200 col-12"
};
const _hoisted_3$1 = { class: "text-body2" };
const _hoisted_4$1 = /* @__PURE__ */ createBaseVNode("br", null, null, -1);
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "WdStripeBadge",
  props: {
    stripeId: {},
    name: {},
    amount: {},
    icon: {},
    sizeFactor: { default: 1 }
  },
  setup(__props) {
    const props = __props;
    const link = computed(() => {
      return "https://donate.stripe.com/" + props.stripeId + "?locale=de";
    });
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QBtn, {
        href: link.value,
        target: "_blank",
        "no-caps": "",
        style: { "text-transform": "unset" }
      }, {
        default: withCtx(() => [
          createBaseVNode("div", _hoisted_1$2, [
            createVNode(QIcon, {
              style: normalizeStyle([
                "height: " + 40 * _ctx.sizeFactor + "px; width: " + 40 * _ctx.sizeFactor + "px",
                { "filter": "invert()" }
              ]),
              name: "img:products/" + _ctx.icon + ".png",
              class: "col-12"
            }, null, 8, ["style", "name"]),
            createBaseVNode("div", {
              class: normalizeClass(["q-py-lg col-12", {
                "text-white": _ctx.sizeFactor <= 1,
                "text-accent-200": _ctx.sizeFactor > 1
              }]),
              style: normalizeStyle(
                "font-size: " + 15 * (_ctx.sizeFactor > 1 ? _ctx.sizeFactor + (_ctx.sizeFactor - 1) / 8 : 1) + "pt;"
              )
            }, toDisplayString(_ctx.name), 7),
            _ctx.amount ? (openBlock(), createElementBlock("div", _hoisted_2$1, [
              createBaseVNode("span", _hoisted_3$1, toDisplayString(_ctx.amount), 1),
              createTextVNode(" CHF"),
              _hoisted_4$1,
              createTextVNode(" pro Monat* ")
            ])) : createCommentVNode("", true)
          ])
        ]),
        _: 1
      }, 8, ["href"]);
    };
  }
});
const __unplugin_components_1 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__file", "WdStripeBadge.vue"]]);
const _hoisted_1$1 = ["href"];
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "WdStripeLink",
  props: {
    stripeId: {},
    name: {},
    amount: {},
    icon: {}
  },
  setup(__props) {
    const props = __props;
    const link = computed(() => {
      return "https://donate.stripe.com/" + props.stripeId + "?locale=de";
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("a", {
        href: link.value,
        target: "_blank"
      }, [
        createTextVNode(toDisplayString(_ctx.name) + " ", 1),
        _ctx.icon ? (openBlock(), createBlock(QIcon, {
          key: 0,
          name: "img:products/" + _ctx.icon + ".png"
        }, null, 8, ["name"])) : createCommentVNode("", true)
      ], 8, _hoisted_1$1);
    };
  }
});
const __unplugin_components_0 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__file", "WdStripeLink.vue"]]);
const QBtnGroup = createComponent({
  name: "QBtnGroup",
  props: {
    unelevated: Boolean,
    outline: Boolean,
    flat: Boolean,
    rounded: Boolean,
    square: Boolean,
    push: Boolean,
    stretch: Boolean,
    glossy: Boolean,
    spread: Boolean
  },
  setup(props, { slots }) {
    const classes = computed(() => {
      const cls = ["unelevated", "outline", "flat", "rounded", "square", "push", "stretch", "glossy"].filter((t) => props[t] === true).map((t) => `q-btn-group--${t}`).join(" ");
      return `q-btn-group row no-wrap${cls.length !== 0 ? " " + cls : ""}` + (props.spread === true ? " q-btn-group--spread" : " inline");
    });
    return () => h("div", { class: classes.value }, hSlot(slots.default));
  }
});
const _withScopeId = (n) => (pushScopeId("data-v-3e5fe7fd"), n = n(), popScopeId(), n);
const _hoisted_1 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "card-header absolute-bottom text-white text-h5" }, null, -1));
const _hoisted_2 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "absolute-bottom text-accent-400 text-h4 text-center card-header__text" }, " Support ", -1));
const _hoisted_3 = { class: "col no-wrap items-center q-py-md" };
const _hoisted_4 = { class: "text-body1 q-pt-md" };
const _hoisted_5 = { class: "q-pt-lg row justify-center" };
const _hoisted_6 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "text-center" }, [
  /* @__PURE__ */ createBaseVNode("p", { class: "text-body2 q-pt-xs text-secondary-800" }, [
    /* @__PURE__ */ createBaseVNode("a", {
      href: "https://billing.stripe.com/p/login/aEU9AA29o9vv7JucMM",
      target: "_blank"
    }, "Monatliche Zahlungen verwalten."),
    /* @__PURE__ */ createBaseVNode("span", { class: "text-grey-7" }, " *Jederzeit kündbar. ")
  ])
], -1));
const _hoisted_7 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "text-body2 q-pt-md q-pb-md" }, " Das Geld wird für die Infrastruktur, Lizenzen und potentielle neue Features benötigt. ", -1));
const _hoisted_8 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("h5", { class: "q-mb-md q-mt-none" }, "Ich haue gerne selber in die Tasten!", -1));
const _hoisted_9 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("p", null, [
  /* @__PURE__ */ createBaseVNode("b", null, "Super"),
  /* @__PURE__ */ createTextVNode(", aktive Unterstützung ist sehr willkommen, zum Beispiel: "),
  /* @__PURE__ */ createBaseVNode("ul", null, [
    /* @__PURE__ */ createBaseVNode("li", null, "Hütteninfos reviewen und anpassen (als Editor)"),
    /* @__PURE__ */ createBaseVNode("li", null, [
      /* @__PURE__ */ createTextVNode("Entwicklung von Frontend ("),
      /* @__PURE__ */ createBaseVNode("a", {
        href: "https://quasar.dev/",
        target: "_blank"
      }, "Quasar"),
      /* @__PURE__ */ createTextVNode(") oder Backend ("),
      /* @__PURE__ */ createBaseVNode("a", {
        href: "https://www.djangoproject.com/",
        target: "_blank"
      }, "Django"),
      /* @__PURE__ */ createTextVNode(")")
    ]),
    /* @__PURE__ */ createBaseVNode("li", null, "Unterstützung bei Design-Aufgaben"),
    /* @__PURE__ */ createBaseVNode("li", null, "...")
  ])
], -1));
const imgPath = (
  // 'https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg';
  //'https://cdn.pixabay.com/photo/2016/03/19/23/36/hut-1267670_960_720.jpg';
  "https://cdn.pixabay.com/photo/2017/05/13/17/05/hut-2310075_960_720.jpg"
);
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "WdSupportForm",
  setup(__props) {
    const $q = useQuasar();
    const router = useRouter();
    function onClose() {
      router.go(-1);
    }
    const headerImg = getImageUrl(imgPath, {
      //focal: '0.5,0.55',
      focal: "0.5,0.45",
      size: "800x300",
      quality: 50
      //filters: ['grayscale()'],
    });
    console.log(headerImg);
    function toFeedback() {
      router.replace({ name: "feedback" });
    }
    return (_ctx, _cache) => {
      const _component_WdStripeLink = __unplugin_components_0;
      const _component_WdStripeBadge = __unplugin_components_1;
      return openBlock(), createBlock(QCard, {
        class: normalizeClass({ "card--desktop": unref($q).screen.gt.xs, "card--mobile": unref($q).screen.xs })
      }, {
        default: withCtx(() => [
          createBaseVNode("div", null, [
            createVNode(QImg, {
              src: unref(headerImg),
              style: { "height": "140px" },
              class: "shadow-4"
            }, {
              default: withCtx(() => [
                _hoisted_1,
                _hoisted_2
              ]),
              _: 1
            }, 8, ["src"])
          ]),
          createVNode(QCardSection, { style: { "padding": "0", "height": "calc(100% - 196px)" } }, {
            default: withCtx(() => [
              createVNode(QScrollArea, {
                class: "fit",
                style: { "padding": "0 16px 0 16px" },
                "thumb-style": {
                  width: "6px",
                  borderRadius: "8px 0 0 8px"
                }
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_3, [
                    createBaseVNode("p", _hoisted_4, [
                      createTextVNode(" Unterstütze das Projekt mit "),
                      createBaseVNode("a", {
                        class: "link",
                        onClick: toFeedback
                      }, "Feedback"),
                      createTextVNode(", einem "),
                      createVNode(_component_WdStripeLink, {
                        "stripe-id": "28o02Oda19qnbiE28a",
                        name: "Trinkgeld",
                        icon: "tip",
                        class: "link",
                        onClick: onClose
                      }),
                      createTextVNode(" oder einem monatlichem: ")
                    ]),
                    createBaseVNode("div", _hoisted_5, [
                      createVNode(QBtnGroup, { style: { "border-radius": "40px", "max-width": "400px" } }, {
                        default: withCtx(() => [
                          createVNode(_component_WdStripeBadge, {
                            "stripe-id": "9AQ16S2vn1XV3QcbIO",
                            name: "Snickers",
                            amount: "1.50",
                            color: "primary-800",
                            icon: "snickers",
                            class: "col",
                            onClick: onClose
                          }),
                          createVNode(_component_WdStripeBadge, {
                            "stripe-id": "bIY6rcc5X8mj2M87sz",
                            name: "Bier",
                            amount: "4",
                            color: "primary-900",
                            icon: "beer",
                            "size-factor": 1.5,
                            style: { "overflow": "hidden", "z-index": "5", "min-width": "140px", "width": "150px", "max-width": "160px" },
                            class: "shadow-6 col-auto",
                            onClick: onClose
                          }),
                          createVNode(_component_WdStripeBadge, {
                            "stripe-id": "8wM2aW0nf0TRgCY6or",
                            name: "Essen",
                            amount: "15",
                            color: "primary-800",
                            icon: "lunch",
                            class: "col",
                            onClick: onClose
                          })
                        ]),
                        _: 1
                      }),
                      _hoisted_6
                    ]),
                    _hoisted_7,
                    createVNode(QCard, { class: "text-body2 bg-secondary-900 text-white q-my-lg" }, {
                      default: withCtx(() => [
                        createVNode(QCardSection, null, {
                          default: withCtx(() => [
                            _hoisted_8,
                            _hoisted_9,
                            createTextVNode(" Bitte trete mit uns in "),
                            createBaseVNode("a", { onClick: toFeedback }, "Kontakt"),
                            createTextVNode("! ")
                          ]),
                          _: 1
                        })
                      ]),
                      _: 1
                    })
                  ])
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(QSeparator),
          createVNode(QCardActions, null, {
            default: withCtx(() => [
              createVNode(QSpace),
              createVNode(QBtn, {
                label: "Schliessen",
                color: "secondary-700",
                flat: "",
                onClick: _cache[0] || (_cache[0] = ($event) => onClose()),
                class: "q-ml-sm"
              })
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["class"]);
    };
  }
});
const WdSupportForm = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3e5fe7fd"], ["__file", "WdSupportForm.vue"]]);
export {
  WdSupportForm as default
};
