package com.ameva.adc.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.InputStream;

/**
 * @file MainActivity.java
 * @system AMEVA OS Android - Native Entry point
 * @location packages/mobile/android/app/src/main/java/com/ameva/adc/app/MainActivity.java
 * @role Launches Capacitor WebView and intercepts OS viewing Intents for .adc documents.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "AMEVA_MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 앱 최초 기동 시 Intent 인자 수신 및 파일 연동 시도
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // 백그라운드에 떠있다가 Intent가 새로 인입되는 시나리오 대응
        handleIntent(intent);
    }

    /**
     * 외부 파일 열기 Intent(ACTION_VIEW) 수신 시 해당 파일 내용을 Base64 변환하여 웹뷰로 주입합니다.
     */
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri data = intent.getData();

        /*
         * [제어 구문 명세]
         * - 조건: Intent 액션이 ACTION_VIEW 이고 대상 데이터 URI가 제공되었을 때
         * - 만족 시: 파일 입출력을 수행해 데이터를 읽고 base64로 가공해 WebView의 dispatchEvent로 전달합니다.
         */
        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            Log.d(TAG, "🔍 외부 파일 VIEW 인텐트 유입: " + data.toString());
            try {
                // ContentResolver를 사용하여 content:// 및 file:// URI 통합 대응 파일 읽기
                InputStream inputStream = getContentResolver().openInputStream(data);
                if (inputStream != null) {
                    // 가용한 크기만큼 바이너리 버퍼 생성
                    int size = inputStream.available();
                    byte[] buffer = new byte[size];
                    int bytesRead = inputStream.read(buffer);
                    inputStream.close();

                    if (bytesRead > 0) {
                        // 특수 기호나 개행 문자 파싱 충돌 방지를 위해 Base64로 일괄 안전 패킹
                        String base64Content = Base64.encodeToString(buffer, Base64.NO_WRAP);
                        
                        // 웹뷰 로딩 완료 시점과의 레이스 컨디션 방지를 위해 지연 주입 설정
                        final String js = "setTimeout(function() { " +
                                "window.dispatchEvent(new CustomEvent('openExternalAdcFile', { " +
                                "detail: { content: '" + base64Content + "', filePath: '" + data.toString() + "', isBinary: true } " +
                                "}));" +
                                "}, 1500);";

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (bridge != null && bridge.getWebView() != null) {
                                    bridge.getWebView().evaluateJavascript(js, null);
                                    Log.d(TAG, "🚀 WebView로 openExternalAdcFile 이벤트 주입 플러싱.");
                                }
                            }
                        });
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "❌ 외부 파일 스트림 로드 실패: " + e.getMessage());
            }
        }
    }
}
