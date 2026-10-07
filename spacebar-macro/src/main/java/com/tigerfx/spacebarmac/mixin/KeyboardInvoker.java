package com.tigerfx.spacebarmac.mixin;

import net.minecraft.client.Keyboard;
import net.minecraft.client.input.KeyInput;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(Keyboard.class)
public interface KeyboardInvoker {
    @Invoker("onKey")
    void spacebarMacro$invokeOnKey(long window, int action, KeyInput input);
}
