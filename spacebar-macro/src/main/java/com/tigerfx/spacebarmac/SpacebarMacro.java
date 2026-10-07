package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 250_000_000L;
    private static final long REPEAT_INTERVAL_NANOS = 33_333_333L;
    private static final int KEY_COUNT = GLFW.GLFW_KEY_LAST + 1;

    private static final java.util.concurrent.atomic.AtomicIntegerArray keyHeld =
            new java.util.concurrent.atomic.AtomicIntegerArray(KEY_COUNT);
    private static final java.util.concurrent.atomic.AtomicIntegerArray keyScancode =
            new java.util.concurrent.atomic.AtomicIntegerArray(KEY_COUNT);

    private static final ScheduledExecutorService SCHEDULER =
            Executors.newScheduledThreadPool(
                    Math.max(2, Runtime.getRuntime().availableProcessors() / 2),
                    runnable -> {
                        Thread thread = new Thread(runnable, "Keyboard-Macro-Timer");
                        thread.setDaemon(true);
                        return thread;
                    });

    private static final ConcurrentHashMap<Integer, ScheduledFuture<?>> repeatTasks =
            new ConcurrentHashMap<>();

    private static volatile MinecraftClient client;

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    private SpacebarMacro() {
    }

    public static void initialize() {
        client = MinecraftClient.getInstance();
    }

    public static void onPhysicalKey(int action, KeyInput input) {
        int key = input.key();
        if (key < 0 || key >= KEY_COUNT) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            keyHeld.set(key, 1);
            keyScancode.set(key, input.scancode());

            ScheduledFuture<?> oldTask = repeatTasks.remove(key);
            if (oldTask != null) {
                oldTask.cancel(false);
            }

            ScheduledFuture<?> task = SCHEDULER.scheduleAtFixedRate(
                    () -> emitRepeat(key),
                    INITIAL_DELAY_NANOS,
                    REPEAT_INTERVAL_NANOS,
                    TimeUnit.NANOSECONDS
            );

            ScheduledFuture<?> racedTask = repeatTasks.put(key, task);
            if (racedTask != null) {
                racedTask.cancel(false);
            }
        } else if (action == GLFW.GLFW_RELEASE) {
            keyHeld.set(key, 0);

            ScheduledFuture<?> task = repeatTasks.remove(key);
            if (task != null) {
                task.cancel(false);
            }
        }
    }

    public static boolean isSyntheticRepeat() {
        return SYNTHETIC_REPEAT.get();
    }

    public static void resetForFocusLoss() {
        for (int key = 0; key < KEY_COUNT; key++) {
            if (keyHeld.getAndSet(key, 0) != 0) {
                ScheduledFuture<?> task = repeatTasks.remove(key);
                if (task != null) {
                    task.cancel(false);
                }
            }
        }
        repeatTasks.clear();
    }

    private static void emitRepeat(int key) {
        MinecraftClient minecraft = client;
        if (minecraft == null || keyHeld.get(key) == 0) {
            return;
        }

        if (!minecraft.isWindowFocused()) {
            resetForFocusLoss();
            return;
        }

        int scancode = keyScancode.get(key);
        KeyInput input = new KeyInput(key, scancode, 0);

        // Timer threads keep exact per-key cadence. The actual Minecraft
        // keyboard callback is executed on Minecraft's client thread so
        // input state is never mutated concurrently.
        minecraft.execute(() -> {
            if (keyHeld.get(key) == 0 || !minecraft.isWindowFocused()) {
                return;
            }

            Keyboard keyboard = ((MinecraftClientAccessor) minecraft).spacebarMacro$getKeyboard();
            KeyboardInvoker invoker = (KeyboardInvoker) (Object) keyboard;

            SYNTHETIC_REPEAT.set(true);
            try {
                invoker.spacebarMacro$invokeOnKey(
                        minecraft.getWindow().getHandle(),
                        GLFW.GLFW_REPEAT,
                        input
                );
            } finally {
                SYNTHETIC_REPEAT.set(false);
            }
        });
    }
}
