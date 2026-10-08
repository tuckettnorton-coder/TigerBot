package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.MacroInputGuard;
import com.tigerfx.tigermacro.MacroKeybinds;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Prevents the real hardware state of the selected Mechanized Key from creating
 * an additional repeat stream while the macro is active.
 */
@Mixin(KeyBinding.class)
public abstract class KeyBindingInputMixin {
    @Shadow
    protected InputUtil.Key boundKey;

    @Inject(method = "onKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigerMacro$filterPhysicalPress(InputUtil.Key key, CallbackInfo ci) {
        if (!MacroInputGuard.isSyntheticPress() && MacroInputGuard.shouldSuppressPhysicalKey(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "setKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigerMacro$filterPhysicalState(InputUtil.Key key, boolean pressed, CallbackInfo ci) {
        if (!MacroInputGuard.isSyntheticPress() && MacroInputGuard.shouldSuppressPhysicalKey(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "setPressed", at = @At("HEAD"), cancellable = true)
    private void tigerMacro$filterPollingState(boolean pressed, CallbackInfo ci) {
        if (!MacroInputGuard.isSyntheticPress()
                && MacroInputGuard.shouldSuppressPhysicalKey(boundKey)
            ) {
            ci.cancel();
        }
    }
}
