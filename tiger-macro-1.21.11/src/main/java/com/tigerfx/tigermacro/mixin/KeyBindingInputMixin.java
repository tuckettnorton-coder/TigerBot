package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.MacroInputGuard;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.List;
import java.util.Map;

/**
 * Separates the macro's synthetic click from real held-key state.
 *
 * For a synthetic macro action, only the KeyBinding click counter is advanced.
 * This deliberately does NOT call setPressed(), which is important for sticky
 * or toggle-style key bindings.
 */
@Mixin(KeyBinding.class)
public abstract class KeyBindingInputMixin {
    @Shadow
    @Final
    private static Map<InputUtil.Key, List<KeyBinding>> KEY_TO_BINDINGS;

    @Shadow
    private int timesPressed;

    @Inject(method = "onKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigerMacro$handleSyntheticPress(InputUtil.Key key, CallbackInfo ci) {
        if (MacroInputGuard.isSyntheticPress()) {
            List<KeyBinding> bindings = KEY_TO_BINDINGS.get(key);
            if (bindings != null) {
                for (KeyBinding binding : bindings) {
                    ((KeyBindingInputMixin) (Object) binding).tigerMacro$incrementClick();
                }
            }
            // Do not run Minecraft's normal implementation a second time.
            ci.cancel();
            return;
        }

        if (MacroInputGuard.shouldSuppressPhysicalKey(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "setKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigerMacro$filterPhysicalState(
            InputUtil.Key key,
            boolean pressed,
            CallbackInfo ci
    ) {
        if (!MacroInputGuard.isSyntheticPress()
                && MacroInputGuard.shouldSuppressPhysicalKey(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "setPressed", at = @At("HEAD"), cancellable = true)
    private void tigerMacro$filterPollingState(boolean pressed, CallbackInfo ci) {
        if (!MacroInputGuard.isSyntheticPress()
                && MacroInputGuard.shouldSuppressPhysicalKey(((KeyBinding) (Object) this).getBoundKey())) {
            ci.cancel();
        }
    }

    private void tigerMacro$incrementClick() {
        this.timesPressed++;
    }
}
