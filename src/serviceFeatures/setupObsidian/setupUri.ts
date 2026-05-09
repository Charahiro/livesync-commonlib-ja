import { LOG_LEVEL_NOTICE, type ObsidianLiveSyncSettings } from "@lib/common/types";
import type { LogFunction } from "@lib/services/lib/logUtils";
import { createInstanceLogFunction } from "@lib/services/lib/logUtils";
import { encodeSettingsToSetupURI } from "@lib/API/processSetting";
import { EVENT_REQUEST_COPY_SETUP_URI } from "@lib/events/coreEvents";
import { eventHub } from "@lib/hub/hub";
import { fireAndForget } from "@lib/common/utils";
import type { NecessaryServices } from "@lib/interfaces/ServiceModule";
import type { SetupFeatureHost } from "./types";

export async function askEncryptingPassphrase(host: SetupFeatureHost): Promise<string | false> {
    return await host.services.UI.confirm.askString(
        "設定を暗号化",
        "セットアップURIを暗号化するパスフレーズ",
        "",
        true
    );
}

export async function copySetupURI(host: SetupFeatureHost, log: LogFunction, stripExtra = true) {
    const encryptingPassphrase = await askEncryptingPassphrase(host);
    if (encryptingPassphrase === false) return;
    const encryptedURI = await encodeSettingsToSetupURI(
        host.services.setting.currentSettings(),
        encryptingPassphrase,
        [...((stripExtra ? ["pluginSyncExtendedSetting"] : []) as (keyof ObsidianLiveSyncSettings)[])],
        true
    );
    if (await host.services.UI.promptCopyToClipboard("セットアップURI", encryptedURI)) {
        log("Setup URI copied to clipboard", LOG_LEVEL_NOTICE);
    }
}

export async function copySetupURIFull(host: SetupFeatureHost, log: LogFunction) {
    const encryptingPassphrase = await askEncryptingPassphrase(host);
    if (encryptingPassphrase === false) return;
    const encryptedURI = await encodeSettingsToSetupURI(
        host.services.setting.currentSettings(),
        encryptingPassphrase,
        [],
        false
    );
    if (await host.services.UI.promptCopyToClipboard("セットアップURI", encryptedURI)) {
        log("Setup URI copied to clipboard", LOG_LEVEL_NOTICE);
    }
}

export function useSetupURIFeature(host: NecessaryServices<"API" | "UI" | "setting" | "appLifecycle", never>) {
    const log = createInstanceLogFunction("SF:SetupURI", host.services.API);
    host.services.appLifecycle.onLoaded.addHandler(() => {
        host.services.API.addCommand({
            id: "livesync-copysetupuri",
            name: "設定を新しいセットアップURIとしてコピー",
            callback: () => fireAndForget(copySetupURI(host, log)),
        });

        host.services.API.addCommand({
            id: "livesync-copysetupuri-short",
            name: "設定を新しいセットアップURIとしてコピー (カスタマイズ同期付き)",
            callback: () => fireAndForget(copySetupURI(host, log, false)),
        });

        host.services.API.addCommand({
            id: "livesync-copysetupurifull",
            name: "設定を新しいセットアップURIとしてコピー (完全)",
            callback: () => fireAndForget(copySetupURIFull(host, log)),
        });

        eventHub.onEvent(EVENT_REQUEST_COPY_SETUP_URI, () => fireAndForget(() => copySetupURI(host, log)));
        return Promise.resolve(true);
    });
}
