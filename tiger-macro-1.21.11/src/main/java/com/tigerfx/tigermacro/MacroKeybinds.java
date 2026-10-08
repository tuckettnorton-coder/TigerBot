package com.tigerfx.tigermacro;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.util.InputUtil;

/** Utility methods for the mod's configurable controls. */
public final class MacroKeybinds {
    private MacroKeybinds() {
    }

    public enum BindingType {
        PLACEMENT,
        GLOBAL,
        SETTINGS
    }

    public static KeyBinding getBinding(BindingType type) {
        return switch (type) {
            case PLACEMENT -> TigerMacroClient.TOGGLE_MACRO_KEY;
            case GLOBAL -> TigerMacroClient.TOGGLE_GLOBAL_KEY;
            case SETTINGS -> TigerMacroClient.OPEN_CONFIG_KEY;
        };
    }

    public static boolean conflictsWithOtherControls(BindingType target, InputUtil.Key candidate) {
        if (candidate == null || candidate.equals(InputUtil.UNKNOWN_KEY)) {
            return false;
        }

        for (BindingType type : BindingType.values()) {
            if (type == target) {
                continue;
            }
            if (candidate.equals(getBinding(type).getBoundKey())) {
                return true;
            }
        }
        return false;
    }
}
