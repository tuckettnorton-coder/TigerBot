package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.MacroInputGuard;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Blocks real hardware events for the configured macro target while the macro is active. */
@Mixin(KeyBinding.class)
public abstract class KeyBindingInputMixin {
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
}
