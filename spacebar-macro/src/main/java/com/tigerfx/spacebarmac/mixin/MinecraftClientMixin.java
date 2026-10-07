package com.tigerfx.spacebarmac.mixin;

import com.tigerfx.spacebarmac.SpacebarMacro;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Inject(method = "render", at = @At("HEAD"))
    private void spacebarMacro$render(boolean tick, CallbackInfo ci) {
        SpacebarMacro.emitRepeat((MinecraftClient) (Object) this);
    }
}
