package com.tigerfx.tigermacro.mixin;

import com.tigerfx.tigermacro.TigerMacroClient;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Resets the macro whenever Minecraft replaces or clears the current client world. */
@Mixin(MinecraftClient.class)
public abstract class MinecraftClientWorldMixin {
    @Inject(method = "setWorld(Lnet/minecraft/client/world/ClientWorld;)V", at = @At("HEAD"))
    private void tigerMacro$onSetWorld(ClientWorld world, CallbackInfo ci) {
        if (TigerMacroClient.getController() != null) {
            TigerMacroClient.getController().resetMacroState();
        }
    }
}
