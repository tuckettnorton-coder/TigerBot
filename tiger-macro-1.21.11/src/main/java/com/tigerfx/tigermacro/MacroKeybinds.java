package com.tigerfx.tigermacro;

import com.tigerfx.tigermacro.mixin.KeyBindingAccessorMixin;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;

/** Utility methods for the mod's configurable controls. */
public final class MacroKeybinds {
    private MacroKeybinds() {
    }

    public enum BindingType {
        ENABLE_DISABLE,
        MECHANIZED,
        SETTINGS
    }

    public static KeyBinding getBinding(BindingType type) {
        return switch (type) {
            case ENABLE_DISABLE -> TigerMacroClient.ENABLE_DISABLE_KEY;
            case MECHANIZED -> TigerMacroClient.MECHANIZED_KEY;
            case SETTINGS -> TigerMacroClient.OPEN_CONFIG_KEY;
        };
    }

    public static InputUtil.Key getBoundKey(KeyBinding binding) {
        return ((KeyBindingAccessorMixin) binding).tigerMacro$getBoundKey();
    }

    public static boolean conflictsWithOtherControls(BindingType target, InputUtil.Key candidate) {
        if (candidate == null || candidate.equals(InputUtil.UNKNOWN_KEY)) {
            return false;
        }

        for (BindingType type : BindingType.values()) {
            if (type == target) {
                continue;
            }
            if (candidate.equals(getBoundKey(getBinding(type)))) {
                return true;
            }
        }
        return false;
    }
}
