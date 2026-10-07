package com.tigerfx.spacebarmac;

import com.tigerfx.spacebarmac.mixin.KeyboardInvoker;
import com.tigerfx.spacebarmac.mixin.MinecraftClientAccessor;
import net.minecraft.client.Keyboard;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.input.KeyInput;
import org.lwjgl.glfw.GLFW;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class SpacebarMacro {
    private static final long INITIAL_DELAY_NANOS = 0L;
    private static final long REPEAT_INTERVAL_NANOS = 33_333_333L;

    private static final ScheduledExecutorService SCHEDULER =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "Spacebar-Macro-Timer");
                thread.setDaemon(true);
                return thread;
            });

    private static volatile ScheduledFuture<?> repeatTask;
    private static volatile boolean spaceHeld;
    private static volatile int spaceScancode = 57;
    private static volatile MinecraftClient client;

    private static final ThreadLocal<Boolean> SYNTHETIC_REPEAT =
            ThreadLocal.withInitial(() -> false);

    private SpacebarMacro() {
    }

    public static void initialize() {
        client = MinecraftClient.getInstance();
    }

    public static void onPhysicalSpaceKey(int action, KeyInput input) {
        if (input.key() != GLFW.GLFW_KEY_SPACE) {
            return;
        }

        if (action == GLFW.GLFW_PRESS) {
            spaceHeld = true;
            spaceScancode = input.scancode();

            ScheduledFuture<?> oldTask = repeatTask;
            if (oldTask != null) {
                oldTask.cancel(false);
            }

            repeatTask = SCHEDULER.scheduleAtFixedRate(
                    SpacebarMacro::emitRepeat,
                    INITIAL_DELAY_NANOS,
                    REPEAT_INTERVAL_NANOS,
                    TimeUnit.NANOSECONDS
            );
        } else if (action == GLFW.GLFW_RELEASE) {
            spaceHeld = false;

            ScheduledFuture<?> task = repeatTask;
            repeatTask = null;
            if (task != null) {
                task.cancel(false);
            }
        }
    }

    public static boolean isSyntheticRepeat() {
        return SYNTHETIC_REPEAT.get();
    }

    public static void resetForFocusLoss() {
        spaceHeld = false;

        ScheduledFuture<?> task = repeatTask;
        repeatTask = null;
        if (task != null) {
            task.cancel(false);
        }
    }

    private static void emitRepeat() {
        MinecraftClient minecraft = client;
        if (minecraft == null || !spaceHeld) {
            return;
        }

        if (!minecraft.isWindowFocused()) {
            resetForFocusLoss();
            return;
        }

        KeyInput input = new KeyInput(
                GLFW.GLFW_KEY_SPACE,
                spaceScancode,
                0
        );

        minecraft.execute(() -> {
            if (!spaceHeld || !minecraft.isWindowFocused()) {
                return;
            }

            Keyboard keyboard =
                    ((MinecraftClientAccessor) minecraft).spacebarMacro$getKeyboard();
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