<script setup lang="ts">
defineOptions({
  name: 'DataPolicy',
});
</script>

<template>
  <div class="bg-dark fullscreen">
    <q-card
      class="bg-primary dialog-radius text-white text-left scroll q-ma-xl shadow-4"
      style="max-width: 880px; height: calc(100% - 100px)"
    >
      <q-scroll-area style="height: 101%" class="q-px-md">
        <h5 class="text-accent">{{ $t('data_policy.title') }}</h5>

        <p>
          <strong>{{ $t('data_policy.last_updated') }}</strong>
          {{ $t('data_policy.last_updated_date') }}
        </p>

        <h6>{{ $t('data_policy.summary') }}</h6>
        <div class="text-body2">
          <p>
            <strong>{{ $t('data_policy.summary_processing') }}</strong>
            {{ $t('data_policy.summary_processing_text') }}
          </p>

          <p>
            <strong>{{ $t('data_policy.summary_sharing') }}</strong>
            {{ $t('data_policy.summary_sharing_text') }}
          </p>

          <p>
            <strong>{{ $t('data_policy.summary_providers') }}</strong>
            {{ $t('data_policy.summary_providers_text') }}
          </p>

          <p>
            <strong>{{ $t('data_policy.summary_rights') }}</strong>
            {{ $t('data_policy.summary_rights_text') }}
          </p>

          <p>{{ $t('data_policy.summary_more') }}</p>
        </div>

        <hr class="q-my-xl" />
        <div class="text-body3">
          <p>
            <i18n-t keypath="data_policy.intro" tag="span">
              <template #link>
                <a href="https://wodore.com">wodore.com</a>
              </template>
            </i18n-t>
          </p>

          <h6>{{ $t('data_policy.s1') }}</h6>
          <ul>
            <li>
              <strong>{{ $t('data_policy.s1_personal_data') }}</strong>
              {{ $t('data_policy.s1_personal_data_text') }}
            </li>
            <li>
              <strong>{{ $t('data_policy.s1_cookies') }}</strong>
              {{ $t('data_policy.s1_cookies_text') }}
            </li>
            <li>
              <strong>{{ $t('data_policy.s1_providers') }}</strong>
              {{ $t('data_policy.s1_providers_text') }}
            </li>
          </ul>

          <h6>{{ $t('data_policy.s2') }}</h6>
          <p>
            <strong>{{ $t('data_policy.s2_cookies') }}</strong>
            {{ $t('data_policy.s2_cookies_text') }}
          </p>

          <p>
            <strong>{{ $t('data_policy.s2_tracking') }}</strong>
            <i18n-t keypath="data_policy.s2_tracking_text" tag="span">
              <template #link>
                <a href="https://umami.is/">Umami</a>
              </template>
            </i18n-t>
          </p>

          <h6>{{ $t('data_policy.s3') }}</h6>
          <p>{{ $t('data_policy.s3_text') }}</p>

          <h6>{{ $t('data_policy.s4') }}</h6>
          <p>{{ $t('data_policy.s4_intro') }}</p>
          <ul>
            <li>
              <strong>{{ $t('data_policy.s4_cloudinary') }}</strong>
              <i18n-t keypath="data_policy.s4_cloudinary_text" tag="span">
                <template #link>
                  <a href="https://cloudinary.com/">{{ $t('data_policy.s4_cloudinary_link') }}</a>
                </template>
              </i18n-t>
            </li>
            <li>
              <strong>{{ $t('data_policy.s4_infomaniak') }}</strong>
              <i18n-t keypath="data_policy.s4_infomaniak_text" tag="span">
                <template #link>
                  <a href="https://www.infomaniak.com/">{{
                    $t('data_policy.s4_infomaniak_link')
                  }}</a>
                </template>
              </i18n-t>
            </li>
            <li>
              <strong>{{ $t('data_policy.s4_zitadel') }}</strong>
              <i18n-t keypath="data_policy.s4_zitadel_text" tag="span">
                <template #link>
                  <a href="https://zitadel.com/">Zitadel</a>
                </template>
              </i18n-t>
            </li>
            <li>
              <strong>{{ $t('data_policy.s4_stripe') }}</strong>
              <i18n-t keypath="data_policy.s4_stripe_text" tag="span">
                <template #link>
                  <a href="https://stripe.com/">{{ $t('data_policy.s4_stripe_link') }}</a>
                </template>
              </i18n-t>
            </li>
          </ul>

          <h6>{{ $t('data_policy.s5') }}</h6>
          <p>
            <i18n-t keypath="data_policy.s5_text" tag="span">
              <template #link>
                <a href="mailto:tb@wodore.com">tb@wodore.com</a>
              </template>
            </i18n-t>
          </p>

          <h6>{{ $t('data_policy.s6') }}</h6>
          <p>{{ $t('data_policy.s6_text') }}</p>

          <h6>{{ $t('data_policy.s7') }}</h6>
          <p>{{ $t('data_policy.s7_text') }}</p>

          <h6>{{ $t('data_policy.s8') }}</h6>
          <p>{{ $t('data_policy.s8_text') }}</p>
          <p>
            {{ $t('data_policy.email') }}
            <a href="mailto:tb@wodore.com">tb@wodore.com</a>
          </p>

          <p class="q-pb-xl q-mt-lg text-body1">{{ $t('data_policy.closing') }}</p>
        </div>
      </q-scroll-area>
    </q-card>
  </div>
</template>
