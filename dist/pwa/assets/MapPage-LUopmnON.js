const __vite__fileDeps=["assets/WdMapView-CVZdNcH6.js","assets/index-CAHSu7Ql.js","assets/index-C3NVPFaO.css","assets/use-quasar-dzbiZ5mn.js","assets/huts-store-B8KO_l-F.js","assets/index-BAtqSMr7.js","assets/vue-maplibre-gl.es-ZH3R_aa8.js","assets/_commonjsHelpers-Dm6U3U_N.js","assets/QTooltip-H8kXt2o5.js","assets/WdMapView-CZLaBDzj.css"],__vite__mapDeps=i=>i.map(i=>__vite__fileDeps[i]);
import { h as createComponent, F as hSlot, D as h, a9 as useSpinnerProps, aa as useSpinner, j as useDarkProps, ab as useTransitionProps, l as getCurrentInstance, m as useDark, ac as useTransition, t as computed, T as Transition, ad as QSpinner, d as defineComponent, o as openBlock, c as createBlock, L as withCtx, ae as Suspense, e as createVNode, O as unref, af as defineAsyncComponent, ag as __vitePreload, _ as _export_sfc } from "./index-CAHSu7Ql.js";
import { u as useHydration } from "./use-hydration-DGAnypCl.js";
import { Q as QPage } from "./QPage-BWOFWlQo.js";
const QNoSsr = createComponent({
  name: "QNoSsr",
  props: {
    tag: {
      type: String,
      default: "div"
    },
    placeholder: String
  },
  setup(props, { slots }) {
    const { isHydrated } = useHydration();
    return () => {
      if (isHydrated.value === true) {
        const node2 = hSlot(slots.default);
        return node2 === void 0 ? node2 : node2.length > 1 ? h(props.tag, {}, node2) : node2[0];
      }
      const data = {
        class: "q-no-ssr-placeholder"
      };
      const node = hSlot(slots.placeholder);
      if (node !== void 0) {
        return node.length > 1 ? h(props.tag, data, node) : node[0];
      }
      if (props.placeholder !== void 0) {
        return h(props.tag, data, props.placeholder);
      }
    };
  }
});
const svg = [
  h("circle", {
    cx: "12.5",
    cy: "12.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "12.5",
    cy: "52.5",
    r: "12.5",
    "fill-opacity": ".5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "100ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "52.5",
    cy: "12.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "300ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "52.5",
    cy: "52.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "600ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "92.5",
    cy: "12.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "800ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "92.5",
    cy: "52.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "400ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "12.5",
    cy: "92.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "700ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "52.5",
    cy: "92.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "500ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ]),
  h("circle", {
    cx: "92.5",
    cy: "92.5",
    r: "12.5"
  }, [
    h("animate", {
      attributeName: "fill-opacity",
      begin: "200ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })
  ])
];
const QSpinnerGrid = createComponent({
  name: "QSpinnerGrid",
  props: useSpinnerProps,
  setup(props) {
    const { cSize, classes } = useSpinner(props);
    return () => h("svg", {
      class: classes.value,
      fill: "currentColor",
      width: cSize.value,
      height: cSize.value,
      viewBox: "0 0 105 105",
      xmlns: "http://www.w3.org/2000/svg"
    }, svg);
  }
});
const QInnerLoading = createComponent({
  name: "QInnerLoading",
  props: {
    ...useDarkProps,
    ...useTransitionProps,
    showing: Boolean,
    color: String,
    size: {
      type: [String, Number],
      default: "42px"
    },
    label: String,
    labelClass: String,
    labelStyle: [String, Array, Object]
  },
  setup(props, { slots }) {
    const vm = getCurrentInstance();
    const isDark = useDark(props, vm.proxy.$q);
    const { transitionProps, transitionStyle } = useTransition(props);
    const classes = computed(
      () => "q-inner-loading q--avoid-card-border absolute-full column flex-center" + (isDark.value === true ? " q-inner-loading--dark" : "")
    );
    const labelClass = computed(
      () => "q-inner-loading__label" + (props.labelClass !== void 0 ? ` ${props.labelClass}` : "")
    );
    function getInner() {
      const child = [
        h(QSpinner, {
          size: props.size,
          color: props.color
        })
      ];
      if (props.label !== void 0) {
        child.push(
          h("div", {
            class: labelClass.value,
            style: props.labelStyle
          }, [props.label])
        );
      }
      return child;
    }
    function getContent() {
      return props.showing === true ? h(
        "div",
        { class: classes.value, style: transitionStyle.value },
        slots.default !== void 0 ? slots.default() : getInner()
      ) : null;
    }
    return () => h(Transition, transitionProps.value, getContent);
  }
});
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "MapPage",
  setup(__props) {
    const WdMapView = defineAsyncComponent(
      () => __vitePreload(() => import("./WdMapView-CVZdNcH6.js"), true ? __vite__mapDeps([0,1,2,3,4,5,6,7,8,9]) : void 0)
    );
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QPage, null, {
        default: withCtx(() => [
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => [
              createVNode(QInnerLoading, {
                showing: true,
                class: "background-map"
              }, {
                default: withCtx(() => [
                  createVNode(QSpinnerGrid, {
                    size: "50px",
                    color: "secondary"
                  })
                ]),
                _: 1
              })
            ]),
            default: withCtx(() => [
              createVNode(QNoSsr, null, {
                default: withCtx(() => [
                  createVNode(unref(WdMapView))
                ]),
                _: 1
              })
            ]),
            _: 1
          }))
        ]),
        _: 1
      });
    };
  }
});
const MapPage = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-bae0812a"], ["__file", "MapPage.vue"]]);
export {
  MapPage as default
};
