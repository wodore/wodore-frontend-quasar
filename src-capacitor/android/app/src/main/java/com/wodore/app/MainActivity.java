package com.wodore.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapacitorWebView;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus && bridge != null && bridge.getWebView() != null) {
      // Kill the pull-down bounce + pull-to-refresh at the WebView
      // level — CSS overscroll-behavior alone doesn't reach Android's
      // native scroll gesture layer
      bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
      // Disable long-press text selection menus in the WebView
      bridge.getWebView().setLongClickable(false);
      bridge.getWebView().setHapticFeedbackEnabled(false);
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Edge-to-edge: the app draws under the system bars
    Window window = getWindow();
    window.setDecorFitsSystemWindows(false);

    // Transparent status + navigation bars — the app's own colors show
    // through (header, map, dialog surfaces). Icon contrast follows the
    // system dark mode via Android's auto-appearance.
    window.setStatusBarColor(Color.TRANSPARENT);
    window.setNavigationBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      // API 28+: let the navigation bar content be laid out behind it
      WindowManager.LayoutParams lp = window.getAttributes();
      lp.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
      window.setAttributes(lp);
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    // Re-apply on resume — Capacitor's bridge can reset window flags
    // during initialization. Setting the colors here ensures they stick.
    Window window = getWindow();
    window.setStatusBarColor(Color.TRANSPARENT);
    window.setNavigationBarColor(Color.TRANSPARENT);
  }
}
