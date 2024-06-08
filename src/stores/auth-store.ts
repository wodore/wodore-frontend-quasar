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
  const email = computed(() => authUser.value?.profile.email);
  const name = computed(() => authUser.value?.profile.name);

  const setUpUserCredentials = (user: User) => {
    authUser.value = user;
    //if (clientWodore.HEADERS) {
    //  OpenAPI.HEADERS['Authorization'] = `Bearer ${access_token.value}`;
    //} else {
    //  OpenAPI.HEADERS = { Authorization: `Bearer ${access_token.value}` };
    //}
  };
  const roles = computed<Array<string>>(() => {
    if (
      authUser.value &&
      'urn:zitadel:iam:org:project:roles' in authUser.value?.profile
    ) {
      const keys = Object.keys(
        (
          authUser.value?.profile as unknown as {
            'urn:zitadel:iam:org:project:roles': { string: unknown };
          }
        )['urn:zitadel:iam:org:project:roles'],
      );
      return keys;
    }
    return [];
  });

  const rolesFilter = function (prefix: string, delimiter: string = ':') {
    return roles.value
      .filter((v: string) => v.startsWith(`${prefix}${delimiter}`))
      .map((v: string) => v.replace(`${prefix}${delimiter}`, ''));
  };
  const groups = computed<Array<string>>(() => {
    return rolesFilter('group');
  });
  const permissions = computed<Array<string>>(() => {
    return rolesFilter('perm');
  });

  const clearUserSession = () => {
    authUser.value = undefined;
    //if (OpenAPI.HEADERS && 'Authorization' in OpenAPI.HEADERS) {
    //  delete OpenAPI.HEADERS['Authorization'];
    //}
  };

  function hasRole(role: string, needs_root?: boolean | undefined) {
    //const roles = authUser.value?.profile[`urn:zitadel:iam:org:project:${zitadelConfig.project_resource_id}:roles`] as Array<any>
    if (
      (roles.value.includes('group:admin') && needs_root == undefined) ||
      roles.value.includes('group:root')
    ) {
      return true;
    }
    //console.log('Roles:', roles);
    return roles.value.includes(role);
  }

  function isAdmin(needs_root?: boolean) {
    return hasRole('admin', needs_root);
  }

  function isEditor() {
    return hasRole('editor');
  }

  return {
    hasRole,
    isAdmin,
    isEditor,
    email,
    name,
    roles,
    groups,
    permissions,
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
