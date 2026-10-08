package com.tigerfx.tigermacro.mixin;

import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Reads the current configurable key through the normal KeyBinding object. */
@Mixin(KeyBinding.class)
public interface KeyBindingAccessorMixin {
    @Accessor("boundKey")
    InputUtil.Key tigerMacro$getBoundKey();
}
