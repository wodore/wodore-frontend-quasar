import {
  k as C,
  c as v,
  h as y,
  m as L,
  K as S,
  ay as j,
  g as I,
  M,
  az as O,
  r as B,
  a1 as P,
  I as F,
  v as V,
  d as W,
  a9 as r,
  aa as c,
  ab as l,
  R as f,
  f as n,
  am as m,
  ag as b,
  aA as z,
  aB as k,
  a8 as H,
} from './index-DAawzX9R.js';
const i = C({
    name: 'QItemSection',
    props: {
      avatar: Boolean,
      thumbnail: Boolean,
      side: Boolean,
      top: Boolean,
      noWrap: Boolean,
    },
    setup(e, { slots: a }) {
      const o = v(
        () =>
          `q-item__section column q-item__section--${e.avatar === !0 || e.side === !0 || e.thumbnail === !0 ? 'side' : 'main'}` +
          (e.top === !0
            ? ' q-item__section--top justify-start'
            : ' justify-center') +
          (e.avatar === !0 ? ' q-item__section--avatar' : '') +
          (e.thumbnail === !0 ? ' q-item__section--thumbnail' : '') +
          (e.noWrap === !0 ? ' q-item__section--nowrap' : ''),
      );
      return () => y('div', { class: o.value }, L(a.default));
    },
  }),
  q = C({
    name: 'QItem',
    props: {
      ...S,
      ...j,
      tag: { type: String, default: 'div' },
      active: { type: Boolean, default: null },
      clickable: Boolean,
      dense: Boolean,
      insetLevel: Number,
      tabindex: [String, Number],
      focused: Boolean,
      manualFocus: Boolean,
    },
    emits: ['click', 'keyup'],
    setup(e, { slots: a, emit: o }) {
      const {
          proxy: { $q: u },
        } = I(),
        s = M(e, u),
        {
          hasLink: h,
          linkAttrs: Q,
          linkClass: w,
          linkTag: E,
          navigateOnClick: R,
        } = O(),
        g = B(null),
        x = B(null),
        p = v(() => e.clickable === !0 || h.value === !0 || e.tag === 'label'),
        d = v(() => e.disable !== !0 && p.value === !0),
        K = v(
          () =>
            'q-item q-item-type row no-wrap' +
            (e.dense === !0 ? ' q-item--dense' : '') +
            (s.value === !0 ? ' q-item--dark' : '') +
            (h.value === !0 && e.active === null
              ? w.value
              : e.active === !0
                ? ` q-item--active${e.activeClass !== void 0 ? ` ${e.activeClass}` : ''}`
                : '') +
            (e.disable === !0 ? ' disabled' : '') +
            (d.value === !0
              ? ' q-item--clickable q-link cursor-pointer ' +
                (e.manualFocus === !0
                  ? 'q-manual-focusable'
                  : 'q-focusable q-hoverable') +
                (e.focused === !0 ? ' q-manual-focusable--focused' : '')
              : ''),
        ),
        D = v(() =>
          e.insetLevel === void 0
            ? null
            : {
                ['padding' + (u.lang.rtl === !0 ? 'Right' : 'Left')]:
                  16 + e.insetLevel * 56 + 'px',
              },
        );
      function A(t) {
        d.value === !0 &&
          (x.value !== null &&
            (t.qKeyEvent !== !0 && document.activeElement === g.value
              ? x.value.focus()
              : document.activeElement === x.value && g.value.focus()),
          R(t));
      }
      function N(t) {
        if (d.value === !0 && P(t, [13, 32]) === !0) {
          F(t), (t.qKeyEvent = !0);
          const $ = new MouseEvent('click', t);
          ($.qKeyEvent = !0), g.value.dispatchEvent($);
        }
        o('keyup', t);
      }
      function T() {
        const t = V(a.default, []);
        return (
          d.value === !0 &&
            t.unshift(
              y('div', { class: 'q-focus-helper', tabindex: -1, ref: x }),
            ),
          t
        );
      }
      return () => {
        const t = {
          ref: g,
          class: K.value,
          style: D.value,
          role: 'listitem',
          onClick: A,
          onKeyup: N,
        };
        return (
          d.value === !0
            ? ((t.tabindex = e.tabindex || '0'), Object.assign(t, Q.value))
            : p.value === !0 && (t['aria-disabled'] = 'true'),
          y(E.value, t, T())
        );
      };
    },
  }),
  U = C({
    name: 'QList',
    props: {
      ...S,
      bordered: Boolean,
      dense: Boolean,
      separator: Boolean,
      padding: Boolean,
      tag: { type: String, default: 'div' },
    },
    setup(e, { slots: a }) {
      const o = I(),
        u = M(e, o.proxy.$q),
        s = v(
          () =>
            'q-list' +
            (e.bordered === !0 ? ' q-list--bordered' : '') +
            (e.dense === !0 ? ' q-list--dense' : '') +
            (e.separator === !0 ? ' q-list--separator' : '') +
            (u.value === !0 ? ' q-list--dark' : '') +
            (e.padding === !0 ? ' q-list--padding' : ''),
        );
      return () => y(e.tag, { class: s.value }, L(a.default));
    },
  }),
  _ = 'bg-accent text-white',
  G = W({
    __name: 'MapMenu',
    setup(e) {
      const a = B('outbox');
      return (o, u) => (
        r(),
        c(
          U,
          { bordered: '', padding: '', class: 'rounded-borders text-primary' },
          {
            default: l(() => [
              f(
                (r(),
                c(
                  q,
                  {
                    clickable: '',
                    active: a.value === 'inbox',
                    onClick: u[0] || (u[0] = (s) => (a.value = 'inbox')),
                    'active-class': _,
                  },
                  {
                    default: l(() => [
                      n(
                        i,
                        { avatar: '' },
                        {
                          default: l(() => [n(m, { name: 'eva-inbox' })]),
                          _: 1,
                        },
                      ),
                      n(i, null, { default: l(() => [b('Inbox')]), _: 1 }),
                    ]),
                    _: 1,
                  },
                  8,
                  ['active'],
                )),
                [[k]],
              ),
              f(
                (r(),
                c(
                  q,
                  {
                    clickable: '',
                    active: a.value === 'outbox',
                    onClick: u[1] || (u[1] = (s) => (a.value = 'outbox')),
                    'active-class': _,
                  },
                  {
                    default: l(() => [
                      n(
                        i,
                        { avatar: '' },
                        {
                          default: l(() => [n(m, { name: 'eva-paper-plane' })]),
                          _: 1,
                        },
                      ),
                      n(i, null, { default: l(() => [b('Outbox')]), _: 1 }),
                    ]),
                    _: 1,
                  },
                  8,
                  ['active'],
                )),
                [[k]],
              ),
              f(
                (r(),
                c(
                  q,
                  {
                    clickable: '',
                    active: a.value === 'trash',
                    onClick: u[2] || (u[2] = (s) => (a.value = 'trash')),
                    'active-class': _,
                  },
                  {
                    default: l(() => [
                      n(
                        i,
                        { avatar: '' },
                        {
                          default: l(() => [n(m, { name: 'eva-trash' })]),
                          _: 1,
                        },
                      ),
                      n(i, null, { default: l(() => [b('Trash')]), _: 1 }),
                    ]),
                    _: 1,
                  },
                  8,
                  ['active'],
                )),
                [[k]],
              ),
              n(z, { spaced: '' }),
              f(
                (r(),
                c(
                  q,
                  {
                    clickable: '',
                    active: a.value === 'settings',
                    onClick: u[3] || (u[3] = (s) => (a.value = 'settings')),
                    'active-class': _,
                  },
                  {
                    default: l(() => [
                      n(
                        i,
                        { avatar: '' },
                        {
                          default: l(() => [n(m, { name: 'eva-settings' })]),
                          _: 1,
                        },
                      ),
                      n(i, null, { default: l(() => [b('Settings')]), _: 1 }),
                    ]),
                    _: 1,
                  },
                  8,
                  ['active'],
                )),
                [[k]],
              ),
              f(
                (r(),
                c(
                  q,
                  {
                    clickable: '',
                    active: a.value === 'help',
                    onClick: u[4] || (u[4] = (s) => (a.value = 'help')),
                    'active-class': _,
                  },
                  {
                    default: l(() => [
                      n(
                        i,
                        { avatar: '' },
                        {
                          default: l(() => [
                            n(m, { name: 'eva-question-mark-circle' }),
                          ]),
                          _: 1,
                        },
                      ),
                      n(i, null, { default: l(() => [b('Help')]), _: 1 }),
                    ]),
                    _: 1,
                  },
                  8,
                  ['active'],
                )),
                [[k]],
              ),
            ]),
            _: 1,
          },
        )
      );
    },
  }),
  X = H(G, [['__file', 'MapMenu.vue']]);
export { X as default };
