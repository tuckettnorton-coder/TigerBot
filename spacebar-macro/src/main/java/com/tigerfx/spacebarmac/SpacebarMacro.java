package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 250_000_000L;
    private static final long REPEAT_INTERVAL_NANOS = 33_333_333L;

    private static volatile boolean spaceHeld;
    private static volatile long nextRepeatNanos = Long.MAX_VALUE;
    private static volatile int spaceScancode = 57;

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    private SpacebarMacro() {
    }

    public static void initialize() {
    }

    public static void onPhysicalSpaceKey(int action, KeyInput input) {
        if (action == GLFW.GLFW_PRESS) {
            spaceHeld = true;
            spaceScancode = input.scancode();
            nextRepeatNanos = System.nanoTime() + INITIAL_DELAY_NANOS;
        } else if (action == GLFW.GLFW_RELEASE) {
            spaceHeld = false;
            nextRepeatNanos = Long.MAX_VALUE;
        }
    }

    public static boolean isSyntheticRepeat() {
        return SYNTHETIC_REPEAT.get();
    }

    public static void resetForFocusLoss() {
        spaceHeld = false;
        nextRepeatNanos = Long.MAX_VALUE;
    }

    public static void emitRepeat(MinecraftClient client) {
        if (!spaceHeld) {
            return;
        }

        if (!client.isWindowFocused()) {
            resetForFocusLoss();
            return;
        }

        long now = System.nanoTime();
        if (now < nextRepeatNanos) {
            return;
        }

        Keyboard keyboard = ((MinecraftClientAccessor) client).spacebarMacro$getKeyboard();
        KeyboardInvoker invoker = (KeyboardInvoker) (Object) keyboard;

        long window = client.getWindow().getHandle();
        KeyInput input = new KeyInput(GLFW.GLFW_KEY_SPACE, spaceScancode, 0);

        SYNTHETIC_REPEAT.set(true);
        try {
            invoker.spacebarMacro$invokeOnKey(window, GLFW.GLFW_REPEAT, input);
        } finally {
            SYNTHETIC_REPEAT.set(false);
        }

        nextRepeatNanos = now + REPEAT_INTERVAL_NANOS;
    }
}
