import { g as getImageUrl, b as QImg, Q as QScrollArea, a as QSpace } from "./imageService-CRS5yRFk.js";
import { h as createComponent, l as getCurrentInstance, s as ref, aT as provide, aW as onDeactivated, aX as onActivated, z as onMounted, D as h, F as hSlot, aY as vmIsDestroyed, am as stopAndPrevent, A as nextTick, aP as addFocusFn, aZ as formKey, d as defineComponent, u as useRouter, ar as reactive, o as openBlock, c as createBlock, L as withCtx, a7 as normalizeClass, O as unref, a_ as QCard, e as createVNode, f as createBaseVNode, a$ as QCardSection, g as createTextVNode, a6 as QInput, Q as QIcon, a as createElementBlock, aq as renderList, R as Fragment, M as QBtn, P as createCommentVNode, b0 as QSeparator, b1 as QCardActions, b2 as pushScopeId, b3 as popScopeId, _ as _export_sfc } from "./index-CAHSu7Ql.js";
import { u as useQuasar } from "./use-quasar-dzbiZ5mn.js";
import { c as clientWodore } from "./index-BAtqSMr7.js";
import "./QScrollObserver-9xiBCqI1.js";
import "./use-hydration-DGAnypCl.js";
import "./_commonjsHelpers-Dm6U3U_N.js";
const QForm = createComponent({
  name: "QForm",
  props: {
    autofocus: Boolean,
    noErrorFocus: Boolean,
    noResetFocus: Boolean,
    greedy: Boolean,
    onSubmit: Function
  },
  emits: ["reset", "validationSuccess", "validationError"],
  setup(props, { slots, emit }) {
    const vm = getCurrentInstance();
    const rootRef = ref(null);
    let validateIndex = 0;
    const registeredComponents = [];
    function validate(shouldFocus) {
      const focus2 = typeof shouldFocus === "boolean" ? shouldFocus : props.noErrorFocus !== true;
      const index = ++validateIndex;
      const emitEvent = (res, ref2) => {
        emit(`validation${res === true ? "Success" : "Error"}`, ref2);
      };
      const validateComponent = (comp) => {
        const valid = comp.validate();
        return typeof valid.then === "function" ? valid.then(
          (valid2) => ({ valid: valid2, comp }),
          (err) => ({ valid: false, comp, err })
        ) : Promise.resolve({ valid, comp });
      };
      const errorsPromise = props.greedy === true ? Promise.all(registeredComponents.map(validateComponent)).then((res) => res.filter((r) => r.valid !== true)) : registeredComponents.reduce(
        (acc, comp) => acc.then(() => {
          return validateComponent(comp).then((r) => {
            if (r.valid === false) {
              return Promise.reject(r);
            }
          });
        }),
        Promise.resolve()
      ).catch((error) => [error]);
      return errorsPromise.then((errors) => {
        if (errors === void 0 || errors.length === 0) {
          index === validateIndex && emitEvent(true);
          return true;
        }
        if (index === validateIndex) {
          const { comp, err } = errors[0];
          err !== void 0 && console.error(err);
          emitEvent(false, comp);
          if (focus2 === true) {
            const activeError = errors.find(({ comp: comp2 }) => typeof comp2.focus === "function" && vmIsDestroyed(comp2.$) === false);
            if (activeError !== void 0) {
              activeError.comp.focus();
            }
          }
        }
        return false;
      });
    }
    function resetValidation() {
      validateIndex++;
      registeredComponents.forEach((comp) => {
        typeof comp.resetValidation === "function" && comp.resetValidation();
      });
    }
    function submit(evt) {
      evt !== void 0 && stopAndPrevent(evt);
      const index = validateIndex + 1;
      validate().then((val) => {
        if (index === validateIndex && val === true) {
          if (props.onSubmit !== void 0) {
            emit("submit", evt);
          } else if (evt !== void 0 && evt.target !== void 0 && typeof evt.target.submit === "function") {
            evt.target.submit();
          }
        }
      });
    }
    function reset(evt) {
      evt !== void 0 && stopAndPrevent(evt);
      emit("reset");
      nextTick(() => {
        resetValidation();
        if (props.autofocus === true && props.noResetFocus !== true) {
          focus();
        }
      });
    }
    function focus() {
      addFocusFn(() => {
        if (rootRef.value === null)
          return;
        const target = rootRef.value.querySelector("[autofocus][tabindex], [data-autofocus][tabindex]") || rootRef.value.querySelector("[autofocus] [tabindex], [data-autofocus] [tabindex]") || rootRef.value.querySelector("[autofocus], [data-autofocus]") || Array.prototype.find.call(rootRef.value.querySelectorAll("[tabindex]"), (el) => el.tabIndex !== -1);
        target !== null && target !== void 0 && target.focus({ preventScroll: true });
      });
    }
    provide(formKey, {
      bindComponent(vmProxy) {
        registeredComponents.push(vmProxy);
      },
      unbindComponent(vmProxy) {
        const index = registeredComponents.indexOf(vmProxy);
        if (index !== -1) {
          registeredComponents.splice(index, 1);
        }
      }
    });
    let shouldActivate = false;
    onDeactivated(() => {
      shouldActivate = true;
    });
    onActivated(() => {
      shouldActivate === true && props.autofocus === true && focus();
    });
    onMounted(() => {
      props.autofocus === true && focus();
    });
    Object.assign(vm.proxy, {
      validate,
      resetValidation,
      submit,
      reset,
      focus,
      getValidationComponents: () => registeredComponents
    });
    return () => h("form", {
      class: "q-form",
      ref: rootRef,
      onSubmit: submit,
      onReset: reset
    }, hSlot(slots.default));
  }
});
const _withScopeId = (n) => (pushScopeId("data-v-69cabe63"), n = n(), popScopeId(), n);
const _hoisted_1 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "card-header absolute-bottom text-white text-h5" }, null, -1));
const _hoisted_2 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("div", { class: "absolute-bottom text-accent-400 text-h4 text-center card-header__text" }, " Rückmeldung ", -1));
const _hoisted_3 = { class: "col no-wrap items-center q-py-md" };
const _hoisted_4 = /* @__PURE__ */ _withScopeId(() => /* @__PURE__ */ createBaseVNode("p", { class: "text-body1 q-pt-md" }, " Sag uns, was du denkst! Jede Rückmeldung, egal ob positiv oder negativ, hilft uns weiter. ", -1));
const _hoisted_5 = { class: "q-gutter-md q-pt-md" };
const imgPath = "https://cdn.pixabay.com/photo/2014/05/11/11/12/mailbox-341744_1280.jpg";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "WdFeedbackForm",
  setup(__props) {
    const $q = useQuasar();
    const router = useRouter();
    const message = reactive({
      email: "",
      subject: "",
      message: "",
      urls: []
    });
    const urls = ref([]);
    function onSubmit() {
      console.debug(`Submitted form for '${message.email}'`, message.message);
      message.urls = urls.value.map((url) => url.value);
      clientWodore.POST("/v1/feedback/", {
        body: message
      }).then(() => {
        $q.notify({
          color: "positive",
          textColor: "black",
          icon: "wd-checkmark",
          message: "Nachricht gesendet"
        });
        router.go(-1);
        setTimeout(() => {
          onReset();
        }, 200);
      }).catch(() => {
        $q.notify({
          color: "negative",
          textColor: "black",
          icon: "wd-close",
          message: "Nachricht konnte nicht gesendet werden"
        });
      });
    }
    function onClose() {
      if (message.email || message.message) {
        $q.dialog({
          dark: true,
          title: "Confirm",
          message: "Do you want to close it and dismiss the data?",
          cancel: true,
          persistent: true
        }).onOk(() => {
          router.go(-1);
        });
      } else {
        router.go(-1);
      }
    }
    function onReset() {
      message.email = "";
      message.message = "";
    }
    function addUrl() {
      const len = urls.value.length;
      const id = len > 0 ? urls.value[len - 1].id + 1 : 0;
      console.log(urls.value);
      console.log(id);
      urls.value.push({
        value: "",
        id,
        placeholder: `URL ${id + 1}`
      });
    }
    function removeUrl(idx) {
      urls.value.splice(idx, 1);
    }
    function toSupport() {
      router.replace({ name: "support" });
    }
    const headerImg = getImageUrl(imgPath, {
      focal: "0.5,0.45",
      size: "800x300",
      quality: 50
      //filters: ['grayscale()'],
    });
    console.log(headerImg);
    return (_ctx, _cache) => {
      return openBlock(), createBlock(QCard, {
        class: normalizeClass({ "card--desktop": unref($q).screen.gt.xs, "card--mobile": unref($q).screen.xs })
      }, {
        default: withCtx(() => [
          createVNode(QForm, {
            onSubmit,
            onReset,
            class: "fit"
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
                        _hoisted_4,
                        createBaseVNode("p", { class: "text-body2" }, [
                          createTextVNode(" Jegliche "),
                          createBaseVNode("a", {
                            class: "link",
                            onClick: toSupport
                          }, "Unterstützung"),
                          createTextVNode(" für das Projekt ist willkommen. ")
                        ]),
                        createBaseVNode("div", _hoisted_5, [
                          createVNode(QInput, {
                            modelValue: message.subject,
                            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => message.subject = $event),
                            dense: "",
                            "aria-label": "Betreff",
                            outlined: "",
                            counter: "",
                            placeholder: "Betreff",
                            maxlength: "60"
                          }, {
                            prepend: withCtx(() => [
                              createVNode(QIcon, { name: "wd-subject" })
                            ]),
                            _: 1
                          }, 8, ["modelValue"]),
                          createVNode(QInput, {
                            dense: "",
                            modelValue: message.email,
                            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => message.email = $event),
                            outlined: "",
                            "aria-label": "E-Mail",
                            placeholder: "name@domain.com",
                            type: "email",
                            maxlength: "100",
                            rules: [(val) => !!val || "E-Mail fehlt"]
                          }, {
                            prepend: withCtx(() => [
                              createVNode(QIcon, { name: "wd-at" })
                            ]),
                            _: 1
                          }, 8, ["modelValue", "rules"]),
                          createVNode(QInput, {
                            modelValue: message.message,
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => message.message = $event),
                            autogrow: "",
                            counter: "",
                            "aria-label": "Nachricht",
                            placeholder: "Nachricht",
                            dense: "",
                            outlined: "",
                            type: "textarea",
                            maxlength: "10000",
                            rules: [(val) => !!val || "Nachricht fehlt"]
                          }, {
                            prepend: withCtx(() => [
                              createVNode(QIcon, { name: "wd-text-outline" })
                            ]),
                            _: 1
                          }, 8, ["modelValue", "rules"]),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(urls.value, (url, idx) => {
                            return openBlock(), createBlock(QInput, {
                              key: url.id,
                              modelValue: url.value,
                              "onUpdate:modelValue": ($event) => url.value = $event,
                              dense: "",
                              outlined: "",
                              maxlength: "300",
                              placeholder: url.placeholder,
                              rules: [(val) => !!val || "URL fehlt"]
                            }, {
                              prepend: withCtx(() => [
                                createVNode(QIcon, { name: "wd-link" })
                              ]),
                              append: withCtx(() => [
                                createVNode(QIcon, {
                                  name: "wd-close",
                                  onClick: ($event) => removeUrl(idx),
                                  class: "cursor-pointer"
                                }, null, 8, ["onClick"])
                              ]),
                              _: 2
                            }, 1032, ["modelValue", "onUpdate:modelValue", "placeholder", "rules"]);
                          }), 128)),
                          urls.value.length < 4 ? (openBlock(), createBlock(QBtn, {
                            key: 0,
                            onClick: _cache[3] || (_cache[3] = ($event) => addUrl()),
                            class: "text-grey-8",
                            label: "URL",
                            flat: "",
                            icon: "wd-add-outline"
                          })) : createCommentVNode("", true)
                        ])
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
                  createVNode(QBtn, {
                    label: "Schliessen",
                    color: "secondary-700",
                    flat: "",
                    onClick: _cache[4] || (_cache[4] = ($event) => onClose()),
                    class: "q-ml-sm"
                  }),
                  createVNode(QBtn, {
                    label: "Zurücksetzen",
                    type: "reset",
                    color: "secondary-700",
                    flat: "",
                    class: "q-ml-sm"
                  }),
                  createVNode(QSpace),
                  createVNode(QBtn, {
                    label: "Senden",
                    flat: "",
                    type: "submit",
                    color: "accent"
                  })
                ]),
                _: 1
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
const WdFeedbackForm = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-69cabe63"], ["__file", "WdFeedbackForm.vue"]]);
export {
  WdFeedbackForm as default
};
