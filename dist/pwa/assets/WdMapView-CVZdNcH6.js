import { d as defineComponent, o as openBlock, c as createBlock, L as withCtx, e as createVNode, Q as QIcon, a7 as normalizeClass, M as QBtn, _ as _export_sfc, t as computed, h as createComponent, i as useModelToggleProps, k as useModelToggleEmits, s as ref, bi as useId, l as getCurrentInstance, v as useModelToggle, aT as provide, bj as fabKey, D as h, F as hSlot, ay as hMergeSlot, q as inject, r as emptyRenderFn, G as layoutKey, a3 as storeToRefs, a8 as watchEffect, bk as defineStore, ar as reactive, bl as Plugin, bm as Platform, x as watch, f as createBaseVNode, a as createElementBlock, R as Fragment, aq as renderList, O as unref, C as withDirectives, at as vShow, an as QAvatar, g as createTextVNode, ao as toDisplayString, P as createCommentVNode, bn as useCssVars, u as useRouter, a4 as useRoute } from "./index-CAHSu7Ql.js";
import { u as useQuasar } from "./use-quasar-dzbiZ5mn.js";
import { b as useHutsStore } from "./huts-store-B8KO_l-F.js";
import { u as ut, C as Ce, I as Ie, M as Me, A as Ae, h as he } from "./vue-maplibre-gl.es-ZH3R_aa8.js";
import { Q as QTooltip } from "./QTooltip-H8kXt2o5.js";
import "./index-BAtqSMr7.js";
import "./_commonjsHelpers-Dm6U3U_N.js";
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "WdOverlaySwitchItem",
  props: {
    label: {},
    icon: {},
    active: { type: Boolean },
    tooltip: { type: Boolean }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QBtn, {
        "fab-mini": "",
        round: "",
        style: { "padding": "0" },
        ripple: false,
        color: _ctx.active ? "accent-200" : "icon"
      }, {
        default: withCtx(() => [
          createVNode(QIcon, {
            name: _ctx.icon,
            class: normalizeClass({ "icon-active": _ctx.active, "icon-inactive": !_ctx.active })
          }, null, 8, ["name", "class"])
        ]),
        _: 1
      }, 8, ["color"]);
    };
  }
});
const __unplugin_components_0$2 = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__file", "WdOverlaySwitchItem.vue"]]);
const __vite_glob_0_0$1 = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='iso-8859-1'?%3e%3c!--%20Generator:%20Adobe%20Illustrator%2019.0.0,%20SVG%20Export%20Plug-In%20.%20SVG%20Version:%206.00%20Build%200)%20--%3e%3csvg%20version='1.1'%20id='Capa_1'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20x='0px'%20y='0px'%20viewBox='0%200%20512%20512'%20style='enable-background:new%200%200%20512%20512;'%20xml:space='preserve'%3e%3cg%3e%3cg%3e%3cg%3e%3cpath%20d='M330.667,122.667c23.467,0,42.667-19.2,42.667-42.667s-19.2-42.667-42.667-42.667S288,56.533,288,80%20S307.2,122.667,330.667,122.667z'/%3e%3cpath%20d='M106.667,261.333C48,261.333,0,309.333,0,368s48,106.667,106.667,106.667c58.667,0,106.667-48,106.667-106.667%20S165.333,261.333,106.667,261.333z%20M106.667,442.667C65.067,442.667,32,409.6,32,368s33.067-74.667,74.667-74.667%20c41.6,0,74.667,33.067,74.667,74.667S148.267,442.667,106.667,442.667z'/%3e%3cpath%20d='M404.267,238.933v-42.667c-32,0-58.667-11.733-77.867-30.933L284.8,124.8c-6.4-7.467-17.067-12.8-28.8-12.8%20s-22.4,4.267-29.867,12.8l-58.667,58.667c-7.467,7.467-12.8,18.133-12.8,29.867s5.333,22.4,12.8,30.933l67.2,59.733v106.667%20h42.667V277.333L230.4,230.4l50.133-51.2l16,16C323.2,222.933,360.533,238.933,404.267,238.933z'/%3e%3cpath%20d='M405.333,261.333c-58.667,0-106.667,48-106.667,106.667s48,106.667,106.667,106.667C464,474.667,512,426.667,512,368%20S464,261.333,405.333,261.333z%20M405.333,442.667c-41.6,0-74.667-33.067-74.667-74.667s33.067-74.667,74.667-74.667%20C446.933,293.333,480,326.4,480,368S446.933,442.667,405.333,442.667z'/%3e%3c/g%3e%3c/g%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3cg%3e%3c/g%3e%3c/svg%3e";
const __vite_glob_0_1$1 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1em'%20height='1em'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='currentColor'%20d='m7%2023l3.075-15.55q.15-.725.675-1.088T11.85%206t1.063.25t.787.75l1%201.6q.45.725%201.163%201.313t1.637.862V9H19v14h-1.5V12.85q-1.2-.275-2.225-.875T13.5%2010.5l-.6%203l2.1%202V23h-2v-6l-2.1-2l-1.8%208zm.425-9.875l-2.125-.4q-.4-.075-.625-.413t-.15-.762l.75-3.925q.15-.8.85-1.263t1.5-.312l1.15.225zM13.5%205.5q-.825%200-1.412-.587T11.5%203.5t.588-1.412T13.5%201.5t1.413.588T15.5%203.5t-.587%201.413T13.5%205.5'/%3e%3c/svg%3e";
const __vite_glob_0_2$1 = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'%20standalone='no'?%3e%3csvg%20id='Layer_1'%20enable-background='new%200%200%20479.994%20479.994'%20height='512'%20viewBox='0%200%20479.994%20479.994'%20width='512'%20version='1.1'%20sodipodi:docname='hillslope.svg'%20inkscape:version='1.3.2%20(091e20ef0f,%202023-11-25)'%20xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape'%20xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:svg='http://www.w3.org/2000/svg'%3e%3cdefs%20id='defs8'%20/%3e%3csodipodi:namedview%20id='namedview8'%20pagecolor='%23ffffff'%20bordercolor='%23000000'%20borderopacity='0.25'%20inkscape:showpageshadow='2'%20inkscape:pageopacity='0.0'%20inkscape:pagecheckerboard='0'%20inkscape:deskcolor='%23d1d1d1'%20inkscape:zoom='1.1367188'%20inkscape:cx='220.37112'%20inkscape:cy='333.41579'%20inkscape:window-width='2560'%20inkscape:window-height='1375'%20inkscape:window-x='2240'%20inkscape:window-y='0'%20inkscape:window-maximized='1'%20inkscape:current-layer='Layer_1'%20/%3e%3cpath%20d='m%20451.19421,229.40195%20c%20-1.41721,-4.83386%20-6.10866,-7.27326%20-10.18435,-5.28351%20-23.15133,11.33031%20-47.584,8.98646%20-67.85008,-4.19309%20-2.88329,-1.87734%20-6.43119,-1.39395%20-8.92352,1.10167%20-15.2394,15.30645%20-39.36126,15.4627%20-52.99382,-2.63052%20-2.44346,-3.2488%20-6.54849,-3.99074%20-9.74453,-1.77616%20-27.08627,18.74635%20-63.55154,15.01642%20-85.57007,-10.85931%20-3.02012,-3.54107%20-8.02433,-3.36121%20-10.96626,0.2698%20-34.62875,42.81894%20-71.07545,84.03034%20-108.92957,123.17331%20-5.219236,5.38468%20-1.925448,15.32219%205.0824,15.32219%20h%2092.71475%20c%2010.35051,0%2010.35051,17.98643%200,17.98643%20-173.887557,0%20-144.563071,-0.0978%20-161.45424,0.23607%20C%2017.391605,363.04448%205.369769,378.10474%206.7967512,395.65275%208.057578,411.22226%2019.795974,422.90219%2033.3914,422.90219%20h%20416.27809%20c%2014.65784,0%2026.44901,-13.80458%2026.14505,-30.65561%20-0.98716,-55.8816%20-9.24607,-110.49289%20-24.62033,-162.84463%20z%20M%20238.19267,362.51276%20h%20-6.55825%20c%20-10.3505,0%20-10.3505,-17.98643%200,-17.98643%20h%206.55825%20c%2010.35051,0%2010.35051,17.98643%200,17.98643%20z'%20id='path1'%20style='stroke-width:1.0482'%20/%3e%3cpath%20d='m%20237.35115,109.59547%20c%207.25512,-7.03607%2017.25769,4.37857%2010.87927,13.06826%20-47.28589,64.70281%20-99.88485,127.54514%20-155.257625,185.45695%20-3.36025,0.45077%20-5.784164,0.77565%20-9.144414,1.22756%20-17.380839,-10.77386%20-27.942463,-30.43078%20-27.888707,-52.53948%200,-26.59855%2014.228772,-53.58943%2034.941518,-66.22378%2015.902058,-9.70142%2033.289738,-10.00494%2049.621848,-1.03421%2010.35441,-13.41675%2026.75787,-16.84317%2039.76002,-7.80162%2059.52471,-75.66778%2055.20173,-70.32469%2057.08809,-72.15368%20z'%20id='path4'%20style='stroke-width:1.0482'%20/%3e%3cpath%20d='m%20440.08818,195.32778%20c%201.61855,4.50223%20-0.16127,9.68232%20-4.03073,11.66421%20-22.82879,11.69566%20-47.42859,6.7033%20-64.76447,-10.3928%20-3.97014,-3.8963%20-10.03188,-2.31574%20-12.18799,3.06894%20-4.31028,10.73565%20-16.58624,17.00842%20-26.81946,13.68093%20-7.46722,-2.42817%20-12.90147,-9.7464%20-13.51722,-18.20002%20-0.57862,-7.93426%20-9.20893,-11.17182%20-13.7225,-5.11489%20-19.46559,26.08706%20-58.69588,27.63839%20-79.15353,1.66262%20-2.68878,-3.41405%20-2.67119,-8.61662%200.004,-12.04416%2021.49857,-27.54509%2043.73407,-57.75892%2064.99709,-88.54494%2026.44609,-38.280741%2077.57212,-36.455118%20101.76534,3.912048%2018.8606,31.469512%2034.87309,65.375042%2047.42956,100.308062%20z'%20id='path8'%20style='stroke-width:1.0482'%20/%3e%3c/svg%3e";
const __vite_glob_0_3$1 = "data:image/svg+xml,%3csvg%20width='56'%20height='56'%20version='1.1'%20viewBox='0%200%2056%2056'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='m0.6249%2027.824c0%201.125%200.8906%201.8047%201.9922%201.8047%200.6797%200%201.2187-0.3281%201.6875-0.7969l22.875-20.836c0.2578-0.2578%200.5391-0.3516%200.8437-0.3516%200.2813%200%200.5391%200.0938%200.8203%200.3516l22.852%2020.836c0.492%200.4688%201.031%200.7969%201.6872%200.7969%201.1016%200%201.9925-0.6797%201.9925-1.8047%200-0.7031-0.2578-1.1484-0.7032-1.5468l-8.1096-7.3829v-13.852c0-1.0313-0.6562-1.6875-1.6872-1.6875h-3.0705c-1.0078%200-1.711%200.6562-1.711%201.6875v7.9687l-9.2812-8.4843c-0.8203-0.7735-1.8281-1.1485-2.8125-1.1485s-1.9687%200.375-2.8125%201.1485l-23.859%2021.75c-0.4218%200.3984-0.7031%200.8437-0.7031%201.5468zm6.7031%2019.664c0%203.2578%201.9688%205.1562%205.2735%205.1562h30.82c3.3048%200%205.2503-1.8984%205.2503-5.1562v-17.156l-19.898-17.93c-0.2579-0.2344-0.5391-0.3515-0.8203-0.3515-0.2579%200-0.5157%200.1171-0.7969%200.375l-19.828%2018.023z'/%3e%3c/svg%3e";
const __vite_glob_0_4$1 = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'%20standalone='no'?%3e%3csvg%20id='Layer_1'%20enable-background='new%200%200%20512%20512'%20height='512'%20viewBox='0%200%20512%20512'%20width='512'%20version='1.1'%20sodipodi:docname='mtb.svg'%20inkscape:version='1.3.2%20(091e20ef0f,%202023-11-25)'%20xmlns:inkscape='http://www.inkscape.org/namespaces/inkscape'%20xmlns:sodipodi='http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'%20xmlns='http://www.w3.org/2000/svg'%20xmlns:svg='http://www.w3.org/2000/svg'%3e%3cdefs%20id='defs5'%20/%3e%3csodipodi:namedview%20id='namedview5'%20pagecolor='%23ffffff'%20bordercolor='%23000000'%20borderopacity='0.25'%20inkscape:showpageshadow='2'%20inkscape:pageopacity='0.0'%20inkscape:pagecheckerboard='0'%20inkscape:deskcolor='%23d1d1d1'%20inkscape:zoom='1.1367188'%20inkscape:cx='253.80069'%20inkscape:cy='332.53608'%20inkscape:window-width='2560'%20inkscape:window-height='1375'%20inkscape:window-x='2240'%20inkscape:window-y='0'%20inkscape:window-maximized='1'%20inkscape:current-layer='Layer_1'%20/%3e%3cg%20id='Layer_2_00000007405547900734707610000009233547936779136646_'%20transform='rotate(-22.23363,186.32649,345.92562)'%3e%3cg%20id='cycling'%3e%3cg%20id='icon'%3e%3cpath%20d='m%20285,197.3%20-49,40.1%20c%2011.7,7.6%2022,14.5%2032.5,21.2%209.2,5.9%2013.5,14%2013.4,25%20-0.2,32.7%200,65.4%20-0.1,98.1%20-0.1,16.5%20-10.1,27.5%20-24.6,27.5%20-14.5,0%20-24.6,-10.9%20-24.6,-27.5%20-0.1,-24.9%20-0.5,-49.8%200.2,-74.6%200.2,-8.9%20-2.2,-14.4%20-10.1,-18.8%20-12.4,-6.9%20-24.3,-14.8%20-36.1,-22.6%20-29.8,-19.7%20-31.2,-54.7%20-3.2,-76.6%2019.6,-15.3%2039.3,-30.5%2059.1,-45.6%2019.8,-15.2%2034.9,-15%2054.9,0.4%2011.8,9.1%2024,17.8%2035.3,27.5%207,6%2014.3,8.2%2023.3,7.7%209.6,-0.5%2019.2,-0.3%2028.8,0%2014.8,0.5%2025.2,11%2025.2,24.8%200,14.7%20-9.5,24.2%20-24.9,24.4%20-17,0.3%20-34.1,0.5%20-51.2,-0.2%20-5.6,-0.4%20-10.9,-2.2%20-15.5,-5.4%20-11.3,-7.6%20-21.7,-16.3%20-33.4,-25.4%20z'%20id='path1'%20/%3e%3cpath%20d='m%20218.2,84%20c%208.8,6.9%2015.8,15.6%2018.5,24.7%201.4,4.8%20-0.9,11.3%20-4.8,14.3%20-26.2,20.5%20-53,40.3%20-79.8,60%20-6.8,5%20-13.4,3.7%20-18.7,-2.9%20-10.9,-13.5%20-22,-26.9%20-32.6,-40.7%20-6.7,-8.7%20-5.8,-13.9%203.1,-20.7%2016.6,-12.8%2033,-25.9%2050.4,-37.5%201.4,-0.9%202.9,-1.8%204.4,-2.6%2019.2,-10.1%2042.5,-8%2059.5,5.4%20z'%20id='path2'%20/%3e%3cpath%20d='m%20409.6,255.8%20c%20-56.6,0%20-102.4,45.8%20-102.4,102.4%200,56.6%2045.8,102.4%20102.4,102.4%2056.6,0%20102.4,-45.8%20102.4,-102.4%200,-56.5%20-45.8,-102.4%20-102.4,-102.4%20z%20m%200,162.1%20c%20-33,0%20-59.7,-26.7%20-59.8,-59.7%200,-33%2026.7,-59.7%2059.7,-59.7%2033,0%2059.7,26.7%2059.8,59.7%200,33%20-26.7,59.7%20-59.7,59.7%20z'%20id='path3'%20/%3e%3cpath%20d='M%20102.4,255.8%20C%2045.8,255.8%200,301.7%200,358.2%20c%200,56.5%2045.8,102.4%20102.4,102.4%2056.6,0%20102.4,-45.8%20102.4,-102.4%200,-56.5%20-45.8,-102.4%20-102.4,-102.4%20z%20m%200,162.1%20c%20-33,0%20-59.7,-26.7%20-59.8,-59.7%200,-33%2026.7,-59.7%2059.7,-59.7%2033,0%2059.7,26.7%2059.8,59.7%200,33%20-26.7,59.7%20-59.7,59.7%20z'%20id='path4'%20/%3e%3cpath%20d='m%20358.5,89.8%20c%20-0.2,20.2%20-17.4,37.5%20-37.3,37.6%20-20.2,0.1%20-37.8,-17.9%20-37.5,-38.4%200.2,-20.2%2017.4,-37.5%2037.3,-37.6%2020.1,-0.1%2037.7,17.9%2037.5,38.4%20z'%20id='path5'%20/%3e%3c/g%3e%3c/g%3e%3c/g%3e%3c/svg%3e";
const __vite_glob_0_5$1 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1em'%20height='1em'%20viewBox='0%200%20256%20256'%3e%3cpath%20fill='currentColor'%20d='M176%2092a32%2032%200%201%200-32-32a32%2032%200%200%200%2032%2032m0-40a8%208%200%201%201-8%208a8%208%200%200%201%208-8M28.48%2080.64a12%2012%200%200%201%2014.88-8.16l67.5%2019.68l8.66-8.65a12%2012%200%200%201%2017%200L165%20112h35a12%2012%200%200%201%200%2024h-40a12%2012%200%200%201-8.48-3.51l-4.89-4.89l-110-32.07a12%2012%200%200%201-8.15-14.89m210.17%20130.93A73.77%2073.77%200%200%201%20177%20221L20.65%20175.51a12%2012%200%201%201%206.71-23l79.92%2023.27l13.81-13.81l-36.39-10.44a12%2012%200%201%201%206.6-23.07l56%2016a12%2012%200%200%201%205.19%2020l-18.93%2018.94l50.1%2014.6a49.81%2049.81%200%200%200%2041.68-6.39a12%2012%200%200%201%2013.31%2020Z'/%3e%3c/svg%3e";
const __vite_glob_0_6 = "data:image/svg+xml,%3csvg%20width='512'%20height='512'%20enable-background='new%200%200%20512.002%20512.002'%20version='1.1'%20viewBox='0%200%20512%20512'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%3e%3cpath%20d='m245.07%2029.846c-19.832%206.6603-30.791%2028.981-24.433%2049.754%200.67442%202.2004%202.2768%203.9516%204.3454%204.7492%201.5139%200.5837%203.1528%200.60864%204.6582%200.10308%200.4218-0.14166%200.8277-0.33731%201.222-0.56219%207.0607%2012.183%2021.423%2018.212%2034.935%2013.674%2015.814-5.3109%2024.553-23.108%2019.483-39.674-0.78222-2.5559-1.8858-4.9946-3.2524-7.2555%201.6179-1.2417%202.6792-3.137%202.8943-5.2444%200.23447-2.2998-0.55652-4.5829-2.145-6.1896-10.074-10.198-24.522-13.782-37.707-9.3544zm-9.4295%2085.753c-3.2878%201.0059-6.3699%202.5936-9.1222%204.6573l-74.676%2025.08c-15.814%205.3109-24.553%2023.108-19.483%2039.674l19.534%2063.826-140.72%20119.92c-3.0664%202.6145-3.5301%207.3392-1.0333%2010.551%201.9153%202.4652%205.0165%203.3239%207.7409%202.4089%200.82631-0.27751%201.6172-0.71807%202.3313-1.3265l143.53-122.32c15.081-5.8273%2024.107-22.323%2021.111-39.011l-5.9928-33.374c-0.84605-5.4903-3.0075-6.648%2013.188-12.305l18.341-6.1596-10.613%2071.975c-0.87345%205.9179-0.0633%2014.603%200.62542%2019.189l15.437%2083.374-34.861%2073.988c-1.5569%203.3047%200.61164%2010.646%203.4804%2012.778l31.204%2023.192c1.9126%201.4212%204.2597%201.7146%206.3339%201.0232l6e-3%20-2e-3%20252.7-84.867c11.553-3.88%2019.771-15.583%2025.321-26.885l2.6514-5.3987c1.8092-3.6824%200.42532-8.2042-3.0909-10.099-3.5162-1.895-7.8328-0.44525-9.6408%203.2378l-2.6513%205.3987c-3.801%207.738-10.251%2013.462-18.163%2016.119l-104.18%2034.99%2013.722-204.26c0.27813-4.1322-2.6943-7.7168-6.6387-8.0072-3.9462-0.29294-7.3684%202.823-7.6456%206.955l-0.80782%2012.03-57.768-11.478-23.761-42.587c-7.5782-13.582-21.045-22.35-36.049-23.456-3.5737-0.26316-7.0673%200.16031-10.355%201.1662zm29.659%2092.635%209.2091%2011.109c6.9312%208.3594%2016.965%2013.318%2027.532%2013.606l58.671%201.6001-10.452%20155.62-10.429%203.5026-24.876-81.281c-2.5026-8.177-6.8531-15.745-12.581-21.885l-37.761-40.475c-3.4412-4.6341-5.6953-9.6141-2.9645-22.308zm1.0356%20123.98%2030.121%2076.026-50.34%2016.906-11.216-12.057%2027.345-55.677c0.35203-0.7168%200.59044-1.4881%200.70847-2.2849zm-151.93%20137.17c-3.7652%201.2645-5.8391%205.4874-4.632%209.4317%201.2071%203.9442%207.0063%2010.398%2010.771%209.1333l65.584-22.026c3.7652-1.2645%204.0712-9.7685%202.8641-13.713-1.2071-3.9442-5.2384-6.1168-9.0036-4.8522z'%20stroke-width='.97704'/%3e%3c/g%3e%3c/svg%3e";
const __vite_glob_0_7 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1em'%20height='1em'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='currentColor'%20d='M8.5%2023q-.45%200-1.088-.475t-1.037-.975L4%2018.5l1.175-.95l1.15%201.475L9.2%2017l1.6-8.125l-1.8.7V13H7V8.275l4.125-1.725q.8-.35%201.175-.45T13%206q.525%200%20.963.275T14.7%207l1%201.575q.65%201.025%201.763%201.725T20%2011v2q-1.65%200-3.088-.7T14.5%2010.475l-.6%203l2.1%202V21.5q.375-.025.713-.125t.637-.275q.1-.05.187-.075t.188-.025q.35%200%20.562.238t.213.512q0%20.2-.088.363t-.287.287q-.5.3-1.062.45t-1.188.15H12v-1.5h2v-4.525l-2.1-2L11%2018.2l-3.425%202.425l.075.1q.225.3.512.5t.638.325q.225.125.35.263t.125.412q0%20.325-.225.55T8.5%2023m6-17.5q-.825%200-1.413-.587T12.5%203.5t.588-1.412T14.5%201.5t1.413.588T16.5%203.5t-.587%201.413T14.5%205.5'/%3e%3c/svg%3e";
const __vite_glob_0_8 = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1em'%20height='1em'%20viewBox='0%200%2024%2024'%3e%3cpath%20fill='currentColor'%20d='M18%2011H6V6h12m-1.5%2011a1.5%201.5%200%200%201-1.5-1.5a1.5%201.5%200%200%201%201.5-1.5a1.5%201.5%200%200%201%201.5%201.5a1.5%201.5%200%200%201-1.5%201.5m-9%200A1.5%201.5%200%200%201%206%2015.5A1.5%201.5%200%200%201%207.5%2014A1.5%201.5%200%200%201%209%2015.5A1.5%201.5%200%200%201%207.5%2017M4%2016c0%20.88.39%201.67%201%202.22V20a1%201%200%200%200%201%201h1a1%201%200%200%200%201-1v-1h8v1a1%201%200%200%200%201%201h1a1%201%200%200%200%201-1v-1.78c.61-.55%201-1.34%201-2.22V6c0-3.5-3.58-4-8-4s-8%20.5-8%204z'/%3e%3c/svg%3e";
const labelPositions = ["top", "right", "bottom", "left"];
const useFabProps = {
  type: {
    type: String,
    default: "a"
  },
  outline: Boolean,
  push: Boolean,
  flat: Boolean,
  unelevated: Boolean,
  color: String,
  textColor: String,
  glossy: Boolean,
  square: Boolean,
  padding: String,
  label: {
    type: [String, Number],
    default: ""
  },
  labelPosition: {
    type: String,
    default: "right",
    validator: (v) => labelPositions.includes(v)
  },
  externalLabel: Boolean,
  hideLabel: {
    type: Boolean
  },
  labelClass: [Array, String, Object],
  labelStyle: [Array, String, Object],
  disable: Boolean,
  tabindex: [Number, String]
};
function useFab(props, showing) {
  return {
    formClass: computed(
      () => `q-fab--form-${props.square === true ? "square" : "rounded"}`
    ),
    stacked: computed(
      () => props.externalLabel === false && ["top", "bottom"].includes(props.labelPosition)
    ),
    labelProps: computed(() => {
      if (props.externalLabel === true) {
        const hideLabel = props.hideLabel === null ? showing.value === false : props.hideLabel;
        return {
          action: "push",
          data: {
            class: [
              props.labelClass,
              `q-fab__label q-tooltip--style q-fab__label--external q-fab__label--external-${props.labelPosition}` + (hideLabel === true ? " q-fab__label--external-hidden" : "")
            ],
            style: props.labelStyle
          }
        };
      }
      return {
        action: ["left", "top"].includes(props.labelPosition) ? "unshift" : "push",
        data: {
          class: [
            props.labelClass,
            `q-fab__label q-fab__label--internal q-fab__label--internal-${props.labelPosition}` + (props.hideLabel === true ? " q-fab__label--internal-hidden" : "")
          ],
          style: props.labelStyle
        }
      };
    })
  };
}
const directions = ["up", "right", "down", "left"];
const alignValues = ["left", "center", "right"];
const QFab = createComponent({
  name: "QFab",
  props: {
    ...useFabProps,
    ...useModelToggleProps,
    icon: String,
    activeIcon: String,
    hideIcon: Boolean,
    hideLabel: {
      ...useFabProps.hideLabel,
      default: null
    },
    direction: {
      type: String,
      default: "right",
      validator: (v) => directions.includes(v)
    },
    persistent: Boolean,
    verticalActionsAlign: {
      type: String,
      default: "center",
      validator: (v) => alignValues.includes(v)
    }
  },
  emits: useModelToggleEmits,
  setup(props, { slots }) {
    const triggerRef = ref(null);
    const showing = ref(props.modelValue === true);
    const targetUid = useId();
    const { proxy: { $q } } = getCurrentInstance();
    const { formClass, labelProps } = useFab(props, showing);
    const hideOnRouteChange = computed(() => props.persistent !== true);
    const { hide, toggle } = useModelToggle({
      showing,
      hideOnRouteChange
    });
    const slotScope = computed(() => ({ opened: showing.value }));
    const classes = computed(
      () => `q-fab z-fab row inline justify-center q-fab--align-${props.verticalActionsAlign} ${formClass.value}` + (showing.value === true ? " q-fab--opened" : " q-fab--closed")
    );
    const actionClass = computed(
      () => `q-fab__actions flex no-wrap inline q-fab__actions--${props.direction} q-fab__actions--${showing.value === true ? "opened" : "closed"}`
    );
    const actionAttrs = computed(() => {
      const attrs = {
        id: targetUid.value,
        role: "menu"
      };
      if (showing.value !== true) {
        attrs["aria-hidden"] = "true";
      }
      return attrs;
    });
    const iconHolderClass = computed(
      () => `q-fab__icon-holder  q-fab__icon-holder--${showing.value === true ? "opened" : "closed"}`
    );
    function getIcon(kebab, camel) {
      const slotFn = slots[kebab];
      const classes2 = `q-fab__${kebab} absolute-full`;
      return slotFn === void 0 ? h(QIcon, { class: classes2, name: props[camel] || $q.iconSet.fab[camel] }) : h("div", { class: classes2 }, slotFn(slotScope.value));
    }
    function getTriggerContent() {
      const child = [];
      props.hideIcon !== true && child.push(
        h("div", { class: iconHolderClass.value }, [
          getIcon("icon", "icon"),
          getIcon("active-icon", "activeIcon")
        ])
      );
      if (props.label !== "" || slots.label !== void 0) {
        child[labelProps.value.action](
          h("div", labelProps.value.data, slots.label !== void 0 ? slots.label(slotScope.value) : [props.label])
        );
      }
      return hMergeSlot(slots.tooltip, child);
    }
    provide(fabKey, {
      showing,
      onChildClick(evt) {
        hide(evt);
        if (triggerRef.value !== null) {
          triggerRef.value.$el.focus();
        }
      }
    });
    return () => h("div", {
      class: classes.value
    }, [
      h(QBtn, {
        ref: triggerRef,
        class: formClass.value,
        ...props,
        noWrap: true,
        stack: props.stacked,
        align: void 0,
        icon: void 0,
        label: void 0,
        noCaps: true,
        fab: true,
        "aria-expanded": showing.value === true ? "true" : "false",
        "aria-haspopup": "true",
        "aria-controls": targetUid.value,
        onClick: toggle
      }, getTriggerContent),
      h("div", { class: actionClass.value, ...actionAttrs.value }, hSlot(slots.default))
    ]);
  }
});
const usePageStickyProps = {
  position: {
    type: String,
    default: "bottom-right",
    validator: (v) => [
      "top-right",
      "top-left",
      "bottom-right",
      "bottom-left",
      "top",
      "right",
      "bottom",
      "left"
    ].includes(v)
  },
  offset: {
    type: Array,
    validator: (v) => v.length === 2
  },
  expand: Boolean
};
function usePageSticky() {
  const { props, proxy: { $q } } = getCurrentInstance();
  const $layout = inject(layoutKey, emptyRenderFn);
  if ($layout === emptyRenderFn) {
    console.error("QPageSticky needs to be child of QLayout");
    return emptyRenderFn;
  }
  const attach = computed(() => {
    const pos = props.position;
    return {
      top: pos.indexOf("top") !== -1,
      right: pos.indexOf("right") !== -1,
      bottom: pos.indexOf("bottom") !== -1,
      left: pos.indexOf("left") !== -1,
      vertical: pos === "top" || pos === "bottom",
      horizontal: pos === "left" || pos === "right"
    };
  });
  const top = computed(() => $layout.header.offset);
  const right = computed(() => $layout.right.offset);
  const bottom = computed(() => $layout.footer.offset);
  const left = computed(() => $layout.left.offset);
  const style = computed(() => {
    let posX = 0, posY = 0;
    const side = attach.value;
    const dir = $q.lang.rtl === true ? -1 : 1;
    if (side.top === true && top.value !== 0) {
      posY = `${top.value}px`;
    } else if (side.bottom === true && bottom.value !== 0) {
      posY = `${-bottom.value}px`;
    }
    if (side.left === true && left.value !== 0) {
      posX = `${dir * left.value}px`;
    } else if (side.right === true && right.value !== 0) {
      posX = `${-dir * right.value}px`;
    }
    const css = { transform: `translate(${posX}, ${posY})` };
    if (props.offset) {
      css.margin = `${props.offset[1]}px ${props.offset[0]}px`;
    }
    if (side.vertical === true) {
      if (left.value !== 0) {
        css[$q.lang.rtl === true ? "right" : "left"] = `${left.value}px`;
      }
      if (right.value !== 0) {
        css[$q.lang.rtl === true ? "left" : "right"] = `${right.value}px`;
      }
    } else if (side.horizontal === true) {
      if (top.value !== 0) {
        css.top = `${top.value}px`;
      }
      if (bottom.value !== 0) {
        css.bottom = `${bottom.value}px`;
      }
    }
    return css;
  });
  const classes = computed(
    () => `q-page-sticky row flex-center fixed-${props.position} q-page-sticky--${props.expand === true ? "expand" : "shrink"}`
  );
  function getStickyContent(slots) {
    const content = hSlot(slots.default);
    return h(
      "div",
      {
        class: classes.value,
        style: style.value
      },
      props.expand === true ? content : [h("div", content)]
    );
  }
  return {
    $layout,
    getStickyContent
  };
}
const QPageSticky = createComponent({
  name: "QPageSticky",
  props: usePageStickyProps,
  setup(_, { slots }) {
    const { getStickyContent } = usePageSticky();
    return () => getStickyContent(slots);
  }
});
function getRasterStyle({
  name,
  tiles,
  attribution = "",
  tileSize = 256,
  minZoom = 0,
  maxZoom = 22,
  suffix = "wd-"
}) {
  const style = {
    version: 8,
    name,
    sources: {},
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    //sprite: { id: 'default', url: 'http://localhost:9000/huts/sprite' },
    layers: [
      {
        id: `${suffix}${name}`,
        type: "raster",
        source: `${suffix}${name}`,
        minzoom: minZoom,
        maxzoom: maxZoom
      }
    ]
  };
  style.sources[`${suffix}${name}`] = {
    type: "raster",
    tiles,
    tileSize,
    attribution
  };
  return style;
}
function getSwisstopoOverlay({
  name,
  label,
  icon = "fa-solid fa-notdef",
  format = "png",
  active = false,
  show = true,
  onLayer = "ways",
  tileMatrixSet = 3857,
  attribution = "",
  //visibility = 'none',
  opacity = 0.7,
  minZoom = 0,
  maxZoom = 22,
  tileSize = 256
}) {
  return {
    name,
    label,
    show,
    active,
    onLayer,
    icon,
    opacity,
    style: getRasterStyle({
      name,
      attribution,
      tiles: [
        `https://wmts0.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts1.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts2.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts3.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts4.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts5.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts6.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts7.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts8.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts9.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`
      ],
      minZoom,
      maxZoom,
      tileSize
    })
  };
}
function matchType(train, bus, other) {
  return [
    "case",
    ["in", "train", ["get", "types"]],
    train,
    ["in", "bus", ["get", "types"]],
    bus,
    other
  ];
}
function getRadius() {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    matchType(3, 2, 1),
    9,
    matchType(4, 3, 3),
    16,
    matchType(9, 8, 8)
  ];
}
const transportStopsLayerPaint = {
  "circle-color": matchType("#C60018", "#2d327d", "#0079C7"),
  //getAvailColors(0),
  "circle-stroke-color": "#F6F6F6",
  "circle-stroke-width": [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    0,
    12,
    1,
    16,
    2
  ],
  //'circle-opacity': 0.6,
  "circle-radius": getRadius(),
  "circle-opacity": [
    "interpolate",
    ["linear"],
    ["zoom"],
    6,
    0,
    7,
    0.3,
    10,
    0.6,
    14,
    1
  ]
};
const transportStyle = {
  version: 8,
  sources: {
    "transport-stops": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson",
      //data: transportStopsGeojson.value,
      promoteId: "id"
    }
  },
  layers: [
    {
      id: "transport-stops",
      type: "circle",
      source: "transport-stops",
      //filter: hutsOccupationFilter,
      layout: { visibility: "none" },
      paint: transportStopsLayerPaint
    }
  ]
};
const { bookingsGeojson } = storeToRefs(useHutsStore());
const mapRef = ut();
const imageSwitchZoom = 11;
const hutsLayerLayout = {
  "text-field": ["get", "name"],
  "text-size": ["interpolate", ["linear"], ["zoom"], 7, 7, 9, 10, 22, 16],
  //'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
  "text-font": ["Open Sans Semibold"],
  "text-anchor": "bottom",
  "icon-allow-overlap": true,
  "text-allow-overlap": false,
  "symbol-sort-key": ["get", "type_id"],
  "icon-overlap": "always",
  "text-overlap": "never",
  "text-optional": true,
  "icon-image": [
    "step",
    ["zoom"],
    [
      "coalesce",
      ["image", ["concat", "wodore:simple/", ["get", "type_open_slug"]]],
      ["image", "wodore:simple/unknown"]
    ],
    imageSwitchZoom,
    [
      "coalesce",
      ["image", ["concat", "wodore:detailed/", ["get", "type_open_slug"]]],
      ["image", "wodore:detailed/unknown"]
    ]
  ],
  //'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.05, 9, 0.1, 20, 1],
  "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.1, 9, 0.3, 20, 2],
  visibility: "visible"
};
const hutsLayerPaint = {
  "icon-opacity": [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    0.7,
    12,
    0.8,
    22,
    0.85
  ],
  "text-opacity": ["step", ["zoom"], 0, 9, 1],
  "text-halo-width": 2,
  "text-halo-color": "#ffffff",
  "text-translate": [
    "interpolate",
    ["linear"],
    ["zoom"],
    9,
    ["literal", [0, -6]],
    20,
    ["literal", [0, -40]]
  ]
};
const hutsLayerSelectedPaint = {
  "circle-blur": 0.7,
  "circle-color": [
    "case",
    ["boolean", ["feature-state", "color"], false],
    ["feature-state", "color"],
    "#3366ff"
  ],
  "circle-opacity": [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    0.7,
    0
  ],
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 10, 15, 40]
};
function getAvailColors(day) {
  return [
    "match",
    ["get", "occupancy_status", ["at", day, ["get", "bookings"]]],
    "empty",
    "#f7fd25",
    "low",
    "#82cf06",
    "medium",
    "#eab138",
    "high",
    "#e16f07",
    "full",
    "#d32226",
    "#d4d4d4"
  ];
}
const hutsOccupationLayerPaint = {
  "circle-color": getAvailColors(0),
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 9, 10, 20, 60],
  "circle-opacity": [
    "interpolate",
    ["linear"],
    ["zoom"],
    6,
    0.8,
    10,
    0.6,
    11,
    0.5,
    13,
    0
  ]
};
function getHutsOccupationDayLayout(day) {
  return {
    visibility: "visible",
    "text-field": [
      "case",
      ["<", day, ["length", ["get", "bookings"]]],
      [
        "concat",
        ["get", "free", ["at", day, ["get", "bookings"]]],
        "\n",
        ["get", "total", ["at", day, ["get", "bookings"]]]
      ],
      ""
    ],
    "text-size": ["interpolate", ["linear"], ["zoom"], 12, 7, 14, 10],
    //'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
    "text-font": ["Open Sans Semibold"],
    "icon-allow-overlap": true,
    "text-allow-overlap": true,
    "icon-image": [
      "coalesce",
      [
        "image",
        [
          "concat",
          "wodore:occupation_",
          [
            "case",
            ["<", day, ["length", ["get", "bookings"]]],
            ["get", "occupancy_status", ["at", day, ["get", "bookings"]]],
            "unknown"
          ]
        ]
      ],
      ["image", "wodore:occupation_unknown"]
    ],
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      7,
      0.1,
      12,
      0.3,
      15,
      0.6
    ]
  };
}
function occTranslate(day) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    //0,
    //['literal', [(day - 1.5) * 2, 0.1]],
    9,
    ["literal", [(day - 1.5) * 7, 11 + Math.abs(day - 1.5) * -2]],
    20,
    ["literal", [(day - 1.5) * 40, 90 + Math.abs(day - 1.5) * -10]]
  ];
}
function getHutsOccupationDayPaint(day) {
  return {
    "icon-translate": occTranslate(day),
    "text-translate": occTranslate(day),
    //'text-opacity': ['step', ['zoom'], 0, 12, 0.6],
    "text-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      0,
      12,
      0.4,
      14,
      0.6
    ],
    "icon-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      0,
      10,
      0.8,
      11,
      1,
      13,
      1,
      15,
      0.7
    ]
    //'icon-opacity': ['step', ['zoom'], 0, 8, 1],
  };
}
function hutsOccpationDetailLayer(day) {
  return {
    id: `wd-huts-occupation-day${day}`,
    type: "symbol",
    source: "wd-bookings",
    //filter: hutsOccupationFilter,
    minzoom: 8,
    layout: getHutsOccupationDayLayout(day),
    paint: getHutsOccupationDayPaint(day)
  };
}
const hutsStyle = {
  version: 8,
  sources: {
    "wd-huts": {
      type: "geojson",
      //data: hutsGeojson.value,
      data: `${"https://api.wodore.com"}/${"v1"}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
      promoteId: "slug"
    },
    "wd-bookings": {
      type: "geojson",
      data: bookingsGeojson.value,
      promoteId: "hut_id"
    }
  },
  layers: [
    hutsOccpationDetailLayer(0),
    hutsOccpationDetailLayer(1),
    hutsOccpationDetailLayer(2),
    hutsOccpationDetailLayer(3),
    {
      id: "wd-huts-occupation",
      type: "circle",
      source: "wd-bookings",
      maxzoom: 13,
      //filter: hutsOccupationFilter,
      layout: {
        visibility: "visible"
      },
      paint: hutsOccupationLayerPaint
    },
    {
      id: "wd-huts-selected",
      type: "circle",
      source: "wd-huts",
      layout: { visibility: "visible" },
      paint: hutsLayerSelectedPaint
    },
    {
      id: "wd-huts",
      type: "symbol",
      source: "wd-huts",
      layout: hutsLayerLayout,
      paint: hutsLayerPaint
    }
  ]
};
watchEffect(() => {
  console.debug("Booking geojson updated");
  const source = hutsStyle.sources["wd-bookings"];
  source.data = bookingsGeojson.value;
  const mapSource = mapRef.map?.getSource("wd-bookings");
  if (mapSource) {
    if (bookingsGeojson.value !== void 0) {
      mapSource.setData(bookingsGeojson.value);
    }
  }
});
function opacityLevels({
  zoomOut = 0,
  zoomMain = 0.8,
  zoomIn = 0.3
}) {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    zoomOut,
    11,
    zoomMain * 0.8,
    15,
    zoomMain,
    18,
    zoomIn
  ];
}
const huts = {
  name: "huts",
  label: "Huts",
  //$t('transport.travel_time'),
  show: true,
  active: true,
  onLayer: "ways",
  icon: "huts",
  style: hutsStyle
};
const public_transport_stops = {
  name: "transport-stops",
  label: "Haltestellen",
  //$t('transport.station'),
  onLayer: "ways",
  show: true,
  active: false,
  icon: "transport",
  opacity: false,
  style: transportStyle
  //registerMapFn: transportStopsRegisterMap,
  //registerMapFn: hutsRegisterMap,
  //layerUpdateFn: hutsLayerUpdate,
};
const skitouren = getSwisstopoOverlay({
  name: "ch.swisstopo-karto.skitouren",
  label: "Skitouren",
  icon: "skitouren",
  opacity: opacityLevels({}),
  minZoom: 8
});
const snowshoes = getSwisstopoOverlay({
  name: "ch.swisstopo.schneeschuhwandern",
  label: "Schneeschuh",
  icon: "snowshoeing",
  opacity: opacityLevels({}),
  minZoom: 8
});
const hillslope = getSwisstopoOverlay({
  name: "ch.swisstopo.hangneigung-ueber_30",
  label: "Hangneigung",
  icon: "hillslopes",
  onLayer: "background",
  //opacity: ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.2, 20, 0.4],
  opacity: opacityLevels({ zoomOut: 0.1, zoomMain: 0.2, zoomIn: 0.4 }),
  minZoom: 10
});
const skislopes = {
  name: "slopes",
  label: "Skipisten",
  opacity: opacityLevels({ zoomMain: 0.6 }),
  icon: "skislopes",
  onLayer: "ways",
  show: true,
  style: getRasterStyle({
    name: "slopes",
    tiles: ["https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png"],
    minZoom: 8
  })
};
const hiking = getSwisstopoOverlay({
  name: "ch.swisstopo.swisstlm3d-wanderwege",
  label: "Wanderwege",
  icon: "hiking",
  opacity: opacityLevels({ zoomOut: 0.4, zoomMain: 0.9, zoomIn: 0.7 })
});
const cycling = {
  name: "cycling",
  label: "Fahrrad",
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: "cycling",
  onLayer: "ways",
  show: true,
  style: getRasterStyle({
    name: "cycling",
    tiles: ["https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png"],
    minZoom: 10
  })
};
const mtb = {
  name: "mtb",
  label: "Mountainbike",
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: "mtb",
  onLayer: "ways",
  show: true,
  style: getRasterStyle({
    name: "mtb",
    tiles: ["https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png"],
    minZoom: 10
  })
};
const useOverlayStore = defineStore("overlay", () => {
  function toggleOverlay(s) {
    s.active = s.active ? false : true;
    Plugin.set("overlays", overlays);
    return s.active;
  }
  const overlays = reactive([
    huts,
    public_transport_stops,
    hiking,
    mtb,
    cycling,
    hillslope,
    skitouren,
    snowshoes,
    skislopes
  ]);
  const savedOverlays = Plugin.hasItem(
    "overlays"
  ) ? Plugin.getItem("overlays") : [];
  const savedOverlaysRecord = savedOverlays.reduce(
    (acc, obj) => {
      acc[obj.name] = obj;
      return acc;
    },
    {}
  );
  for (const o of overlays) {
    const name = o.name;
    if (name in savedOverlaysRecord) {
      o.active = savedOverlaysRecord[name].active;
      o.show = savedOverlaysRecord[name].show;
    }
  }
  return {
    overlays,
    toggleOverlay
    //setBasemap,
    //getBasemap,
    //setEmitter,
  };
});
const __vite_glob_0_0 = "/assets/oe-raster-EIpPqIBW.png";
const __vite_glob_0_1 = "/assets/outdoor-v2-BR_lxvv7.png";
const __vite_glob_0_2 = "/assets/satellite-C2H1DPJ2.png";
const __vite_glob_0_3 = "/assets/select_map-BPM0HDk0.png";
const __vite_glob_0_4 = "/assets/swiss-raster-D1bEQQjo.png";
const __vite_glob_0_5 = "/assets/swiss-vector-BQsQYbTX.png";
const swissTopoRasterStyle = getRasterStyle({
  name: "ch-swisstopo-raster",
  tiles: [
    "https://wmts0.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts1.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts2.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts3.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts4.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts5.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts6.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts7.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts8.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    "https://wmts9.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
  ],
  attribution: '<a href="https://www.swisstopo.admin.ch/" target="_blank">&copy; swisstopo</a>',
  suffix: "",
  tileSize: Platform.is.mobile ? 128 : 256
});
const oeLayer = "bmaphidpi";
const oeExt = "jpeg";
const oeTopoRasterStyle = getRasterStyle({
  name: "oe-raster",
  tiles: [
    "https://maps1.wien.gv.at/basemap/" + oeLayer + "/normal/google3857/{z}/{y}/{x}." + oeExt,
    "https://maps2.wien.gv.at/basemap/" + oeLayer + "/normal/google3857/{z}/{y}/{x}." + oeExt,
    "https://maps3.wien.gv.at/basemap/" + oeLayer + "/normal/google3857/{z}/{y}/{x}." + oeExt
  ],
  attribution: "basemap.at",
  tileSize: 512
});
function getImageUrl(name) {
  return new URL((/* @__PURE__ */ Object.assign({ "/src/assets/wodore-design/map/switch/oe-raster.png": __vite_glob_0_0, "/src/assets/wodore-design/map/switch/outdoor-v2.png": __vite_glob_0_1, "/src/assets/wodore-design/map/switch/satellite.png": __vite_glob_0_2, "/src/assets/wodore-design/map/switch/select_map.png": __vite_glob_0_3, "/src/assets/wodore-design/map/switch/swiss-raster.png": __vite_glob_0_4, "/src/assets/wodore-design/map/switch/swiss-vector.png": __vite_glob_0_5 }))[`/src/assets/wodore-design/map/switch/${name}`], import.meta.url).href;
}
const useBasemapStore = defineStore("basemap", () => {
  const mapRef2 = ut();
  function getBasemap() {
    for (const basemapItem of basemaps) {
      if (basemapItem.active) {
        return basemapItem;
      }
    }
    return void 0;
  }
  function setBasemap(s, force = false) {
    const basemapStyle = getBasemap();
    if (basemapStyle !== void 0 && s.name == basemapStyle.name && !force) {
      console.debug("Active baselayer is already set.");
      return false;
    }
    mapRef2.map?.setStyle(s.style, {
      diff: true
      // TODO: transformStyle does not work properly
      // Keep all sources and layers with wd- prefix
      // transformStyle: (previousStyle, nextStyle) => {
      //   //console.debug('setStyle (prev, next)', previousStyle, nextStyle);
      //   const custom_layers =
      //     previousStyle !== undefined
      //       ? previousStyle.layers.filter((layer) => {
      //           return layer.id.startsWith('wd-');
      //         })
      //       : [];
      //   const layers = nextStyle.layers.concat(custom_layers);
      //   //console.debug('updated layers', custom_layers, layers);
      //   const sources = nextStyle.sources;
      //   if (previousStyle !== undefined) {
      //     for (const [key, value] of Object.entries(previousStyle.sources)) {
      //       if (key.startsWith('wd-')) {
      //         sources[key] = value;
      //       }
      //     }
      //   }
      //   //console.debug('updated sources', sources);
      //   const newStyle = {
      //     ...nextStyle,
      //     sources: sources,
      //     layers: layers,
      //   };
      //   console.debug('new style', newStyle);
      //   return newStyle;
      // },
    });
    for (const style of basemaps) {
      if (style.name == s.name) {
        style.active = true;
      } else {
        style.active = false;
      }
    }
    Plugin.set("basemapStyle", s);
    console.debug("Map layer is set to ", s.label);
    return true;
  }
  const basemaps = reactive([
    {
      name: "ch-swisstopo-raster",
      label: "Schweiz Topo Raster",
      show: true,
      active: true,
      img: getImageUrl("swiss-raster.png"),
      style: swissTopoRasterStyle,
      layers: {
        ways: { before: void 0 },
        background: { before: void 0 }
      }
    },
    {
      name: "CH swisstopo LBM Vivid",
      label: "Schweiz Topo Vector",
      show: true,
      img: getImageUrl("swiss-vector.png"),
      style: "https://api.maptiler.com/maps/ch-swisstopo-lbm-vivid/style.json?key=yYYuZy3hwmMjY087FDvY",
      layers: {
        ways: { before: "Other place labels" },
        background: { before: "Building line" }
      }
    },
    {
      name: "Satellite Hybrid",
      label: "Satellite",
      show: true,
      img: getImageUrl("satellite.png"),
      style: "https://api.maptiler.com/maps/hybrid/style.json?key=cQX2iET1gmOW38bedbUh",
      layers: {
        ways: { before: "Tunnel" },
        background: { before: "State labels" }
      }
    },
    {
      name: "outdoor-osm",
      label: "Outdoor OSM",
      show: false,
      img: getImageUrl("outdoor-v2.png"),
      style: "https://api.maptiler.com/maps/outdoor-v2/style.json?key=yYYuZy3hwmMjY087FDvY",
      layers: {
        background: { before: "Contour index" },
        ways: { before: "Park" }
      }
    },
    // Original does not work due to relativ paths
    // json from https://github.com/trafficon/basemap-at-maplibre/tree/main copied to public folder
    // original: https://www.data.gv.at/katalog/dataset/a73befc7-575f-48cb-8eb9-b05172a8c9e3#additional-info
    // TODO: somehow the huts are not shown anymore, try to update json files
    {
      name: "oe-vector",
      label: "Östereich Topo Vector",
      active: true,
      show: false,
      img: getImageUrl("swiss-vector.png"),
      style: "styles/basemapv-bmapv-3857-resources-styles-root.json",
      layers: {
        ways: { before: void 0 },
        background: { before: void 0 }
      }
    },
    {
      name: "oe-raster",
      label: "Östereich Topo Raster",
      show: false,
      img: getImageUrl("oe-raster.png"),
      style: oeTopoRasterStyle,
      layers: {
        ways: { before: void 0 },
        background: { before: void 0 }
      }
    }
  ]);
  const savedBasemap = Plugin.hasItem("basemapStyle") ? Plugin.getItem("basemapStyle") : basemaps[0];
  setBasemap(savedBasemap);
  return {
    basemaps,
    setBasemap,
    getBasemap
    //setEmitter,
  };
});
const _hoisted_1$3 = { class: "overlay-scroll" };
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "WdOverlaySwitch",
  props: {
    position: { default: "top-left" },
    direction: { default: "right" },
    offset: { default: void 0 }
  },
  setup(__props) {
    const overlayStore = useOverlayStore();
    const basemapStore = useBasemapStore();
    const mapRef2 = ut();
    const $q = useQuasar();
    const switcherOpen = ref(
      Plugin.hasItem("switcherOpen") ? Plugin.getItem("switcherOpen") : false
    );
    watch(switcherOpen, (v) => {
      Plugin.set("switcherOpen", v);
    });
    function toggleOverlay(s) {
      console.debug("toogle", s);
      overlayStore.toggleOverlay(s);
      setOverlayVisibility(s);
      return true;
    }
    function setOverlayVisibility(overlay) {
      if (mapRef2.map === void 0) {
        return false;
      }
      for (const layer of overlay.style.layers) {
        const currentLayer = mapRef2.map.getLayer(layer.id);
        if (currentLayer) {
          if (!layer.layout) {
            layer["layout"] = { visibility: "none" };
          }
          if (layer.layout) {
            if (overlay.active) {
              layer.layout.visibility = "visible";
            } else {
              layer.layout.visibility = "none";
            }
            mapRef2.map.setLayoutProperty(
              layer.id,
              "visibility",
              layer.layout?.visibility
            );
          }
        }
      }
      return true;
    }
    function addOverlayLayer({
      layer,
      onLayer = void 0,
      defaultOpacity = void 0
    }) {
      const basemap = basemapStore.getBasemap();
      const basemapOpacity = onLayer !== void 0 ? basemap?.layers[onLayer]?.opacity : void 0;
      let autoOpacity = false;
      if (defaultOpacity === void 0 || defaultOpacity == true) {
        autoOpacity = true;
        defaultOpacity = [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          0.9,
          14,
          0.6,
          22,
          0.5
        ];
      }
      if (mapRef2.map?.getLayer(layer.id) === void 0) {
        let opacity = defaultOpacity != false ? defaultOpacity : void 0;
        let _beforeId = void 0;
        if (onLayer) {
          _beforeId = basemap?.layers[onLayer]?.before;
        }
        if (basemapOpacity !== void 0) {
          opacity = basemapOpacity;
        }
        const _source = "source" in layer ? layer.source : void 0;
        if (_source && mapRef2.map?.getSource(_source) || _source === void 0) {
          console.debug(`Add layer '${layer.id}' (before layer '${_beforeId}')`);
          mapRef2.map?.addLayer(layer, _beforeId);
          if (layer.paint !== void 0 && `${layer.type}-opacity` in layer.paint) {
            defaultOpacity = false;
          }
          if (defaultOpacity == false) {
            opacity = void 0;
          } else if (autoOpacity == false) {
            opacity = defaultOpacity;
          }
          if (opacity !== void 0) {
            console.debug(
              `  Set paint '${layer.type}-opacity' property for layer '${layer.id}' to ${opacity}`
            );
            mapRef2.map?.setPaintProperty(
              layer.id,
              `${layer.type}-opacity`,
              opacity
            );
          }
        } else {
          console.error(
            `Source '${_source}' not added, tried to add layer '${layer.id}'.`
          );
        }
      }
    }
    function addOverlays() {
      const backOverlays = overlayStore.overlays.slice().filter(
        (v) => v.onLayer == "background"
      );
      const frontOverlays = overlayStore.overlays.slice().filter((v) => v.onLayer == "ways");
      const overlaysRevert = frontOverlays.concat(backOverlays).reverse();
      for (const overlay of overlaysRevert) {
        for (const label in overlay.style.sources) {
          if (mapRef2.map?.getSource(label) === void 0) {
            const sourceSpec = overlay.style.sources[label];
            console.debug(`Add ${sourceSpec.type} source '${label}'`);
            mapRef2.map?.addSource(label, sourceSpec);
          }
        }
        setOverlayVisibility(overlay);
        for (const layer of overlay.style.layers) {
          addOverlayLayer({
            layer,
            defaultOpacity: overlay.opacity,
            onLayer: overlay.onLayer
          });
        }
      }
    }
    mapRef2.map?.on("styledata", addOverlays);
    mapRef2.map?.on("load", addOverlays);
    const switchIcon = "img:" + new URL("data:image/svg+xml,%3csvg%20clip-rule='evenodd'%20fill-rule='evenodd'%20height='512'%20stroke-linejoin='round'%20stroke-miterlimit='2'%20viewBox='0%200%2048%2048'%20width='512'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20transform='translate(0%20-576)'%3e%3cg%20id='FLAT-LINE'%20transform='scale(1.5)'%3e%3cg%20transform='matrix(.754%200%200%20.754%20-2.053%20-49.493)'%3e%3cpath%20d='m12.683%20600h22.508l6.719%203.073c.359.164.59.527.59.927s-.231.763-.59.927c-4.418%202.021-14.734%206.739-17.358%207.939-.391.179-.839.179-1.231%200-2.623-1.2-12.939-5.918-17.358-7.939-.359-.164-.589-.527-.589-.927s.23-.763.589-.927z'%20fill='%23f9a824'/%3e%3c/g%3e%3cg%20transform='matrix(.754%200%200%20.754%20-2.053%20-49.493)'%3e%3cpath%20d='m35.191%20592%206.719%203.073c.359.164.59.527.59.927s-.231.763-.59.927c-4.418%202.021-14.734%206.739-17.358%207.939-.391.179-.839.179-1.231%200-2.623-1.2-12.939-5.918-17.358-7.939-.359-.164-.589-.527-.589-.927s.23-.763.589-.927l6.72-3.073z'%20fill='%23f44336'/%3e%3c/g%3e%3cg%20transform='matrix(.827%200%200%20.986%20-4.456%20-193.901)'%3e%3cpath%20d='m24.188%20589.715c.358-.137.766-.137%201.124%200%202.394.919%2011.807%204.529%2015.839%206.076.327.125.538.403.538.709s-.211.584-.538.709c-4.032%201.547-13.445%205.157-15.839%206.076-.358.137-.766.137-1.124%200-2.394-.919-11.807-4.529-15.839-6.076-.327-.125-.538-.403-.538-.709s.211-.584.538-.709c4.032-1.547%2013.445-5.157%2015.839-6.076z'%20fill='%238bc349'/%3e%3c/g%3e%3cg%20transform='matrix(.667%200%200%20.667%20-4.123%20388)'%3e%3ccircle%20cx='14'%20cy='30'%20r='1'/%3e%3c/g%3e%3cg%20transform='scale(.667)'%3e%3cpath%20d='m8.864%20595.475-5.613%202.567c-.759.347-1.251%201.112-1.251%201.958s.492%201.611%201.251%201.958l5.613%202.567-5.613%202.567c-.759.347-1.251%201.112-1.251%201.958s.492%201.611%201.251%201.958l1.333.61c.502.229%201.096.008%201.325-.494.23-.502.009-1.095-.493-1.325l-1.333-.61c-.053-.024-.083-.08-.083-.139s.03-.115.083-.139l7.185-3.286%2011.62%205.314c.707.323%201.517.323%202.224%200%201.452-.664%203.687-1.686%207.504-3.432.502-.23.723-.824.494-1.325-.23-.502-.824-.723-1.325-.494-3.818%201.746-6.053%202.768-7.505%203.432-.178.082-.382.082-.56%200%200%200-19.637-8.981-19.637-8.981-.053-.024-.083-.08-.083-.139s.03-.115.083-.139l7.185-3.286%2011.62%205.314c.707.323%201.517.323%202.224%200l11.62-5.314%207.185%203.286c.053.024.083.08.083.139s-.03.115-.083.139c0%200-9.333%204.269-9.333%204.269-.502.229-.723.823-.493%201.325.229.502.823.723%201.325.493l1.316-.601%207.185%203.286c.053.024.083.08.083.139s-.03.115-.083.139c0%200-19.637%208.981-19.637%208.981-.178.082-.382.082-.56%200-2.209-1.01-12.804-5.856-12.804-5.856-.502-.229-1.096-.008-1.325.494-.23.502-.009%201.096.493%201.325%200%200%2010.595%204.846%2012.804%205.856.707.324%201.517.324%202.224%200%202.968-1.357%2014.638-6.695%2019.637-8.981.759-.347%201.251-1.112%201.251-1.958s-.492-1.611-1.251-1.958l-5.613-2.567%205.613-2.567c.759-.347%201.251-1.112%201.251-1.958s-.492-1.611-1.251-1.958l-5.613-2.567%205.613-2.567c.759-.347%201.251-1.112%201.251-1.958s-.492-1.611-1.251-1.958l-19.637-8.981c-.707-.324-1.517-.324-2.224%200-.333.152-1.304.596-1.304.596-.502.23-.723.824-.493%201.325.229.502.823.723%201.325.494%200%200%20.971-.444%201.304-.596.178-.082.382-.082.56%200%200%200%2019.637%208.981%2019.637%208.981.053.024.083.08.083.139s-.03.115-.083.139c0%200-19.637%208.981-19.637%208.981-.178.082-.382.082-.56%200%200%200-19.637-8.981-19.637-8.981-.053-.024-.083-.08-.083-.139s.03-.115.083-.139c0%200%2015.563-7.118%2015.563-7.118.502-.23.723-.824.494-1.326-.23-.502-.823-.723-1.325-.493-4.21%201.925-12.303%205.627-15.564%207.118-.759.347-1.251%201.112-1.251%201.958s.492%201.611%201.251%201.958z'/%3e%3c/g%3e%3c/g%3e%3c/g%3e%3c/svg%3e", import.meta.url).href;
    function overlayIcon(name) {
      return "img:" + new URL((/* @__PURE__ */ Object.assign({ "/src/assets/wodore-design/overlays/exports/cycling.svg": __vite_glob_0_0$1, "/src/assets/wodore-design/overlays/exports/hiking.svg": __vite_glob_0_1$1, "/src/assets/wodore-design/overlays/exports/hillslopes.svg": __vite_glob_0_2$1, "/src/assets/wodore-design/overlays/exports/huts.svg": __vite_glob_0_3$1, "/src/assets/wodore-design/overlays/exports/mtb.svg": __vite_glob_0_4$1, "/src/assets/wodore-design/overlays/exports/skislopes.svg": __vite_glob_0_5$1, "/src/assets/wodore-design/overlays/exports/skitouren.svg": __vite_glob_0_6, "/src/assets/wodore-design/overlays/exports/snowshoeing.svg": __vite_glob_0_7, "/src/assets/wodore-design/overlays/exports/transport.svg": __vite_glob_0_8 }))[`/src/assets/wodore-design/overlays/exports/${name}.svg`], import.meta.url).href;
    }
    return (_ctx, _cache) => {
      const _component_WdOverlaySwitchItem = __unplugin_components_0$2;
      return openBlock(), createBlock(QPageSticky, {
        position: _ctx.position,
        offset: _ctx.offset,
        style: { "z-index": "5" }
      }, {
        default: withCtx(() => [
          createVNode(QFab, {
            ref: "fabStyleRef",
            push: "",
            "vertical-actions-align": "center",
            icon: switchIcon,
            padding: "sm",
            direction: _ctx.direction,
            persistent: "",
            color: switcherOpen.value ? "negative-400" : "icon",
            modelValue: switcherOpen.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => switcherOpen.value = $event)
          }, {
            default: withCtx(() => [
              createBaseVNode("div", _hoisted_1$3, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(unref(overlayStore).overlays, (item, index) => {
                  return withDirectives((openBlock(), createBlock(_component_WdOverlaySwitchItem, {
                    tabindex: index,
                    onClick: ($event) => toggleOverlay(item),
                    key: item.name,
                    label: item.label,
                    icon: overlayIcon(item.icon),
                    active: item.active,
                    tooltip: unref($q).platform.is.desktop
                  }, null, 8, ["tabindex", "onClick", "label", "icon", "active", "tooltip"])), [
                    [vShow, item.show]
                  ]);
                }), 128))
              ])
            ]),
            _: 1
          }, 8, ["direction", "color", "modelValue"])
        ]),
        _: 1
      }, 8, ["position", "offset"]);
    };
  }
});
const __unplugin_components_1$1 = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__file", "WdOverlaySwitch.vue"]]);
const _hoisted_1$2 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2$1 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M17 8h-7V6a2 2 0 0 1 4 0a1 1 0 0 0 2 0a4 4 0 0 0-8 0v2H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3m1 11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1Z"
}, null, -1);
const _hoisted_3$1 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M12 12a3 3 0 1 0 3 3a3 3 0 0 0-3-3m0 4a1 1 0 1 1 1-1a1 1 0 0 1-1 1"
}, null, -1);
const _hoisted_4$1 = [
  _hoisted_2$1,
  _hoisted_3$1
];
function render$1(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$2, [..._hoisted_4$1]);
}
const __unplugin_components_2 = { name: "eva-unlock-outline", render: render$1 };
const _hoisted_1$1 = {
  viewBox: "0 0 24 24",
  width: "1.2em",
  height: "1.2em"
};
const _hoisted_2 = /* @__PURE__ */ createBaseVNode("circle", {
  cx: "12",
  cy: "15",
  r: "1",
  fill: "currentColor"
}, null, -1);
const _hoisted_3 = /* @__PURE__ */ createBaseVNode("path", {
  fill: "currentColor",
  d: "M17 8h-1V6.11a4 4 0 1 0-8 0V8H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3m-7-1.89A2.06 2.06 0 0 1 12 4a2.06 2.06 0 0 1 2 2.11V8h-4ZM12 18a3 3 0 1 1 3-3a3 3 0 0 1-3 3"
}, null, -1);
const _hoisted_4 = [
  _hoisted_2,
  _hoisted_3
];
function render(_ctx, _cache) {
  return openBlock(), createElementBlock("svg", _hoisted_1$1, [..._hoisted_4]);
}
const __unplugin_components_1 = { name: "eva-lock-fill", render };
const _hoisted_1 = ["src"];
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "WdBasemapSwitchItem",
  props: {
    label: {},
    img: {},
    active: { type: Boolean },
    tooltip: { type: Boolean }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QBtn, {
        round: "",
        style: { "padding": "0" },
        ripple: false,
        color: _ctx.active ? "accent-500" : "primary-400"
      }, {
        default: withCtx(() => [
          createVNode(QAvatar, { size: "55px" }, {
            default: withCtx(() => [
              createBaseVNode("img", {
                style: { "padding": "3px" },
                src: _ctx.img
              }, null, 8, _hoisted_1)
            ]),
            _: 1
          }),
          _ctx.tooltip ? (openBlock(), createBlock(QTooltip, { key: 0 }, {
            default: withCtx(() => [
              createTextVNode(toDisplayString(_ctx.label), 1)
            ]),
            _: 1
          })) : createCommentVNode("", true)
        ]),
        _: 1
      }, 8, ["color"]);
    };
  }
});
const __unplugin_components_0$1 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__file", "WdBasemapSwitchItem.vue"]]);
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "WdBasemapSwitch",
  props: {
    position: { default: "top-left" },
    direction: { default: "right" },
    offset: { default: void 0 }
  },
  setup(__props) {
    const basemapStore = useBasemapStore();
    const $q = useQuasar();
    const switcherOpen = ref(false);
    const switcherLocked = ref(false);
    function setBasemap(s) {
      const switched = basemapStore.setBasemap(s);
      if (!switcherLocked.value && switched) {
        switcherOpen.value = false;
        return true;
      }
      return switched;
    }
    function toggleSwitcherLocked() {
      switcherLocked.value = !switcherLocked.value;
    }
    const switchIcon = "img:" + new URL("/assets/basemap-switch-Dvj_H7Y5.svg", import.meta.url).href;
    return (_ctx, _cache) => {
      const _component_WdBasemapSwitchItem = __unplugin_components_0$1;
      const _component_IconEvaLockFill = __unplugin_components_1;
      const _component_IconEvaUnlockOutline = __unplugin_components_2;
      return openBlock(), createBlock(QPageSticky, {
        position: _ctx.position,
        offset: _ctx.offset,
        style: { "z-index": "5" }
      }, {
        default: withCtx(() => [
          createVNode(QFab, {
            ref: "fabStyleRef",
            push: "",
            "vertical-actions-align": "left",
            icon: switchIcon,
            padding: "sm",
            direction: _ctx.direction,
            persistent: "",
            color: switcherOpen.value ? "negative-400" : "icon",
            modelValue: switcherOpen.value,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => switcherOpen.value = $event)
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(basemapStore).basemaps, (style, index) => {
                return withDirectives((openBlock(), createBlock(_component_WdBasemapSwitchItem, {
                  tabindex: index,
                  onClick: ($event) => setBasemap(style),
                  key: style.name,
                  label: style.label,
                  img: style.img,
                  active: style.active,
                  tooltip: unref($q).platform.is.desktop
                }, null, 8, ["tabindex", "onClick", "label", "img", "active", "tooltip"])), [
                  [vShow, style.show]
                ]);
              }), 128)),
              unref($q).screen.gt.xs ? (openBlock(), createBlock(QBtn, {
                key: 0,
                round: "",
                flat: "",
                style: { "padding": "0" },
                ripple: false,
                color: switcherLocked.value ? "accent-500" : "secondary-800",
                onClick: toggleSwitcherLocked
              }, {
                default: withCtx(() => [
                  createVNode(QIcon, null, {
                    default: withCtx(() => [
                      switcherLocked.value ? (openBlock(), createBlock(_component_IconEvaLockFill, { key: 0 })) : createCommentVNode("", true),
                      !switcherLocked.value ? (openBlock(), createBlock(_component_IconEvaUnlockOutline, { key: 1 })) : createCommentVNode("", true)
                    ]),
                    _: 1
                  })
                ]),
                _: 1
              }, 8, ["color"])) : createCommentVNode("", true)
            ]),
            _: 1
          }, 8, ["direction", "color", "modelValue"])
        ]),
        _: 1
      }, 8, ["position", "offset"]);
    };
  }
});
const __unplugin_components_0 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__file", "WdBasemapSwitch.vue"]]);
const minHutClickZoom = 8;
const mapZoom = 7.5;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "WdMapView",
  setup(__props) {
    useCssVars((_ctx) => ({
      "15ce7e40": top.value,
      "b804ff08": left.value,
      "ebbb9d40": bottom.value,
      "47ee1f72": right.value
    }));
    const $q = useQuasar();
    const router = useRouter();
    const route = useRoute();
    const basemapStore = useBasemapStore();
    const $layout = inject("_q_l_");
    const top = ref("0");
    const right = ref("0");
    const bottom = ref("0");
    const left = ref("0");
    if ($layout === void 0) {
      console.error("MapView needs to be child of QLayout");
    } else {
      watchEffect(() => {
        top.value = `${$layout.header.offset}px`;
        right.value = `${$layout.right.offset}px`;
        if ($layout.footer.offset < window.innerHeight - 250) {
          bottom.value = `${$layout.footer.offset}px`;
        }
        left.value = `${$layout.left.offset}px`;
        console.debug(
          "Layout offsets changed: (top, right, bottom, left): ",
          top.value,
          right.value,
          bottom.value,
          left.value
        );
      });
    }
    function onMapLoad(e) {
      console.debug(`Maplibre version ${e.map.version} loaded`);
      e.map.scrollZoom.setWheelZoomRate(3e-3);
      onMapStyledata(e);
      e.map.on("mouseenter", "wd-huts", onLayerEnter);
      e.map.on("mouseleave", "wd-huts", onLayerLeave);
      e.map.on("click", "wd-huts", onHutLayerClick);
    }
    const selectedHutFeature = ref(void 0);
    function onHutLayerClick(e) {
      console.debug("Hut layer clicked.");
      if (e.target.getZoom() > minHutClickZoom) {
        let feature = e.features?.[0];
        console.debug(
          "  Selected huts:",
          e.features?.map((v) => v.properties.slug)
        );
        if (feature) {
          if (selectedHutFeature.value !== void 0) {
            e.target.setFeatureState(
              { source: "wd-huts", id: selectedHutFeature.value.id },
              { selected: false }
            );
          }
          if (selectedHutFeature.value?.id != feature.id) {
            e.target.setFeatureState(
              { source: "wd-huts", id: feature.id },
              { selected: true }
            );
            selectedHutFeature.value = feature;
          } else {
            selectedHutFeature.value = void 0;
          }
          const slug = feature.properties.slug;
          if (route.params.slug == slug) {
            router.push({ name: "map", hash: route.hash, query: route.query });
          } else {
            router.push({
              name: "map-hut",
              params: { slug },
              hash: route.hash,
              query: route.query
            });
          }
        }
      }
    }
    function onLayerEnter(e) {
      if (e.target.getZoom() > minHutClickZoom) {
        e.target.getCanvas().style.cursor = "pointer";
      }
    }
    function onLayerLeave(e) {
      if (e.target.getZoom() > minHutClickZoom) {
        e.target.getCanvas().style.cursor = "";
      }
    }
    const SPRITE_BASE_URL = "https://api.wodore.com";
    const _spriteUrl = SPRITE_BASE_URL + "/static/huts/sprite";
    function onMapStyledata(e) {
      console.debug("Style data changed event", e);
      const _wodoreSprite = e.map.getSprite();
      let _spriteAdded = false;
      for (const sprite of _wodoreSprite) {
        if (sprite.id == "wodore") {
          _spriteAdded = true;
        }
      }
      if (!_spriteAdded) {
        console.debug(`Add sprite 'wodore' from '${_spriteUrl}'`);
        e.map.addSprite("wodore", _spriteUrl);
      }
    }
    const mapCenter = [8.22, 46.7];
    return (_ctx, _cache) => {
      const _component_WdBasemapSwitch = __unplugin_components_0;
      const _component_WdOverlaySwitch = __unplugin_components_1$1;
      return openBlock(), createBlock(unref(he), {
        "onMap:load": onMapLoad,
        "onMap:styledata": onMapStyledata,
        hash: "p",
        "map-style": unref(basemapStore).getBasemap()?.style,
        zoom: mapZoom,
        "bearing-snap": 15,
        center: mapCenter,
        "attribution-control": false,
        "min-zoom": 7,
        "max-zoom": 20,
        "max-bounds": [3.6, 43, 18.7, 49.7]
      }, {
        default: withCtx(() => [
          createVNode(_component_WdBasemapSwitch, {
            position: unref($q).platform.is.mobile ? "bottom-right" : "top-left",
            direction: unref($q).platform.is.mobile ? "left" : "right",
            offset: [
              unref($q).platform.is.mobile ? 14 : 14,
              unref($q).platform.is.mobile ? 20 : 14
            ]
          }, null, 8, ["position", "direction", "offset"]),
          createVNode(_component_WdOverlaySwitch, {
            position: "top-left",
            direction: "down",
            offset: [
              unref($q).platform.is.mobile ? 14 : 14,
              unref($q).platform.is.mobile ? 14 : 68
            ]
          }, null, 8, ["offset"]),
          createVNode(unref(Ce)),
          createVNode(unref(Ie), { "show-zoom": false }),
          createVNode(unref(Me), {
            position: unref($q).platform.is.mobile ? "bottom-left" : "bottom-right"
          }, null, 8, ["position"]),
          createVNode(unref(Ae))
        ]),
        _: 1
      }, 8, ["map-style"]);
    };
  }
});
const WdMapView = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "WdMapView.vue"]]);
export {
  WdMapView as default
};
