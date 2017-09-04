package rocks.festify;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import org.apache.cordova.*;
import org.json.*;

import com.spotify.sdk.android.authentication.*;

public class SpotifyOAuthPlugin extends CordovaPlugin {
    private static final int LOGIN_REQUEST_CODE = 8139;
    private static final String TAG = SpotifyOAuthPlugin.class.getName();

    private CallbackContext currentCtx = null;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext ctx) 
            throws JSONException {
        if ("getCode".equals(action)) {
            String clientId = args.getString(0);
            String redirectUrl = args.getString(1);
            String[] scopes = toStringArray(args.getJSONArray(2));

            this.getCode(clientId, redirectUrl, scopes, ctx);
            return true;
        } else {
            return false;
        }
    }

    private void getCode(
        final String clientId, 
        final String redirectUrl, 
        final String[] scopes,
        final CallbackContext ctx
    ) {
        cordova.setActivityResultCallback(this);
        this.currentCtx = ctx;

        AuthenticationRequest ab = (new AuthenticationRequest.Builder(
            clientId,
            AuthenticationResponse.Type.CODE,
            redirectUrl
        ))
            .setScopes(scopes)
            .build();

        AuthenticationClient.openLoginActivity(
            this.cordova.getActivity(), 
            LOGIN_REQUEST_CODE, 
            ab
        );
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);

        if (requestCode != LOGIN_REQUEST_CODE) {
            return;
        }

        final CallbackContext cb = this.currentCtx;
        if (cb == null) {
            Log.wtf(TAG, "Got null as callback context in erroneous auth response.");
            return;
        }

        final AuthenticationResponse response = AuthenticationClient.getResponse(resultCode, intent);
        if (response.getType() == AuthenticationResponse.Type.CODE) {
            JSONObject res = new JSONObject();
            try {
                res.put("code", response.getCode());
            } catch (JSONException ex) {
                Log.wtf(TAG, "Got JSONException while returning auth code.", ex);
            }
            cb.success(res);
        } else {
            JSONObject err = response.getType() == AuthenticationResponse.Type.EMPTY ?
                this.makeError(
                    "auth_canceled",
                    "The user cancelled the authentication process."
                ) : this.makeError(
                    "auth_failed",
                    "Received authentication response of invalid type " + response.getType().toString()
                );
            cb.error(err);
        }
            
        this.currentCtx = null;
    }

    private static JSONObject makeError(String type, String msg) {
        try {
            final JSONObject obj = new JSONObject();
            obj.put("type", type);
            obj.put("msg", msg);
            return obj;
        } catch (JSONException e) {
            Log.wtf(TAG, "Got a JSONException during error creation.", e);
            return null;
        }
    }

    private static String[] toStringArray(JSONArray arr) {
        String[] res = new String[arr.length()];
        for (int i = 0; i < arr.length(); i++) {
            try {
                res[i] = arr.getString(i);
            } catch (JSONException ex) {
                Log.e(TAG, "Couldn't parse JSON string array.", ex);
            }
        }
        return res;
    }
}