package com.wodore.app;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Edge-to-edge: the app draws under the system bars. The WEBVIEW
    // content avoids the bars via CSS safe-area insets; the system bars
    // themselves get transparent backgrounds so the app color shows
    // through (instead of Android's default scrim).
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    // Transparent navigation + status bar backgrounds — the app's own
    // colors (header, map, dialog surfaces) show through the bars.
    // Icon contrast follows the system dark mode: Android auto-adjusts
    // the status/navigation icons (light icons in dark mode, dark icons
    // in light mode) because the system knows the system theme.
    getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
    getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);

    // API 35+: enforce light/dark system bar icons based on the SYSTEM
    // theme (not the in-app theme toggle) so the bars always match the
    // device's appearance.
    if (android.os.Build.VERSION.SDK_INT >= 35) {
      WindowInsetsController controller = getWindow().getInsetsController();
      if (controller != null) {
        int currentNightMode = getResources().getConfiguration().uiMode
            & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        boolean isSystemDark = currentNightMode
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        if (isSystemDark) {
          // Light icons on transparent bar
          controller.setSystemBarsAppearance(
              0,
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                  | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
          );
        } else {
          // Dark icons on transparent bar
          controller.setSystemBarsAppearance(
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                  | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                  | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
          );
        }
      }
    }
  }
}
