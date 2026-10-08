package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.InputUtil;

/** Keeps physical target-key input separate from the macro-generated press event. */
final class MacroInputGuard {
    private static boolean syntheticPress;

    private MacroInputGuard() {}

    static void beginSyntheticPress() {
        syntheticPress = true;
    }

    static void endSyntheticPress() {
        syntheticPress = false;
    }

    static boolean isSyntheticPress() {
        return syntheticPress;
    }

    static boolean shouldSuppressPhysicalKey(InputUtil.Key key) {
        if (syntheticPress || key == null || key.equals(InputUtil.UNKNOWN_KEY)) {
            return false;
        }

        MacroController controller = TigerMacroClient.getController();
        MinecraftClient client = MinecraftClient.getInstance();
        if (controller == null || !controller.isMacroEnabled()) {
            return false;
        }
        if (client == null || client.currentScreen != null) {
            return false;
        }

        InputUtil.Key targetKey = MacroKeybinds.getBoundKey(TigerMacroClient.MECHANIZED_KEY);
        return targetKey != null && key.equals(targetKey);
    }
}
