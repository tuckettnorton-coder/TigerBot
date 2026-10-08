package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.InputUtil;

/** Keeps physical target-key input separate from the macro-generated press event. */
public final class MacroInputGuard {
    private static boolean syntheticPress;

    private MacroInputGuard() {}

    public static void beginSyntheticPress() {
        syntheticPress = true;
    }

    public static void endSyntheticPress() {
        syntheticPress = false;
    }

    public static boolean isSyntheticPress() {
        return syntheticPress;
    }

    public static boolean shouldSuppressPhysicalKey(InputUtil.Key key) {
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
