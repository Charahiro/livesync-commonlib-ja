import type { NecessaryServices } from "@lib/interfaces/ServiceModule";
import { $msg } from "@lib/common/i18n";
import { encodeQR, encodeSettingsToQRCodeData, OutputFormat } from "@lib/API/processSetting";
import { EVENT_REQUEST_SHOW_SETUP_QR } from "@lib/events/coreEvents";
import { eventHub } from "@lib/hub/hub";
import { fireAndForget } from "@lib/common/utils";
import type { SetupFeatureHost } from "./types";

export async function encodeSetupSettingsAsQR(host: SetupFeatureHost) {
    const settingString = encodeSettingsToQRCodeData(host.services.setting.currentSettings());
    const result = encodeQR(settingString, OutputFormat.SVG);
    if (result === "") {
        return "";
    }

    if (typeof result === "string") {
        const msg = $msg("Setup.QRCode", { qr_image: result });
        await host.services.UI.confirm.confirmWithMessage("設定QRコード", msg, ["OK"], "OK");
        return result;
    } else {
        // Multi-page QR code
        let currentIndex = 0;
        while (currentIndex < result.total) {
            const msg = `設定が大きすぎるため、1つのQRコードに収まりません。
複数のQRコードを結合するためにアグリゲーターを使用します。
設定はどのサーバーにも送信されず、このデバイス上でのみ処理されます。
スマートフォンのカメラでこのQRコードをスキャンし、ブラウザでページを開いてください。
すべてのパーツが収集されると、結合済み設定を使って Obsidian に戻ります。

進捗: ${currentIndex + 1} / ${result.total}
${result.parts[currentIndex]}`;

            const buttons = [];
            const BUTTON_BACK = "戻る";
            const BUTTON_NEXT = "次へ";
            const BUTTON_CANCEL = "キャンセル";
            const BUTTON_DONE = "完了";
            if (currentIndex > 0) buttons.push(BUTTON_BACK);
            if (currentIndex < result.total - 1) {
                buttons.push(BUTTON_NEXT);
                buttons.push(BUTTON_CANCEL);
            } else {
                buttons.push(BUTTON_DONE);
            }

            const choice = await host.services.UI.confirm.confirmWithMessage(
                "設定QRコード (分割)",
                msg,
                buttons,
                buttons[
                    buttons.indexOf(BUTTON_NEXT) !== -1 ? buttons.indexOf(BUTTON_NEXT) : buttons.indexOf(BUTTON_DONE)
                ]
            );

            if (choice === BUTTON_NEXT) {
                currentIndex++;
            } else if (choice === BUTTON_BACK) {
                currentIndex--;
            } else {
                break;
            }
        }
        return result.parts[0]; // Return the first one for compatibility
    }
}

export function useSetupQRCodeFeature(host: NecessaryServices<"API" | "UI" | "setting" | "appLifecycle", never>) {
    host.services.appLifecycle.onLoaded.addHandler(() => {
        host.services.API.addCommand({
            id: "livesync-setting-qr",
            name: "設定をQRコードとして表示",
            callback: () => fireAndForget(encodeSetupSettingsAsQR(host)),
        });
        eventHub.onEvent(EVENT_REQUEST_SHOW_SETUP_QR, () => fireAndForget(() => encodeSetupSettingsAsQR(host)));
        return Promise.resolve(true);
    });
}
