package com.tigerfx.spacebarmac.mixin;

import com.tigerfx.spacebarmac.SpacebarMacro;
import net.minecraft.client.Keyboard;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Keyboard.class)
public abstract class KeyboardMixin {
    @Inject(method = "onKey", at = @At("HEAD"), cancellable = true)
    private void spacebarMacro$trackSpace(long window, int action, KeyInput input, CallbackInfo ci) {
        if (input.key() != GLFW.GLFW_KEY_SPACE) {
            return;
        }

        if (action == GLFW.GLFW_REPEAT && !SpacebarMacro.isSyntheticRepeat()) {
            ci.cancel();
            return;
        }

        SpacebarMacro.onPhysicalSpaceKey(action, input);
    }
}
