import {
  User,
  UserManager,
  //WebStorageStateStore,
  UserManagerSettings,
  PopupWindowFeatures,
} from 'oidc-client-ts';

import { useAuthStore } from '@stores/auth-store';
const authStore = useAuthStore();
export default class AuthService {
  userManager: UserManager;

  constructor() {
    const settings: UserManagerSettings = {
      authority: process.env.WODORE_OICD_ISSUER_URL as string,
      client_id: process.env.WODORE_OICD_CLIENT_ID as string,
      redirect_uri: `${window.location.origin}/auth/signin-callback`,
      silent_redirect_uri: `${window.location.origin}/auth/signin-callback`,
      popup_redirect_uri: `${window.location.origin}/auth/signin-callback`,
      post_logout_redirect_uri: `${window.location.origin}/`,
      response_type: 'code',
      scope:
        'openid profile email offline_access' +
        ` urn:zitadel:iam:org:project:id:${process.env.WODORE_OICD_RESOURCE_ID as string}:aud` +
        ' urn:zitadel:iam:org:projects:roles',
      //userStore: new WebStorageStateStore(),
      loadUserInfo: true,
      automaticSilentRenew: true,
      popupWindowFeatures: <PopupWindowFeatures>{ width: 500, height: 700 },
    };
    this.userManager = new UserManager(settings);
    // handle events
    this.userManager.events.addAccessTokenExpiring(function () {
      // eslint-disable-next-line no-console
      console.log('auth: access token expiring');
    });

    this.userManager.events.addAccessTokenExpired(function () {
      // eslint-disable-next-line no-console
      console.log('auth: access token expired');
    });

    this.userManager.events.addSilentRenewError(function (err: Error) {
      // eslint-disable-next-line no-console
      console.error('auth: silent renew error', err);
    });

    this.userManager.events.addUserLoaded(function (user: User) {
      // eslint-disable-next-line no-console
      console.log('auth: user loaded', user);
      authStore.setUpUserCredentials(user);
    });

    this.userManager.events.addUserUnloaded(function () {
      // eslint-disable-next-line no-console
      console.log('auth: user unloaded');
      authStore.clearUserSession();
    });

    this.userManager.events.addUserSignedOut(function () {
      // eslint-disable-next-line no-console
      console.log('auth: user signed out');
    });

    this.userManager.events.addUserSessionChanged(function () {
      // eslint-disable-next-line no-console
      console.log('auth: user session changed');
    });
  }

  public signinRedirect() {
    //return this.userManager.signinRedirect()
    return this.userManager.signinPopup();
  }

  public signinSilent() {
    return this.userManager.signinSilent();
  }

  public signinCallback() {
    return this.userManager.signinCallback();
  }

  public renewToken(): Promise<void> {
    return this.userManager.signinSilentCallback();
  }

  public logout(): Promise<void> {
    //return this.userManager.signoutRedirect()
    return this.userManager.signoutSilent();
  }

  public getUser(): Promise<User | null> {
    return this.userManager.getUser();
  }
}
