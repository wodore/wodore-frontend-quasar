import VueStripeCheckout from '@vue-stripe/vue-stripe';
import { boot } from 'quasar/wrappers';

export default boot(({ app }) => {
  app.component('VueStripeCheckout', VueStripeCheckout);
});
