import { acceptHMRUpdate, defineStore } from 'pinia';
import { User } from 'oidc-client-ts';

import { computed, ref } from 'vue';

import { sha256 } from 'js-sha256';
//import { clientWodore } from '@clients/index';

function getGravatarURL(email: string) {
  // Trim leading and trailing whitespace from
  // an email address and force all characters
  // to lower case
  const address = String(email).trim().toLowerCase();

  // Create a SHA256 hash of the final string
  const hash = sha256(address);

  // Grab the actual image URL
  return `https://www.gravatar.com/avatar/${hash}?d=robohash`;
}
export const useAuthStore = defineStore('auth', () => {
  const authUser = ref<User | undefined>(undefined);

  const tenantId = ref<string | undefined>(undefined);

  const access_token = computed(() => authUser.value?.access_token ?? '');

  const profile = computed(() => authUser.value?.profile);
  const avatar = computed(() => {
    let pix: string;
    if (authUser.value?.profile.picture) {
      pix = authUser.value?.profile.picture;
    } else if (authUser.value?.profile.email) {
      pix = getGravatarURL(authUser.value?.profile.email);
    } else {
      pix = getGravatarURL('anonymous');
    }
    return pix;
  });

  const isLoggedIn = computed(() => !!authUser.value);

  const setUpUserCredentials = (user: User) => {
    authUser.value = user;
    //if (clientWodore.HEADERS) {
    //  OpenAPI.HEADERS['Authorization'] = `Bearer ${access_token.value}`;
    //} else {
    //  OpenAPI.HEADERS = { Authorization: `Bearer ${access_token.value}` };
    //}
  };

  const clearUserSession = () => {
    authUser.value = undefined;
    //if (OpenAPI.HEADERS && 'Authorization' in OpenAPI.HEADERS) {
    //  delete OpenAPI.HEADERS['Authorization'];
    //}
  };

  function hasRole(role: string, needs_root?: boolean | undefined) {
    //const roles = authUser.value?.profile[`urn:zitadel:iam:org:project:${zitadelConfig.project_resource_id}:roles`] as Array<any>
    let roles: Array<string>;
    if (
      authUser.value &&
      'urn:zitadel:iam:org:project:roles' in authUser.value?.profile
    ) {
      roles = Object.keys(
        (
          authUser.value?.profile as unknown as {
            'urn:zitadel:iam:org:project:roles': { string: unknown };
          }
        )['urn:zitadel:iam:org:project:roles'],
      );
    } else {
      return false;
    }
    if (
      (roles.includes('group:admin') && needs_root == undefined) ||
      roles.includes('group:root')
    ) {
      return true;
    }
    console.log('Roles:', roles);
    return roles.includes(role);
  }

  return {
    hasRole,
    avatar,
    profile,
    authUser,
    access_token,
    isLoggedIn,
    tenantId,
    setUpUserCredentials,
    clearUserSession,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
