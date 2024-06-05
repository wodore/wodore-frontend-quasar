/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-393f077b'], (function (workbox) { 'use strict';

  workbox.setCacheNameDetails({
    prefix: "wodore"
  });
  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "apple-touch-icon-precomposed.png",
    "revision": "cd529aa0f2c1cfc2475b918b94e037c6"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "cd529aa0f2c1cfc2475b918b94e037c6"
  }, {
    "url": "assets/_commonjsHelpers-Dm6U3U_N.js",
    "revision": "13931a929c8031c3108c798ac3067f0e"
  }, {
    "url": "assets/basemap-switch-Dvj_H7Y5.svg",
    "revision": "1da71a23b708414d19f4203bf82b0edc"
  }, {
    "url": "assets/ErrorNotFound-CNBXLkzU.js",
    "revision": "ce195411850f6c5dee9df17bf98acaef"
  }, {
    "url": "assets/huts-store-B8KO_l-F.js",
    "revision": "4727b33685bcbd4d216141a046abb411"
  }, {
    "url": "assets/i18n-BT94wO9M.js",
    "revision": "0ecb50ad972a944820bdab729a8d3cb4"
  }, {
    "url": "assets/icons-BUPVpmkM.woff",
    "revision": "91da5eef431d01de8939a120c835ef40"
  }, {
    "url": "assets/icons-Cr_pNiRD.js",
    "revision": "fb7e12dce3d0cf85a93ee663a76d199e"
  }, {
    "url": "assets/icons-Dg7aT4_C.css",
    "revision": "649a77cec6382b79b9225ea8150f4eac"
  }, {
    "url": "assets/imageService-CRS5yRFk.js",
    "revision": "5561b360c6068059e7228c401ef8bdaf"
  }, {
    "url": "assets/index-BAtqSMr7.js",
    "revision": "8832939980deeee9b85741f3d39e6294"
  }, {
    "url": "assets/index-C3NVPFaO.css",
    "revision": "e0c11f95a330ff32ffb3b052837e800f"
  }, {
    "url": "assets/index-CAHSu7Ql.js",
    "revision": "39fe2efdd363d1ce24718888f6a3fd51"
  }, {
    "url": "assets/KFOkCnqEu92Fr1MmgVxIIzQ-C5u4Lasg.woff",
    "revision": "4aa2e69855e3b83110a251c47fdd05fc"
  }, {
    "url": "assets/KFOlCnqEu92Fr1MmEU9fBBc--j0ba7u44.woff",
    "revision": "40bcb2b8cc5ed94c4c21d06128e0e532"
  }, {
    "url": "assets/KFOlCnqEu92Fr1MmSU5fBBc--CDXAfhRl.woff",
    "revision": "ea60988be8d6faebb4bc2a55b1f76e22"
  }, {
    "url": "assets/KFOlCnqEu92Fr1MmWUlfBBc--7z0HfM8a.woff",
    "revision": "0774a8b7ca338dc1aba5a0ec8f2b9454"
  }, {
    "url": "assets/KFOlCnqEu92Fr1MmYUtfBBc--Yv75Cvt_.woff",
    "revision": "bcb7c7e2499a055f0e2f93203bdb282b"
  }, {
    "url": "assets/KFOmCnqEu92Fr1Mu4mxM-CEBEUyyq.woff",
    "revision": "d3907d0ccd03b1134c24d3bcaf05b698"
  }, {
    "url": "assets/MainLayout-CCJ6Wh4_.css",
    "revision": "9fc00c27fffe268c96ca5dc90af0b078"
  }, {
    "url": "assets/MainLayout-DVbL5rMH.js",
    "revision": "ff6121fa3af364b6ac5430c0d1f42769"
  }, {
    "url": "assets/maplibre-Be7W8Xq7.js",
    "revision": "91d781a2406812a6182b63cee1223524"
  }, {
    "url": "assets/MapPage-Bh3ogSiD.css",
    "revision": "e1aded8be9b761dbeeb50ba189c73143"
  }, {
    "url": "assets/MapPage-LUopmnON.js",
    "revision": "3939367948aac8b94fa8333b14723c02"
  }, {
    "url": "assets/oe-raster-EIpPqIBW.png",
    "revision": "008737d11cb11dc395a3d5e0fcf34129"
  }, {
    "url": "assets/outdoor-v2-BR_lxvv7.png",
    "revision": "4b016d9104739efc9dd18a97dc4679f1"
  }, {
    "url": "assets/QLayout-dy4ACE5e.js",
    "revision": "118700938d61a7dd083e9ceacda0e707"
  }, {
    "url": "assets/QPage-BWOFWlQo.js",
    "revision": "8425362bc26bce7c04afedab52719ab2"
  }, {
    "url": "assets/QScrollObserver-9xiBCqI1.js",
    "revision": "4aa8a5daedb75a423bc5b2e996b7fddf"
  }, {
    "url": "assets/QTooltip-H8kXt2o5.js",
    "revision": "803d31292bf25e79b2d119915896986c"
  }, {
    "url": "assets/roboto-condensed-latin-100-italic-B8YztFop.woff2",
    "revision": "74add308e1976bde1c0ffb71857d0066"
  }, {
    "url": "assets/roboto-condensed-latin-100-italic-DviscFjH.woff",
    "revision": "ba8ad0f10f5a89d6772ba5c6c0f375cc"
  }, {
    "url": "assets/roboto-condensed-latin-100-normal-azmTQChR.woff2",
    "revision": "e727757714a724042e92a98f919a75fc"
  }, {
    "url": "assets/roboto-condensed-latin-100-normal-Br_aQjGf.woff",
    "revision": "1cac8b1de07b95e0903f0e4842ee3652"
  }, {
    "url": "assets/roboto-condensed-latin-300-italic-CsvGKtb2.woff",
    "revision": "86ae00fc87d4e2666c375fb2703bc348"
  }, {
    "url": "assets/roboto-condensed-latin-300-italic-CzgWpwgK.woff2",
    "revision": "9c2ffe8140e6979fc5b515969fc75aba"
  }, {
    "url": "assets/roboto-condensed-latin-300-normal-BdAshyRr.woff",
    "revision": "b46f38286939d98f30f71b77156a9b48"
  }, {
    "url": "assets/roboto-condensed-latin-300-normal-DYQm8U_7.woff2",
    "revision": "9efceb3a8a0e9bd9abdab7d44014d1b0"
  }, {
    "url": "assets/roboto-condensed-latin-400-italic-CmGxDXCL.woff2",
    "revision": "d13d6196475b76919f11d3aad7dd2c4e"
  }, {
    "url": "assets/roboto-condensed-latin-400-italic-CnARbdGZ.woff",
    "revision": "3a2c26be04d4b11128c11944bd07a9c8"
  }, {
    "url": "assets/roboto-condensed-latin-400-normal-2z5Hy8vt.woff2",
    "revision": "e9d71ac5376b586cfde670f585b3251b"
  }, {
    "url": "assets/roboto-condensed-latin-400-normal-BHbOMXqm.woff",
    "revision": "c641368bdbf92b481f1901c52f3f6dec"
  }, {
    "url": "assets/roboto-condensed-latin-500-italic-BpA1VtnD.woff",
    "revision": "923bcfe8f049298a490e82e80818274e"
  }, {
    "url": "assets/roboto-condensed-latin-500-italic-C2CC4h4D.woff2",
    "revision": "92c0bbfc0538414aa67cb98027e63032"
  }, {
    "url": "assets/roboto-condensed-latin-500-normal-B97cYf1v.woff2",
    "revision": "7f2f094cbc3cce3510a96fe33b9472b8"
  }, {
    "url": "assets/roboto-condensed-latin-500-normal-D7rpB7O1.woff",
    "revision": "38783b01216973b2dafed2c10e3501a4"
  }, {
    "url": "assets/roboto-condensed-latin-700-italic-B_g8xPwT.woff2",
    "revision": "ce93791ecc05c8763598073a345b62bb"
  }, {
    "url": "assets/roboto-condensed-latin-700-italic-BXC_PecS.woff",
    "revision": "183767e2f7f7775e0d1576a876265e29"
  }, {
    "url": "assets/roboto-condensed-latin-700-normal-CJMZ0Ykc.woff2",
    "revision": "89e51a47e901bffba3df1acdaad7d6db"
  }, {
    "url": "assets/roboto-condensed-latin-700-normal-TUnq4f63.woff",
    "revision": "e7e3f8a1994648dcb419a5063cbd1554"
  }, {
    "url": "assets/roboto-condensed-latin-900-italic-BtyyHhh4.woff2",
    "revision": "54c487e73c467387794f3fd808289d3b"
  }, {
    "url": "assets/roboto-condensed-latin-900-italic-CHGbWHHn.woff",
    "revision": "0b4df3eabc913129999abb7f43bbc318"
  }, {
    "url": "assets/roboto-condensed-latin-900-normal-DP9b4O8G.woff2",
    "revision": "4c0179a8e404f4dac1ca4efce50d41ed"
  }, {
    "url": "assets/roboto-condensed-latin-900-normal-Dw0mDSqP.woff",
    "revision": "f1a874fa8faa3fc10febcb96e63fb81d"
  }, {
    "url": "assets/satellite-C2H1DPJ2.png",
    "revision": "12e37999789754776c5cc59e75ec4598"
  }, {
    "url": "assets/select_map-BPM0HDk0.png",
    "revision": "0edb3327e07ca7d1824834b9759ffcd1"
  }, {
    "url": "assets/swiss-raster-D1bEQQjo.png",
    "revision": "bcafeec924987bceae17d11686b2b149"
  }, {
    "url": "assets/swiss-vector-BQsQYbTX.png",
    "revision": "07b4db6ce2d7f1c1932d2ab5381d68c3"
  }, {
    "url": "assets/use-hydration-DGAnypCl.js",
    "revision": "f174a7cd4d37211fe7e1f4ee100198f7"
  }, {
    "url": "assets/use-quasar-dzbiZ5mn.js",
    "revision": "20eec4d8e5383c134fd7e3deb84a825e"
  }, {
    "url": "assets/vue-i18n.runtime-C_2yXRtR.js",
    "revision": "6e9ea30d09e23d23606000b3b08b2b9c"
  }, {
    "url": "assets/vue-maplibre-gl.es-ZH3R_aa8.js",
    "revision": "2f06ba5c77a608dbdae07df3264b78ba"
  }, {
    "url": "assets/vue-stripe-Cw59raJ5.js",
    "revision": "6e24843952f4637f80b700618219e6fa"
  }, {
    "url": "assets/WdFeedbackForm-DRQ0T8-C.css",
    "revision": "d8d05c041970cb837caf5edc86fcd096"
  }, {
    "url": "assets/WdFeedbackForm-UWa76qwV.js",
    "revision": "555c498900bfa3de69e5a47dd5c1338d"
  }, {
    "url": "assets/WdHutView-BJeplaj7.js",
    "revision": "278f3f65aa34b72b6691fc47bd932f86"
  }, {
    "url": "assets/WdHutView-CZ0vjr2U.css",
    "revision": "adf6cd05d78211524510765bc1ecf27d"
  }, {
    "url": "assets/WdMapMenu-DteBj4NN.js",
    "revision": "5190849fca5e261218b7ce57b743aa1b"
  }, {
    "url": "assets/WdMapView-CVZdNcH6.js",
    "revision": "3f46ca29c005f6d2ca7f66fc9818195b"
  }, {
    "url": "assets/WdMapView-CZLaBDzj.css",
    "revision": "028bdf0a76e80cd8d7b96a48b9a262eb"
  }, {
    "url": "assets/WdSupportForm-BhgbTVs9.js",
    "revision": "e8addb137199f9c29c26c04a9fe3b12d"
  }, {
    "url": "assets/WdSupportForm-CBNDkmXx.css",
    "revision": "c6a786a1786798999caf07d62d4441d6"
  }, {
    "url": "browserconfig.xml",
    "revision": "6a028c5370b320356ae6b731be1fe54b"
  }, {
    "url": "errors/logo_404.svg",
    "revision": "33d1103332b5d6a1927ab9dd0106528f"
  }, {
    "url": "favicon_maskable.svg",
    "revision": "69fc762669423004481386ba7776a8cb"
  }, {
    "url": "favicon_shape.svg",
    "revision": "2452c6327bf5176b772a8d499c1dfabc"
  }, {
    "url": "favicon-16x16.png",
    "revision": "035b5793399b11cc56f8f02d65617f0d"
  }, {
    "url": "favicon-32x32.png",
    "revision": "e423a29226417937662e922628996570"
  }, {
    "url": "favicon.ico",
    "revision": "9b56dcef02b086061301d70b8413333c"
  }, {
    "url": "icons.svg",
    "revision": "731fdb1d0d159b544a4a76c4e48f859e"
  }, {
    "url": "icons/apple-icon-120x120.png",
    "revision": "69507966b240aa6b608c35683c8b2e04"
  }, {
    "url": "icons/apple-icon-152x152.png",
    "revision": "4542ba5d395c35f773ac7051a4806c64"
  }, {
    "url": "icons/apple-icon-167x167.png",
    "revision": "88749fd8de8d22eae62177eec0a9bed0"
  }, {
    "url": "icons/apple-icon-180x180.png",
    "revision": "cd529aa0f2c1cfc2475b918b94e037c6"
  }, {
    "url": "icons/apple-launch-1080x2340.png",
    "revision": "ed109d71e517487f21ea37093b7bf1ab"
  }, {
    "url": "icons/apple-launch-1125x2436.png",
    "revision": "57733a316a0281668c172879fdeb9374"
  }, {
    "url": "icons/apple-launch-1170x2532.png",
    "revision": "3a5f3be6dd78c5e15290f586688ab199"
  }, {
    "url": "icons/apple-launch-1179x2556.png",
    "revision": "2e5b5425abca6368d2933776f0fd4087"
  }, {
    "url": "icons/apple-launch-1242x2208.png",
    "revision": "73e67129231a3dd221e5fc2bdbd0b28d"
  }, {
    "url": "icons/apple-launch-1242x2688.png",
    "revision": "97c97431117a226eeefd5b32adb57bf9"
  }, {
    "url": "icons/apple-launch-1284x2778.png",
    "revision": "2e385a430cd3924f72913cbe67796db0"
  }, {
    "url": "icons/apple-launch-1290x2796.png",
    "revision": "15fbc24dac042f8563f651b7e85a4bd5"
  }, {
    "url": "icons/apple-launch-1536x2048.png",
    "revision": "5f445c0a1fbe8dc02936f3eb7c01eda9"
  }, {
    "url": "icons/apple-launch-1620x2160.png",
    "revision": "a70d809fb3314d233f3ff655ff39f84d"
  }, {
    "url": "icons/apple-launch-1668x2224.png",
    "revision": "58e5053115cbddf6952e0570e1df6e68"
  }, {
    "url": "icons/apple-launch-1668x2388.png",
    "revision": "878b1d73527cd11871e71553f4833849"
  }, {
    "url": "icons/apple-launch-2048x2732.png",
    "revision": "de8db82094374dd108eef6844bdecbb0"
  }, {
    "url": "icons/apple-launch-750x1334.png",
    "revision": "066a270dd9f0b789a5c69a635ff03f82"
  }, {
    "url": "icons/apple-launch-828x1792.png",
    "revision": "b2bfe6dddada7d8073860d390c41ec4c"
  }, {
    "url": "icons/icon-192x192.png",
    "revision": "375fe812451cbc0a20d423e58c68ada8"
  }, {
    "url": "icons/icon-512x512.png",
    "revision": "95ffc20d9f1bcfe630c6c3da86785d5e"
  }, {
    "url": "icons/icon-maskable-192x192.png",
    "revision": "1de4b809bffc6792d1bca1a31961bbf9"
  }, {
    "url": "icons/icon-maskable-512x512.png",
    "revision": "b8884a40a1977e48d35bcc990ec83bd9"
  }, {
    "url": "images/mailbox_blue_header.webp",
    "revision": "40496feafa724ac60b1902ca564dd814"
  }, {
    "url": "index.html",
    "revision": "88b2a6e9990dbccc200d4f461739d39b"
  }, {
    "url": "logos/logo_beta.svg",
    "revision": "97c76de6ac033df4fcbb518202596119"
  }, {
    "url": "logos/wodore_original.svg",
    "revision": "cb52a73f577e73d6ce4aa4c8ed63e970"
  }, {
    "url": "manifest.json",
    "revision": "5bb38f30ba36327777e5939f86debfaa"
  }, {
    "url": "meta/meta.jpg",
    "revision": "97c7e472ecf9517bb7f7de805a962fa7"
  }, {
    "url": "mstile-150x150.png",
    "revision": "eb2f1d0b4e5582eb096e517fa1588277"
  }, {
    "url": "products/beer.png",
    "revision": "1634de266c6e3937c053b1bc9ba0cc97"
  }, {
    "url": "products/lunch.png",
    "revision": "7458097b6be93ec0c650b55eaa0b92a3"
  }, {
    "url": "products/snickers.png",
    "revision": "5ed56029adf06151f63f720b849120f1"
  }, {
    "url": "products/tip.png",
    "revision": "216f171aa7c9374224e6c5b7a802bfd9"
  }, {
    "url": "realfavgen/android-chrome-192x192.png",
    "revision": "ccddcd90a48bacc67752283ea2d3ceab"
  }, {
    "url": "realfavgen/android-chrome-512x512.png",
    "revision": "01d1d1e9a5bd12ea16499d9c3aca4fd7"
  }, {
    "url": "realfavgen/apple-touch-icon.png",
    "revision": "d9ae942f834732fc8916bf790bf5aad1"
  }, {
    "url": "realfavgen/favicon-16x16.png",
    "revision": "85306091da09350462857a510515168d"
  }, {
    "url": "realfavgen/favicon-32x32.png",
    "revision": "6c38a270a12c3098f453365d5b9ab736"
  }, {
    "url": "realfavgen/favicon.ico",
    "revision": "2a9f90490b296c378fc2726c09de2a03"
  }, {
    "url": "realfavgen/html_code.html",
    "revision": "c1b87ecd1015fe2f5998e2c0a00be3f5"
  }, {
    "url": "realfavgen/mstile-150x150.png",
    "revision": "3f3af4b861770ad07ffd9e8ac8bb92d6"
  }, {
    "url": "realfavgen/safari-pinned-tab.svg",
    "revision": "804ff6ba73952f10f496daaaaa138bfe"
  }, {
    "url": "realfavgen/site.webmanifest",
    "revision": "f7f5843d5221ec8589c8d92375ac6b16"
  }, {
    "url": "robots.txt",
    "revision": "1cfe34baf9a86daef55a485e4f49bfbf"
  }, {
    "url": "safari-pinned-tab.svg",
    "revision": "23888cf4eb6c6f092e2e294e3bcd73d4"
  }, {
    "url": "styles/basemapv-bmapv-3857-resources-styles-root.json",
    "revision": "e929bfe23c7bc58fc8bd55e4926a09be"
  }, {
    "url": "styles/basemapv-bmapv-3857.json",
    "revision": "a32020ed14ac5bba74814669710cced9"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/sw\.js$/, /workbox-(.)*\\.js$/]
  }));

}));
