package com.tigerfx.tigermacro.mixin;

import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Exposes vanilla's private item-use method without altering its behavior. */
@Mixin(MinecraftClient.class)
public interface MinecraftClientInvokerMixin {
    @Invoker("doItemUse")
    void tigerMacro$doItemUse();
}
