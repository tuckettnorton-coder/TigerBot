package com.tigerfx.spacebarmac.mixin;

import com.tigerfx.spacebarmac.SpacebarMacro;
import net.minecraft.client.Keyboard;
import net.minecraft.client.input.KeyInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import static org.lwjgl.glfw.GLFW.GLFW_REPEAT;

@Mixin(Keyboard.class)
public abstract class KeyboardMixin {
    @Inject(method = "onKey", at = @At("HEAD"), cancellable = true)
    private void spacebarMacro$trackKey(long window, int action, KeyInput input, CallbackInfo ci) {
        if (SpacebarMacro.isSyntheticRepeat()) {
            return;
        }

        if (SpacebarMacro.isToggleKey(input)) {
            SpacebarMacro.handleControlKey(action);
            ci.cancel();
            return;
        }

        if (!SpacebarMacro.isEnabled() || !SpacebarMacro.isTargetKey(input)) {
            return;
        }

        if (action == GLFW_REPEAT) {
            SpacebarMacro.onPhysicalKey(action, input);
            ci.cancel();
            return;
        }

        SpacebarMacro.onPhysicalKey(action, input);
    }
}
