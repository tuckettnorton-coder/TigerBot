package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.MacroController;
import net.minecraft.client.KeyboardHandler;
import net.minecraft.client.input.KeyEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(KeyboardHandler.class)
public abstract class KeyboardHandlerMixin {
    @Inject(method = "keyPress", at = @At("HEAD"), cancellable = true)
    private void tigerMacro$handleNativeKey(long window, int action, KeyEvent event, CallbackInfo ci) {
        if (MacroController.isSyntheticEvent()) {
            return;
        }

        int key = event.key();
        if (MacroController.shouldSuppressNativeRepeat(key, action)) {
            ci.cancel();
            return;
        }

        MacroController.onNativeKeyEvent(window, key, event.scancode(), action, event.modifiers());
    }
}
