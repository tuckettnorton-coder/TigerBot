package com.tigerfx.spacebarmac.mixin;

import com.tigerfx.spacebarmac.SpacebarMacro;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.option.KeybindsScreen;
import net.minecraft.client.input.KeyInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import static org.lwjgl.glfw.GLFW.GLFW_PRESS;
import static org.lwjgl.glfw.GLFW.GLFW_REPEAT;

@Mixin(Keyboard.class)
public abstract class KeyboardMixin {
    @Inject(method = "onKey", at = @At("HEAD"), cancellable = true)
    private void spacebarMacro$trackKey(long window, int action, KeyInput input, CallbackInfo ci) {
        if (SpacebarMacro.isSyntheticRepeat()) {
            return;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client.currentScreen instanceof KeybindsScreen) {
            return;
        }

        if (SpacebarMacro.isOpenMenuKey(input)) {
            if (action == GLFW_PRESS) {
                SpacebarMacro.openMenu();
            }
            ci.cancel();
            return;
        }

        if (SpacebarMacro.isToggleKey(input)) {
            SpacebarMacro.handleControlKey(action);
            ci.cancel();
            return;
        }

        if (!SpacebarMacro.isTargetKey(input)) {
            return;
        }

        // When disabled, never intercept the target key's native events.
        // Explicitly cancel any outstanding custom timer, then let GLFW /
        // Minecraft process press, repeat, and release normally using the
        // user's operating-system keyboard-repeat settings.
        if (!SpacebarMacro.isEnabled()) {
            SpacebarMacro.stopRepeating();
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
