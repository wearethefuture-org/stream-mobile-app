package io.ionic.starter;

import android.app.Dialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

import static android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
import static android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_OFF;
import static android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN;
import static android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
import static android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;

public class MainActivity extends BridgeActivity {
  private static final String TAG = MainActivity.class.getSimpleName();
  private boolean isTouchable = true;
  private Dialog dialog;

  private BroadcastReceiver receiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
      if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
        Log.d("Broadcaster", "screen off");
        Window window = MainActivity.this.getWindow();
        window.addFlags( WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD );
        window.addFlags( WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED );
        window.addFlags( WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON   );
        MainActivity.this.dialog.show();
      } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
        Log.d("Broadcaster", "screen on");
        Window window = MainActivity.this.getWindow();
        window.clearFlags( WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD );
        window.clearFlags( WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED );
        window.addFlags( WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON   );
        MainActivity.this.dialog.hide();
        MainActivity.this.dialog.show();
      }
    }
  };

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(FLAG_KEEP_SCREEN_ON);
    dialog = new Dialog(this, R.style.Dialog);
    dialog.setContentView(R.layout.dialog);

    WindowManager.LayoutParams params = dialog.getWindow().getAttributes();
    dialog.getWindow().setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
    params.screenBrightness = 0;
    dialog.getWindow().setAttributes(params);
    dialog.getWindow().addFlags(FLAG_FULLSCREEN);
    // Initializes the Bridge
    this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
      // Additional plugins you've installed go here
      // Ex: add(TotallyAwesomePlugin.class);
    }});
  }

  /*@Override
  public void onResume() {
    super.onResume();
    IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
    filter.addAction(Intent.ACTION_SCREEN_OFF);
    registerReceiver(receiver, filter);
  }

  @Override
  public void onPause() {
    super.onPause();
    unregisterReceiver(receiver);
  }*/

  @Override
  public void onBackPressed() {
    if (isTouchable) {
      Log.d(TAG, "disabling touch");
      dialog.show();
    } else {
      Log.d(TAG, "enabling touch");
      dialog.dismiss();
      dialog.show();
    }

    isTouchable = !isTouchable;
    super.onBackPressed();
  }

  @Override
  public void onDestroy() {
    super.onDestroy();
    dialog.cancel();
  }
}
