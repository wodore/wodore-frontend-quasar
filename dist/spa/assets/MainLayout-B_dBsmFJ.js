import {
  k as j,
  g as I,
  r as q,
  c as h,
  o as ee,
  l as D,
  h as L,
  m as fe,
  n as ht,
  p as Qe,
  q as de,
  t as oe,
  i as Fe,
  u as N,
  w as T,
  v as Pt,
  x as Se,
  P as Wt,
  y as Vt,
  z as te,
  A as Ot,
  B as K,
  C as Be,
  D as we,
  E as He,
  G as De,
  H as ne,
  I as mt,
  J as gt,
  K as At,
  L as pt,
  M as Dt,
  N as yt,
  O as bt,
  Q as jt,
  R as Rt,
  S as Ye,
  U as Qt,
  V as wt,
  W as Ft,
  X as xt,
  Y as Nt,
  Z as It,
  _ as be,
  $ as ye,
  a as Ut,
  a0 as Xt,
  a1 as Yt,
  a2 as Ke,
  a3 as Kt,
  a4 as Gt,
  a5 as Jt,
  a6 as Zt,
  a7 as en,
  a8 as ve,
  a9 as O,
  aa as F,
  ab as P,
  ac as tn,
  ad as nn,
  d as qe,
  ae as on,
  af as ln,
  ag as an,
  ah as J,
  ai as rn,
  aj as un,
  ak as kt,
  al as Pe,
  am as sn,
  an as cn,
  ao as dn,
  ap as fn,
  f as $,
  aq as vn,
  ar as hn,
} from './index-DAawzX9R.js';
import { u as Ne } from './use-quasar-CvibudSN.js';
function se(e, n, o) {
  return o <= n ? n : Math.min(o, Math.max(n, e));
}
const Ie = XMLHttpRequest,
  Tt = Ie.prototype.open,
  mn = ['top', 'right', 'bottom', 'left'];
let xe = [],
  ce = 0;
function gn({ p: e, pos: n, active: o, horiz: l, reverse: t, dir: a }) {
  let i = 1,
    u = 1;
  return l === !0
    ? (t === !0 && (i = -1),
      n === 'bottom' && (u = -1),
      { transform: `translate3d(${i * (e - 100)}%,${o ? 0 : u * -200}%,0)` })
    : (t === !0 && (u = -1),
      n === 'right' && (i = -1),
      {
        transform: `translate3d(${o ? 0 : a * i * -200}%,${u * (e - 100)}%,0)`,
      });
}
function pn(e, n) {
  return (
    typeof n != 'number' &&
      (e < 25
        ? (n = Math.random() * 3 + 3)
        : e < 65
          ? (n = Math.random() * 3)
          : e < 85
            ? (n = Math.random() * 2)
            : e < 99
              ? (n = 0.6)
              : (n = 0)),
    se(e + n, 0, 100)
  );
}
function yn(e) {
  ce++,
    xe.push(e),
    !(ce > 1) &&
      (Ie.prototype.open = function (n, o) {
        const l = [],
          t = () => {
            xe.forEach((i) => {
              (i.hijackFilter.value === null ||
                i.hijackFilter.value(o) === !0) &&
                (i.start(), l.push(i.stop));
            });
          },
          a = () => {
            l.forEach((i) => {
              i();
            });
          };
        this.addEventListener('loadstart', t, { once: !0 }),
          this.addEventListener('loadend', a, { once: !0 }),
          Tt.apply(this, arguments);
      });
}
function bn(e) {
  (xe = xe.filter((n) => n.start !== e)),
    (ce = Math.max(0, ce - 1)),
    ce === 0 && (Ie.prototype.open = Tt);
}
const wn = j({
    name: 'QAjaxBar',
    props: {
      position: {
        type: String,
        default: 'top',
        validator: (e) => mn.includes(e),
      },
      size: { type: String, default: '2px' },
      color: String,
      skipHijack: Boolean,
      reverse: Boolean,
      hijackFilter: Function,
    },
    emits: ['start', 'stop'],
    setup(e, { emit: n }) {
      const { proxy: o } = I(),
        l = q(0),
        t = q(!1),
        a = q(!0);
      let i = 0,
        u = null,
        c;
      const s = h(
          () =>
            `q-loading-bar q-loading-bar--${e.position}` +
            (e.color !== void 0 ? ` bg-${e.color}` : '') +
            (a.value === !0 ? '' : ' no-transition'),
        ),
        r = h(() => e.position === 'top' || e.position === 'bottom'),
        b = h(() => (r.value === !0 ? 'height' : 'width')),
        x = h(() => {
          const y = t.value,
            g = gn({
              p: l.value,
              pos: e.position,
              active: y,
              horiz: r.value,
              reverse:
                o.$q.lang.rtl === !0 && ['top', 'bottom'].includes(e.position)
                  ? e.reverse === !1
                  : e.reverse,
              dir: o.$q.lang.rtl === !0 ? -1 : 1,
            });
          return (g[b.value] = e.size), (g.opacity = y ? 1 : 0), g;
        }),
        d = h(() =>
          t.value === !0
            ? {
                role: 'progressbar',
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': l.value,
              }
            : { 'aria-hidden': 'true' },
        );
      function v(y = 300) {
        const g = c;
        return (
          (c = Math.max(0, y) || 0),
          i++,
          i > 1
            ? (g === 0 && y > 0
                ? w()
                : u !== null &&
                  g > 0 &&
                  y <= 0 &&
                  (clearTimeout(u), (u = null)),
              i)
            : (u !== null && clearTimeout(u),
              n('start'),
              (l.value = 0),
              (u = setTimeout(
                () => {
                  (u = null), (a.value = !0), y > 0 && w();
                },
                t._value === !0 ? 500 : 1,
              )),
              t._value !== !0 && ((t.value = !0), (a.value = !1)),
              i)
        );
      }
      function _(y) {
        return i > 0 && (l.value = pn(l.value, y)), i;
      }
      function C() {
        if (((i = Math.max(0, i - 1)), i > 0)) return i;
        u !== null && (clearTimeout(u), (u = null)), n('stop');
        const y = () => {
          (a.value = !0),
            (l.value = 100),
            (u = setTimeout(() => {
              (u = null), (t.value = !1);
            }, 1e3));
        };
        return l.value === 0 ? (u = setTimeout(y, 1)) : y(), i;
      }
      function w() {
        l.value < 100 &&
          (u = setTimeout(() => {
            (u = null), _(), w();
          }, c));
      }
      let m;
      return (
        ee(() => {
          e.skipHijack !== !0 &&
            ((m = !0),
            yn({
              start: v,
              stop: C,
              hijackFilter: h(() => e.hijackFilter || null),
            }));
        }),
        D(() => {
          u !== null && clearTimeout(u), m === !0 && bn(v);
        }),
        Object.assign(o, { start: v, stop: C, increment: _ }),
        () => L('div', { class: s.value, style: x.value, ...d.value })
      );
    },
  }),
  Ge = j({
    name: 'QToolbarTitle',
    props: { shrink: Boolean },
    setup(e, { slots: n }) {
      const o = h(
        () =>
          'q-toolbar__title ellipsis' + (e.shrink === !0 ? ' col-shrink' : ''),
      );
      return () => L('div', { class: o.value }, fe(n.default));
    },
  }),
  Je = j({
    name: 'QToolbar',
    props: { inset: Boolean },
    setup(e, { slots: n }) {
      const o = h(
        () =>
          'q-toolbar row no-wrap items-center' +
          (e.inset === !0 ? ' q-toolbar--inset' : ''),
      );
      return () => L('div', { class: o.value, role: 'toolbar' }, fe(n.default));
    },
  });
function xn() {
  const e = q(!ht.value);
  return (
    e.value === !1 &&
      ee(() => {
        e.value = !0;
      }),
    { isHydrated: e }
  );
}
const Ct = typeof ResizeObserver < 'u',
  Ze =
    Ct === !0
      ? {}
      : {
          style:
            'display:block;position:absolute;top:0;left:0;right:0;bottom:0;height:100%;width:100%;overflow:hidden;pointer-events:none;z-index:-1;',
          url: 'about:blank',
        },
  je = j({
    name: 'QResizeObserver',
    props: { debounce: { type: [String, Number], default: 100 } },
    emits: ['resize'],
    setup(e, { emit: n }) {
      let o = null,
        l,
        t = { width: -1, height: -1 };
      function a(c) {
        c === !0 || e.debounce === 0 || e.debounce === '0'
          ? i()
          : o === null && (o = setTimeout(i, e.debounce));
      }
      function i() {
        if ((o !== null && (clearTimeout(o), (o = null)), l)) {
          const { offsetWidth: c, offsetHeight: s } = l;
          (c !== t.width || s !== t.height) &&
            ((t = { width: c, height: s }), n('resize', t));
        }
      }
      const { proxy: u } = I();
      if (((u.trigger = a), Ct === !0)) {
        let c;
        const s = (r) => {
          (l = u.$el.parentNode),
            l
              ? ((c = new ResizeObserver(a)), c.observe(l), i())
              : r !== !0 &&
                de(() => {
                  s(!0);
                });
        };
        return (
          ee(() => {
            s();
          }),
          D(() => {
            o !== null && clearTimeout(o),
              c !== void 0 &&
                (c.disconnect !== void 0
                  ? c.disconnect()
                  : l && c.unobserve(l));
          }),
          Qe
        );
      } else {
        let c = function () {
            o !== null && (clearTimeout(o), (o = null)),
              b !== void 0 &&
                (b.removeEventListener !== void 0 &&
                  b.removeEventListener('resize', a, oe.passive),
                (b = void 0));
          },
          s = function () {
            c(),
              l &&
                l.contentDocument &&
                ((b = l.contentDocument.defaultView),
                b.addEventListener('resize', a, oe.passive),
                i());
          };
        const { isHydrated: r } = xn();
        let b;
        return (
          ee(() => {
            de(() => {
              (l = u.$el), l && s();
            });
          }),
          D(c),
          () => {
            if (r.value === !0)
              return L('object', {
                class: 'q--avoid-card-border',
                style: Ze.style,
                tabindex: -1,
                type: 'text/html',
                data: Ze.url,
                'aria-hidden': 'true',
                onLoad: s,
              });
          }
        );
      }
    },
  }),
  kn = j({
    name: 'QHeader',
    props: {
      modelValue: { type: Boolean, default: !0 },
      reveal: Boolean,
      revealOffset: { type: Number, default: 250 },
      bordered: Boolean,
      elevated: Boolean,
      heightHint: { type: [String, Number], default: 50 },
    },
    emits: ['reveal', 'focusin'],
    setup(e, { slots: n, emit: o }) {
      const {
          proxy: { $q: l },
        } = I(),
        t = Fe(Se, N);
      if (t === N)
        return console.error('QHeader needs to be child of QLayout'), N;
      const a = q(parseInt(e.heightHint, 10)),
        i = q(!0),
        u = h(
          () =>
            e.reveal === !0 ||
            t.view.value.indexOf('H') !== -1 ||
            (l.platform.is.ios && t.isContainer.value === !0),
        ),
        c = h(() => {
          if (e.modelValue !== !0) return 0;
          if (u.value === !0) return i.value === !0 ? a.value : 0;
          const m = a.value - t.scroll.value.position;
          return m > 0 ? m : 0;
        }),
        s = h(() => e.modelValue !== !0 || (u.value === !0 && i.value !== !0)),
        r = h(() => e.modelValue === !0 && s.value === !0 && e.reveal === !0),
        b = h(
          () =>
            'q-header q-layout__section--marginal ' +
            (u.value === !0 ? 'fixed' : 'absolute') +
            '-top' +
            (e.bordered === !0 ? ' q-header--bordered' : '') +
            (s.value === !0 ? ' q-header--hidden' : '') +
            (e.modelValue !== !0 ? ' q-layout--prevent-focus' : ''),
        ),
        x = h(() => {
          const m = t.rows.value.top,
            y = {};
          return (
            m[0] === 'l' &&
              t.left.space === !0 &&
              (y[l.lang.rtl === !0 ? 'right' : 'left'] = `${t.left.size}px`),
            m[2] === 'r' &&
              t.right.space === !0 &&
              (y[l.lang.rtl === !0 ? 'left' : 'right'] = `${t.right.size}px`),
            y
          );
        });
      function d(m, y) {
        t.update('header', m, y);
      }
      function v(m, y) {
        m.value !== y && (m.value = y);
      }
      function _({ height: m }) {
        v(a, m), d('size', m);
      }
      function C(m) {
        r.value === !0 && v(i, !0), o('focusin', m);
      }
      T(
        () => e.modelValue,
        (m) => {
          d('space', m), v(i, !0), t.animate();
        },
      ),
        T(c, (m) => {
          d('offset', m);
        }),
        T(
          () => e.reveal,
          (m) => {
            m === !1 && v(i, e.modelValue);
          },
        ),
        T(i, (m) => {
          t.animate(), o('reveal', m);
        }),
        T(t.scroll, (m) => {
          e.reveal === !0 &&
            v(
              i,
              m.direction === 'up' ||
                m.position <= e.revealOffset ||
                m.position - m.inflectionPoint < 100,
            );
        });
      const w = {};
      return (
        (t.instances.header = w),
        e.modelValue === !0 && d('size', a.value),
        d('space', e.modelValue),
        d('offset', c.value),
        D(() => {
          t.instances.header === w &&
            ((t.instances.header = void 0),
            d('size', 0),
            d('offset', 0),
            d('space', !1));
        }),
        () => {
          const m = Pt(n.default, []);
          return (
            e.elevated === !0 &&
              m.push(
                L('div', {
                  class:
                    'q-layout__shadow absolute-full overflow-hidden no-pointer-events',
                }),
              ),
            m.push(L(je, { debounce: 0, onResize: _ })),
            L('header', { class: b.value, style: x.value, onFocusin: C }, m)
          );
        }
      );
    },
  }),
  Ue = { left: !0, right: !0, up: !0, down: !0, horizontal: !0, vertical: !0 },
  Tn = Object.keys(Ue);
Ue.all = !0;
function et(e) {
  const n = {};
  for (const o of Tn) e[o] === !0 && (n[o] = !0);
  return Object.keys(n).length === 0
    ? Ue
    : (n.horizontal === !0
        ? (n.left = n.right = !0)
        : n.left === !0 && n.right === !0 && (n.horizontal = !0),
      n.vertical === !0
        ? (n.up = n.down = !0)
        : n.up === !0 && n.down === !0 && (n.vertical = !0),
      n.horizontal === !0 && n.vertical === !0 && (n.all = !0),
      n);
}
const Cn = ['INPUT', 'TEXTAREA'];
function tt(e, n) {
  return (
    n.event === void 0 &&
    e.target !== void 0 &&
    e.target.draggable !== !0 &&
    typeof n.handler == 'function' &&
    Cn.includes(e.target.nodeName.toUpperCase()) === !1 &&
    (e.qClonedBy === void 0 || e.qClonedBy.indexOf(n.uid) === -1)
  );
}
function ke() {
  if (window.getSelection !== void 0) {
    const e = window.getSelection();
    e.empty !== void 0
      ? e.empty()
      : e.removeAllRanges !== void 0 &&
        (e.removeAllRanges(),
        Wt.is.mobile !== !0 && e.addRange(document.createRange()));
  } else document.selection !== void 0 && document.selection.empty();
}
function We(e, n, o) {
  const l = De(e);
  let t,
    a = l.left - n.event.x,
    i = l.top - n.event.y,
    u = Math.abs(a),
    c = Math.abs(i);
  const s = n.direction;
  s.horizontal === !0 && s.vertical !== !0
    ? (t = a < 0 ? 'left' : 'right')
    : s.horizontal !== !0 && s.vertical === !0
      ? (t = i < 0 ? 'up' : 'down')
      : s.up === !0 && i < 0
        ? ((t = 'up'),
          u > c &&
            (s.left === !0 && a < 0
              ? (t = 'left')
              : s.right === !0 && a > 0 && (t = 'right')))
        : s.down === !0 && i > 0
          ? ((t = 'down'),
            u > c &&
              (s.left === !0 && a < 0
                ? (t = 'left')
                : s.right === !0 && a > 0 && (t = 'right')))
          : s.left === !0 && a < 0
            ? ((t = 'left'),
              u < c &&
                (s.up === !0 && i < 0
                  ? (t = 'up')
                  : s.down === !0 && i > 0 && (t = 'down')))
            : s.right === !0 &&
              a > 0 &&
              ((t = 'right'),
              u < c &&
                (s.up === !0 && i < 0
                  ? (t = 'up')
                  : s.down === !0 && i > 0 && (t = 'down')));
  let r = !1;
  if (t === void 0 && o === !1) {
    if (n.event.isFirst === !0 || n.event.lastDir === void 0) return {};
    (t = n.event.lastDir),
      (r = !0),
      t === 'left' || t === 'right'
        ? ((l.left -= a), (u = 0), (a = 0))
        : ((l.top -= i), (c = 0), (i = 0));
  }
  return {
    synthetic: r,
    payload: {
      evt: e,
      touch: n.event.mouse !== !0,
      mouse: n.event.mouse === !0,
      position: l,
      direction: t,
      isFirst: n.event.isFirst,
      isFinal: o === !0,
      duration: Date.now() - n.event.time,
      distance: { x: u, y: c },
      offset: { x: a, y: i },
      delta: { x: l.left - n.event.lastX, y: l.top - n.event.lastY },
    },
  };
}
let Sn = 0;
const Ve = Vt({
    name: 'touch-pan',
    beforeMount(e, { value: n, modifiers: o }) {
      if (o.mouse !== !0 && te.has.touch !== !0) return;
      function l(a, i) {
        o.mouse === !0 && i === !0
          ? mt(a)
          : (o.stop === !0 && He(a), o.prevent === !0 && we(a));
      }
      const t = {
        uid: 'qvtp_' + Sn++,
        handler: n,
        modifiers: o,
        direction: et(o),
        noop: Qe,
        mouseStart(a) {
          tt(a, t) &&
            Ot(a) &&
            (K(t, 'temp', [
              [document, 'mousemove', 'move', 'notPassiveCapture'],
              [document, 'mouseup', 'end', 'passiveCapture'],
            ]),
            t.start(a, !0));
        },
        touchStart(a) {
          if (tt(a, t)) {
            const i = a.target;
            K(t, 'temp', [
              [i, 'touchmove', 'move', 'notPassiveCapture'],
              [i, 'touchcancel', 'end', 'passiveCapture'],
              [i, 'touchend', 'end', 'passiveCapture'],
            ]),
              t.start(a);
          }
        },
        start(a, i) {
          if (
            (te.is.firefox === !0 && Be(e, !0),
            (t.lastEvt = a),
            i === !0 || o.stop === !0)
          ) {
            if (
              t.direction.all !== !0 &&
              (i !== !0 ||
                (t.modifiers.mouseAllDir !== !0 &&
                  t.modifiers.mousealldir !== !0))
            ) {
              const s =
                a.type.indexOf('mouse') !== -1
                  ? new MouseEvent(a.type, a)
                  : new TouchEvent(a.type, a);
              a.defaultPrevented === !0 && we(s),
                a.cancelBubble === !0 && He(s),
                Object.assign(s, {
                  qKeyEvent: a.qKeyEvent,
                  qClickOutside: a.qClickOutside,
                  qAnchorHandled: a.qAnchorHandled,
                  qClonedBy:
                    a.qClonedBy === void 0
                      ? [t.uid]
                      : a.qClonedBy.concat(t.uid),
                }),
                (t.initialEvent = { target: a.target, event: s });
            }
            He(a);
          }
          const { left: u, top: c } = De(a);
          t.event = {
            x: u,
            y: c,
            time: Date.now(),
            mouse: i === !0,
            detected: !1,
            isFirst: !0,
            isFinal: !1,
            lastX: u,
            lastY: c,
          };
        },
        move(a) {
          if (t.event === void 0) return;
          const i = De(a),
            u = i.left - t.event.x,
            c = i.top - t.event.y;
          if (u === 0 && c === 0) return;
          t.lastEvt = a;
          const s = t.event.mouse === !0,
            r = () => {
              l(a, s);
              let d;
              o.preserveCursor !== !0 &&
                o.preservecursor !== !0 &&
                ((d = document.documentElement.style.cursor || ''),
                (document.documentElement.style.cursor = 'grabbing')),
                s === !0 &&
                  document.body.classList.add('no-pointer-events--children'),
                document.body.classList.add('non-selectable'),
                ke(),
                (t.styleCleanup = (v) => {
                  if (
                    ((t.styleCleanup = void 0),
                    d !== void 0 && (document.documentElement.style.cursor = d),
                    document.body.classList.remove('non-selectable'),
                    s === !0)
                  ) {
                    const _ = () => {
                      document.body.classList.remove(
                        'no-pointer-events--children',
                      );
                    };
                    v !== void 0
                      ? setTimeout(() => {
                          _(), v();
                        }, 50)
                      : _();
                  } else v !== void 0 && v();
                });
            };
          if (t.event.detected === !0) {
            t.event.isFirst !== !0 && l(a, t.event.mouse);
            const { payload: d, synthetic: v } = We(a, t, !1);
            d !== void 0 &&
              (t.handler(d) === !1
                ? t.end(a)
                : (t.styleCleanup === void 0 && t.event.isFirst === !0 && r(),
                  (t.event.lastX = d.position.left),
                  (t.event.lastY = d.position.top),
                  (t.event.lastDir = v === !0 ? void 0 : d.direction),
                  (t.event.isFirst = !1)));
            return;
          }
          if (
            t.direction.all === !0 ||
            (s === !0 &&
              (t.modifiers.mouseAllDir === !0 ||
                t.modifiers.mousealldir === !0))
          ) {
            r(), (t.event.detected = !0), t.move(a);
            return;
          }
          const b = Math.abs(u),
            x = Math.abs(c);
          b !== x &&
            ((t.direction.horizontal === !0 && b > x) ||
            (t.direction.vertical === !0 && b < x) ||
            (t.direction.up === !0 && b < x && c < 0) ||
            (t.direction.down === !0 && b < x && c > 0) ||
            (t.direction.left === !0 && b > x && u < 0) ||
            (t.direction.right === !0 && b > x && u > 0)
              ? ((t.event.detected = !0), t.move(a))
              : t.end(a, !0));
        },
        end(a, i) {
          if (t.event !== void 0) {
            if ((ne(t, 'temp'), te.is.firefox === !0 && Be(e, !1), i === !0))
              t.styleCleanup !== void 0 && t.styleCleanup(),
                t.event.detected !== !0 &&
                  t.initialEvent !== void 0 &&
                  t.initialEvent.target.dispatchEvent(t.initialEvent.event);
            else if (t.event.detected === !0) {
              t.event.isFirst === !0 &&
                t.handler(We(a === void 0 ? t.lastEvt : a, t).payload);
              const { payload: u } = We(a === void 0 ? t.lastEvt : a, t, !0),
                c = () => {
                  t.handler(u);
                };
              t.styleCleanup !== void 0 ? t.styleCleanup(c) : c();
            }
            (t.event = void 0), (t.initialEvent = void 0), (t.lastEvt = void 0);
          }
        },
      };
      if (((e.__qtouchpan = t), o.mouse === !0)) {
        const a =
          o.mouseCapture === !0 || o.mousecapture === !0 ? 'Capture' : '';
        K(t, 'main', [[e, 'mousedown', 'mouseStart', `passive${a}`]]);
      }
      te.has.touch === !0 &&
        K(t, 'main', [
          [
            e,
            'touchstart',
            'touchStart',
            `passive${o.capture === !0 ? 'Capture' : ''}`,
          ],
          [e, 'touchmove', 'noop', 'notPassiveCapture'],
        ]);
    },
    updated(e, n) {
      const o = e.__qtouchpan;
      o !== void 0 &&
        (n.oldValue !== n.value &&
          (typeof value != 'function' && o.end(), (o.handler = n.value)),
        (o.direction = et(n.modifiers)));
    },
    beforeUnmount(e) {
      const n = e.__qtouchpan;
      n !== void 0 &&
        (n.event !== void 0 && n.end(),
        ne(n, 'main'),
        ne(n, 'temp'),
        te.is.firefox === !0 && Be(e, !1),
        n.styleCleanup !== void 0 && n.styleCleanup(),
        delete e.__qtouchpan);
    },
  }),
  nt = 150,
  qn = j({
    name: 'QDrawer',
    inheritAttrs: !1,
    props: {
      ...gt,
      ...At,
      side: {
        type: String,
        default: 'left',
        validator: (e) => ['left', 'right'].includes(e),
      },
      width: { type: Number, default: 300 },
      mini: Boolean,
      miniToOverlay: Boolean,
      miniWidth: { type: Number, default: 57 },
      noMiniAnimation: Boolean,
      breakpoint: { type: Number, default: 1023 },
      showIfAbove: Boolean,
      behavior: {
        type: String,
        validator: (e) => ['default', 'desktop', 'mobile'].includes(e),
        default: 'default',
      },
      bordered: Boolean,
      elevated: Boolean,
      overlay: Boolean,
      persistent: Boolean,
      noSwipeOpen: Boolean,
      noSwipeClose: Boolean,
      noSwipeBackdrop: Boolean,
    },
    emits: [...pt, 'onLayout', 'miniState'],
    setup(e, { slots: n, emit: o, attrs: l }) {
      const t = I(),
        {
          proxy: { $q: a },
        } = t,
        i = Dt(e, a),
        { preventBodyScroll: u } = Qt(),
        { registerTimeout: c, removeTimeout: s } = yt(),
        r = Fe(Se, N);
      if (r === N)
        return console.error('QDrawer needs to be child of QLayout'), N;
      let b,
        x = null,
        d;
      const v = q(
          e.behavior === 'mobile' ||
            (e.behavior !== 'desktop' && r.totalWidth.value <= e.breakpoint),
        ),
        _ = h(() => e.mini === !0 && v.value !== !0),
        C = h(() => (_.value === !0 ? e.miniWidth : e.width)),
        w = q(
          e.showIfAbove === !0 && v.value === !1 ? !0 : e.modelValue === !0,
        ),
        m = h(() => e.persistent !== !0 && (v.value === !0 || me.value === !0));
      function y(f, k) {
        if ((S(), f !== !1 && r.animate(), V(0), v.value === !0)) {
          const H = r.instances[A.value];
          H !== void 0 && H.belowBreakpoint === !0 && H.hide(!1),
            X(1),
            r.isContainer.value !== !0 && u(!0);
        } else X(0), f !== !1 && Ee(!1);
        c(() => {
          f !== !1 && Ee(!0), k !== !0 && o('show', f);
        }, nt);
      }
      function g(f, k) {
        B(),
          f !== !1 && r.animate(),
          X(0),
          V(R.value * C.value),
          Me(),
          k !== !0
            ? c(() => {
                o('hide', f);
              }, nt)
            : s();
      }
      const { show: p, hide: z } = bt({
          showing: w,
          hideOnRouteChange: m,
          handleShow: y,
          handleHide: g,
        }),
        { addToHistory: S, removeFromHistory: B } = jt(w, z, m),
        E = { belowBreakpoint: v, hide: z },
        W = h(() => e.side === 'right'),
        R = h(() => (a.lang.rtl === !0 ? -1 : 1) * (W.value === !0 ? 1 : -1)),
        he = q(0),
        U = q(!1),
        le = q(!1),
        ae = q(C.value * R.value),
        A = h(() => (W.value === !0 ? 'left' : 'right')),
        ie = h(() =>
          w.value === !0 && v.value === !1 && e.overlay === !1
            ? e.miniToOverlay === !0
              ? e.miniWidth
              : C.value
            : 0,
        ),
        re = h(
          () =>
            e.overlay === !0 ||
            e.miniToOverlay === !0 ||
            r.view.value.indexOf(W.value ? 'R' : 'L') !== -1 ||
            (a.platform.is.ios === !0 && r.isContainer.value === !0),
        ),
        G = h(() => e.overlay === !1 && w.value === !0 && v.value === !1),
        me = h(() => e.overlay === !0 && w.value === !0 && v.value === !1),
        _e = h(
          () =>
            'fullscreen q-drawer__backdrop' +
            (w.value === !1 && U.value === !1 ? ' hidden' : ''),
        ),
        ze = h(() => ({ backgroundColor: `rgba(0,0,0,${he.value * 0.4})` })),
        M = h(() =>
          W.value === !0
            ? r.rows.value.top[2] === 'r'
            : r.rows.value.top[0] === 'l',
        ),
        ue = h(() =>
          W.value === !0
            ? r.rows.value.bottom[2] === 'r'
            : r.rows.value.bottom[0] === 'l',
        ),
        Q = h(() => {
          const f = {};
          return (
            r.header.space === !0 &&
              M.value === !1 &&
              (re.value === !0
                ? (f.top = `${r.header.offset}px`)
                : r.header.space === !0 && (f.top = `${r.header.size}px`)),
            r.footer.space === !0 &&
              ue.value === !1 &&
              (re.value === !0
                ? (f.bottom = `${r.footer.offset}px`)
                : r.footer.space === !0 && (f.bottom = `${r.footer.size}px`)),
            f
          );
        }),
        ge = h(() => {
          const f = {
            width: `${C.value}px`,
            transform: `translateX(${ae.value}px)`,
          };
          return v.value === !0 ? f : Object.assign(f, Q.value);
        }),
        _t = h(
          () =>
            'q-drawer__content fit ' +
            (r.isContainer.value !== !0 ? 'scroll' : 'overflow-auto'),
        ),
        zt = h(
          () =>
            `q-drawer q-drawer--${e.side}` +
            (le.value === !0 ? ' q-drawer--mini-animate' : '') +
            (e.bordered === !0 ? ' q-drawer--bordered' : '') +
            (i.value === !0 ? ' q-drawer--dark q-dark' : '') +
            (U.value === !0
              ? ' no-transition'
              : w.value === !0
                ? ''
                : ' q-layout--prevent-focus') +
            (v.value === !0
              ? ' fixed q-drawer--on-top q-drawer--mobile q-drawer--top-padding'
              : ` q-drawer--${_.value === !0 ? 'mini' : 'standard'}` +
                (re.value === !0 || G.value !== !0 ? ' fixed' : '') +
                (e.overlay === !0 || e.miniToOverlay === !0
                  ? ' q-drawer--on-top'
                  : '') +
                (M.value === !0 ? ' q-drawer--top-padding' : '')),
        ),
        Lt = h(() => {
          const f = a.lang.rtl === !0 ? e.side : A.value;
          return [[Ve, Bt, void 0, { [f]: !0, mouse: !0 }]];
        }),
        Et = h(() => {
          const f = a.lang.rtl === !0 ? A.value : e.side;
          return [[Ve, Xe, void 0, { [f]: !0, mouse: !0 }]];
        }),
        Mt = h(() => {
          const f = a.lang.rtl === !0 ? A.value : e.side;
          return [[Ve, Xe, void 0, { [f]: !0, mouse: !0, mouseAllDir: !0 }]];
        });
      function Le() {
        Ht(
          v,
          e.behavior === 'mobile' ||
            (e.behavior !== 'desktop' && r.totalWidth.value <= e.breakpoint),
        );
      }
      T(v, (f) => {
        f === !0
          ? ((b = w.value), w.value === !0 && z(!1))
          : e.overlay === !1 &&
            e.behavior !== 'mobile' &&
            b !== !1 &&
            (w.value === !0 ? (V(0), X(0), Me()) : p(!1));
      }),
        T(
          () => e.side,
          (f, k) => {
            r.instances[k] === E &&
              ((r.instances[k] = void 0), (r[k].space = !1), (r[k].offset = 0)),
              (r.instances[f] = E),
              (r[f].size = C.value),
              (r[f].space = G.value),
              (r[f].offset = ie.value);
          },
        ),
        T(r.totalWidth, () => {
          (r.isContainer.value === !0 || document.qScrollPrevented !== !0) &&
            Le();
        }),
        T(() => e.behavior + e.breakpoint, Le),
        T(r.isContainer, (f) => {
          w.value === !0 && u(f !== !0), f === !0 && Le();
        }),
        T(r.scrollbarWidth, () => {
          V(w.value === !0 ? 0 : void 0);
        }),
        T(ie, (f) => {
          Y('offset', f);
        }),
        T(G, (f) => {
          o('onLayout', f), Y('space', f);
        }),
        T(W, () => {
          V();
        }),
        T(C, (f) => {
          V(), $e(e.miniToOverlay, f);
        }),
        T(
          () => e.miniToOverlay,
          (f) => {
            $e(f, C.value);
          },
        ),
        T(
          () => a.lang.rtl,
          () => {
            V();
          },
        ),
        T(
          () => e.mini,
          () => {
            e.noMiniAnimation || (e.modelValue === !0 && ($t(), r.animate()));
          },
        ),
        T(_, (f) => {
          o('miniState', f);
        });
      function V(f) {
        f === void 0
          ? de(() => {
              (f = w.value === !0 ? 0 : C.value), V(R.value * f);
            })
          : (r.isContainer.value === !0 &&
              W.value === !0 &&
              (v.value === !0 || Math.abs(f) === C.value) &&
              (f += R.value * r.scrollbarWidth.value),
            (ae.value = f));
      }
      function X(f) {
        he.value = f;
      }
      function Ee(f) {
        const k = f === !0 ? 'remove' : r.isContainer.value !== !0 ? 'add' : '';
        k !== '' && document.body.classList[k]('q-body--drawer-toggle');
      }
      function $t() {
        x !== null && clearTimeout(x),
          t.proxy &&
            t.proxy.$el &&
            t.proxy.$el.classList.add('q-drawer--mini-animate'),
          (le.value = !0),
          (x = setTimeout(() => {
            (x = null),
              (le.value = !1),
              t &&
                t.proxy &&
                t.proxy.$el &&
                t.proxy.$el.classList.remove('q-drawer--mini-animate');
          }, 150));
      }
      function Bt(f) {
        if (w.value !== !1) return;
        const k = C.value,
          H = se(f.distance.x, 0, k);
        if (f.isFinal === !0) {
          H >= Math.min(75, k) === !0
            ? p()
            : (r.animate(), X(0), V(R.value * k)),
            (U.value = !1);
          return;
        }
        V(
          (a.lang.rtl === !0 ? W.value !== !0 : W.value)
            ? Math.max(k - H, 0)
            : Math.min(0, H - k),
        ),
          X(se(H / k, 0, 1)),
          f.isFirst === !0 && (U.value = !0);
      }
      function Xe(f) {
        if (w.value !== !0) return;
        const k = C.value,
          H = f.direction === e.side,
          pe = (a.lang.rtl === !0 ? H !== !0 : H) ? se(f.distance.x, 0, k) : 0;
        if (f.isFinal === !0) {
          Math.abs(pe) < Math.min(75, k) === !0
            ? (r.animate(), X(1), V(0))
            : z(),
            (U.value = !1);
          return;
        }
        V(R.value * pe),
          X(se(1 - pe / k, 0, 1)),
          f.isFirst === !0 && (U.value = !0);
      }
      function Me() {
        u(!1), Ee(!0);
      }
      function Y(f, k) {
        r.update(e.side, f, k);
      }
      function Ht(f, k) {
        f.value !== k && (f.value = k);
      }
      function $e(f, k) {
        Y('size', f === !0 ? e.miniWidth : k);
      }
      return (
        (r.instances[e.side] = E),
        $e(e.miniToOverlay, C.value),
        Y('space', G.value),
        Y('offset', ie.value),
        e.showIfAbove === !0 &&
          e.modelValue !== !0 &&
          w.value === !0 &&
          e['onUpdate:modelValue'] !== void 0 &&
          o('update:modelValue', !0),
        ee(() => {
          o('onLayout', G.value),
            o('miniState', _.value),
            (b = e.showIfAbove === !0);
          const f = () => {
            (w.value === !0 ? y : g)(!1, !0);
          };
          if (r.totalWidth.value !== 0) {
            de(f);
            return;
          }
          d = T(r.totalWidth, () => {
            d(),
              (d = void 0),
              w.value === !1 && e.showIfAbove === !0 && v.value === !1
                ? p(!1)
                : f();
          });
        }),
        D(() => {
          d !== void 0 && d(),
            x !== null && (clearTimeout(x), (x = null)),
            w.value === !0 && Me(),
            r.instances[e.side] === E &&
              ((r.instances[e.side] = void 0),
              Y('size', 0),
              Y('offset', 0),
              Y('space', !1));
        }),
        () => {
          const f = [];
          v.value === !0 &&
            (e.noSwipeOpen === !1 &&
              f.push(
                Rt(
                  L('div', {
                    key: 'open',
                    class: `q-drawer__opener fixed-${e.side}`,
                    'aria-hidden': 'true',
                  }),
                  Lt.value,
                ),
              ),
            f.push(
              Ye(
                'div',
                {
                  ref: 'backdrop',
                  class: _e.value,
                  style: ze.value,
                  'aria-hidden': 'true',
                  onClick: z,
                },
                void 0,
                'backdrop',
                e.noSwipeBackdrop !== !0 && w.value === !0,
                () => Mt.value,
              ),
            ));
          const k = _.value === !0 && n.mini !== void 0,
            H = [
              L(
                'div',
                { ...l, key: '' + k, class: [_t.value, l.class] },
                k === !0 ? n.mini() : fe(n.default),
              ),
            ];
          return (
            e.elevated === !0 &&
              w.value === !0 &&
              H.push(
                L('div', {
                  class:
                    'q-layout__shadow absolute-full overflow-hidden no-pointer-events',
                }),
              ),
            f.push(
              Ye(
                'aside',
                { ref: 'content', class: zt.value, style: ge.value },
                H,
                'contentclose',
                e.noSwipeClose !== !0 && v.value === !0,
                () => Et.value,
              ),
            ),
            L('div', { class: 'q-drawer-container' }, f)
          );
        }
      );
    },
  }),
  _n = j({
    name: 'QPageContainer',
    setup(e, { slots: n }) {
      const {
          proxy: { $q: o },
        } = I(),
        l = Fe(Se, N);
      if (l === N)
        return console.error('QPageContainer needs to be child of QLayout'), N;
      wt(Ft, !0);
      const t = h(() => {
        const a = {};
        return (
          l.header.space === !0 && (a.paddingTop = `${l.header.size}px`),
          l.right.space === !0 &&
            (a[`padding${o.lang.rtl === !0 ? 'Left' : 'Right'}`] =
              `${l.right.size}px`),
          l.footer.space === !0 && (a.paddingBottom = `${l.footer.size}px`),
          l.left.space === !0 &&
            (a[`padding${o.lang.rtl === !0 ? 'Right' : 'Left'}`] =
              `${l.left.size}px`),
          a
        );
      });
      return () =>
        L('div', { class: 'q-page-container', style: t.value }, fe(n.default));
    },
  }),
  { passive: ot } = oe,
  zn = ['both', 'horizontal', 'vertical'],
  Ln = j({
    name: 'QScrollObserver',
    props: {
      axis: {
        type: String,
        validator: (e) => zn.includes(e),
        default: 'vertical',
      },
      debounce: [String, Number],
      scrollTarget: { default: void 0 },
    },
    emits: ['scroll'],
    setup(e, { emit: n }) {
      const o = {
        position: { top: 0, left: 0 },
        direction: 'down',
        directionChanged: !1,
        delta: { top: 0, left: 0 },
        inflectionPoint: { top: 0, left: 0 },
      };
      let l = null,
        t,
        a;
      T(
        () => e.scrollTarget,
        () => {
          c(), u();
        },
      );
      function i() {
        l !== null && l();
        const b = Math.max(0, Nt(t)),
          x = It(t),
          d = { top: b - o.position.top, left: x - o.position.left };
        if (
          (e.axis === 'vertical' && d.top === 0) ||
          (e.axis === 'horizontal' && d.left === 0)
        )
          return;
        const v =
          Math.abs(d.top) >= Math.abs(d.left)
            ? d.top < 0
              ? 'up'
              : 'down'
            : d.left < 0
              ? 'left'
              : 'right';
        (o.position = { top: b, left: x }),
          (o.directionChanged = o.direction !== v),
          (o.delta = d),
          o.directionChanged === !0 &&
            ((o.direction = v), (o.inflectionPoint = o.position)),
          n('scroll', { ...o });
      }
      function u() {
        (t = xt(a, e.scrollTarget)), t.addEventListener('scroll', s, ot), s(!0);
      }
      function c() {
        t !== void 0 && (t.removeEventListener('scroll', s, ot), (t = void 0));
      }
      function s(b) {
        if (b === !0 || e.debounce === 0 || e.debounce === '0') i();
        else if (l === null) {
          const [x, d] = e.debounce
            ? [setTimeout(i, e.debounce), clearTimeout]
            : [requestAnimationFrame(i), cancelAnimationFrame];
          l = () => {
            d(x), (l = null);
          };
        }
      }
      const { proxy: r } = I();
      return (
        T(() => r.$q.lang.rtl, i),
        ee(() => {
          (a = r.$el.parentNode), u();
        }),
        D(() => {
          l !== null && l(), c();
        }),
        Object.assign(r, { trigger: s, getPosition: () => o }),
        Qe
      );
    },
  }),
  En = j({
    name: 'QLayout',
    props: {
      container: Boolean,
      view: {
        type: String,
        default: 'hhh lpr fff',
        validator: (e) => /^(h|l)h(h|r) lpr (f|l)f(f|r)$/.test(e.toLowerCase()),
      },
      onScroll: Function,
      onScrollHeight: Function,
      onResize: Function,
    },
    setup(e, { slots: n, emit: o }) {
      const {
          proxy: { $q: l },
        } = I(),
        t = q(null),
        a = q(l.screen.height),
        i = q(e.container === !0 ? 0 : l.screen.width),
        u = q({ position: 0, direction: 'down', inflectionPoint: 0 }),
        c = q(0),
        s = q(ht.value === !0 ? 0 : be()),
        r = h(
          () =>
            'q-layout q-layout--' +
            (e.container === !0 ? 'containerized' : 'standard'),
        ),
        b = h(() =>
          e.container === !1 ? { minHeight: l.screen.height + 'px' } : null,
        ),
        x = h(() =>
          s.value !== 0
            ? { [l.lang.rtl === !0 ? 'left' : 'right']: `${s.value}px` }
            : null,
        ),
        d = h(() =>
          s.value !== 0
            ? {
                [l.lang.rtl === !0 ? 'right' : 'left']: 0,
                [l.lang.rtl === !0 ? 'left' : 'right']: `-${s.value}px`,
                width: `calc(100% + ${s.value}px)`,
              }
            : null,
        );
      function v(g) {
        if (e.container === !0 || document.qScrollPrevented !== !0) {
          const p = {
            position: g.position.top,
            direction: g.direction,
            directionChanged: g.directionChanged,
            inflectionPoint: g.inflectionPoint.top,
            delta: g.delta.top,
          };
          (u.value = p), e.onScroll !== void 0 && o('scroll', p);
        }
      }
      function _(g) {
        const { height: p, width: z } = g;
        let S = !1;
        a.value !== p &&
          ((S = !0),
          (a.value = p),
          e.onScrollHeight !== void 0 && o('scrollHeight', p),
          w()),
          i.value !== z && ((S = !0), (i.value = z)),
          S === !0 && e.onResize !== void 0 && o('resize', g);
      }
      function C({ height: g }) {
        c.value !== g && ((c.value = g), w());
      }
      function w() {
        if (e.container === !0) {
          const g = a.value > c.value ? be() : 0;
          s.value !== g && (s.value = g);
        }
      }
      let m = null;
      const y = {
        instances: {},
        view: h(() => e.view),
        isContainer: h(() => e.container),
        rootRef: t,
        height: a,
        containerHeight: c,
        scrollbarWidth: s,
        totalWidth: h(() => i.value + s.value),
        rows: h(() => {
          const g = e.view.toLowerCase().split(' ');
          return {
            top: g[0].split(''),
            middle: g[1].split(''),
            bottom: g[2].split(''),
          };
        }),
        header: ye({ size: 0, offset: 0, space: !1 }),
        right: ye({ size: 300, offset: 0, space: !1 }),
        footer: ye({ size: 0, offset: 0, space: !1 }),
        left: ye({ size: 300, offset: 0, space: !1 }),
        scroll: u,
        animate() {
          m !== null
            ? clearTimeout(m)
            : document.body.classList.add('q-body--layout-animate'),
            (m = setTimeout(() => {
              (m = null),
                document.body.classList.remove('q-body--layout-animate');
            }, 155));
        },
        update(g, p, z) {
          y[g][p] = z;
        },
      };
      if ((wt(Se, y), be() > 0)) {
        let g = function () {
            (S = null), B.classList.remove('hide-scrollbar');
          },
          p = function () {
            if (S === null) {
              if (B.scrollHeight > l.screen.height) return;
              B.classList.add('hide-scrollbar');
            } else clearTimeout(S);
            S = setTimeout(g, 300);
          },
          z = function (E) {
            S !== null && E === 'remove' && (clearTimeout(S), g()),
              window[`${E}EventListener`]('resize', p);
          },
          S = null;
        const B = document.body;
        T(() => (e.container !== !0 ? 'add' : 'remove'), z),
          e.container !== !0 && z('add'),
          Ut(() => {
            z('remove');
          });
      }
      return () => {
        const g = Xt(n.default, [
            L(Ln, { onScroll: v }),
            L(je, { onResize: _ }),
          ]),
          p = L(
            'div',
            {
              class: r.value,
              style: b.value,
              ref: e.container === !0 ? void 0 : t,
              tabindex: -1,
            },
            g,
          );
        return e.container === !0
          ? L('div', { class: 'q-layout-container overflow-hidden', ref: t }, [
              L(je, { onResize: C }),
              L('div', { class: 'absolute-full', style: x.value }, [
                L('div', { class: 'scroll', style: d.value }, [p]),
              ]),
            ])
          : p;
      };
    },
  }),
  Mn = {
    target: { default: !0 },
    noParentEvent: Boolean,
    contextMenu: Boolean,
  };
function $n({ showing: e, avoidEmit: n, configureAnchorEl: o }) {
  const { props: l, proxy: t, emit: a } = I(),
    i = q(null);
  let u = null;
  function c(d) {
    return i.value === null
      ? !1
      : d === void 0 || d.touches === void 0 || d.touches.length <= 1;
  }
  const s = {};
  o === void 0 &&
    (Object.assign(s, {
      hide(d) {
        t.hide(d);
      },
      toggle(d) {
        t.toggle(d), (d.qAnchorHandled = !0);
      },
      toggleKey(d) {
        Yt(d, 13) === !0 && s.toggle(d);
      },
      contextClick(d) {
        t.hide(d),
          we(d),
          de(() => {
            t.show(d), (d.qAnchorHandled = !0);
          });
      },
      prevent: we,
      mobileTouch(d) {
        if ((s.mobileCleanup(d), c(d) !== !0)) return;
        t.hide(d), i.value.classList.add('non-selectable');
        const v = d.target;
        K(s, 'anchor', [
          [v, 'touchmove', 'mobileCleanup', 'passive'],
          [v, 'touchend', 'mobileCleanup', 'passive'],
          [v, 'touchcancel', 'mobileCleanup', 'passive'],
          [i.value, 'contextmenu', 'prevent', 'notPassive'],
        ]),
          (u = setTimeout(() => {
            (u = null), t.show(d), (d.qAnchorHandled = !0);
          }, 300));
      },
      mobileCleanup(d) {
        i.value.classList.remove('non-selectable'),
          u !== null && (clearTimeout(u), (u = null)),
          e.value === !0 && d !== void 0 && ke();
      },
    }),
    (o = function (d = l.contextMenu) {
      if (l.noParentEvent === !0 || i.value === null) return;
      let v;
      d === !0
        ? t.$q.platform.is.mobile === !0
          ? (v = [[i.value, 'touchstart', 'mobileTouch', 'passive']])
          : (v = [
              [i.value, 'mousedown', 'hide', 'passive'],
              [i.value, 'contextmenu', 'contextClick', 'notPassive'],
            ])
        : (v = [
            [i.value, 'click', 'toggle', 'passive'],
            [i.value, 'keyup', 'toggleKey', 'passive'],
          ]),
        K(s, 'anchor', v);
    }));
  function r() {
    ne(s, 'anchor');
  }
  function b(d) {
    for (i.value = d; i.value.classList.contains('q-anchor--skip'); )
      i.value = i.value.parentNode;
    o();
  }
  function x() {
    if (l.target === !1 || l.target === '' || t.$el.parentNode === null)
      i.value = null;
    else if (l.target === !0) b(t.$el.parentNode);
    else {
      let d = l.target;
      if (typeof l.target == 'string')
        try {
          d = document.querySelector(l.target);
        } catch {
          d = void 0;
        }
      d != null
        ? ((i.value = d.$el || d), o())
        : ((i.value = null),
          console.error(`Anchor: target "${l.target}" not found`));
    }
  }
  return (
    T(
      () => l.contextMenu,
      (d) => {
        i.value !== null && (r(), o(d));
      },
    ),
    T(
      () => l.target,
      () => {
        i.value !== null && r(), x();
      },
    ),
    T(
      () => l.noParentEvent,
      (d) => {
        i.value !== null && (d === !0 ? r() : o());
      },
    ),
    ee(() => {
      x(),
        n !== !0 &&
          l.modelValue === !0 &&
          i.value === null &&
          a('update:modelValue', !1);
    }),
    D(() => {
      u !== null && clearTimeout(u), r();
    }),
    { anchorEl: i, canShow: c, anchorEvents: s }
  );
}
function Bn(e, n) {
  const o = q(null);
  let l;
  function t(u, c) {
    const s = `${c !== void 0 ? 'add' : 'remove'}EventListener`,
      r = c !== void 0 ? c : l;
    u !== window && u[s]('scroll', r, oe.passive),
      window[s]('scroll', r, oe.passive),
      (l = c);
  }
  function a() {
    o.value !== null && (t(o.value), (o.value = null));
  }
  const i = T(
    () => e.noParentEvent,
    () => {
      o.value !== null && (a(), n());
    },
  );
  return (
    D(i),
    { localScrollTarget: o, unconfigureScrollTarget: a, changeScrollEvent: t }
  );
}
const { notPassiveCapture: Te } = oe,
  Z = [];
function Ce(e) {
  const n = e.target;
  if (
    n === void 0 ||
    n.nodeType === 8 ||
    n.classList.contains('no-pointer-events') === !0
  )
    return;
  let o = Ke.length - 1;
  for (; o >= 0; ) {
    const l = Ke[o].$;
    if (l.type.name === 'QTooltip') {
      o--;
      continue;
    }
    if (l.type.name !== 'QDialog') break;
    if (l.props.seamless !== !0) return;
    o--;
  }
  for (let l = Z.length - 1; l >= 0; l--) {
    const t = Z[l];
    if (
      (t.anchorEl.value === null || t.anchorEl.value.contains(n) === !1) &&
      (n === document.body ||
        (t.innerRef.value !== null && t.innerRef.value.contains(n) === !1))
    )
      (e.qClickOutside = !0), t.onClickOutside(e);
    else return;
  }
}
function Hn(e) {
  Z.push(e),
    Z.length === 1 &&
      (document.addEventListener('mousedown', Ce, Te),
      document.addEventListener('touchstart', Ce, Te));
}
function lt(e) {
  const n = Z.findIndex((o) => o === e);
  n !== -1 &&
    (Z.splice(n, 1),
    Z.length === 0 &&
      (document.removeEventListener('mousedown', Ce, Te),
      document.removeEventListener('touchstart', Ce, Te)));
}
let at, it;
function rt(e) {
  const n = e.split(' ');
  return n.length !== 2
    ? !1
    : ['top', 'center', 'bottom'].includes(n[0]) !== !0
      ? (console.error(
          'Anchor/Self position must start with one of top/center/bottom',
        ),
        !1)
      : ['left', 'middle', 'right', 'start', 'end'].includes(n[1]) !== !0
        ? (console.error(
            'Anchor/Self position must end with one of left/middle/right/start/end',
          ),
          !1)
        : !0;
}
function Pn(e) {
  return e
    ? !(e.length !== 2 || typeof e[0] != 'number' || typeof e[1] != 'number')
    : !0;
}
const Re = {
  'start#ltr': 'left',
  'start#rtl': 'right',
  'end#ltr': 'right',
  'end#rtl': 'left',
};
['left', 'middle', 'right'].forEach((e) => {
  (Re[`${e}#ltr`] = e), (Re[`${e}#rtl`] = e);
});
function ut(e, n) {
  const o = e.split(' ');
  return {
    vertical: o[0],
    horizontal: Re[`${o[1]}#${n === !0 ? 'rtl' : 'ltr'}`],
  };
}
function Wn(e, n) {
  let {
    top: o,
    left: l,
    right: t,
    bottom: a,
    width: i,
    height: u,
  } = e.getBoundingClientRect();
  return (
    n !== void 0 &&
      ((o -= n[1]),
      (l -= n[0]),
      (a += n[1]),
      (t += n[0]),
      (i += n[0]),
      (u += n[1])),
    {
      top: o,
      bottom: a,
      height: u,
      left: l,
      right: t,
      width: i,
      middle: l + (t - l) / 2,
      center: o + (a - o) / 2,
    }
  );
}
function Vn(e, n, o) {
  let { top: l, left: t } = e.getBoundingClientRect();
  return (
    (l += n.top),
    (t += n.left),
    o !== void 0 && ((l += o[1]), (t += o[0])),
    {
      top: l,
      bottom: l + 1,
      height: 1,
      left: t,
      right: t + 1,
      width: 1,
      middle: t,
      center: l,
    }
  );
}
function On(e, n) {
  return { top: 0, center: n / 2, bottom: n, left: 0, middle: e / 2, right: e };
}
function st(e, n, o, l) {
  return {
    top: e[o.vertical] - n[l.vertical],
    left: e[o.horizontal] - n[l.horizontal],
  };
}
function St(e, n = 0) {
  if (e.targetEl === null || e.anchorEl === null || n > 5) return;
  if (e.targetEl.offsetHeight === 0 || e.targetEl.offsetWidth === 0) {
    setTimeout(() => {
      St(e, n + 1);
    }, 10);
    return;
  }
  const {
    targetEl: o,
    offset: l,
    anchorEl: t,
    anchorOrigin: a,
    selfOrigin: i,
    absoluteOffset: u,
    fit: c,
    cover: s,
    maxHeight: r,
    maxWidth: b,
  } = e;
  if (te.is.ios === !0 && window.visualViewport !== void 0) {
    const z = document.body.style,
      { offsetLeft: S, offsetTop: B } = window.visualViewport;
    S !== at && (z.setProperty('--q-pe-left', S + 'px'), (at = S)),
      B !== it && (z.setProperty('--q-pe-top', B + 'px'), (it = B));
  }
  const { scrollLeft: x, scrollTop: d } = o,
    v = u === void 0 ? Wn(t, s === !0 ? [0, 0] : l) : Vn(t, u, l);
  Object.assign(o.style, {
    top: 0,
    left: 0,
    minWidth: null,
    minHeight: null,
    maxWidth: b || '100vw',
    maxHeight: r || '100vh',
    visibility: 'visible',
  });
  const { offsetWidth: _, offsetHeight: C } = o,
    { elWidth: w, elHeight: m } =
      c === !0 || s === !0
        ? {
            elWidth: Math.max(v.width, _),
            elHeight: s === !0 ? Math.max(v.height, C) : C,
          }
        : { elWidth: _, elHeight: C };
  let y = { maxWidth: b, maxHeight: r };
  (c === !0 || s === !0) &&
    ((y.minWidth = v.width + 'px'),
    s === !0 && (y.minHeight = v.height + 'px')),
    Object.assign(o.style, y);
  const g = On(w, m);
  let p = st(v, g, a, i);
  if (u === void 0 || l === void 0) Oe(p, v, g, a, i);
  else {
    const { top: z, left: S } = p;
    Oe(p, v, g, a, i);
    let B = !1;
    if (p.top !== z) {
      B = !0;
      const E = 2 * l[1];
      (v.center = v.top -= E), (v.bottom -= E + 2);
    }
    if (p.left !== S) {
      B = !0;
      const E = 2 * l[0];
      (v.middle = v.left -= E), (v.right -= E + 2);
    }
    B === !0 && ((p = st(v, g, a, i)), Oe(p, v, g, a, i));
  }
  (y = { top: p.top + 'px', left: p.left + 'px' }),
    p.maxHeight !== void 0 &&
      ((y.maxHeight = p.maxHeight + 'px'),
      v.height > p.maxHeight && (y.minHeight = y.maxHeight)),
    p.maxWidth !== void 0 &&
      ((y.maxWidth = p.maxWidth + 'px'),
      v.width > p.maxWidth && (y.minWidth = y.maxWidth)),
    Object.assign(o.style, y),
    o.scrollTop !== d && (o.scrollTop = d),
    o.scrollLeft !== x && (o.scrollLeft = x);
}
function Oe(e, n, o, l, t) {
  const a = o.bottom,
    i = o.right,
    u = be(),
    c = window.innerHeight - u,
    s = document.body.clientWidth;
  if (e.top < 0 || e.top + a > c)
    if (t.vertical === 'center')
      (e.top = n[l.vertical] > c / 2 ? Math.max(0, c - a) : 0),
        (e.maxHeight = Math.min(a, c));
    else if (n[l.vertical] > c / 2) {
      const r = Math.min(
        c,
        l.vertical === 'center'
          ? n.center
          : l.vertical === t.vertical
            ? n.bottom
            : n.top,
      );
      (e.maxHeight = Math.min(a, r)), (e.top = Math.max(0, r - a));
    } else
      (e.top = Math.max(
        0,
        l.vertical === 'center'
          ? n.center
          : l.vertical === t.vertical
            ? n.top
            : n.bottom,
      )),
        (e.maxHeight = Math.min(a, c - e.top));
  if (e.left < 0 || e.left + i > s)
    if (((e.maxWidth = Math.min(i, s)), t.horizontal === 'middle'))
      e.left = n[l.horizontal] > s / 2 ? Math.max(0, s - i) : 0;
    else if (n[l.horizontal] > s / 2) {
      const r = Math.min(
        s,
        l.horizontal === 'middle'
          ? n.middle
          : l.horizontal === t.horizontal
            ? n.right
            : n.left,
      );
      (e.maxWidth = Math.min(i, r)), (e.left = Math.max(0, r - e.maxWidth));
    } else
      (e.left = Math.max(
        0,
        l.horizontal === 'middle'
          ? n.middle
          : l.horizontal === t.horizontal
            ? n.left
            : n.right,
      )),
        (e.maxWidth = Math.min(i, s - e.left));
}
const An = j({
    name: 'QTooltip',
    inheritAttrs: !1,
    props: {
      ...Mn,
      ...gt,
      ...Kt,
      maxHeight: { type: String, default: null },
      maxWidth: { type: String, default: null },
      transitionShow: { default: 'jump-down' },
      transitionHide: { default: 'jump-up' },
      anchor: { type: String, default: 'bottom middle', validator: rt },
      self: { type: String, default: 'top middle', validator: rt },
      offset: { type: Array, default: () => [14, 14], validator: Pn },
      scrollTarget: { default: void 0 },
      delay: { type: Number, default: 0 },
      hideDelay: { type: Number, default: 0 },
      persistent: Boolean,
    },
    emits: [...pt],
    setup(e, { slots: n, emit: o, attrs: l }) {
      let t, a;
      const i = I(),
        {
          proxy: { $q: u },
        } = i,
        c = q(null),
        s = q(!1),
        r = h(() => ut(e.anchor, u.lang.rtl)),
        b = h(() => ut(e.self, u.lang.rtl)),
        x = h(() => e.persistent !== !0),
        { registerTick: d, removeTick: v } = Gt(),
        { registerTimeout: _ } = yt(),
        { transitionProps: C, transitionStyle: w } = Jt(e),
        {
          localScrollTarget: m,
          changeScrollEvent: y,
          unconfigureScrollTarget: g,
        } = Bn(e, me),
        {
          anchorEl: p,
          canShow: z,
          anchorEvents: S,
        } = $n({ showing: s, configureAnchorEl: G }),
        { show: B, hide: E } = bt({
          showing: s,
          canShow: z,
          handleShow: U,
          handleHide: le,
          hideOnRouteChange: x,
          processOnMount: !0,
        });
      Object.assign(S, { delayShow: ie, delayHide: re });
      const {
        showPortal: W,
        hidePortal: R,
        renderPortal: he,
      } = Zt(i, c, ze, 'tooltip');
      if (u.platform.is.mobile === !0) {
        const M = {
            anchorEl: p,
            innerRef: c,
            onClickOutside(Q) {
              return (
                E(Q),
                Q.target.classList.contains('q-dialog__backdrop') && mt(Q),
                !0
              );
            },
          },
          ue = h(
            () =>
              e.modelValue === null && e.persistent !== !0 && s.value === !0,
          );
        T(ue, (Q) => {
          (Q === !0 ? Hn : lt)(M);
        }),
          D(() => {
            lt(M);
          });
      }
      function U(M) {
        W(),
          d(() => {
            (a = new MutationObserver(() => A())),
              a.observe(c.value, {
                attributes: !1,
                childList: !0,
                characterData: !0,
                subtree: !0,
              }),
              A(),
              me();
          }),
          t === void 0 &&
            (t = T(
              () =>
                u.screen.width +
                '|' +
                u.screen.height +
                '|' +
                e.self +
                '|' +
                e.anchor +
                '|' +
                u.lang.rtl,
              A,
            )),
          _(() => {
            W(!0), o('show', M);
          }, e.transitionDuration);
      }
      function le(M) {
        v(),
          R(),
          ae(),
          _(() => {
            R(!0), o('hide', M);
          }, e.transitionDuration);
      }
      function ae() {
        a !== void 0 && (a.disconnect(), (a = void 0)),
          t !== void 0 && (t(), (t = void 0)),
          g(),
          ne(S, 'tooltipTemp');
      }
      function A() {
        St({
          targetEl: c.value,
          offset: e.offset,
          anchorEl: p.value,
          anchorOrigin: r.value,
          selfOrigin: b.value,
          maxHeight: e.maxHeight,
          maxWidth: e.maxWidth,
        });
      }
      function ie(M) {
        if (u.platform.is.mobile === !0) {
          ke(), document.body.classList.add('non-selectable');
          const ue = p.value,
            Q = ['touchmove', 'touchcancel', 'touchend', 'click'].map((ge) => [
              ue,
              ge,
              'delayHide',
              'passiveCapture',
            ]);
          K(S, 'tooltipTemp', Q);
        }
        _(() => {
          B(M);
        }, e.delay);
      }
      function re(M) {
        u.platform.is.mobile === !0 &&
          (ne(S, 'tooltipTemp'),
          ke(),
          setTimeout(() => {
            document.body.classList.remove('non-selectable');
          }, 10)),
          _(() => {
            E(M);
          }, e.hideDelay);
      }
      function G() {
        if (e.noParentEvent === !0 || p.value === null) return;
        const M =
          u.platform.is.mobile === !0
            ? [[p.value, 'touchstart', 'delayShow', 'passive']]
            : [
                [p.value, 'mouseenter', 'delayShow', 'passive'],
                [p.value, 'mouseleave', 'delayHide', 'passive'],
              ];
        K(S, 'anchor', M);
      }
      function me() {
        if (p.value !== null || e.scrollTarget !== void 0) {
          m.value = xt(p.value, e.scrollTarget);
          const M = e.noParentEvent === !0 ? A : E;
          y(m.value, M);
        }
      }
      function _e() {
        return s.value === !0
          ? L(
              'div',
              {
                ...l,
                ref: c,
                class: [
                  'q-tooltip q-tooltip--style q-position-engine no-pointer-events',
                  l.class,
                ],
                style: [l.style, w.value],
                role: 'tooltip',
              },
              fe(n.default),
            )
          : null;
      }
      function ze() {
        return L(en, C.value, _e);
      }
      return D(ae), Object.assign(i.proxy, { updatePosition: A }), he;
    },
  }),
  Dn = {};
function jn(e, n) {
  return (
    O(),
    F(
      nn,
      {
        flat: '',
        dense: '',
        round: '',
        size: 'lg',
        color: 'primary-100',
        icon: 'eva-alert-triangle',
      },
      { default: P(() => [tn(e.$slots, 'default')]), _: 3 },
    )
  );
}
const qt = ve(Dn, [
    ['render', jn],
    ['__file', 'ToolbarButton.vue'],
  ]),
  Rn = qe({
    __name: 'FeedbackButton',
    setup(e) {
      const n = Ne(),
        o = on();
      function l() {
        o.push('/feedback');
      }
      return (t, a) => (
        O(),
        F(
          qt,
          {
            icon: 'eva-message-square',
            onClick: l,
            'aria-label': 'Open feedback form',
          },
          {
            default: P(() => [
              ln(n).screen.xs
                ? J('', !0)
                : (O(),
                  F(
                    An,
                    { key: 0, anchor: 'center left', self: 'center right' },
                    { default: P(() => [an('Send feedback.')]), _: 1 },
                  )),
            ]),
            _: 1,
          },
        )
      );
    },
  }),
  ct = ve(Rn, [['__file', 'FeedbackButton.vue']]),
  dt = 'eva-menu-outline',
  ft = 'eva-menu-arrow',
  Qn = qe({
    __name: 'MenuButton',
    props: rn(
      {
        side: { default: 'left' },
        function: { default: 'both' },
        mobile: { type: Boolean, default: !1 },
        desktop: { type: Boolean, default: !1 },
      },
      { modelValue: {}, modelModifiers: {} },
    ),
    emits: ['update:modelValue'],
    setup(e) {
      const n = un(e, 'modelValue'),
        o = e,
        l = Ne(),
        t = h(() => l.screen.xs),
        a = h(() => (n.value ? 'primary-300' : 'primary-100')),
        i = h(() => (n.value ? 'close menu' : 'open menu')),
        u = h(() =>
          o.function == 'open'
            ? dt
            : o.function == 'close' || n.value
              ? ft
              : dt,
        ),
        c = h(() =>
          (!o.mobile && !o.desktop) || (o.mobile && t.value)
            ? !0
            : !!(o.desktop && !t.value),
        );
      return (s, r) =>
        c.value
          ? (O(),
            F(
              qt,
              {
                key: 0,
                color: a.value,
                icon: u.value,
                style: kt(o.side == 'right' ? 'transform: rotate(180deg)' : ''),
                'aria-label': i.value,
                onClick: r[0] || (r[0] = (b) => (n.value = !n.value)),
              },
              null,
              8,
              ['color', 'icon', 'style', 'aria-label'],
            ))
          : J('', !0);
    },
  }),
  Ae = ve(Qn, [['__file', 'MenuButton.vue']]),
  Fn = { class: 'text-h4' },
  Nn = { key: 0, class: 'text-black text-weight-medium' },
  In = qe({
    __name: 'WodoreLogo',
    props: {
      icon: { type: Boolean, default: !1 },
      text: { type: Boolean, default: !1 },
      textColorLeft: { default: 'black' },
      textColorRight: { default: 'accent' },
      logoPath: { default: '/logos/wodore_mobile.svg' },
    },
    setup(e) {
      const n = e,
        o = h(() => (!n.icon && !n.text ? !0 : n.icon)),
        l = h(() => (!n.icon && !n.text ? !0 : n.text));
      return (t, a) => (
        O(),
        Pe('span', Fn, [
          l.value ? (O(), Pe('span', Nn, 'wo')) : J('', !0),
          o.value
            ? (O(),
              F(
                sn,
                {
                  key: 1,
                  style: { transform: 'translateY(-4px)' },
                  name: 'img:' + n.logoPath,
                },
                null,
                8,
                ['name'],
              ))
            : J('', !0),
          l.value
            ? (O(),
              Pe(
                'span',
                {
                  key: 2,
                  style: kt({ 'margin-left': n.icon ? 0 : '3pt' }),
                  class: 'text-accent text-weight-regular',
                },
                'dore',
                4,
              ))
            : J('', !0),
        ])
      );
    },
  }),
  vt = ve(In, [['__file', 'WodoreLogo.vue']]),
  Un = qe({
    __name: 'MainLayout',
    setup(e) {
      const n = Ne();
      function o(u) {
        return !/^.*timetable.search.ch.*/.test(u);
      }
      const l = h(() => n.screen.xs),
        t = q(!1),
        a = q(!1),
        i = cn();
      return (
        dn(() => {
          a.value = i.meta?.dialog;
        }),
        (u, c) => {
          const s = fn('router-view');
          return (
            O(),
            F(
              En,
              { view: 'hHh LpR fFf' },
              {
                default: P(() => [
                  $(wn, { color: 'accent', 'hijack-filter': o }),
                  $(
                    kn,
                    { class: 'text-white shadow-6 app-header' },
                    {
                      default: P(() => [
                        $(Je, null, {
                          default: P(() => [
                            $(
                              Ae,
                              {
                                desktop: '',
                                modelValue: t.value,
                                'onUpdate:modelValue':
                                  c[0] || (c[0] = (r) => (t.value = r)),
                              },
                              null,
                              8,
                              ['modelValue'],
                            ),
                            $(Ge, null, {
                              default: P(() => [
                                $(
                                  vt,
                                  {
                                    class: 'text-h4',
                                    text: !l.value,
                                    icon: '',
                                  },
                                  null,
                                  8,
                                  ['text'],
                                ),
                              ]),
                              _: 1,
                            }),
                            l.value ? J('', !0) : (O(), F(ct, { key: 0 })),
                            $(
                              vn,
                              {
                                modelValue: a.value,
                                'onUpdate:modelValue':
                                  c[1] || (c[1] = (r) => (a.value = r)),
                                'no-backdrop-dismiss': '',
                                persistent: '',
                                maximized: l.value,
                                'backdrop-filter':
                                  'blur(3px) saturate(180%) grayscale(60%)',
                              },
                              {
                                default: P(() => [
                                  $(
                                    s,
                                    { name: 'dialog' },
                                    {
                                      default: P(({ Component: r }) => [
                                        (O(), F(hn(r))),
                                      ]),
                                      _: 1,
                                    },
                                  ),
                                ]),
                                _: 1,
                              },
                              8,
                              ['modelValue', 'maximized'],
                            ),
                            $(
                              Ae,
                              {
                                mobile: '',
                                function: 'open',
                                side: 'right',
                                modelValue: t.value,
                                'onUpdate:modelValue':
                                  c[2] || (c[2] = (r) => (t.value = r)),
                              },
                              null,
                              8,
                              ['modelValue'],
                            ),
                          ]),
                          _: 1,
                        }),
                      ]),
                      _: 1,
                    },
                  ),
                  $(
                    qn,
                    {
                      modelValue: t.value,
                      'onUpdate:modelValue':
                        c[4] || (c[4] = (r) => (t.value = r)),
                      side: l.value ? 'right' : 'left',
                      width: 200,
                      breakpoint: 610,
                      class: 'shadow-2',
                    },
                    {
                      default: P(() => [
                        l.value
                          ? (O(),
                            F(
                              Je,
                              { key: 0, class: 'bg-primary-600' },
                              {
                                default: P(() => [
                                  $(Ge, null, {
                                    default: P(() => [
                                      $(vt, { text: '', class: 'text-h5' }),
                                    ]),
                                    _: 1,
                                  }),
                                  $(ct, { size: 'md' }),
                                  $(
                                    Ae,
                                    {
                                      mobile: '',
                                      side: 'right',
                                      modelValue: t.value,
                                      'onUpdate:modelValue':
                                        c[3] || (c[3] = (r) => (t.value = r)),
                                    },
                                    null,
                                    8,
                                    ['modelValue'],
                                  ),
                                ]),
                                _: 1,
                              },
                            ))
                          : J('', !0),
                        $(s, { name: 'menu' }),
                      ]),
                      _: 1,
                    },
                    8,
                    ['modelValue', 'side'],
                  ),
                  $(_n, null, { default: P(() => [$(s)]), _: 1 }),
                ]),
                _: 1,
              },
            )
          );
        }
      );
    },
  }),
  Gn = ve(Un, [['__file', 'MainLayout.vue']]);
export { Gn as default };
