package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.TigerMacroClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(KeyBinding.class)
public abstract class KeyBindingMixin {
    @Inject(method = "setKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigermacro$filterRawHeldState(
            InputUtil.Key key,
            boolean pressed,
            CallbackInfo ci
    ) {
        if (TigerMacroClient.shouldBlockRawMacroInput(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "onKeyPressed", at = @At("HEAD"), cancellable = true)
    private static void tigermacro$filterRawPress(
            InputUtil.Key key,
            CallbackInfo ci
    ) {
        if (TigerMacroClient.shouldBlockRawMacroInput(key)) {
            ci.cancel();
        }
    }

    @Inject(method = "setPressed", at = @At("HEAD"), cancellable = true)
    private void tigermacro$filterBindingState(
            boolean pressed,
            CallbackInfo ci
    ) {
        if (TigerMacroClient.shouldBlockMacroBinding((KeyBinding) (Object) this)) {
            ci.cancel();
        }
    }
}
