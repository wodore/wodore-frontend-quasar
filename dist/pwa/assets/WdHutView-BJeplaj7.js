import { o as openBlock, a as createElementBlock, f as createBaseVNode, h as createComponent, j as useDarkProps, ai as useSizeProps, l as getCurrentInstance, m as useDark, aj as useSize, t as computed, E as hDir, D as h$1, Q as QIcon, ak as hMergeSlotSafely, al as Ripple, am as stopAndPrevent, d as defineComponent, c as createBlock, L as withCtx, e as createVNode, an as QAvatar, a7 as normalizeClass, ao as toDisplayString, ap as renderSlot, P as createCommentVNode, _ as _export_sfc, s as ref, O as unref, R as Fragment, aq as renderList, ar as reactive, x as watch, A as nextTick, as as onUnmounted, z as onMounted, n as normalizeStyle, C as withDirectives, at as vShow, N as resolveDynamicComponent, g as createTextVNode, F as hSlot, au as useRouterLinkProps, av as useRouterLink, aw as isKeyCode, ax as hUniqueSlot, ay as hMergeSlot, M as QBtn, az as createDirective, aA as isDeepEqual, aB as addFocusout, aC as removeFocusout, a3 as storeToRefs, a8 as watchEffect } from "./index-CAHSu7Ql.js";
import { u as useI18n } from "./vue-i18n.runtime-C_2yXRtR.js";
import { Q as QScrollArea, a as QSpace, g as getImageUrl, b as QImg } from "./imageService-CRS5yRFk.js";
import { u as useQuasar } from "./use-quasar-dzbiZ5mn.js";
import { c as QToolbar, d as QToolbarTitle, e as QHeader, a as QMenu, C as ClosePopup, _ as __unplugin_components_0$4, b as QLayout, f as QPageContainer, Q as QFooter } from "./QLayout-dy4ACE5e.js";
import { u as ut } from "./vue-maplibre-gl.es-ZH3R_aa8.js";
import { Q as QTooltip } from "./QTooltip-H8kXt2o5.js";
import { Q as QPage } from "./QPage-BWOFWlQo.js";
import { c as clientWodore } from "./index-BAtqSMr7.js";
import { b as useHutsStore } from "./huts-store-B8KO_l-F.js";
import "./QScrollObserver-9xiBCqI1.js";
import "./use-hydration-DGAnypCl.js";
import "./_commonjsHelpers-Dm6U3U_N.js";
const _hoisted_1$e = {
  viewBox: "0 0 448 512",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$a = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M208 0h124.1C344.8 0 357 5.1 366 14.1L433.9 82c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48M48 128h80v64H64v256h192v-32h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48"
}, null, -1);
const _hoisted_3$8 = [
  _hoisted_2$a
];
function render$6(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$e, [..._hoisted_3$8]);
}
const __unplugin_components_8 = { name: "fa6-solid-copy", render: render$6 };
const _hoisted_1$d = {
  viewBox: "0 0 512 512",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$9 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M256 0c17.7 0 32 14.3 32 32v34.7c80.4 13.4 143.9 76.9 157.3 157.3H480c17.7 0 32 14.3 32 32s-14.3 32-32 32h-34.7c-13.4 80.4-76.9 143.9-157.3 157.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32v-34.7C143.6 431.9 80.1 368.4 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32h34.7C80.1 143.6 143.6 80.1 224 66.7V32c0-17.7 14.3-32 32-32M128 256a128 128 0 1 0 256 0a128 128 0 1 0-256 0m128-80a80 80 0 1 1 0 160a80 80 0 1 1 0-160"
}, null, -1);
const _hoisted_3$7 = [
  _hoisted_2$9
];
function render$5(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$d, [..._hoisted_3$7]);
}
const __unplugin_components_7 = { name: "fa6-solid-location-crosshairs", render: render$5 };
const defaultSizes = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24
};
const QChip = createComponent({
  name: "QChip",
  props: {
    ...useDarkProps,
    ...useSizeProps,
    dense: Boolean,
    icon: String,
    iconRight: String,
    iconRemove: String,
    iconSelected: String,
    label: [String, Number],
    color: String,
    textColor: String,
    modelValue: {
      type: Boolean,
      default: true
    },
    selected: {
      type: Boolean,
      default: null
    },
    square: Boolean,
    outline: Boolean,
    clickable: Boolean,
    removable: Boolean,
    removeAriaLabel: String,
    tabindex: [String, Number],
    disable: Boolean,
    ripple: {
      type: [Boolean, Object],
      default: true
    }
  },
  emits: ["update:modelValue", "update:selected", "remove", "click"],
  setup(props, { slots, emit }) {
    const { proxy: { $q } } = getCurrentInstance();
    const isDark = useDark(props, $q);
    const sizeStyle = useSize(props, defaultSizes);
    const hasLeftIcon = computed(() => props.selected === true || props.icon !== void 0);
    const leftIcon = computed(() => props.selected === true ? props.iconSelected || $q.iconSet.chip.selected : props.icon);
    const removeIcon = computed(() => props.iconRemove || $q.iconSet.chip.remove);
    const isClickable = computed(
      () => props.disable === false && (props.clickable === true || props.selected !== null)
    );
    const classes = computed(() => {
      const text = props.outline === true ? props.color || props.textColor : props.textColor;
      return "q-chip row inline no-wrap items-center" + (props.outline === false && props.color !== void 0 ? ` bg-${props.color}` : "") + (text ? ` text-${text} q-chip--colored` : "") + (props.disable === true ? " disabled" : "") + (props.dense === true ? " q-chip--dense" : "") + (props.outline === true ? " q-chip--outline" : "") + (props.selected === true ? " q-chip--selected" : "") + (isClickable.value === true ? " q-chip--clickable cursor-pointer non-selectable q-hoverable" : "") + (props.square === true ? " q-chip--square" : "") + (isDark.value === true ? " q-chip--dark q-dark" : "");
    });
    const attributes = computed(() => {
      const chip = props.disable === true ? { tabindex: -1, "aria-disabled": "true" } : { tabindex: props.tabindex || 0 };
      const remove = {
        ...chip,
        role: "button",
        "aria-hidden": "false",
        "aria-label": props.removeAriaLabel || $q.lang.label.remove
      };
      return { chip, remove };
    });
    function onKeyup(e) {
      e.keyCode === 13 && onClick(e);
    }
    function onClick(e) {
      if (!props.disable) {
        emit("update:selected", !props.selected);
        emit("click", e);
      }
    }
    function onRemove(e) {
      if (e.keyCode === void 0 || e.keyCode === 13) {
        stopAndPrevent(e);
        if (props.disable === false) {
          emit("update:modelValue", false);
          emit("remove");
        }
      }
    }
    function getContent() {
      const child = [];
      isClickable.value === true && child.push(
        h$1("div", { class: "q-focus-helper" })
      );
      hasLeftIcon.value === true && child.push(
        h$1(QIcon, {
          class: "q-chip__icon q-chip__icon--left",
          name: leftIcon.value
        })
      );
      const label = props.label !== void 0 ? [h$1("div", { class: "ellipsis" }, [props.label])] : void 0;
      child.push(
        h$1("div", {
          class: "q-chip__content col row no-wrap items-center q-anchor--skip"
        }, hMergeSlotSafely(slots.default, label))
      );
      props.iconRight && child.push(
        h$1(QIcon, {
          class: "q-chip__icon q-chip__icon--right",
          name: props.iconRight
        })
      );
      props.removable === true && child.push(
        h$1(QIcon, {
          class: "q-chip__icon q-chip__icon--remove cursor-pointer",
          name: removeIcon.value,
          ...attributes.value.remove,
          onClick: onRemove,
          onKeyup: onRemove
        })
      );
      return child;
    }
    return () => {
      if (props.modelValue === false)
        return;
      const data = {
        class: classes.value,
        style: sizeStyle.value
      };
      isClickable.value === true && Object.assign(
        data,
        attributes.value.chip,
        { onClick, onKeyup }
      );
      return hDir(
        "div",
        data,
        getContent(),
        "ripple",
        props.ripple !== false && props.disable !== true,
        () => [[Ripple, props.ripple]]
      );
    };
  }
});
const _hoisted_1$c = { class: "text-primary-900" };
const _sfc_main$a = /* @__PURE__ */ defineComponent({
  __name: "WdHutTypeNameChip",
  props: {
    type: {},
    name: {},
    color: { default: "white" },
    color2: {}
  },
  setup(__props) {
    const props = __props;
    const color_bg = computed(() => props.color2 ? props.color2 : "white");
    return (_ctx, _cache) => {
      return _ctx.type && _ctx.type.name ? (openBlock(), createBlock(QChip, {
        key: 0,
        size: "md",
        class: normalizeClass("bg-" + color_bg.value + " q-mr-none"),
        style: { "min-width": "40px", "max-width": "200px", "max-height": "30px" }
      }, {
        default: withCtx(() => [
          createVNode(QAvatar, {
            class: normalizeClass("bg-" + _ctx.color),
            "text-color": "white"
          }, {
            default: withCtx(() => [
              createVNode(QIcon, {
                size: "24px",
                name: "img:" + (_ctx.$q.platform.is.mobile ? _ctx.type.symbol : _ctx.type.symbol_simple)
              }, null, 8, ["name"])
            ]),
            _: 1
          }, 8, ["class"]),
          createBaseVNode("span", _hoisted_1$c, toDisplayString(_ctx.name), 1),
          renderSlot(_ctx.$slots, "default")
        ]),
        _: 3
      }, 8, ["class"])) : createCommentVNode("", true);
    };
  }
});
const __unplugin_components_1$2 = /* @__PURE__ */ _export_sfc(_sfc_main$a, [["__file", "WdHutTypeNameChip.vue"]]);
const monthList = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12"
];
function useMonthly() {
  const { t } = useI18n();
  const monthNames = ref({
    "01": t("jan"),
    "02": t("feb"),
    "03": t("mar"),
    "04": t("apr"),
    "05": t("may"),
    "06": t("jun"),
    "07": t("jul"),
    "08": t("aug"),
    "09": t("sep"),
    "10": t("oct"),
    "11": t("nov"),
    "12": t("dec")
  });
  function getMonthName(month) {
    return monthNames.value[month];
  }
  return { monthList, monthNames, getMonthName };
}
const iconSwitch = {
  yes: { main0: "open" },
  no: { main0: "closed" },
  maybe: { main0: "open", main1: "closed" },
  unknown: { main0: "unknown" }
};
const iconMaybeSwitch = {
  yes: {
    maybe: {
      yes: { main0: "open", minor: "closed" },
      no: { main0: "open", main1: "closed" },
      maybe: { main0: "open", minor: "closed" },
      unknown: { main0: "open", minor: "closed" }
    }
  },
  no: {
    maybe: {
      yes: { main0: "closed", main1: "open" },
      no: { main0: "closed", minor: "open" },
      maybe: { main0: "closed", minor: "open" },
      unknown: { main0: "closed", minor: "open" }
    }
  },
  maybe: {
    maybe: {
      yes: { main0: "open", minor: "closed" },
      no: { main0: "closed", minor: "open" },
      maybe: { main0: "open", minor: "closed" },
      unknown: { main0: "open", minor: "closed" }
    }
  },
  unknown: {
    maybe: {
      yes: { main0: "open", minor: "closed" },
      no: { main0: "closed", minor: "open" },
      maybe: { main0: "open", minor: "closed" },
      unknown: { main0: "open", minor: "closed" }
    }
  }
};
const _hoisted_1$b = { class: "q-ma-xs row items-center justify-center no-wrap" };
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "WdMonthly",
  props: {
    month: {},
    icons: {}
  },
  setup(__props) {
    const { getMonthName } = useMonthly();
    const props = __props;
    const monthName = computed(() => getMonthName(props.month));
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["card column items-center overflow-hidden q-mb-xs", "month_" + _ctx.month + "--gradient-light"])
      }, [
        createBaseVNode("div", {
          class: normalizeClass(["text-caption header text-center row justify-center", "month_" + _ctx.month + "--gradient"])
        }, toDisplayString(monthName.value), 3),
        createBaseVNode("div", _hoisted_1$b, [
          createVNode(QIcon, {
            size: "24px",
            name: _ctx.icons.main0
          }, null, 8, ["name"]),
          _ctx.icons.main1 ? (openBlock(), createBlock(QIcon, {
            key: 0,
            size: "24px",
            name: _ctx.icons.main1
          }, null, 8, ["name"])) : createCommentVNode("", true),
          _ctx.icons.minor ? (openBlock(), createBlock(QIcon, {
            key: 1,
            size: "20px",
            name: _ctx.icons.minor,
            style: { "transform": "translate(-2px, 7px)" }
          }, null, 8, ["name"])) : createCommentVNode("", true)
        ])
      ], 2);
    };
  }
});
const __unplugin_components_0$3 = /* @__PURE__ */ _export_sfc(_sfc_main$9, [["__scopeId", "data-v-f695df66"], ["__file", "WdMonthly.vue"]]);
const _hoisted_1$a = { key: 0 };
const _hoisted_2$8 = { class: "text-subtitle1 text-accent q-mb-sm" };
const _hoisted_3$6 = {
  key: 0,
  class: "row monthly overflow-hidden"
};
const _hoisted_4$3 = { style: { "height": "50px", "width": "700px" } };
const _hoisted_5$1 = { class: "row monthly overflow-hidden" };
const _hoisted_6$1 = { class: "justify-center row q-my-sm" };
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "WdHutOpenMonthly",
  props: {
    open_monthly: {},
    type_open: {},
    type_closed: {}
  },
  setup(__props) {
    const $q = useQuasar();
    const props = __props;
    const isMobile = computed(() => $q.platform.is.mobile);
    function isMonthOpen(month) {
      let res;
      if (props.open_monthly) {
        res = props.open_monthly["month_" + month];
      } else {
        return "unknown";
      }
      if (res === void 0) {
        return "unknown";
      }
      return res;
    }
    function getMonthIcons(month) {
      const idx = parseInt(month);
      const prevMonth = (idx >= 0 ? idx - 1 : 11).toString().padStart(2, "0");
      const nextMonth = (idx >= 11 ? 0 : idx + 1).toString().padStart(2, "0");
      const monthAns = isMonthOpen(month);
      const prevMonthAns = isMonthOpen(prevMonth);
      const nextMonthAns = isMonthOpen(nextMonth);
      let r;
      if (monthAns == "maybe") {
        r = iconMaybeSwitch[prevMonthAns][monthAns][nextMonthAns];
      } else {
        r = iconSwitch[monthAns];
      }
      return {
        main0: getIconAnswer(r.main0) === void 0 ? getUnknownIcon() : getIconAnswer(r.main0),
        main1: getIconAnswer(r.main1),
        minor: getIconAnswer(r.minor)
      };
    }
    function getIconAnswer(answer) {
      if (answer == "open") {
        return getOpenIcon();
      } else if (answer == "closed") {
        return getClosedIcon();
      } else if (answer == "unknown") {
        return getUnknownIcon();
      } else {
        return void 0;
      }
    }
    function getClosedIcon() {
      if (isMobile.value) {
        return props.type_closed ? "img:" + props.type_closed.symbol : getUnknownIcon();
      } else {
        return props.type_closed ? "img:" + props.type_closed.symbol_simple : getUnknownIcon();
      }
    }
    function getOpenIcon() {
      if (isMobile.value) {
        return "img:" + props.type_open?.symbol;
      } else {
        return "img:" + props.type_open?.symbol_simple;
      }
    }
    function getUnknownIcon() {
      if (isMobile.value) {
        return "img:https://api.wodore.com/media/huts/types/symbols/detailed/unknown.png";
      } else {
        return "img:https://api.wodore.com/media/huts/types/symbols/simple/unknown.png";
      }
    }
    return (_ctx, _cache) => {
      const _component_WdMonthly = __unplugin_components_0$3;
      const _component_WdHutTypeNameChip = __unplugin_components_1$2;
      return props.open_monthly ? (openBlock(), createElementBlock("div", _hoisted_1$a, [
        createBaseVNode("div", _hoisted_2$8, toDisplayString(_ctx.$t("hut_type")), 1),
        !unref($q).platform.is.mobile ? (openBlock(), createElementBlock("div", _hoisted_3$6, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(monthList), (m) => {
            return openBlock(), createElementBlock("div", {
              key: m,
              class: "col-md-2 col-sm-1 col-2"
            }, [
              createVNode(_component_WdMonthly, {
                icons: getMonthIcons(m),
                month: m
              }, null, 8, ["icons", "month"])
            ]);
          }), 128))
        ])) : createCommentVNode("", true),
        unref($q).platform.is.mobile ? (openBlock(), createBlock(QScrollArea, {
          key: 1,
          style: { "height": "55px" },
          class: "monthly overflow-hidden",
          "horizontal-thumb-style": { height: "3px" }
        }, {
          default: withCtx(() => [
            createBaseVNode("div", _hoisted_4$3, [
              createBaseVNode("div", _hoisted_5$1, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(unref(monthList), (m) => {
                  return openBlock(), createElementBlock("div", {
                    key: m,
                    class: "col-1"
                  }, [
                    createVNode(_component_WdMonthly, {
                      icons: getMonthIcons(m),
                      month: m
                    }, null, 8, ["icons", "month"])
                  ]);
                }), 128))
              ])
            ])
          ]),
          _: 1
        })) : createCommentVNode("", true),
        createBaseVNode("div", _hoisted_6$1, [
          _ctx.type_open ? (openBlock(), createBlock(_component_WdHutTypeNameChip, {
            key: 0,
            class: "col-shrink",
            type: _ctx.type_open,
            name: _ctx.type_open.name,
            color: "green-4",
            color2: "green-2"
          }, null, 8, ["type", "name"])) : createCommentVNode("", true),
          _ctx.type_closed ? (openBlock(), createBlock(_component_WdHutTypeNameChip, {
            key: 1,
            class: "col-shrink",
            type: _ctx.type_closed,
            name: _ctx.type_closed.name,
            color: "brown-3",
            color2: "brown-2"
          }, null, 8, ["type", "name"])) : createCommentVNode("", true)
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
const __unplugin_components_6 = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["__scopeId", "data-v-055153b8"], ["__file", "WdHutOpenMonthly.vue"]]);
var raf = null;
function requestAnimationFrame(callback) {
  if (!raf) {
    raf = (window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback2) {
      return setTimeout(callback2, 16);
    }).bind(window);
  }
  return raf(callback);
}
var caf = null;
function cancelAnimationFrame(id) {
  if (!caf) {
    caf = (window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || function(id2) {
      clearTimeout(id2);
    }).bind(window);
  }
  caf(id);
}
function createStyles(styleText) {
  var style2 = document.createElement("style");
  if (style2.styleSheet) {
    style2.styleSheet.cssText = styleText;
  } else {
    style2.appendChild(document.createTextNode(styleText));
  }
  (document.querySelector("head") || document.body).appendChild(style2);
  return style2;
}
function createElement(tagName, props) {
  if (props === void 0)
    props = {};
  var elem = document.createElement(tagName);
  Object.keys(props).forEach(function(key) {
    elem[key] = props[key];
  });
  return elem;
}
function getComputedStyle(elem, prop, pseudo) {
  var computedStyle = window.getComputedStyle(elem, null) || {
    display: "none"
  };
  return computedStyle[prop];
}
function getRenderInfo(elem) {
  if (!document.documentElement.contains(elem)) {
    return {
      detached: true,
      rendered: false
    };
  }
  var current = elem;
  while (current !== document) {
    if (getComputedStyle(current, "display") === "none") {
      return {
        detached: false,
        rendered: false
      };
    }
    current = current.parentNode;
  }
  return {
    detached: false,
    rendered: true
  };
}
var css_248z = '.resize-triggers{visibility:hidden;opacity:0;pointer-events:none}.resize-contract-trigger,.resize-contract-trigger:before,.resize-expand-trigger,.resize-triggers{content:"";position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden}.resize-contract-trigger,.resize-expand-trigger{background:#eee;overflow:auto}.resize-contract-trigger:before{width:200%;height:200%}';
var total = 0;
var style = null;
function addListener(elem, callback) {
  if (!elem.__resize_mutation_handler__) {
    elem.__resize_mutation_handler__ = handleMutation.bind(elem);
  }
  var listeners = elem.__resize_listeners__;
  if (!listeners) {
    elem.__resize_listeners__ = [];
    if (window.ResizeObserver) {
      var offsetWidth = elem.offsetWidth;
      var offsetHeight = elem.offsetHeight;
      var ro = new ResizeObserver(function() {
        if (!elem.__resize_observer_triggered__) {
          elem.__resize_observer_triggered__ = true;
          if (elem.offsetWidth === offsetWidth && elem.offsetHeight === offsetHeight) {
            return;
          }
        }
        runCallbacks(elem);
      });
      var ref2 = getRenderInfo(elem);
      var detached = ref2.detached;
      var rendered = ref2.rendered;
      elem.__resize_observer_triggered__ = detached === false && rendered === false;
      elem.__resize_observer__ = ro;
      ro.observe(elem);
    } else if (elem.attachEvent && elem.addEventListener) {
      elem.__resize_legacy_resize_handler__ = function handleLegacyResize() {
        runCallbacks(elem);
      };
      elem.attachEvent("onresize", elem.__resize_legacy_resize_handler__);
      document.addEventListener("DOMSubtreeModified", elem.__resize_mutation_handler__);
    } else {
      if (!total) {
        style = createStyles(css_248z);
      }
      initTriggers(elem);
      elem.__resize_rendered__ = getRenderInfo(elem).rendered;
      if (window.MutationObserver) {
        var mo = new MutationObserver(elem.__resize_mutation_handler__);
        mo.observe(document, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true
        });
        elem.__resize_mutation_observer__ = mo;
      }
    }
  }
  elem.__resize_listeners__.push(callback);
  total++;
}
function removeListener(elem, callback) {
  var listeners = elem.__resize_listeners__;
  if (!listeners) {
    return;
  }
  if (callback) {
    listeners.splice(listeners.indexOf(callback), 1);
  }
  if (!listeners.length || !callback) {
    if (elem.detachEvent && elem.removeEventListener) {
      elem.detachEvent("onresize", elem.__resize_legacy_resize_handler__);
      document.removeEventListener("DOMSubtreeModified", elem.__resize_mutation_handler__);
      return;
    }
    if (elem.__resize_observer__) {
      elem.__resize_observer__.unobserve(elem);
      elem.__resize_observer__.disconnect();
      elem.__resize_observer__ = null;
    } else {
      if (elem.__resize_mutation_observer__) {
        elem.__resize_mutation_observer__.disconnect();
        elem.__resize_mutation_observer__ = null;
      }
      elem.removeEventListener("scroll", handleScroll);
      elem.removeChild(elem.__resize_triggers__.triggers);
      elem.__resize_triggers__ = null;
    }
    elem.__resize_listeners__ = null;
  }
  if (!--total && style) {
    style.parentNode.removeChild(style);
  }
}
function getUpdatedSize(elem) {
  var ref2 = elem.__resize_last__;
  var width = ref2.width;
  var height = ref2.height;
  var offsetWidth = elem.offsetWidth;
  var offsetHeight = elem.offsetHeight;
  if (offsetWidth !== width || offsetHeight !== height) {
    return {
      width: offsetWidth,
      height: offsetHeight
    };
  }
  return null;
}
function handleMutation() {
  var ref2 = getRenderInfo(this);
  var rendered = ref2.rendered;
  var detached = ref2.detached;
  if (rendered !== this.__resize_rendered__) {
    if (!detached && this.__resize_triggers__) {
      resetTriggers(this);
      this.addEventListener("scroll", handleScroll, true);
    }
    this.__resize_rendered__ = rendered;
    runCallbacks(this);
  }
}
function handleScroll() {
  var this$1$1 = this;
  resetTriggers(this);
  if (this.__resize_raf__) {
    cancelAnimationFrame(this.__resize_raf__);
  }
  this.__resize_raf__ = requestAnimationFrame(function() {
    var updated = getUpdatedSize(this$1$1);
    if (updated) {
      this$1$1.__resize_last__ = updated;
      runCallbacks(this$1$1);
    }
  });
}
function runCallbacks(elem) {
  if (!elem || !elem.__resize_listeners__) {
    return;
  }
  elem.__resize_listeners__.forEach(function(callback) {
    callback.call(elem, elem);
  });
}
function initTriggers(elem) {
  var position = getComputedStyle(elem, "position");
  if (!position || position === "static") {
    elem.style.position = "relative";
  }
  elem.__resize_old_position__ = position;
  elem.__resize_last__ = {};
  var triggers = createElement("div", {
    className: "resize-triggers"
  });
  var expand = createElement("div", {
    className: "resize-expand-trigger"
  });
  var expandChild = createElement("div");
  var contract = createElement("div", {
    className: "resize-contract-trigger"
  });
  expand.appendChild(expandChild);
  triggers.appendChild(expand);
  triggers.appendChild(contract);
  elem.appendChild(triggers);
  elem.__resize_triggers__ = {
    triggers,
    expand,
    expandChild,
    contract
  };
  resetTriggers(elem);
  elem.addEventListener("scroll", handleScroll, true);
  elem.__resize_last__ = {
    width: elem.offsetWidth,
    height: elem.offsetHeight
  };
}
function resetTriggers(elem) {
  var ref2 = elem.__resize_triggers__;
  var expand = ref2.expand;
  var expandChild = ref2.expandChild;
  var contract = ref2.contract;
  var csw = contract.scrollWidth;
  var csh = contract.scrollHeight;
  var eow = expand.offsetWidth;
  var eoh = expand.offsetHeight;
  var esw = expand.scrollWidth;
  var esh = expand.scrollHeight;
  contract.scrollLeft = csw;
  contract.scrollTop = csh;
  expandChild.style.width = eow + 1 + "px";
  expandChild.style.height = eoh + 1 + "px";
  expand.scrollLeft = esw;
  expand.scrollTop = esh;
}
const g = ["aria-label"];
var v = defineComponent({ __name: "text-clamp", props: { text: { type: String, required: true }, maxHeight: { type: [String, Number], required: false }, maxLines: { type: Number, required: false }, expanded: { type: Boolean, required: false, default: false }, location: { type: String, required: false, default: "end" }, ellipsis: { type: String, required: false, default: "…" }, autoResize: { type: Boolean, required: false, default: false } }, emits: ["clamp-change", "update:expanded"], setup(e, { emit: v2 }) {
  const h2 = e, y2 = ref(null), b = ref(null), E = ref(null), H = reactive({ offset: 0, localExpanded: !!h2.expanded, unregisterResizeCallback: null }), R = computed(() => {
    if (!H.localExpanded && h2.maxHeight)
      return "number" == typeof h2?.maxHeight ? `${h2?.maxHeight}px` : h2?.maxHeight;
  }), _ = () => {
    E.value && (E.value.textContent = A.value);
  }, k = () => {
    H.localExpanded || (_(), (C() || w.value) && $());
  }, q = () => {
    h2.text && (H.offset = h2.text.length, z(), h2.autoResize && y2.value && (addListener(y2.value, k), H.unregisterResizeCallback = () => {
      y2.value && removeListener(y2.value, k);
    }), k());
  }, z = () => {
    H.unregisterResizeCallback?.();
  }, C = () => !(!h2.maxLines && !h2.maxHeight) && (!!y2.value && (!!(h2.maxLines && L() > h2.maxLines) || !!(h2.maxHeight && y2.value.scrollHeight > y2.value.offsetHeight))), L = () => b.value ? Object.keys(Array.prototype.slice.call(b.value.getClientRects()).reduce((e2, { top: t, bottom: a }) => {
    const l = `${t}/${a}`;
    return e2[l] || (e2[l] = true), e2;
  }, {})).length : 0, $ = (...e2) => {
    const [t = 0, a = H.offset] = e2;
    if (a - t <= 3)
      return void j();
    const l = Math.floor((a + t) / 2);
    S(l), C() ? $(t, l) : $(l, a);
  }, S = (e2) => {
    H.offset = e2, _();
  }, j = () => {
    B(), M();
  }, B = () => {
    for (; (!C() || L() < 2) && H.offset < h2.text.length; )
      N(1);
  }, M = () => {
    for (; C() && L() > 1 && H.offset > 0; )
      N(-1);
  }, N = (e2) => {
    S(H.offset + e2);
  }, w = computed(() => !!h2.text && H.offset !== h2.text.length);
  watch(() => w.value, (e2) => {
    setTimeout(() => {
      v2("clamp-change", e2);
    }, 0);
  }, { immediate: true });
  const A = computed(() => w.value ? O.value : h2.text), O = computed(() => {
    if ("start" === h2.location)
      return h2.ellipsis + (h2.text.slice(-H.offset) || "").trim();
    if ("middle" === h2.location) {
      const e2 = Math.floor(H.offset / 2);
      return (h2.text.slice(0, e2) || "").trim() + h2.ellipsis + (h2.text.slice(-e2) || "").trim();
    }
    return (h2.text.slice(0, H.offset) || "").trim() + h2.ellipsis;
  }), T = () => {
    H.localExpanded = true;
  }, D = () => {
    H.localExpanded = false;
  }, F = () => {
    H.localExpanded = !H.localExpanded;
  };
  return watch(() => h2.expanded, (e2) => {
    H.localExpanded = e2;
  }), watch(() => H.localExpanded, (e2) => {
    e2 ? S(h2.text.length) : k(), h2.expanded !== e2 && v2("update:expanded", e2);
  }), watch(() => [h2.maxLines, h2.maxHeight, h2.ellipsis, h2.location, w.value].join(), () => {
    nextTick(() => {
      k();
    });
  }), watch(() => [h2.text, h2.autoResize].join(), () => {
    nextTick(() => {
      q();
    });
  }), onUnmounted(() => {
    z();
  }), onMounted(() => {
    q();
  }), (t, a) => (openBlock(), createElementBlock("div", { ref_key: "textClampRef", ref: y2, class: "text-clamp", style: normalizeStyle({ overflow: "hidden", maxHeight: unref(R) }) }, [createBaseVNode("span", { ref_key: "contentRef", ref: b }, [renderSlot(t.$slots, "before", { expand: T, collapse: D, toggle: F, clamped: unref(w), expanded: H.localExpanded }), createBaseVNode("span", { ref_key: "textRef", ref: E, "aria-label": e.text }, null, 8, g), renderSlot(t.$slots, "after", { expand: T, collapse: D, toggle: F, clamped: unref(w), expanded: H.localExpanded })], 512)], 4));
} });
v.__file = "package/text-clamp.vue";
const h = (e) => (e.install = function(t) {
  t.component(e.__name, e);
}, e), y = h(v);
const _hoisted_1$9 = ["onClick"];
const _hoisted_2$7 = ["onClick"];
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "WdTextClamp",
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(y), null, {
        after: withCtx(({ toggle, expanded, clamped }) => [
          withDirectives(createBaseVNode("p", {
            style: { "text-decoration": "underline dotted" },
            class: "text-grey-6 cursor-pointer",
            onClick: toggle
          }, toDisplayString(_ctx.$t("more")), 9, _hoisted_1$9), [
            [vShow, clamped]
          ]),
          withDirectives(createBaseVNode("p", {
            style: { "text-decoration": "underline dotted" },
            class: "text-grey-6 cursor-pointer",
            onClick: toggle
          }, toDisplayString(_ctx.$t("less")), 9, _hoisted_2$7), [
            [vShow, expanded]
          ])
        ]),
        _: 1
      });
    };
  }
});
const __unplugin_components_5 = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["__file", "WdTextClamp.vue"]]);
const _hoisted_1$8 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$6 = /* @__PURE__ */ createBaseVNode("g", {
  fill: "none",
  "fill-rule": "evenodd"
}, [
  /* @__PURE__ */ createBaseVNode("path", { d: "M24 0v24H0V0zM12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036c-.01-.003-.019 0-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427c-.002-.01-.009-.017-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092c.012.004.023 0 .029-.008l.004-.014l-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.002a.023.023 0 0 0-.027.006l-.006.014l-.034.614c0 .012.007.02.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z" }),
  /* @__PURE__ */ createBaseVNode("path", {
    fill: "currentColor",
    d: "M8.701 5.75c.577-1 2.02-1 2.598 0l3.5 6.062l.902-1.562c.577-1 2.02-1 2.598 0l4.33 7.5A1.5 1.5 0 0 1 21.33 20H17v-.002a1.555 1.555 0 0 1-.072.002H3.072a1.5 1.5 0 0 1-1.3-2.25zm-.91 5.576l.709.472l.945-.63a1 1 0 0 1 1.11 0l.945.63l.709-.472L10 7.5z"
  })
], -1);
const _hoisted_3$5 = [
  _hoisted_2$6
];
function render$4(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$8, [..._hoisted_3$5]);
}
const __unplugin_components_4 = { name: "mingcute-mountain2-fill", render: render$4 };
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "QIconify",
  props: {
    is: {}
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QIcon, null, {
        default: withCtx(() => [
          (openBlock(), createBlock(resolveDynamicComponent(_ctx.is)))
        ]),
        _: 1
      });
    };
  }
});
const __unplugin_components_0$2 = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__file", "QIconify.vue"]]);
const _hoisted_1$7 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$5 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M9.86 18a1 1 0 0 1-.73-.32l-4.86-5.17a1 1 0 1 1 1.46-1.37l4.12 4.39l8.41-9.2a1 1 0 1 1 1.48 1.34l-9.14 10a1 1 0 0 1-.73.33Z"
}, null, -1);
const _hoisted_3$4 = [
  _hoisted_2$5
];
function render$3(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$7, [..._hoisted_3$4]);
}
const IconCheckmarkFill = { name: "eva-checkmark-fill", render: render$3 };
const _hoisted_1$6 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$4 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M17 9A5 5 0 0 0 7 9a1 1 0 0 0 2 0a3 3 0 1 1 3 3a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-1.1A5 5 0 0 0 17 9"
}, null, -1);
const _hoisted_3$3 = /* @__PURE__ */ createBaseVNode("circle", {
  cx: "12",
  cy: "19",
  r: "1",
  fill: "currentColor"
}, null, -1);
const _hoisted_4$2 = [
  _hoisted_2$4,
  _hoisted_3$3
];
function render$2(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$6, [..._hoisted_4$2]);
}
const IconQuestionMarkFill = { name: "eva-question-mark-fill", render: render$2 };
const _hoisted_1$5 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$3 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "m13.41 12l4.3-4.29a1 1 0 1 0-1.42-1.42L12 10.59l-4.29-4.3a1 1 0 0 0-1.42 1.42l4.3 4.29l-4.3 4.29a1 1 0 0 0 0 1.42a1 1 0 0 0 1.42 0l4.29-4.3l4.29 4.3a1 1 0 0 0 1.42 0a1 1 0 0 0 0-1.42Z"
}, null, -1);
const _hoisted_3$2 = [
  _hoisted_2$3
];
function render$1(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$5, [..._hoisted_3$2]);
}
const IconCloseFill = { name: "eva-close-fill", render: render$1 };
const _hoisted_1$4 = {
  class: "text-accent-900",
  style: { "font-weight": "500", "width": "28px" }
};
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "WdHutTypeChip",
  props: {
    type: {},
    capacity: {},
    color: { default: "white" },
    color2: {},
    open: { default: void 0 }
  },
  setup(__props) {
    const props = __props;
    const openIcon = computed(() => {
      switch (props.open) {
        case "yes":
          return IconCheckmarkFill;
        case "no":
          return IconCloseFill;
        case "maybe":
          return IconQuestionMarkFill;
      }
      return IconQuestionMarkFill;
    });
    const color_bg = computed(() => props.color2 ? props.color2 : "white");
    const openColor = computed(() => {
      switch (props.open) {
        case "yes":
          return "green-6";
        case "no":
          return "red-4";
        case "maybe":
          return "green-6";
      }
      return "grey-6";
    });
    return (_ctx, _cache) => {
      const QIconify = __unplugin_components_0$2;
      return _ctx.type && _ctx.type.name ? (openBlock(), createBlock(QChip, {
        key: 0,
        size: "md",
        class: normalizeClass("bg-" + color_bg.value + " q-mr-none"),
        style: { "min-width": "90px", "max-width": "90px", "max-height": "30px" }
      }, {
        default: withCtx(() => [
          createVNode(QAvatar, {
            class: normalizeClass("bg-" + _ctx.color),
            "text-color": "white"
          }, {
            default: withCtx(() => [
              createVNode(QIcon, {
                size: "24px",
                name: "img:" + (_ctx.$q.platform.is.mobile ? _ctx.type.symbol : _ctx.type.symbol_simple)
              }, null, 8, ["name"])
            ]),
            _: 1
          }, 8, ["class"]),
          createBaseVNode("span", _hoisted_1$4, toDisplayString(_ctx.capacity === void 0 || _ctx.capacity == null ? "?" : _ctx.capacity), 1),
          createVNode(QIconify, {
            class: normalizeClass("bg-" + openColor.value + " badge"),
            color: "white",
            size: "14px",
            is: openIcon.value
          }, null, 8, ["class", "is"]),
          renderSlot(_ctx.$slots, "default", {}, void 0, true)
        ]),
        _: 3
      }, 8, ["class"])) : createCommentVNode("", true);
    };
  }
});
const __unplugin_components_3 = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-764c35fd"], ["__file", "WdHutTypeChip.vue"]]);
const _hoisted_1$3 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$2 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M20 11a1 1 0 0 0-1 1v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6a1 1 0 0 0 0-2H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-6a1 1 0 0 0-1-1"
}, null, -1);
const _hoisted_3$1 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M16 5h1.58l-6.29 6.28a1 1 0 0 0 0 1.42a1 1 0 0 0 1.42 0L19 6.42V8a1 1 0 0 0 1 1a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-4a1 1 0 0 0 0 2"
}, null, -1);
const _hoisted_4$1 = [
  _hoisted_2$2,
  _hoisted_3$1
];
function render(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$3, [..._hoisted_4$1]);
}
const __unplugin_components_0$1 = { name: "eva-external-link-fill", render };
const _hoisted_1$2 = ["href"];
const _hoisted_2$1 = { key: 1 };
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "WdHutHeader",
  props: {
    hut: {},
    ontop: { type: Boolean }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      const _component_IconEvaExternalLinkFill = __unplugin_components_0$1;
      return openBlock(), createBlock(QHeader, {
        class: normalizeClass(["no-background", { "shadow-3": _ctx.ontop }]),
        style: { "transition": "box-shadow 0.2s ease", "background-color": "unset" }
      }, {
        default: withCtx(() => [
          renderSlot(_ctx.$slots, "default"),
          _ctx.hut ? (openBlock(), createBlock(QToolbar, {
            key: 0,
            class: ""
          }, {
            default: withCtx(() => [
              createVNode(QToolbarTitle, {
                style: { "text-wrap": "wrap", "transform": "translateY(4px)", "margin-left": "3px", "background-color": "unset" },
                class: "text-primary-900"
              }, {
                default: withCtx(() => [
                  createBaseVNode("h1", {
                    class: normalizeClass(["text-h5 q-ma-none q-mt-xs", [
                      _ctx.$q.screen.xs || _ctx.$q.platform.is.mobile ? "text-h6" : "text-h5"
                    ]])
                  }, [
                    _ctx.hut.url ? (openBlock(), createElementBlock("a", {
                      key: 0,
                      href: _ctx.hut.url,
                      targe: "_blank"
                    }, [
                      createTextVNode(toDisplayString(_ctx.hut.name) + " ", 1),
                      createVNode(QIcon, {
                        size: "11pt",
                        style: { "transform": "translateY(-6px)" }
                      }, {
                        default: withCtx(() => [
                          createVNode(_component_IconEvaExternalLinkFill)
                        ]),
                        _: 1
                      })
                    ], 8, _hoisted_1$2)) : (openBlock(), createElementBlock("span", _hoisted_2$1, toDisplayString(_ctx.hut.name), 1))
                  ], 2)
                ]),
                _: 1
              })
            ]),
            _: 1
          })) : createCommentVNode("", true)
        ]),
        _: 3
      }, 8, ["class"]);
    };
  }
});
const __unplugin_components_2 = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__file", "WdHutHeader.vue"]]);
const QItemSection = createComponent({
  name: "QItemSection",
  props: {
    avatar: Boolean,
    thumbnail: Boolean,
    side: Boolean,
    top: Boolean,
    noWrap: Boolean
  },
  setup(props, { slots }) {
    const classes = computed(
      () => `q-item__section column q-item__section--${props.avatar === true || props.side === true || props.thumbnail === true ? "side" : "main"}` + (props.top === true ? " q-item__section--top justify-start" : " justify-center") + (props.avatar === true ? " q-item__section--avatar" : "") + (props.thumbnail === true ? " q-item__section--thumbnail" : "") + (props.noWrap === true ? " q-item__section--nowrap" : "")
    );
    return () => h$1("div", { class: classes.value }, hSlot(slots.default));
  }
});
const QItem = createComponent({
  name: "QItem",
  props: {
    ...useDarkProps,
    ...useRouterLinkProps,
    tag: {
      type: String,
      default: "div"
    },
    active: {
      type: Boolean,
      default: null
    },
    clickable: Boolean,
    dense: Boolean,
    insetLevel: Number,
    tabindex: [String, Number],
    focused: Boolean,
    manualFocus: Boolean
  },
  emits: ["click", "keyup"],
  setup(props, { slots, emit }) {
    const { proxy: { $q } } = getCurrentInstance();
    const isDark = useDark(props, $q);
    const { hasLink, linkAttrs, linkClass, linkTag, navigateOnClick } = useRouterLink();
    const rootRef = ref(null);
    const blurTargetRef = ref(null);
    const isActionable = computed(
      () => props.clickable === true || hasLink.value === true || props.tag === "label"
    );
    const isClickable = computed(
      () => props.disable !== true && isActionable.value === true
    );
    const classes = computed(
      () => "q-item q-item-type row no-wrap" + (props.dense === true ? " q-item--dense" : "") + (isDark.value === true ? " q-item--dark" : "") + (hasLink.value === true && props.active === null ? linkClass.value : props.active === true ? ` q-item--active${props.activeClass !== void 0 ? ` ${props.activeClass}` : ""}` : "") + (props.disable === true ? " disabled" : "") + (isClickable.value === true ? " q-item--clickable q-link cursor-pointer " + (props.manualFocus === true ? "q-manual-focusable" : "q-focusable q-hoverable") + (props.focused === true ? " q-manual-focusable--focused" : "") : "")
    );
    const style2 = computed(() => {
      if (props.insetLevel === void 0) {
        return null;
      }
      const dir = $q.lang.rtl === true ? "Right" : "Left";
      return {
        ["padding" + dir]: 16 + props.insetLevel * 56 + "px"
      };
    });
    function onClick(e) {
      if (isClickable.value === true) {
        if (blurTargetRef.value !== null) {
          if (e.qKeyEvent !== true && document.activeElement === rootRef.value) {
            blurTargetRef.value.focus();
          } else if (document.activeElement === blurTargetRef.value) {
            rootRef.value.focus();
          }
        }
        navigateOnClick(e);
      }
    }
    function onKeyup(e) {
      if (isClickable.value === true && isKeyCode(e, [13, 32]) === true) {
        stopAndPrevent(e);
        e.qKeyEvent = true;
        const evt = new MouseEvent("click", e);
        evt.qKeyEvent = true;
        rootRef.value.dispatchEvent(evt);
      }
      emit("keyup", e);
    }
    function getContent() {
      const child = hUniqueSlot(slots.default, []);
      isClickable.value === true && child.unshift(
        h$1("div", { class: "q-focus-helper", tabindex: -1, ref: blurTargetRef })
      );
      return child;
    }
    return () => {
      const data = {
        ref: rootRef,
        class: classes.value,
        style: style2.value,
        role: "listitem",
        onClick,
        onKeyup
      };
      if (isClickable.value === true) {
        data.tabindex = props.tabindex || "0";
        Object.assign(data, linkAttrs.value);
      } else if (isActionable.value === true) {
        data["aria-disabled"] = "true";
      }
      return h$1(
        linkTag.value,
        data,
        getContent()
      );
    };
  }
});
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "WdToolbarExtraButton",
  props: {
    icon: {},
    iconColor: { default: "primary-800" },
    disabled: { type: Boolean, default: false }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return withDirectives((openBlock(), createBlock(QItem, {
        clickable: !_ctx.disabled,
        style: normalizeStyle(_ctx.disabled ? "opacity : 0.5;" : "")
      }, {
        default: withCtx(() => [
          createVNode(QItemSection, {
            avatar: "",
            style: { "min-width": "34px", "padding-right": "0" }
          }, {
            default: withCtx(() => [
              createVNode(QIcon, {
                color: _ctx.iconColor,
                name: _ctx.icon
              }, null, 8, ["color", "name"])
            ]),
            _: 1
          }),
          createVNode(QItemSection, null, {
            default: withCtx(() => [
              renderSlot(_ctx.$slots, "default")
            ]),
            _: 3
          })
        ]),
        _: 3
      }, 8, ["clickable", "style"])), [
        [Ripple]
      ]);
    };
  }
});
const __unplugin_components_1$1 = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__file", "WdToolbarExtraButton.vue"]]);
const alignValues = ["top", "middle", "bottom"];
const QBadge = createComponent({
  name: "QBadge",
  props: {
    color: String,
    textColor: String,
    floating: Boolean,
    transparent: Boolean,
    multiLine: Boolean,
    outline: Boolean,
    rounded: Boolean,
    label: [Number, String],
    align: {
      type: String,
      validator: (v2) => alignValues.includes(v2)
    }
  },
  setup(props, { slots }) {
    const style2 = computed(() => {
      return props.align !== void 0 ? { verticalAlign: props.align } : null;
    });
    const classes = computed(() => {
      const text = props.outline === true ? props.color || props.textColor : props.textColor;
      return `q-badge flex inline items-center no-wrap q-badge--${props.multiLine === true ? "multi" : "single"}-line` + (props.outline === true ? " q-badge--outline" : props.color !== void 0 ? ` bg-${props.color}` : "") + (text !== void 0 ? ` text-${text}` : "") + (props.floating === true ? " q-badge--floating" : "") + (props.rounded === true ? " q-badge--rounded" : "") + (props.transparent === true ? " q-badge--transparent" : "");
    });
    return () => h$1("div", {
      class: classes.value,
      style: style2.value,
      role: "status",
      "aria-label": props.label
    }, hMergeSlot(slots.default, props.label !== void 0 ? [props.label] : []));
  }
});
const QList = createComponent({
  name: "QList",
  props: {
    ...useDarkProps,
    bordered: Boolean,
    dense: Boolean,
    separator: Boolean,
    padding: Boolean,
    tag: {
      type: String,
      default: "div"
    }
  },
  setup(props, { slots }) {
    const vm = getCurrentInstance();
    const isDark = useDark(props, vm.proxy.$q);
    const classes = computed(
      () => "q-list" + (props.bordered === true ? " q-list--bordered" : "") + (props.dense === true ? " q-list--dense" : "") + (props.separator === true ? " q-list--separator" : "") + (isDark.value === true ? " q-list--dark" : "") + (props.padding === true ? " q-list--padding" : "")
    );
    return () => h$1(props.tag, { class: classes.value }, hSlot(slots.default));
  }
});
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "WdHutToolbar",
  props: {
    hut: {}
  },
  setup(__props) {
    const props = __props;
    const reviewInfos = {
      new: ["warning-200", "ungeprüft"],
      done: ["positive-800", "ok"],
      review: ["warning-500", "validieren"],
      work: ["secondary-800", "überarbeiten"],
      reject: ["negative-300", "ungültig"]
    };
    function getReviewInfo(status, index, _default = "work") {
      if (props !== void 0) {
        if (props.hut?.type_open?.slug == "unknown" || props.hut?.capacity_open == void 0 || props.hut?.open_monthly?.month_01 == void 0 || props.hut?.elevation == void 0) {
          status = "work";
        }
      }
      if (status !== void 0 && status != null && status in reviewInfos) {
        return reviewInfos[status][index];
      } else {
        return reviewInfos[_default][index];
      }
    }
    function getReviewColor(status) {
      return getReviewInfo(status, 0);
    }
    function getReviewText(status) {
      return getReviewInfo(status, 1);
    }
    const $q = useQuasar();
    const mapRef = ut();
    const watchHut = ref(false);
    const starHut = ref(false);
    function toggleHutStar() {
      starHut.value = !starHut.value;
    }
    function flyTo() {
      if (mapRef.map !== void 0 && props.hut !== void 0) {
        const loc = props.hut.location;
        if (loc !== void 0 && loc !== null) {
          const zoom = mapRef.map.getZoom();
          mapRef.map.flyTo({
            center: [loc.lon, loc.lat],
            zoom: zoom > 12 ? zoom : 12,
            padding: {
              right: $q.screen.xs ? 0 : 400,
              bottom: $q.screen.xs ? 300 : 0
            }
            //speed: 0.2,
            //curve: 1,
          });
        }
      }
    }
    function sameLatLng(lat1, lat2, lon1, lon2, precision = 4e-3) {
      const same = lat1 + precision >= lat2 && lat1 - precision <= lat2 && lon1 + precision >= lon2 && lon1 - precision <= lon2;
      return same;
    }
    const menuOpen = ref(false);
    const flyToDisabled = ref(true);
    watch(menuOpen, () => {
      flyToDisabled.value = true;
      if (mapRef.map !== void 0 && props.hut !== void 0) {
        const loc = props.hut.location;
        if (loc !== void 0 && loc !== null) {
          const center = mapRef.map.getCenter();
          const zoom = mapRef.map.getZoom();
          flyToDisabled.value = sameLatLng(
            loc.lat,
            center.lat,
            loc.lon,
            center.lng,
            5e-3 / Math.sqrt(zoom)
          );
        }
      }
    });
    return (_ctx, _cache) => {
      const _component_WdToolbarButton = __unplugin_components_0$4;
      const _component_WdToolbarExtraButton = __unplugin_components_1$1;
      return openBlock(), createBlock(QToolbar, null, {
        default: withCtx(() => [
          renderSlot(_ctx.$slots, "default"),
          createVNode(QSpace),
          _ctx.hut ? (openBlock(), createBlock(QBadge, {
            key: 0,
            outline: "",
            class: "q-mr-xs",
            color: getReviewColor(_ctx.hut.review_status)
          }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(getReviewText(_ctx.hut.review_status)), 1)
            ]),
            _: 1
          }, 8, ["color"])) : createCommentVNode("", true),
          createVNode(_component_WdToolbarButton, {
            size: "md",
            color: watchHut.value ? "accent" : "primary-900",
            icon: watchHut.value ? "wd-eye" : "wd-eye-outline",
            style: { "opacity": "0.5", "cursor": "not-allowed" }
          }, null, 8, ["color", "icon"]),
          createVNode(_component_WdToolbarButton, {
            size: "md",
            class: "text-primary-900",
            icon: "wd-more-vertical"
          }, {
            default: withCtx(() => [
              createVNode(QMenu, {
                class: "bg-primary-100",
                modelValue: menuOpen.value,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => menuOpen.value = $event)
              }, {
                default: withCtx(() => [
                  createVNode(QList, { style: { "min-width": "100px" } }, {
                    default: withCtx(() => [
                      createVNode(_component_WdToolbarExtraButton, {
                        onClick: toggleHutStar,
                        icon: starHut.value ? "wd-favorite" : "wd-favorite-outline",
                        "icon-color": starHut.value ? "accent" : "primary-800",
                        disabled: true
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(_ctx.$t("favorite")), 1)
                        ]),
                        _: 1
                      }, 8, ["icon", "icon-color"]),
                      unref(mapRef).map && _ctx.hut?.location ? withDirectives((openBlock(), createBlock(_component_WdToolbarExtraButton, {
                        key: 0,
                        icon: "wd-location-question",
                        onClick: flyTo,
                        disabled: flyToDisabled.value
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(_ctx.$t("show_map")), 1)
                        ]),
                        _: 1
                      }, 8, ["disabled"])), [
                        [ClosePopup]
                      ]) : createCommentVNode("", true),
                      createVNode(_component_WdToolbarExtraButton, {
                        icon: "wd-edit-outline",
                        href: _ctx.hut?.edit_link,
                        target: "_blank"
                      }, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(_ctx.$t("edit")), 1)
                        ]),
                        _: 1
                      }, 8, ["href"])
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, ["modelValue"])
            ]),
            _: 1
          })
        ]),
        _: 3
      });
    };
  }
});
const __unplugin_components_1 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__file", "WdHutToolbar.vue"]]);
const _hoisted_1$1 = ["src"];
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "WdSourceButtons",
  props: {
    hut: {},
    round: { type: Boolean, default: true },
    flat: { type: Boolean, default: true },
    background: { type: Boolean, default: false },
    padding: { default: "xs" },
    color: {},
    target: { default: "_blank" }
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _cache) => {
      return _ctx.hut ? (openBlock(), createElementBlock("div", {
        key: 0,
        class: normalizeClass(["justify-start row", { content: _ctx.background }])
      }, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(props.hut?.sources, (ref2) => {
          return openBlock(), createElementBlock("div", {
            key: ref2.name,
            class: "col"
          }, [
            createVNode(QBtn, {
              href: ref2.link,
              target: props.target,
              flat: props.flat,
              padding: props.padding,
              round: props.round,
              color: props.color
            }, {
              default: withCtx(() => [
                createBaseVNode("img", {
                  style: normalizeStyle({ height: _ctx.$q.platform.is.mobile ? "24px" : "24px" }),
                  src: ref2.logo
                }, null, 12, _hoisted_1$1),
                createVNode(QTooltip, {
                  "hide-delay": 150,
                  delay: 150
                }, {
                  default: withCtx(() => [
                    createBaseVNode("span", null, toDisplayString(ref2.fullname), 1)
                  ]),
                  _: 2
                }, 1024)
              ]),
              _: 2
            }, 1032, ["href", "target", "flat", "padding", "round", "color"])
          ]);
        }), 128))
      ], 2)) : createCommentVNode("", true);
    };
  }
});
const __unplugin_components_0 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-d2ae3a7f"], ["__file", "WdSourceButtons.vue"]]);
const QItemLabel = createComponent({
  name: "QItemLabel",
  props: {
    overline: Boolean,
    caption: Boolean,
    header: Boolean,
    lines: [Number, String]
  },
  setup(props, { slots }) {
    const parsedLines = computed(() => parseInt(props.lines, 10));
    const classes = computed(
      () => "q-item__label" + (props.overline === true ? " q-item__label--overline text-overline" : "") + (props.caption === true ? " q-item__label--caption text-caption" : "") + (props.header === true ? " q-item__label--header" : "") + (parsedLines.value === 1 ? " ellipsis" : "")
    );
    const style2 = computed(() => {
      return props.lines !== void 0 && parsedLines.value > 1 ? {
        overflow: "hidden",
        display: "-webkit-box",
        "-webkit-box-orient": "vertical",
        "-webkit-line-clamp": parsedLines.value
      } : null;
    });
    return () => h$1("div", {
      style: style2.value,
      class: classes.value
    }, hSlot(slots.default));
  }
});
const defaultCfg = {
  threshold: 0,
  root: null,
  rootMargin: "0px"
};
function update(el, ctx, value) {
  let handler, cfg, changed;
  if (typeof value === "function") {
    handler = value;
    cfg = defaultCfg;
    changed = ctx.cfg === void 0;
  } else {
    handler = value.handler;
    cfg = Object.assign({}, defaultCfg, value.cfg);
    changed = ctx.cfg === void 0 || isDeepEqual(ctx.cfg, cfg) === false;
  }
  if (ctx.handler !== handler) {
    ctx.handler = handler;
  }
  if (changed === true) {
    ctx.cfg = cfg;
    ctx.observer !== void 0 && ctx.observer.unobserve(el);
    ctx.observer = new IntersectionObserver(([entry]) => {
      if (typeof ctx.handler === "function") {
        if (entry.rootBounds === null && document.body.contains(el) === true) {
          ctx.observer.unobserve(el);
          ctx.observer.observe(el);
          return;
        }
        const res = ctx.handler(entry, ctx.observer);
        if (res === false || ctx.once === true && entry.isIntersecting === true) {
          destroy(el);
        }
      }
    }, cfg);
    ctx.observer.observe(el);
  }
}
function destroy(el) {
  const ctx = el.__qvisible;
  if (ctx !== void 0) {
    ctx.observer !== void 0 && ctx.observer.unobserve(el);
    delete el.__qvisible;
  }
}
const Intersection = createDirective(
  {
    name: "intersection",
    mounted(el, { modifiers, value }) {
      const ctx = {
        once: modifiers.once === true
      };
      update(el, ctx, value);
      el.__qvisible = ctx;
    },
    updated(el, binding) {
      const ctx = el.__qvisible;
      ctx !== void 0 && update(el, ctx, binding.value);
    },
    beforeUnmount: destroy
  }
);
function fallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.contentEditable = "true";
  area.style.position = "fixed";
  const fn = () => {
  };
  addFocusout(fn);
  document.body.appendChild(area);
  area.focus();
  area.select();
  const res = document.execCommand("copy");
  area.remove();
  removeFocusout(fn);
  return res;
}
function copyToClipboard(text) {
  return navigator.clipboard !== void 0 ? navigator.clipboard.writeText(text) : new Promise((resolve, reject) => {
    const res = fallback(text);
    if (res) {
      resolve(true);
    } else {
      reject(res);
    }
  });
}
const _hoisted_1 = { class: "row items-start q-gutter-sm" };
const _hoisted_2 = {
  key: 0,
  class: "col-md-12 col-sm-7 col-7"
};
const _hoisted_3 = { class: "absolute-bottom-right row attribution" };
const _hoisted_4 = ["innerHTML"];
const _hoisted_5 = {
  class: "text-primary-500",
  style: { "font-weight": "500", "width": "28px" }
};
const _hoisted_6 = { class: "text-body2 q-my-lg" };
const _hoisted_7 = ["innerHTML"];
const _hoisted_8 = { class: "text-subtitle1 text-accent" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "WdHutView",
  props: {
    slug: {}
  },
  setup(__props) {
    const { selectedMonth } = storeToRefs(useHutsStore());
    const $q = useQuasar();
    const props = __props;
    const hut = ref(void 0);
    const isHutOpen = computed(() => {
      const currentMonth = selectedMonth.value;
      if (hut.value?.open_monthly === void 0 || hut.value?.open_monthly == null) {
        return "unknown";
      }
      const o = hut.value?.open_monthly[`month_${currentMonth}`];
      if (o === void 0) {
        return "unknown";
      }
      return o;
    });
    const isHutClosed = computed(() => {
      switch (isHutOpen.value) {
        case "yes":
          return "no";
        case "no":
          return "yes";
      }
      return isHutOpen.value;
    });
    const headerShadow = ref(false);
    watchEffect(() => {
      hut.value = void 0;
      headerShadow.value = false;
      if (props.slug) {
        clientWodore.GET("/v1/huts/{slug}", {
          params: { path: { slug: props.slug } }
        }).then(({ data }) => {
          if (data) {
            hut.value = data;
          }
        });
      }
    });
    const headerImg = ref(void 0);
    const hutToolbarTop = computed(() => $q.screen.gt.sm);
    watchEffect(() => {
      if (hut.value?.photos) {
        headerImg.value = getImageUrl(hut.value?.photos, {
          size: "600x400",
          smart: true,
          fit: true
          //filters: ['grayscale()'],
        });
      } else {
        headerImg.value = void 0;
      }
    });
    const addHeaderShadow = (entry) => {
      headerShadow.value = !entry.isIntersecting;
      return true;
    };
    return (_ctx, _cache) => {
      const _component_WdSourceButtons = __unplugin_components_0;
      const _component_WdHutToolbar = __unplugin_components_1;
      const _component_WdHutHeader = __unplugin_components_2;
      const _component_WdHutTypeChip = __unplugin_components_3;
      const _component_IconMingcuteMountain2Fill = __unplugin_components_4;
      const _component_WdTextClamp = __unplugin_components_5;
      const _component_WdHutOpenMonthly = __unplugin_components_6;
      const _component_IconFa6SolidLocationCrosshairs = __unplugin_components_7;
      const _component_IconFa6SolidCopy = __unplugin_components_8;
      return openBlock(), createBlock(QLayout, {
        view: "lhh LpR lff",
        container: "",
        class: normalizeClass(["no-background fit", unref($q).dark.isActive ? "bg-grey-9" : "bg-grey-3"]),
        style: { "height": "100%" }
      }, {
        default: withCtx(() => [
          createVNode(_component_WdHutHeader, {
            hut: hut.value,
            ontop: headerShadow.value
          }, {
            default: withCtx(() => [
              hutToolbarTop.value ? (openBlock(), createBlock(_component_WdHutToolbar, {
                key: 0,
                hut: hut.value
              }, {
                default: withCtx(() => [
                  createVNode(_component_WdSourceButtons, {
                    hut: hut.value,
                    class: "q-ml-xl"
                  }, null, 8, ["hut"])
                ]),
                _: 1
              }, 8, ["hut"])) : createCommentVNode("", true)
            ]),
            _: 1
          }, 8, ["hut", "ontop"]),
          createVNode(QPageContainer, {
            class: "fit",
            style: { "height": "100%" }
          }, {
            default: withCtx(() => [
              createVNode(QScrollArea, {
                visible: "",
                "thumb-style": {
                  width: "6px",
                  backgroundColor: "#998019",
                  opacity: "0.5",
                  borderRadius: "8px 0 0 8px"
                },
                style: { "height": "100%" },
                class: "fit"
              }, {
                default: withCtx(() => [
                  hut.value ? (openBlock(), createBlock(QPage, {
                    key: 0,
                    style: { "height": "100%" },
                    class: "q-px-md fit"
                  }, {
                    default: withCtx(() => [
                      createBaseVNode("h2", {
                        style: normalizeStyle(
                          (unref($q).screen.gt.sm ? "margin-top: -3px; " : "") + "text-wrap: wrap;"
                        ),
                        class: "text-subtitle1 text-accent-900 q-ma-none q-mb-sm"
                      }, [
                        withDirectives(createBaseVNode("span", null, null, 512), [
                          [Intersection, addHeaderShadow]
                        ]),
                        createTextVNode(" " + toDisplayString(hut.value.owner?.name), 1)
                      ], 4),
                      createBaseVNode("div", _hoisted_1, [
                        headerImg.value ? (openBlock(), createElementBlock("div", _hoisted_2, [
                          createBaseVNode("div", {
                            class: normalizeClass({
                              "q-ma-sm": unref($q).screen.gt.sm,
                              "q-ma-lg": unref($q).screen.gt.md
                            })
                          }, [
                            createVNode(QImg, {
                              src: headerImg.value,
                              class: normalizeClass(["hut-image", { "shadow-8": unref($q).screen.gt.sm }])
                            }, {
                              default: withCtx(() => [
                                createBaseVNode("div", _hoisted_3, [
                                  createVNode(QIcon, {
                                    class: "q-mr-sm",
                                    name: "eva-camera-outline"
                                  }),
                                  createBaseVNode("div", {
                                    class: "img-link",
                                    innerHTML: hut.value.photos_attribution
                                  }, null, 8, _hoisted_4)
                                ])
                              ]),
                              _: 1
                            }, 8, ["src", "class"])
                          ], 2)
                        ])) : createCommentVNode("", true),
                        createBaseVNode("div", {
                          class: normalizeClass(["col-md-12", {
                            "col-sm-4": headerImg.value,
                            "col-4": headerImg.value,
                            "col-12": !headerImg.value
                          }])
                        }, [
                          createBaseVNode("div", {
                            class: normalizeClass(["row items-start justify-start q-gutter-sm", {
                              "justify-center": unref($q).screen.gt.sm && headerImg.value,
                              "q-gutter-lg": unref($q).screen.gt.sm
                            }])
                          }, [
                            createVNode(_component_WdHutTypeChip, {
                              class: "shadow-0 col-md-6 col-sm-12 col-12",
                              type: hut.value.type_open,
                              capacity: hut.value.capacity_open,
                              open: isHutOpen.value,
                              color: "green-4",
                              color2: "green-2"
                            }, null, 8, ["type", "capacity", "open"]),
                            createVNode(_component_WdHutTypeChip, {
                              class: "shadow-0 col-md-6 col-sm-12 col-12",
                              type: hut.value.type_closed,
                              capacity: hut.value.capacity_closed,
                              open: isHutClosed.value,
                              color: "brown-3",
                              color2: "brown-2"
                            }, null, 8, ["type", "capacity", "open"]),
                            hut.value.elevation ? (openBlock(), createBlock(QChip, {
                              key: 0,
                              size: "md",
                              class: "bg-grey-4 q-mr-none shadow-0 col-md-6 col-sm-12 col-12",
                              style: { "min-width": "90px", "max-width": "90px", "max-height": "30px" }
                            }, {
                              default: withCtx(() => [
                                createVNode(QAvatar, {
                                  class: "bg-grey-5",
                                  "text-color": "primary-500"
                                }, {
                                  default: withCtx(() => [
                                    createVNode(QIcon, { size: "20px" }, {
                                      default: withCtx(() => [
                                        createVNode(_component_IconMingcuteMountain2Fill)
                                      ]),
                                      _: 1
                                    })
                                  ]),
                                  _: 1
                                }),
                                createBaseVNode("span", _hoisted_5, toDisplayString(hut.value.elevation) + " m", 1)
                              ]),
                              _: 1
                            })) : createCommentVNode("", true)
                          ], 2)
                        ], 2)
                      ]),
                      createBaseVNode("body", _hoisted_6, [
                        createBaseVNode("div", {
                          class: "attribution attr_link text-right",
                          style: { "padding": "0" },
                          innerHTML: hut.value.description_attribution
                        }, null, 8, _hoisted_7),
                        createVNode(_component_WdTextClamp, {
                          "max-lines": 5,
                          text: hut.value.description,
                          style: { "padding-bottom": "0" }
                        }, null, 8, ["text"])
                      ]),
                      createVNode(_component_WdHutOpenMonthly, {
                        open_monthly: hut.value.open_monthly,
                        type_open: hut.value.type_open,
                        type_closed: hut.value.type_closed
                      }, null, 8, ["open_monthly", "type_open", "type_closed"]),
                      createBaseVNode("div", _hoisted_8, toDisplayString(_ctx.$t("location")), 1),
                      createVNode(QList, { dense: "" }, {
                        default: withCtx(() => [
                          hut.value.location ? (openBlock(), createBlock(QItem, { key: 0 }, {
                            default: withCtx(() => [
                              createVNode(QItemSection, { side: "" }, {
                                default: withCtx(() => [
                                  createVNode(QIcon, { size: "xs" }, {
                                    default: withCtx(() => [
                                      createVNode(_component_IconFa6SolidLocationCrosshairs)
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              }),
                              createVNode(QItemSection, null, {
                                default: withCtx(() => [
                                  createVNode(QItemLabel, null, {
                                    default: withCtx(() => [
                                      createTextVNode(toDisplayString(hut.value.location.lat.toPrecision(7)) + ", " + toDisplayString(hut.value.location.lon.toPrecision(6)), 1)
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              }),
                              createVNode(QItemSection, {
                                side: "",
                                onClick: _cache[0] || (_cache[0] = ($event) => unref(copyToClipboard)(
                                  hut.value.location.lat.toPrecision(7).toString() + ", " + hut.value.location.lon.toPrecision(6).toString()
                                ))
                              }, {
                                default: withCtx(() => [
                                  createVNode(QBtn, {
                                    flat: "",
                                    dense: "",
                                    round: "",
                                    size: "10pt"
                                  }, {
                                    default: withCtx(() => [
                                      createVNode(QIcon, { size: "10pt" }, {
                                        default: withCtx(() => [
                                          createVNode(_component_IconFa6SolidCopy)
                                        ]),
                                        _: 1
                                      })
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          })) : createCommentVNode("", true),
                          hut.value.elevation ? (openBlock(), createBlock(QItem, { key: 1 }, {
                            default: withCtx(() => [
                              createVNode(QItemSection, { side: "" }, {
                                default: withCtx(() => [
                                  createVNode(QIcon, { size: "xs" }, {
                                    default: withCtx(() => [
                                      createVNode(_component_IconMingcuteMountain2Fill)
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              }),
                              createVNode(QItemSection, null, {
                                default: withCtx(() => [
                                  createVNode(QItemLabel, null, {
                                    default: withCtx(() => [
                                      createTextVNode(toDisplayString(hut.value.elevation) + " m", 1)
                                    ]),
                                    _: 1
                                  })
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          })) : createCommentVNode("", true)
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })) : createCommentVNode("", true)
                ]),
                _: 1
              })
            ]),
            _: 1
          }),
          createVNode(QFooter, { class: "footer-toolbar" }, {
            default: withCtx(() => [
              !hutToolbarTop.value ? (openBlock(), createBlock(_component_WdHutToolbar, {
                key: 0,
                hut: hut.value
              }, {
                default: withCtx(() => [
                  createVNode(_component_WdSourceButtons, { hut: hut.value }, null, 8, ["hut"])
                ]),
                _: 1
              }, 8, ["hut"])) : createCommentVNode("", true)
            ]),
            _: 1
          })
        ]),
        _: 1
      }, 8, ["class"]);
    };
  }
});
const WdHutView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3ec6adef"], ["__file", "WdHutView.vue"]]);
export {
  WdHutView as default
};
