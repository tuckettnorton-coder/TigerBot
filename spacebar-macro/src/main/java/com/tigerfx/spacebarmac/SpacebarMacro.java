package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 250_000_000L;
    private static final long REPEAT_INTERVAL_NANOS = 33_333_333L;
    private static final int KEY_COUNT = GLFW.GLFW_KEY_LAST + 1;

    private static final boolean[] keyHeld = new boolean[KEY_COUNT];
    private static final int[] keyScancode = new int[KEY_COUNT];
    private static final long[] nextRepeatNanos = new long[KEY_COUNT];

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    static {
        java.util.Arrays.fill(nextRepeatNanos, Long.MAX_VALUE);
    }

    private SpacebarMacro() {
    }

    public static void initialize() {
    }

    public static void onPhysicalKey(int action, KeyInput input) {
        int key = input.key();
        if (key < 0 || key >= KEY_COUNT) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            keyHeld[key] = true;
            keyScancode[key] = input.scancode();
            nextRepeatNanos[key] = System.nanoTime() + INITIAL_DELAY_NANOS;
        } else if (action == GLFW.GLFW_RELEASE) {
            keyHeld[key] = false;
            nextRepeatNanos[key] = Long.MAX_VALUE;
        }
    }

    public static boolean isSyntheticRepeat() {
        return SYNTHETIC_REPEAT.get();
    }

    public static void resetForFocusLoss() {
        java.util.Arrays.fill(keyHeld, false);
        java.util.Arrays.fill(nextRepeatNanos, Long.MAX_VALUE);
    }

    public static void emitRepeat(MinecraftClient client) {
        if (!client.isWindowFocused()) {
            resetForFocusLoss();
            return;
        }

        long now = System.nanoTime();
        Keyboard keyboard = ((MinecraftClientAccessor) client).spacebarMacro$getKeyboard();
        KeyboardInvoker invoker = (KeyboardInvoker) (Object) keyboard;
        long window = client.getWindow().getHandle();

        for (int key = 0; key < KEY_COUNT; key++) {
            if (!keyHeld[key] || now < nextRepeatNanos[key]) {
                continue;
            }

            KeyInput input = new KeyInput(key, keyScancode[key], 0);

            SYNTHETIC_REPEAT.set(true);
            try {
                invoker.spacebarMacro$invokeOnKey(window, GLFW.GLFW_REPEAT, input);
            } finally {
                SYNTHETIC_REPEAT.set(false);
            }

            nextRepeatNanos[key] = now + REPEAT_INTERVAL_NANOS;
        }
    }
}
